/**
 * Guild relics (Samuel, 2026-10-31): six relics only the Guild Boss pays for. The boss drops Warsteel; Warsteel crafts
 * and levels guild relics, never Essence or Gems. They sit in their own GUILD_RELIC_SLOTS slots, and their bonuses
 * multiply on top of everything else, so they stay worth having late in the game. Warsteel is worked out in the game
 * from fight results the server already sends, so it needs no SQL.
 */
import type Decimal from 'break_infinity.js';
import { guildBossAttemptCoins } from './formulas';
import type { Element } from './data';

/** elemAtk / elemHp count only for heroes of the relic's own element (boss relics). */
export type GuildRelicEffect = 'atk' | 'hp' | 'def' | 'speed' | 'boss' | 'guildBoss' | 'coins' | 'warsteel' | 'elemAtk' | 'elemHp';

export interface GuildRelicDef {
  id: string;
  name: string;
  /** Tier 1 is open from the start; tier 2 opens once any guild relic reaches GUILD_RELIC_TIER2_LEVEL. */
  tier: 1 | 2;
  /** Effects as [effect, percent at max level]; they grow evenly from level 1. 100 = x2. */
  fx: Array<[GuildRelicEffect, number]>;
  blurb: string;
}

export const GUILD_RELICS: GuildRelicDef[] = [
  { id: 'g_standard', name: 'Warlord\'s Standard', tier: 1, fx: [['guildBoss', 100], ['atk', 25]], blurb: 'The banner your guild marches under.' },
  { id: 'g_spear', name: 'Slayer\'s Spear', tier: 1, fx: [['boss', 50]], blurb: 'Made for one job: bringing down bosses. Works on stage, Trial and Guild bosses.' },
  { id: 'g_aegis', name: 'Oathkeeper Aegis', tier: 1, fx: [['hp', 50], ['def', 25]], blurb: 'Every guildmate\'s oath is carved on it.' },
  { id: 'g_drum', name: 'Rallying Drum', tier: 2, fx: [['speed', 15]], blurb: 'Its beat sets the pace for the whole team.' },
  { id: 'g_ledger', name: 'Coinmaster\'s Ledger', tier: 2, fx: [['coins', 50]], blurb: 'Nothing goes unpaid. Counts Guild Coins from Guild Boss fights and claims.' },
  { id: 'g_pick', name: 'Shardseeker Pick', tier: 2, fx: [['warsteel', 50]], blurb: 'Finds the good bits in every boss.' },
];

export const GUILD_RELIC_MAX_LEVEL = 20;
/**
 * Tempering (2026-11-07, economy audit): past GUILD_RELIC_MAX_LEVEL a guild relic keeps levelling with Warsteel
 * (same cost growth), each level adding GUILD_RELIC_TEMPER_SHARE of its full effect, so Warsteel never piles up
 * unused (~135,000 by day 365 in the simulator). GUILD_RELIC_TEMPER_CAP keeps numbers sane.
 */
export const GUILD_RELIC_TEMPER_SHARE = 0.05;
export const GUILD_RELIC_TEMPER_CAP = 200;
export const GUILD_RELIC_SLOTS = 3;
/** Tier 2 guild relics open once any guild relic reaches this level. */
export const GUILD_RELIC_TIER2_LEVEL = 10;
/** Warsteel to craft a guild relic, by tier. */
export const GUILD_RELIC_CRAFT: Record<1 | 2, number> = { 1: 300, 2: 800 };
/** Each level after crafting costs GUILD_RELIC_LEVEL_SHARE of the craft price, x GUILD_RELIC_LEVEL_GROWTH per level. */
export const GUILD_RELIC_LEVEL_SHARE = 0.2;
export const GUILD_RELIC_LEVEL_GROWTH = 1.15;

/** Warsteel per level beaten: GUILD_WARSTEEL_KILL_BASE + GUILD_WARSTEEL_KILL_PER_LEVEL x level. */
export const GUILD_WARSTEEL_KILL_BASE = 20;
export const GUILD_WARSTEEL_KILL_PER_LEVEL = 2;
/** Warsteel at week end, per level of the highest level beaten. */
export const GUILD_WARSTEEL_WEEK_PER_LEVEL = 10;

/** Warsteel to go from `level` to `level + 1` (level 0 means crafting). */
export function guildRelicCost(def: GuildRelicDef, level: number): number {
  const craft = GUILD_RELIC_CRAFT[def.tier];
  if (level <= 0) return craft;
  return Math.round(craft * GUILD_RELIC_LEVEL_SHARE * Math.pow(GUILD_RELIC_LEVEL_GROWTH, level));
}

/** Warsteel from crafting to max level. */
export function guildRelicTotalCost(def: GuildRelicDef): number {
  let total = 0;
  for (let l = 0; l < GUILD_RELIC_MAX_LEVEL; l++) total += guildRelicCost(def, l);
  return total;
}

/** Bonus (0.5 = +50%) from one guild relic effect at a level. */
export function guildRelicEffect(def: { fx: Array<[GuildRelicEffect, number]> }, effect: GuildRelicEffect, level: number): number {
  let total = 0;
  const top = GUILD_RELIC_MAX_LEVEL + GUILD_RELIC_TEMPER_CAP;
  const lv = Math.max(0, Math.min(top, level));
  const share = Math.min(GUILD_RELIC_MAX_LEVEL, lv) / GUILD_RELIC_MAX_LEVEL + Math.max(0, lv - GUILD_RELIC_MAX_LEVEL) * GUILD_RELIC_TEMPER_SHARE;
  for (const [e, v] of def.fx) if (e === effect) total += (v * share) / 100;
  return total;
}

/** Warsteel for one rewarded Guild Boss fight: 10 + level, doubled for a full share of the boss (like its Guild Coins). */
export function warsteelForFight(level: number, damage: Decimal, hp: Decimal, parAttempts = 15): number {
  return guildBossAttemptCoins(level, damage, hp, parAttempts);
}

/** Warsteel for each Guild Boss level beaten, paid on Claim. */
export function warsteelForKill(level: number): number {
  return GUILD_WARSTEEL_KILL_BASE + GUILD_WARSTEEL_KILL_PER_LEVEL * Math.max(0, level);
}

/** Warsteel for a finished week, by the highest level beaten. */
export function warsteelForWeek(top: number): number {
  return top > 0 ? GUILD_WARSTEEL_WEEK_PER_LEVEL * top : 0;
}

/**
 * Boss items and boss relics (Samuel, 2026-11-07: "guild relics are so easy to buy and max out"). Each weekly Guild Boss
 * has three items of its own. Every rewarded fight, and every level beaten when claimed, rolls each item separately:
 * common BOSS_ITEM_CHANCE[0], rare [1], very rare [2] (Samuel's 20% / 5% / 1%). After BOSS_HEART_PITY rolls against a
 * boss without its very rare item, the next roll gives one. Items build and level that boss's two relics, so each boss
 * week is its own grind. Worked out in the game from fight results, so no SQL.
 */
export type BossItemTier = 0 | 1 | 2;
/** Counts of a boss's items: [common, rare, very rare]. */
export type BossItemCounts = [number, number, number];
export const BOSS_ITEM_CHANCE: readonly [number, number, number] = [0.2, 0.05, 0.01];
export const BOSS_HEART_PITY = 60;
export const BOSS_ITEM_NAMES: Record<Element, readonly [string, string, string]> = {
  water: ['Leviathan Scale', 'Tide Pearl', 'Abyss Heart'],
  fire: ['Cinder Ash', 'Molten Core', 'Tyrant Heart'],
  earth: ['Behemoth Chip', 'Granite Core', 'Mountain Heart'],
  light: ['Seraph Feather', 'Dawn Pearl', 'Radiant Heart'],
  dark: ['Devourer Fang', 'Void Pearl', 'Night Heart'],
};

export interface BossRelicDef {
  id: string;
  name: string;
  element: Element;
  /** Items to build it: [common, rare, very rare] of its boss. */
  build: BossItemCounts;
  fx: Array<[GuildRelicEffect, number]>;
  blurb: string;
}

/** Each boss's first relic boosts its element's heroes; the second (needs a very rare item) helps the whole team. */
export const BOSS_RELICS: BossRelicDef[] = [
  { id: 'b_water1', name: 'Tidecaller Pearl', element: 'water', build: [5, 1, 0], fx: [['elemAtk', 60], ['elemHp', 30]], blurb: 'Pulled from the Leviathan\'s jaw. Water heroes only.' },
  { id: 'b_water2', name: 'Abyssal Anchor', element: 'water', build: [5, 2, 1], fx: [['hp', 40], ['def', 25]], blurb: 'Nothing moves the one who holds it.' },
  { id: 'b_fire1', name: 'Cinder Crown', element: 'fire', build: [5, 1, 0], fx: [['elemAtk', 60], ['elemHp', 30]], blurb: 'Still warm from the Tyrant\'s brow. Fire heroes only.' },
  { id: 'b_fire2', name: 'Tyrant\'s Brand', element: 'fire', build: [5, 2, 1], fx: [['atk', 30]], blurb: 'Marks the whole team as dangerous.' },
  { id: 'b_earth1', name: 'Heartstone Idol', element: 'earth', build: [5, 1, 0], fx: [['elemAtk', 60], ['elemHp', 30]], blurb: 'Carved from the Behemoth\'s core. Earth heroes only.' },
  { id: 'b_earth2', name: 'Mountain Bulwark', element: 'earth', build: [5, 2, 1], fx: [['def', 50], ['hp', 20]], blurb: 'A slab of the mountain itself.' },
  { id: 'b_light1', name: 'Halo of Dawn', element: 'light', build: [5, 1, 0], fx: [['elemAtk', 60], ['elemHp', 30]], blurb: 'Fell from the Seraph\'s head. Light heroes only.' },
  { id: 'b_light2', name: 'Radiant Plume', element: 'light', build: [5, 2, 1], fx: [['speed', 12]], blurb: 'Light as air, quick as light.' },
  { id: 'b_dark1', name: 'Eye of the Void', element: 'dark', build: [5, 1, 0], fx: [['elemAtk', 60], ['elemHp', 30]], blurb: 'It still watches. Dark heroes only.' },
  { id: 'b_dark2', name: 'Night Fang', element: 'dark', build: [5, 2, 1], fx: [['boss', 35]], blurb: 'Bites hardest at the biggest prey.' },
];

export const BOSS_RELIC_SLOTS = 2;
/** Boss relics stop at GUILD_RELIC_MAX_LEVEL (no Tempering). */
export const BOSS_RELIC_MAX_LEVEL = GUILD_RELIC_MAX_LEVEL;
/** Warsteel per level: BOSS_RELIC_WARSTEEL x GUILD_RELIC_LEVEL_GROWTH^level (like a tier 2 guild relic). */
export const BOSS_RELIC_WARSTEEL = 160;
/** Levels whose upgrade needs a rare item (reaching Lv 10) and a very rare item (reaching the max). */
export const BOSS_RELIC_RARE_AT = 9;
/** The 6 guild relics: from this level up, each level (and each Tempering level) also costs one common boss item, from any boss. */
export const GUILD_RELIC_ITEM_FROM = 10;

/** Cost to go from `level` to `level + 1` (level 0 = build), or null at max. */
export function bossRelicCost(def: BossRelicDef, level: number): { warsteel: number; items: BossItemCounts } | null {
  if (level >= BOSS_RELIC_MAX_LEVEL) return null;
  if (level <= 0) return { warsteel: 0, items: [...def.build] as BossItemCounts };
  return {
    warsteel: Math.round(BOSS_RELIC_WARSTEEL * Math.pow(GUILD_RELIC_LEVEL_GROWTH, level)),
    items: [1, level === BOSS_RELIC_RARE_AT ? 1 : 0, level === BOSS_RELIC_MAX_LEVEL - 1 ? 1 : 0],
  };
}

/** Common boss items the 6 guild relics need for their next level (0 below GUILD_RELIC_ITEM_FROM). */
export function guildRelicItemCost(level: number): number {
  return level >= GUILD_RELIC_ITEM_FROM ? 1 : 0;
}

/**
 * Roll a boss's items `rolls` times. `pity` is the rolls since its last very rare item; returns the items and the new pity.
 * Every tier rolls on its own, so one roll can give several items.
 */
export function rollBossItems(rolls: number, pity: number, rng: () => number = Math.random): { items: BossItemCounts; pity: number } {
  const items: BossItemCounts = [0, 0, 0];
  for (let i = 0; i < rolls; i++) {
    if (rng() < BOSS_ITEM_CHANCE[0]) items[0]++;
    if (rng() < BOSS_ITEM_CHANCE[1]) items[1]++;
    if (pity >= BOSS_HEART_PITY || rng() < BOSS_ITEM_CHANCE[2]) {
      items[2]++;
      pity = 0;
    } else pity++;
  }
  return { items, pity };
}
