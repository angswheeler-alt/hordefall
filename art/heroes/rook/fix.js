// Rook's run sheet repeats one stride, so his legs never moved. Build a cycle where the legs come
// together on the passing frames (see runfix.js).
const { makeRunCycle } = require('../runfix');

module.exports = function fix(frames, helpers) {
  frames.run = makeRunCycle(frames.run, helpers, { hip: 0.7 });
};
