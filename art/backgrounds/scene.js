// Shared test-screen helpers: HUD text, placeholder heroes, enemies and crystal.
const { Canvas } = require('./png');
const W = 480;

// ---------- Test screen: what the player sees at stage 1 ----------
const FONT = {
  S: ['111', '100', '111', '001', '111'], T: ['111', '010', '010', '010', '010'],
  A: ['010', '101', '111', '101', '101'], G: ['111', '100', '101', '101', '111'],
  E: ['111', '100', '110', '100', '111'], 1: ['010', '110', '010', '010', '111'], ' ': ['000', '000', '000', '000', '000'],
};
function text(c, s, x0, y0, k) {
  const pts = [];
  [...s].forEach((ch, i) => FONT[ch].forEach((row, y) => [...row].forEach((b, x) => {
    if (b === '1') for (let a = 0; a < k; a++) for (let b2 = 0; b2 < k; b2++) pts.push([x0 + (i * 4 + x) * k + a, y0 + y * k + b2]);
  })));
  pts.forEach(([x, y]) => { for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) c.set(x + dx, y + dy, '#1a1426'); });
  pts.forEach(([x, y]) => c.set(x, y, '#ffffff'));
}

// Chibi placeholder hero, about 24 px tall, feet at (fx, fy), facing right.
function hero(c, fx, fy, main, hair) {
  const s = new Canvas(32, 32);
  const disc = (cx, cy, r, col) => { for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.6) s.set(cx + x, cy + y, col); };
  s.rect(12, 26, 3, 4, '#3a3048'); s.rect(17, 26, 3, 4, '#3a3048'); // legs
  s.rect(11, 17, 10, 10, main); s.rect(11, 17, 3, 10, shade(main)); // body
  s.rect(20, 19, 6, 2, '#cfd6de'); // weapon
  disc(16, 11, 7, '#f2c9a0'); // head
  for (let y = 3; y <= 9; y++) for (let x = 9; x <= 23; x++) if ((x - 16) ** 2 + (y - 11) ** 2 <= 54 && (y < 8 || x < 13)) s.set(x, y, hair);
  s.set(19, 11, '#1a1426'); s.set(19, 12, '#1a1426');
  outline(s);
  c.draw(s, fx - 16, fy - 30);
}
function shade(col) { const n = parseInt(col.slice(1), 16); return [(n >> 16) * 0.72, ((n >> 8) & 255) * 0.72, (n & 255) * 0.72].map(Math.round); }
function outline(s) {
  const edge = [];
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++)
    if (s.get(x, y)[3] === 0 && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => s.get(x + dx, y + dy)[3] > 0)) edge.push([x, y]);
  edge.forEach(([x, y]) => s.set(x, y, '#1a1426'));
}
function slime(c, fx, fy) {
  const s = new Canvas(24, 24);
  for (let y = 0; y < 22; y++) for (let x = 0; x < 22; x++) {
    const dx = (x - 11) / 10, dy = (y - 14) / 8;
    if (dx * dx + dy * dy <= 1 && y < 21) s.set(x + 1, y, y < 11 ? '#b8486a' : '#9a3656');
  }
  s.set(8, 12, '#1a1426'); s.set(8, 13, '#1a1426'); s.set(12, 12, '#1a1426'); s.set(12, 13, '#1a1426');
  outline(s);
  c.draw(s, fx - 12, fy - 22);
}
function crystal(c, cx, fy, col, dark) {
  const s = new Canvas(34, 54);
  for (let y = 0; y < 50; y++) {
    const half = y < 20 ? Math.round(y * 0.75) : Math.round(15 - (y - 20) * 0.5);
    for (let x = -half; x <= half; x++) s.set(17 + x, y + 2, x < 0 ? col : dark);
  }
  outline(s);
  c.draw(s, cx - 17, fy - 52);
}

function makeTestScreen(sky, far, ground, scroll) {
  const c = new Canvas(W, 300);
  c.draw(sky, 0, 0);
  const tile = (layer, oy, off) => { for (let k = -1; k <= 1; k++) c.draw(layer, k * W - (off % W), oy); };
  tile(far, -10, Math.round(scroll * 0.4));
  tile(ground, 170, scroll);
  if (scroll === 0) crystal(c, 36, 214, '#7ad8f5', '#3fa0d0');
  const heroes = [['#3fa9f5', '#2a6fb0'], ['#f5603f', '#e8461c'], ['#6cbf3a', '#7a5236'], ['#f5d63f', '#e8b830'], ['#9b59d0', '#3a2a50']];
  heroes.forEach(([m, h], i) => hero(c, 92 + i * 34, 186 + i * 17, m, h));
  slime(c, 330, 200); slime(c, 372, 232); slime(c, 410, 250);
  text(c, 'STAGE 1', 8, 8, 2);
  c.rect(372, 10, 100, 7, '#1a1426'); c.rect(373, 11, 30, 5, '#f5d63f'); c.rect(403, 11, 69, 5, '#4a4060');
  return c;
}

module.exports = { makeTestScreen };
