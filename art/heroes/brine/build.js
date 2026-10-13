// Brine: turns the painted source art (source.png) into a game sprite rigged for cut-out animation.
// Run: node art/heroes/brine/build.js
//   -> public/heroes/brine.png (body), brine_arm.png (forearm + cutlass), brine_scarf.png (scarf tail)
//      All three share one canvas, so the game stacks them at the same spot; RIGS in BattleScene.ts holds
//      the feet point and the pivots (arm swings about the elbow, scarf flutters about the neck).
// Steps: remove the painted checkerboard and motion streaks, shrink to sprite size (the source isn't on a
// true pixel grid), reduce the palette, outline, then cut out the arm and scarf and patch the gap.
const path = require('path');
const { readPNG, Canvas } = require('../../backgrounds/png');

const OUT_DIR = path.join(__dirname, '..', '..', '..', 'public', 'heroes');
const PREVIEW = path.join(__dirname, '..', 'preview');
const OUTLINE = [30, 22, 40];
const BLOCK = 16; // source pixels per sprite pixel: the character ends up about 50 px tall
const PALETTE = 22;
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const lum = p => 0.3 * p[0] + 0.59 * p[1] + 0.11 * p[2];
const has = (c, x, y) => c.get(x, y)[3] > 0;

// 1. Flood-fill the light, grey checkerboard and white streaks in from the border.
const img = readPNG(path.join(__dirname, 'source.png'));
const W = img.w, H = img.h;
const light = p => p[0] > 196 && p[1] > 196 && p[2] > 196 && Math.max(p[0], p[1], p[2]) - Math.min(p[0], p[1], p[2]) < 22;
const bg = new Uint8Array(W * H);
const stack = [];
for (let x = 0; x < W; x++) stack.push([x, 0], [x, H - 1]);
for (let y = 0; y < H; y++) stack.push([0, y], [W - 1, y]);
while (stack.length) {
  const [x, y] = stack.pop();
  if (x < 0 || y < 0 || x >= W || y >= H) continue;
  const i = y * W + x;
  if (bg[i] || !light(img.get(x, y))) continue;
  bg[i] = 1;
  for (const [a, b] of N4) stack.push([x + a, y + b]);
}
let x0 = W, y0 = H, x1 = 0, y1 = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!bg[y * W + x]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }

// 2. Shrink: each sprite pixel takes the dominant colour of its block, or stays empty if mostly background.
const sw = Math.ceil((x1 - x0 + 1) / BLOCK), sh = Math.ceil((y1 - y0 + 1) / BLOCK);
const small = [];
for (let oy = 0; oy < sh; oy++) for (let ox = 0; ox < sw; ox++) {
  const buckets = new Map();
  let fg = 0, total = 0;
  for (let y = y0 + oy * BLOCK; y < Math.min(y1 + 1, y0 + (oy + 1) * BLOCK); y++) for (let x = x0 + ox * BLOCK; x < Math.min(x1 + 1, x0 + (ox + 1) * BLOCK); x++) {
    total++;
    if (bg[y * W + x]) continue;
    fg++;
    const p = img.get(x, y), k = ((p[0] >> 4) << 8) | ((p[1] >> 4) << 4) | (p[2] >> 4);
    const b = buckets.get(k) || [0, 0, 0, 0];
    b[0]++; b[1] += p[0]; b[2] += p[1]; b[3] += p[2];
    buckets.set(k, b);
  }
  if (fg < total * 0.45) continue;
  let best = null;
  for (const b of buckets.values()) if (!best || b[0] > best[0]) best = b;
  small.push({ x: ox + 1, y: oy + 1, c: [best[1], best[2], best[3]].map(v => Math.round(v / best[0])) });
}

// 3. Palette (k-means), drop stray pixels, outline the silhouette.
const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
const byLum = [...small].sort((a, b) => lum(a.c) - lum(b.c));
let cent = Array.from({ length: PALETTE }, (_, i) => byLum[Math.floor(((i + 0.5) * byLum.length) / PALETTE)].c.slice());
for (let it = 0; it < 30; it++) {
  const acc = cent.map(() => [0, 0, 0, 0]);
  for (const p of small) {
    let bi = 0;
    for (let i = 1; i < PALETTE; i++) if (d2(p.c, cent[i]) < d2(p.c, cent[bi])) bi = i;
    p.k = bi;
    const a = acc[bi]; a[0]++; a[1] += p.c[0]; a[2] += p.c[1]; a[3] += p.c[2];
  }
  cent = cent.map((c, i) => (acc[i][0] ? [acc[i][1], acc[i][2], acc[i][3]].map(v => Math.round(v / acc[i][0])) : c));
}
const sprite = new Canvas(sw + 2, sh + 2);
for (const p of small) sprite.set(p.x, p.y, cent[p.k]);
for (let y = 0; y < sprite.h; y++) for (let x = 0; x < sprite.w; x++)
  if (has(sprite, x, y) && N4.filter(([a, b]) => has(sprite, x + a, y + b)).length <= 1) sprite.set(x, y, [0, 0, 0], 0);
const edge = [];
for (let y = 0; y < sprite.h; y++) for (let x = 0; x < sprite.w; x++)
  if (has(sprite, x, y) && N4.some(([a, b]) => !has(sprite, x + a, y + b)) && lum(sprite.get(x, y)) > 70) edge.push([x, y]);
for (const [x, y] of edge) sprite.set(x, y, OUTLINE);

// 4. Cut the rig. Coordinates are sprite pixels (see RIGS.brine in BattleScene.ts).
const SW = sprite.w, SH = sprite.h;
const isSkin = p => p[3] && p[0] > 190 && p[1] > 130 && p[0] - p[2] > 45;
const body = new Canvas(SW, SH), scarf = new Canvas(SW, SH), arm = new Canvas(SW, SH);
const erased = new Set();
for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
  const p = sprite.get(x, y);
  if (!p[3]) continue;
  const sword = x >= 25 && y >= 22 && y <= 36;
  const hand = x >= 14 && x <= 24 && y >= 25 && y <= 35 && (isSkin(p) || x >= 21);
  const tail = x <= 9 && y >= 15 && y <= 27;
  if (sword || hand) { erased.add(`${x},${y}`); continue; }
  (tail ? scarf : body).set(x, y, p.slice(0, 3));
}
// Patch the gap: interior pixels take the nearest non-outline colour to their left.
for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
  if (!erased.has(`${x},${y}`)) continue;
  let l = x - 1; while (l >= 0 && !has(body, l, y)) l--;
  let r = x + 1; while (r < SW && !has(body, r, y) && !erased.has(`${r},${y}`)) r++;
  if (l >= 0 && r < SW && has(body, r, y)) {
    let k = x - 1; while (k > l && body.get(k, y)[0] < 50) k--;
    body.set(x, y, body.get(Math.max(l, k), y).slice(0, 3));
  }
}
const fix = [];
for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++)
  if (has(body, x, y) && N4.some(([a, b]) => !has(body, x + a, y + b) && !has(scarf, x + a, y + b)) && lum(body.get(x, y)) > 70) fix.push([x, y]);
for (const [x, y] of fix) body.set(x, y, OUTLINE);

// The sword arm, redrawn crisp: forearm from the elbow (16,26), hand, gold guard, curved cutlass.
const SK = [[255, 214, 170], [238, 186, 140], [196, 136, 96]];
const put = (x, y, c) => arm.set(x, y, c);
for (let i = 0; i <= 4; i++) for (let t = -1; t <= 1; t++) put(16 + i + t, 26 + i, t < 0 ? SK[0] : t > 0 ? SK[2] : SK[1]);
for (let y = 30; y <= 33; y++) for (let x = 20; x <= 23; x++) put(x, y, y === 30 || x === 20 ? SK[0] : y === 33 || x === 23 ? SK[2] : SK[1]);
for (let y = 28; y <= 34; y++) put(24, y, y === 28 || y === 34 ? [138, 100, 22] : [232, 192, 64]);
put(23, 28, [232, 192, 64]); put(23, 34, [232, 192, 64]);
put(19, 33, [120, 80, 40]); put(18, 34, [232, 192, 64]);
for (let x = 25; x <= 39; x++) {
  const t = (x - 25) / 14, y = Math.round(31 - 6 * t - 2 * t * t);
  put(x, y - 1, [246, 250, 255]); put(x, y, [196, 208, 222]);
  if (x < 37) put(x, y + 1, [130, 144, 164]);
}
const aol = [];
for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++)
  if (!has(arm, x, y) && N4.some(([a, b]) => has(arm, x + a, y + b))) aol.push([x, y]);
for (const [x, y] of aol) put(x, y, OUTLINE);

body.save(path.join(OUT_DIR, 'brine.png'));
arm.save(path.join(OUT_DIR, 'brine_arm.png'));
scarf.save(path.join(OUT_DIR, 'brine_scarf.png'));
sprite.scaled(8).save(path.join(PREVIEW, 'brine_full_x8.png'));
console.log(`brine: ${SW}x${SH} body + arm + scarf`);
