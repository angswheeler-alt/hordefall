import type { HeroDef } from '../data';

/**
 * Yeren (2026-11-16, Samuel): a furious young scout from a walled valley town who can turn into a giant of living
 * rock. The third one-of-a-kind hero, after Pasta and Gogu, and the Earth one. Original design: his own name, look
 * and kit. He fights at normal size with twin cleaver blades and a grapple rig, builds Rage, then shifts into a
 * towering Earth titan for a few seconds (bigger, much harder hits that stomp a crowd, its own body soaking the
 * damage) and turns back. Counters: flyers (the titan is ground melee), burst damage that breaks the titan's body
 * early (he is cut out and stunned), and fights that end before his Rage fills.
 * Hidden until his art arrives (data.ts HIDDEN_HEROES, arenaShop.ts YEREN_RELEASED).
 */
export const YEREN: HeroDef = {
  id: 'yeren', rarity: 'epic', unique: true, statRarity: 'legendary', name: 'Yeren', element: 'earth',
  type: 'Barbarian', baseAtk: 6.2, baseHp: 72, range: 30, attackCooldown: 0.95, moveSpeed: 120, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1, steadfast: true,
  signature: { kind: 'titan', rage: 100, perHit: 10, perHpLost: 1.5, seconds: 12, body: 2.5, atk: 3.5, cooldown: 1, stomp: 45, reach: 15, brokenStun: 2 },
  sigPlus: 'Hardened Hide: his titan takes 30% less damage and lasts 4 seconds longer.',
  ult: { kind: 'roar', mult: 1.2, radius: 140, stun: 1.5, extend: 4, vuln: 1.2, vulnSeconds: 6 },
  ultPlus: 'The quake cracks their guard: every enemy it hits takes 20% more damage for 6 seconds.',
  bio: 'A furious young scout from a walled valley town that the monsters overran. He swore to drive every last one of them out, and when his rage boils over, the earth answers and he rises as a giant of living rock.',
  basic: { name: 'Twin Cleavers', text: 'Fast slashes with two short blades at the nearest enemy ahead. As the titan: huge stone fists that stomp every enemy near the target.' },
  ultimate: { name: 'Earthshatter Roar', text: 'He shifts into his titan at once (or roars to stay one 4 seconds longer) and the quake hits every enemy close ahead, stunning regular enemies for 1.5 seconds. 5★: the enemies it hits take 20% more damage for 6 seconds.' },
  trait: { name: 'Titan Shift', text: 'Every blow he lands and every hit he takes fills his Rage. At full Rage a bolt from the sky turns him into a giant titan of living rock for 12 seconds: 3.5x damage, a stomp that hits every enemy near the target, a little more reach, and a stone body worth 2.5x his max HP that takes the hits instead of him. If the titan\'s body breaks he is cut out early and stunned for 2 seconds. Flyers are out of his reach in both forms.' },
  sp1: { name: 'Grapple Rig', text: 'Rage builds 50% faster.', effect: { kind: 'rageGain', value: 1.5 } },
  sp2: { name: 'Titan Bulk', text: 'His titan\'s stone body is 30% bigger.', effect: { kind: 'titanBody', value: 1.3 } },
  aura: { name: "Shifter's Wall", text: 'While he is a titan, the rest of the team takes 20% less damage.', effect: { kind: 'titanGuard', value: 0.8, team: true } },
};
