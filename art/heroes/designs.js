// Pixel maps for the heroes that aren't frame-animated yet. Each has its own build, height, silhouette,
// face and pose so they read as different people, not one body in different outfits. Rows are drawn from
// the top and shifted down by dy so the feet land on row 30. See sprite.js for the row format.
// Every other hero is frame-animated from sprite sheets via animate.js; remove a hero from this file when
// they get sheets, or heroes.js would overwrite their standing pose.
//
// Dark:  Vex (white hair, orb held at the chest), Dread (spiked helm, tower shield, cape)
// Light: Dawn (lunging sword thrust, cape), Sol (sun headband, running with a golden bow), Aegis (plumed
//        helm, sun kite shield)
const SKIN = ['#ffe0c0', '#f5c69c', '#d79a74'];
const PALE = ['#fff0e8', '#f0d8d0', '#c8a8a8'];
const FACE = { e: '#2e1a16', i: '#ffffff', m: '#8a3a30', r: '#f2a08a' }; // eye, eye light, mouth, blush
const LEATHER = ['#6a4a30', '#4a3020', '#2e1c12'];
const BOOTS = ['#8a5a3a', '#5e3a24', '#3a2416'];
const STEEL = ['#ffffff', '#d8e2ec', '#8a98aa'];
const GOLD = ['#ffe890', '#e8c040', '#a8801c'];
const SILVER = ['#ffffff', '#c8d0dc', '#8a94a4'];
const WOOD = ['#c89a62', '#9a6e3e', '#6a4824'];
const LEAF = ['#a6e070', '#6cbf3a', '#3a7a22'];

// Append a segment to a row (for weapons drawn over the body).
function seg(rows, y, x, letters) {
  rows[y] = `${rows[y] || ''} ${x}:${letters}`.trim();
}
// A 1 px line of one material from (x0, y0) to (x1, y1).
function line(rows, x0, y0, x1, y1, ch) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= n; i++) seg(rows, Math.round(y0 + ((y1 - y0) * i) / n), Math.round(x0 + ((x1 - x0) * i) / n), ch);
}

const H = {
  // ---------------- Fire ----------------
  // ---------------- Earth ----------------
  // ---------------- Water ----------------
  // ---------------- Dark ----------------
  vex: {
    dy: 2,
    rows: {
      4: '11:HHHHHHH',
      5: '9:HHHHHHHHHHH',
      6: '8:HHHHHHHHHHHHH',
      7: '7:HHHHHHHHHHHHHHH',
      8: '7:HHHHHHHHHHSSSSHH',
      9: '7:HHHHHHSSSSSSSSSH',
      10: '6:HHHHHHSSSSSSSSSSH',
      11: '6:HHHHHSSSSSkkSSkkH',
      12: '6:HHHHHSSSSSieSSieH',
      13: '6:HHHHHSSSSSeeSSeeH',
      14: '6:HHHHHSSSSSSSSSSSH',
      15: '6:HHHHHSSSSSSSmmSH',
      16: '6:HHHHH 12:SSSSSS 19:HHHH',
      17: '5:HHHH 9:PPCCCCCCPP 19:HHH',
      18: '5:HHH 8:CCCCCCCCCCCCC',
      19: '5:HH 8:CCCCCCCCCCCC 13:ooo',
      20: '5:H 8:CCCCCCCCCCCC 12:oogoo',
      21: '8:CCCCCCCCCCCC 11:SogoooS',
      22: '8:KKKKKKKKKKKK 12:ooooo',
      23: '7:CCCCCCCCCCCCCC 13:ooo',
      24: '6:CCCCCTTTTTTTCCCC',
      25: '5:CCCCC 11:TT 15:TT 18:CCCC',
      26: '11:TT 15:TT',
      27: '10:OOO 15:OOO',
      28: '10:OOOO 15:OOOO',
    },
    mats: {
      H: ['#ffffff', '#e4e0f0', '#a8a0c0'], k: '#8a6ab8', S: PALE, ...FACE,
      C: ['#5a4078', '#3a2854', '#221836'], P: ['#b07ae0', '#8a4ac0', '#5a2a86'], K: SILVER,
      T: ['#3a3348', '#262230', '#16131c'], O: ['#4a4058', '#2e2838', '#1c1824'],
      o: ['#e0b0ff', '#a060e0', '#5a2a90'], g: '#ffffff',
    },
  },

  dread: {
    dy: 5,
    rows: {
      1: '12:H 15:H 18:H',
      2: '11:HH 14:HH 17:HH 20:H',
      3: '10:HHHHHHHHHHHH',
      4: '9:HHHHHHHHHHHHH',
      5: '9:HHHHHHHHHHHHHH',
      6: '9:HHHHHHHkkkkkkk',
      7: '9:HHHHHHHkvvkkvvk',
      8: '9:HHHHHHHkkkkkkkH',
      9: '9:HHHHHHHHHHHHHH 19:RRRRRRR',
      10: '10:HHHHHHHH 18:RZZZZZZZR',
      11: '11:HHHHHHH 18:RZZZZZZZR',
      12: '5:CCCCC 10:PPPAAAAP 18:RZZZZZZZR',
      13: '4:CCCCCC 10:PAAAAAAA 18:RZZZZZZZR',
      14: '4:CCCCCC 10:AAAAvAAA 18:RZZZvZZZR',
      15: '3:CCCCCCC 10:AAAAAAAA 18:RZZvvvZZR',
      16: '3:CCCCCCC 10:AAAAAAAA 18:RZZZvZZZR',
      17: '3:CCCCCCC 10:KKKKKKKK 18:RZZZvZZZR',
      18: '2:CCCCCCCC 10:AAAAAAAA 18:RZZZZZZZR',
      19: '2:CCCCCCCC 10:AAAA 15:AAA 18:RZZZZZZZR',
      20: '2:C.CC.CCC 11:TTT 16:TT 18:RZZZZZZZR',
      21: '3:C..C 11:TTT 16:TT 18:RZZZZZZZR',
      22: '11:TTT 16:TT 18:RZZZZZZZR',
      23: '11:TTT 16:TT 19:RRRRRRR',
      24: '10:OOOO 16:OOO',
      25: '10:OOOO 16:OOOO',
    },
    mats: {
      H: ['#6a5a8a', '#3e3458', '#221c34'], k: '#0e0a18', v: '#c08aff',
      C: ['#5a3a7a', '#3a2450', '#22142e'], P: ['#7a6a9a', '#4e4468', '#2e2840'], A: ['#5a4e72', '#3a3250', '#221e30'],
      K: SILVER, T: ['#3a3348', '#262230', '#16131c'], O: ['#4a4058', '#2e2838', '#1c1824'],
      Z: ['#4a3a6a', '#2e2446', '#1c162a'], R: ['#a8a0c0', '#7a7090', '#4a4460'],
    },
  },

  // ---------------- Light ----------------
  dawn: {
    dy: 3,
    rows: {
      3: '12:GG 16:GGG',
      4: '10:GGGGGGGGGGG',
      5: '8:GGGGGGGGGGGGGG',
      6: '6:GGGGGGGGGGGGGGGGG',
      7: '5:GGGGGGLGGGGGGGGGGG',
      8: '7:GGGGGGGGGGGGGSSSG',
      9: '6:GGGDGGGGSSSSSSSSSS',
      10: '8:GDGGGSSSSSSSSSSS',
      11: '8:GDDGSSSSieSSieSS',
      12: '8:GDDGSSSSeeSSeeSSS',
      13: '9:DDGSSSSeeSSeeSS',
      14: '9:DGSSSSSrSSSrSS',
      15: '10:GSSSSSSSmmSS',
      16: '4:CC 11:SSSSSSSSS',
      17: '2:CCCCC 9:WWWYYYYWWW',
      18: '1:CCCCCCC 9:WWWWYWWWWWWWWSSY 25:MMMMMMM',
      19: '1:CCCCCC 9:SWWWYWWWW 24:Y 25:MMMMMM',
      20: '2:CCCCC 9:WWWWYWWWW 24:Y',
      21: '2:CCCC 9:KKKKKKKKK',
      22: '3:CCC 9:PPPPPPPPP',
      23: '3:CC 7:PPPP 14:PPPPP',
      24: '5:PPPP 17:PPP',
      25: '3:PPPP 18:PPP',
      26: '1:OOOO 18:OOOO',
      27: '0:OOOO 18:OOOOO',
    },
    mats: {
      G: ['#fff0a0', '#f5d63f', '#b8901c'], L: '#fff8c0', D: '#c09a20', S: SKIN, ...FACE,
      C: ['#8ad4ff', '#3a9ae0', '#1f5a9a'], W: ['#ffffff', '#e6e8ee', '#aab0bc'], Y: GOLD,
      K: LEATHER, P: ['#e8eef8', '#b8c4d8', '#7a88a0'], O: ['#c8a070', '#9a7448', '#6a4c2c'], M: STEEL,
    },
  },

  sol: {
    dy: 4,
    rows: {
      3: '11:GGG 16:GGG',
      4: '9:GGGGGGGGGGGG',
      5: '7:GGGGGGGGGGGGGGGG',
      6: '6:GGGGGLLGGGGGGGGGG 24:WW',
      7: '7:TTTTTTTTTTjTTTTT 26:W',
      8: '7:GGGGGGGGSSSSSSSGG 27:W',
      9: '7:DGGGGGSSSSSSSSSSS 27:W',
      10: '7:DDGGGSSSSieSSieSS 27:W',
      11: '7:DDGGSSSSSeeSSeeSS 27:W',
      12: '8:DGGSSSSSeeSSeeSSS 27:W',
      13: '8:DGSSSSSrSSSSrSS 27:W',
      14: '9:GSSSSSSSmmmSS 27:W',
      15: '10:SSSSSSSSSS 27:W',
      16: '5:CCC 9:YYYYYYYYYY 27:W',
      17: '3:CCCC 8:YYYYTYYYYYYYYYYYYSS',
      18: '2:CCCC 8:SYYYTYYYYY 27:W',
      19: '2:CCC 8:YYYYTYYYYY 27:W',
      20: '3:CC 8:KKKKKKKKKK 26:W',
      21: '8:PPPPPPPPPP 24:WW',
      22: '6:PPPP 14:PPPP',
      23: '4:PPPP 15:PPPP',
      24: '2:OOOO 16:OOOO',
      25: '1:OOOO 16:OOOOO',
    },
    mats: {
      G: ['#fff0a0', '#f5d63f', '#b8901c'], L: '#fff8c0', D: '#c09a20', S: SKIN, ...FACE,
      T: GOLD, j: '#5ac8ff', C: ['#fffbea', '#f2ead0', '#c8bc98'], Y: ['#d8f0ff', '#a8d8f8', '#6aa8d8'],
      K: LEATHER, P: ['#fffbea', '#e8e0c8', '#b0a888'], O: ['#c8a070', '#9a7448', '#6a4c2c'],
      W: ['#ffe890', '#e8b830', '#a07818'],
    },
  },

  aegis: {
    dy: 3,
    rows: {
      1: '12:UUUUU',
      2: '9:UUUUUUUU',
      3: '3:MM 7:UUUU 12:HHHHHH',
      4: '3:MM 6:UUU 10:HHHHHHHHHH',
      5: '3:MM 6:UU 9:HHHHHHHHHHHH',
      6: '3:MM 8:HHHHHHHHHHHHHH',
      7: '3:MM 8:HHHHHHHHHHHHHH',
      8: '3:MM 8:HHHHHHHHYYYYYYY',
      9: '3:MM 8:HHHHHHHSSSSSSSS',
      10: '3:MM 8:HHHHHHSSieSSieS',
      11: '3:MM 8:HHHHHHSSeeSSeeS',
      12: '3:MM 8:HHHHHHSSSSSSSSSS',
      13: '3:MM 8:HHHHHHSSSSSmmSS',
      14: '3:MM 8:HHHHHHHSSSSSSHH',
      15: '3:MM 9:HHHHHHHHHHHHH 20:YYYYYYY',
      16: '3:MM 10:HHHHHHHHHHH 19:YWWWWWWWY',
      17: '1:YYYYYY 7:PPPPP 12:WWWWWW 18:PP 19:YWWWyWWWY',
      18: '2:SSSWWWPPPPWBBBBW 18:PP 19:YWWyyyWWY',
      19: '9:WWWBBBBBBWWW 19:YWyyyyyWY',
      20: '9:WWWBBBBBBWWW 19:YWWyyyWWY',
      21: '9:WWWBBBBBBWWW 19:YWWWyWWWY',
      22: '9:KKKKKKKKKKKK 19:YWWWWWWWY',
      23: '9:WWWWWWWWWWWW 20:YWWWWWY',
      24: '10:WWWW 16:WWWW 20:YWWWWWY',
      25: '10:WWWW 16:WWWW 21:YWWWY',
      26: '9:OOOOO 16:OOOOO 22:YWY',
      27: '9:OOOOO 16:OOOOOO 23:Y',
    },
    mats: {
      U: ['#bfe8ff', '#7ac8f0', '#3a88c0'], H: ['#ffffff', '#e0e4ea', '#a8b0bc'], Y: GOLD, S: SKIN, ...FACE,
      P: ['#fff4c8', '#e8d090', '#b0904a'], W: ['#ffffff', '#e6e8ee', '#aab0bc'], B: ['#8ad4ff', '#3a9ae0', '#1f5a9a'],
      K: GOLD, O: ['#d0c8b8', '#a09888', '#6a6458'], y: '#fff0a0', M: STEEL,
    },
  },
};



module.exports = H;
