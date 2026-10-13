import Decimal from 'break_infinity.js';
import type { HeroDef, StallDef } from './data';
import { STALL_MILESTONE } from './data';

// Tuning from an economy sim: the stage 100 boss falls when the lead hero is
// around level 100 (gold + Ember levels), the first Rekindle (after stage 125)
// comes after roughly 40 minutes, and progress walls around stage 200.
const ENEMY_GROWTH = 1.07;
const GOLD_GROWTH = 1.075;
const COST_GROWTH = 1.08;
const ENEMY_HP_BASE = 12;
const GOLD_BASE = 0.7;
/** Hero stats double every this many levels. */
const MILESTONE_LEVELS = 20;

export const isBossStage = (stage: number) => stage % 50 === 0;

export function enemyHp(stage: number): Decimal {
  return Decimal.pow(ENEMY_GROWTH, stage - 1).times(ENEMY_HP_BASE);
}

export function enemyAtk(stage: number): Decimal {
  return Decimal.pow(ENEMY_GROWTH, stage - 1).times(2);
}

export function bossHp(stage: number): Decimal {
  return enemyHp(stage).times(280);
}

export function bossAtk(stage: number): Decimal {
  return enemyAtk(stage).times(3);
}

export function crystalHp(stage: number): Decimal {
  return enemyHp(stage).times(5);
}

export function goldPerKill(stage: number): Decimal {
  return Decimal.pow(GOLD_GROWTH, stage - 1).times(GOLD_BASE);
}

export function stageClearGold(stage: number): Decimal {
  return goldPerKill(stage).times(isBossStage(stage) ? 40 : 3);
}

/** Stats scale with level and double at every milestone. */
function levelScale(level: number): Decimal {
  if (level <= 0) return new Decimal(0);
  return Decimal.pow(2, Math.floor(level / MILESTONE_LEVELS)).times(level);
}

/**
 * A hero's fighting level: gold levels (reset on Rekindle) plus Ember levels
 * (permanent). Ember levels only count once the hero is recruited this run.
 */
export function effectiveLevel(goldLevel: number, emberLevel: number): number {
  return goldLevel > 0 ? goldLevel + emberLevel : 0;
}

/** Embers granted for a Rekindle with this as the highest stage reached in the run. */
/** Ember payout multiplier from the run's best stage (x1 just past the Rekindle stage). */
export function emberStageBonus(runBestStage: number, rekindleStage: number): number {
  return Math.pow(1.06, runBestStage - rekindleStage - 1);
}

export function emberYield(runBestStage: number, rekindleStage: number, keeperBonus = 1): number {
  if (runBestStage <= rekindleStage) return 0;
  return Math.floor(40 * emberStageBonus(runBestStage, rekindleStage) * keeperBonus);
}

/** Lifetime Embers needed to reach Keeper level `level + 1`: 100, 200, 400, ... */
export function keeperThreshold(level: number): number {
  return 100 * Math.pow(2, level - 1);
}

export function keeperLevel(lifetimeEmbers: number): number {
  let level = 1;
  while (lifetimeEmbers >= keeperThreshold(level)) level++;
  return level;
}

/**
 * Embers to raise a hero's Ember level from `level` to `level + 1`: 5% more
 * per level. Rekindle pays 6% more per stage, so Ember levels keep pace with
 * the best stage (about 1.2 levels per stage) instead of running away: a
 * linear cost let a stage 300 Rekindle buy ~2,500 levels per hero. The first
 * Rekindle (~90 Embers) still buys ~35 levels, as before.
 */
export function emberCost(level: number): number {
  return Math.ceil(Math.pow(1.05, level));
}

export function heroAtk(def: HeroDef, level: number): Decimal {
  return levelScale(level).times(def.baseAtk);
}

export function heroHp(def: HeroDef, level: number): Decimal {
  return levelScale(level).times(def.baseHp);
}

/** Defense grows with level like ATK and HP. Without a baseDef it is a small share of HP, so tanky heroes defend best. */
export const DEF_PER_HP = 0.001;
export function heroDef(def: HeroDef, level: number): Decimal {
  return levelScale(level).times(def.baseDef ?? def.baseHp * DEF_PER_HP);
}

/** Damage after Defense: atk² / (atk + def). Defense equal to the hit halves it; it never blocks a hit fully. */
export function defended(amount: Decimal, def: Decimal): Decimal {
  if (def.lte(0) || amount.lte(0)) return amount;
  return amount.times(amount.div(amount.plus(def)));
}

/** Gold to go from `level` to `level + 1`. Level 0 means locked, so this is the recruit cost. */
export function upgradeCost(def: HeroDef, level: number, mult = 1): Decimal {
  if (level === 0) return new Decimal(def.unlockCost).times(mult);
  return Decimal.pow(COST_GROWTH, level - 1).times(def.upgradeBaseCost * mult);
}

/** Total cost and count for buying up to `count` levels (or as many as affordable when count is 'max'). */
export function bulkCost(def: HeroDef, level: number, count: number | 'max', gold: Decimal, mult = 1): { levels: number; cost: Decimal } {
  let total = new Decimal(0);
  let n = 0;
  const limit = count === 'max' ? 1000 : count;
  while (n < limit) {
    const next = total.plus(upgradeCost(def, level + n, mult));
    if (count === 'max' && next.gt(gold)) break;
    total = next;
    n++;
    if (level + n === 1) break; // recruiting buys exactly one level
  }
  return { levels: n, cost: total };
}

const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

export function fmt(value: Decimal | number): string {
  const d = value instanceof Decimal ? value : new Decimal(value);
  if (d.lt(1000)) return d.lt(10) && !d.eq(d.floor()) ? d.toNumber().toFixed(1) : Math.floor(d.toNumber()).toString();
  const tier = Math.floor(d.e / 3);
  if (tier < SUFFIXES.length) {
    const scaled = d.div(Decimal.pow(10, tier * 3)).toNumber();
    return `${scaled.toFixed(scaled < 10 ? 2 : scaled < 100 ? 1 : 0)}${SUFFIXES[tier]}`;
  }
  return `${d.m.toFixed(2)}e${d.e}`;
}

export function fmtDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${Math.floor(seconds % 60)}s`;
  return `${Math.floor(seconds)}s`;
}

/** Gold for one Stall cycle at a level (before the Rekindle revenue buff). */
export function stallIncome(def: StallDef, level: number): Decimal {
  if (level <= 0) return new Decimal(0);
  return new Decimal(def.baseIncome).times(level).times(Decimal.pow(3, Math.floor(level / STALL_MILESTONE)));
}

/** Gold to raise a Stall from `level` to `level + 1`; level 0 means opening it. */
export function stallUpgradeCost(def: StallDef, level: number, mult = 1): Decimal {
  if (level === 0) return new Decimal(def.unlockCost).times(mult);
  return Decimal.pow(1.07, level - 1).times(def.unlockCost * 0.4 * mult);
}

/** Total cost and count for buying up to `count` Stall levels (or as many as affordable for 'max'). Opening buys exactly one. */
export function stallBulkCost(def: StallDef, level: number, count: number | 'max', gold: Decimal, mult = 1): { levels: number; cost: Decimal } {
  let total = new Decimal(0);
  let n = 0;
  const limit = count === 'max' ? 1000 : count;
  while (n < limit) {
    const next = total.plus(stallUpgradeCost(def, level + n, mult));
    if (count === 'max' && next.gt(gold)) break;
    total = next;
    n++;
    if (level + n === 1) break;
  }
  return { levels: n, cost: total };
}

/**
 * Trial boss HP for a level. It matches what `heroes` starter-strength heroes
 * at `emberLevel` deal in 30 seconds at neutral element, so the level's hero
 * requirement (no stars) is just enough to win. Levels 1-9 have no
 * requirement and scale off one hero at about a third of the difficulty.
 */
export function trialHp(level: { difficulty: number; req: [number, number] | null }): Decimal {
  const [heroes, emberLevel] = level.req ?? [1, Math.max(1, level.difficulty * 0.35)];
  return Decimal.pow(2, emberLevel / MILESTONE_LEVELS).times(heroes * emberLevel * 6.25 * 30 * 0.9);
}

/** Trial boss damage per second. */
export function trialDps(level: { difficulty: number; req: [number, number] | null }): Decimal {
  return trialHp(level).times(0.01);
}

/**
 * Essence of each of a relic's two kinds to go from level `level` to the next
 * (0 = crafting, which costs `craft`). Doubles every 2 levels.
 */
export function relicCost(level: number, craft: number): number {
  return Math.round(craft * Math.pow(2, level / 2));
}
