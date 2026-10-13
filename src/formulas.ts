import Decimal from 'break_infinity.js';
import type { HeroDef } from './data';

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
  return enemyHp(stage).times(140);
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
export function emberYield(runBestStage: number, rekindleStage: number): number {
  if (runBestStage <= rekindleStage) return 0;
  return Math.floor(40 * Math.pow(1.06, runBestStage - rekindleStage - 1));
}

/** Embers to raise a hero's Ember level from `level` to `level + 1`. */
export function emberCost(level: number): number {
  return 1 + Math.floor(level / 10);
}

export function heroAtk(def: HeroDef, level: number): Decimal {
  return levelScale(level).times(def.baseAtk);
}

export function heroHp(def: HeroDef, level: number): Decimal {
  return levelScale(level).times(def.baseHp);
}

/** Gold to go from `level` to `level + 1`. Level 0 means locked, so this is the recruit cost. */
export function upgradeCost(def: HeroDef, level: number): Decimal {
  if (level === 0) return new Decimal(def.unlockCost);
  return Decimal.pow(COST_GROWTH, level - 1).times(def.upgradeBaseCost);
}

/** Total cost and count for buying up to `count` levels (or as many as affordable when count is 'max'). */
export function bulkCost(def: HeroDef, level: number, count: number | 'max', gold: Decimal): { levels: number; cost: Decimal } {
  let total = new Decimal(0);
  let n = 0;
  const limit = count === 'max' ? 1000 : count;
  while (n < limit) {
    const next = total.plus(upgradeCost(def, level + n));
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
