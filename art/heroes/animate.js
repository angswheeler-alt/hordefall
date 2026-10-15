// Frame-animated heroes from generated sprite sheets.
// Run: node art/heroes/animate.js            (every hero folder with sheets)
//      node art/heroes/animate.js rook lumen (just these)
//
// Each hero folder art/heroes/<id>/ holds run_sheet.png and attack_sheet.png: one row of frames on a flat
// magenta background (reference.png, if present, is the concept art and isn't used). For each hero this
// writes public/heroes/<id>.png (standing pose = first attack frame), <id>_run.png and <id>_attack.png:
// strips of equal frames on one canvas with the feet at the same point, so animations swap without the
// hero jumping. It then rewrites src/heroAnims.ts with every animated hero's frame size and feet point.
//
// Steps per sheet: key out the magenta, find each figure as one connected shape, shrink every frame on one
// pixel grid anchored at the head (x) and the sheet's ground line (y), so frames line up and a jump frame
// stays in the air. Then one palette per hero across both sheets, and an outline.
const fs = require('fs');
const path = require('path');
const { readPNG, Canvas } = require('../backgrounds/png');

const ROOT = __dirname;
const OUT_DIR = path.join(ROOT, '..', '..', 'public', 'heroes');
const PREVIEW = path.join(ROOT, 'preview');
const ANIMS_TS = path.join(ROOT, '..', '..', 'src', 'heroAnims.ts');
const TARGET_HEIGHT = 50; // sprite px for a typical frame, head to feet, at size 1
// How big each hero stands next to the others (x TARGET_HEIGHT): hulking brutes and armoured knights are big,
// faeries, bats and bunnies small. The pixels are redrawn at that size, so every hero stays crisp.
const HERO_SIZE = {
  cinder: 1.3, blaze: 1.25, dread: 1.25, aegis: 1.25, thorn: 1.1,
  vex: 1.05, wraith: 1.05, marina: 1.05, dawn: 1.05,
  brine: 1, ember: 1, rook: 1, brook: 1,
  lumen: 0.95, seraph: 0.95, flint: 0.95, ripple: 0.95,
  briar: 0.9, moss: 0.85, shade: 0.85, sol: 0.8, nyx: 0.75, fern: 0.7,
};
const PALETTE = 24;
const OUTLINE = [30, 22, 40];
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const lum = p => 0.3 * p[0] + 0.59 * p[1] + 0.11 * p[2];
const median = a => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

// Magenta, its JPEG fringe and its darker painted shadows: strong red and blue, little green. The magenta
// leans red; violet magic (orbs, glows) leans blue, so anything clearly bluer than it is red stays, and so
// do bright pinks (a glowing core) that the fairly dark magenta never reaches.
const isBg = p => p[2] - p[0] <= 20 && lum(p) < 130 && ((p[0] - p[1] > 80 && p[2] - p[1] > 40) || (p[0] > 60 && p[1] < 30 && p[2] > 40 && p[0] - p[1] > 50));

// Each figure is one connected shape (weapons can reach into the next figure's columns).
function figures(file, target = TARGET_HEIGHT) {
  const img = readPNG(file);
  const W = img.w, H = img.h, label = new Int32Array(W * H).fill(-1);
  const shapes = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (label[y * W + x] >= 0 || isBg(img.get(x, y))) continue;
    const s = { id: shapes.length, n: 0, x0: x, x1: x, y0: y, y1: y };
    const stack = [[x, y]];
    label[y * W + x] = s.id;
    while (stack.length) {
      const [cx, cy] = stack.pop();
      s.n++; s.x0 = Math.min(s.x0, cx); s.x1 = Math.max(s.x1, cx); s.y0 = Math.min(s.y0, cy); s.y1 = Math.max(s.y1, cy);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const i = ny * W + nx;
        if (label[i] >= 0 || isBg(img.get(nx, ny))) continue;
        label[i] = s.id;
        stack.push([nx, ny]);
      }
    }
    shapes.push(s);
  }
  const big = shapes.filter(s => s.n > 2000).sort((a, b) => a.x0 - b.x0);
  const ground = Math.max(...big.map(s => s.y1)) + 1;
  const block = median(big.map(s => s.y1 - s.y0 + 1)) / target;
  return big.map(s => {
    const fg = (x, y) => x >= 0 && y >= 0 && x < W && y < H && label[y * W + x] === s.id;
    // Head anchor: centre of the top fifth of the figure.
    let sx = 0, n = 0;
    for (let y = s.y0; y < s.y0 + (s.y1 - s.y0) / 5; y++) for (let x = s.x0; x <= s.x1; x++) if (fg(x, y)) { sx += x; n++; }
    return { img, x0: s.x0, x1: s.x1 + 1, y0: s.y0, y1: s.y1, headX: sx / n, fg, ground, block };
  });
}

// Shrink one frame onto the shared grid: x relative to the head anchor, y up from the ground line.
function shrink(f) {
  const out = new Map();
  const B = f.block;
  for (let by = -Math.ceil((f.ground - f.y0) / B) - 2; by < 0; by++) {
    for (let bx = -Math.ceil((f.headX - f.x0) / B) - 1; bx <= Math.ceil((f.x1 - f.headX) / B) + 1; bx++) {
      const buckets = new Map();
      let fgN = 0, total = 0;
      for (let y = Math.floor(f.ground + by * B); y < Math.floor(f.ground + (by + 1) * B); y++)
        for (let x = Math.floor(f.headX + bx * B); x < Math.floor(f.headX + (bx + 1) * B); x++) {
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

function buildHero(id) {
  const dir = path.join(ROOT, id);
  const size = HERO_SIZE[id] ?? 1;
  const small = {
    attack: figures(path.join(dir, 'attack_sheet.png'), TARGET_HEIGHT * size).map(shrink),
    run: figures(path.join(dir, 'run_sheet.png'), TARGET_HEIGHT * size).map(shrink),
  };
  // One canvas for every frame: head anchor at a fixed column, ground on the bottom rows.
  let minX = 0, maxX = 0, minY = 0;
  for (const list of Object.values(small)) for (const fr of list) for (const k of fr.keys()) {
    const [x, y] = k.split(',').map(Number);
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y);
  }
  const FW = maxX - minX + 3, FH = -minY + 3, AX = -minX + 1, FEET = FH - 1; // feet stand on the edge at row FEET

  // One palette across both sheets (k-means), so colours never flicker between animations.
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
    // Outline edge pixels, but only where the shape is at least 3 px thick behind them: thin things like
    // staffs, spear shafts and blades keep their colour instead of turning into all-outline lines.
    const edge = [];
    for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++)
      if (has(x, y) && lum(c.get(x, y)) > 70 && N4.some(([a, b]) => !has(x + a, y + b) && has(x - a, y - b) && has(x - 2 * a, y - 2 * b))) edge.push([x, y]);
    for (const [x, y] of edge) c.set(x, y, OUTLINE);
    return c;
  };
  const frames = { attack: small.attack.map(draw), run: small.run.map(draw) };
  // Optional per-hero touch-up (art/heroes/<id>/fix.js), e.g. to make the sheets agree on a detail.
  // It may return { hitFrame } to say which attack frame lands the blow; `scale` is the hero's size, for
// touch-ups measured in pixels.
  const fixFile = path.join(dir, 'fix.js');
  const fixed = (fs.existsSync(fixFile) && require(fixFile)(frames, { FW, FH, Canvas, scale: size })) || {};
  const strip = (list, file) => {
    const s = new Canvas(FW * list.length, FH);
    list.forEach((c, i) => s.draw(c, i * FW, 0));
    s.save(path.join(OUT_DIR, file));
    return s;
  };
  const a = strip(frames.attack, `${id}_attack.png`);
  const r = strip(frames.run, `${id}_run.png`);
  const stand = frames.attack[0];
  stand.save(path.join(OUT_DIR, `${id}.png`));

  // HP bar sits above the hair: first non-empty row of the standing pose.
  let headTop = 0;
  outer: for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) if (stand.get(x, y)[3]) { headTop = y; break outer; }
  // The hit lands on the attack frame that reaches furthest forward.
  const reach = frames.attack.map(c => { for (let x = FW - 1; x >= 0; x--) for (let y = 0; y < FH; y++) if (c.get(x, y)[3]) return x; return 0; });
  const hitFrame = fixed.hitFrame ?? reach.indexOf(Math.max(...reach));

  const prev = new Canvas(Math.max(a.w, r.w) + 4, a.h + r.h + 6);
  for (let y = 0; y < prev.h; y++) for (let x = 0; x < prev.w; x++) prev.set(x, y, ((x >> 2) + (y >> 2)) % 2 ? [214, 214, 222] : [196, 196, 208]);
  prev.draw(a, 2, 2); prev.draw(r, 2, a.h + 4);
  prev.scaled(5).save(path.join(PREVIEW, `${id}_frames_x5.png`));
  return { id, frame: [FW, FH], feet: [AX, FEET], headTop, run: frames.run.length, attack: frames.attack.length, hitFrame };
}

// Shared with art/bosses/animate.js.
module.exports = { isBg, lum, shrink, N4, OUTLINE };

// Heroes to build: the ones named, or every folder with both sheets.
if (require.main === module) {
  const all = fs.readdirSync(ROOT).filter(d => fs.existsSync(path.join(ROOT, d, 'run_sheet.png')) && fs.existsSync(path.join(ROOT, d, 'attack_sheet.png')));
  const wanted = process.argv.slice(2).length ? process.argv.slice(2) : all;
  const prevAnims = fs.existsSync(ANIMS_TS) ? fs.readFileSync(ANIMS_TS, 'utf8') : '';
  const entries = {};
  for (const m of prevAnims.matchAll(/^  (\w+): (\{.*\}),$/gm)) entries[m[1]] = m[2];
  for (const id of wanted) {
    const h = buildHero(id);
    entries[id] = `{ frame: [${h.frame}], feet: [${h.feet}], headTop: ${h.headTop}, run: ${h.run}, attack: ${h.attack}, hitFrame: ${h.hitFrame} }`;
    console.log(`${id}: ${h.frame[0]}x${h.frame[1]} frames, feet (${h.feet}), ${h.run} run + ${h.attack} attack, hits on frame ${h.hitFrame}`);
  }
  const body = Object.keys(entries).filter(id => all.includes(id)).sort().map(id => `  ${id}: ${entries[id]},`).join('\n');
  fs.writeFileSync(ANIMS_TS, `// Generated by art/heroes/animate.js: don't edit by hand.
// Frame-animated heroes. public/heroes/<id>.png is the standing pose; <id>_run.png and <id>_attack.png are
// strips of equal frames on the same canvas. \`feet\` is the pixel edge that stands on the lane, \`headTop\`
// the first row of hair (for the HP bar), \`hitFrame\` the attack frame that reaches furthest forward.
export interface HeroAnim {
  frame: [number, number];
  feet: [number, number];
  headTop: number;
  run: number;
  attack: number;
  hitFrame: number;
}

export const HERO_ANIMS: Record<string, HeroAnim> = {
${body}
};
`);
}
