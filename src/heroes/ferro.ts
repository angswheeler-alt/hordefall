import type { HeroDef } from '../data';

/**
 * Ferro (2026-11-16, Samuel asked for an armored Fire hero who flies and attacks from the air): the third one-of-a-kind
 * hero after Pasta and Gogu, sold in the Arena Shop. Original design: a Market Row foundry tinkerer who built a flying
 * suit of brass-and-crimson armor around a little sun-forge in its chest. Ground melee can't reach him in the air, but
 * his armor is thin (Gunner HP), bosses, shooters and flyers hit him as usual, and once he is badly hurt his thrusters
 * cut out and he lands, where anything can hit him until he is healed back up.
 * Released 2026-11-16 with Samuel's sprites (art/heroes/ferro).
 */
export const FERRO: HeroDef = {
  id: 'ferro', rarity: 'epic', unique: true, statRarity: 'legendary', name: 'Ferro', element: 'fire',
  type: 'Gunner', flying: true, baseAtk: 6.4, baseHp: 46, range: 175, attackCooldown: 1.0, moveSpeed: 125, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1,
  signature: { kind: 'reactor', every: 6, missiles: 4, plusMissiles: 2, mult: 0.6, reach: 320, landBelow: 0.35, liftAt: 0.6 },
  sigPlus: 'Smart Missiles: every Salvo fires 6 missiles instead of 4.',
  ult: { kind: 'solar', mult: 2.5, line: 0.6, reach: 300 },
  ultPlus: 'Full Payload: the beam also fires a Missile Salvo at once.',
  bio: 'A foundry tinkerer from Market Row who built a flying suit of brass-and-crimson armor around a little sun-forge in its chest. He fights from the sky, out of reach of anything that swings from the ground, but the suit is thin, and when it is badly hurt its thrusters sputter out.',
  basic: { name: 'Palm Blaster', text: 'Hovers in the sky and fires blasts of heat from his gauntlets at the nearest enemy.' },
  ultimate: { name: 'Sun-Forge Lance', text: 'His chest forge fires a beam at the toughest enemy within 300 px for 2.5x the Ultimate hit; every other enemy along the beam takes 0.6x. Then his forge is full, so his next shot fires a Missile Salvo. 5★: Full Payload, the Salvo fires at once with the beam.' },
  trait: { name: 'Missile Salvo', text: 'Flies over the lane, where ground melee enemies can’t reach him. Every 6th shot also launches 4 shoulder missiles at different enemies up to 320 px ahead (spare missiles all hit the toughest): 0.6x ATK each, setting them Burning. When his HP drops under 35%, his thrusters cut out and he lands, where anything can hit him, until he is healed back over 60% (or falls and comes back).' },
  sp1: { name: 'Afterburners', text: 'Attacks 15% faster, so Salvos come sooner too.', effect: { kind: 'attackSpeed', value: 0.85 } },
  sp2: { name: 'Thermite Rounds', text: '+40% damage to Burning enemies.', effect: { kind: 'vsBurning', value: 1.4 } },
  aura: { name: 'Air Cover', text: 'Fire heroes get +20% ATK.', effect: { kind: 'atk', value: 1.2, team: true, element: 'fire' } },
};
