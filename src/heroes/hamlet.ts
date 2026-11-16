import type { HeroDef } from '../data';

/**
 * Hamlet (2026-11-16, Samuel): a cheerful pig squire who carries his knight's banner and pack into every fight.
 * From Samuel's own picture (art/hamlet in the project files). Water Support, Rare: heals from the back row, and
 * every few seconds raises his banner to cheer on the heroes around him.
 * HIDDEN until his pixel art arrives: not in RELEASED_HEROES (release = add 'hamlet' there).
 */
export const HAMLET: HeroDef = {
  id: 'hamlet', rarity: 'rare', name: 'Hamlet', element: 'water', type: 'Support',
  baseAtk: 2.8, baseHp: 58, range: 140, attackCooldown: 1.2, moveSpeed: 105, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1, heals: true,
  signature: { kind: 'banner', every: 12, radius: 220, atk: 0.2, heal: 0.08, seconds: 5 },
  sigPlus: 'The banner reaches the whole team and cheers them on for +30% ATK.',
  ult: { kind: 'rally', shield: 0.3 },
  ultPlus: 'Rally the Herd also frees every hero from freezes, roots, slows, poison and burns.',
  bio: 'A cheerful pig squire in a borrowed helmet who carries his knight\'s banner, pack and spare helmet into every fight, and never once lets the banner touch the ground.',
  basic: { name: 'Banner Splash', text: 'Heals the most hurt ally; when nobody needs healing he flicks sparkling sea water at the nearest enemy.' },
  ultimate: { name: 'Rally the Herd', text: 'Plants his banner and fully heals every living hero, then shields each one for 30% of their own max HP. 5★: also frees them of freezes, roots, slows, poison and burns.' },
  trait: { name: "Squire's Banner", text: 'Every 12 seconds he raises his banner: heroes near him get +20% ATK for 5 seconds and heal 8% of their max HP.' },
  sp1: { name: 'Packed Lunch', text: 'Heals are 30% stronger.', effect: { kind: 'healPower', value: 1.3 } },
  sp2: { name: 'Spare Helmet', text: 'Takes 20% less damage.', effect: { kind: 'damageTaken', value: 0.8 } },
  aura: { name: 'Herd Spirit', text: 'Water heroes +8% HP.', effect: { kind: 'hp', value: 1.08, team: true, element: 'water' } },
};
