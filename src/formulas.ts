import Decimal from 'break_infinity.js';
import type { HeroDef, StallDef, Element } from './data';
import { STALL_MILESTONE, GUILD_BOSS_FIGHT_GAP_SECONDS, GUILD_BOSS_KILL_COINS, GUILD_BOSS_WEEK_COINS, GUILD_BOSS_LEVELS_PER_CHEST, GUILD_BOSS_WEEK_MAX_CHESTS, GUILD_BOSS_HIT_SHARE, GUILD_BOSS_HIT_PER_LEVEL, GUILD_BOSS_HIT_LEVEL_CAP } from './data';

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
 * Embers to raise a hero's Ember level from `level` to `level + 1`: 7% more
 * per level. Rekindle pays 6% more per stage, so each extra stage of a
 * Rekindle buys a bit less than one Ember level. With 5% (about 1.2 levels
 * per stage) every Rekindle reached ~40% further than the last and a bot
 * hit stage 1,200 in 10 hours of play; now the gain per Rekindle shrinks
 * and progress levels off near stage 2,000 until stars and relics push it.
 * The first Rekindle (~100 Embers) still buys ~15 levels on each of 5 heroes.
 */
export const EMBER_COST_GROWTH = 1.07;
export function emberCost(level: number): number {
  return Math.ceil(Math.pow(EMBER_COST_GROWTH, level));
}

/** Ember levels and their total cost for Buy x1 / x10 / max, the same rule as gold levels. */
export function emberBulk(level: number, count: number | 'max', embers: number): { levels: number; cost: number } {
  let cost = 0;
  let n = 0;
  const limit = count === 'max' ? 10000 : count;
  while (n < limit) {
    const next = cost + emberCost(level + n);
    if (count === 'max' && next > embers) break;
    cost = next;
    n++;
  }
  return { levels: n, cost };
}

/** Embers spent to raise a hero from Ember level 0 to `level`; what a reset gives back. */
export function emberRefund(level: number): number {
  let total = 0;
  for (let i = 0; i < level; i++) total += emberCost(i);
  return total;
}

/** Every hero's ATK x1.2 (Samuel, 2026-10-22), paired with Ultimates going from 40x to 25x ATK. */
export const HERO_ATK_MULT = 1.2;
export function heroAtk(def: HeroDef, level: number): Decimal {
  return levelScale(level).times(def.baseAtk * HERO_ATK_MULT);
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

/** After Dc the letters go on: aa, ab ... az, ba ... zz (Samuel, 2026-10-30: no scientific notation in play). */
function suffix(tier: number): string | null {
  if (tier < SUFFIXES.length) return SUFFIXES[tier];
  const n = tier - SUFFIXES.length;
  if (n >= 26 * 26) return null;
  const letter = (i: number) => String.fromCharCode(97 + i);
  return letter(Math.floor(n / 26)) + letter(n % 26);
}

export function fmt(value: Decimal | number): string {
  const d = value instanceof Decimal ? value : new Decimal(value);
  if (d.lt(1000)) return d.lt(10) && !d.eq(d.floor()) ? d.toNumber().toFixed(1) : Math.floor(d.toNumber()).toString();
  const tier = Math.floor(d.e / 3);
  const name = suffix(tier);
  if (name !== null) {
    const scaled = d.div(Decimal.pow(10, tier * 3)).toNumber();
    return `${scaled.toFixed(scaled < 10 ? 2 : scaled < 100 ? 1 : 0)}${name}`;
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

// ---------- Guild Boss (mirrors supabase/guilds.sql) ----------

/** Boss health for a level: about 15 attempts by five 1-star heroes at Ember level 30 x level. */
export function guildBossHp(level: number): Decimal {
  return Decimal.pow(2, 1.5 * level).times(14400 * 30 * level).round();
}

/**
 * Guild Coins for one attempt: everyone who tries gets the base (10 + boss level),
 * and dealing a full share of the boss (1/15 of its health) doubles it.
 */
export function guildBossAttemptCoins(level: number, damage: Decimal, hp: Decimal, parAttempts = 15): number {
  const base = 10 + level;
  const share = hp.gt(0) ? Math.min(1, damage.div(hp.div(parAttempts)).toNumber()) : 0;
  return Math.round(base * (1 + share));
}

/** Guild Coins for each level beaten, paid to every member who hit the boss that week. */
export function guildBossKillCoins(level: number): number {
  return GUILD_BOSS_KILL_COINS * (10 + level);
}

/** The weekly reward when the highest level beaten is `top`: Guild Coins and Hero Chests (none for 0). */
export function guildBossWeekReward(top: number): { coins: number; chests: number } {
  if (!(top > 0)) return { coins: 0, chests: 0 };
  return { coins: GUILD_BOSS_WEEK_COINS * (10 + top), chests: Math.min(GUILD_BOSS_WEEK_MAX_CHESTS, Math.ceil(top / GUILD_BOSS_LEVELS_PER_CHEST)) };
}

/**
 * How hard the Guild Boss hits in a live fight: after the heroes' Defense (`avgDef`, see defended) a hit lands a share
 * of the team's average max HP (GUILD_BOSS_HIT_SHARE), a little more each level (GUILD_BOSS_HIT_PER_LEVEL, up to
 * GUILD_BOSS_HIT_LEVEL_CAP). Built on the team's own health so any team can stand a while, and healers and tanks matter.
 */
export function guildBossHitAtk(avgMaxHp: Decimal, avgDef: Decimal, level: number): Decimal {
  const lv = Math.min(GUILD_BOSS_HIT_LEVEL_CAP, Math.max(0, Math.floor(level) - 1));
  const land = avgMaxHp.times(GUILD_BOSS_HIT_SHARE * (1 + GUILD_BOSS_HIT_PER_LEVEL * lv));
  if (avgDef.lte(0)) return land;
  // Undo defended(): hit^2 / (hit + def) = land  =>  hit = (land + sqrt(land^2 + 4 * land * def)) / 2.
  return land.plus(land.times(land).plus(land.times(avgDef).times(4)).sqrt()).div(2);
}

/**
 * The Guild Boss as it stands in the lane: the health left on this level, shrunk by the Elemental Studies research
 * bonus the same way Trial bosses are (damage counts `1 + bonus` times). `damageFor` turns health knocked off in the
 * lane back into the damage sent to the guild.
 */
export function guildBossLane(hp: Decimal, damage: Decimal, bonus: number): { hp: Decimal; left: Decimal; damageFor: (knocked: Decimal) => Decimal } {
  const mult = 1 + Math.max(0, bonus);
  // Past level ~35 the boss has more digits than the game's numbers keep, so "health - damage" can round to a bit
  // less than the server's exact figure. Keep a sliver standing (the server always has some left on a living boss)
  // and make a killing blow overshoot by that sliver, so the server sees the kill instead of a crumb left over.
  const margin = hp.times(GUILD_BOSS_KILL_MARGIN);
  const left = Decimal.max(margin, hp.minus(damage));
  return {
    hp: hp.div(mult),
    left: left.div(mult),
    damageFor: (knocked) => {
      const dealt = Decimal.max(0, knocked).times(mult);
      if (dealt.gt(0) && dealt.gte(left.times(1 - GUILD_BOSS_KILL_MARGIN))) return left.plus(margin).ceil();
      return Decimal.min(left, dealt).floor();
    },
  };
}

/** Share of the Guild Boss's health a killing blow overshoots by, to beat number rounding on high levels. */
export const GUILD_BOSS_KILL_MARGIN = 1e-6;

/** The Monday (UTC) of the week holding `now`, as YYYY-MM-DD: the Guild Boss week. */
export function utcWeekStart(now: number): string {
  const day = (new Date(now).getUTCDay() + 6) % 7;
  return new Date(now - day * 86_400_000).toISOString().slice(0, 10);
}

/** The boss element for a week (its Monday): water, fire, earth, light, dark in turn, like guild_boss_element. */
export function guildBossElement(week: string): Element {
  const n = Math.round((Date.parse(week) - Date.parse('2025-12-29')) / (7 * 86_400_000));
  return (['water', 'fire', 'earth', 'light', 'dark'] as const)[((n % 5) + 5) % 5];
}

/**
 * Whether this player can fight the Guild Boss now: not while it rests after a kill (`restUntil`), and not within
 * GUILD_BOSS_FIGHT_GAP_SECONDS of their own last fight (`lastFight`), like hit_guild_boss. Times are ms since epoch.
 */
export function guildBossFightWait(restUntil: number | null, lastFight: number | null, now: number): { kind: 'ready' } | { kind: 'resting' | 'cooldown'; ms: number } {
  if (restUntil !== null && restUntil > now) return { kind: 'resting', ms: restUntil - now };
  const free = lastFight === null ? 0 : lastFight + GUILD_BOSS_FIGHT_GAP_SECONDS * 1000;
  return free > now ? { kind: 'cooldown', ms: free - now } : { kind: 'ready' };
}

/** Points needed to reach a Guild Research rank: 300 x (1^2 + ... + rank^2). */
export function researchPointsFor(rank: number): number {
  return (300 * rank * (rank + 1) * (2 * rank + 1)) / 6;
}

/** Guild Research rank for a branch's points, capped at 10. */
export function researchRank(points: number): number {
  let r = 0;
  while (r < 10 && points >= researchPointsFor(r + 1)) r++;
  return r;
}
