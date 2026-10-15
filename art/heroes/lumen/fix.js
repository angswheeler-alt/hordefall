const { swapHead } = require('../fixes');

// Lumen's attack sheet drew her hair differently from her run sheet; give the attack frames the run head.
module.exports = function fix(frames, helpers) {
  swapHead(frames.attack, frames.run[frames.run.length - 1], helpers, {
    isHair: p => p[0] > p[1] && p[1] > p[2] && p[0] - p[2] > 60, // golden hair, not the white robe
  });
};
