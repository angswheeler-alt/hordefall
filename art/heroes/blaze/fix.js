// Flare's axe reaches furthest while raised over his head, but the blow lands on frame 2 (the slam).
module.exports = function fix() {
  return { hitFrame: 2 };
};
