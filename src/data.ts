export type Element = 'water' | 'fire' | 'earth' | 'light' | 'dark';
export type Job = 'Blademaster' | 'Mage' | 'Knight' | 'Rogue' | 'Support';

export interface HeroDef {
  id: string;
  name: string;
  element: Element;
  job: Job;
  /** Attack and HP at gold level 1. */
  baseAtk: number;
  baseHp: number;
  /** Attack reach in pixels. */
  range: number;
  /** Seconds between attacks. */
  attackCooldown: number;
  /** Pixels per second. */
  moveSpeed: number;
  /** Gold to recruit the hero (0 = starts unlocked). */
  unlockCost: number;
  /** Gold cost of level 1 -> 2. */
  upgradeBaseCost: number;
  /** Gold multiplier on kills (Rogues earn 2x). */
  goldMult: number;
  /** Ranged attacks splash enemies within this radius. */
  splash?: number;
  heals?: boolean;
}

export const ELEMENT_COLORS: Record<Element, number> = {
  water: 0x3fa9f5,
  fire: 0xf5603f,
  earth: 0x6cbf3a,
  light: 0xf5d63f,
  dark: 0x9b59d0,
};

// Starter cast from GDD section 17. The prototype runs a team of five, one per element.
export const HEROES: HeroDef[] = [
  { id: 'marin', name: 'Marin', element: 'water', job: 'Blademaster', baseAtk: 5, baseHp: 60, range: 28, attackCooldown: 0.8, moveSpeed: 55, unlockCost: 0, upgradeBaseCost: 5, goldMult: 1 },
  { id: 'bramble', name: 'Bramble', element: 'earth', job: 'Knight', baseAtk: 3, baseHp: 150, range: 26, attackCooldown: 1.0, moveSpeed: 45, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1 },
  { id: 'pyra', name: 'Pyra', element: 'fire', job: 'Mage', baseAtk: 8, baseHp: 40, range: 150, attackCooldown: 1.4, moveSpeed: 45, unlockCost: 300, upgradeBaseCost: 40, goldMult: 1, splash: 40 },
  { id: 'nox', name: 'Nox', element: 'dark', job: 'Rogue', baseAtk: 6, baseHp: 50, range: 24, attackCooldown: 0.6, moveSpeed: 80, unlockCost: 1500, upgradeBaseCost: 120, goldMult: 2 },
  { id: 'solenne', name: 'Solenne', element: 'light', job: 'Support', baseAtk: 3, baseHp: 55, range: 130, attackCooldown: 1.2, moveSpeed: 45, unlockCost: 8000, upgradeBaseCost: 400, goldMult: 1, heals: true },
];

/**
 * Element advantage from GDD section 4: Fire > Earth > Water > Fire at 4x,
 * Light and Dark beat each other at 2x.
 */
export function elementMultiplier(attacker: Element, defender: Element): number {
  const beats: Partial<Record<Element, Element>> = { fire: 'earth', earth: 'water', water: 'fire' };
  if (beats[attacker] === defender) return 4;
  if ((attacker === 'light' && defender === 'dark') || (attacker === 'dark' && defender === 'light')) return 2;
  return 1;
}

const ENEMY_ELEMENTS: Element[] = ['earth', 'fire', 'water', 'light', 'dark'];

/** Regular enemies rotate element by stage. */
export function enemyElement(stage: number): Element {
  return ENEMY_ELEMENTS[(stage - 1) % ENEMY_ELEMENTS.length];
}

/** Before stage 600 every boss is weak to Water (GDD section 4), so bosses are Fire. */
export function bossElement(_stage: number): Element {
  return 'fire';
}

export const BOSS_EVERY = 50;
export const BOSS_TIME_LIMIT = 30;
export const RESPAWN_SECONDS = 5;
export const ULT_UNLOCK_LEVEL = 30;
export const ULT_COOLDOWN = 30;
export const ULT_MULTIPLIER = 40;
export const OFFLINE_CAP_HOURS = 12;

export const BOSS_NAMES = ['Grubjaw the Glutton', 'Sir Rattlecan', 'Mother Mireling', 'Cogsworth Crusher', 'The Molten Abbot'];
