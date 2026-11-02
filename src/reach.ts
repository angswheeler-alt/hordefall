// Who can reach whom. Flyers (heroes and winged mobs) fly above the lane, out of reach of anyone who swings
// from the ground: melee attackers (reach of MELEE_REACH px or less) can't hit them unless they fly too. Ranged and magic
// attacks still can, and so do area effects (slams, ultimates) and bosses, which are big enough to swat
// anything in the sky.

/** Attack reach, px, at or under which an attacker counts as melee (as the Colosseum's melee front line does). */
export const MELEE_REACH = 60;

export interface Attacker {
  range: number;
  flying?: boolean;
  isBoss?: boolean;
}

export interface Target {
  flying?: boolean;
}

export function isMelee(a: { range: number }) {
  return a.range <= MELEE_REACH;
}

/** Whether `a` can hit `t` with a single-target attack. */
export function canReach(a: Attacker, t: Target): boolean {
  if (!t.flying) return true;
  return !isMelee(a) || !!a.flying || !!a.isBoss;
}

/** Slack, px, for a target that is level with or a touch behind the attacker. */
const BEHIND_SLACK = 12;

export interface Placed extends Target {
  x: number;
  alive: boolean;
}

/**
 * Who an enemy goes for. It takes the nearest hero it can reach in front of it (it walks left), or failing
 * that the nearest one it can reach anywhere. When every hero left flies over a melee enemy's head it has no
 * target and instead waits under the nearest one (`holdX`), so it stays where the flyers can shoot it.
 */
export function pickVictim<T extends Placed>(a: Attacker & { x: number }, heroes: T[]): { target?: T; holdX?: number } {
  const alive = heroes.filter((h) => h.alive);
  const reach = alive.filter((h) => canReach(a, h));
  const closest = (pool: T[]) => pool.reduce<T | undefined>((b, h) => (!b || Math.abs(h.x - a.x) < Math.abs(b.x - a.x) ? h : b), undefined);
  const ahead = reach.filter((h) => a.x - h.x >= -BEHIND_SLACK).reduce<T | undefined>((b, h) => (!b || h.x > b.x ? h : b), undefined);
  const target = ahead ?? closest(reach);
  if (target) return { target };
  const under = closest(alive);
  return under ? { holdX: under.x } : {};
}

/**
 * Who a flying enemy hits right now. Flyers never turn back toward their own crystal: a hero in reach (in front
 * of it or already past it) is hit from where the flyer hovers, the nearest one in front first. With nobody in
 * reach it returns nothing and the flyer keeps flying on toward the heroes' crystal.
 */
export function flyerVictim<T extends Placed>(a: Attacker & { x: number }, heroes: T[]): T | undefined {
  const inReach = heroes.filter((h) => h.alive && canReach(a, h) && Math.abs(h.x - a.x) <= a.range);
  const ahead = inReach.filter((h) => a.x - h.x >= -BEHIND_SLACK).reduce<T | undefined>((b, h) => (!b || h.x > b.x ? h : b), undefined);
  return ahead ?? inReach.reduce<T | undefined>((b, h) => (!b || Math.abs(h.x - a.x) < Math.abs(b.x - a.x) ? h : b), undefined);
}

/**
 * The x an enemy moves toward this step (it moves left by default, toward the heroes' crystal). A walker turns back
 * for a hero behind it, or on the lane waits under a flyer it can't reach (`holdX`); a flyer never turns back.
 */
export function enemyGoal(a: { x: number; range: number; flying?: boolean }, target: { x: number } | undefined, holdX: number | undefined, pvp: boolean): number {
  if (a.flying) return -Infinity;
  if (target && target.x > a.x) return target.x - a.range * 0.8;
  return !pvp && holdX !== undefined ? holdX : -Infinity;
}
