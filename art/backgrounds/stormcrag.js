// Stormcrag Highlands: storm sky with rain curtains, layered snowy peaks, a waterfall, a keep on a crag,
// mist, pine ridge with a stone bridge, flagstone lane.
const L = require('./lib');
const { Canvas, hash, W, wave, dither, noise } = L;

function sky() {
  const c = new Canvas(W, 300);
  L.gradient(c, ['#323a54', '#3e4864', '#4c5876', '#5e6b8a', '#74829e', '#8e9cb6'], 0, 170);
  const tones = ['#a6b2c8', '#8894ae', '#707c98', '#5a6682', '#48526c'];
  L.cumulus(c, 250, 30, 80, 14, 21, tones);
  L.cumulus(c, 420, 74, 90, 16, 22, tones);
  L.cumulus(c, 90, 90, 100, 16, 23, tones);
  L.cumulus(c, 300, 104, 80, 12, 24, tones);
  L.cumulus(c, 470, 28, 30, 6, 25, tones);
  // Rain curtains slanting down from the heavier clouds.
  for (const [x0, x1, y0] of [[370, 470, 80], [40, 140, 96]]) {
    for (let y = y0; y < 170; y++) for (let x = x0; x < x1; x++) {
      const fade = Math.min(1, (x - x0) / 12, (x1 - x) / 12) * (1 - (y - y0) / 90);
      if ((x + Math.floor(y / 2)) % 3 === 0 && dither(x, y, fade)) c.set(x, y, '#4a5672');
    }
  }
  // Birds riding the wind.
  for (const [bx, by] of [[186, 62], [197, 57], [205, 66]]) for (const [dx, dy] of [[-2, -1], [-1, 0], [0, 0], [1, 0], [2, -1]]) c.set(bx + dx, by + dy, '#262c42');
  // A distant lightning bolt with a faint glow.
  let x = 372, y = 52;
  const pts = [];
  while (y < 98) { pts.push([x, y]); y++; if (hash(y, 0, 26) < 0.35) x += hash(y, 1, 26) < 0.6 ? 1 : -1; if (y === 74) pts.push(...[1, 2, 3, 4].map(k => [x + k, y + k])); }
  pts.forEach(([px, py]) => { c.set(px - 1, py, '#b8c6ea'); c.set(px + 1, py, '#b8c6ea'); });
  pts.forEach(([px, py]) => c.set(px, py, '#f4f8ff'));
  return c;
}

function far() {
  const H = 180, c = new Canvas(W, H, true);
  // Hazy back range filling the gaps between the main peaks.
  L.mountains(c, [[30, 70, 1.4], [150, 78, 1.2], [262, 72, 1.5], [390, 82, 1.3]], 162, {
    rim: '#9aa6be', lit: '#7a87a2', mid: '#6c7894', dark: '#626e8a', snow: '#b8c2d4', snowShade: '#a2acc2', snowDepth: 8, jag: 5,
  }, 70);
  // Snowy peaks.
  const peakTop = L.mountains(c, [[90, 92, 1.1], [205, 66, 1.3], [330, 104, 1.0], [440, 74, 1.2]], 162, {
    rim: '#d6dde8', lit: '#9aa4b8', mid: '#7a8498', dark: '#5e667c', snow: '#f2f5fa', snowShade: '#c6cedc', snowDepth: 18, jag: 8,
  }, 30);
  // Gullies down the lit faces, with snow caught in their tops.
  for (const [px, n] of [[90, 3], [205, 2], [330, 4], [440, 2]]) for (let k = 1; k <= n; k++) {
    let x = px - k * 7, y = peakTop(x) + 2;
    for (let i = 0; i < 26 + k * 4; i++) {
      c.set(x, y, i < 7 ? '#f2f5fa' : '#6e788e');
      if (i >= 7) c.set(x + 1, y, '#b0bacb');
      y++; if (hash(px + k, i, 33) < 0.45) x -= 1;
    }
  }
  // Waterfall pouring from a ledge into the gorge under the bridge.
  const wx = 304, wTop = peakTop(wx) + 12;
  c.rect(wx - 3, wTop - 1, 9, 2, '#4e566a');
  for (let y = wTop + 1; y < 160; y++) for (let dx = 0; dx < 4; dx++) {
    const streak = (y + dx * 3) % 5 < 2;
    c.set(wx + dx, y, dx === 0 ? '#ffffff' : streak ? '#c8d4e6' : '#eef3fa');
  }
  for (let y = 140; y < 160; y++) for (let x = wx - 8; x < wx + 12; x++) // spray
    if (dither(x, y, 0.5 - Math.abs(x - wx - 1.5) / 20) && hash(x, y, 34) < 0.7) c.set(x, y, '#e6ecf4');
  // Rain curtain sweeping across the right-hand peaks.
  for (let y = 66; y < 150; y++) for (let x = 380; x < 476; x++) {
    const fade = Math.min(1, (x - 380) / 14, (476 - x) / 14) * Math.min(1, (y - 66) / 10) * 0.75;
    if ((x + Math.floor(y / 2)) % 3 === 0 && dither(x, y, fade)) c.set(x, y, '#5a6680');
  }
  // Mist band hugging the lower slopes.
  for (let y = 118; y < 160; y++) for (let x = 0; x < W; x++) {
    const t = (1 - Math.abs(y - 142) / 22) * (0.4 + 0.5 * noise(x, y, 24, 31));
    if (c.get(x, y)[3] && dither(x, y, t)) c.set(x, y, t > 0.55 ? '#dfe5ee' : '#c4ccd8');
  }
  // Rocky crag with a small keep and lit windows.
  const crag = x => Math.round(106 + Math.max(0, Math.abs(x - 122) - 13) * 2.2 + 2 * noise(x, 0, 4, 35));
  for (let x = 90; x <= 154; x++) for (let y = crag(x); y < 150; y++) {
    let col = x < 118 ? '#8a94a8' : x < 128 ? '#6e788e' : '#565e72';
    if ((y + (x >> 2)) % 6 === 0 && hash(x, y, 36) < 0.6) col = '#4a5266';
    if (y === crag(x)) col = '#a8b2c4';
    c.set(x, y, col);
  }
  const kx = 115, ky = 106;
  for (let y = ky - 18; y < ky + 2; y++) for (let x = kx; x < kx + 15; x++) {
    let col = x < kx + 3 ? '#9aa2b4' : x > kx + 11 ? '#5a6276' : '#7a8296';
    if ((y - ky) % 4 === 0) col = '#5a6276';
    c.set(x, y, col);
  }
  for (let x = kx - 1; x < kx + 16; x++) if ((x - kx) % 4 < 2) c.set(x, ky - 19, '#9aa2b4'), c.set(x, ky - 20, '#9aa2b4');
  c.rect(kx + 9, ky - 30, 5, 12, '#7a8296'); c.rect(kx + 12, ky - 30, 2, 12, '#5a6276'); // turret
  for (let i = 0; i < 6; i++) c.rect(kx + 8 + (i >> 1), ky - 31 - i, 7 - 2 * (i >> 1), 1, '#3a4258');
  for (const [wx2, wy] of [[kx + 4, ky - 12], [kx + 9, ky - 12], [kx + 10, ky - 26]]) { c.rect(wx2, wy, 2, 3, '#ffd27a'); c.set(wx2, wy, '#fff0b8'); }
  // Dark pine ridge with a notch spanned by a stone bridge.
  const notch = x => Math.max(0, 10 - Math.abs(x - 306) * 0.8);
  const ridge = x => Math.round(140 + 6 * wave(x, 3, 1.1) + 3 * wave(x, 8, 0.4) + notch(x));
  L.fillBelow(c, ridge, (x, y, d) => d === 0 ? '#5e6a7e' : dither(x, y, d / 30) ? '#2e3646' : '#3e4858');
  const PINE = ['#4a6a5e', '#34504a', '#24383a'];
  const trees = [];
  for (let x = 0; x < W; x += 4) {
    if (hash(x, 0, 32) < 0.3 || Math.abs(x - 306) < 16) continue;
    trees.push([x + (hash(x, 1, 32) * 3 | 0), ridge(x) + 2 + (hash(x, 2, 32) * 10 | 0), 9 + (hash(x, 3, 32) * 8 | 0)]);
    if (hash(x, 4, 32) < 0.6) trees.push([x + 2, ridge(x) + 14 + (hash(x, 5, 32) * 10 | 0), 10 + (hash(x, 6, 32) * 8 | 0)]);
  }
  trees.sort((a, b) => a[1] - b[1]).forEach(([x, by, h]) => L.pine(c, x, by, h, PINE));
  // Stone arch bridge across the notch: solid masonry with one round arch.
  const deck = ridge(290) - 2, archCy = deck + 15;
  for (let x = 290; x <= 322; x++) {
    for (let y = deck; y < ridge(x) + 8; y++) {
      if (((x - 306) / 9) ** 2 + ((y - archCy) / 11) ** 2 < 1) continue;
      let col = y === deck ? '#b0b8c6' : y === deck + 1 ? '#8a92a4' : (y - deck) % 4 === 0 ? '#5e6678' : (x + ((y - deck) >> 2) * 3) % 7 === 0 ? '#5e6678' : '#7a8296';
      if (((x - 306) / 10) ** 2 + ((y - archCy) / 12) ** 2 < 1) col = '#4e5668'; // arch shadow ring
      c.set(x, y, col);
    }
  }
  for (let x = 290; x <= 322; x += 4) c.set(x, deck - 1, '#8a92a4');
  return c;
}

function ground() {
  const H = 130, c = new Canvas(W, H, true);
  const lowEdge = x => 88 + Math.round(1.2 * wave(x, 6, 2.1) + 0.8 * wave(x, 17, 0.4));
  const soilTop = x => 100 + Math.round(1.5 * wave(x, 9, 0.9) + wave(x, 23, 2.2));
  const topEdge = x => 9 + Math.round(1.2 * wave(x, 8, 0.5) + 0.8 * wave(x, 19, 1.3));
  // Grass under everything, then flagstones in the lane.
  L.lanePatches(c, 0, H, ['#5c7a52', '#52704a', '#486442'], 61);
  L.voronoiPaving(c, 0, 90, 64, {
    lit: '#929aa8', base: ['#858b9a', '#8a90a0', '#80869a', '#878d98'], dark: '#7b8190', mortar: '#6c7282',
  }, 62, (x, y) => y >= topEdge(x) && y < lowEdge(x) - 1, 2.2);
  // Moss in the mortar.
  for (let x = 0; x < W; x++) for (let y = 0; y < 90; y++)
    if (c.get(x, y)[0] === 0x6c && noise(x, y, 12, 63) > 0.55) c.set(x, y, '#5e7a54');
  for (let x = 0; x < W; x++) for (let y = 0; y < 5; y++) if (!dither(x, y, y / 5)) c.set(x, y, '#3a5038');
  for (let x = 0; x < W; x += 2) {
    if (hash(x, 0, 64) < 0.6) L.tuft(c, x, topEdge(x) + (hash(x, 1, 64) * 2 | 0), 2 + (hash(x, 2, 64) * 3 | 0), '#3e5a3a', '#6a8a5a');
    if (hash(x, 0, 65) < 0.6) L.tuft(c, x, lowEdge(x) + 2, 3 + (hash(x, 1, 65) * 3 | 0), '#4a6844', '#7a9a68');
  }
  for (let i = 0; i < 18; i++) {
    const fx = Math.floor(hash(i, 0, 66) * W), fy = lowEdge(fx) + 4 + (hash(i, 1, 66) * 6 | 0);
    const p = ['#e8ecf4', '#c8b8f0'][i % 2];
    c.set(fx, fy - 1, p); c.set(fx - 1, fy, p); c.set(fx + 1, fy, p); c.set(fx, fy, '#f2d060');
  }
  L.soilStrip(c, soilTop, ['#4a4c5e', '#3c3e50', '#2e3042', '#26283a']);
  for (let x = 0; x < W; x++) if (hash(x, 0, 5) < 0.3) for (let k = 0; k < 1 + (hash(x, 1, 5) * 3 | 0); k++) c.set(x, soilTop(x) + k, '#486442');
  L.stones(c, 20, 67, 104, 124, 4, 10, ['#9aa0b0', '#767c8c', '#4e5464']);
  return c;
}

module.exports = () => L.output('stormcrag', sky(), far(), ground());
if (require.main === module) module.exports();
