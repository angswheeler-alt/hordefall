import type { HeroDef } from '../data';

/**
 * Yeren (2026-11-16, Samuel): a stubborn young wall guard from a walled valley town who can turn into a colossal
 * giant of living rock. The third one-of-a-kind hero, after Pasta and Gogu, and the Earth one. Original design: his
 * own name, look and kit. Samuel (2026-11-16): a colossal titan and a tank. He fights at normal size as a shield
 * Knight, builds Rage (mostly from the hits he soaks), then rises as a towering colossus for a while: a huge stone
 * body that soaks the damage, pulls every enemy that can reach him onto himself, scorches enemies around his feet
 * with the heat of its glowing cracks, and slow, crushing stomps. Counters: flyers (the titan is ground melee),
 * burst damage that breaks the titan's body early (he is cut out and stunned), and fights where nobody hits him.
 * Released 2026-11-16 with Samuel's sprites (art/heroes/yeren); his colossus is his own sprite scaled up and
 * stone-tinted until the titan art (yeren_titan) lands.
 */
export const YEREN: HeroDef = {
  id: 'yeren', rarity: 'epic', unique: true, statRarity: 'legendary', name: 'Yeren', element: 'earth',
  type: 'Knight', baseAtk: 3.4, baseHp: 165, range: 30, attackCooldown: 1.15, moveSpeed: 95, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1, steadfast: true,
  signature: { kind: 'titan', rage: 100, perHit: 5, perHpLost: 3, seconds: 15, body: 4, atk: 1.8, cooldown: 1.25, stomp: 60, reach: 25, brokenStun: 2, taunt: 40, heat: 70, heatDps: 0.35, scale: 2.4 },
  sigPlus: 'Hardened Hide: his colossus takes 30% less damage and stands 4 seconds longer.',
  ult: { kind: 'roar', mult: 1.5, radius: 160, stun: 2, extend: 5, vuln: 1.2, vulnSeconds: 6 },
  ultPlus: 'The blast cracks their guard: every enemy it hits takes 20% more damage for 6 seconds.',
  bio: 'A stubborn young wall guard from a valley town that the monsters overran. He swore nothing would ever get past him again, and when his rage boils over, the earth answers and he rises as a colossus of living rock, tall as the wall itself.',
  basic: { name: 'Wall Guard', text: 'Steady blows with his short blade from behind a heavy stone shield. As the colossus: slow, crushing stomps that hit every enemy near the target.' },
  ultimate: { name: 'Colossal Rising', text: 'He rises as his colossus at once (or stands 5 seconds longer) in a blast of rock and scorching heat that hits every enemy close ahead and stuns regular enemies for 2 seconds. 5★: the enemies it hits take 20% more damage for 6 seconds.' },
  trait: { name: 'Colossal Shift', text: 'Every hit he takes and every blow he lands fills his Rage (hits taken fill it fastest). At full Rage a bolt from the sky turns him into a colossus of living rock for 15 seconds. Its stone body is worth 4x his max HP and takes the hits instead of him, and every enemy that can reach him attacks him instead of his team. The heat of its glowing cracks scorches enemies around his feet, and its slow stomps hit every enemy near the target (1.8x damage). If the body breaks he is cut out early and stunned for 2 seconds. Flyers are out of his reach in both forms.' },
  sp1: { name: 'Unbreakable Will', text: 'Rage builds 50% faster.', effect: { kind: 'rageGain', value: 1.5 } },
  sp2: { name: 'Titan Bulk', text: 'His colossus\'s stone body is 30% bigger.', effect: { kind: 'titanBody', value: 1.3 } },
  aura: { name: "Shifter's Wall", text: 'While he is a colossus, the rest of the team takes 25% less damage.', effect: { kind: 'titanGuard', value: 0.75, team: true } },
};
