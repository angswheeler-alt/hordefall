/**
 * Scouting (design doc 11.2, built 2026-10-31): timed missions that send heroes away for 1 to 6 hours and pay
 * weapon materials (src/weapons.ts). The board holds 3 Common missions and 1 Rare; every SCOUT_BONUS_COMMONS
 * Commons finished add a bonus Rare, and one Gilded mission a day pays Wild Crests for any hero.
 * Heroes away scouting still fight; a hero can only be on one mission at a time.
 * A mission's Team Score comes from its heroes' stars, pink stars and weapon level, raised for heroes who match
 * the recommended Type and element. The score against the mission's target sets the share of the reward paid.
 * Missions are rolled from a seed (slot + hour), so they are the same on every device and in tests.
 */
import type { Element, HeroType } from './data';
import { HERO_TYPES } from './data';
import { seededRandom } from './colosseum';
import type { ForgeMat } from './weapons';

export type ScoutKind = 'common' | 'rare' | 'gilded';

export interface ScoutMission {
  /** Seed it was rolled from, also its id. */
  id: string;
  kind: ScoutKind;
  hours: number;
  /** Most heroes it takes. */
  size: number;
  type: HeroType;
  element: Element;
  /** When it was sent (0 = not started). */
  startedAt: number;
  heroes: string[];
}

export interface ScoutSlot {
  slot: string;
  kind: ScoutKind;
  mission?: ScoutMission;
  /** When an empty slot gets its next mission. */
  readyAt: number;
}

export interface ScoutState {
  slots: ScoutSlot[];
  /** Commons finished toward the next bonus Rare. */
  commons: number;
  /** Day the last Gilded mission was posted. */
  gildedDay: string;
  /** Lifetime missions finished. */
  done: number;
}

/** Materials, Wild Crests, Unbinders and Glyph Chests (Rare missions a Glyph Chest, Gilded a Rare Glyph Chest; src/glyphs.ts). */
export type ScoutReward = Partial<Record<ForgeMat | 'wild' | 'unbinder' | 'glyph' | 'grand', number>>;

export const SCOUT_UNLOCK_LEVEL = 15;
export const SCOUT_BONUS_COMMONS = 5;
const HOUR = 3600 * 1000;
const ELEMENTS: Element[] = ['water', 'fire', 'earth', 'light', 'dark'];
const TYPES = Object.keys(HERO_TYPES) as HeroType[];

export const SCOUT_KINDS: Record<ScoutKind, { name: string; hours: number[]; size: number; target: number }> = {
  common: { name: 'Common', hours: [1, 2, 3, 4], size: 3, target: 90 },
  rare: { name: 'Rare', hours: [4, 5, 6], size: 4, target: 160 },
  gilded: { name: 'Gilded', hours: [6], size: 5, target: 250 },
};

/** Team Score bonus for a hero of the recommended Type, and again for the recommended element. */
export const SCOUT_MATCH_MULT = 1.5;
/** Wild Crests a full-score Gilded mission pays. */
export const GILDED_WILD = 20;
/** Wild Crests spent per crest, by the hero's rarity. */
export const WILD_CREST_COST = { common: 1, rare: 2, epic: 4 } as const;

const BASE_SLOTS: Array<{ slot: string; kind: ScoutKind }> = [
  { slot: 'c0', kind: 'common' },
  { slot: 'c1', kind: 'common' },
  { slot: 'c2', kind: 'common' },
  { slot: 'r0', kind: 'rare' },
];

export function newScout(): ScoutState {
  return { slots: BASE_SLOTS.map((b) => ({ ...b, readyAt: 0 })), commons: 0, gildedDay: '', done: 0 };
}

export function nextHour(now: number): number {
  return (Math.floor(now / HOUR) + 1) * HOUR;
}

export function rollMission(kind: ScoutKind, seed: string): ScoutMission {
  const rng = seededRandom(seed);
  const k = SCOUT_KINDS[kind];
  const pick = <T>(xs: T[]) => xs[Math.floor(rng() * xs.length) % xs.length];
  return { id: seed, kind, hours: pick(k.hours), size: k.size, type: pick(TYPES), element: pick(ELEMENTS), startedAt: 0, heroes: [] };
}

/** Fill empty slots that are due, post the bonus Rare and today's Gilded mission. True if anything changed. */
export function refreshBoard(s: ScoutState, now: number, today: string): boolean {
  let changed = false;
  const hour = Math.floor(now / HOUR);
  for (const slot of s.slots) {
    if (!slot.mission && now >= slot.readyAt) {
      slot.mission = rollMission(slot.kind, `${slot.slot}:${hour}`);
      changed = true;
    }
  }
  if (s.commons >= SCOUT_BONUS_COMMONS && !s.slots.some((x) => x.slot === 'rb')) {
    s.commons -= SCOUT_BONUS_COMMONS;
    s.slots.push({ slot: 'rb', kind: 'rare', mission: rollMission('rare', `rb:${hour}`), readyAt: 0 });
    changed = true;
  }
  if (s.gildedDay !== today && !s.slots.some((x) => x.slot === 'g')) {
    s.gildedDay = today;
    s.slots.push({ slot: 'g', kind: 'gilded', mission: rollMission('gilded', `g:${today}`), readyAt: 0 });
    changed = true;
  }
  return changed;
}

/** One hero's Team Score. Stars are 0-based (0 = 1★). */
export function heroScoutScore(stars: number, awaken: number, weapon: number, typeMatch: boolean, elementMatch: boolean): number {
  const base = 10 * (stars + 1) + 5 * awaken + 5 * Math.max(0, weapon - 1);
  return Math.round(base * (typeMatch ? SCOUT_MATCH_MULT : 1) * (elementMatch ? SCOUT_MATCH_MULT : 1));
}

/** Share of the reward a Team Score earns: score / target, at most 1. */
export function scoutShare(score: number, kind: ScoutKind): number {
  return Math.max(0, Math.min(1, score / SCOUT_KINDS[kind].target));
}

/** What a mission pays at full score. */
export function fullReward(m: Pick<ScoutMission, 'kind' | 'hours'>): ScoutReward {
  const h = m.hours;
  if (m.kind === 'common') return { ore: 30 * h, crystal: 30 * h, coreC: h };
  if (m.kind === 'rare') return { ore: 50 * h, crystal: 50 * h, coreC: 2 * h, coreR: Math.round(h / 2), coreE: h >= 6 ? 1 : 0, unbinder: 1, glyph: 1 };
  return { ore: 40 * h, crystal: 40 * h, wild: GILDED_WILD, unbinder: 2, grand: 1 };
}

/** What a mission pays at a share of its target: Ore and Crystal round down, cores and Wild Crests to the nearest. */
export function scoutReward(m: Pick<ScoutMission, 'kind' | 'hours'>, share: number): ScoutReward {
  const out: ScoutReward = {};
  for (const [k, v] of Object.entries(fullReward(m)) as Array<[keyof ScoutReward, number]>) {
    // Glyph Chests always pay in full; everything else scales with the team's share.
    const n = k === 'glyph' || k === 'grand' ? v : k === 'ore' || k === 'crystal' ? Math.floor(v * share) : Math.round(v * share);
    if (n > 0) out[k] = n;
  }
  return out;
}

export function missionEndsAt(m: ScoutMission): number {
  return m.startedAt + m.hours * HOUR;
}

/** Clean a saved board: drop unknown slots and heroes, keep one of each slot. */
export function cleanScout(raw: unknown, heroIds: Set<string>): ScoutState {
  const s = newScout();
  if (!raw || typeof raw !== 'object') return s;
  const r = raw as Record<string, unknown>;
  s.commons = Math.max(0, Math.floor(Number(r.commons) || 0));
  s.done = Math.max(0, Math.floor(Number(r.done) || 0));
  s.gildedDay = typeof r.gildedDay === 'string' ? r.gildedDay : '';
  const saved = Array.isArray(r.slots) ? r.slots : [];
  const kindOf: Record<string, ScoutKind> = { c0: 'common', c1: 'common', c2: 'common', r0: 'rare', rb: 'rare', g: 'gilded' };
  const seen = new Set<string>();
  const slots: ScoutSlot[] = [];
  for (const x of saved as Array<Record<string, unknown>>) {
    const id = typeof x?.slot === 'string' ? x.slot : '';
    if (!kindOf[id] || seen.has(id)) continue;
    seen.add(id);
    const kind = kindOf[id];
    const m = x.mission as Record<string, unknown> | null;
    let mission: ScoutMission | undefined;
    if (m && typeof m.id === 'string') {
      const base = rollMission(kind, m.id);
      const heroes = Array.isArray(m.heroes) ? [...new Set((m.heroes as unknown[]).filter((h): h is string => typeof h === 'string' && heroIds.has(h)))].slice(0, base.size) : [];
      const startedAt = Number(m.startedAt) || 0;
      mission = { ...base, startedAt: heroes.length ? startedAt : 0, heroes: startedAt ? heroes : [] };
    }
    if (!mission && (id === 'rb' || id === 'g')) continue;
    slots.push({ slot: id, kind, mission, readyAt: Number(x.readyAt) || 0 });
  }
  for (const b of s.slots) if (!seen.has(b.slot)) slots.push(b);
  const order = ['c0', 'c1', 'c2', 'r0', 'rb', 'g'];
  s.slots = slots.sort((a, b) => order.indexOf(a.slot) - order.indexOf(b.slot));
  return s;
}
