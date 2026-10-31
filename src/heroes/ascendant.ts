import type { HeroDef } from '../data';
import { standardSteps, chargeText, type AscendantDef, type Charge } from '../ascendant';
import { VS, ULT, ultX } from '../heroText';

/**
 * Ascendant heroes (src/ascendant.ts). The five real heroes are in the roster (src/heroes/index.ts) under codename
 * ids (asc_dark...), but never in chests, shops, Trials or guild requests: their crests come from the Guild Boss
 * week and the Ascendant Chest. asc_test is a stand-in to build and test the framework with and stays hidden.
 *
 * Balance (tests/ascendant.test.ts): Form I hits no harder per second than the best Rare of its Type, and
 * Form IV no more than 15% over the best Epic or Legendary of its Type.
 */

/** A Signature line with the form's Charge and the element note. */
const sig = (name: string, text: string, c: Charge, el: keyof typeof VS) => ({ name, text: `${text} ${chargeText(c)} ${VS[el]}` });
const base = { rarity: 'common' as const, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1 };
const ascTestBase: HeroDef = {
  id: 'asc_test', rarity: 'common', name: 'Testblade', element: 'dark', type: 'Samurai', baseAtk: 6, baseHp: 48, range: 28, attackCooldown: 0.8, moveSpeed: 140, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1,
  bio: 'A stand-in swordsman for testing ascension.',
  basic: { name: 'Quick Cut', text: 'Fast cuts at the nearest enemy ahead.' },
  ultimate: { name: 'Edge Burst', text: ULT('A burst of dark energy tears through') },
  trait: { name: 'Keen Edge', text: `Hits harder the longer he fights. ${VS.dark}` },
  sp1: { name: 'Follow Through', text: '20% chance for each attack to strike twice.', effect: { kind: 'doubleStrike', value: 0.2 } },
  sp2: { name: 'Steady Hand', text: '+10% critical hit chance.', effect: { kind: 'crit', value: 0.1 } },
  aura: { name: 'Dark Resolve', text: 'Dark heroes +20% ATK.', effect: { kind: 'atk', value: 1.2, team: true, element: 'dark' } },
};

// ---- Dark: Zanshin, a swordsman with an oversized cleaver. Single target and boss killer; fragile. ----
// His own moves: a mask that saves him once a life, and a crescent wave down the whole lane.
const darkC: Charge[] = [
  { stacks: 6, boost: 'damage', value: 1 },
  { stacks: 6, boost: 'pierce', value: 1.5 },
  { stacks: 5, boost: 'pierce', value: 2 },
  { stacks: 5, boost: 'bossDamage', value: 3 },
];
const maskText = (below: number, heal: number, seconds: number, speed: string) =>
  `Once a life, when a hit would drop him under ${below}% HP (even a killing blow), he survives it and a bone-white mask covers his face: he heals ${heal}% of max HP and attacks ${speed} for ${seconds} seconds.`;
const ascDark: AscendantDef = {
  base: {
    ...base, id: 'asc_dark', name: 'Zanshin', element: 'dark', type: 'Samurai', baseAtk: 4.8, baseHp: 46, range: 28, attackCooldown: 0.8, moveSpeed: 140,
    signature: { kind: 'mask', below: 0.3, heal: 0.3, haste: 0.5, seconds: 6, plusSeconds: 10 },
    sigPlus: 'The mask lasts 10 seconds.',
    // Balance check 2026-10-22: the whole-lane crescent at full damage (and 2x/3x on bosses) made him the strongest
    // hero in every form, so the lane takes half an Ultimate and bosses a little more than one.
    ult: { kind: 'crescent', mult: 1.25, plusMult: 1.5, lane: 0.5 },
    ultPlus: 'Bosses take 1.5x instead of 1.25x.',
    bio: 'A young swordsman who carries a bandaged cleaver taller than he is.',
    basic: { name: 'Cleaver Chop', text: 'Heavy chops at the nearest enemy ahead.' },
    ultimate: { name: 'Moonfall Crescent', text: `He swings a crescent of dark energy down the whole lane: every enemy ahead takes ${ultX(0.5)} ATK and bosses ${ultX(1.25)}, with element bonuses.` },
    trait: sig('Wraith Mask', maskText(30, 30, 6, 'twice as fast'), darkC[0], 'dark'),
    sp1: { name: 'Second Swing', text: '20% chance for each attack to strike twice.', effect: { kind: 'doubleStrike', value: 0.2 } },
    sp2: { name: 'Sharp Eye', text: '+10% critical hit chance.', effect: { kind: 'crit', value: 0.1 } },
    aura: { name: 'Night Resolve', text: 'Dark heroes +20% ATK.', effect: { kind: 'atk', value: 1.2, team: true, element: 'dark' } },
  },
  forms: [
    { formName: 'Grave Warden', art: 'asc_dark', charge: darkC[0] },
    { formName: 'Moonhewn Edge', art: 'asc_dark_f2', baseAtk: 5.8, baseHp: 50, attackCooldown: 0.78, charge: darkC[1],
      bio: 'The bandages are off. His cleaver now throws crescent waves of violet light.',
      signature: { kind: 'mask', below: 0.35, heal: 0.35, haste: 0.5, seconds: 6, plusSeconds: 10 },
      trait: sig('Wraith Mask', maskText(35, 35, 6, 'twice as fast'), darkC[1], 'dark') },
    { formName: 'Nightfall Blade', art: 'asc_dark_f3', baseAtk: 6.4, baseHp: 54, attackCooldown: 0.75, range: 70, charge: darkC[2],
      bio: 'A slim black sword and a ragged coat. His slashes now fly far enough to hit enemies in the sky.',
      basic: { name: 'Flying Slash', text: 'Slashes that fly a short way, reaching enemies in the sky.' },
      signature: { kind: 'mask', below: 0.35, heal: 0.35, haste: 0.5, seconds: 8, plusSeconds: 12 },
      sigPlus: 'The mask lasts 12 seconds.',
      trait: sig('Wraith Mask', maskText(35, 35, 8, 'twice as fast'), darkC[2], 'dark'),
      sp2: { name: 'Hunter of Giants', text: 'Deals 30% more damage to bosses.', effect: { kind: 'bossDamage', value: 1.3 } } },
    { formName: 'Void Ascendant', art: 'asc_dark_f4', baseAtk: 6.8, baseHp: 58, attackCooldown: 0.74, charge: darkC[3],
      bio: 'His final form: twin blades of dark energy and an aura of black flame.',
      signature: { kind: 'mask', below: 0.4, heal: 0.5, haste: 0.4, seconds: 8, plusSeconds: 12 },
      trait: sig('Void Mask', maskText(40, 50, 8, '2.5x as fast'), darkC[3], 'dark'),
      ult: { kind: 'crescent', mult: 1.25, plusMult: 1.5, lane: 0.6 },
      ultPlus: 'Bosses take 1.5x instead of 1.25x.',
      ultimate: { name: 'Black Moonfall', text: `Two black crescents tear down the whole lane: every enemy ahead takes ${ultX(0.6)} ATK and bosses ${ultX(1.25)}, with element bonuses.` } },
  ],
  // Dark counters the Light element boss (stage 1000).
  steps: standardSteps(1000),
};

// ---- Fire: Kip, a stretchy brawler who heats up with each form. Crowd clear and flurries; no flyers. ----
// His own moves: flurries of rubbery punches, and a bouncing slam that stuns everything it hits.
const fireC: Charge[] = [
  { stacks: 5, boost: 'area', value: 1 },
  { stacks: 5, boost: 'area', value: 1.5 },
  { stacks: 4, boost: 'area', value: 2 },
  // Every 5th, not 4th: on a 4 beat it always landed on the same attack as the flurry and the slam and tripled them.
  { stacks: 5, boost: 'area', value: 3 },
];
const barrageText = (every: number, hits: number, pct: number) => `Every ${every}th attack is a flurry of ${hits} rubbery punches for ${pct}% damage each.`;
const ascFire: AscendantDef = {
  base: {
    ...base, id: 'asc_fire', name: 'Kip', element: 'fire', type: 'Brawler', baseAtk: 5, baseHp: 80, range: 40, attackCooldown: 1.0, moveSpeed: 125,
    signature: { kind: 'barrage', every: 4, hits: 4, plusHits: 6, mult: 0.6 },
    sigPlus: 'Each flurry is 6 punches.',
    ult: { kind: 'bounce', seconds: 1.5, plusSeconds: 2.5 },
    ultPlus: 'Enemies stay stunned for 2.5 seconds.',
    bio: 'A grinning deckhand in a straw sun hat whose arms stretch like rubber, so he hits from a little further away.',
    basic: { name: 'Stretch Punch', text: 'Rubbery punches that reach a bit further than other brawlers.' },
    ultimate: { name: 'Rubber Rebound', text: `${ULT('He bounces off the ground like a ball and slams into')} Stuns them for 1.5 seconds (bosses half as long).` },
    trait: sig('Rapid Fists', barrageText(4, 4, 60), fireC[0], 'fire'),
    sp1: { name: 'Quick Hands', text: 'Attacks 15% faster.', effect: { kind: 'attackSpeed', value: 0.85 } },
    sp2: { name: 'Rubber Body', text: 'Takes 20% less damage.', effect: { kind: 'damageTaken', value: 0.8 } },
    aura: { name: 'Crew Spirit', text: 'Fire heroes +20% ATK.', effect: { kind: 'atk', value: 1.2, team: true, element: 'fire' } },
  },
  forms: [
    { formName: 'Deckhand', art: 'asc_fire', charge: fireC[0] },
    { formName: 'Steam Gear', art: 'asc_fire_f2', baseAtk: 5.3, baseHp: 88, attackCooldown: 0.9, charge: fireC[1],
      bio: 'Steam pours off him as his blood runs hot. Faster fists, longer flurries.',
      signature: { kind: 'barrage', every: 4, hits: 5, plusHits: 7, mult: 0.6 },
      sigPlus: 'Each flurry is 7 punches.',
      trait: sig('Steam Fists', barrageText(4, 5, 60), fireC[1], 'fire') },
    { formName: 'Iron Bounce', art: 'asc_fire_f3', baseAtk: 5.6, baseHp: 96, attackCooldown: 0.88, charge: fireC[2],
      bio: 'Puffed up into a bouncing ball of muscle with giant fists.',
      signature: { kind: 'barrage', every: 4, hits: 5, plusHits: 7, mult: 0.7 },
      trait: sig('Steam Fists', barrageText(4, 5, 70), fireC[2], 'fire'),
      sp1: { name: 'Bounce Slam', text: 'Every 4th attack slams the ground for 2x damage to every enemy near the target.', effect: { kind: 'slam', value: 2, every: 4 } },
      ult: { kind: 'bounce', seconds: 2, plusSeconds: 3 },
      ultPlus: 'Enemies stay stunned for 3 seconds.',
      ultimate: { name: 'Rubber Rebound', text: `${ULT('He bounces off the ground like a ball and slams into')} Stuns them for 2 seconds (bosses half as long).` } },
    { formName: 'Sunburst', art: 'asc_fire_f4', baseAtk: 5.9, baseHp: 105, attackCooldown: 0.86, charge: fireC[3],
      bio: 'His final form: white hair, a carefree grin, and fists that hit like the sun.',
      signature: { kind: 'barrage', every: 4, hits: 6, plusHits: 8, mult: 0.8 },
      sigPlus: 'Each flurry is 8 punches.',
      trait: sig('Sun Fists', barrageText(4, 6, 80), fireC[3], 'fire'),
      ult: { kind: 'bounce', seconds: 2.5, plusSeconds: 4 },
      ultPlus: 'Enemies stay stunned for 4 seconds.',
      ultimate: { name: 'Sunburst Rebound', text: `${ULT('He bounces across the whole sky and crashes down on')} Stuns them for 2.5 seconds (bosses half as long).` } },
  ],
  // Fire counters the Earth element boss (stage 800).
  steps: standardSteps(800),
};

// ---- Light: Valeth, a winged warrior who speeds up the longer she fights. Slow start, little burst. ----
// Her own moves: Zeal (faster with every attack in a row, then waves of light), and a ward that makes an ally untouchable.
const lightC: Charge[] = [
  { stacks: 6, boost: 'damage', value: 0.8 },
  { stacks: 6, boost: 'damage', value: 1 },
  { stacks: 5, boost: 'area', value: 1.2 },
  { stacks: 5, boost: 'area', value: 1.5 },
];
const zealText = (pct: number, max: number, wave: number) =>
  `Each attack in a row makes her attack ${pct}% faster, up to ${max} times. At 5 in a row her attacks also hit enemies within ${wave} px. Walking resets it.`;
const ascLight: AscendantDef = {
  base: {
    ...base, id: 'asc_light', name: 'Valeth', element: 'light', type: 'Ranger', flying: true, baseAtk: 4.6, baseHp: 40, range: 150, attackCooldown: 1.0, moveSpeed: 115,
    signature: { kind: 'zeal', perStack: 0.06, max: 5, plusMax: 8, waveAt: 5, wave: 30 },
    sigPlus: 'Zeal stacks up to 8 times.',
    ult: { kind: 'sanctuary', seconds: 2, plusSeconds: 3 },
    ultPlus: 'The ward covers the whole team for 3 seconds.',
    bio: 'A young winged warrior in white-and-gold armor with a softly glowing sword.',
    basic: { name: 'Light Bolt', text: 'Bolts of light from her sword at the nearest enemy.' },
    ultimate: { name: 'Halo Ward', text: `${ULT('A pillar of light hits')} The most injured hero takes no damage for 2 seconds.` },
    trait: sig('Zeal', zealText(6, 5, 30), lightC[0], 'light'),
    sp1: { name: 'Twin Feathers', text: 'Each shot also hits the next enemy just behind the target.', effect: { kind: 'pierce', value: 1 } },
    sp2: { name: 'Swift Wings', text: 'Attacks 15% faster.', effect: { kind: 'attackSpeed', value: 0.85 } },
    aura: { name: 'Halo Chorus', text: 'Light heroes +20% ATK.', effect: { kind: 'atk', value: 1.2, team: true, element: 'light' } },
  },
  forms: [
    { formName: 'Squire of Dawn', art: 'asc_light', charge: lightC[0] },
    { formName: 'First Feather', art: 'asc_light_f2', baseAtk: 5.0, baseHp: 42, attackCooldown: 0.95, range: 170, charge: lightC[1],
      bio: 'Two pairs of wings and a sword wrapped in golden flame.',
      signature: { kind: 'zeal', perStack: 0.07, max: 5, plusMax: 8, waveAt: 5, wave: 30 },
      trait: sig('Zeal', zealText(7, 5, 30), lightC[1], 'light') },
    { formName: 'Radiant Warden', art: 'asc_light_f3', baseAtk: 5.4, baseHp: 44, attackCooldown: 0.9, range: 185, charge: lightC[2],
      bio: 'Three pairs of wings. Her sword sends out sweeping waves of light.',
      signature: { kind: 'zeal', perStack: 0.07, max: 6, plusMax: 9, waveAt: 5, wave: 40 },
      sigPlus: 'Zeal stacks up to 9 times.',
      trait: sig('Radiant Zeal', zealText(7, 6, 40), lightC[2], 'light'),
      ult: { kind: 'sanctuary', seconds: 2.5, plusSeconds: 3.5 },
      ultPlus: 'The ward covers the whole team for 3.5 seconds.',
      ultimate: { name: 'Halo Ward', text: `${ULT('A pillar of light hits')} The most injured hero takes no damage for 2.5 seconds.` } },
    { formName: 'Lightborn', art: 'asc_light_f4', baseAtk: 5.8, baseHp: 46, attackCooldown: 0.85, range: 200, charge: lightC[3],
      bio: 'Her final form: four pairs of wings made of light, and a sword of pure light.',
      signature: { kind: 'zeal', perStack: 0.08, max: 6, plusMax: 9, waveAt: 5, wave: 50 },
      trait: sig('Radiant Zeal', zealText(8, 6, 50), lightC[3], 'light'),
      ult: { kind: 'sanctuary', seconds: 3, plusSeconds: 4 },
      ultPlus: 'The ward covers the whole team for 4 seconds.',
      ultimate: { name: 'Heaven\'s Ward', text: `${ULT('A storm of light pillars hits')} The most injured hero takes no damage for 3 seconds.` } },
  ],
  // Light counters the Dark element boss (stage 900).
  steps: standardSteps(900),
};

// ---- Water: Marisel, a water mage. Steady area caster; sturdier than most mages, slow walker. ----
// Her own moves: Tidal Veil (a water barrier when hurt: she casts harder and takes less), and a tide that soaks and
// pushes, which becomes a water dragon in her final form.
const waterC: Charge[] = [
  { stacks: 4, boost: 'damage', value: 1 },
  { stacks: 4, boost: 'area', value: 1 },
  { stacks: 4, boost: 'pierce', value: 2 },
  { stacks: 3, boost: 'area', value: 2.5 },
];
const torrentText = (below: number, dmg: number, guard: number) =>
  `Under ${below}% HP a veil of water wraps around her: +${dmg}% damage and ${guard}% less damage taken.`;
const ascWater: AscendantDef = {
  base: {
    ...base, id: 'asc_water', name: 'Marisel', element: 'water', type: 'Magician', baseAtk: 6, baseHp: 46, range: 150, attackCooldown: 1.3, moveSpeed: 95, splash: 20,
    signature: { kind: 'torrent', below: 0.4, plusBelow: 0.6, dmg: 1.5, guard: 0.6 },
    sigPlus: 'The veil rises under 60% HP.',
    ult: { kind: 'hydro', push: 140, slow: 0.5, seconds: 3, plusSeconds: 5 },
    ultPlus: 'Enemies stay soaked for 5 seconds.',
    bio: 'A quiet young mage in a black robe whose water magic is far stronger than she believes.',
    basic: { name: 'Water Bolt', text: 'Bolts of water that also hit enemies close to the target.' },
    ultimate: { name: 'Tide Surge', text: `${ULT('A surging tide hits')} Pushes regular enemies back and soaks everyone hit: they move and attack at half speed for 3 seconds.` },
    trait: sig('Tidal Veil', torrentText(40, 50, 40), waterC[0], 'water'),
    sp1: { name: 'Twin Bolts', text: '20% chance for each attack to cast twice.', effect: { kind: 'doubleStrike', value: 0.2 } },
    sp2: { name: 'Still Water', text: 'Takes 25% less damage.', effect: { kind: 'damageTaken', value: 0.75 } },
    aura: { name: 'Tidecall', text: 'Water heroes +20% HP.', effect: { kind: 'hp', value: 1.2, team: true, element: 'water' } },
  },
  forms: [
    { formName: 'Tide Apprentice', art: 'asc_water', charge: waterC[0] },
    { formName: 'Silver Valkyrie', art: 'asc_water_f2', baseAtk: 7.4, baseHp: 50, attackCooldown: 1.25, charge: waterC[1],
      bio: 'Her magic takes shape as silver armor, a winged staff and a cloak of flowing water.',
      basic: { name: 'Water Lance', text: 'Lances of water that also hit enemies close to the target.' },
      trait: sig('Tidal Veil', torrentText(40, 50, 40), waterC[1], 'water') },
    { formName: 'Wyrm Armor', art: 'asc_water_f3', baseAtk: 8.8, baseHp: 55, attackCooldown: 1.2, range: 165, charge: waterC[2],
      bio: 'Dragon-scale armor and wings of water: she rides the waves into battle.',
      basic: { name: 'Wyrm Spray', text: 'Piercing sprays of water that also hit enemies close to the target.' },
      signature: { kind: 'torrent', below: 0.4, plusBelow: 0.6, dmg: 1.6, guard: 0.55 },
      trait: sig('Tidal Veil', torrentText(40, 60, 45), waterC[2], 'water'),
      ult: { kind: 'hydro', push: 170, slow: 0.45, seconds: 3.5, plusSeconds: 5.5 },
      ultPlus: 'Enemies stay soaked for 5.5 seconds.',
      ultimate: { name: 'Great Tide', text: `${ULT('A great wave hits')} Pushes regular enemies back and soaks everyone hit: they move and attack at 45% speed for 3.5 seconds.` } },
    { formName: 'Tidewyrm Queen', art: 'asc_water_f4', baseAtk: 10.4, baseHp: 60, attackCooldown: 1.15, range: 175, splash: 30, charge: waterC[3],
      bio: 'Her final form: wrapped in a living water dragon, with a blade of pure water in hand.',
      basic: { name: 'Tide Blade', text: 'Waves from her water blade that also hit enemies close to the target.' },
      signature: { kind: 'torrent', below: 0.4, plusBelow: 0.6, dmg: 1.8, guard: 0.5 },
      trait: sig('Dragon Veil', torrentText(40, 80, 50), waterC[3], 'water'),
      ult: { kind: 'hydro', push: 200, slow: 0.4, seconds: 4, plusSeconds: 6 },
      ultPlus: 'Enemies stay soaked for 6 seconds.',
      ultimate: { name: 'Tidewyrm Roar', text: `${ULT('Her water dragon crashes through')} Pushes regular enemies far back and soaks everyone hit: they move and attack at 40% speed for 4 seconds.` } },
  ],
  // Water counters the Fire element boss (stage 600).
  steps: standardSteps(600),
};

// ---- Earth: Aeron, a wind mage. His magic looks like wind but every hit is Earth. Fast multi-target; fragile. ----
// His own moves: a wind spirit that casts alongside him, and a storm that pulls enemies together and holds them.
const earthC: Charge[] = [
  { stacks: 5, boost: 'area', value: 1 },
  { stacks: 5, boost: 'pierce', value: 1.5 },
  { stacks: 4, boost: 'area', value: 2 },
  { stacks: 4, boost: 'area', value: 2.5 },
];
const spiritText = (who: string, every: number, targets: number, pct: number) =>
  `Every ${every === 2 ? '2nd' : every === 3 ? '3rd' : `${every}th`} attack ${who} also throws a wind blade at ${targets === 1 ? 'one other enemy' : `${targets} other enemies`} in reach for ${pct}% damage.`;
const ascEarth: AscendantDef = {
  base: {
    ...base, id: 'asc_earth', name: 'Aeron', element: 'earth', type: 'Magician', baseAtk: 6.5, baseHp: 38, range: 140, attackCooldown: 1.2, moveSpeed: 110, splash: 20,
    signature: { kind: 'spirit', every: 4, targets: 1, plusTargets: 2, mult: 1 },
    sigPlus: 'The wisp throws 2 blades.',
    ult: { kind: 'tempest', seconds: 1.5, plusSeconds: 2.5 },
    ultPlus: 'The storm holds them for 2.5 seconds.',
    bio: 'A calm young mage with a floating spellbook. His spells look like wind, but they strike as Earth.',
    basic: { name: 'Wind Blade', text: 'Blades of wind that also hit enemies close to the target.' },
    ultimate: { name: 'Gale Prison', text: `${ULT('A whirlwind hits')} Pulls regular enemies together into one spot and holds them for 1.5 seconds.` },
    trait: sig('Breeze Wisp', spiritText('a little wisp', 4, 1, 100), earthC[0], 'earth'),
    sp1: { name: 'Twin Blades', text: '20% chance for each attack to cast twice.', effect: { kind: 'doubleStrike', value: 0.2 } },
    sp2: { name: 'Wide Gust', text: 'Splash radius +30%.', effect: { kind: 'splash', value: 1.3 } },
    aura: { name: 'Steady Ground', text: 'Earth heroes +20% ATK.', effect: { kind: 'atk', value: 1.2, team: true, element: 'earth' } },
  },
  forms: [
    { formName: 'Wind Novice', art: 'asc_earth', charge: earthC[0] },
    { formName: 'Spirit Call', art: 'asc_earth_f2', baseAtk: 7.2, baseHp: 40, attackCooldown: 1.1, range: 150, charge: earthC[1],
      bio: 'A little wind spirit now rides on his shoulder and casts alongside him.',
      basic: { name: 'Blade Fan', text: 'Fans of wind blades that also hit enemies close to the target.' },
      signature: { kind: 'spirit', every: 3, targets: 2, plusTargets: 3, mult: 1 },
      sigPlus: 'The spirit throws 3 blades.',
      trait: sig('Wind Spirit', spiritText('his spirit', 3, 2, 100), earthC[1], 'earth') },
    { formName: 'Spirit Merge', art: 'asc_earth_f3', baseAtk: 7.8, baseHp: 42, attackCooldown: 1.05, range: 160, splash: 30, charge: earthC[2],
      bio: 'Merged with his spirit: wings of air and armor of wind.',
      signature: { kind: 'spirit', every: 3, targets: 2, plusTargets: 3, mult: 1.3 },
      trait: sig('Wind Spirit', spiritText('his spirit', 3, 2, 130), earthC[2], 'earth'),
      ult: { kind: 'tempest', seconds: 2, plusSeconds: 3 },
      ultPlus: 'The storm holds them for 3 seconds.',
      ultimate: { name: 'Gale Prison', text: `${ULT('A whirlwind hits')} Pulls regular enemies together into one spot and holds them for 2 seconds.` } },
    { formName: 'Storm Sovereign', art: 'asc_earth_f4', baseAtk: 8.4, baseHp: 44, attackCooldown: 1.0, range: 170, splash: 36, charge: earthC[3],
      bio: 'His final form: silver hair, great wings of wind, and a storm at his command.',
      signature: { kind: 'spirit', every: 2, targets: 3, plusTargets: 4, mult: 1.2 },
      sigPlus: 'The spirit throws 4 blades.',
      trait: sig('Storm Spirit', spiritText('his spirit', 2, 3, 120), earthC[3], 'earth'),
      ult: { kind: 'tempest', seconds: 2.5, plusSeconds: 4 },
      ultPlus: 'The storm holds them for 4 seconds.',
      ultimate: { name: 'Sovereign Storm', text: `${ULT('A storm of wind blades hits')} Pulls regular enemies together into one spot and holds them for 2.5 seconds.` } },
  ],
  // Earth counters the Water element boss (stage 700).
  steps: standardSteps(700),
};

/** The five Ascendant heroes, by element. */
export const ASCENDANT_FIVE: AscendantDef[] = [ascDark, ascFire, ascLight, ascWater, ascEarth];

export const ASCENDANT_HEROES: AscendantDef[] = [
  ...ASCENDANT_FIVE,
  {
    base: ascTestBase,
    forms: [
      { formName: 'Form I' },
      { formName: 'Form II', art: 'asc_test_f2', baseAtk: 7.5, attackCooldown: 0.7, charge: { stacks: 8, boost: 'damage', value: 0.5 } },
      { formName: 'Form III', art: 'asc_test_f3', baseAtk: 9, baseHp: 56, attackCooldown: 0.6, sp2: { name: 'Hunter Focus', text: 'Deals 30% more damage to bosses.', effect: { kind: 'bossDamage', value: 1.3 } } },
      { formName: 'Form IV', art: 'asc_test_f4', baseAtk: 11, baseHp: 64, ult: { kind: 'strike', mult: 3, plusMult: 4 }, charge: { stacks: 6, boost: 'bossDamage', value: 1 } },
    ],
    // Dark counters the Light element boss (stage 1000).
    steps: standardSteps(1000),
  },
];

export function ascendantDef(id: string): AscendantDef | undefined {
  return ASCENDANT_HEROES.find((a) => a.base.id === id);
}

export function isAscendant(id: string): boolean {
  return ASCENDANT_HEROES.some((a) => a.base.id === id);
}
