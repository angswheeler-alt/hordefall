// Regular enemy kinds. Each stage's mobs are a mix of these, painted in the stage's element colours (art in
// src/mobAnims.ts, one set per element in MOB_ELEMENTS). The mix averages out close to a plain grunt, so stage
// difficulty barely moves.
import type { Element } from './data';

export const MOB_ELEMENTS: Element[] = ['water', 'fire', 'earth', 'light', 'dark'];

export type MobId = 'grunt' | 'brute' | 'caster' | 'scuttler' | 'flyer' | 'shieldbearer' | 'bomber' | 'summoner' | 'burrower';

/** What a special kind does on the lane (see the SPECIAL MOBS block below). */
export type MobTrick = 'guard' | 'bomb' | 'summon' | 'burrow';

export interface MobKind {
  id: MobId;
  /** First stage this kind can show up on. */
  fromStage: number;
  /** Relative chance among the walking kinds unlocked so far. */
  weight: number;
  hp: number;
  atk: number;
  /** Walk speed range, px/s. */
  speed: [number, number];
  /** Attack reach, px; a caster throws magic from further back. */
  range: number;
  /** Special kinds: what it does. */
  trick?: MobTrick;
  /** Gold paid when beaten, times a plain mob's (tougher special kinds pay more). Default 1. */
  gold?: number;
  /** Seconds between attacks (default 1.1, as every older kind). */
  cooldown?: number;
}

export const MOB_KINDS: Record<MobId, MobKind> = {
  grunt: { id: 'grunt', fromStage: 1, weight: 55, hp: 1, atk: 1, speed: [60, 75], range: 22 },
  brute: { id: 'brute', fromStage: 6, weight: 15, hp: 2, atk: 1.3, speed: [40, 50], range: 26 },
  scuttler: { id: 'scuttler', fromStage: 10, weight: 15, hp: 0.6, atk: 0.8, speed: [95, 110], range: 20 },
  caster: { id: 'caster', fromStage: 15, weight: 15, hp: 0.7, atk: 0.9, speed: [55, 65], range: 100 },
  // Flyers aren't drawn here: the stage picks them separately (they fly above the lane).
  flyer: { id: 'flyer', fromStage: 3, weight: 0, hp: 1, atk: 1, speed: [60, 75], range: 22 },
  // Special kinds (Samuel, 2026-11-03): each first shows up deeper in the run and asks for a different answer.
  shieldbearer: { id: 'shieldbearer', fromStage: 100, weight: 6, hp: 1.3, atk: 0.8, speed: [42, 52], range: 24, trick: 'guard', gold: 2 },
  bomber: { id: 'bomber', fromStage: 300, weight: 6, hp: 0.5, atk: 1, speed: [100, 115], range: 22, trick: 'bomb' },
  summoner: { id: 'summoner', fromStage: 600, weight: 5, hp: 1, atk: 0.6, speed: [50, 60], range: 150, trick: 'summon', gold: 2, cooldown: 1.6 },
  burrower: { id: 'burrower', fromStage: 1000, weight: 5, hp: 0.9, atk: 1.2, speed: [70, 80], range: 22, trick: 'burrow', gold: 1.2 },
};

/** Special kinds still drawn with simple placeholder shapes until their art arrives (BattleScene.makeTextures). */
export const MOB_ART_PENDING: MobId[] = ['shieldbearer', 'bomber', 'summoner', 'burrower'];

/** The special kinds in the order they first show up. */
export const SPECIAL_MOBS: MobId[] = ['shieldbearer', 'bomber', 'summoner', 'burrower'];

/** What each special kind does, in words (Journal pages). */
export const MOB_TRICK_TEXT: Partial<Record<MobId, string>> = {
  shieldbearer: 'Its shield blocks most ranged hits from the front; melee hits break it',
  bomber: 'Rushes in and blows up on your front line, hurting every hero close by. Beat it first and it pays like any mob',
  summoner: 'Stays back and calls small minions every few seconds',
  burrower: 'Digs under your front line and pops up next to your back-row heroes',
};

/** A walking mob kind for `stage`; `roll` is a number in [0, 1). */
export function pickMob(stage: number, roll: number): MobKind {
  const open = Object.values(MOB_KINDS).filter((k) => k.weight > 0 && stage >= k.fromStage);
  const total = open.reduce((t, k) => t + k.weight, 0);
  let r = roll * total;
  for (const k of open) {
    r -= k.weight;
    if (r < 0) return k;
  }
  return open[open.length - 1];
}

// ---------- SPECIAL MOBS ----------
// Shieldbearer: carries a shield worth GUARD_HP of its own HP. While the shield stands, ranged hits from the
// front (a hero to its left) only do GUARD_RANGED of their damage; every hit wears the shield down first, so
// melee heroes break it fast and then everyone hits its HP in full. Hits from behind skip the block.
export const GUARD_HP = 0.5;
export const GUARD_RANGED = 0.35;
// Bomber: when a hero is in reach it blows up instead of attacking: BOMB_MULT x its ATK to every hero within
// BOMB_RADIUS px, and it's gone (no gold, no Journal kill). Beat it on the way in and it pays like any mob.
// A shiny Bomber's fuse is a dud (it fights like a grunt), so a shiny is never lost to its own blast.
export const BOMB_MULT = 3;
export const BOMB_RADIUS = 45;
// Summoner: hangs back at its long reach throwing weak magic, and every SUMMON_SECONDS calls a minion
// (MINION_HP / MINION_ATK of a plain mob, MINION_GOLD gold, no Journal page), at most SUMMON_MAX alive at once.
export const SUMMON_SECONDS = 6;
export const SUMMON_MAX = 3;
export const MINION_HP = 0.3;
export const MINION_ATK = 0.5;
export const MINION_GOLD = 0.25;
/** A summoner starts calling once a hero is this close. */
export const SUMMON_NEAR = 320;
// Burrower: once the front hero is within BURROW_NEAR px it digs in (can't be hit) for BURROW_SECONDS and
// comes up BURROW_BEHIND px in front of the hindmost hero, next to the back row.
export const BURROW_NEAR = 110;
export const BURROW_SECONDS = 1.2;
export const BURROW_BEHIND = 14;

/** Damage share a Shieldbearer takes from one hit: blocked only for ranged hits from in front while its shield stands. */
export function guardShare(shieldUp: boolean, ranged: boolean, fromX: number, guardX: number): number {
  return shieldUp && ranged && fromX <= guardX ? GUARD_RANGED : 1;
}

/** Heroes a Bomber's blast at `x` catches. */
export function bombVictims<T extends { x: number; alive: boolean }>(x: number, heroes: T[]): T[] {
  return heroes.filter((h) => h.alive && Math.abs(h.x - x) <= BOMB_RADIUS);
}

/** Whether a Summoner calls a minion now. */
export function summonReady(clock: number, nextAt: number, minionsAlive: number, heroDist: number): boolean {
  return clock >= nextAt && minionsAlive < SUMMON_MAX && heroDist <= SUMMON_NEAR;
}

/**
 * Where a Burrower comes up, or null if it stays on the surface: it digs when the front hero is within
 * BURROW_NEAR and comes up just in front of the hindmost hero. With the team bunched up (nowhere to go past the
 * front line) it just fights where it is.
 */
export function burrowSpot(x: number, heroes: { x: number; alive: boolean }[]): number | null {
  const alive = heroes.filter((h) => h.alive);
  if (!alive.length) return null;
  const front = Math.max(...alive.map((h) => h.x));
  const back = Math.min(...alive.map((h) => h.x));
  if (x - front > BURROW_NEAR || x < front) return null;
  const spot = back + BURROW_BEHIND;
  return front - spot >= 30 ? spot : null;
}

/**
 * How many plain mobs' worth of HP a kind takes to beat, with `melee` the share of the team's damage from melee
 * heroes. A Summoner counts the minions it calls in an average fight (about 3).
 */
export function mobHpWorth(k: MobKind, melee: number): number {
  if (k.trick === 'guard') return k.hp + (k.hp * GUARD_HP) / (melee + (1 - melee) * GUARD_RANGED);
  if (k.trick === 'summon') return k.hp + SUMMON_MAX * MINION_HP;
  return k.hp;
}

/** A kind's damage against a plain mob's, over a stage (a Bomber's one blast lands on about 2 heroes; a Burrower picks on the back row). */
export function mobAtkWorth(k: MobKind): number {
  const hits = 1.1 / (k.cooldown ?? 1.1);
  if (k.trick === 'bomb') return (BOMB_MULT * 2) / 7;
  if (k.trick === 'summon') return k.atk * hits + SUMMON_MAX * MINION_ATK;
  if (k.trick === 'burrow') return k.atk * 1.25;
  return k.atk * hits;
}

/** A kind's gold per kill, counting a Summoner's minions and the Bombers that blow up (about half). */
export function mobGoldWorth(k: MobKind): number {
  if (k.trick === 'bomb') return 0.5 * (k.gold ?? 1);
  if (k.trick === 'summon') return (k.gold ?? 1) + SUMMON_MAX * MINION_GOLD;
  return k.gold ?? 1;
}

/** Share of regular enemies that walk (the rest are flyers, from stage 3). */
const WALKER_SHARE = 0.75;

/**
 * Averages over all mobs on `stage` from the special kinds: HP to beat, damage taken and gold, each times the
 * same stage with only the older kinds. Offline progress (GameState.canClearStage) uses it.
 */
export function mobLoad(stage: number, melee = 0.5): { hp: number; atk: number; gold: number } {
  const walkers = Object.values(MOB_KINDS).filter((k) => k.weight > 0 && stage >= k.fromStage);
  const base = walkers.filter((k) => !k.trick);
  if (base.length === walkers.length) return { hp: 1, atk: 1, gold: 1 };
  const avg = (pool: MobKind[], f: (k: MobKind) => number) => pool.reduce((t, k) => t + k.weight * f(k), 0) / pool.reduce((t, k) => t + k.weight, 0);
  const mix = (f: (k: MobKind) => number) => {
    const all = avg(walkers, f);
    const old = avg(base, f);
    return (WALKER_SHARE * all + (1 - WALKER_SHARE)) / (WALKER_SHARE * old + (1 - WALKER_SHARE));
  };
  return { hp: mix((k) => mobHpWorth(k, melee)), atk: mix(mobAtkWorth), gold: mix(mobGoldWorth) };
}
