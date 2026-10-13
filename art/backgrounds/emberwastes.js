// Ember Wastes: smoke-choked sky lit from below, a jagged erupting volcano with a smoke plume and winding
// lava rivers, rust mesas with a lava channel, a ruined forge chimney, charred trees.
// The lane is scorched rock with no glow, so fire heroes stay readable; lava glow lives in the bottom strip.
const L = require('./lib');
const { Canvas, hash, W, wave, dither, noise } = L;

const LAVA = ['#fff0a0', '#ffc040', '#ff7a2a', '#c83a1a'];

// Glowing crack: random walk with a hot core and darker rim.
function lavaCrack(c, x, y, len, seed) {
  const pts = [];
  for (let k = 0; k < len; k++) {
    pts.push([x, y]);
    x += 1; if (hash(seed, k, 71) < 0.45) y += hash(seed, k, 72) < 0.5 ? -1 : 1;
  }
  pts.forEach(([px, py]) => { c.set(px, py - 1, LAVA[3]); c.set(px, py + 1, LAVA[3]); });
  pts.forEach(([px, py], k) => c.set(px, py, k % 5 === 2 ? LAVA[1] : LAVA[2]));
}

// Clouds lit from below by the lava glow: bright undersides, dark tops.
const underlit = (inside, x, y) => {
  if (!inside(x, y + 1)) return '#ff9a50';
  if (!inside(x, y + 3)) return '#d8643a';
  if (!inside(x, y + 6) && dither(x, y, 0.5)) return '#a8442c';
  if (!inside(x, y - 2)) return '#6a2a24';
  return (x + y) % 2 && !inside(x + 4, y + 8) ? '#7e3226' : '#521e1c';
};

function sky() {
  const c = new Canvas(W, 300);
  L.gradient(c, ['#240a0e', '#3a0e12', '#561416', '#7a1e18', '#a42c1c', '#cc4420', '#ec6a2c'], 0, 170);
  L.cumulus(c, 260, 36, 100, 14, 41, underlit);
  L.cumulus(c, 430, 82, 90, 14, 42, underlit);
  L.cumulus(c, 70, 96, 120, 16, 43, underlit);
  L.cumulus(c, 340, 116, 80, 10, 44, underlit);
  L.cumulus(c, 470, 30, 40, 7, 45, underlit);
  for (let i = 0; i < 140; i++) { // drifting ash and embers, none in the HUD corner
    const x = Math.floor(hash(i, 0, 45) * W), y = Math.floor(hash(i, 1, 45) * 160);
    if (x < 160 && y < 50) continue;
    c.set(x, y, i % 4 === 0 ? '#ffb050' : '#b88a80');
  }
  return c;
}

function far() {
  const H = 180, c = new Canvas(W, H, true);
  const ROCK = { rim: '#a8483a', lit: '#7e3028', mid: '#5e2220', dark: '#461818' };

  // Hazy back range.
  L.mountains(c, [[40, 58, 1.3], [290, 70, 1.2], [430, 62, 1.4]], 160, {
    rim: '#b45a44', lit: '#94443a', mid: '#843c34', dark: '#7a3630', jag: 6,
  }, 60);

  // Volcano: jagged slopes, notched crater, smaller jagged neighbours.
  const vx = 150, vh = 106, base = 166;
  const top = L.mountains(c, [[vx, vh, 1.1], [62, 56, 1.4], [404, 78, 1.2], [470, 50, 1.5]], base, { ...ROCK, jag: 7 }, 50);
  const crater = base - vh + 7;
  for (let x = vx - 10; x <= vx + 10; x++) {
    const dip = crater - Math.round(Math.abs(x - vx) * 0.6);
    for (let y = top(x); y < dip; y++) c.set(x, y, '#000', 0);
  }
  for (let x = vx - 6; x <= vx + 6; x++) { c.set(x, crater - 1, LAVA[0]); c.set(x, crater, LAVA[1]); c.set(x, crater + 1, LAVA[2]); }

  // Smoke plume billowing up from the crater: one merged mass, lit orange near the vent.
  const puffs = [];
  for (let k = 0; k < 30; k++) {
    const t = k / 29;
    puffs.push([vx + Math.sin(t * 3.4) * 6 * t + t * 26 + (hash(k, 1, 57) - 0.5) * 6, crater - 3 - t * 80, 3 + t * 24 + hash(k, 0, 57) * 5]);
  }
  const inPlume = (x, y) => puffs.some(([px, py, r]) => (x - px) ** 2 + (y - py) ** 2 <= r * r);
  for (let y = 0; y < crater; y++) for (let x = vx - 40; x < vx + 90; x++) {
    if (!inPlume(x, y)) continue;
    const heat = Math.max(0, 1 - (crater - y) / 26);
    let col = '#3a1818';
    if (!inPlume(x - 2, y - 2)) col = '#5e2a24';
    else if (!inPlume(x + 2, y + 3)) col = '#2a1212';
    if (dither(x, y, heat)) col = heat > 0.6 ? '#d0603a' : '#9a3e2a';
    c.set(x, y, col);
  }
  // Eruption spatter.
  for (let i = 0; i < 50; i++) {
    const a = -Math.PI / 2 + (hash(i, 0, 51) - 0.5) * 1.8, r = 3 + hash(i, 1, 51) * 26;
    c.set(vx + Math.cos(a) * r, crater - 2 + Math.sin(a) * r, LAVA[hash(i, 2, 51) < 0.3 ? 0 : hash(i, 3, 51) < 0.6 ? 1 : 2]);
  }

  // Winding lava rivers that widen as they run downhill, with glow on the rock beside them.
  function river(x0, ph, amp, seed) {
    for (let y = crater + 1; y < base; y++) {
      const t = (y - crater) / (base - crater);
      const x = Math.round(x0 + Math.sin(y / 8 + ph) * amp * t + Math.sign(x0 - vx) * t * t * 34 + 2 * noise(0, y, 4, seed));
      const w = 1 + Math.round(t * 2.5);
      for (let dx = -w - 2; dx <= w + 2; dx++) {
        const a = Math.abs(dx);
        if (a > w) { if (c.get(x + dx, y)[3] && dither(x + dx, y, 0.6 - (a - w) * 0.2)) c.set(x + dx, y, '#9a3a26'); }
        else c.set(x + dx, y, a === w ? LAVA[3] : a === 0 && hash(y, seed, 58) < 0.6 ? LAVA[0] : a < w - 1 ? LAVA[1] : LAVA[2]);
      }
    }
  }
  river(vx - 3, 0.0, 9, 1);
  river(vx + 3, 2.0, 8, 2);

  // Rust mesas: terraced into flat ledges with stepped cliff faces, plus a few rock spires.
  const rawMesa = x => 142 + 9 * wave(x, 3, 0.2) + 5 * wave(x, 7, 1.9) + 4 * (noise(x, 0, 8, 52) - 0.5);
  const mesa = x => Math.round(Math.round(rawMesa(x) / 5) * 5 + (noise(x, 1, 2, 52) - 0.5));
  L.fillBelow(c, mesa, (x, y, d) => {
    const lit = mesa(x - 3) > mesa(x + 3);
    const ledge = mesa(x - 1) === mesa(x) && mesa(x + 1) === mesa(x);
    let col = d === 0 ? (ledge ? '#d07050' : '#b45a44') : d === 1 && ledge ? '#a8523e' : lit && d < 10 ? '#a8523e' : '#8a4232';
    if ((y + Math.round(2 * noise(x, 0, 16, 53))) % 6 === 0 && hash(x >> 1, y, 54) < 0.6) col = '#6e3228';
    if (dither(x, y, (d - 10) / 25)) col = '#5e2a24';
    return col;
  });
  // Rock spires standing out of the mesas.
  for (const [sx, h, w] of [[226, 34, 4], [238, 22, 3], [452, 28, 4], [70, 24, 3]]) {
    const by = mesa(sx) + 2;
    for (let y = by - h; y < by; y++) {
      const t = (by - y) / h, half = Math.max(1, Math.round(w * (1 - t * 0.55) + (hash(y, sx, 61) - 0.5)));
      for (let dx = -half; dx <= half; dx++) {
        let col = dx < 0 ? '#a8523e' : dx === half ? '#5e2a24' : '#8a4232';
        if (y % 5 === 0 && dx > -half) col = '#6e3228';
        if (y === by - h) col = '#c4644c';
        c.set(sx + dx, y, col);
      }
    }
  }
  // Lava channel winding along the foot of the mesas (partly hidden by the front ridge).
  for (let x = 0; x < W; x++) {
    const y = Math.round(160 + 2.5 * wave(x, 5, 0.9) + 1.5 * wave(x, 12, 2.2));
    c.set(x, y - 2, '#9a3a26'); c.set(x, y - 1, LAVA[3]); c.set(x, y, LAVA[2]); c.set(x, y + 1, hash(x, 0, 59) < 0.3 ? LAVA[0] : LAVA[1]); c.set(x, y + 2, LAVA[2]);
  }

  // Ruined forge chimney with a glowing furnace mouth.
  const fx = 330, fb = mesa(334) + 4;
  for (let y = fb - 46; y < fb; y++) {
    const half = y < fb - 20 ? 4 : 6;
    for (let dx = -half; dx <= half; dx++) {
      const brick = ((y >> 1) % 2 === 0 ? dx : dx + 1) % 3 === 0 || (y % 2 === 0);
      c.set(fx + dx, y, dx === -half ? '#5a2a26' : brick ? '#3a1a1a' : '#4a2220');
    }
  }
  for (let dx = -4; dx <= 4; dx++) if (hash(dx, 0, 55) < 0.6) c.set(fx + dx, fb - 47, '#3a1a1a');
  c.rect(fx - 3, fb - 8, 6, 6, LAVA[2]); c.rect(fx - 2, fb - 7, 4, 4, LAVA[1]);
  for (let i = 0; i < 14; i++) c.set(fx - 3 + hash(i, 0, 56) * 8 + i * 0.4, fb - 50 - i * 1.5, i % 3 ? '#6a4a48' : '#8a6a68');

  // Dark rocky foreground ridge with charred dead trees and glowing cracks.
  const front = x => Math.round(162 + 4 * wave(x, 4, 0.8) + 2 * wave(x, 11, 0.1) + 2 * (noise(x, 0, 4, 60) - 0.5));
  L.fillBelow(c, front, (x, y, d) => d === 0 ? '#6a3028' : dither(x, y, d / 12) ? '#241010' : '#3a1818');
  for (const [x, h] of [[30, 28], [96, 20], [250, 26], [300, 16], [420, 24]]) L.deadTree(c, x, front(x) + 2, h, '#1e0c0c', x);
  for (const [x, s] of [[60, 4], [200, 5], [380, 6]]) lavaCrack(c, x, front(x) + 7, 18, s);
  return c;
}

function ground() {
  const H = 130, c = new Canvas(W, H, true);
  const lowEdge = x => 88 + Math.round(1.2 * wave(x, 6, 2.1) + 0.8 * wave(x, 17, 0.4));
  const soilTop = x => 98 + Math.round(1.5 * wave(x, 9, 0.9) + wave(x, 23, 2.2));
  L.lanePatches(c, 0, H, ['#8e5646', '#83503f', '#784636'], 81);
  for (let x = 0; x < W; x++) for (let y = 0; y < 6; y++) if (!dither(x, y, y / 6)) c.set(x, y, '#3a1a18');
  // Cold dark cracks and black stones in the lane: no glow here.
  for (let i = 0; i < 30; i++) {
    let x = Math.floor(hash(i, 0, 82) * W), y = 12 + Math.floor(hash(i, 1, 82) * 70);
    for (let k = 0; k < 6 + (hash(i, 2, 82) * 10 | 0); k++) { c.set(x, y, '#62362a'); if (hash(i, k, 83) < 0.5) x++; else y += hash(i, k, 84) < 0.5 ? -1 : 1; }
  }
  for (let i = 0; i < 60; i++) { const x = Math.floor(hash(i, 0, 85) * W), y = 10 + Math.floor(hash(i, 1, 85) * 76); c.set(x, y, '#9a6452'); c.set(x + 1, y + 1, '#6a3c30'); }
  L.stones(c, 10, 86, 14, 82, 3, 5, ['#5a4440', '#3e2c28', '#241816']);
  for (let x = 0; x < W; x++) for (let y = lowEdge(x); y < soilTop(x); y++) c.set(x, y, hash(x, y, 87) < 0.15 ? '#5e3228' : '#4e2a22');
  for (let x = 0; x < W; x += 3) if (hash(x, 0, 88) < 0.35) L.tuft(c, x, lowEdge(x) + 3 + (hash(x, 1, 88) * 5 | 0), 2 + (hash(x, 2, 88) * 3 | 0), '#2e1612', '#5a2e24');
  L.soilStrip(c, soilTop, ['#3a1e1a', '#2e1814', '#1e0e0c', '#241210']);
  L.stones(c, 18, 89, 104, 124, 4, 10, ['#4a3430', '#34221e', '#1a100e']);
  for (let i = 0; i < 9; i++) lavaCrack(c, Math.floor(hash(i, 0, 90) * W), 104 + Math.floor(hash(i, 1, 90) * 20), 14 + (hash(i, 2, 90) * 16 | 0), 100 + i);
  return c;
}

module.exports = () => L.output('emberwastes', sky(), far(), ground());
if (require.main === module) module.exports();
