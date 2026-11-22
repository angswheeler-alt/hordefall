/**
 * Element Towers (Samuel, 2026-11-22): one tower per element. A tower only takes heroes of its element, and
 * every floor is a team of heroes of the element it beats (Water fights Fire, Fire fights Earth, Earth fights
 * Water, Light fights Dark, Dark fights Light). Floors give rewards only, never buffs: a little on every floor
 * and more on every 5th, 10th and 25th. Each tower opens on set days, and every tower is open on the weekend.
 * The towers never end (Samuel, 2026-11-22): each floor is TOWER_GROWTH times stronger than the last.
 *
 * - Opens after the first Rekindle. Fights are free: a lost floor can be tried again right away.
 * - Fixed level like the Colosseum: stars, relics, weapons and Glyphs count, gold and Ember levels don't.
 * - Floor N needs about TOWER_BASE x TOWER_GROWTH^(N-1) times a 1-star Common's power per hero. The foe team
 *   is sized for that, times the tower's element edge (TOWER_EDGE), so every tower is about as hard.
 * - Year sim (tools/sim/bench.ts, SIM_BENCH=towers): about 50 floors a tower in the first year for a casual
 *   player, around 1,000 Gems a year, stage pace +1%.
 */
import { POOL_HEROES, type Element, type HeroDef } from './data';
import { seededRandom } from './colosseum';
import { isAscendant } from './heroes/ascendant';

export const TOWER_ELEMENTS: Element[] = ['water', 'fire', 'earth', 'light', 'dark'];
/** The element each tower fights: the one its own element beats. */
export const TOWER_FOE: Record<Element, Element> = { water: 'fire', fire: 'earth', earth: 'water', light: 'dark', dark: 'light' };
export const TOWER_NAMES: Record<Element, string> = { water: 'Tide Tower', fire: 'Cinder Tower', earth: 'Root Tower', light: 'Dawn Tower', dark: 'Dusk Tower' };
/** Highest floor a save keeps (the towers never end; this only guards against broken saves). */
export const TOWER_FLOOR_CAP = 100_000;
/** Heroes on every floor's foe team. */
export const TOWER_FOE_SIZE = 5;
/** Gems every floor pays. */
export const TOWER_GEMS = 5;
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

export interface TowerReward {
  /** Hero crests, each to a random non-Legendary hero of the tower's element (like a Trial). */
  crests: number;
  /** Gems on every floor (Samuel, 2026-11-22). */
  gems: number;
  /** An Element Chest: this many crests for one random Epic of the tower's element. */
  epicCrests: number;
  stones: number;
  chest: 'glyph' | 'grand' | null;
  /** Essence of the tower's element, as a share of one Trial win at the player's best level there. */
  essenceShare: number;
}

/**
 * What clearing a floor pays (Samuel, 2026-11-22: no gold, and rewards that build the tower's element): 5 crests of
 * that element on every floor, Enhance Stones on every 5th, an Element Chest of Epic crests on every 10th and a Glyph
 * Chest on every 25th (a Rare one on every 100th), and TOWER_GEMS Gems on every floor (about 1,250 a year for a
 * casual player across the five towers, the same as 40 Gems every 10th floor would have paid).
 */
export function towerReward(floor: number): TowerReward {
  return {
    crests: 5,
    gems: TOWER_GEMS,
    epicCrests: floor % 10 === 0 ? 10 : 0,
    stones: floor % 5 === 0 ? 5 : 0,
    chest: floor % 100 === 0 ? 'grand' : floor % 25 === 0 ? 'glyph' : null,
    essenceShare: 0.5,
  };
}

/** A floor that pays extra: every 5th (Stones) and 10th (Element Chest). */
export function towerMilestone(floor: number): 0 | 5 | 10 {
  return floor % 10 === 0 ? 10 : floor % 5 === 0 ? 5 : 0;
}

/** Foe team power for a floor, given the fixed CP of a 1-star Common (`yard`). */
export function towerFoePower(el: Element, floor: number, yard: number): number {
  return TOWER_FOE_SIZE * yard * TOWER_BASE * TOWER_GROWTH ** (floor - 1) * TOWER_EDGE[el];
}

/**
 * Who stands on a floor: TOWER_FOE_SIZE heroes of the foe element, picked from the floor's seed, so a floor
 * always has the same team. Stars climb with the floor; every 10th floor is led by a Legendary when the element
 * has one, otherwise an Epic. The leader comes first.
 */
export function towerFoeTeam(el: Element, floor: number): Array<{ id: string; stars: number }> {
  const foe = TOWER_FOE[el];
  const rand = seededRandom(`tower:${el}:${floor}`);
  const pool = POOL_HEROES.filter((h) => h.element === foe && !isAscendant(h.id));
  const rank: Record<HeroDef['rarity'], number> = { common: 0, rare: 1, epic: 2, legendary: 3 };
  const stars = (bonus = 0) => Math.min(6, Math.floor((floor - 1) / 20) + Math.floor(rand() * 2) + bonus);
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
  /** Floors cleared per element. */
  floors: Partial<Record<Element, number>>;
  /** Each tower's saved team (hero ids of that element). */
  teams: Partial<Record<Element, string[]>>;
}

export function newTowers(): TowerState {
  return { floors: {}, teams: {} };
}

export function cleanTowers(raw: unknown, heroIds: Set<string>): TowerState {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<TowerState>;
  const out = newTowers();
  const int = (v: unknown) => Math.min(TOWER_FLOOR_CAP, Math.max(0, Math.floor(Number(v) || 0)));
  for (const el of TOWER_ELEMENTS) {
    const n = int(r.floors?.[el]);
    if (n) out.floors[el] = n;
    const team = r.teams?.[el];
    if (Array.isArray(team)) {
      const ids = team.filter((id): id is string => typeof id === 'string' && heroIds.has(id));
      if (ids.length) out.teams[el] = [...new Set(ids)];
    }
  }
  return out;
}
