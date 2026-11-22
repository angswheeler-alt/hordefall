/**
 * Element Towers (Samuel, 2026-11-22): one tower per element. A tower only takes heroes of its element, and
 * every floor is a team of heroes of the element it beats (Water fights Fire, Fire fights Earth, Earth fights
 * Water, Light fights Dark, Dark fights Light). Floors give rewards only, never buffs: a little on every floor
 * and more on every 5th and 10th. Each tower opens on set days, and every tower is open on the weekend.
 *
 * - Opens after the first Rekindle. Fights are free: a lost floor can be tried again right away.
 * - Fixed level like the Colosseum: stars, relics, weapons and Glyphs count, gold and Ember levels don't.
 * - Floor N needs about TOWER_BASE x TOWER_GROWTH^(N-1) times a 1-star Common's power per hero. The foe team
 *   is sized for that, times the tower's element edge (TOWER_EDGE), so every tower is about as hard.
 * - Hard mode opens once a tower's 100 Normal floors are cleared: the climb carries on from floor 101's
 *   strength, and pays double.
 * - Year sim (tools/sim/bench.ts, SIM_BENCH=towers): about 50 floors a tower in the first year for a casual
 *   player, around 1,000 Gems and 500 Wild Crests a year, stage pace +1%.
 */
import { POOL_HEROES, type Element, type HeroDef } from './data';
import { seededRandom } from './colosseum';
import { isAscendant } from './heroes/ascendant';

export const TOWER_ELEMENTS: Element[] = ['water', 'fire', 'earth', 'light', 'dark'];
/** The element each tower fights: the one its own element beats. */
export const TOWER_FOE: Record<Element, Element> = { water: 'fire', fire: 'earth', earth: 'water', light: 'dark', dark: 'light' };
export const TOWER_NAMES: Record<Element, string> = { water: 'Tide Tower', fire: 'Cinder Tower', earth: 'Root Tower', light: 'Dawn Tower', dark: 'Dusk Tower' };
export const TOWER_FLOORS = 100;
/** Heroes on every floor's foe team. */
export const TOWER_FOE_SIZE = 5;
/** Floor 1 needs this many times a 1-star Common's fixed power per hero; each floor TOWER_GROWTH times the last. */
export const TOWER_BASE = 31.6;
export const TOWER_GROWTH = 1.2;
/**
 * How much stronger the foes are than the player's team at an even fight, per tower: the tower's element hits
 * x4 and takes x0.5 (Light and Dark x2 both ways). Measured with simulatePvp on random teams (2026-11-22).
 */
export const TOWER_EDGE: Record<Element, number> = { water: 3.6, fire: 2.35, earth: 2.9, light: 1, dark: 1 };
/** Weekdays each tower opens (Date.getDay numbers, player's local time); every tower is open on TOWER_ALL_DAYS. */
export const TOWER_SCHEDULE: Record<Element, number[]> = {
  water: [1, 4],
  fire: [2, 5],
  earth: [3, 5],
  light: [2, 4],
  dark: [1, 3],
};
export const TOWER_ALL_DAYS = [6, 0];

export type TowerMode = 'normal' | 'hard';

export interface TowerReward {
  wild: number;
  stones: number;
  gems: number;
  chest: 'glyph' | 'grand' | null;
  /** Essence of the tower's element, as a share of one Trial win at the player's best level there. */
  essenceShare: number;
}

/** What clearing a floor pays (no gold: Samuel's rule for new modes). Hard floors pay double and a Rare Glyph Chest. */
export function towerReward(floor: number, mode: TowerMode): TowerReward {
  const x = mode === 'hard' ? 2 : 1;
  return {
    wild: 2 * x,
    stones: floor % 5 === 0 ? 5 * x : 0,
    gems: floor % 10 === 0 ? 40 * x : 0,
    chest: floor % 25 === 0 ? (mode === 'hard' ? 'grand' : 'glyph') : null,
    essenceShare: 0.5,
  };
}

/** A floor that pays extra: every 5th (Stones) and 10th (Gems). */
export function towerMilestone(floor: number): 0 | 5 | 10 {
  return floor % 10 === 0 ? 10 : floor % 5 === 0 ? 5 : 0;
}

/** Steps up from floor 1 of Normal: Hard floor N is as strong as Normal floor 100 + N. */
export function towerStep(floor: number, mode: TowerMode): number {
  return floor - 1 + (mode === 'hard' ? TOWER_FLOORS : 0);
}

/** Foe team power for a floor, given the fixed CP of a 1-star Common (`yard`). */
export function towerFoePower(el: Element, floor: number, mode: TowerMode, yard: number): number {
  return TOWER_FOE_SIZE * yard * TOWER_BASE * TOWER_GROWTH ** towerStep(floor, mode) * TOWER_EDGE[el];
}

/**
 * Who stands on a floor: TOWER_FOE_SIZE heroes of the foe element, picked from the floor's seed, so a floor
 * always has the same team. Stars climb with the floor; every 10th floor is led by a Legendary when the element
 * has one, otherwise an Epic. The leader comes first.
 */
export function towerFoeTeam(el: Element, floor: number, mode: TowerMode): Array<{ id: string; stars: number }> {
  const foe = TOWER_FOE[el];
  const rand = seededRandom(`tower:${el}:${mode}:${floor}`);
  const pool = POOL_HEROES.filter((h) => h.element === foe && !isAscendant(h.id));
  const rank: Record<HeroDef['rarity'], number> = { common: 0, rare: 1, epic: 2, legendary: 3 };
  const step = towerStep(floor, mode);
  const stars = (bonus = 0) => Math.min(6, Math.floor(step / 20) + Math.floor(rand() * 2) + bonus);
  const out: Array<{ id: string; stars: number }> = [];
  if (floor % 10 === 0) {
    const tops = pool.filter((h) => h.rarity === 'legendary');
    const leads = tops.length ? tops : pool.filter((h) => h.rarity === 'epic');
    if (leads.length) out.push({ id: leads[Math.floor(rand() * leads.length)].id, stars: stars(1) });
  }
  const rest = pool.filter((h) => h.rarity !== 'legendary');
  while (out.length < TOWER_FOE_SIZE && out.length < pool.length) {
    const h = rest[Math.floor(rand() * rest.length)];
    if (out.some((x) => x.id === h.id)) continue;
    out.push({ id: h.id, stars: stars() });
  }
  // Leader first: the highest rarity, then the most stars.
  const def = (id: string) => pool.find((h) => h.id === id)!;
  return out.sort((a, b) => rank[def(b.id).rarity] - rank[def(a.id).rarity] || b.stars - a.stars);
}

/** Whether a tower is open on this day (player's local day). */
export function towerOpenOn(el: Element, now: number): boolean {
  const day = new Date(now).getDay();
  return TOWER_SCHEDULE[el].includes(day) || TOWER_ALL_DAYS.includes(day);
}

/** Days of the week (Date.getDay numbers) a tower is open. */
export function towerDays(el: Element): number[] {
  return [0, 1, 2, 3, 4, 5, 6].filter((d) => TOWER_SCHEDULE[el].includes(d) || TOWER_ALL_DAYS.includes(d));
}

export interface TowerState {
  /** Floors cleared per element, Normal and Hard. */
  normal: Partial<Record<Element, number>>;
  hard: Partial<Record<Element, number>>;
  /** Each tower's saved team (hero ids of that element). */
  teams: Partial<Record<Element, string[]>>;
}

export function newTowers(): TowerState {
  return { normal: {}, hard: {}, teams: {} };
}

export function cleanTowers(raw: unknown, heroIds: Set<string>): TowerState {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<TowerState>;
  const out = newTowers();
  const int = (v: unknown) => Math.min(TOWER_FLOORS, Math.max(0, Math.floor(Number(v) || 0)));
  for (const el of TOWER_ELEMENTS) {
    const n = int(r.normal?.[el]);
    if (n) out.normal[el] = n;
    const h = n >= TOWER_FLOORS ? int(r.hard?.[el]) : 0;
    if (h) out.hard[el] = h;
    const team = r.teams?.[el];
    if (Array.isArray(team)) {
      const ids = team.filter((id): id is string => typeof id === 'string' && heroIds.has(id));
      if (ids.length) out.teams[el] = [...new Set(ids)];
    }
  }
  return out;
}
