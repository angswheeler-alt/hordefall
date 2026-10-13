// The five starting heroes as 32x32 sprites (feet on row 30, facing right).
// Run: node art/heroes/heroes.js  -> public/heroes/<id>.png plus previews in art/heroes/preview.
const path = require('path');
const { render, Canvas } = require('./sprite');

const HEROES = require('./designs');

const OUT = path.join(__dirname, '..', '..', 'public', 'heroes');
const PREVIEW = path.join(__dirname, 'preview');
const sprites = {};
for (const [id, h] of Object.entries(HEROES)) {
  sprites[id] = render(h.rows, h.mats, h.dy || 0);
  sprites[id].save(path.join(OUT, `${id}.png`));
}

// Lineup on a checkerboard at 8x so details are easy to judge.
const ids = Object.keys(sprites);
const sheet = new Canvas(ids.length * 36 + 4, 40);
for (let y = 0; y < sheet.h; y++) for (let x = 0; x < sheet.w; x++) sheet.set(x, y, ((x >> 2) + (y >> 2)) % 2 ? '#d8d8e0' : '#c4c4d0');
ids.forEach((id, i) => sheet.draw(sprites[id], 4 + i * 36, 4));
sheet.scaled(8).save(path.join(PREVIEW, 'lineup_x8.png'));
// The heroes standing in each region's lane, as the player would see them.
const { readPNG } = require('../backgrounds/png');
const BG = path.join(__dirname, '..', '..', 'public', 'bg');
const regions = ['tidecoast', 'dunes', 'stormcrag', 'emberwastes', 'hollowmoon'];
const scenes = regions.map(r => {
  const c = new Canvas(480, 300);
  c.draw(readPNG(path.join(BG, `${r}_sky.png`)), 0, 0);
  c.draw(readPNG(path.join(BG, `${r}_far.png`)), 0, -10);
  c.draw(readPNG(path.join(BG, `${r}_ground.png`)), 0, 170);
  ids.forEach((id, i) => c.draw(sprites[id], 70 + i * 70, 185 + (i % 3) * 25 - 30));
  c.scaled(3).save(path.join(PREVIEW, `${r}_x3.png`));
  return c;
});
const all = new Canvas(480 * 2 + 8, 300 * 3 + 16);
all.rect(0, 0, all.w, all.h, '#000000');
scenes.forEach((s, i) => all.draw(s, (i % 2) * 488, Math.floor(i / 2) * 308));
all.scaled(2).save(path.join(PREVIEW, 'all_regions_x2.png'));
module.exports = sprites;
console.log('heroes:', ids.join(', '));
