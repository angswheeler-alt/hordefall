// Fern's attack sheet came out without the leaf cap she wears in her run sheet and portrait. Paint one on:
// overlapping leaves over the crown and down to the brow, in the cap's own greens.
const OUT = [30, 22, 40];
const GREENS = [[217, 247, 106], [200, 222, 40], [138, 200, 40], [111, 182, 50], [80, 157, 53], [49, 129, 52]];
const VEIN = [26, 92, 54];
const isHair = p => p[3] && p[0] > p[1] && p[1] > p[2] && p[0] - p[2] > 40 && p[0] + p[1] + p[2] >= 150 && p[0] + p[1] + p[2] <= 420; // brown, not the pink flowers

// Leaf centres relative to the cap's centre: a crown row and a lower row that hangs over the hair.
const LEAVES = [[-6, -4, 3.4], [-1, -6, 3.4], [4, -4, 3.2], [-10, 1, 3], [-5, 0, 3.2], [0, -1, 3.2], [5, 0, 2.8]];

module.exports = function fix(frames, { FW }) {
  for (const f of frames.attack) {
    // Rows of the head: at least 3 hair pixels side by side (the wand is thinner than that).
    const span = y => { let best = null, run = 0; for (let x = 0; x < FW; x++) { run = isHair(f.get(x, y)) ? run + 1 : 0; if (run >= 3) best = x; } return best; };
    let top = -1;
    for (let y = 0; y < 50 && top < 0; y++) if (span(y) !== null) top = y;
    if (top < 0) continue;
    let front = 0;
    for (let y = top; y < top + 5; y++) front = Math.max(front, span(y) ?? 0);
    const cx = front - 6, cy = top + 3;

    const owner = new Map(); // pixel -> index of the leaf it belongs to
    for (let y = cy - 10; y <= cy + 5; y++) for (let x = cx - 14; x <= cx + 9; x++) {
      const dx = x - cx, dy = y - cy;
      const rim = dx > 2 ? 0 : dx > -4 ? 2 : 4; // the cap's lower edge: up off the brow, down over the back
      if (dy > rim) continue;
      let bi = -1, bd = 1;
      LEAVES.forEach(([lx, ly, r], i) => { const d = ((dx - lx) ** 2 + (dy - ly) ** 2) / (r * r); if (d < bd) { bd = d; bi = i; } });
      if (bi >= 0) owner.set(`${x},${y}`, bi);
    }
    for (const [k, i] of owner) {
      const [x, y] = k.split(',').map(Number);
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => owner.get(`${x + a},${y + b}`));
      let col;
      if (nb.some(n => n === undefined)) col = OUT;
      else if (nb.some(n => n !== i && LEAVES[n][1] < LEAVES[i][1])) col = VEIN; // a leaf's top edge where it overlaps the one behind
      else {
        const [lx, ly] = LEAVES[i];
        const t = y - cy - ly + 0.4 * (x - cx - lx); // lit from the upper left
        col = GREENS[Math.max(0, Math.min(5, Math.round(1 + t / 1.8 + (ly > -2 ? 0.7 : 0))))];
      }
      f.set(x, y, col);
    }
  }
};
