// Hayle, Form II run (she flies from this form). The golden trail in the run sheet glues the figures together,
// so the even cut handed frames 2-4 the tip of the neighbour's sword as a loose streak; the 1st figure stands
// upright with no trail and the 5th crouches lower, so the loop jerked and the trail blinked on and off.
// Keep only the figure itself (its largest joined shape) and loop the three matching dash frames 2-3-4-3.
// Outline pixels are dark and join loose bits to the figure at a corner, so shapes are found on the coloured
// pixels only (4-way), then the outline around the kept shape goes back on.
const OUTLINE_LUM = 40;
function keepLargest(c, { FW, FH, Canvas }) {
  const lit = (x, y) => { const p = c.get(x, y); return p[3] > 0 && p[0] + p[1] + p[2] > OUTLINE_LUM * 3; };
  const seen = new Uint8Array(FW * FH);
  let best = [];
  for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
    if (seen[y * FW + x] || !lit(x, y)) continue;
    const shape = [], stack = [[x, y]];
    seen[y * FW + x] = 1;
    while (stack.length) {
      const [px, py] = stack.pop();
      shape.push([px, py]);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = px + dx, ny = py + dy;
        if (nx < 0 || ny < 0 || nx >= FW || ny >= FH || seen[ny * FW + nx] || !lit(nx, ny)) continue;
        seen[ny * FW + nx] = 1;
        stack.push([nx, ny]);
      }
    }
    if (shape.length > best.length) best = shape;
  }
  const keep = new Uint8Array(FW * FH);
  for (const [x, y] of best) keep[y * FW + x] = 1;
  const out = new Canvas(FW, FH);
  for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
    const p = c.get(x, y);
    if (!p[3]) continue;
    let near = keep[y * FW + x];
    if (!near && !lit(x, y))
      for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1 && !near; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < FW && ny < FH && keep[ny * FW + nx]) near = 1;
      }
    if (near) out.set(x, y, p.slice(0, 3), p[3]);
  }
  return out;
}

module.exports = function fix(frames, helpers) {
  const [, a, b, c] = frames.run.map(f => keepLargest(f, helpers));
  frames.run = [a, b, c, b];
};
