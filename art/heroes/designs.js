// Hero designs, 48x48, feet on row 45, facing right, built from shapes (see doll.js).
// Art direction (from the concept sheet): stylized heroic fantasy, about 3.3 heads tall, expressive
// faces, slightly oversized weapons, armour and robes with gold trim, element-coloured hair and gear.
// Each hero shows their role through pose, face, gear and silhouette; common rarity means no glow
// effects beyond the element's own fire/light. Concept matches:
//   Marin = Tide Knight look, Pyra = Ember Arcanist, Bramble = Thorn Sentinel,
//   Nox = Shadow Blade, Solenne = Radiant Cleric.
const { Doll, material: M } = require('./doll');

const flat = c => M([c, c, c], { flat: true });
const SKIN = M(['#ffe2c4', '#f5c69c', '#cf8e6a']);
const FACE = { e: flat('#2e1a16'), i: flat('#ffffff'), m: flat('#7a2e28'), r: flat('#f29a86'), w: flat('#ffffff') };
const STEEL = M(['#ffffff', '#cfd9e4', '#7a889a'], { gloss: true });
const GOLD = M(['#ffe58a', '#d6a833', '#8a6416'], { gloss: true });
const LEATHER = M(['#8a6440', '#5e4026', '#3a2614']);

// Two-eyed face looking right. (x, y) is the top-left of the near eye; the far eye sits `gap` px right.
function eyes(d, x, y, gap = 4, h = 3) {
  for (const ex of [x, x + gap]) {
    const px = [];
    for (let k = 0; k < h; k++) px.push([ex, y + k], [ex + 1, y + k]);
    d.pixels(px, 'e');
    d.pixels([[ex, y]], 'i');
  }
}

module.exports = {
  // Water blademaster in Tide Knight colours: blue plate with gold trim, navy cape, oversized broadsword.
  marin(d = new Doll()) {
    d.poly([[20, 18], [10, 21], [5, 36], [11, 33], [14, 38], [19, 30]], 'C'); // cape
    d.limb(20, 21, 16, 26, 2.3, 2, 'A').limb(16, 26, 13, 29, 2, 1.8, 'g').ellipse(12.5, 29.5, 2, 2, 'g'); // back arm
    d.limb(21, 31, 17, 37, 3, 2.7, 'T').limb(17, 37, 14, 42, 2.6, 2.4, 'A').ellipse(13, 43.5, 3.6, 2.1, 'g'); // back leg
    d.poly([[20, 19], [29, 20], [28, 30], [20, 31]], 'A'); // chest plate
    d.limb(20.5, 19.6, 28.5, 20.2, 0.8, 0.8, 'Y').limb(24.6, 21, 24.4, 29.5, 0.6, 0.6, 'Y'); // gold trim
    d.poly([[19, 30], [28, 30], [30, 34], [18, 34]], 'T'); // tassets
    d.limb(19.5, 30.5, 28, 30.5, 1.3, 1.3, 'K').ellipse(24, 30.5, 1.4, 1.2, 'Y'); // belt + buckle
    d.limb(25, 32, 30, 37, 3, 2.7, 'T').limb(30, 37, 31, 42, 2.6, 2.4, 'A').ellipse(33, 43.5, 3.6, 2.1, 'g'); // front leg
    d.ellipse(26, 12, 6.8, 6.2, 'S').ellipse(20.5, 13, 1.6, 2, 'S'); // head, ear
    d.ellipse(20, 7, 7, 4.2, 'H'); // hair
    d.poly([[20, 6], [9, 3], [18, 10]], 'H').poly([[19, 9], [8, 9], [18, 13]], 'H').poly([[22, 5], [17, 0], [26, 4]], 'H');
    d.poly([[25, 3], [30, 0], [29, 6]], 'H').poly([[23, 4], [31, 5], [29, 8], [25, 8]], 'H');
    eyes(d, 26, 11);
    d.pixels([[26, 10], [27, 10], [30, 9], [31, 10]], 'b');
    d.pixels([[25, 14], [31, 14]], 'r');
    d.pixels([[28, 16], [29, 16], [30, 16]], 'm').pixels([[28, 15], [29, 15], [30, 15]], 'w');
    d.ellipse(28.5, 21, 3.5, 2.8, 'A').limb(25.5, 23, 31.5, 23, 0.6, 0.6, 'Y'); // pauldron
    d.limb(28, 22, 32, 25, 2.2, 2, 'A').limb(32, 25, 36, 25, 2, 1.8, 'g').ellipse(37, 25, 2.1, 2.1, 'g'); // front arm
    d.limb(39, 22, 45.5, 5, 2, 1.1, 'M'); // broadsword blade
    d.limb(35.5, 21.5, 40.5, 25.5, 1, 1, 'Y').pixels([[38, 23]], 'j'); // crossguard with sea gem
    d.ellipse(35.5, 27.8, 1.2, 1.2, 'Y'); // pommel
    return d.render({
      S: SKIN, ...FACE, H: M(['#8fd6ff', '#3fa9f5', '#1f66b0']), b: flat('#1e4a80'), j: flat('#7af0ff'),
      A: M(['#6cc0ff', '#2f86d8', '#1c4f94'], { gloss: true }), C: M(['#3a5296', '#26386e', '#161f44']),
      T: M(['#3e4e78', '#2a3658', '#1a2038']), g: M(['#4a4a5e', '#30303e', '#1c1c26']),
      K: LEATHER, Y: GOLD, M: STEEL,
    });
  },

  // Ember Arcanist: red ponytail, crimson robe with gold trim, gold staff crowned with a flame orb,
  // casting fire from her free hand.
  pyra(d = new Doll()) {
    d.limb(9, 44, 13, 6, 1.1, 1.1, 'Y'); // tall gold staff, held behind
    d.poly([[20, 19], [12, 24], [10, 34], [16, 31], [19, 27]], 'C'); // short cape
    d.limb(17, 6, 10, 12, 3, 2.6, 'F').limb(10, 12, 7, 22, 2.6, 1.3, 'F'); // ponytail
    d.limb(22, 35, 19, 40, 2.3, 2.1, 'T').limb(19, 40, 18, 43, 2.1, 2, 'T').ellipse(17, 44, 3, 1.8, 'O'); // back leg
    d.limb(26, 35, 28, 40, 2.3, 2.1, 'T').limb(28, 40, 29, 43, 2.1, 2, 'T').ellipse(31, 44, 3, 1.8, 'O'); // front leg
    d.poly([[21, 26], [28, 26], [32, 37], [17, 37]], 'R'); // skirt
    d.limb(17.5, 36.5, 31.5, 36.5, 1, 1, 'Y'); // gold hem
    d.poly([[21, 19], [28, 19], [27, 27], [22, 27]], 'R'); // bodice
    d.limb(21.5, 19.5, 27.5, 19.5, 0.7, 0.7, 'Y').limb(21, 27, 28, 27, 1.2, 1.2, 'Y'); // trim + belt
    d.limb(21, 21, 15, 24, 2, 1.8, 'R').ellipse(11.4, 24, 1.9, 1.9, 'S'); // back arm on the staff
    d.ellipse(13.4, 3.4, 3.2, 3.2, 'a').ellipse(13.7, 3, 2, 2, 'f').ellipse(13.9, 2.7, 0.9, 0.9, 'c'); // flame orb
    d.limb(10, 6.5, 11, 3.5, 0.7, 0.7, 'Y').limb(16.5, 6.5, 15.8, 3.5, 0.7, 0.7, 'Y'); // orb claws
    d.ellipse(26, 12, 6.6, 6.1, 'S').ellipse(20.5, 13, 1.5, 1.9, 'S'); // head, ear
    d.ellipse(21, 8, 7, 4.6, 'F'); // hair
    d.poly([[19, 5], [15, 1], [22, 3]], 'F').poly([[23, 4], [31, 5], [30, 9], [25, 8]], 'F').poly([[29, 6], [33, 9], [30, 11]], 'F');
    d.ellipse(17.5, 6, 1.6, 1.6, 'Y'); // hair tie
    eyes(d, 26, 11);
    d.pixels([[25, 10], [26, 10], [27, 11], [30, 11], [31, 10], [32, 10]], 'k'); // fierce brows
    d.pixels([[25, 14], [31, 14]], 'r');
    d.pixels([[28, 16], [29, 16], [30, 15]], 'm'); // smirk
    d.limb(28, 21, 32, 22, 2, 1.9, 'R').limb(32, 22, 35, 20, 1.8, 1.7, 'S').ellipse(36, 19.5, 1.9, 1.9, 'S'); // casting arm
    d.limb(33, 21.2, 34.5, 20.5, 1.9, 1.9, 'Y'); // brass bracer
    d.poly([[37, 15], [39.5, 9], [41.8, 15]], 'a'); // flame tongue
    d.ellipse(39.2, 17, 3.4, 3.4, 'a').ellipse(39.5, 16.6, 2.2, 2.2, 'f').ellipse(39.8, 16.2, 1.1, 1.1, 'c'); // fireball
    return d.render({
      S: SKIN, ...FACE, k: flat('#7a1e14'),
      F: M(['#ff9a5a', '#e8442c', '#9a2418']), R: M(['#b8443a', '#8a2a24', '#561814']),
      C: M(['#5a2a26', '#3a1a18', '#24100e']), T: M(['#4a3a40', '#33282e', '#21191e']),
      O: M(['#8a5a3a', '#5e3a24', '#3a2416']), Y: GOLD,
      a: flat('#ff7a2a'), f: flat('#ffc040'), c: flat('#fff4b0'),
    });
  },

  // Thorn Sentinel armour on the old hedge knight: leaf-crested helm, white beard, dark green plate with
  // gold trim, a huge kite shield, sword raised ready.
  bramble(d = new Doll()) {
    d.limb(18, 21, 15, 15, 2.4, 2.2, 'A').limb(15, 15, 14, 11, 2.1, 2, 'g').ellipse(14, 10, 2.2, 2.2, 'g'); // raised arm
    d.limb(13.2, 8, 10, 0.8, 2, 1.2, 'M').limb(11.5, 9.6, 16.5, 8, 0.9, 0.9, 'Y'); // sword + guard
    d.limb(20, 33, 16, 39, 3.4, 3.1, 'A').limb(16, 39, 14, 43, 3.1, 2.9, 'A').ellipse(13, 44, 4, 2, 'g'); // back leg
    d.limb(27, 33, 31, 39, 3.4, 3.1, 'A').limb(31, 39, 32, 43, 3.1, 2.9, 'A').ellipse(34, 44, 4, 2, 'g'); // front leg
    d.poly([[15, 32], [32, 32], [33, 37], [14, 37]], 'Q'); // tassets
    d.poly([[16, 19], [31, 19], [32, 33], [15, 33]], 'A'); // breastplate
    d.limb(16.5, 19.6, 30.5, 19.6, 0.8, 0.8, 'Y').limb(15.5, 32, 31.5, 32, 1.4, 1.4, 'K');
    d.poly([[12, 21], [17, 15], [23, 18], [19, 23]], 'N'); // leaf pauldron
    d.ellipse(25, 9, 8, 6, 'A'); // helm
    d.poly([[20, 4], [17, -1], [23, 2]], 'N').poly([[24, 3], [25, -2], [28, 3]], 'N').poly([[28, 4], [32, 1], [31, 6]], 'N'); // leaf crest
    d.ellipse(27, 14, 5.6, 4.8, 'S'); // face in the open helm
    d.limb(19.5, 9, 33, 9, 1.4, 1.4, 'Y'); // helm rim
    d.limb(21, 10, 21, 17, 1.7, 1.5, 'A'); // cheek guard
    d.poly([[22, 15], [33, 15], [32, 21], [28, 26], [24, 24], [21, 19]], 'B'); // beard
    d.limb(27, 16.2, 33, 16.2, 1.2, 1.2, 'B'); // moustache
    d.pixels([[25, 11], [26, 11], [27, 11], [30, 11], [31, 11], [32, 11]], 'h'); // bushy brows
    d.pixels([[26, 12], [26, 13], [31, 12], [31, 13]], 'e');
    d.ellipse(33.5, 14.2, 1.5, 1.3, 'S'); // nose
    d.poly([[28, 18], [42, 18], [43, 28], [36, 41], [28, 30]], 'Y'); // shield rim
    d.poly([[29.5, 19.5], [40.5, 19.5], [41.3, 28], [36, 38.5], [29.5, 29.5]], 'W'); // shield face
    d.poly([[35.5, 22], [38.5, 27.5], [35.5, 34], [32.5, 27.5]], 'N').limb(35.5, 23, 35.5, 33, 0.5, 0.5, 'Q'); // leaf emblem
    return d.render({
      S: SKIN, ...FACE, h: flat('#f4f4ec'),
      A: M(['#6a9a4a', '#3f6a2e', '#22401a'], { gloss: true }), Q: M(['#4a6a34', '#2e4a20', '#1a2c12']),
      N: M(['#a6e070', '#6cbf3a', '#3a7a22']), B: M(['#ffffff', '#e2e6d6', '#a8b094']),
      W: M(['#5a8a3a', '#3a6626', '#22401a']), g: M(['#5e4a36', '#3e3022', '#261c12']),
      K: LEATHER, Y: GOLD, M: STEEL,
    });
  },

  // Shadow Blade: spiky dark hair, masked face, dark leather with violet trim, low lunge with two curved
  // violet blades, scarf streaming behind.
  nox(d = new Doll()) {
    d.poly([[20, 19], [10, 15], [5, 19], [11, 21], [19, 23]], 'Q'); // scarf tail
    d.limb(20, 21, 15, 18, 2, 1.9, 'L').limb(15, 18, 12, 14, 1.9, 1.7, 'L').ellipse(11.5, 13.5, 1.9, 1.9, 'g'); // raised arm
    d.limb(11, 12, 7, 6, 1.8, 1.2, 'V').limb(7, 6, 8.5, 1.5, 1.2, 0.4, 'V'); // reverse-grip blade
    d.limb(22, 32, 15, 37, 2.6, 2.3, 'L').limb(15, 37, 8, 41, 2.3, 2.1, 'L').ellipse(7, 42.5, 3.1, 1.8, 'O'); // back leg
    d.poly([[19, 20], [29, 18], [30, 30], [21, 32]], 'L'); // torso
    d.limb(19.5, 20.5, 29, 18.5, 0.8, 0.8, 'Q').limb(20, 30, 30, 29, 1.2, 1.2, 'K');
    d.ellipse(21.5, 32, 2.5, 2.3, 'P').pixels([[21, 31]], 'Z'); // coin pouch
    d.limb(26, 32, 32, 36, 2.8, 2.5, 'L').limb(32, 36, 32, 43, 2.4, 2.2, 'L').ellipse(34, 44, 3.3, 1.8, 'O'); // front leg
    d.limb(22, 19, 30, 18, 2, 2, 'Q'); // scarf
    d.ellipse(29, 13.5, 6.3, 6, 'S').ellipse(23.5, 14, 1.4, 1.8, 'S'); // head, ear
    d.ellipse(24.5, 8, 7, 4.2, 'H'); // hair
    d.poly([[21, 7], [11, 3], [19, 11]], 'H').poly([[20, 10], [10, 11], [20, 14]], 'H').poly([[24, 6], [21, 0], [28, 5]], 'H');
    d.poly([[28, 5], [34, 2], [32, 8]], 'H').poly([[26, 6], [35, 7], [33, 10], [28, 9.5]], 'H'); // bangs
    d.poly([[24.5, 15], [35.5, 14], [35, 19], [27, 20.5]], 'X'); // mask
    d.pixels([[29, 12], [30, 12], [30, 13], [33, 12], [34, 12], [34, 13]], 'e').pixels([[29, 12], [33, 12]], 'i'); // narrow eyes
    d.limb(28, 22, 33, 25, 2, 1.9, 'L').limb(33, 25, 37, 26, 1.9, 1.7, 'L').ellipse(38, 26, 1.9, 1.9, 'g'); // front arm
    d.limb(39, 25, 43, 21, 1.8, 2.2, 'V').limb(43, 21, 46.5, 14.5, 2.2, 0.5, 'V'); // big crescent blade
    d.limb(37.5, 23.5, 39.5, 28, 0.8, 0.8, 'Z'); // guard
    return d.render({
      S: SKIN, ...FACE, H: M(['#6a5a9a', '#3e3466', '#221c3c']),
      L: M(['#5e5872', '#3e3a4e', '#252231']), Q: M(['#b07ae0', '#8a4ac0', '#5a2a86']),
      X: M(['#3a3348', '#262230', '#16131c']), V: M(['#d8b0ff', '#9b59d0', '#5a2a90'], { gloss: true }),
      K: LEATHER, P: M(['#c8a070', '#9a7448', '#6a4c2c']), Z: GOLD,
      g: M(['#3a3346', '#25212e', '#16131c']), O: M(['#4a4058', '#2e2838', '#1c1824']),
    });
  },

  // Radiant Cleric: long golden hair with a blue-gem circlet, white and gold robe with blue accents,
  // brass lantern staff, free hand raised in blessing.
  solenne(d = new Doll()) {
    d.limb(19, 10, 16, 22, 3, 2.4, 'G').limb(16, 22, 17, 31, 2.4, 1.4, 'G'); // long hair down the back
    d.limb(20, 21, 15, 19, 1.9, 1.8, 'W').limb(15, 19, 13, 15, 1.7, 1.6, 'S').ellipse(12.5, 14, 1.8, 2.2, 'S'); // blessing hand
    d.poly([[20, 19], [29, 19], [30, 27], [34, 44], [15, 44], [19, 27]], 'W'); // bell robe
    d.limb(15.5, 43.6, 33.5, 43.6, 1.2, 1.2, 'Y').limb(24.5, 22, 24.5, 43, 0.8, 0.8, 'Y'); // gold hem + front trim
    d.limb(16.8, 38.5, 32, 38.5, 0.6, 0.6, 'U'); // blue band
    d.limb(19.5, 28, 29.5, 28, 1, 1, 'Y').ellipse(24.5, 23, 1.9, 1.9, 'Y').pixels([[24, 23], [25, 23]], 'j'); // sash + sun brooch
    d.limb(36, 2, 36, 45, 1.1, 1.1, 'Z'); // staff
    d.limb(36, 3, 40.5, 3, 0.8, 0.8, 'Y').limb(40.5, 3.5, 41, 6, 0.5, 0.5, 'Y'); // hook + chain
    d.ellipse(41, 10.5, 2.8, 3.6, 'l'); // lantern glass
    d.limb(38.2, 7, 38.2, 14, 0.7, 0.7, 'Y').limb(43.8, 7, 43.8, 14, 0.7, 0.7, 'Y');
    d.limb(38.5, 6.5, 43.5, 6.5, 1, 1, 'Y').limb(38.5, 14.5, 43.5, 14.5, 1, 1, 'Y');
    d.ellipse(26, 11.5, 6.4, 6.1, 'S'); // head
    d.ellipse(23, 8, 7, 4.6, 'G').limb(20, 9, 19.5, 18, 2.6, 2.2, 'G'); // hair + side lock
    d.poly([[22, 5], [31, 6], [30, 8.5], [24, 8]], 'G'); // bangs
    d.limb(19.5, 6.8, 31, 5.8, 0.8, 0.8, 'Y').pixels([[26, 5], [27, 5]], 'j'); // circlet + gem
    d.pixels([[26, 12], [27, 11], [28, 12], [30, 12], [31, 11], [32, 12]], 'e'); // closed, serene eyes
    d.pixels([[25, 13], [31, 13]], 'r').pixels([[28, 15], [29, 15]], 'm');
    d.limb(28, 21, 33, 23, 1.9, 1.8, 'W').limb(33, 23, 35, 22, 1.7, 1.6, 'S').ellipse(36, 22, 1.8, 1.8, 'S'); // staff hand
    return d.render({
      S: SKIN, ...FACE, G: M(['#fff0a0', '#f5d63f', '#b8901c']), j: flat('#5ac8ff'),
      W: M(['#ffffff', '#f2ecd8', '#c4b896']), U: M(['#8ad4ff', '#3a9ae0', '#1f5a9a']),
      Y: GOLD, Z: M(['#e0b07a', '#a8783e', '#6a4824']), l: flat('#fff4c0'),
    });
  },
};
