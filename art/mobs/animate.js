// Frame-animated enemy mobs from generated sprite sheets.
// Run: node art/mobs/animate.js              (every mob folder)
//      node art/mobs/animate.js grunt brute  (just these)
//
// Each folder art/mobs/<id>/ holds idle_sheet.png (one frame, optional), walk_sheet.png and attack_sheet.png: rows of
// frames on a flat magenta background, mirrored to face right like the heroes (the game flips enemies to face
// left). The mobs are drawn in one light grey so they can be repainted per element. For each
// mob and element this writes public/mobs/<id>_<element>.png (standing pose), <id>_<element>_walk.png and
// <id>_<element>_attack.png, strips of equal frames on one canvas with the feet at the same point, repainted in
// the element's colours (ELEMENT_RAMPS), and rewrites src/mobAnims.ts.
//
// Same steps as the heroes (art/heroes/animate.js): one connected shape per frame, shrunk on one grid anchored
// at the head and the ground line, so the head stays put and the legs visibly step; one palette; an outline.
const fs = require('fs');
const path = require('path');
const { Canvas } = require('../backgrounds/png');
const { lum, shrink, figures, N4, OUTLINE } = require('../heroes/animate');

const ROOT = __dirname;
const OUT_DIR = path.join(ROOT, '..', '..', 'public', 'mobs');
const PREVIEW = path.join(ROOT, 'preview');
const ANIMS_TS = path.join(ROOT, '..', '..', 'src', 'mobAnims.ts');
const TARGET_HEIGHT = 50; // same scale as the heroes
// How big each mob stands next to a typical hero (x TARGET_HEIGHT).
const MOB_SIZE = { grunt: 0.8, brute: 1.25, caster: 0.85, flyer: 0.75, scuttler: 0.65 };
const PALETTE = 20;
// Each element repaints the grey body along its own ramp, darkest to brightest, with the shadows shifted toward
// a deeper hue and the highlights toward a warmer one so the colour reads rich instead of flat. `wing` repaints
// the flyer's violet wing membranes. Outline, yellow eyes and bone-white teeth and horns keep their colours.
const ELEMENT_RAMPS = {
  fire: { body: ['#3a0d1c', '#8c1f1f', '#d8452a', '#ff8a3a', '#ffd27a'], wing: ['#5a1208', '#c8401a', '#ffa030', '#ffe890'] },
  water: { body: ['#0c1d4a', '#1d4f9c', '#2f8fdc', '#62c8f5', '#c8f4ff'], wing: ['#0a3a4a', '#1f8f9a', '#45d4c8', '#b8fff0'] },
  earth: { body: ['#16301a', '#2f6b25', '#5aa332', '#9bd34e', '#e4f59a'], wing: ['#3c2410', '#7a5228', '#b8863e', '#ecd08a'] },
  light: { body: ['#5a3a12', '#a8741e', '#e0b23a', '#f8dc6a', '#fffbe0'], wing: ['#6a5a90', '#b0a8e0', '#e8e4ff', '#ffffff'] },
  dark: { body: ['#1a0c2e', '#3e1d66', '#7036a8', '#a768e0', '#e2c4ff'], wing: ['#3a0a24', '#8a1f58', '#d0408a', '#ff9ccc'] },
};
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const ramp = (stops, t) => {
  const cs = stops.map(hex), f = Math.max(0, Math.min(1, t)) * (cs.length - 1), i = Math.min(cs.length - 2, Math.floor(f)), u = f - i;
  return cs[i].map((v, k) => Math.round(v + (cs[i + 1][k] - v) * u));
};
// Which part of the grey art a pixel is: kept as drawn, the body, or a violet wing.
function part(p) {
  const [r, g, b] = p, l = lum(p);
  if (l < 58) return 'keep'; // outline and the darkest shadow
  if (r > 140 && g > 120 && b < 110) return 'keep'; // yellow eyes and sparks
  if (r - b > 14 && l > 150) return 'keep'; // bone white
  if (b - g > 25 && r - g > 8) return 'wing';
  return 'body';
}
function recolor(c, el) {
  const out = new Canvas(c.w, c.h);
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
    const p = c.get(x, y);
    if (!p[3]) continue;
    const kind = part(p), l = lum(p);
    if (kind === 'keep') out.set(x, y, p.slice(0, 3));
    else if (kind === 'wing') out.set(x, y, ramp(ELEMENT_RAMPS[el].wing, (l - 70) / 130));
    else out.set(x, y, ramp(ELEMENT_RAMPS[el].body, (l - 58) / (240 - 58)));
  }
  return out;
}

function buildMob(id) {
  const dir = path.join(ROOT, id);
  const target = TARGET_HEIGHT * (MOB_SIZE[id] ?? 1);
  // The standing pose is idle_sheet.png; without one (or when it was drawn apart from the other sheets and
  // doesn't match them), the first walk frame.
  const idleFile = path.join(dir, 'idle_sheet.png');
  const small = {
    idle: fs.existsSync(idleFile) ? figures(idleFile, target).slice(0, 1).map(shrink) : [],
    // The sheets are mirrored, so their frames read right to left.
    walk: figures(path.join(dir, 'walk_sheet.png'), target).reverse().map(shrink),
    attack: figures(path.join(dir, 'attack_sheet.png'), target).reverse().map(shrink),
  };
  if (!small.idle.length) small.idle = [small.walk[0]];
  let minX = 0, maxX = 0, minY = 0;
  for (const list of Object.values(small)) for (const fr of list) for (const k of fr.keys()) {
    const [x, y] = k.split(',').map(Number);
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y);
  }
  const FW = maxX - minX + 3, FH = -minY + 3, AX = -minX + 1, FEET = FH - 1;

  const all = [];
  for (const list of Object.values(small)) for (const fr of list) for (const c of fr.values()) all.push(c);
  const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  const sorted = [...all].sort((a, b) => lum(a) - lum(b));
  let cent = Array.from({ length: PALETTE }, (_, i) => sorted[Math.floor(((i + 0.5) * sorted.length) / PALETTE)].slice());
  const nearest = c => { let bi = 0; for (let i = 1; i < cent.length; i++) if (d2(c, cent[i]) < d2(c, cent[bi])) bi = i; return bi; };
  for (let it = 0; it < 25; it++) {
    const acc = cent.map(() => [0, 0, 0, 0]);
    for (const c of all) { const a = acc[nearest(c)]; a[0]++; a[1] += c[0]; a[2] += c[1]; a[3] += c[2]; }
    cent = cent.map((c, i) => (acc[i][0] ? [acc[i][1], acc[i][2], acc[i][3]].map(v => Math.round(v / acc[i][0])) : c));
  }
  const draw = fr => {
    const c = new Canvas(FW, FH);
    for (const [k, col] of fr) { const [x, y] = k.split(',').map(Number); c.set(AX + x, FEET + y, cent[nearest(col)]); }
    const has = (x, y) => c.get(x, y)[3] > 0;
    for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++)
      if (has(x, y) && N4.filter(([a, b]) => has(x + a, y + b)).length <= 1) c.set(x, y, [0, 0, 0], 0);
    const edge = [];
    for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++)
      if (has(x, y) && lum(c.get(x, y)) > 70 && N4.some(([a, b]) => !has(x + a, y + b) && has(x - a, y - b) && has(x - 2 * a, y - 2 * b))) edge.push([x, y]);
    for (const [x, y] of edge) c.set(x, y, OUTLINE);
    return c;
  };
  const frames = Object.fromEntries(Object.entries(small).map(([k, list]) => [k, list.map(draw)]));

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(PREVIEW, { recursive: true });
  const strip = list => {
    const s = new Canvas(FW * list.length, FH);
    list.forEach((c, i) => s.draw(c, i * FW, 0));
    return s;
  };
  const stand = frames.idle[0];
  const w = strip(frames.walk), a = strip(frames.attack);
  for (const el of Object.keys(ELEMENT_RAMPS)) {
    recolor(stand, el).save(path.join(OUT_DIR, `${id}_${el}.png`));
    recolor(w, el).save(path.join(OUT_DIR, `${id}_${el}_walk.png`));
    recolor(a, el).save(path.join(OUT_DIR, `${id}_${el}_attack.png`));
  }

  let headTop = 0;
  outer: for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) if (stand.get(x, y)[3]) { headTop = y; break outer; }
  const reach = frames.attack.map(c => { for (let x = FW - 1; x >= 0; x--) for (let y = 0; y < FH; y++) if (c.get(x, y)[3]) return x; return 0; });
  const hitFrame = reach.indexOf(Math.max(...reach));

  const rowsOut = [stand, w, a, ...Object.keys(ELEMENT_RAMPS).map(el => recolor(w, el))];
  const prev = new Canvas(Math.max(...rowsOut.map(s => s.w)) + 4, rowsOut.reduce((t, s) => t + s.h + 2, 2));
  for (let y = 0; y < prev.h; y++) for (let x = 0; x < prev.w; x++) prev.set(x, y, ((x >> 2) + (y >> 2)) % 2 ? [214, 214, 222] : [196, 196, 208]);
  let y = 2;
  for (const s of rowsOut) { prev.draw(s, 2, y); y += s.h + 2; }
  prev.scaled(5).save(path.join(PREVIEW, `${id}_x5.png`));
  return { frame: [FW, FH], feet: [AX, FEET], headTop, walk: frames.walk.length, attack: frames.attack.length, hitFrame };
}

const all = fs.readdirSync(ROOT).filter(d => fs.existsSync(path.join(ROOT, d, 'walk_sheet.png')));
const wanted = process.argv.slice(2).length ? process.argv.slice(2) : all;
const prevAnims = fs.existsSync(ANIMS_TS) ? fs.readFileSync(ANIMS_TS, 'utf8') : '';
const entries = {};
for (const m of prevAnims.matchAll(/^  (\w+): (\{.*\}),$/gm)) entries[m[1]] = m[2];
for (const id of wanted) {
  const m = buildMob(id);
  entries[id] = `{ frame: [${m.frame}], feet: [${m.feet}], headTop: ${m.headTop}, walk: ${m.walk}, attack: ${m.attack}, hitFrame: ${m.hitFrame} }`;
  console.log(`${id}: ${m.frame[0]}x${m.frame[1]} frames, feet (${m.feet}), ${m.walk} walk + ${m.attack} attack, hits on frame ${m.hitFrame}`);
}
const body = Object.keys(entries).filter(id => all.includes(id)).sort().map(id => `  ${id}: ${entries[id]},`).join('\n');
fs.writeFileSync(ANIMS_TS, `// Generated by art/mobs/animate.js: don't edit by hand.
// Frame-animated enemy mobs. public/mobs/<id>.png is the standing pose; <id>_walk.png and <id>_attack.png are
// strips of equal frames on the same canvas, facing right (enemies are flipped in the game). \`feet\` is the
// pixel edge that stands on the lane, \`headTop\` the first row of the standing pose (for the HP bar).
export interface MobAnim {
  frame: [number, number];
  feet: [number, number];
  headTop: number;
  walk: number;
  attack: number;
  hitFrame: number;
}

export const MOB_ANIMS: Record<string, MobAnim> = {
${body}
};
`);
