// Tidecoast Meadows: sky, far and ground layers plus a test screen.
// Styled after the concept sheet: saturated blue sky, big cumulus, sea cliffs with a
// sea stack and rock arch, dense round-canopy forest, grassy meadow lane.
// Run: node art/backgrounds/tidecoast.js
const { Canvas, hash, bayer } = require('./png');

const W = 480;
const TAU = Math.PI * 2;
const wave = (x, n, ph) => Math.sin(TAU * n * x / W + ph); // integer n => tiles every 480 px
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
const dither = (x, y, t) => t > bayer(x, y);

// Shades a blob given an inside(x, y) test, lit from the top left.
function shadeBlob(c, x0, y0, x1, y1, inside, tones) {
  const [rim, light, mid, dark, edge] = tones;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (!inside(x, y)) continue;
    let col = light;
    if (!inside(x - 2, y - 2) || !inside(x, y - 2)) col = rim;
    else if (!inside(x, y + 1) || !inside(x + 1, y)) col = edge;
    else if (!inside(x + 1, y + 3) || !inside(x + 3, y + 2)) col = dark;
    else if (!inside(x + 3, y + 5)) col = mid;
    c.set(x, y, col);
  }
}

// ---------- Sky 480 x 300 (fixed to the screen) ----------
const HORIZON = 100;
function makeSky() {
  const c = new Canvas(W, 300);
  const grad = ['#1f6fd0', '#2a80dc', '#3893e6', '#4da6ee', '#66baf4', '#86cdf7', '#a8dcf8'];
  for (let y = 0; y < 300; y++) for (let x = 0; x < W; x++) {
    if (y < HORIZON) {
      const t = (y / HORIZON) * (grad.length - 1), i = Math.floor(t);
      c.set(x, y, dither(x, y, t - i) ? grad[Math.min(i + 1, grad.length - 1)] : grad[i]);
    } else {
      // Sea: dark line at the horizon, getting lighter and bluer toward the shore.
      const t = Math.min(1, (y - HORIZON) / 60);
      let col = y === HORIZON ? '#1a5ca8' : dither(x, y, t) ? '#2b86d2' : '#2470bc';
      if (y > HORIZON + 2 && (y - HORIZON) % 4 === 0 && noise(x, y, 16, 3) > 0.55) col = '#4aa0e2';
      if (y > HORIZON + 4 && hash(x, y, 4) < 0.006) col = '#d6f0ff';
      c.set(x, y, col);
    }
  }

  // Big cumulus: each cloud is a seeded cluster of discs with a flat-ish base.
  const tones = ['#ffffff', '#eef7ff', '#d3e6f8', '#a9c8e6', '#8fb2d8'];
  function cumulus(cx, cy, w, h, seed) {
    const discs = [];
    const n = Math.round(w / 6);
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const dx = (t - 0.5) * w;
      const bulge = Math.sin(Math.PI * t); // tallest in the middle
      const r = 4 + bulge * h * (0.5 + 0.5 * hash(i, 1, seed));
      discs.push([cx + dx + (hash(i, 2, seed) - 0.5) * 6, cy - bulge * h * 0.6 + (hash(i, 3, seed) - 0.5) * 4, r]);
    }
    for (let i = 0; i < n / 2; i++) { // small puffs on top for a bumpy crown
      const d = discs[Math.floor(hash(i, 4, seed) * n)];
      discs.push([d[0] + (hash(i, 5, seed) - 0.5) * d[2], d[1] - d[2] * 0.6, d[2] * 0.55]);
    }
    const base = cy + 3;
    const inside = (x, y) => y <= base && discs.some(([bx, by, r]) => (x - bx) ** 2 + (y - by) ** 2 <= r * r);
    shadeBlob(c, Math.floor(cx - w), Math.floor(cy - h * 2), Math.ceil(cx + w), base, inside, tones);
  }
  cumulus(250, 38, 56, 14, 1);
  cumulus(410, 62, 60, 13, 2);
  cumulus(60, 92, 90, 22, 3);
  cumulus(330, 90, 80, 16, 4);
  cumulus(470, 96, 50, 12, 5);
  cumulus(170, 70, 36, 9, 6);

  // Gulls.
  for (const [bx, by] of [[200, 50], [212, 45], [330, 54]]) {
    for (const [dx, dy] of [[-2, -1], [-1, 0], [0, -1], [1, 0], [2, -1]]) c.set(bx + dx, by + dy, '#ffffff');
  }
  return c;
}

// ---------- Far layer 480 x 180, transparent, tiles in X. File y = screen y + 10. ----------
function makeFar() {
  const H = 180, HZ = HORIZON + 10; // horizon in file coordinates
  const c = new Canvas(W, H, true);

  // Distant blue mountains standing on the sea horizon.
  const peaks = [[100, 42, 0.9], [140, 28, 1.2], [392, 24, 1.0], [418, 16, 1.3]];
  for (let x = 0; x < W; x++) {
    let top = HZ;
    for (const [px, ph, sl] of peaks) {
      let dx = Math.abs(x - px); dx = Math.min(dx, W - dx);
      top = Math.min(top, HZ - ph + Math.round(dx * sl + 2 * wave(x, 37, px)));
    }
    for (let y = top; y < HZ; y++) {
      const lit = peaks.some(([px]) => x < px && x > px - 40);
      c.set(x, y, y === top ? '#c3dcf0' : lit && y < top + 6 ? '#b0cde6' : dither(x, y, (y - top) / 30) ? '#86aed2' : '#97badb');
    }
  }

  // Coastline: land everywhere except a sea inlet; the inlet's edges are rocky cliffs.
  const landTop = x => Math.round(122 + 6 * wave(x, 2, 0.5) + 4 * wave(x, 5, 1.7) + 2 * wave(x, 11, 0.3));
  const xl = y => 192 + Math.round((y - 110) * 0.18 + 2 * noise(0, y, 4, 7));  // left cliff edge
  const xr = y => 300 - Math.round((y - 110) * 0.22 + 2 * noise(0, y, 4, 8)); // right cliff edge
  const ARCH = { x: 318, w: 9, top: 152 };
  const inArch = (x, y) => y >= ARCH.top && ((x - ARCH.x) / ARCH.w) ** 2 + ((y - H) / (H - ARCH.top)) ** 2 < 1;
  const isLand = (x, y) => {
    x = ((x % W) + W) % W;
    return y >= landTop(x) && y < H && (x < xl(y) || x > xr(y)) && !inArch(x, y);
  };
  const isRock = (x, y) => {
    x = ((x % W) + W) % W;
    if (y < landTop(x) + 3) return false;
    return (x < xl(y) && x > xl(y) - 14) || (x > xr(y) && x < xr(y) + 14) || (x > 300 && x < 338 && y > 140);
  };
  const ROCK = ['#c4cbcc', '#a3adb0', '#86919a', '#67717c', '#4c5560'];
  for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) {
    if (!isLand(x, y)) continue;
    let col;
    if (isRock(x, y)) {
      const lit = !isLand(x - 1, y) && x < 260 ? false : !isLand(x + 1, y) ? false : !isLand(x - 2, y);
      const n = noise(x, y, 4, 9);
      col = lit ? ROCK[1] : n > 0.62 ? ROCK[1] : n > 0.38 ? ROCK[2] : ROCK[3];
      if ((y + Math.round(2 * noise(x, 0, 8, 10))) % 7 === 0 && hash(x >> 1, y, 11) < 0.7) col = ROCK[4]; // strata
      if (!isLand(x + 1, y) || !isLand(x, y + 1)) col = ROCK[4];
      if (!isLand(x - 1, y) || !isLand(x, y - 1)) col = ROCK[0];
    } else {
      const d = y - landTop(x);
      col = d === 0 ? '#8fd468' : d < 3 ? '#6cbc4c' : dither(x, y, (d - 3) / 22) ? (dither(x, y, (d - 25) / 16) ? '#2a5e2c' : '#3a7e36') : '#4f9e42';
    }
    c.set(x, y, col);
  }
  // Grass caps hanging over the cliff tops.
  for (let x = 0; x < W; x++) if (isRock(x, landTop(x) + 4)) for (let k = 3; k < 5 + (hash(x, 0, 12) * 3 | 0); k++) c.set(x, landTop(x) + k, k < 4 ? '#6cbc4c' : '#4f9e42');

  // Sea stack with a grassy cap, and a few rocks.
  const stackTop = 84;
  for (let y = stackTop; y < H; y++) {
    const t = (y - stackTop) / (H - stackTop);
    const half = Math.round(7 + t * 6 + 1.5 * noise(0, y, 4, 13));
    const off = Math.round(2 * noise(1, y, 8, 14));
    for (let dx = -half; dx <= half; dx++) {
      const x = 246 + off + dx;
      let col = dx < -half + 3 ? ROCK[0] : dx < -2 ? ROCK[1] : dx < half - 3 ? ROCK[2] : ROCK[3];
      if (dx >= half - 1) col = ROCK[4];
      if ((y % 6 === 0) && hash(x, y, 15) < 0.6 && dx > -half + 1) col = ROCK[3];
      if (y - stackTop < 3) col = y === stackTop ? '#8fd468' : '#5aa848';
      c.set(x, y, col);
    }
  }
  for (const [rx, ry, rw] of [[226, 172, 5], [268, 168, 7], [276, 174, 4]])
    for (let y = ry; y < H; y++) for (let dx = 0; dx < rw - Math.max(0, ry + 2 - y); dx++) c.set(rx + dx, y, dx === 0 ? ROCK[1] : dx === rw - 1 ? ROCK[4] : ROCK[3]);
  // Surf where cliffs and rocks meet the sea.
  for (let y = 150; y < H; y++) for (let x = 180; x < 345; x++) {
    if (isLand(x, y) || c.get(x, y)[3]) continue;
    const near = c.get(x - 1, y)[3] || c.get(x + 1, y)[3] || (inArch(x, y) && y > H - 6);
    if (near && y > 164 && hash(x, y, 16) < 0.5) c.set(x, y, hash(x, y, 17) < 0.5 ? '#ffffff' : '#bfe4fa');
  }

  // Dense forest of round-canopy trees, drawn back to front.
  // Three foliage palettes so the forest isn't one flat green; lower rows use the deeper greens.
  const LEAF = ['#9ad86a', '#6cbc4c', '#4a9a3e', '#2f7434', '#1f5428'];
  const DEEP = ['#7cc25a', '#4f9e42', '#3a8238', '#25602c', '#173f20'];
  const TEAL = ['#8ccf86', '#5aac6a', '#3e8a52', '#2a6a40', '#1a4a2c'];
  const trees = [];
  for (let x = 0; x < W; x += 5) {
    if (hash(x, 0, 20) < 0.25) continue;
    const xx = x + Math.floor(hash(x, 1, 20) * 4);
    if (!isLand(xx, landTop(xx) + 2) || isRock(xx, landTop(xx) + 6)) continue;
    trees.push([xx, landTop(xx) + 3 + Math.floor(hash(x, 2, 20) * 14), 4 + Math.floor(hash(x, 3, 20) * 4)]);
    for (let row = 1; row <= 2; row++) {
      const yy = landTop(xx) + 12 + row * 14 + Math.floor(hash(x, 4 + row, 20) * 8);
      if (yy < 182 && isLand(xx + 3, yy - 4) && !isRock(xx + 3, yy - 2) && hash(x, 7 + row, 20) < 0.8) trees.push([xx + 3, yy, 5 + Math.floor(hash(x, 9 + row, 20) * 4)]);
    }
  }
  trees.sort((a, b) => a[1] - b[1]);
  for (const [tx, by, r] of trees) {
    c.rect(tx, by - 2, 2, 3, '#5a3a24');
    const cy = by - 2 - r;
    const lobes = [[0, 0, r], [-r * 0.6, r * 0.25, r * 0.7], [r * 0.6, r * 0.3, r * 0.7], [0, -r * 0.5, r * 0.75]];
    const inside = (x, y) => lobes.some(([lx, ly, lr]) => (x - tx - lx) ** 2 + (y - cy - ly) ** 2 <= lr * lr);
    const pal = by > landTop(tx) + 22 ? DEEP : hash(tx, by, 21) < 0.3 ? TEAL : hash(tx, by, 22) < 0.3 ? DEEP : LEAF;
    shadeBlob(c, tx - 2 * r, cy - 2 * r, tx + 2 * r, cy + 2 * r, inside, pal);
  }

  // Stone watchtower on the left headland.
  const tx = 34, ty = landTop(36);
  c.rect(tx, ty - 22, 8, 22, '#b9bfc2'); c.rect(tx + 5, ty - 22, 3, 22, '#8c959b');
  for (let y = ty - 20; y < ty; y += 4) c.rect(tx, y, 8, 1, '#9aa3a8');
  c.rect(tx + 2, ty - 16, 2, 3, '#2a3240');
  for (let i = 0; i < 6; i++) c.rect(tx - 1 + Math.floor(i / 2), ty - 23 - i, 10 - 2 * Math.floor(i / 2), 1, i < 2 ? '#3a4a6a' : '#4a5d82');
  c.rect(tx - 1, ty - 23, 10, 1, '#2e3a55');
  return c;
}

// ---------- Ground 480 x 130, opaque, tiles in X. Row 0 = screen y 170. ----------
function makeGround() {
  const H = 130;
  const c = new Canvas(W, H, true);
  const SOIL = 100;
  const soilTop = x => SOIL + Math.round(1.5 * wave(x, 9, 0.9) + wave(x, 23, 2.2));
  const lowEdge = x => 88 + Math.round(1.2 * wave(x, 6, 2.1) + 0.8 * wave(x, 17, 0.4));

  for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) {
    const n = hash(x, y, 1);
    let col;
    if (y < soilTop(x)) {
      // Meadow: mid-tone green lane with soft lighter/darker patches.
      const v = noise(x, y, 24, 31) * 0.6 + noise(x, y, 8, 32) * 0.4 + (bayer(x, y) - 0.5) * 0.08;
      col = v > 0.64 ? '#68a846' : v < 0.36 ? '#558f3a' : '#5e9c40';
      if (y < 6) col = dither(x, y, y / 6) ? col : '#4a8436'; // shade under the far layer
      if (y >= lowEdge(x)) col = n < 0.15 ? '#7cc25a' : '#6cb44c'; // brighter front verge
      if (y > soilTop(x) - 3) col = '#4f9440';
    } else {
      col = n < 0.08 ? '#5a4232' : '#4a3628';
      const band = y + 2 * wave(x, 5, 1.1) + wave(x, 13, 0.4);
      if (band > 110.5 && band < 112 && hash(x >> 2, 1, 26) < 0.7) col = '#3e2d22';
      if (y > 118) col = n < 0.08 ? '#4a3628' : '#3a2a20';
      if (band > 124.5 && band < 126) col = '#30231a';
    }
    c.set(x, y, col);
  }

  // Grass tufts: small blades, darker in the lane so they read as texture, not props.
  function tuft(x, y, h, dark, tip) {
    for (let k = 0; k < h; k++) c.set(x, y - k, k === h - 1 ? tip : dark);
    for (let k = 0; k < h - 1; k++) { c.set(x - 1, y - k, dark); c.set(x + 1, y - k, dark); }
    c.set(x - 2, y - h + 2, dark); c.set(x + 2, y - h + 2, dark);
  }
  for (let i = 0; i < 110; i++) {
    const x = Math.floor(hash(i, 0, 50) * W), y = 12 + Math.floor(hash(i, 1, 50) * 72);
    tuft(x, y, 2 + (hash(i, 2, 50) * 2 | 0), '#4c8834', '#74b450');
  }
  // Taller fringe along the top edge and the front verge.
  for (let x = 0; x < W; x += 2) {
    if (hash(x, 0, 51) < 0.6) tuft(x, 5 + (hash(x, 1, 51) * 3 | 0), 3 + (hash(x, 2, 51) * 3 | 0), '#3f7a30', '#5e9c40');
    if (hash(x, 0, 52) < 0.6) tuft(x, lowEdge(x) + 2, 3 + (hash(x, 1, 52) * 3 | 0), '#5aa040', '#8fd068');
  }
  for (let x = 0; x < W; x++) if (hash(x, 0, 5) < 0.3)
    for (let k = 0; k < 1 + (hash(x, 1, 5) * 3 | 0); k++) c.set(x, soilTop(x) + k, '#4f9440');

  // Tiny flowers: sparse in the lane, plenty in the front verge.
  const petals = ['#ffffff', '#ffe066', '#ff8fb0', '#b8a0ff'];
  const flower = (x, y, p) => { c.set(x, y - 1, p); c.set(x - 1, y, p); c.set(x + 1, y, p); c.set(x, y + 1, p); c.set(x, y, '#f2b134'); };
  for (let i = 0; i < 14; i++) c.set(Math.floor(hash(i, 0, 53) * W), 14 + Math.floor(hash(i, 1, 53) * 70), petals[i % 2]);
  for (let i = 0; i < 46; i++) {
    const fx = Math.floor(hash(i, 0, 9) * W);
    flower(fx, lowEdge(fx) + 3 + Math.floor(hash(i, 1, 9) * Math.max(1, soilTop(fx) - lowEdge(fx) - 6)), petals[Math.floor(hash(i, 2, 9) * 4)]);
  }

  // A few small grey stones in the lane.
  for (let i = 0; i < 9; i++) {
    const sx = Math.floor(hash(i, 0, 54) * W), sy = 16 + Math.floor(hash(i, 1, 54) * 66);
    c.rect(sx + 1, sy, 2, 1, '#b4bcb8'); c.rect(sx, sy + 1, 4, 1, '#8c9692'); c.rect(sx, sy + 2, 4, 1, '#3f6a34');
  }

  // Stones embedded in the soil.
  for (let i = 0; i < 18; i++) {
    const sx = Math.floor(hash(i, 0, 11) * W), sy = 106 + Math.floor(hash(i, 1, 11) * 18);
    const sw = 4 + Math.floor(hash(i, 2, 11) * 6), sh = 3 + Math.floor(hash(i, 3, 11) * 3);
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
      if ((y === 0 || y === sh - 1) && (x === 0 || x === sw - 1)) continue;
      let col = '#7a6a5a';
      if (y === 0 || x === 0) col = '#958473';
      if (y === sh - 1 || x === sw - 1) col = '#5a4c40';
      c.set(sx + x, sy + y, col);
    }
  }
  return c;
}

module.exports = () => require('./lib').output('tidecoast', makeSky(), makeFar(), makeGround());
if (require.main === module) module.exports();
