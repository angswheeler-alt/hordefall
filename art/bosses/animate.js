// Frame-animated element bosses from generated sprite sheets.
// Run: node art/bosses/animate.js            (every boss folder)
//      node art/bosses/animate.js fire dark  (just these)
//
// Each folder art/bosses/<element>/ holds idle_sheet.png, attack_sheet.png, hurt_sheet.png and death_sheet.png:
// one row of frames on a flat magenta background (reference.png, if present, is the concept art and isn't
// used). For each boss this writes public/bosses/<element>_<anim>.png, strips of equal frames on one canvas
// with the feet at the same point, and rewrites src/bossAnims.ts.
//
// Same look as the heroes (art/heroes/animate.js: magenta key, block shrink, one palette, outline), but frames
// are split by columns instead of connected shapes, because a dying boss breaks into loose particles, and
// each frame stands on the middle of its feet instead of under its head.
//
// A folder may hold split.json for sheets the even split gets wrong, keyed by animation:
//   { "death": { "cuts": [290, 568, 812, 1015] }, "idle": { "shapes": true } }
// `cuts` are the source x positions between frames (for unevenly spaced frames). `shapes` gives every
// connected shape to the frame its middle falls in, so a part reaching past a cut (a lure, a tail) stays with
// its own frame instead of being sliced off.
const fs = require('fs');
const path = require('path');
const { readPNG, Canvas } = require('../backgrounds/png');
const { isBg, lum, shrink, N4, OUTLINE } = require('../heroes/animate');

const ROOT = __dirname;
const OUT_DIR = path.join(ROOT, '..', '..', 'public', 'bosses');
const PREVIEW = path.join(ROOT, 'preview');
const ANIMS_TS = path.join(ROOT, '..', '..', 'src', 'bossAnims.ts');
const TARGET_HEIGHT = 96; // sprite px for a standing boss, about twice a hero
const PALETTE = 32;
const ANIMS = { idle: 5, attack: 5, hurt: 3, death: 5 };
const median = a => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

// Split a sheet into `count` frames. The generator spaces frames evenly, so cut at the emptiest column near
// each even boundary (slashes, beams and dust can join neighbouring frames, so gaps alone aren't enough).
function frames(file, count, scaleBy, hint = {}) {
  const img = readPNG(file);
  const W = img.w, H = img.h;
  const fg = (x, y) => x >= 0 && y >= 0 && x < W && y < H && !isBg(img.get(x, y));
  const colN = [];
  for (let x = 0; x < W; x++) { let n = 0; for (let y = 0; y < H; y++) if (fg(x, y)) n++; colN.push(n); }
  // The art's extent: columns in runs of at least 3 occupied ones (lone columns are JPEG specks).
  const solid = x => [-2, -1, 0].some(o => colN[x + o] >= 3 && colN[x + o + 1] >= 3 && colN[x + o + 2] >= 3);
  let left = 0, right = W - 1;
  while (left < W && !solid(left)) left++;
  while (right > left && !solid(right)) right--;
  const cell = (right + 1 - left) / count;
  const cuts = [left];
  if (hint.cuts) cuts.push(...hint.cuts);
  else for (let k = 1; k < count; k++) {
    const mid = Math.round(left + k * cell), reach = Math.round(cell * 0.3);
    let cut = mid;
    for (let x = mid - reach; x <= mid + reach; x++) if (colN[x] < colN[cut] || (colN[x] === colN[cut] && Math.abs(x - mid) < Math.abs(cut - mid))) cut = x;
    cuts.push(cut);
  }
  cuts.push(right + 1);
  // A beam or slash cut off at a boundary leaves a slice in the next frame: drop shapes that touch a cut and
  // stay in the outer quarter of the cell next to it.
  const dropped = new Uint8Array(W * H);
  for (let k = 0; k < count; k++) {
    const x0 = cuts[k], x1 = cuts[k + 1], seen = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (const sx of [x0, x1 - 1]) {
      if (k === 0 && sx === x0 || k === count - 1 && sx === x1 - 1) continue;
      if (seen[y * W + sx] || !fg(sx, y)) continue;
      const blob = [], stack = [[sx, y]];
      seen[y * W + sx] = 1;
      let bx0 = sx, bx1 = sx;
      while (stack.length) {
        const [px, py] = stack.pop();
        blob.push(py * W + px); bx0 = Math.min(bx0, px); bx1 = Math.max(bx1, px);
        for (const [a, b] of N4) {
          const nx = px + a, ny = py + b;
          if (nx < x0 || nx >= x1 || seen[ny * W + nx] || !fg(nx, ny)) continue;
          seen[ny * W + nx] = 1; stack.push([nx, ny]);
        }
      }
      const quarter = (x1 - x0) / 4;
      if (sx === x0 ? bx1 < x0 + quarter : bx0 > x1 - quarter) for (const i of blob) dropped[i] = 1;
    }
  }
  // With `shapes`, each connected shape belongs to the frame its middle is in (-1: too wide, cut by columns).
  const owner = new Int32Array(W * H).fill(-1);
  if (hint.shapes) {
    const seen = new Uint8Array(W * H);
    for (let sy = 0; sy < H; sy++) for (let sx = 0; sx < W; sx++) {
      if (seen[sy * W + sx] || !fg(sx, sy)) continue;
      const blob = [], stack = [[sx, sy]];
      seen[sy * W + sx] = 1;
      let bx0 = sx, bx1 = sx;
      while (stack.length) {
        const [px, py] = stack.pop();
        blob.push(py * W + px); bx0 = Math.min(bx0, px); bx1 = Math.max(bx1, px);
        for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
          const nx = px + a, ny = py + b;
          if (!fg(nx, ny) || seen[ny * W + nx]) continue;
          seen[ny * W + nx] = 1; stack.push([nx, ny]);
        }
      }
      if (bx1 - bx0 > cell * 1.2) continue;
      const mid = (bx0 + bx1) / 2;
      let k = 0;
      while (k < count - 1 && mid >= cuts[k + 1]) k++;
      for (const i of blob) owner[i] = k;
    }
  }
  const inFrame = (k, x, y) => {
    const o = owner[y * W + x];
    return o >= 0 ? o === k : x >= cuts[k] && x < cuts[k + 1] && !dropped[y * W + x];
  };
  const boxes = [];
  for (let k = 0; k < count; k++) {
    // A shape may reach past its cuts, so look half a cell either side.
    const reach = hint.shapes ? Math.ceil(cell / 2) : 0;
    const x0 = Math.max(0, cuts[k] - reach), x1 = Math.min(W, cuts[k + 1] + reach);
    const kept = (x, y) => fg(x, y) && inFrame(k, x, y);
    let y0 = H, y1 = 0;
    for (let x = x0; x < x1; x++) for (let y = 0; y < H; y++) if (kept(x, y)) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    // Middle of the feet: the median column of the bottom eighth of the frame.
    const xs = [];
    for (let y = Math.floor(y1 - Math.max(2, (y1 - y0) / 8)); y <= y1; y++) for (let x = x0; x < x1; x++) if (kept(x, y)) xs.push(x);
    boxes.push({ x0, x1, y0, y1, kept, footX: xs.length ? median(xs) : (x0 + x1) / 2, cellX: hint.cuts ? (cuts[k] + cuts[k + 1] - cell) / 2 : left + k * cell });
  }
  if (boxes.some(b => b.y1 < b.y0)) throw new Error(`${file}: an empty frame`);
  // Every frame stands at the same spot in its cell: the usual one, so a beam or slash on the ground in one
  // frame can't drag the boss sideways.
  const offset = median(boxes.map(b => b.footX - b.cellX));
  const ground = Math.max(...boxes.map(b => b.y1)) + 1;
  const heights = boxes.map(b => b.y1 - b.y0 + 1);
  const block = (scaleBy === 'first' ? heights[0] : median(heights)) / TARGET_HEIGHT;
  return boxes.map(b => ({
    img, x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1, headX: b.cellX + offset, ground, block,
    fg: (x, y) => x >= b.x0 && x < b.x1 && b.kept(x, y),
  }));
}

function buildBoss(id) {
  const dir = path.join(ROOT, id);
  const hintFile = path.join(dir, 'split.json');
  const hints = fs.existsSync(hintFile) ? JSON.parse(fs.readFileSync(hintFile, 'utf8')) : {};
  // A death sheet collapses, so it's scaled by its first (still standing) frame.
  const small = Object.fromEntries(Object.entries(ANIMS).map(([anim, n]) =>
    [anim, frames(path.join(dir, `${anim}_sheet.png`), n, anim === 'death' ? 'first' : 'median', hints[anim]).map(shrink)]));

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
    const edge = [];
    for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++)
      if (has(x, y) && lum(c.get(x, y)) > 70 && N4.some(([a, b]) => !has(x + a, y + b) && has(x - a, y - b) && has(x - 2 * a, y - 2 * b))) edge.push([x, y]);
    for (const [x, y] of edge) c.set(x, y, OUTLINE);
    return c;
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(PREVIEW, { recursive: true });
  const strips = {};
  for (const [anim, list] of Object.entries(small)) {
    const s = new Canvas(FW * list.length, FH);
    list.map(draw).forEach((c, i) => s.draw(c, i * FW, 0));
    s.save(path.join(OUT_DIR, `${id}_${anim}.png`));
    strips[anim] = s;
  }
  // HP bar and name sit above the first row of the idle pose.
  let headTop = FH;
  for (let y = 0; y < FH && headTop === FH; y++) for (let x = 0; x < FW; x++) if (strips.idle.get(x, y)[3]) { headTop = y; break; }

  const list = Object.values(strips);
  const prev = new Canvas(Math.max(...list.map(s => s.w)) + 4, list.reduce((t, s) => t + s.h + 2, 2));
  for (let y = 0; y < prev.h; y++) for (let x = 0; x < prev.w; x++) prev.set(x, y, ((x >> 2) + (y >> 2)) % 2 ? [214, 214, 222] : [196, 196, 208]);
  let y = 2;
  for (const s of list) { prev.draw(s, 2, y); y += s.h + 2; }
  prev.scaled(3).save(path.join(PREVIEW, `${id}_x3.png`));
  return { frame: [FW, FH], feet: [AX, FEET], headTop };
}

const all = fs.readdirSync(ROOT).filter(d => fs.existsSync(path.join(ROOT, d, 'idle_sheet.png')));
const wanted = process.argv.slice(2).length ? process.argv.slice(2) : all;
const prevAnims = fs.existsSync(ANIMS_TS) ? fs.readFileSync(ANIMS_TS, 'utf8') : '';
const entries = {};
for (const m of prevAnims.matchAll(/^  (\w+): (\{.*\}),$/gm)) entries[m[1]] = m[2];
for (const id of wanted) {
  const b = buildBoss(id);
  entries[id] = `{ frame: [${b.frame}], feet: [${b.feet}], headTop: ${b.headTop} }`;
  console.log(`${id}: ${b.frame[0]}x${b.frame[1]} frames, feet (${b.feet})`);
}
const body = Object.keys(entries).filter(id => all.includes(id)).sort().map(id => `  ${id}: ${entries[id]},`).join('\n');
fs.writeFileSync(ANIMS_TS, `// Generated by art/bosses/animate.js: don't edit by hand.
// Frame-animated element bosses, keyed by element. public/bosses/<element>_<anim>.png are strips of equal frames
// on the same canvas, one per animation in BOSS_ANIM_FRAMES. \`feet\` is the pixel edge that stands on the
// lane, \`headTop\` the first row of the idle pose (for the HP bar and name).
export interface BossAnim {
  frame: [number, number];
  feet: [number, number];
  headTop: number;
}

export const BOSS_ANIM_FRAMES = ${JSON.stringify(ANIMS).replace(/"/g, '').replace(/,/g, ', ').replace(/:/g, ': ').replace('{', '{ ').replace('}', ' }')};

export const BOSS_ANIMS: Record<string, BossAnim> = {
${body}
};
`);
