// Builds every region and a contact sheet of the five test screens.
// Run: node art/backgrounds/build.js  (writes public/bg/*.png and preview images)
const path = require('path');
const L = require('./lib');
for (const r of ['tidecoast', 'dunes', 'stormcrag', 'emberwastes', 'hollowmoon']) require('./' + r)();
const sheet = new L.Canvas(L.W * 2 + 8, 300 * 3 + 16);
sheet.rect(0, 0, sheet.w, sheet.h, '#000000');
L.SCREENS.forEach((s, i) => sheet.draw(s, (i % 2) * (L.W + 8), Math.floor(i / 2) * 308));
sheet.scaled(2).save(path.join(L.OUT, 'all_regions_x2.png'));
console.log('built', L.SCREENS.length, 'regions');
