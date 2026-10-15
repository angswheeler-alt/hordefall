// Shared touch-ups for heroes whose generated sheets disagree on a detail. Used from art/heroes/<id>/fix.js.

// Centre of the face: skin-coloured pixels in the upper half of a frame (hands sit lower or far forward).
function faceCentre(c, { FW, FH }, isSkin) {
  let sx = 0, sy = 0, n = 0;
  for (let y = 0; y < FH / 2; y++) for (let x = 0; x < FW; x++) if (isSkin(c.get(x, y))) { sx += x; sy += y; n++; }
  return n ? { x: Math.round(sx / n), y: Math.round(sy / n) } : null;
}

const defaultSkin = p => p[3] && p[0] > 215 && p[1] > 160 && p[2] > 115 && p[0] - p[2] > 45 && p[0] - p[1] < 70;

/**
 * Give every frame in `targets` the head (and hair) of `donor`, lined up by the face. `clear` wipes the
 * old hair behind the head first; `box` is the donor region to copy, relative to its face centre.
 */
function swapHead(targets, donor, helpers, {
  box = { left: 19, right: 5, up: 15, down: 8 },
  clear = { behind: 8, up: 13, down: 6 },
  isSkin = defaultSkin,
} = {}) {
  const { FW, FH } = helpers;
  const d = faceCentre(donor, helpers, isSkin);
  if (!d) return;
  for (const c of targets) {
    const f = faceCentre(c, helpers, isSkin);
    if (!f) continue;
    for (let y = f.y - clear.up; y <= f.y + clear.down; y++) for (let x = 0; x < f.x - clear.behind; x++) c.set(x, y, [0, 0, 0], 0);
    for (let y = d.y - box.up; y <= d.y + box.down; y++) for (let x = d.x - box.left; x <= d.x + box.right; x++) {
      const p = donor.get(x, y);
      if (!p[3]) continue;
      const tx = x - d.x + f.x, ty = y - d.y + f.y;
      if (tx >= 0 && ty >= 0 && tx < FW && ty < FH) c.set(tx, ty, p.slice(0, 3));
    }
  }
}

module.exports = { swapHead, faceCentre };
