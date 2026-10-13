// Hollow Moon Ruins: starry violet night, big hollow moon, ruined castle walls and towers, dead trees,
// teal-grey cobblestone lane (kept away from violet so dark heroes stand out), glowing mushrooms.
const L = require('./lib');
const { Canvas, hash, W, wave, dither, noise } = L;

function sky() {
  const c = new Canvas(W, 300);
  L.gradient(c, ['#12102a', '#1a1838', '#24224a', '#302c5e', '#3c3672', '#4c4286'], 0, 170);
  // Stars, with a few twinkles; HUD corner left plain.
  for (let y = 0; y < 150; y++) for (let x = 0; x < W; x++) {
    if (x < 160 && y < 50) continue;
    const h = hash(x, y, 91);
    if (h < 0.004) c.set(x, y, h < 0.0015 ? '#ffffff' : '#b8b0e8');
  }
  for (const [x, y] of [[220, 30], [290, 70], [460, 110], [180, 96], [60, 70]]) {
    c.set(x, y, '#ffffff');
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) c.set(x + dx, y + dy, '#c8c0f0');
  }
  // Moon: halo, disc lit from the top left, and the big hollow crater.
  const [mx, my, r] = [384, 50, 20];
  for (let y = my - 34; y <= my + 34; y++) for (let x = mx - 34; x <= mx + 34; x++) {
    const d = Math.hypot(x - mx, y - my);
    if (d <= r) {
      let col = (x - mx) + (y - my) > r * 0.7 ? '#c4b8e6' : '#e8e0f8';
      if (d > r - 1) col = '#b0a4d8';
      const cd = Math.hypot(x - mx - 5, y - my - 4);
      if (cd <= 8) col = cd > 7 ? '#9a8ccc' : (x - mx - 5) + (y - my - 4) < -2 ? '#a698d4' : '#c8bce8';
      for (const [cx, cy, cr] of [[-9, -7, 3], [-11, 6, 2], [7, -11, 2]]) if (Math.hypot(x - mx - cx, y - my - cy) <= cr) col = '#c0b4e2';
      c.set(x, y, col);
    } else if (d <= r + 6 && dither(x, y, (r + 6 - d) / 7)) c.set(x, y, '#5a4e9a');
    else if (d <= r + 14 && dither(x, y, (r + 14 - d) / 22)) c.set(x, y, '#463e82');
  }
  // Bats flitting near the moon.
  for (const [bx, by, s] of [[338, 34, 1], [350, 58, 0], [326, 50, 1], [250, 70, 0]]) {
    c.set(bx, by, '#0c0a1c'); c.set(bx - 1, by - s, '#0c0a1c'); c.set(bx + 1, by - s, '#0c0a1c');
    c.set(bx - 2, by - 1 + s, '#0c0a1c'); c.set(bx + 2, by - 1 + s, '#0c0a1c');
  }
  const tones = ['#9a86d0', '#7a68b4', '#64549e', '#4e4288', '#3e3472'];
  L.cumulus(c, 90, 104, 110, 16, 92, tones);
  L.cumulus(c, 300, 112, 90, 14, 93, tones);
  L.cumulus(c, 450, 96, 70, 12, 94, tones);
  L.cumulus(c, 250, 40, 40, 6, 95, tones);
  return c;
}

function far() {
  const H = 180, c = new Canvas(W, H, true);
  // Distant hills.
  const hills = x => Math.round(132 + 8 * wave(x, 2, 0.7) + 4 * wave(x, 5, 2.2));
  L.fillBelow(c, hills, (x, y, d) => d === 0 ? '#4a4680' : dither(x, y, 0.3) ? '#34325e' : '#3a3868');

  const ground = x => Math.round(158 + 3 * wave(x, 4, 0.3) + 1.5 * wave(x, 13, 1.7));
  const S = { rim: '#8a88b4', lit: '#6c6a98', mid: '#56547e', dark: '#424066', edge: '#302e50' };
  // Masonry block: shaded, brick courses, ragged broken top, optional crenellations.
  function block(x0, w, h, { crenel = false, broken = 0, seed = 0 } = {}) {
    const base = Math.max(...Array.from({ length: w }, (_, i) => ground(x0 + i))) + 2;
    const topAt = i => base - h + (broken ? Math.round(broken * noise(x0 + i, 0, 4, seed) + broken * 0.5 * hash(i, 0, seed)) : 0);
    for (let i = 0; i < w; i++) {
      let t = topAt(i);
      if (crenel && !broken && i % 6 >= 3) t += 3;
      for (let y = t; y < base; y++) {
        let col = i < 2 ? S.lit : i >= w - 2 ? S.dark : S.mid;
        if ((y - base) % 5 === 0 || ((Math.floor((y - base) / 5) % 2 ? i + 3 : i) % 8 === 0)) col = i >= w - 2 ? S.edge : S.dark;
        if (y === t) col = S.rim;
        c.set(x0 + i, y, col);
      }
    }
    return base;
  }
  // Cut an arched opening (shows the sky behind).
  function archHole(cx, bottom, hw, h) {
    for (let y = bottom - h; y < bottom; y++) for (let x = cx - hw; x <= cx + hw; x++) {
      const yy = y - (bottom - h + hw);
      if (yy < 0 && (x - cx) ** 2 + yy ** 2 > hw * hw) continue;
      c.set(x, y, '#000', 0);
    }
    for (let y = bottom - h; y < bottom; y++) { // dark reveal on the right edge
      const yy = y - (bottom - h + hw), half = yy < 0 ? Math.floor(Math.sqrt(Math.max(0, hw * hw - yy * yy))) : hw;
      c.set(cx + half + 1, y, S.edge);
    }
  }
  // Tower A + wall with windows.
  let b = block(30, 18, 74, { broken: 10, seed: 1 });
  archHole(39, b - 44, 2, 8);
  b = block(48, 70, 40, { crenel: true });
  archHole(66, b - 12, 3, 12); archHole(96, b - 12, 3, 12);
  // Gate with a big arch.
  b = block(170, 44, 56, { broken: 6, seed: 2 });
  archHole(192, b, 10, 36);
  // Tower B + low broken wall.
  b = block(296, 16, 58, { broken: 8, seed: 3 }); block.lastB = b;
  archHole(304, b - 30, 2, 7);
  block(312, 54, 26, { broken: 10, seed: 4 });
  // Tall ruined tower C.
  b = block(418, 18, 86, { broken: 12, seed: 5 });
  archHole(427, b - 50, 2, 8); archHole(427, b - 26, 2, 8);
  // Candlelight in a few windows: the only warm colour in the scene.
  for (const [wx, wy] of [[427, b - 26], [304, 0]]) {
    const yy = wy || block.lastB - 30;
    for (let y = yy - 6; y < yy; y++) for (let x = wx - 1; x <= wx + 1; x++) c.set(x, y, y < yy - 4 ? '#ffe9a8' : '#ffc24a');
  }

  // Dead trees.
  for (const [x, h] of [[140, 34], [256, 40], [384, 30], [470, 26]]) L.deadTree(c, x, ground(x) + 1, h, '#221e3a', x);
  // Rubble mound across the base.
  L.fillBelow(c, ground, (x, y, d) => d === 0 ? '#4a4870' : dither(x, y, d / 16) ? '#1c1a32' : '#2a2848');
  L.stones(c, 30, 96, 156, 170, 3, 7, ['#6c6a98', '#4a4870', '#2a2848']);
  return c;
}

function ground() {
  const H = 130, c = new Canvas(W, H, true);
  const lowEdge = x => 88 + Math.round(1.2 * wave(x, 6, 2.1) + 0.8 * wave(x, 17, 0.4));
  const soilTop = x => 100 + Math.round(1.5 * wave(x, 9, 0.9) + wave(x, 23, 2.2));
  const topEdge = x => 8 + Math.round(1.2 * wave(x, 8, 0.5) + 0.8 * wave(x, 19, 1.3));
  L.lanePatches(c, 0, H, ['#466a66', '#3e5e5c', '#365452'], 101); // teal moss under the stones
  L.voronoiPaving(c, 0, 90, 230, {
    lit: '#8c969c', base: ['#737e84', '#7a8589', '#6e797f', '#76807e'], dark: '#667076', mortar: '#525c62',
  }, 102, (x, y) => y >= topEdge(x) && y < lowEdge(x) - 1, 1.5);
  for (let x = 0; x < W; x++) for (let y = 0; y < 90; y++)
    if (c.get(x, y)[0] === 0x52 && noise(x, y, 12, 103) > 0.55) c.set(x, y, '#4a6e68');
  for (let x = 0; x < W; x++) for (let y = 0; y < 5; y++) if (!dither(x, y, y / 5)) c.set(x, y, '#22283a');
  for (let x = 0; x < W; x += 2) {
    if (hash(x, 0, 104) < 0.5) L.tuft(c, x, topEdge(x), 2 + (hash(x, 1, 104) * 2 | 0), '#2e4846', '#4a6e68');
    if (hash(x, 0, 105) < 0.55) L.tuft(c, x, lowEdge(x) + 2, 3 + (hash(x, 1, 105) * 3 | 0), '#365452', '#5a8a80');
  }
  L.soilStrip(c, soilTop, ['#2e2c44', '#24223a', '#18162a', '#1c1a30']);
  L.stones(c, 14, 106, 106, 124, 4, 9, ['#5a5a7a', '#424260', '#2a2a40']);
  // Broken pillar stumps in the bottom strip.
  for (const px of [70, 250, 410]) {
    const by = soilTop(px) + 10, h = 8 + (px % 5);
    for (let y = by - h; y < by; y++) for (let dx = 0; dx < 7; dx++) c.set(px + dx, y, dx === 0 ? '#9a98b8' : dx === 6 ? '#4a4870' : dx % 2 ? '#7a789e' : '#6c6a90');
    for (let dx = -1; dx < 8; dx++) { c.set(px + dx, by - h - 1, hash(dx, px, 107) < 0.6 ? '#9a98b8' : '#000', hash(dx, px, 107) < 0.6 ? 255 : 0); c.set(px + dx, by, '#3a3858'); }
  }
  // Small glowing mushrooms (teal, not violet).
  for (let i = 0; i < 16; i++) {
    const x = Math.floor(hash(i, 0, 108) * W), y = lowEdge(x) + 5 + (hash(i, 1, 108) * 7 | 0);
    c.set(x, y, '#c8d8e0'); c.set(x, y - 1, '#c8d8e0');
    c.rect(x - 1, y - 2, 3, 1, '#7af0d8'); c.set(x, y - 3, '#c8fff0');
    if (hash(i, 2, 108) < 0.5) { c.set(x - 2, y - 2, '#3a8a80'); c.set(x + 2, y - 2, '#3a8a80'); }
  }
  return c;
}

module.exports = () => L.output('hollowmoon', sky(), far(), ground());
if (require.main === module) module.exports();
