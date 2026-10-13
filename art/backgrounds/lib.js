// Shared drawing helpers for the region backgrounds.
// Layer coordinates: sky 480x300 (screen); far 480x180 (file y = screen y + 10, bottom on y 170);
// ground 480x130 (row 0 = screen y 170). Anything drawn on far/ground wraps at 480 so it tiles.
const path = require('path');
const { Canvas, hash, bayer, hex } = require('./png');
const { makeTestScreen } = require('./scene');

const W = 480;
const TAU = Math.PI * 2;
// Game files go straight into public/bg; review images go to art/backgrounds/preview (git-ignored).
const BG = path.join(__dirname, '..', '..', 'public', 'bg');
const OUT = path.join(__dirname, 'preview');
const wave = (x, n, ph) => Math.sin(TAU * n * x / W + ph); // integer n => tiles every 480 px
const dither = (x, y, t) => t > bayer(x, y);
const wrapDx = (a, b) => { const d = Math.abs(a - b) % W; return Math.min(d, W - d); };

// Smooth value noise in [0,1); cell must divide 480 so it tiles horizontally.
function noise(x, y, cell, seed) {
  const cells = W / cell, gx = x / cell, gy = y / cell;
  const x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
  const v = (i, j) => hash(((i % cells) + cells) % cells, j, seed);
  const sm = t => t * t * (3 - 2 * t);
  const a = v(x0, y0) + (v(x0 + 1, y0) - v(x0, y0)) * sm(fx);
  const b = v(x0, y0 + 1) + (v(x0 + 1, y0 + 1) - v(x0, y0 + 1)) * sm(fx);
  return a + (b - a) * sm(fy);
}

// Shades a blob given an inside(x, y) test, lit from the top left. tones = [rim, light, mid, dark, edge].
function shadeBlob(c, x0, y0, x1, y1, inside, tones) {
  const [rim, light, mid, dark, edge] = tones;
  for (let y = Math.floor(y0); y <= y1; y++) for (let x = Math.floor(x0); x <= x1; x++) {
    if (!inside(x, y)) continue;
    let col = light;
    if (!inside(x - 2, y - 2) || !inside(x, y - 2)) col = rim;
    else if (!inside(x, y + 1) || !inside(x + 1, y)) col = edge;
    else if (!inside(x + 1, y + 3) || !inside(x + 3, y + 2)) col = dark;
    else if (!inside(x + 3, y + 5)) col = mid;
    c.set(x, y, col);
  }
}

// Vertical dithered gradient from y0 to y1 (rows past y1 keep the last colour).
function gradient(c, grad, y0, y1) {
  for (let y = y0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
    const t = Math.min(1, Math.max(0, (y - y0) / (y1 - y0))) * (grad.length - 1), i = Math.floor(t);
    c.set(x, y, dither(x, y, t - i) ? grad[Math.min(i + 1, grad.length - 1)] : grad[i]);
  }
}

// Big cumulus cloud: seeded disc cluster with a flat-ish base. tones: 5 colours, or a shader function.
function cumulus(c, cx, cy, w, h, seed, tones) {
  const discs = [];
  const n = Math.max(3, Math.round(w / 6));
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), bulge = Math.sin(Math.PI * t);
    const r = 4 + bulge * h * (0.5 + 0.5 * hash(i, 1, seed));
    discs.push([cx + (t - 0.5) * w + (hash(i, 2, seed) - 0.5) * 6, cy - bulge * h * 0.6 + (hash(i, 3, seed) - 0.5) * 4, r]);
  }
  for (let i = 0; i < n / 2; i++) {
    const d = discs[Math.floor(hash(i, 4, seed) * n)];
    discs.push([d[0] + (hash(i, 5, seed) - 0.5) * d[2], d[1] - d[2] * 0.6, d[2] * 0.55]);
  }
  const base = cy + 3;
  const inside = (x, y) => y <= base && discs.some(([bx, by, r]) => (x - bx) ** 2 + (y - by) ** 2 <= r * r);
  if (typeof tones === 'function') { // custom shader: tones(inside, x, y) -> colour
    for (let y = Math.floor(cy - h * 2); y <= base; y++) for (let x = Math.floor(cx - w); x <= cx + w; x++)
      if (inside(x, y)) c.set(x, y, tones(inside, x, y));
  } else shadeBlob(c, cx - w, cy - h * 2, cx + w, base, inside, tones);
  return inside;
}

// Mountain range. peaks: [x, height, slope]; base: bottom row.
// tones: {rim, lit, mid, dark, snow?, snowShade?, snowDepth?, jag?}. jag (px) roughens ridgelines away from the tips.
// Faces that rise to the right catch the top-left light, so jagged ridges get lit and shaded facets.
// Returns the top(x) function so callers can place things on it.
function mountains(c, peaks, base, t, seed = 0) {
  const jag = t.jag || 0;
  const tops = [], owners = [];
  for (let x = 0; x < W; x++) {
    let best = null;
    for (const p of peaks) {
      const dx = wrapDx(x, p[0]);
      const rough = jag * Math.min(1, dx / 8) * ((noise(x, 0, 6, seed + p[0]) - 0.5) * 2 + 0.5 * (noise(x, 1, 2, seed + p[0]) - 0.5));
      const top = base - p[1] + Math.round(dx * p[2] + 2.5 * noise(x, 0, 8, seed + p[0]) + rough);
      if (!best || top < best.top) best = { top, p };
    }
    tops[x] = Math.min(base, best.top); owners[x] = best.p;
  }
  const topAt = x => tops[((x % W) + W) % W];
  for (let x = 0; x < W; x++) {
    const top = tops[x], p = owners[x];
    const leftOfPeak = ((x - p[0] + W * 1.5) % W) - W / 2 < 0;
    const slope = topAt(x + 5) - topAt(x - 5); // >0: descending to the right
    const lit = leftOfPeak ? slope <= 5 : slope < -4;
    const peakTop = base - p[1];
    for (let y = top; y < base; y++) {
      let col = lit ? t.lit : t.mid;
      if (!lit && dither(x, y, (y - top) / 50)) col = t.dark;
      if (noise(x, y, 8, seed + 1) > 0.66 && dither(x, y, 0.5)) col = lit ? t.mid : t.dark; // gullies
      if (t.snow && y < peakTop + (t.snowDepth || 12) + 4 * noise(x, 0, 4, seed + 2) && y - top < 10) col = lit ? t.snow : t.snowShade;
      if (y === top) col = t.snow && y < peakTop + (t.snowDepth || 12) ? t.snow : t.rim;
      c.set(x, y, col);
    }
  }
  return x => topAt(Math.round(x));
}

// Fills from top(x) down to bottom; colorFn(x, y, depth) picks the colour.
function fillBelow(c, top, colorFn, bottom = c.h) {
  for (let x = 0; x < W; x++) for (let y = top(x); y < bottom; y++) c.set(x, y, colorFn(x, y, y - top(x)));
}

// Pine tree, feet at (x, by), lit from the left. tones = [lit, mid, dark].
function pine(c, x, by, h, tones) {
  c.rect(x, by - 2, 1, 3, '#3a2a24');
  for (let k = 0; k < h; k++) {
    const tier = k % Math.max(3, Math.round(h / 3));
    const half = Math.round((k / h) * h * 0.32 + tier * 0.6);
    for (let dx = -half; dx <= half; dx++) c.set(x + dx, by - 2 - h + k, dx < 0 ? tones[0] : dx === half ? tones[2] : tones[1]);
  }
}

// Bare dead tree: recursive branches.
function deadTree(c, x, by, h, col, seed) {
  const branch = (x0, y0, ang, len, w, d) => {
    for (let i = 0; i < len; i++) {
      const xx = x0 + Math.sin(ang) * i, yy = y0 - Math.cos(ang) * i;
      for (let k = 0; k < w; k++) c.set(xx + k, yy, col);
    }
    if (d > 3 || len < 3) return;
    const ex = x0 + Math.sin(ang) * len, ey = y0 - Math.cos(ang) * len;
    branch(ex, ey, ang - 0.5 - hash(d, len, seed) * 0.4, len * 0.62, Math.max(1, w - 1), d + 1);
    branch(ex, ey, ang + 0.4 + hash(len, d, seed) * 0.4, len * 0.58, Math.max(1, w - 1), d + 1);
  };
  branch(x, by, (hash(x, 0, seed) - 0.5) * 0.2, h * 0.55, 2, 0);
}

// Small grass/shrub tuft.
function tuft(c, x, y, h, dark, tip) {
  for (let k = 0; k < h; k++) c.set(x, y - k, k === h - 1 ? tip : dark);
  for (let k = 0; k < h - 1; k++) { c.set(x - 1, y - k, dark); c.set(x + 1, y - k, dark); }
  c.set(x - 2, y - h + 2, dark); c.set(x + 2, y - h + 2, dark);
}

// Rounded stones with lit top-left and dark bottom-right. tones = [lit, base, dark].
function stones(c, n, seed, y0, y1, minW, maxW, tones) {
  for (let i = 0; i < n; i++) {
    const sx = Math.floor(hash(i, 0, seed) * W), sy = y0 + Math.floor(hash(i, 1, seed) * (y1 - y0));
    const sw = minW + Math.floor(hash(i, 2, seed) * (maxW - minW)), sh = Math.max(2, Math.round(sw * 0.6));
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
      if ((y === 0 || y === sh - 1) && (x === 0 || x === sw - 1)) continue;
      let col = tones[1];
      if (y === 0 || x === 0) col = tones[0];
      if (y === sh - 1 || x === sw - 1) col = tones[2];
      c.set(sx + x, sy + y, col);
    }
  }
}

// Dark foreground soil strip from soilTop(x) to the bottom, with strata lines.
function soilStrip(c, soilTop, [a, b, line, deep]) {
  for (let x = 0; x < W; x++) for (let y = soilTop(x); y < c.h; y++) {
    const n = hash(x, y, 1);
    let col = n < 0.08 ? a : b;
    const band = y + 2 * wave(x, 5, 1.1) + wave(x, 13, 0.4);
    if (band > 110.5 && band < 112 && hash(x >> 2, 1, 26) < 0.7) col = line;
    if (y > 118) col = n < 0.08 ? b : deep;
    if (band > 124.5 && band < 126) col = line;
    c.set(x, y, col);
  }
}

// Mid-tone lane with soft lighter/darker patches. tones = [light, base, dark].
function lanePatches(c, y0, y1, tones, seed = 31) {
  for (let x = 0; x < W; x++) for (let y = y0; y < y1; y++) {
    const v = noise(x, y, 24, seed) * 0.6 + noise(x, y, 8, seed + 1) * 0.4 + (bayer(x, y) - 0.5) * 0.08;
    c.set(x, y, v > 0.64 ? tones[0] : v < 0.36 ? tones[2] : tones[1]);
  }
}

// Paving that tiles: rows of stones whose widths sum to 480. tones = {lit, base:[...], dark, mortar}.
function paving(c, y0, y1, rowH, minW, maxW, t, seed, inLane = () => true) {
  let row = 0;
  for (let y = y0; y < y1; y += rowH, row++) {
    const widths = [];
    let sum = 0, i = 0;
    while (sum < W) { const w = minW + Math.floor(hash(i++, row, seed) * (maxW - minW)); widths.push(w); sum += w; }
    widths[widths.length - 1] -= sum - W; // fix the last stone so the row tiles exactly
    if (widths[widths.length - 1] < minW / 2) { widths[widths.length - 2] += widths.pop(); }
    let x = Math.floor(hash(row, 99, seed) * W);
    widths.forEach((w, k) => {
      const base = t.base[Math.floor(hash(k, row, seed + 1) * t.base.length)];
      const cut = Math.floor(hash(k, row, seed + 3) * 3) - 1; // uneven bottom edge per stone
      for (let dy = 0; dy < rowH + cut; dy++) for (let dx = 0; dx < w; dx++) {
        const px = x + dx, py = y + dy;
        if (py >= y1 || !inLane(((px % W) + W) % W, py)) continue;
        let col = base;
        const corner = (dx < 2 || dx > w - 3) && (dy < 1 || dy > rowH + cut - 3);
        if (dy === rowH + cut - 1 || dx === w - 1 || corner) col = t.mortar;
        else if (dy === 0 || dx === 0) col = t.lit;
        else if (dy === rowH + cut - 2 || dx === w - 2) col = t.dark;
        else if (hash(px, py, seed + 2) < 0.04) col = t.dark;
        c.set(px, py, col);
      }
      x += w;
    });
  }
}

// Irregular flagstones/cobbles: Voronoi cells that tile at 480 px. n = number of stones,
// yScale > 1 makes stones wider than tall. tones = {lit, base:[...], dark, mortar}.
function voronoiPaving(c, y0, y1, n, t, seed, inLane = () => true, yScale = 1.8) {
  const pts = Array.from({ length: n }, (_, i) => [hash(i, 0, seed) * W, y0 - 6 + hash(i, 1, seed) * (y1 - y0 + 12)]);
  const cell = new Int16Array(W * (y1 - y0)), gap = new Float32Array(W * (y1 - y0));
  for (let y = y0; y < y1; y++) for (let x = 0; x < W; x++) {
    let d1 = 1e9, d2 = 1e9, k1 = 0;
    for (let k = 0; k < n; k++) {
      const dx = wrapDx(x, pts[k][0]), dy = (y - pts[k][1]) * yScale;
      const d = dx * dx + dy * dy;
      if (d < d1) { d2 = d1; d1 = d; k1 = k; } else if (d < d2) d2 = d;
    }
    cell[(y - y0) * W + x] = k1; gap[(y - y0) * W + x] = Math.sqrt(d2) - Math.sqrt(d1);
  }
  const at = (x, y) => (y < y0 || y >= y1) ? -1 : cell[(y - y0) * W + ((x % W) + W) % W];
  for (let y = y0; y < y1; y++) for (let x = 0; x < W; x++) {
    if (!inLane(x, y)) continue;
    const k = at(x, y), g = gap[(y - y0) * W + x];
    let col = t.base[Math.floor(hash(k, 2, seed) * t.base.length)];
    if (g < 1.6) col = t.mortar;
    else if (at(x - 1, y - 1) !== k || at(x, y - 2) !== k) col = t.lit;
    else if (at(x + 1, y + 1) !== k || at(x, y + 2) !== k) col = t.dark;
    else if (hash(x, y, seed + 2) < 0.03) col = t.dark;
    c.set(x, y, col);
  }
}

const SCREENS = [];
// Writes the three layers plus test screen and 1440 lane previews.
function output(name, sky, far, ground) {
  sky.save(path.join(BG, `${name}_sky.png`));
  far.save(path.join(BG, `${name}_far.png`));
  ground.save(path.join(BG, `${name}_ground.png`));
  const test = makeTestScreen(sky, far, ground, 0);
  test.save(path.join(OUT, `${name}_test.png`));
  test.scaled(3).save(path.join(OUT, `${name}_test_x3.png`));
  const lane = new Canvas(W * 3, 300);
  for (let k = 0; k < 3; k++) { lane.draw(sky, k * W, 0); lane.draw(far, k * W, -10); lane.draw(ground, k * W, 170); }
  lane.save(path.join(OUT, `${name}_lane_1440.png`));
  SCREENS.push(test);
  return test;
}

module.exports = {
  Canvas, hash, bayer, hex, W, TAU, OUT, wave, dither, noise, wrapDx, shadeBlob, gradient, cumulus,
  mountains, fillBelow, pine, deadTree, tuft, stones, soilStrip, lanePatches, paving, voronoiPaving, output, SCREENS,
};
