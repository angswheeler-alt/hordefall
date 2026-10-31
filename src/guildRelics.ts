/**
 * Guild relics (Samuel, 2026-10-31): six relics only the Guild Boss pays for. The boss drops Warsteel; Warsteel crafts
 * and levels guild relics, never Essence or Gems. They sit in their own GUILD_RELIC_SLOTS slots, and their bonuses
 * multiply on top of everything else, so they stay worth having late in the game. Warsteel is worked out in the game
 * from fight results the server already sends, so it needs no SQL.
 */
import type Decimal from 'break_infinity.js';
import { guildBossAttemptCoins } from './formulas';

export type GuildRelicEffect = 'atk' | 'hp' | 'def' | 'speed' | 'boss' | 'guildBoss' | 'coins' | 'warsteel';

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
export function guildRelicEffect(def: GuildRelicDef, effect: GuildRelicEffect, level: number): number {
  let total = 0;
  const lv = Math.max(0, Math.min(GUILD_RELIC_MAX_LEVEL, level));
  for (const [e, v] of def.fx) if (e === effect) total += (v * lv) / GUILD_RELIC_MAX_LEVEL / 100;
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
