// Turns a flat, colour-coded pixel map into a finished sprite: per-material cel shading lit from the
// top left, then a 1 px outline around the silhouette.
//
// Rows are written as segments "col:LETTERS" (several per row, separated by spaces) so each part can
// be placed by column without counting dots. '.' inside a segment leaves a pixel empty.
const { Canvas, hex } = require('../backgrounds/png');

const OUTLINE = '#1a1426';

// Parses { row: 'segments' } into a 2D array of material letters.
function parse(rows, size = 32) {
  const grid = Array.from({ length: size }, () => Array(size).fill(null));
  for (const [r, line] of Object.entries(rows)) {
    for (const seg of line.trim().split(/\s+/)) {
      const [col, letters] = seg.split(':');
      [...letters].forEach((ch, i) => { if (ch !== '.') grid[+r][+col + i] = ch; });
    }
  }
  return grid;
}

// materials: letter -> [light, base, dark] (shaded) or a single colour string (flat, e.g. eyes).
function render(rows, materials, size = 32) {
  const grid = parse(rows, size);
  const at = (x, y) => (x < 0 || y < 0 || x >= size || y >= size ? null : grid[y][x]);
  const c = new Canvas(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const m = at(x, y);
    if (!m) continue;
    const mat = materials[m];
    if (!mat) throw new Error(`no material for '${m}' at ${x},${y}`);
    if (typeof mat === 'string') { c.set(x, y, mat); continue; }
    const [light, base, dark] = mat;
    const litEdge = at(x, y - 1) !== m || at(x - 1, y) !== m;
    const shadeEdge = at(x, y + 1) !== m || at(x + 1, y) !== m;
    c.set(x, y, litEdge && !shadeEdge ? light : shadeEdge && !litEdge ? dark : base);
  }
  // Outline: any empty pixel touching the silhouette (4-neighbour).
  const solid = (x, y) => at(x, y) !== null;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++)
    if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) c.set(x, y, OUTLINE);
  return c;
}

module.exports = { render, parse, OUTLINE, Canvas, hex };
