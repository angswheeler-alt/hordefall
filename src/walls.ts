/**
 * Hold the Walls (Samuel, 2026-11-22): the third mode for heroes who never make the team. Three walls, each
 * raided this week by heroes of one element, and each held by its own heroes: up to WALL_SIZE on a wall and a hero
 * on one wall only, so a full defense takes 15 heroes. Any element may stand on any wall, so the best walls are
 * built from counters, which pulls in benched heroes.
 *
 * - Opens after the first Rekindle. One paid defense a day (player's local day); editing shows the waves each
 *   wall should hold first.
 * - Each wall faces waves of raiders, each wave WALL_GROWTH times stronger than the last, up to WALL_WAVES.
 *   Heroes fight at the fixed level like the Colosseum and the Element Towers.
 * - Rewards only, never gold or Gems: Enhance Stones and Essence for waves held, crests for heroes who stood on
 *   the walls, and Glyph Chests when the week's best total passes WALL_WEEK_TIERS.
 */
import { POOL_HEROES, elementMultiplier, type Element, type HeroDef } from './data';
import { seededRandom } from './colosseum';
import { isAscendant } from './heroes/ascendant';

/** Walls in a defense. */
export const WALL_COUNT = 3;
/** Heroes that can stand on one wall. */
export const WALL_SIZE = 5;
/** Waves a wall can hold at most. */
export const WALL_WAVES = 30;
/** Raiders in a wave. */
export const WALL_FOE_SIZE = 5;
/** Wave 1 needs this many times a 1-star Common's fixed power per hero; each wave WALL_GROWTH times the last. */
export const WALL_BASE = 4.5;
export const WALL_GROWTH = 1.55;
/** Waves held in total (all three walls) for one Enhance Stone. */
export const WALL_STONE_EVERY = 5;
/** Waves held in total for one crest to a hero who stood on the walls. */
export const WALL_CREST_EVERY = 10;
/** Essence per wave held on a wall, as a share of one Trial win of the raiders' element at the player's best level. */
export const WALL_ESSENCE_SHARE = 0.02;
/** The week's best total waves that pay a Glyph Chest (a Rare one at the last), once each a week. */
export const WALL_WEEK_TIERS: Array<{ waves: number; chest: 'glyph' | 'grand' }> = [
  { waves: 30, chest: 'glyph' },
  { waves: 60, chest: 'glyph' },
  { waves: 90, chest: 'grand' },
];
export const WALL_NAMES = ['West Wall', 'Gatehouse', 'East Wall'];

/** Each week's raiders, one element a wall; the list repeats every five weeks so every element raids three weeks in five. */
export const WALL_RAIDS: Element[][] = [
  ['fire', 'earth', 'water'],
  ['water', 'light', 'dark'],
  ['earth', 'dark', 'fire'],
  ['light', 'water', 'earth'],
  ['dark', 'fire', 'light'],
];

/** This week's raider element on each wall (`week` from weekIndex). */
export function wallRaids(week: number): Element[] {
  return WALL_RAIDS[((week % WALL_RAIDS.length) + WALL_RAIDS.length) % WALL_RAIDS.length];
}

/** Foe power for a wave, given the fixed CP of a 1-star Common (`yard`). */
export function wallFoePower(wave: number, yard: number): number {
  return WALL_FOE_SIZE * yard * WALL_BASE * WALL_GROWTH ** (wave - 1);
}

/**
 * Who raids a wave: WALL_FOE_SIZE heroes of the raider element, picked from the week's seed so a wave stays the same
 * all week. Stars climb with the wave; every 10th wave is led by an Epic.
 */
export function wallFoeTeam(el: Element, week: number, wall: number, wave: number): Array<{ id: string; stars: number }> {
  const rand = seededRandom(`walls:${week}:${wall}:${wave}`);
  const pool = POOL_HEROES.filter((h) => h.element === el && h.rarity !== 'legendary' && !isAscendant(h.id));
  const stars = () => Math.min(6, Math.floor((wave - 1) / 6) + Math.floor(rand() * 2));
  const out: Array<{ id: string; stars: number }> = [];
  if (wave % 10 === 0) {
    const epics = pool.filter((h) => h.rarity === 'epic');
    if (epics.length) out.push({ id: epics[Math.floor(rand() * epics.length)].id, stars: stars() + 1 });
  }
  while (out.length < WALL_FOE_SIZE && out.length < pool.length) {
    const h = pool[Math.floor(rand() * pool.length)];
    if (!out.some((x) => x.id === h.id)) out.push({ id: h.id, stars: stars() });
  }
  const rank: Record<HeroDef['rarity'], number> = { common: 0, rare: 1, epic: 2, legendary: 3 };
  const def = (id: string) => pool.find((h) => h.id === id)!;
  return out.sort((a, b) => rank[def(b.id).rarity] - rank[def(a.id).rarity] || b.stars - a.stars);
}

/** How good a hero is on a wall against `raider`: element edge both ways (hits dealt, hits taken). */
export function wallFit(hero: Element, raider: Element): number {
  return elementMultiplier(hero, raider) / Math.sqrt(elementMultiplier(raider, hero));
}

export interface WallReward {
  stones: number;
  crests: number;
  /** Essence of each wall's raider element. */
  essence: Partial<Record<Element, number>>;
}

/** What a defense pays for its waves held (Essence before the Trial scaling: in waves, per raider element). */
export function wallReward(waves: number[]): { stones: number; crests: number } {
  const total = waves.reduce((a, b) => a + b, 0);
  return { stones: Math.floor(total / WALL_STONE_EVERY), crests: Math.floor(total / WALL_CREST_EVERY) };
}

export interface WallsState {
  /** Hero ids on each wall (WALL_COUNT lists). */
  teams: string[][];
  /** Day key of the last paid defense. */
  day: string;
  /** Week key the best and the paid tiers belong to. */
  week: string;
  /** Best total waves this week. */
  best: number;
  /** Week tiers (indexes into WALL_WEEK_TIERS) paid this week. */
  paid: number[];
  /** The last defense, waves held on each wall (empty before the first). */
  last: number[];
}

export function newWalls(): WallsState {
  return { teams: [[], [], []], day: '', week: '', best: 0, paid: [], last: [] };
}

export function cleanWalls(raw: unknown, heroIds: Set<string>): WallsState {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<WallsState>;
  const out = newWalls();
  const seen = new Set<string>();
  for (let i = 0; i < WALL_COUNT; i++) {
    const t = Array.isArray(r.teams?.[i]) ? r.teams![i] : [];
    for (const id of t) {
      if (typeof id !== 'string' || !heroIds.has(id) || seen.has(id) || out.teams[i].length >= WALL_SIZE) continue;
      seen.add(id);
      out.teams[i].push(id);
    }
  }
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const wave = (v: unknown) => Math.min(WALL_WAVES, Math.max(0, Math.floor(Number(v) || 0)));
  out.day = str(r.day);
  out.week = str(r.week);
  out.best = Math.min(WALL_WAVES * WALL_COUNT, Math.max(0, Math.floor(Number(r.best) || 0)));
  out.paid = Array.isArray(r.paid) ? [...new Set(r.paid.filter((i): i is number => Number.isInteger(i) && i >= 0 && i < WALL_WEEK_TIERS.length))] : [];
  out.last = Array.isArray(r.last) && r.last.length === WALL_COUNT ? r.last.map(wave) : [];
  return out;
}
