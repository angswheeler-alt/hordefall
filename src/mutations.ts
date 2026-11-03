/**
 * Mutation mobs (Samuel, 2026-11-03): past stage 500 some regular mobs spawn with a random trait. A mutant is
 * tougher or nastier than a plain mob, pays more gold, and counts on its trait's page in the Hunting Journal
 * (journal.ts), which unlocks once mutants start showing up. Bosses, Trials, Colosseum and shinies never mutate.
 *
 * Balance (checked 2026-11-03, tests/mutations.test.ts): at the 15% cap the average mob has ~12% more HP to
 * chew through and hits ~6% harder, which moves a player's wall back by under 2 stages (enemy HP grows 7% a
 * stage). Mutants pay MUTANT_GOLD x gold, which about pays back the extra time, so gold per minute holds steady.
 * Offline progress (canClearStage) counts the same averages, so away time never pushes past a stage the team
 * would lose to mutants live. Boss fights (canBeatBoss) don't change.
 */

/** Mutants can spawn from this stage on ("after stage 500"). */
export const MUTATION_STAGE = 501;
/** Chance a regular mob is a mutant on stage 501. */
export const MUTATION_START_CHANCE = 0.05;
/** The chance grows by this much every 100 stages... */
export const MUTATION_CHANCE_STEP = 0.01;
/** ...up to this (stage 1,500 on). */
export const MUTATION_MAX_CHANCE = 0.15;
/** Gold a mutant pays, times a plain mob's. */
export const MUTANT_GOLD = 1.5;

export type MutationId = 'armored' | 'swift' | 'splitting' | 'enraged' | 'mending';

export interface Mutation {
  id: MutationId;
  name: string;
  /** What it does, in words (Journal page and tests). */
  text: string;
  /** Tag and glow colour on the lane. */
  color: number;
  hp: number;
  atk: number;
  /** Walk speed, times normal. */
  speed: number;
  /** Time between attacks, times normal (under 1 attacks faster). */
  cooldown: number;
  /** Splitting: how many small copies it breaks into, and each one's share of the parent's HP and ATK. */
  split?: { count: number; hp: number; atk: number };
  /** Mending: share of its max HP it heals every second. */
  regen?: number;
}

export const MUTATIONS: Record<MutationId, Mutation> = {
  armored: { id: 'armored', name: 'Armored', text: '3x HP, walks slower', color: 0x9fb4c8, hp: 3, atk: 1, speed: 0.75, cooldown: 1 },
  swift: { id: 'swift', name: 'Swift', text: 'Runs 70% faster and attacks 40% faster', color: 0x7dffd8, hp: 1, atk: 1, speed: 1.7, cooldown: 0.6 },
  splitting: {
    id: 'splitting',
    name: 'Splitting',
    text: 'Breaks into 2 small copies when beaten (each 40% HP, half ATK)',
    color: 0xc58cff,
    hp: 1.2,
    atk: 1,
    speed: 1,
    cooldown: 1,
    split: { count: 2, hp: 0.4, atk: 0.5 },
  },
  enraged: { id: 'enraged', name: 'Enraged', text: '2.5x ATK, a little more HP', color: 0xff5a4a, hp: 1.2, atk: 2.5, speed: 1.1, cooldown: 1 },
  mending: { id: 'mending', name: 'Mending', text: '1.5x HP, heals 4% of its HP every second', color: 0x7dff8a, hp: 1.5, atk: 1, speed: 1, cooldown: 1, regen: 0.04 },
};

/** Journal and pick order. */
export const MUTATION_IDS: MutationId[] = ['armored', 'swift', 'splitting', 'enraged', 'mending'];

/** Chance (0 to MUTATION_MAX_CHANCE) that a regular mob on `stage` is a mutant. */
export function mutationChance(stage: number): number {
  if (stage < MUTATION_STAGE) return 0;
  const steps = Math.floor((stage - MUTATION_STAGE) / 100);
  return Math.min(MUTATION_MAX_CHANCE, MUTATION_START_CHANCE + steps * MUTATION_CHANCE_STEP);
}

/** The trait a regular mob spawning on `stage` gets, or null. `roll` decides if it mutates, `pick` which trait (both in [0, 1)). */
export function rollMutation(stage: number, roll: number, pick: number): Mutation | null {
  if (roll >= mutationChance(stage)) return null;
  const i = Math.min(MUTATION_IDS.length - 1, Math.max(0, Math.floor(pick * MUTATION_IDS.length)));
  return MUTATIONS[MUTATION_IDS[i]];
}

/**
 * How many plain mobs' worth of HP a mutant takes to beat, counting its split copies. Mending is counted as
 * +30%: a team near its wall needs a few seconds per mob, so it heals back about that much.
 */
export function mutantHpWorth(m: Mutation): number {
  const copies = m.split ? m.split.count * m.split.hp * m.hp : 0;
  return m.hp + copies + (m.regen ? m.regen * 7.5 : 0);
}

/** A mutant's damage per second against a plain mob's (its own hits, plus its split copies' share while they live). */
export function mutantAtkWorth(m: Mutation): number {
  return (m.atk / m.cooldown) + (m.split ? (m.split.count * m.split.atk * m.atk) / 2 : 0);
}

/** Averages over all mobs on `stage`: HP to beat, damage taken and gold, each times a stage with no mutants. */
export function mutationLoad(stage: number): { hp: number; atk: number; gold: number } {
  const p = mutationChance(stage);
  if (!p) return { hp: 1, atk: 1, gold: 1 };
  const n = MUTATION_IDS.length;
  let hp = 0;
  let atk = 0;
  let gold = 0;
  for (const id of MUTATION_IDS) {
    const m = MUTATIONS[id];
    hp += mutantHpWorth(m) / n;
    atk += mutantAtkWorth(m) / n;
    // A splitter's copies are plain kills worth half a mob's gold each.
    gold += (MUTANT_GOLD + (m.split ? m.split.count * 0.5 : 0)) / n;
  }
  return { hp: 1 - p + p * hp, atk: 1 - p + p * atk, gold: 1 - p + p * gold };
}
