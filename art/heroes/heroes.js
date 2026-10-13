// The five starting heroes as 32x32 sprites (feet on row 30, facing right).
// Run: node art/heroes/heroes.js  -> public/heroes/<id>.png plus previews in art/heroes/preview.
const path = require('path');
const { render, Canvas } = require('./sprite');

const SKIN = ['#ffe0c0', '#f5c69c', '#d79a74'];
const FACE = { e: '#1a1426', i: '#ffffff', m: '#b0604a' };

const HEROES = {
  marin: {
    rows: {
      3: '12:H 16:H 19:H',
      4: '11:HH 14:HHH 18:HH',
      5: '10:HHLLLHHHHHH',
      6: '9:HHLLLHHHHHHHH',
      7: '8:HHHLLHHHHHHHHH',
      8: '8:HHHHHHHHHHHHHHH',
      9: '8:HHHHHHHHHSSSSHH',
      10: '8:DHHHHHHSSSSSSSS',
      11: '8:DDHHHHSSSSieSS',
      12: '9:DDHHHSSSSeeSSS',
      13: '9:DDHHSSSSSSSSS 28:M',
      14: '10:DDHSSSSSSSmS 28:M',
      15: '11:DHSSSSSSSS 27:MM',
      16: '13:SSSSSSS 27:MM',
      17: '8:WWWWWWWWWWWW 26:MM',
      18: '6:WWW 12:WWBBBBWW 26:MM',
      19: '5:WW 11:BVVVBBBBVVB 25:MM',
      20: '10:BBVVVBBBBVVBB 23:GMM',
      21: '10:BBVVVBBBBVVSSG',
      22: '10:SSVVVBBBBVV 23:G',
      23: '12:KKKKKKKKK',
      24: '12:TTTTTTTTT',
      25: '12:TTTT 17:TTTT',
      26: '12:TTT 17:TTT',
      27: '12:OOO 17:OOO',
      28: '12:OOO 17:OOO',
      29: '11:OOOO 17:OOOOO',
    },
    mats: {
      H: ['#8fd6ff', '#3fa9f5', '#2470b8'], L: '#b4e6ff', D: '#2266aa', S: SKIN, ...FACE,
      W: ['#ffffff', '#e8ecf4', '#b8c0d0'], B: ['#7cc8ff', '#3fa9f5', '#2a6fb0'],
      V: ['#c8884e', '#a0663a', '#6e4224'], K: ['#6a4a30', '#4a3020', '#2e1c12'],
      T: ['#5a6e9a', '#3e4e78', '#2a3454'], O: ['#8a5a3a', '#5e3a24', '#3a2416'],
      G: ['#a8e0ff', '#3fa9f5', '#1e5a9a'], M: ['#ffffff', '#d8e2ec', '#8a98aa'],
    },
  },
  pyra: {
    rows: {
      1: '12:Y 17:Y',
      2: '12:F 15:Y 17:F 20:Y',
      3: '11:FF 14:FF 17:FF 20:F',
      4: '10:FFFFFFFFFFFF',
      5: '9:FFFYFFFFFFFFF',
      6: '8:FFFFFFFFFFFFFF',
      7: '8:FFFFFFFFFFFFFFF',
      8: '8:FFFFFFFFFFFFFFF',
      9: '7:FFFFFFFFFFSSSSF',
      10: '6:FFDFFFFFFSSSSSSSS',
      11: '6:FFDDFFFFSSSSieSS',
      12: '6:FFFDDFFFSSSSeeSSS',
      13: '6:FFFDDFFSSSSSSSSS',
      14: '7:FFFDDFSSSSSSSmS 24:a',
      15: '7:FFFFDFSSSSSSSS 23:aba',
      16: '7:FFF 13:SSSSSSS 22:abcba',
      17: '7:FFCCCCRRRRRRRR 22:abcba',
      18: '8:CCCCRRRRRRRR 23:aba',
      19: '8:CCCRRRRRRRRRR',
      20: '7:CCCRRRRRRRRRRRR',
      21: '7:CCCRRRRRRRRRRSS',
      22: '7:CCC 10:SKKPKKKKPK',
      23: '8:CC 11:RRRRRRRRR',
      24: '11:RRRRRRRRRR',
      25: '11:RRRRRRRRRR',
      26: '12:TT 17:TT',
      27: '12:OOO 17:OOO',
      28: '12:OOO 17:OOO',
      29: '11:OOOO 17:OOOOO',
    },
    mats: {
      F: ['#ffb070', '#f5603f', '#b83a24'], Y: '#ffd27a', D: '#9a2a1a', S: SKIN, ...FACE,
      C: ['#a83a3a', '#7a2626', '#4e1818'], R: ['#7a6a72', '#5a4a52', '#3a2e36'],
      K: ['#6a4a30', '#4a3020', '#2e1c12'], P: ['#e0b880', '#c8a070', '#8a6a44'],
      T: ['#4a3e46', '#3a2e36', '#2a2028'], O: ['#8a5a3a', '#5e3a24', '#3a2416'],
      a: '#ff7a2a', b: '#ffc040', c: '#fff0a0',
    },
  },
  bramble: {
    rows: {
      4: '11:NN 15:N',
      5: '10:HHHHHHHHHH',
      6: '9:HHHHHHHHHHHH',
      7: '8:HHNHHHHHHHHHH',
      8: '8:HHHHHHHHHHHHHH',
      9: '8:HHHHHHHHSSSSSS',
      10: '8:HHHHHHSSSHHHSS',
      11: '8:HHHHHSSSSSeeSSS',
      12: '9:HHHBBBSSSSSSSS',
      13: '9:HHBBBBBBBBBBB',
      14: '4:Z 10:HBBBBBBBBBBB',
      15: '4:ZZ 10:BBBBBBBBBBB',
      16: '5:ZZ 11:BBBBBBBBB',
      17: '5:ZZ 10:AABBBBBBBAA 19:WWWW',
      18: '6:ZZ 9:AAAABBBBBA 18:WWWWWW',
      19: '6:ZZ 9:AANAABBBA 17:WWQQQQWW',
      20: '7:ZZ 9:AAAAAABA 17:WQWWWWQW',
      21: '7:ZZAAAAANAA 17:WQWXXWQW',
      22: '7:GSSAAAAAAA 17:WQWWWWQW',
      23: '11:KKKKKK 17:WWQQQQWW',
      24: '11:AANAAAA 18:WWWWWW',
      25: '11:TTTT 16:TTT 19:WWWW',
      26: '11:TTT 16:TTTT',
      27: '11:OOO 16:OOO',
      28: '11:OOO 16:OOO',
      29: '10:OOOO 16:OOOOO',
    },
    mats: {
      H: ['#ffffff', '#e4e4dc', '#b0b0a4'], B: ['#f0f4e4', '#d4dcc4', '#9aa48a'], N: '#6cbf3a', S: SKIN, ...FACE,
      A: ['#a07a52', '#7a5a3a', '#4e3a24'], W: ['#9ad86a', '#6cbf3a', '#3f7a2a'], Q: '#4a8a2e', X: '#8a6a3a',
      Z: ['#e0bc86', '#b08850', '#7a5a30'], G: '#5a3a24',
      K: ['#6a4a30', '#4a3020', '#2e1c12'], T: ['#6a7a4a', '#4e5e34', '#344020'], O: ['#8a5a3a', '#5e3a24', '#3a2416'],
    },
  },
  nox: {
    rows: {
      4: '12:UUUU',
      5: '10:UUUUUUUU',
      6: '9:UUUUUUUUUUU',
      7: '8:UUUUUUUUUUUUU',
      8: '8:UUUUUUUUUUUUUU',
      9: '7:UUUUUUUUUUuuuuU',
      10: '7:UUUUUUUUuSSSSSU',
      11: '7:UUUUUUUuSSSieSU',
      12: '7:UUUUUUUuSSSeeSSS',
      13: '7:UUUUUUuXXXXXXXX',
      14: '8:UUUUUuXXXXXXXX',
      15: '8:UUUUUXXXXXXX',
      16: '9:UUUUUXXXXX',
      17: '8:UUUUUUUUUUUU',
      18: '8:UUUULLLLLLUU',
      19: '10:LLLLLLLLLLL',
      20: '10:LLLLLLLLLLLL 22:G 23:MMM',
      21: '10:LLLLLLLLLLSSGMMMM',
      22: '10:SSLLLLLLLL 22:G',
      23: '9:M 11:PYPKKKKKKK',
      24: '9:M 10:PPPPLLLLLL',
      25: '9:M 10:PPP 16:LLLL',
      26: '11:LLL 16:LLL',
      27: '11:OOO 16:OOO',
      28: '11:OOO 16:OOO',
      29: '10:OOOO 16:OOOOO',
    },
    mats: {
      U: ['#c08ae8', '#9b59d0', '#6a3a9a'], u: '#2e1e40', S: SKIN, ...FACE,
      X: ['#4a4058', '#342c40', '#201a2a'], L: ['#5a5464', '#403a4a', '#2a2632'],
      K: ['#6a4a30', '#4a3020', '#2e1c12'], P: ['#c8a070', '#9a7448', '#6a4c2c'], Y: '#ffd84a',
      G: '#3a2e36', M: ['#ffffff', '#d8e2ec', '#8a98aa'], O: ['#5a4a5a', '#3e3242', '#28202c'],
    },
  },
  solenne: {
    rows: {
      5: '10:GGGGGGGGG',
      6: '9:GGGGGGGGGGG 23:ZZZ',
      7: '8:GGGGGGGGGGGGG 23:Z 26:Q',
      8: '8:GGGGGGGGGGGGGG 23:Z 25:QQQ',
      9: '8:GGGGGGGGGSSSSG 23:ZQYYYQ',
      10: '8:DGGGGGGSSSSSSSS 23:ZQYYYQ',
      11: '8:DDGGGGSSSSieSS 23:ZQYYYQ',
      12: '7:GGDDGGGSSSSeeSSS 23:Z 25:QQQ',
      13: '6:GG 9:DDGGSSSSSSSSS 23:Z',
      14: '6:GG 10:DDGSSSSSSSmS 23:Z',
      15: '5:GG 11:DGSSSSSSSS 23:Z',
      16: '5:GG 13:SSSSSSS 23:Z',
      17: '5:GG 10:WWWTTTTTWWW 23:Z',
      18: '6:G 9:WWWWWTWWWWWW 23:Z',
      19: '9:WWWWWWTWWWWWW 23:Z',
      20: '9:WWWWWWTWWWWWW 23:Z',
      21: '9:WWWWWWTWWWWSSSZ',
      22: '9:SSWWWWTWWWW 23:Z',
      23: '10:TTTTTTTTTT 23:Z',
      24: '10:WWWWWTWWWWW 23:Z',
      25: '10:WWWWWTWWWWWW 23:Z',
      26: '10:WWWWWTWWWWWW 23:Z',
      27: '10:TTTTTTTTTTTT 23:Z',
      28: '11:OOO 17:OOO 23:Z',
      29: '11:OOO 17:OOOO 23:Z',
    },
    mats: {
      G: ['#ffe890', '#f5d63f', '#c09a20'], D: '#b08a1c', S: SKIN, ...FACE,
      W: ['#fffbea', '#f2ead0', '#c8bc98'], T: ['#ffe890', '#e8c040', '#a8801c'],
      Z: ['#c89a62', '#9a6e3e', '#6a4824'], Q: ['#ffe28a', '#d0a040', '#8a6420'], Y: '#fff4c0',
      O: ['#c8a070', '#9a7448', '#6a4c2c'],
    },
  },
};

const OUT = path.join(__dirname, '..', '..', 'public', 'heroes');
const PREVIEW = path.join(__dirname, 'preview');
const sprites = {};
for (const [id, h] of Object.entries(HEROES)) {
  sprites[id] = render(h.rows, h.mats);
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
