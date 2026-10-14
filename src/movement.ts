import type { HeroType } from './data';

/**
 * How heroes move on the battle lane. Each hero walks at its own Move Speed (separate from attack speed),
 * so faster heroes reach the enemy first, but three soft rules keep the team together:
 * - Combat first: a hero with an enemy in range stops to fight (BattleScene does this before moving).
 * - A marching hero gets at most MARCH_LEAD ahead of teammates who are still marching behind it.
 * - Preferred positions by Type: melee Types engage at the front; Rangers, Gunners and Magicians stay a
 *   step behind the frontmost melee ally and shoot from their range; Supports keep just behind the
 *   frontmost ally of any other Type, close enough to help.
 * Melee heroes can still pass each other (a fast Rogue can go in ahead of the Knight).
 */
export type LanePosition = 'front' | 'ranged' | 'support';

export const TYPE_POSITION: Record<HeroType, LanePosition> = {
  Knight: 'front',
  Brawler: 'front',
  Barbarian: 'front',
  Samurai: 'front',
  Lancer: 'front',
  Rogue: 'front',
  Ranger: 'ranged',
  Gunner: 'ranged',
  Magician: 'ranged',
  Support: 'support',
};

/** How far (px) a marching hero may get ahead of teammates still marching behind it. */
export const MARCH_LEAD = 80;
/** Teammates further back than this (just respawned at the crystal) don't hold the others back. */
export const STRAGGLER_RANGE = 220;
/** Ranged heroes and Supports stay at least this far behind the ally they keep behind. */
export const BACKLINE_GAP = 24;

export interface Marcher {
  x: number;
  type: HeroType;
  alive: boolean;
  /** Fighting (an enemy or the crystal in range) rather than walking. */
  engaged: boolean;
}

/** The furthest right `self` may walk to this frame (Infinity when nothing holds it back). */
export function marchCap(self: Marcher, team: readonly Marcher[]): number {
  let cap = Infinity;
  let front = -Infinity;
  const pos = TYPE_POSITION[self.type];
  for (const m of team) {
    if (m === self || !m.alive || m.x < self.x - STRAGGLER_RANGE) continue;
    if (!m.engaged && m.x < self.x) cap = Math.min(cap, m.x + MARCH_LEAD);
    const anchor = pos === 'ranged' ? TYPE_POSITION[m.type] === 'front' : pos === 'support' && TYPE_POSITION[m.type] !== 'support';
    if (anchor) front = Math.max(front, m.x);
  }
  return front === -Infinity ? cap : Math.min(cap, front - BACKLINE_GAP);
}

/** Where a marching hero ends up after `dt` seconds at `speed` px/s: never past `cap` or `stopAt`, never backwards. */
export function marchStep(x: number, speed: number, dt: number, cap: number, stopAt: number): number {
  return Math.max(x, Math.min(x + speed * dt, cap, stopAt));
}
