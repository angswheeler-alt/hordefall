// Frame-animated enemy mobs from generated sprite sheets.
// Run: node art/mobs/animate.js              (every mob folder)
//      node art/mobs/animate.js grunt brute  (just these)
//
// Each folder art/mobs/<id>/ holds idle_sheet.png (one frame, optional), walk_sheet.png and attack_sheet.png: rows of
// frames on a flat magenta background, mirrored to face right like the heroes (the game flips enemies to face
// left). The mobs are drawn in one light grey so the game can tint them with their element's colour. For each
// mob this writes public/mobs/<id>.png (standing pose), <id>_walk.png and <id>_attack.png, strips of equal
// frames on one canvas with the feet at the same point, and rewrites src/mobAnims.ts.
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
  const strip = (list, file) => {
    const s = new Canvas(FW * list.length, FH);
    list.forEach((c, i) => s.draw(c, i * FW, 0));
    s.save(path.join(OUT_DIR, file));
    return s;
  };
  const stand = frames.idle[0];
  stand.save(path.join(OUT_DIR, `${id}.png`));
  const w = strip(frames.walk, `${id}_walk.png`);
  const a = strip(frames.attack, `${id}_attack.png`);

  let headTop = 0;
  outer: for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) if (stand.get(x, y)[3]) { headTop = y; break outer; }
  const reach = frames.attack.map(c => { for (let x = FW - 1; x >= 0; x--) for (let y = 0; y < FH; y++) if (c.get(x, y)[3]) return x; return 0; });
  const hitFrame = reach.indexOf(Math.max(...reach));

  const rowsOut = [stand, w, a];
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
