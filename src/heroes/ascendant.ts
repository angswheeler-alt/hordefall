import type { HeroDef } from '../data';
import { standardSteps, chargeText, type AscendantDef, type Charge } from '../ascendant';
import { VS, ULT } from '../heroText';

/**
 * Ascendant heroes (src/ascendant.ts). Not part of HEROES or RELEASED_HEROES yet, so nothing here reaches the
 * game. asc_test is a stand-in to build and test the framework with. The five real heroes use codename ids
 * (asc_dark...); their names, form names and art keys live only in their entries here.
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
const darkC: Charge[] = [
  { stacks: 6, boost: 'damage', value: 1 },
  { stacks: 6, boost: 'pierce', value: 1.5 },
  { stacks: 5, boost: 'pierce', value: 2 },
  { stacks: 5, boost: 'bossDamage', value: 3 },
];
const ascDark: AscendantDef = {
  base: {
    ...base, id: 'asc_dark', name: 'Zanshin', element: 'dark', type: 'Samurai', baseAtk: 5.2, baseHp: 46, range: 28, attackCooldown: 0.8, moveSpeed: 140,
    signature: { kind: 'execute', below: 0.25, mult: 1.5 },
    sigPlus: 'Executes from 40% HP instead of 25%, and each kill takes 2 seconds off the Ultimate cooldown.',
    ult: { kind: 'strike', mult: 3, plusMult: 4 },
    ultPlus: 'The cut hits for 4x instead of 3x.',
    bio: 'A young swordsman who carries a bandaged cleaver taller than he is.',
    basic: { name: 'Cleaver Chop', text: 'Heavy chops at the nearest enemy ahead.' },
    ultimate: { name: 'Grave Cut', text: `${ULT('One huge dark cut hits')} The enemy in front takes 3x more.` },
    trait: sig('Finishing Cut', 'Hits enemies under 25% HP for 1.5x damage.', darkC[0], 'dark'),
    sp1: { name: 'Second Swing', text: '20% chance for each attack to strike twice.', effect: { kind: 'doubleStrike', value: 0.2 } },
    sp2: { name: 'Sharp Eye', text: '+10% critical hit chance.', effect: { kind: 'crit', value: 0.1 } },
    aura: { name: 'Night Resolve', text: 'Dark heroes +20% ATK.', effect: { kind: 'atk', value: 1.2, team: true, element: 'dark' } },
  },
  forms: [
    { formName: 'Grave Warden', art: 'asc_dark', charge: darkC[0] },
    { formName: 'Moonhewn Edge', art: 'asc_dark_f2', baseAtk: 5.8, baseHp: 50, attackCooldown: 0.78, charge: darkC[1],
      bio: 'The bandages are off. His cleaver now throws crescent waves of violet light.',
      trait: sig('Crescent Wave', 'Hits enemies under 25% HP for 1.5x damage.', darkC[1], 'dark') },
    { formName: 'Nightfall Blade', art: 'asc_dark_f3', baseAtk: 6.4, baseHp: 54, attackCooldown: 0.75, range: 70, charge: darkC[2],
      bio: 'A slim black sword and a ragged coat. His slashes now fly far enough to hit enemies in the sky.',
      basic: { name: 'Flying Slash', text: 'Slashes that fly a short way, reaching enemies in the sky.' },
      trait: sig('Crescent Wave', 'Hits enemies under 25% HP for 1.5x damage.', darkC[2], 'dark'),
      sp2: { name: 'Hunter of Giants', text: 'Deals 30% more damage to bosses.', effect: { kind: 'bossDamage', value: 1.3 } } },
    { formName: 'Void Ascendant', art: 'asc_dark_f4', baseAtk: 6.8, baseHp: 58, attackCooldown: 0.74, charge: darkC[3],
      bio: 'His final form: twin blades of dark energy and an aura of black flame.',
      ult: { kind: 'strike', mult: 5, plusMult: 7 },
      ultPlus: 'The cut hits for 7x instead of 5x.',
      ultimate: { name: 'Void Cross', text: `${ULT('A giant black cross-cut hits')} The enemy in front takes 5x more.` },
      trait: sig('Void Crescent', 'Hits enemies under 25% HP for 1.5x damage.', darkC[3], 'dark') },
  ],
  // Dark counters the Light element boss (stage 1000).
  steps: standardSteps(1000),
};

// ---- Fire: Kip, a stretchy brawler who heats up with each form. Crowd clear and combos; no flyers. ----
const fireC: Charge[] = [
  { stacks: 5, boost: 'area', value: 1 },
  { stacks: 5, boost: 'area', value: 1.5 },
  { stacks: 4, boost: 'area', value: 2 },
  { stacks: 4, boost: 'area', value: 3 },
];
const ascFire: AscendantDef = {
  base: {
    ...base, id: 'asc_fire', name: 'Kip', element: 'fire', type: 'Brawler', baseAtk: 5, baseHp: 80, range: 26, attackCooldown: 1.0, moveSpeed: 125,
    signature: { kind: 'combo', perHit: 0.06, max: 0.3 },
    sigPlus: 'After a kill, half the combo carries over to the next enemy.',
    ult: { kind: 'meteor', seconds: 4, groundDps: 1.5, second: 0.5 },
    ultPlus: 'A second blow lands a moment later for half damage.',
    bio: 'A grinning deckhand in a straw sun hat whose arms stretch like rubber.',
    basic: { name: 'Stretch Punch', text: 'Rubbery punches at the nearest enemy ahead.' },
    ultimate: { name: 'Giant Fist', text: `${ULT('A giant flaming fist slams down on')} Leaves burning ground for 4 seconds.` },
    trait: sig('Hot Streak', 'Each hit in a row on one enemy adds 6% damage, up to +30%.', fireC[0], 'fire'),
    sp1: { name: 'Rapid Fists', text: 'Attacks 15% faster.', effect: { kind: 'attackSpeed', value: 0.85 } },
    sp2: { name: 'Rubber Body', text: 'Takes 20% less damage.', effect: { kind: 'damageTaken', value: 0.8 } },
    aura: { name: 'Crew Spirit', text: 'Fire heroes +20% ATK.', effect: { kind: 'atk', value: 1.2, team: true, element: 'fire' } },
  },
  forms: [
    { formName: 'Deckhand', art: 'asc_fire', charge: fireC[0] },
    { formName: 'Steam Gear', art: 'asc_fire_f2', baseAtk: 5.3, baseHp: 88, attackCooldown: 0.9, charge: fireC[1],
      bio: 'Steam pours off him as his blood runs hot. Faster fists, longer combos.',
      signature: { kind: 'combo', perHit: 0.06, max: 0.45 },
      trait: sig('Steam Streak', 'Each hit in a row on one enemy adds 6% damage, up to +45%.', fireC[1], 'fire') },
    { formName: 'Iron Bounce', art: 'asc_fire_f3', baseAtk: 5.6, baseHp: 96, attackCooldown: 0.88, charge: fireC[2],
      bio: 'Puffed up into a bouncing ball of muscle with giant fists.',
      sp1: { name: 'Bounce Slam', text: 'Every 4th attack slams the ground for 2x damage to every enemy near the target.', effect: { kind: 'slam', value: 2, every: 4 } },
      trait: sig('Steam Streak', 'Each hit in a row on one enemy adds 6% damage, up to +45%.', fireC[2], 'fire'),
      signature: { kind: 'combo', perHit: 0.06, max: 0.45 } },
    { formName: 'Sunburst', art: 'asc_fire_f4', baseAtk: 5.9, baseHp: 105, attackCooldown: 0.86, charge: fireC[3],
      bio: 'His final form: white hair, a carefree grin, and fists that hit like the sun.',
      signature: { kind: 'combo', perHit: 0.08, max: 0.6 },
      ult: { kind: 'meteor', seconds: 6, groundDps: 2, second: 0.6 },
      ultPlus: 'A second blow lands a moment later for 60% damage.',
      ultimate: { name: 'Sunburst Fist', text: `${ULT('A fist the size of the sky slams down on')} Leaves burning ground for 6 seconds.` },
      trait: sig('Sun Streak', 'Each hit in a row on one enemy adds 8% damage, up to +60%.', fireC[3], 'fire') },
  ],
  // Fire counters the Earth element boss (stage 800).
  steps: standardSteps(800),
};

// ---- Light: Valeth, a winged warrior whose attacks speed up the longer she fights. Slow start, little burst. ----
const lightC: Charge[] = [
  { stacks: 6, boost: 'attackSpeed', value: 0.3 },
  { stacks: 6, boost: 'attackSpeed', value: 0.4 },
  { stacks: 5, boost: 'attackSpeed', value: 0.5 },
  { stacks: 5, boost: 'attackSpeed', value: 0.6 },
];
const ascLight: AscendantDef = {
  base: {
    ...base, id: 'asc_light', name: 'Valeth', element: 'light', type: 'Ranger', flying: true, baseAtk: 5, baseHp: 40, range: 150, attackCooldown: 1.0, moveSpeed: 115,
    signature: { kind: 'combo', perHit: 0.04, max: 0.3 },
    sigPlus: 'After a kill, half the combo carries over to the next enemy.',
    ult: { kind: 'mark', mult: 1.2, seconds: 5, plusMult: 1.35, plusSeconds: 8 },
    ultPlus: 'The verdict lasts 8 seconds and adds 35% instead of 20%.',
    bio: 'A young winged warrior in white-and-gold armor with a softly glowing sword.',
    basic: { name: 'Light Bolt', text: 'Bolts of light from her sword at the nearest enemy.' },
    ultimate: { name: 'Sky Verdict', text: `${ULT('A pillar of light hits')} Marks them: they take 20% more damage from the whole team for 5 seconds.` },
    trait: sig('Rising Light', 'Each hit in a row on one enemy adds 4% damage, up to +30%.', lightC[0], 'light'),
    sp1: { name: 'Twin Feathers', text: 'Each shot also hits the next enemy just behind the target.', effect: { kind: 'pierce', value: 1 } },
    sp2: { name: 'Swift Wings', text: 'Attacks 15% faster.', effect: { kind: 'attackSpeed', value: 0.85 } },
    aura: { name: 'Halo Chorus', text: 'Light heroes +20% ATK.', effect: { kind: 'atk', value: 1.2, team: true, element: 'light' } },
  },
  forms: [
    { formName: 'Squire of Dawn', art: 'asc_light', charge: lightC[0] },
    { formName: 'First Feather', art: 'asc_light_f2', baseAtk: 5.6, baseHp: 42, attackCooldown: 0.95, range: 170, charge: lightC[1],
      bio: 'Two pairs of wings and a sword wrapped in golden flame.',
      trait: sig('Rising Light', 'Each hit in a row on one enemy adds 4% damage, up to +30%.', lightC[1], 'light') },
    { formName: 'Radiant Warden', art: 'asc_light_f3', baseAtk: 6.2, baseHp: 44, attackCooldown: 0.9, range: 185, charge: lightC[2],
      bio: 'Three pairs of wings. Her sword sends out sweeping waves of light.',
      signature: { kind: 'combo', perHit: 0.05, max: 0.4 },
      trait: sig('Radiant Light', 'Each hit in a row on one enemy adds 5% damage, up to +40%.', lightC[2], 'light') },
    { formName: 'Lightborn', art: 'asc_light_f4', baseAtk: 6.6, baseHp: 46, attackCooldown: 0.85, range: 200, splash: 24, charge: lightC[3],
      bio: 'Her final form: four pairs of wings made of light, and a sword of pure light.',
      basic: { name: 'Gleam Wave', text: 'Waves of light that also hit enemies close to the target.' },
      signature: { kind: 'combo', perHit: 0.05, max: 0.5 },
      ult: { kind: 'mark', mult: 1.3, seconds: 6, plusMult: 1.5, plusSeconds: 10 },
      ultPlus: 'The verdict lasts 10 seconds and adds 50% instead of 30%.',
      ultimate: { name: 'Final Verdict', text: `${ULT('A storm of light pillars hits')} Marks them: they take 30% more damage from the whole team for 6 seconds.` },
      trait: sig('Radiant Light', 'Each hit in a row on one enemy adds 5% damage, up to +50%.', lightC[3], 'light') },
  ],
  // Light counters the Dark element boss (stage 900).
  steps: standardSteps(900),
};

// ---- Water: Spout, a shelled water cannon. Durable artillery; slow attacks, slow walker. ----
const waterC: Charge[] = [
  { stacks: 4, boost: 'damage', value: 1 },
  { stacks: 4, boost: 'area', value: 1 },
  { stacks: 4, boost: 'pierce', value: 2 },
  { stacks: 3, boost: 'area', value: 2.5 },
];
const ascWater: AscendantDef = {
  base: {
    ...base, id: 'asc_water', name: 'Spout', element: 'water', type: 'Gunner', baseAtk: 6, baseHp: 52, range: 160, attackCooldown: 1.3, moveSpeed: 95,
    signature: { kind: 'knockback', push: 20 },
    ult: { kind: 'washback', push: 160, haste: 0.7, hasteSeconds: 5 },
    ultPlus: 'The wave leaves the team attacking 30% faster for 5 seconds.',
    bio: 'A cheerful little turtle who squirts water hard enough to knock enemies back.',
    basic: { name: 'Water Jet', text: 'Strong water jets at the nearest enemy.' },
    ultimate: { name: 'Tidal Spout', text: `${ULT('A huge wave washes over')} Pushes regular enemies back.` },
    trait: sig('Water Pressure', 'His shots push regular enemies back.', waterC[0], 'water'),
    sp1: { name: 'Double Squirt', text: '20% chance for each attack to fire twice.', effect: { kind: 'doubleStrike', value: 0.2 } },
    sp2: { name: 'Iron Shell', text: 'Takes 25% less damage.', effect: { kind: 'damageTaken', value: 0.75 } },
    aura: { name: 'Shell Wall', text: 'Water heroes +20% HP.', effect: { kind: 'hp', value: 1.2, team: true, element: 'water' } },
  },
  forms: [
    { formName: 'Puddle Shell', art: 'asc_water', charge: waterC[0] },
    { formName: 'Swirl Shell', art: 'asc_water_f2', baseAtk: 6.6, baseHp: 58, attackCooldown: 1.25, charge: waterC[1],
      bio: 'Bigger and bolder. He spins in his shell to spray water all around.',
      trait: sig('Water Pressure', 'His shots push regular enemies back.', waterC[1], 'water') },
    { formName: 'Twin Cannon', art: 'asc_water_f3', baseAtk: 7.2, baseHp: 64, attackCooldown: 1.2, range: 175, charge: waterC[2],
      bio: 'A heavy tortoise with two steel water cannons on his shell.',
      basic: { name: 'Twin Jets', text: 'High-pressure jets from both cannons.' },
      trait: sig('Water Pressure', 'His shots push regular enemies back.', waterC[2], 'water') },
    { formName: 'Megabore', art: 'asc_water_f4', baseAtk: 7.8, baseHp: 72, attackCooldown: 1.15, range: 185, splash: 30, charge: waterC[3],
      bio: 'His final form: a towering armored tortoise with one giant central cannon.',
      basic: { name: 'Cannon Blast', text: 'Cannon blasts that also hit enemies close to the target.' },
      ultPlus: 'The barrage leaves the team attacking 30% faster for 6 seconds.',
      ult: { kind: 'washback', push: 200, haste: 0.7, hasteSeconds: 6 },
      ultimate: { name: 'Megabore Barrage', text: `${ULT('A barrage from every cannon hits')} Pushes regular enemies far back.` },
      trait: sig('Full Pressure', 'His shots push regular enemies back.', waterC[3], 'water') },
  ],
  // Water counters the Fire element boss (stage 600).
  steps: standardSteps(600),
};

// ---- Earth: Aeron, a wind mage. His magic looks like wind but every hit is Earth. Fast multi-target; fragile. ----
const earthC: Charge[] = [
  { stacks: 5, boost: 'area', value: 1 },
  { stacks: 5, boost: 'pierce', value: 1.5 },
  { stacks: 4, boost: 'area', value: 2 },
  { stacks: 4, boost: 'area', value: 2.5 },
];
const ascEarth: AscendantDef = {
  base: {
    ...base, id: 'asc_earth', name: 'Aeron', element: 'earth', type: 'Magician', baseAtk: 6.5, baseHp: 38, range: 140, attackCooldown: 1.2, moveSpeed: 110, splash: 20,
    signature: { kind: 'slow', chance: 0.25, mult: 0.6, seconds: 2 },
    ult: { kind: 'earthen', seconds: 6, plusSeconds: 10 },
    ultPlus: 'The gale lasts 10 seconds.',
    bio: 'A calm young mage with a floating spellbook. His spells look like wind, but they strike as Earth.',
    basic: { name: 'Wind Blade', text: 'Blades of wind that also hit enemies close to the target.' },
    ultimate: { name: 'Gale of the Land', text: `${ULT('A gale of earth-charged wind hits')} For 6 seconds every hero except Fire deals Earth damage.` },
    trait: sig('Tailwind', '25% chance to slow enemies hit to 60% speed for 2 seconds.', earthC[0], 'earth'),
    sp1: { name: 'Twin Blades', text: '20% chance for each attack to cast twice.', effect: { kind: 'doubleStrike', value: 0.2 } },
    sp2: { name: 'Wide Gust', text: 'Splash radius +30%.', effect: { kind: 'splash', value: 1.3 } },
    aura: { name: 'Steady Ground', text: 'Earth heroes +20% ATK.', effect: { kind: 'atk', value: 1.2, team: true, element: 'earth' } },
  },
  forms: [
    { formName: 'Wind Novice', art: 'asc_earth', charge: earthC[0] },
    { formName: 'Spirit Call', art: 'asc_earth_f2', baseAtk: 7.2, baseHp: 40, attackCooldown: 1.1, range: 150, charge: earthC[1],
      bio: 'A little wind spirit now rides on his shoulder and adds its own blades.',
      basic: { name: 'Blade Fan', text: 'Fans of wind blades that also hit enemies close to the target.' },
      trait: sig('Tailwind', '25% chance to slow enemies hit to 60% speed for 2 seconds.', earthC[1], 'earth') },
    { formName: 'Spirit Merge', art: 'asc_earth_f3', baseAtk: 7.8, baseHp: 42, attackCooldown: 1.05, range: 160, splash: 30, charge: earthC[2],
      bio: 'Merged with his spirit: wings of air and armor of wind.',
      trait: sig('Tailwind', '25% chance to slow enemies hit to 60% speed for 2 seconds.', earthC[2], 'earth') },
    { formName: 'Storm Sovereign', art: 'asc_earth_f4', baseAtk: 8.4, baseHp: 44, attackCooldown: 1.0, range: 170, splash: 36, charge: earthC[3],
      bio: 'His final form: silver hair, great wings of wind, and a storm at his command.',
      ult: { kind: 'meteor', seconds: 6, groundDps: 1.5, second: 0.5 },
      ultPlus: 'A second storm front hits a moment later for half damage.',
      ultimate: { name: 'Sovereign Storm', text: `${ULT('A storm of earth-charged wind blades hits')} Leaves a raging storm for 6 seconds that hurts anything walking through it.` },
      trait: sig('Storm Wind', '25% chance to slow enemies hit to 60% speed for 2 seconds.', earthC[3], 'earth') },
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
