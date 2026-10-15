// Lumen's two sheets disagree on her hair: the attack sheet gave her a ponytail, the run sheet (and her
// reference art) long flowing hair. Every attack frame gets the last run frame's long-hair head (the
// cleanest match of the five), lined up by her face (see fixes.js).
const { swapHead } = require('../fixes');

module.exports = function fix(frames, helpers) {
  swapHead(frames.attack, frames.run[frames.run.length - 1], helpers);
};
