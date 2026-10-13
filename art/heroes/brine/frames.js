// Brine's animation frames, from the generated sheets (attack_sheet.png: 5 frames, run_sheet.png: 6).
// Run: node art/heroes/brine/frames.js
//   -> public/heroes/brine.png (standing pose = attack frame 1), brine_run.png, brine_attack.png
//      Strips of equal frames, all on one canvas size with the feet at the same point, so the game can swap
//      animations without the hero jumping. Prints the frame size and feet point for HERO_ANIMS.
// Steps: key out the magenta background, split frames by empty columns, shrink every frame on one shared
// pixel grid anchored at the head and feet, one shared palette, outline.
const path = require('path');
const { readPNG, Canvas } = require('../../backgrounds/png');

const OUT_DIR = path.join(__dirname, '..', '..', '..', 'public', 'heroes');
const PREVIEW = path.join(__dirname, '..', 'preview');
const TARGET_HEIGHT = 50; // sprite px, to match Brine's size in the lane
const PALETTE = 24;
const OUTLINE = [30, 22, 40];
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const lum = p => 0.3 * p[0] + 0.59 * p[1] + 0.11 * p[2];

// Magenta and its JPEG fringe: strong red and blue, little green. No part of Brine looks like that.
const isBg = p => p[0] - p[1] > 80 && p[2] - p[1] > 40;

// Each figure is one connected shape (blades can reach into the next figure's columns, so splitting on
// empty columns doesn't work). Frames are the big shapes, left to right.
function frames(file) {
  const img = readPNG(path.join(__dirname, file));
  const W = img.w, H = img.h, label = new Int32Array(W * H).fill(-1);
  const shapes = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (label[y * W + x] >= 0 || isBg(img.get(x, y))) continue;
    const id = shapes.length, stack = [[x, y]];
    const s = { id, n: 0, x0: x, x1: x, y0: y, y1: y };
    label[y * W + x] = id;
    while (stack.length) {
      const [cx, cy] = stack.pop();
      s.n++; s.x0 = Math.min(s.x0, cx); s.x1 = Math.max(s.x1, cx); s.y0 = Math.min(s.y0, cy); s.y1 = Math.max(s.y1, cy);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const i = ny * W + nx;
        if (label[i] >= 0 || isBg(img.get(nx, ny))) continue;
        label[i] = id;
        stack.push([nx, ny]);
      }
    }
    shapes.push(s);
  }
  return shapes.filter(s => s.n > 2000).sort((a, b) => a.x0 - b.x0).map(s => {
    const fg = (x, y) => x >= 0 && y >= 0 && x < W && y < H && label[y * W + x] === s.id;
    // Head anchor: centre of the top fifth of the figure (the hair), steadier than the feet in a run.
    let sx = 0, n = 0;
    for (let y = s.y0; y < s.y0 + (s.y1 - s.y0) / 5; y++) for (let x = s.x0; x <= s.x1; x++) if (fg(x, y)) { sx += x; n++; }
    return { img, x0: s.x0, x1: s.x1 + 1, y0: s.y0, y1: s.y1, headX: sx / n, fg };
  });
}

const attack = frames('attack_sheet.png');
const run = frames('run_sheet.png');
console.log(`found ${attack.length} attack frames, ${run.length} run frames`);

// One pixel grid size for everything, from the standing frame's height.
const stand = attack[0];
const BLOCK = (stand.y1 - stand.y0 + 1) / TARGET_HEIGHT;

// Shrink one frame: blocks are laid out from the feet line up and from the head anchor out, so the same
// body part lands on the same sprite pixel in every frame.
function shrink(f) {
  const out = new Map(); // "x,y" -> [r,g,b], x relative to head anchor, y up from feet (negative)
  const feet = f.y1 + 1;
  for (let by = -Math.ceil((f.y1 - f.y0 + 1) / BLOCK) - 2; by < 0; by++) {
    for (let bx = -Math.ceil((f.headX - f.x0) / BLOCK) - 1; bx <= Math.ceil((f.x1 - f.headX) / BLOCK) + 1; bx++) {
      const buckets = new Map();
      let fgN = 0, total = 0;
      for (let y = Math.floor(feet + by * BLOCK); y < Math.floor(feet + (by + 1) * BLOCK); y++)
        for (let x = Math.floor(f.headX + bx * BLOCK); x < Math.floor(f.headX + (bx + 1) * BLOCK); x++) {
          if (x < f.x0 - 2 || x > f.x1 + 2 || y < 0 || y >= f.img.h) continue;
          total++;
          if (!f.fg(x, y)) continue;
          fgN++;
          const p = f.img.get(x, y), k = ((p[0] >> 4) << 8) | ((p[1] >> 4) << 4) | (p[2] >> 4);
          const b = buckets.get(k) || [0, 0, 0, 0];
          b[0]++; b[1] += p[0]; b[2] += p[1]; b[3] += p[2];
          buckets.set(k, b);
        }
      if (!total || fgN < total * 0.45) continue;
      let best = null;
      for (const b of buckets.values()) if (!best || b[0] > best[0]) best = b;
      out.set(`${bx},${by}`, [best[1], best[2], best[3]].map(v => Math.round(v / best[0])));
    }
  }
  return out;
}
const small = { attack: attack.map(shrink), run: run.map(shrink) };

// Shared canvas: big enough for every frame, head anchor at a fixed column, feet on the bottom rows.
let minX = 0, maxX = 0, minY = 0;
for (const list of Object.values(small)) for (const fr of list) for (const k of fr.keys()) {
  const [x, y] = k.split(',').map(Number);
  minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y);
}
const FW = maxX - minX + 3, FH = -minY + 3;
const AX = -minX + 1, FEET_Y = FH - 2; // anchor column; feet stand on row FEET_Y (bottom edge FEET_Y + 1)

// Shared palette across all frames (k-means), so colours never flicker between frames.
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

function draw(fr) {
  const c = new Canvas(FW, FH);
  for (const [k, col] of fr) { const [x, y] = k.split(',').map(Number); c.set(AX + x, FEET_Y + 1 + y, cent[nearest(col)]); }
  const has = (x, y) => c.get(x, y)[3] > 0;
  for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++)
    if (has(x, y) && N4.filter(([a, b]) => has(x + a, y + b)).length <= 1) c.set(x, y, [0, 0, 0], 0);
  const edge = [];
  for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++)
    if (has(x, y) && N4.some(([a, b]) => !has(x + a, y + b)) && lum(c.get(x, y)) > 70) edge.push([x, y]);
  for (const [x, y] of edge) c.set(x, y, OUTLINE);
  return c;
}
function strip(list, file) {
  const s = new Canvas(FW * list.length, FH);
  list.forEach((fr, i) => s.draw(draw(fr), i * FW, 0));
  s.save(path.join(OUT_DIR, file));
  return s;
}
const a = strip(small.attack, 'brine_attack.png');
const r = strip(small.run, 'brine_run.png');
draw(small.attack[0]).save(path.join(OUT_DIR, 'brine.png'));

// Preview both strips on a checkerboard at 6x.
const prev = new Canvas(Math.max(a.w, r.w) + 4, a.h + r.h + 6);
for (let y = 0; y < prev.h; y++) for (let x = 0; x < prev.w; x++) prev.set(x, y, ((x >> 2) + (y >> 2)) % 2 ? [214, 214, 222] : [196, 196, 208]);
prev.draw(a, 2, 2); prev.draw(r, 2, a.h + 4);
prev.scaled(6).save(path.join(PREVIEW, 'brine_frames_x6.png'));
console.log(`frame ${FW}x${FH}, feet at (${AX}, ${FEET_Y + 1}) [column, bottom edge]`);
