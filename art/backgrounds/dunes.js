// Sunscorch Dunes: orange sky and sun, mesas, rock buttes, sharp-crested dunes with blowing sand,
// a ruined colonnade, hoodoos, a giant half-buried skeleton, cracked sand lane.
const L = require('./lib');
const { Canvas, hash, W, wave, dither, noise, wrapDx } = L;

function sky() {
  const c = new Canvas(W, 300);
  L.gradient(c, ['#e2701e', '#ea842a', '#f09a38', '#f5ae48', '#f8c25e', '#fbd47c'], 0, 170);
  // Sun with a soft dithered halo.
  const [sx, sy] = [330, 46];
  for (let y = sy - 30; y <= sy + 30; y++) for (let x = sx - 30; x <= sx + 30; x++) {
    const d = Math.hypot(x - sx, y - sy);
    if (d <= 13) c.set(x, y, d > 11.5 ? '#fff0b8' : '#fffbe6');
    else if (d <= 20 && dither(x, y, (20 - d) / 7)) c.set(x, y, '#fde09a');
    else if (d <= 28 && dither(x, y, (28 - d) / 16)) c.set(x, y, '#fbcf78');
  }
  const tones = ['#ffe6b0', '#ffcd84', '#f7ae5e', '#e88e44', '#cf7034'];
  L.cumulus(c, 240, 84, 70, 12, 11, tones);
  L.cumulus(c, 430, 74, 64, 13, 12, tones);
  L.cumulus(c, 70, 104, 80, 14, 13, tones);
  L.cumulus(c, 200, 36, 36, 7, 14, tones);
  return c;
}

function far() {
  const H = 180, c = new Canvas(W, H, true);
  // Mesas: plateau with steep sides.
  const mesaTop = (list, base, slope = 3) => x => {
    let top = base;
    for (const [cx, hw, h] of list) {
      const dx = wrapDx(x, cx);
      top = Math.min(top, dx <= hw ? base - h : base - h + (dx - hw) * slope + Math.floor(hash(x, 0, 3) * slope));
    }
    return Math.round(top + 1.5 * noise(x, 0, 4, list.length));
  };
  const shadeRock = (x, y, d, cx, t) => {
    let col = d === 0 ? t.rim : x < cx - 4 ? t.lit : t.mid;
    if (x >= cx && dither(x, y, d / 40)) col = t.dark;
    if ((y + Math.round(2 * noise(x, 0, 16, 5))) % 6 === 0 && hash(x >> 1, y, 6) < 0.6) col = t.dark; // strata
    return col;
  };
  // Hazy distant mesas.
  const far1 = [[60, 26, 34], [180, 18, 26], [300, 34, 40], [420, 14, 22]];
  L.fillBelow(c, mesaTop(far1, 160), (x, y, d) => d === 0 ? '#f6d29c' : dither(x, y, 0.3 + d / 120) ? '#e6b47c' : '#eec48c', 160);
  // Big rock buttes.
  const rock = { rim: '#e8a468', lit: '#cd8048', mid: '#ad6236', dark: '#8a4a2a' };
  const butte = [[40, 16, 92], [80, 11, 64], [372, 10, 58]];
  const bt = mesaTop(butte, 172, 7);
  L.fillBelow(c, bt, (x, y, d) => {
    const cx = butte.reduce((a, b) => wrapDx(x, b[0]) < wrapDx(x, a[0]) ? b : a)[0];
    return shadeRock(x, y, d, x - cx > W / 2 ? cx + W : cx, rock);
  }, 172);

  // Crest-shaped dunes: gentle lit windward slope on the left, steep shadowed lee on the right.
  const sdx = (x, cx) => ((x - cx + W * 1.5) % W) - W / 2;
  const duneField = (crests, base) => {
    const tops = [], lee = [];
    for (let x = 0; x < W; x++) {
      let best = 1e9, isLee = false;
      for (const [cx, h] of crests) {
        const d = sdx(x, cx), t = base - h + (d < 0 ? -d * 0.3 : d * 0.8) + 1.2 * noise(x, 0, 8, cx);
        if (t < best) { best = t; isLee = d >= 0; }
      }
      tops[x] = Math.round(best); lee[x] = isLee;
    }
    return { top: x => tops[((Math.round(x) % W) + W) % W], lee: x => lee[((x % W) + W) % W] };
  };
  const midF = duneField([[20, 16], [110, 11], [205, 18], [300, 13], [385, 17], [455, 10]], 152);
  const mid = midF.top;
  L.fillBelow(c, mid, (x, y, d) => {
    if (midF.lee(x)) return d === 0 ? '#e8b878' : d < 3 ? '#cf9454' : dither(x, y, 0.35) ? '#c48a4c' : '#d39858';
    if (d === 0) return '#fde2a8';
    if ((y + Math.round(x * 0.3)) % 4 === 0 && d > 1 && hash(x, y, 8) < 0.6) return '#dfac6c'; // wind ripples
    return d < 4 ? '#f2c486' : '#ebba7a';
  });
  // Sand blowing off the crests.
  for (const [cx, h] of [[20, 16], [205, 18], [385, 17], [300, 13]]) {
    const ty = mid(cx);
    for (let k = 0; k < 22; k++) for (let j = -1; j <= 1; j++) {
      const x = cx + k, y = ty - 1 - Math.round(k * 0.12) + j;
      if (dither(x, y, (1 - k / 22) * (j === 0 ? 0.8 : 0.35))) c.set(x, y, '#fde6b4');
    }
  }

  // Ruined colonnade on the mid dunes.
  const stone = ['#f6d49a', '#e2b878', '#c4955a', '#9e7242'];
  const cols = [[228, 28], [238, 30], [248, 22], [258, 30], [268, 14], [278, 26]];
  for (const [x, h] of cols) {
    const by = mid(x) + 3;
    for (let y = by - h; y < by; y++) for (let dx = 0; dx < 5; dx++) c.set(x + dx, y, dx === 0 ? stone[0] : dx < 3 ? stone[1] : dx === 3 ? stone[2] : stone[3]);
    c.rect(x - 1, by - h - 2, 7, 2, stone[1]); c.rect(x - 1, by - h - 1, 7, 1, stone[2]);
  }
  const lintelY = Math.min(...cols.filter(([, h]) => h >= 28).map(([x, h]) => mid(x) + 3 - h)) - 4;
  c.rect(226, lintelY, 38, 2, stone[0]); c.rect(226, lintelY + 2, 38, 2, stone[2]);
  c.rect(247, lintelY - 1, 6, 1, stone[0]);

  // Giant beast skeleton half-buried in the sand: skull, arched spine, curved ribs, outlined so it reads.
  const BONE = ['#fbf3de', '#e8dcc0', '#c4b494', '#8a7658'];
  const bones = new Map(); // "x,y" -> colour, drawn after an outline pass
  const bone = (x, y, col) => { if (y < mid(x) + 1) bones.set(`${Math.round(x)},${Math.round(y)}`, col); };
  const gy = x => mid(x) + 2;
  const SX = 318, SW = 62;
  const spine = u => gy(SX + u * SW) - 8 - Math.round(18 * Math.sin(Math.PI * Math.min(1, u * 1.15)));
  for (let x = SX; x <= SX + SW; x++) {
    const y = spine((x - SX) / SW);
    bone(x, y, BONE[0]); bone(x, y + 1, BONE[1]);
    if (x % 4 === 0) { bone(x, y - 1, BONE[0]); bone(x, y - 2, BONE[1]); } // vertebra spikes
  }
  for (let k = 0; k < 8; k++) {
    const xb = SX + 6 + k * 7, top = spine((xb - SX) / SW) + 2, bot = gy(xb + 6) + 1;
    for (let i = 0; i <= 30; i++) {
      const t = i / 30, x = xb + 8 * Math.sin(t * Math.PI * 0.85) - 2 * t, y = top + (bot - top) * t;
      bone(x, y, BONE[0]); bone(x + 1, y, BONE[2]);
    }
  }
  const sx0 = SX - 16, sy0 = gy(SX - 10) - 9; // skull resting on the sand, facing left
  for (let y = 0; y < 9; y++) for (let x = 0; x < 15; x++) {
    const cranium = ((x - 9) / 6) ** 2 + ((y - 4) / 4.5) ** 2 < 1;
    const snout = x < 7 && y > 3 && y < 8;
    if (cranium || snout) bone(sx0 + x, sy0 + y, y < 2 ? BONE[0] : y > 6 ? BONE[2] : BONE[1]);
  }
  bone(sx0 + 1, sy0 + 8, BONE[0]); bone(sx0 + 4, sy0 + 8, BONE[0]); // teeth
  for (const [k, col] of bones) {
    const [x, y] = k.split(',').map(Number);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!bones.has(`${x + dx},${y + dy}`) && y + dy < mid(x + dx) + 1) c.set(x + dx, y + dy, BONE[3]);
  }
  for (const [k, col] of bones) { const [x, y] = k.split(',').map(Number); c.set(x, y, col); }
  c.rect(sx0 + 8, sy0 + 3, 3, 2, BONE[3]); // eye socket
  c.rect(sx0 + 2, sy0 + 5, 2, 1, BONE[3]); // nostril

  // Hoodoos: stacked rock pillars with caps.
  for (const [x, h] of [[420, 38], [436, 28], [150, 32]]) {
    const by = mid(x) + 4;
    for (let y = by - h; y < by; y++) {
      const half = 3 + Math.round(1.5 * Math.sin((by - y) / 4));
      for (let dx = -half; dx <= half; dx++) c.set(x + dx, y, dx < 0 ? rock.lit : dx === half ? rock.dark : rock.mid);
    }
    for (let dx = -6; dx <= 6; dx++) { c.set(x + dx, by - h - 1, dx < 0 ? rock.rim : rock.lit); c.set(x + dx, by - h, rock.dark); }
  }

  // Front dunes, darker at the base so the lane reads separately.
  const frontF = duneField([[60, 13], [170, 10], [262, 14], [350, 11], [432, 13]], 174);
  const front = frontF.top;
  L.fillBelow(c, front, (x, y, d) => {
    const lee = frontF.lee(x);
    let col = d === 0 ? (lee ? '#d89c5c' : '#f8cc88') : lee ? '#c08046' : '#dca262';
    if (d > 4 && dither(x, y, (d - 4) / 10)) col = '#a86c36';
    if ((y + Math.round(3 * wave(x, 12, 0.5))) % 4 === 0 && d > 1 && d < 6 && hash(x, y, 9) < 0.5) col = '#c48448'; // ripples
    return col;
  });
  return c;
}

function ground() {
  const H = 130, c = new Canvas(W, H, true);
  const lowEdge = x => 88 + Math.round(1.2 * wave(x, 6, 2.1) + 0.8 * wave(x, 17, 0.4));
  const soilTop = x => 100 + Math.round(1.5 * wave(x, 9, 0.9) + wave(x, 23, 2.2));
  L.lanePatches(c, 0, H, ['#d3a66a', '#c99a5e', '#bc8d52']);
  for (let x = 0; x < W; x++) for (let y = 0; y < 6; y++) if (!dither(x, y, y / 6)) c.set(x, y, '#a87a44');
  // Low-contrast cracked earth.
  for (let i = 0; i < 34; i++) {
    let x = Math.floor(hash(i, 0, 41) * W), y = 12 + Math.floor(hash(i, 1, 41) * 70);
    const len = 6 + Math.floor(hash(i, 2, 41) * 10);
    for (let k = 0; k < len; k++) {
      c.set(x, y, '#b2844c');
      if (hash(i, k, 44) < 0.5) x += 1; else y += hash(i, k, 43) < 0.5 ? -1 : 1;
    }
  }
  for (let i = 0; i < 50; i++) { // grit
    const x = Math.floor(hash(i, 0, 45) * W), y = 10 + Math.floor(hash(i, 1, 45) * 76);
    c.set(x, y, '#dcb27a'); c.set(x + 1, y + 1, '#ad7e48');
  }
  for (let i = 0; i < 10; i++) L.tuft(c, Math.floor(hash(i, 0, 46) * W), 14 + Math.floor(hash(i, 1, 46) * 66), 2, '#a2763c', '#c8a060');
  // Front verge: darker sand with dry shrubs, then rocky soil.
  for (let x = 0; x < W; x++) for (let y = lowEdge(x); y < soilTop(x); y++) c.set(x, y, hash(x, y, 47) < 0.12 ? '#c08a4e' : '#b07c44');
  for (let x = 0; x < W; x += 3) if (hash(x, 0, 48) < 0.4) L.tuft(c, x, lowEdge(x) + 3 + (hash(x, 1, 48) * 6 | 0), 2 + (hash(x, 2, 48) * 3 | 0), '#86602e', '#c8a060');
  L.soilStrip(c, soilTop, ['#7a4a26', '#6a3e1e', '#54301a', '#46281a']);
  L.stones(c, 20, 11, 104, 124, 4, 10, ['#b08460', '#8e6444', '#5e3e26']);
  // Half-buried bones.
  for (let i = 0; i < 4; i++) {
    const bx = Math.floor(hash(i, 0, 49) * W), by = 108 + Math.floor(hash(i, 1, 49) * 12);
    c.rect(bx + 1, by, 7, 1, '#efe6d0'); c.rect(bx + 1, by + 1, 7, 1, '#c8bc9e');
    for (const ex of [0, 8]) { c.set(bx + ex, by - 1, '#efe6d0'); c.set(bx + ex, by, '#efe6d0'); c.set(bx + ex, by + 1, '#c8bc9e'); c.set(bx + ex, by + 2, '#c8bc9e'); }
  }
  // A couple of small cacti in the front verge.
  for (const cx of [90, 330]) {
    const by = lowEdge(cx) + 9;
    c.rect(cx, by - 9, 3, 9, '#5e8a3a'); c.rect(cx, by - 9, 1, 9, '#7aa84a');
    c.rect(cx - 3, by - 6, 3, 2, '#5e8a3a'); c.rect(cx - 3, by - 8, 2, 2, '#5e8a3a');
    c.rect(cx + 3, by - 5, 2, 2, '#4a6e2e'); c.rect(cx + 4, by - 7, 2, 2, '#4a6e2e');
  }
  return c;
}

module.exports = () => L.output('dunes', sky(), far(), ground());
if (require.main === module) module.exports();
