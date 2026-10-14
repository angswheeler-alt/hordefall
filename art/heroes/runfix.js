// Helpers for run sheets whose frames all show the same stride (the generator drew one pose five times,
// so the legs never move). makeRunCycle turns them into stride / passing / stride / passing: on passing
// frames the legs are pulled in together under the hips and the figure lifts 1 px, so the legs pump.
// Use from a hero's fix.js: frames.run = makeRunCycle(frames.run, { hip: 0.72 }, helpers).

// Pull the legs together: below the hip line, columns squeeze toward the legs' centre, more toward the
// feet (factor `squeeze` at the bottom row), sampling the original frame.
function passingFrame(src, { FW, FH, Canvas }, hipFrac, squeeze) {
  const hipY = Math.round(FH * hipFrac);
  let sx = 0, n = 0;
  for (let y = hipY; y < FH; y++) for (let x = 0; x < FW; x++) if (src.get(x, y)[3]) { sx += x; n++; }
  const cx = n ? sx / n : FW / 2;
  const out = new Canvas(FW, FH);
  for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
    let srcX = x;
    if (y >= hipY) {
      const t = (y - hipY) / Math.max(1, FH - 1 - hipY); // 0 at the hips, 1 at the feet
      const k = 1 - (1 - squeeze) * t;
      srcX = Math.round(cx + (x - cx) / k);
    }
    const p = srcX >= 0 && srcX < FW ? src.get(srcX, y) : [0, 0, 0, 0];
    // Lift 1 px: draw one row higher.
    if (p[3] && y - 1 >= 0) out.set(x, y - 1, p.slice(0, 3));
  }
  return out;
}

function makeRunCycle(run, helpers, { hip = 0.72, squeeze = 0.45 } = {}) {
  const a = run[0], b = run[Math.min(2, run.length - 1)];
  return [a, passingFrame(run[1] || a, helpers, hip, squeeze), b, passingFrame(run[3] || b, helpers, hip, squeeze)];
}

module.exports = { makeRunCycle, passingFrame };
