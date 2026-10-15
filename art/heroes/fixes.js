// Shared touch-ups for heroes whose generated sheets disagree on a detail. Used from art/heroes/<id>/fix.js.

// Crown of the head. Find the first row wide enough to be the head (a staff ornament or wand is narrower),
// then climb up from its middle to the topmost row still joined to it. Returns that row and its centre.
function crown(c, { FW, FH, scale = 1 }, headWidth = Math.round(16 * scale)) {
  const runs = y => { const out = []; let start = -1; for (let x = 0; x <= FW; x++) { const on = x < FW && c.get(x, y)[3]; if (on && start < 0) start = x; if (!on && start >= 0) { out.push([start, x - 1]); start = -1; } } return out; };
  for (let y = 0; y < FH; y++) {
    const wide = runs(y).find(([a, b]) => b - a + 1 >= headWidth);
    if (!wide) continue;
    let cx = Math.round((wide[0] + wide[1]) / 2), top = y;
    for (let yy = y - 1; yy >= 0; yy--) {
      const r = runs(yy).find(([a, b]) => a <= cx + 3 && b >= cx - 3);
      if (!r) break;
      top = yy; cx = Math.max(r[0], Math.min(r[1], cx));
    }
    const r = runs(top).find(([a, b]) => a <= cx && b >= cx);
    return { x: Math.round((r[0] + r[1]) / 2), y: top };
  }
  return null;
}

/**
 * Give every frame in `targets` the head (and hair) of `donor`, lined up by the crown. Inside `box`
 * (relative to the crown) the target's old head is wiped and the donor's pasted whole, so no old face or
 * hair pokes out; under the face it reaches down to `chin` so an old chin can't hang below the new one.
 * In `tail` (long hair hanging down the back) donor hair is only laid on top. Loose specks of fewer than
 * `speck` pixels left around the head afterwards are removed. Sizes are at size 1 and scale with the hero.
 * `skip(x, y)` keeps target pixels that sit in the box but aren't head, such as a hand on a staff.
 */
function swapHead(targets, donor, helpers, {
  box = { left: 16, right: 10, up: 1, down: 13, chin: 17 },
  tail = { left: 16, right: -4, down: 19 },
  isHair = () => true,
  skip = () => false,
  speck = 6,
} = {}) {
  const { FW, FH, scale: s = 1 } = helpers;
  const sc = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v * s)]));
  box = sc(box); tail = sc(tail);
  const d = crown(donor, helpers);
  if (!d) return;
  for (const c of targets) {
    const t = crown(c, helpers);
    if (!t) continue;
    const put = (x, y, p) => { const tx = x - d.x + t.x, ty = y - d.y + t.y; if (tx >= 0 && ty >= 0 && tx < FW && ty < FH) c.set(tx, ty, p.slice(0, 3)); };
    const inBox = (dx, dy) => dx >= -box.left && dx <= box.right && dy >= -box.up && (dy <= box.down || (dx >= 0 && dx <= Math.round(7 * s) && dy <= box.chin));
    for (let y = t.y - box.up; y <= t.y + box.chin; y++) for (let x = t.x - box.left; x <= t.x + box.right; x++)
      if (inBox(x - t.x, y - t.y) && !skip(x - t.x, y - t.y, c.get(x, y))) c.set(x, y, [0, 0, 0], 0);
    for (let y = d.y - box.up; y <= d.y + tail.down; y++) for (let x = d.x - box.left; x <= d.x + box.right; x++) {
      const p = donor.get(x, y);
      if (!p[3]) continue;
      if (inBox(x - d.x, y - d.y)) put(x, y, p);
      else if (x - d.x <= tail.right && x - d.x >= -tail.left && isHair(p)) put(x, y, p);
    }
    clearSpecks(c, helpers, speck, [t.x - box.left - 4, t.y - box.up - 4, t.x + box.right + 4, t.y + tail.down + 2]);
  }
}

// Delete 8-connected bits of fewer than `min` pixels that lie entirely inside the [x0, y0, x1, y1] area.
function clearSpecks(c, { FW, FH }, min, [x0, y0, x1, y1]) {
  const seen = new Set();
  for (let y = Math.max(0, y0); y <= Math.min(FH - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(FW - 1, x1); x++) {
    if (!c.get(x, y)[3] || seen.has(y * FW + x)) continue;
    const blob = [], stack = [[x, y]];
    seen.add(y * FW + x);
    while (stack.length && blob.length < min) {
      const [px, py] = stack.pop();
      blob.push([px, py]);
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
        const nx = px + a, ny = py + b;
        if (nx < 0 || ny < 0 || nx >= FW || ny >= FH || seen.has(ny * FW + nx) || !c.get(nx, ny)[3]) continue;
        seen.add(ny * FW + nx); stack.push([nx, ny]);
      }
    }
    if (blob.length < min && blob.every(([px, py]) => px >= x0 && px <= x1 && py >= y0 && py <= y1)) for (const [px, py] of blob) c.set(px, py, [0, 0, 0], 0);
  }
}

module.exports = { swapHead, crown };
