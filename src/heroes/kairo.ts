import type { HeroDef } from '../data';

/**
 * Kairo (2026-11-14, Samuel): a one-of-a-kind cheerful mountain martial artist who lives to fight someone stronger.
 * Original design: his own name, look and kit. Power Surge (golden aura stages that climb the longer he stays up)
 * at 1★, a lane-wide Sky Cannon Ultimate, and at 6★ a second wind when he is nearly down.
 * Hidden (not in RELEASED_HEROES) until his art is in.
 */
export const KAIRO: HeroDef = {
  id: 'kairo', rarity: 'epic', statRarity: 'legendary', name: 'Kairo', element: 'light',
  type: 'Brawler', baseAtk: 5.8, baseHp: 90, range: 30, attackCooldown: 0.85, moveSpeed: 135, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1,
  signature: { kind: 'surge', every: 8, atk: [0.3, 0.6, 1], haste: 0.85, hasteFrom: 2 },
  sigPlus: 'The first time each life he drops under 20% HP, he heals 30% of his max HP and jumps up a surge stage.',
  ult: { kind: 'cannon', mult: 1, perAlly: 0.2, maxAllies: 5 },
  ultPlus: 'Spirit Sphere: the blast hits 20% harder for each living teammate (up to +100%).',
  bio: 'A cheerful martial artist from the high mountain passes who trains every waking hour and lives for a fight with someone stronger. The longer a battle lasts, the brighter his golden aura burns.',
  basic: { name: 'Mountain Fist', text: 'Quick punches and kicks at the nearest enemy ahead.' },
  ultimate: { name: 'Sky Cannon', text: 'He cups his hands, gathers his power and fires a blast of golden light that hits every enemy ahead in the lane. 5★: Spirit Sphere, 20% harder for each living teammate (up to +100%).' },
  trait: { name: 'Power Surge', text: 'Every 8 seconds he stays standing in a fight, his aura flares up a stage, up to 3: +30% ATK, then +60% and 15% faster attacks, then +100% ATK. Falling drops him back to no surge.' },
  sp1: { name: 'Afterimage', text: 'Dodges 15% more attacks, leaving a blur behind; his next hit after a dodge is a sure crit.', effect: { kind: 'afterimage', value: 0.15 } },
  sp2: { name: "Rival's Grin", text: 'Deals 25% more damage to bosses.', effect: { kind: 'bossDamage', value: 1.25 } },
  aura: { name: 'Training Partner', text: 'The whole team gets +5% ATK for each surge stage he has reached.', effect: { kind: 'surgeRally', value: 0.05, team: true } },
};
