// Lumen's two sheets disagree on her hair: the attack sheet gave her a ponytail, the run sheet (and her
// reference art) long flowing hair. This gives every attack frame the run cycle's long-hair head: the
// ponytail behind her head is cleared, then the first run frame's head and hair are pasted on, lined up
// by the face (skin pixels), which, unlike the top of the figure, the raised staff never confuses.
const { makeRunCycle } = require('../runfix');

module.exports = function fix(frames, helpers) {
  const { FW, FH } = helpers;
  const isSkin = p => p[3] && p[0] > 215 && p[1] > 160 && p[2] > 115 && p[0] - p[2] > 45 && p[0] - p[1] < 70;
  // Centre of the face: skin pixels in the upper half of the frame (hands sit lower or far forward).
  const face = c => {
    let sx = 0, sy = 0, n = 0;
    for (let y = 0; y < FH / 2; y++) for (let x = 0; x < FW; x++) if (isSkin(c.get(x, y))) { sx += x; sy += y; n++; }
    return { x: Math.round(sx / n), y: Math.round(sy / n) };
  };
  const donor = frames.run[0];
  const d = face(donor);
  const BOX = { left: 19, right: 5, up: 15, down: 8 }; // head and back hair around the face centre
  for (const c of frames.attack) {
    const f = face(c);
    // Clear the ponytail: everything behind the head, at head height.
    for (let y = f.y - 13; y <= f.y + 6; y++) for (let x = 0; x < f.x - 8; x++) c.set(x, y, [0, 0, 0], 0);
    // Paste the long-hair head.
    for (let y = d.y - BOX.up; y <= d.y + BOX.down; y++) for (let x = d.x - BOX.left; x <= d.x + BOX.right; x++) {
      const p = donor.get(x, y);
      if (!p[3]) continue;
      const tx = x - d.x + f.x, ty = y - d.y + f.y;
      if (tx >= 0 && ty >= 0 && tx < FW && ty < FH) c.set(tx, ty, p.slice(0, 3));
    }
  }
  // Her run sheet repeats one stride; build a cycle where the legs come together on the passing frames.
  frames.run = makeRunCycle(frames.run, helpers, { hip: 0.8 });
};
