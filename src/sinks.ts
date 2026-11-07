/**
 * Long-term uses for Essence and Enhance Stones (Samuel, 2026-11-07, "1-3"): once relics are maxed, both
 * piled up with nothing to buy (~1e12 Essence and ~45,000 Stones by day 365 in the simulator).
 *
 * 1. Elemental Attunement: each element's own Essence buys ranks that add ATTUNE_STEP ATK and HP (1%) to that
 *    element's heroes. Costs grow ATTUNE_GROWTH a rank, so it never ends but stays a slow goal.
 * 2. Relic Tempering: past a relic's last Enhance, Stones add one level's worth of its effect at a time
 *    (+2.5% of its level-20 effect), up to RELIC_TEMPER_CAP, like Weapon Mastery.
 * 3. Alchemist's Table: trade spares at a poor rate, each with a weekly limit so it never becomes a loophole.
 */
import type { Element } from './data';

export const ATTUNE_STEP = 0.01;
export const ATTUNE_BASE = 1_000_000;
export const ATTUNE_GROWTH = 1.2;

/** Essence for the next Attunement rank of an element. */
export function attuneCost(rank: number): number {
  return Math.ceil(ATTUNE_BASE * Math.pow(ATTUNE_GROWTH, Math.max(0, Math.floor(rank))));
}

/** Extra ATK and HP (0.1 = +10%) for an element's heroes at a rank. */
export function attuneBonus(rank: number): number {
  return ATTUNE_STEP * Math.max(0, Math.floor(rank));
}

/** How many ranks `have` Essence buys from `rank`, and what they cost. */
export function attuneBulk(rank: number, have: number, most = Infinity): { ranks: number; cost: number } {
  let ranks = 0;
  let cost = 0;
  while (ranks < most) {
    const next = attuneCost(rank + ranks);
    if (cost + next > have) break;
    cost += next;
    ranks++;
  }
  return { ranks, cost };
}

export function clampAttune(n: unknown): number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.min(10_000, Math.floor(n)) : 0;
}

export const RELIC_TEMPER_CAP = 20;
/** Each Temper counts as this many relic levels (0.5 = +2.5% of its level-20 effect). */
export const RELIC_TEMPER_LEVELS = 0.5;
export const RELIC_TEMPER_BASE = 10;
export const RELIC_TEMPER_GROWTH = 1.1;

/** Enhance Stones for a relic's next Temper. Higher-star relics cost more. */
export function relicTemperCost(stars: number, done: number): number {
  return Math.ceil(RELIC_TEMPER_BASE * Math.max(1, stars) * Math.pow(RELIC_TEMPER_GROWTH, Math.max(0, done)));
}

export function clampTemper(n: unknown): number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.min(RELIC_TEMPER_CAP, Math.floor(n)) : 0;
}

/** Essence swap: give ALCHEMY_SWAP_RATE of one kind for 1 of another. */
export const ALCHEMY_SWAP_RATE = 3;
/** Weekly swap limit, in Essence received: this many of your best Trial run's Essence (at least ALCHEMY_SWAP_MIN). */
export const ALCHEMY_SWAP_RUNS = 10;
export const ALCHEMY_SWAP_MIN = 1_000;
/** Glyph Dust: ALCHEMY_DUST Dust for Essence worth ALCHEMY_DUST_RUNS of your best Trial runs, ALCHEMY_DUST_PER_WEEK times a week. */
export const ALCHEMY_DUST = 50;
export const ALCHEMY_DUST_RUNS = 2;
export const ALCHEMY_DUST_MIN = 500;
export const ALCHEMY_DUST_PER_WEEK = 5;
/** Epic Forge Core for Enhance Stones, ALCHEMY_CORES_PER_WEEK times a week. */
export const ALCHEMY_CORE_STONES = 200;
export const ALCHEMY_CORES_PER_WEEK = 2;
/** Ancient Ore + Raw Crystal (each) for an Epic Forge Core, and for Glyph Dust: they pile up (~380,000 each by day 365). */
export const ALCHEMY_ORE_CORE = 3_000;
export const ALCHEMY_ORE_CORES_PER_WEEK = 2;
export const ALCHEMY_ORE_DUST = 1_000;
export const ALCHEMY_ORE_DUST_GET = 25;
export const ALCHEMY_ORE_DUST_PER_WEEK = 5;
/** The Alchemist's Table opens at this best stage. */
export const ALCHEMY_UNLOCK_STAGE = 2000;

export interface AlchemyState {
  week: string;
  swapped: number;
  dust: number;
  cores: number;
  oreCores: number;
  oreDust: number;
}

export function newAlchemy(): AlchemyState {
  return { week: '', swapped: 0, dust: 0, cores: 0, oreCores: 0, oreDust: 0 };
}

export function cleanAlchemy(v: unknown): AlchemyState {
  const o = (v && typeof v === 'object' ? v : {}) as Partial<AlchemyState>;
  const n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x > 0 ? Math.floor(x) : 0);
  return { week: typeof o.week === 'string' ? o.week : '', swapped: n(o.swapped), dust: n(o.dust), cores: n(o.cores), oreCores: n(o.oreCores), oreDust: n(o.oreDust) };
}

export function swapCap(bestRunEssence: number): number {
  return Math.max(ALCHEMY_SWAP_MIN, ALCHEMY_SWAP_RUNS * bestRunEssence);
}

export function dustCost(bestRunEssence: number): number {
  return Math.max(ALCHEMY_DUST_MIN, ALCHEMY_DUST_RUNS * bestRunEssence);
}

export type SwapPair = { from: Element; to: Element };
