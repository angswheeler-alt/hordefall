// Cuts generated three-row hero sheets (standing pose, attack, run) into art/heroes/<id>/reference.png,
// attack_sheet.png and run_sheet.png for animate.js.
// Run: node art/heroes/split.js <folder of PNG sheets> <file=id>...   e.g. CaptainMorrow=morrow
// (the sheets are the generator's JPGs saved as 32-bit PNGs, which art/backgrounds/png.js can read)
// Each sheet is checked: three rows, one figure on top, and it reports how many frames the other two rows hold.
const fs = require('fs');
const path = require('path');
const { readPNG, Canvas } = require('../backgrounds/png');
const { isBg } = require('./animate');

const [dir, ...pairs] = process.argv.slice(2);

// Bands of rows with art in them (at least 3 non-magenta pixels), taller than 40 px.
function bands(img, axis, from = 0, to = axis === 'y' ? img.h : img.w, across = [0, axis === 'y' ? img.w : img.h]) {
  const filled = [];
  for (let i = from; i < to; i++) {
    let n = 0;
    for (let j = across[0]; j < across[1]; j++) if (!isBg(axis === 'y' ? img.get(j, i) : img.get(i, j))) n++;
    filled.push(n >= 3);
  }
  const out = [];
  for (let i = 0; i < filled.length; i++) {
    if (!filled[i]) continue;
    const s = i;
    while (i < filled.length && filled[i]) i++;
    out.push([from + s, from + i]);
  }
  return out;
}

for (const pair of pairs) {
  const [file, id] = pair.split('=');
  const img = readPNG(path.join(dir, `${file}.png`));
  const rows = bands(img, 'y').filter(([a, b]) => b - a > 40);
  // A raised weapon can join the standing pose to the attack row: cut the tallest band at its emptiest row.
  if (rows.length === 2) {
    const i = rows[0][1] - rows[0][0] > rows[1][1] - rows[1][0] ? 0 : 1, [a, b] = rows[i];
    let cut = -1, least = Infinity;
    for (let y = a + Math.round((b - a) * 0.3); y < b - Math.round((b - a) * 0.3); y++) {
      let n = 0;
      for (let x = 0; x < img.w; x++) if (!isBg(img.get(x, y))) n++;
      if (n < least) { least = n; cut = y; }
    }
    rows.splice(i, 1, [a, cut], [cut + 1, b]);
  }
  // Frames in a row: column bands at least 15 px wide, merging gaps under 6 px (a bowstring, a sparkle).
  const frames = ([y0, y1]) => {
    const cols = bands(img, 'x', 0, img.w, [y0, y1]);
    const merged = [];
    for (const c of cols) if (merged.length && c[0] - merged[merged.length - 1][1] < 6) merged[merged.length - 1][1] = c[1]; else merged.push([...c]);
    return merged.filter(([a, b]) => b - a >= 15).length;
  };
  const counts = rows.map(frames);
  const note = rows.length !== 3 ? `  <-- ${rows.length} rows` : counts[0] !== 1 ? '  <-- top row is not one figure' : '';
  console.log(`${id} (${file}): rows ${rows.map(([a, b]) => `${a}-${b}`).join(' ')}, frames ${counts.join('/')}${note}`);
  if (rows.length !== 3) continue;
  const out = path.join(__dirname, id);
  fs.mkdirSync(out, { recursive: true });
  ['reference', 'attack_sheet', 'run_sheet'].forEach((name, i) => {
    const [y0, y1] = rows[i];
    const top = Math.max(0, y0 - 8), h = Math.min(img.h, y1 + 8) - top;
    const c = new Canvas(img.w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < img.w; x++) c.set(x, y, img.get(x, top + y).slice(0, 3));
    c.save(path.join(out, `${name}.png`));
  });
  // Tells animate.js both sheets came from one image, so the run keeps the attack's scale.
  fs.writeFileSync(path.join(out, 'split.json'), `${JSON.stringify({ from: `${file}.jpg` })}\n`);
}
