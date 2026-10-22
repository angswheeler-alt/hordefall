import Decimal from 'break_infinity.js';
import { DAILIES, DAILY_GEMS, MEDAL_BUNDLE_HEROES, MEDAL_BUNDLE_DAILIES, LOGIN_CYCLE, SPIN_SLICES, ACHIEVEMENTS, BOOTCAMP, STAT_KEYS, MILESTONE_STEP, milestoneReward, dayKey, type Reward, type StatKey, type AchievementDef, type BootcampDef } from './rewards';
import { HEROES, OFFLINE_CAP_HOURS, BOSS_EVERY, REKINDLE_STAGE, HEAD_START_FROM, HEAD_START_SHARE, HEAD_START_POWER, HEAD_START_MIN_PUSH, KEEPER_BONUS_PER_LEVEL, LEVEL_GIFT_STONES, REKINDLE_BOOSTS, ROAD_START, ROAD_STEP, ROAD_LENGTH, WHEEL_PRIZES, ESSENCE_NAMES, TEAM_SLOTS_START, TEAM_SLOTS_MAX, TEAM_SLOT_COSTS, OLD_SAVE_TEAM_SLOTS, ULT_SLOTS_START, ULT_SLOT_COSTS, ULT_SLOTS_MAX, HOURGLASS_GEMS, HOURGLASS_MINUTES, HOURGLASS_PER_DAY, GOLD_BOOST_GEMS, GOLD_BOOST_MINUTES, GOLD_BOOST_MAX_MINUTES, GOLD_BOOST_MULT, MEDAL_PACK, HERO_SHOP_OFFERS, HERO_SHOP_DEALS, HERO_SHOP_REFRESH_MINUTES, HERO_SHOP_REFRESH_GEMS, FEATURED_BUNDLE, FEATURED_BIG_BUNDLE, FEATURED_BIG_EVERY, TICKET_GEMS, TICKETS_PER_DAY, BOUGHT_TICKET_CAP, TRIAL_EVENT_EVERY, TRIAL_EVENT_PHASE, TRIAL_EVENT_DAYS, TRIAL_EVENT_MEDAL_MULT, TICKET_CRATE, HERO_VOUCHER, ALL_TRIALS_WITH, TRIAL_ROTATION, TRIAL_SCHEDULE, TRIAL_TIERS, TRIAL_LEVELS, TRIAL_TIME, TRIAL_QUICK_TIME, TRIAL_UNLOCK_STAGE, TICKET_MINUTES, TICKET_CAP, BOSS_TIME_LIMIT, AUTO_BOSS_SECONDS, OFFLINE_BOSS_TIME_SHARE, OFFLINE_BOSS_COOLDOWN, elementMultiplier, bossElement, bossHasElement, bossImmuneTo, STALLS, STALL_AUTO_LEVEL, STALL_REKINDLE_REVENUE, STALL_REKINDLE_LEVELS, STALL_REKINDLE_LEVELS_CAP, START_GEMS, RELICS, RELIC_SETS, RELIC_BASE_MAX, RELIC_ENHANCE_LEVELS, RELIC_ENHANCE_COSTS, RELIC_MAX_STARS, RELIC_START_SLOTS, RELIC_SLOT_COSTS, RELIC_SLOT_STAGES, RELIC_SHOP_SIZE, RELIC_SHOP_REFRESH_MINUTES, CHEST_COST, CHEST_DROPS, CREST_ROLLS, CHEST_RARITY_WEIGHTS, TRIAL_MEDALS, TRIAL_RARITY_WEIGHTS, STAR_CRESTS, MAX_STARS, REGULAR_MAX_STARS, UNLOCK_CRESTS, LEGENDARY_MEDAL_RATE, LEGENDARY_UNLOCK_MEDALS, LEGENDARY_STAR_MEDALS, RAISED_RARITY_OLD_COST, GUILD_CREDITS_PER_MEDAL, GUILD_SHOP, type GuildShopId, GUILD_EMBER_POUCHES_PER_DAY, GUILD_BOOST_MINUTES, GUILD_BOOST_MAX_MINUTES, GUILD_BOOSTS, GUILD_SHOP_OFFERS, GUILD_OFFER_MEDALS, GUILD_OFFER_COST, GUILD_WILD_COST, GUILD_WILD_PER_WEEK, GUILD_QUEST_TRACK, GUILD_QUEST_PERSONAL_COINS, STAR_STAT_MULT, AWAKEN_STARMOTES, MAX_AWAKEN, AWAKEN_STAT_MULT, AWAKEN_UNLOCK_LEVEL, GUILD_BOSS_SECONDS, GUILD_BOSS_PAR_ATTEMPTS, GUILD_BOSS_KILL_EMBERS, GUILD_BOSS_KILL_MIN_EMBERS, GUILD_BOSS_GOLD_MINUTES, GUILD_RESEARCH, GUILD_RESEARCH_MAX_RANK, type ResearchBranch } from './data';
import { utcWeekStart, guildBossElement, relicCost, bossHp, bossAtk, trialHp, trialDps, stallIncome, stallUpgradeCost, stallBulkCost, upgradeCost, emberYield, emberRefund, emberBulk, keeperLevel, effectiveLevel, heroAtk, heroHp, heroDef, defended, goldPerKill, guildBossAttemptCoins, guildBossKillCoins, guildBossWeekReward } from './formulas';
import type { WheelPrize, HeroDef, StallDef, Element, RelicDef, RelicEffect, Rarity } from './data';
import { RENAMED_HEROES, PLAYABLE_HEROES, RELEASED_HEROES, ASCENDANT_CHEST } from './data';
import { activeEffects, mulEffect, sumEffect, type ActiveEffect } from './skills';
import { isKnight, combatPower, type HeroStats } from './stats';
import { heroProfile, heroBuildEffects, buildBonus, BUILD_EFFECTS, type BuildEffect } from './profiles';
import { PVP_TICKET_CAP, PVP_TICKET_MINUTES, PVP_TICKET_GEMS, PVP_TICKET_BUYS, PVP_REFRESH_MINUTES, PVP_CP_MIN, PVP_CP_MAX, PVP_REAL_MIN, PVP_REAL_MAX, PVP_WIN_TROPHIES, PVP_WIN_MOTES, PVP_LOSS_TROPHIES, PVP_LOSS_MOTES, PVP_FIRST_WIN_MOTES, PVP_STREAK_DMG, PVP_STREAK_MAX, RANK_PRESSURE, RANK_DAILY, RANK_WEEKLY, rankIndex, rankName, droppedTrophies, seededRandom, ghostName, simulatePvp, type PvpUnit, type PvpResult } from './colosseum';
import { TUTORIAL_DONE, TIP_IDS } from './tutorialSteps';
import { ascendBlocker, ascendNeeds, clampForm, resolveForm, COUNTERED_BY, type AscendBlocker, type AscendContext, type AscendantDef } from './ascendant';
import { ascendantDef, isAscendant, ASCENDANT_HEROES } from './heroes/ascendant';

const SAVE_KEY = 'hordefall-save-v1';

export interface SummonDrop {
  heroId: string;
  crests: number;
  isNew: boolean;
}

export interface OfflineReport {
  seconds: number;
  gold: Decimal;
  stages: number;
  /** Bosses beaten while away (only ones the team could beat). */
  bosses: number;
  /** Part of `gold` that came from auto-collect Stalls. */
  market: Decimal;
}

export interface RekindleResult {
  embers: number;
  /** One line per Rekindle Wheel spin. */
  wheel: string[];
  levelsGained: number;
  /** Enhance Stones gifted for new player levels. Rekindling never pays medals. */
  stones: number;
  /** The stage the new run starts at (later than 1 with a head start). */
  start: number;
}

export type SaveData = Record<string, any>;

/** A Colosseum opponent: another player's saved team, or a Ghost (bot) team built from a seed to a target CP. The game never shows which. */
export interface PvpOpponent {
  name: string;
  ghost: boolean;
  heroes: Array<{ id: string; stars: number }>;
  ember: number;
  /** ATK, HP and Defense multiplier that fine-tunes a Ghost onto its target CP (Ember levels jump in steps). */
  power?: number;
  cp: string;
  /** A real player's defense team: their id and each hero's saved stats (see pvpSnapshot). */
  userId?: string;
  snap?: PvpSnapHero[];
}

/** One hero of a saved Colosseum defense team: permanent stats, as uploaded by its owner. */
export interface PvpSnapHero {
  id: string;
  stars: number;
  awaken: number;
  atk: string;
  hp: string;
  def: string;
  aps: number;
  crit: number;
  critDmg: number;
  move: number;
}

/** Another player's defense team offered by the server. */
export interface PvpCandidate {
  userId: string;
  name: string;
  cp: string;
  team: PvpSnapHero[];
}

/** A saved hero from the server, checked: numbers finite and in range, and a hero that exists. */
export function cleanSnapHero(v: unknown): PvpSnapHero | null {
  const o = v as Partial<PvpSnapHero> | null;
  if (!o || typeof o !== 'object' || typeof o.id !== 'string' || !HEROES.some((h) => h.id === o.id)) return null;
  const big = (x: unknown) => (typeof x === 'string' && /^[0-9.e+]{1,40}$/.test(x) ? x : null);
  const n = (x: unknown, lo: number, hi: number) => (typeof x === 'number' && Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : null);
  const atk = big(o.atk), hp = big(o.hp), def = big(o.def);
  const aps = n(o.aps, 0.05, 20), crit = n(o.crit, 0, 1), critDmg = n(o.critDmg, 0, 100), move = n(o.move, 0, 1000);
  if (!atk || !hp || !def || aps === null || crit === null || critDmg === null || move === null) return null;
  return { id: o.id, stars: Math.floor(n(o.stars, 0, MAX_STARS) ?? 0), awaken: Math.floor(n(o.awaken, 0, MAX_AWAKEN) ?? 0), atk, hp, def, aps, crit, critDmg, move };
}

/** Stats with ATK, HP and Defense multiplied by `p`. */
function scaleStats(st: HeroStats, p: number): HeroStats {
  if (p === 1) return st;
  const big = (b: HeroStats['atk']) => ({ value: b.value.times(p), base: b.base.times(p) });
  return { ...st, atk: big(st.atk), hp: big(st.hp), def: big(st.def) };
}

/** A Colosseum fight's outcome, already paid out. */
export interface PvpFight {
  foe: PvpOpponent;
  won: boolean;
  trophies: number;
  starmotes: number;
  firstWin: boolean;
  rankBefore: number;
  rankAfter: number;
}

export interface PvpState {
  trophies: number;
  tickets: number;
  clock: number;
  streak: number;
  wins: number;
  losses: number;
  /** Day and week (Monday) last rewarded; empty until the Colosseum first opens. */
  day: string;
  week: string;
  /** Day of the last first-win bonus. */
  firstWin: string;
  buys: { day: string; used: number };
  /** Opponent lists made so far (seeds the Ghosts) and when a free new list is ready (ms). */
  refreshes: number;
  refreshAt: number;
  picks: PvpOpponent[];
  /** Daily/weekly reward lines not shown to the player yet. */
  notes: string[];
  /** Attack and defense teams (hero ids); empty means the lineup. */
  attack: string[];
  defense: string[];
  /** The opponent slot being fought right now (its ticket is spent), or -1. */
  active: number;
}

const newPvp = (): PvpState => ({ trophies: 0, tickets: PVP_TICKET_CAP, clock: Date.now(), streak: 0, wins: 0, losses: 0, day: '', week: '', firstWin: '', buys: { day: '', used: 0 }, refreshes: 0, refreshAt: 0, picks: [], notes: [], attack: [], defense: [], active: -1 });

export interface TrialResult {
  won: boolean;
  /** Seconds the fight lasted (capped at the time limit). */
  seconds: number;
  essence: number;
  /** Enhance Stones won (Trial level 6 and up). */
  stones: number;
  /** One Hero Crest per medal, to these heroes (a hero can appear twice). */
  medals: string[];
}

export interface StallState {
  level: number;
  /** Seconds into the current cycle. */
  progress: number;
}

/**
 * All persistent game state. Saves to localStorage for the prototype; the GDD
 * calls for a server-authoritative save later, with local storage as a cache.
 */
/** Research ranks kept to whole numbers from 1 to the max rank; unknown branches dropped. */
function cleanResearch(ranks: Partial<Record<ResearchBranch, number>>): Partial<Record<ResearchBranch, number>> {
  const clean: Partial<Record<ResearchBranch, number>> = {};
  for (const b of GUILD_RESEARCH) {
    const r = Math.min(GUILD_RESEARCH_MAX_RANK, Math.max(0, Math.floor(Number(ranks[b.id]) || 0)));
    if (r) clean[b.id] = r;
  }
  return clean;
}

interface GuildOffer { heroId: string; crests: number; cost: number; bought: boolean }
interface GuildShopState { day: string; offers: GuildOffer[]; pouches: number; week: string; wild: number }
type GuildRarity = keyof typeof GUILD_OFFER_MEDALS;
const guildRarity = (h: HeroDef): GuildRarity | null => (h.rarity in GUILD_OFFER_MEDALS ? (h.rarity as GuildRarity) : null);

/** The Monday that starts this week (local time), as a day key. */
export function weekKey(now = Date.now()): string {
  const d = new Date(now);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return dayKey(d.getTime());
}

/** Which week this is, counted from 1970 (weeks start Monday, local time). */
export function weekIndex(now = Date.now()): number {
  const d = new Date(now);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return Math.floor(d.getTime() / (7 * 86_400_000));
}

/** Heroes the Gem Hero Shop sells medals for: released and not Legendary. */
/** Legendary heroes unlock and gain stars from the shared Legendary medal pool, never from their own medals. */
const isLegendary = (id: string) => HEROES.find((h) => h.id === id)?.rarity === 'legendary';

// Ascendant heroes come only from their own sources (the Ascendant Chest), never from chests, shops or Trials.
export const SHOP_HEROES: HeroDef[] = PLAYABLE_HEROES.filter((h) => h.rarity !== 'legendary' && !isAscendant(h.id));
/** Featured hero order: every shop hero once per round, mixed by a fixed hash so neighbours differ. */
const FEATURED_ORDER: HeroDef[] = [...SHOP_HEROES].sort((a, b) => idHash(a.id) - idHash(b.id) || a.id.localeCompare(b.id));
function idHash(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** A medal pack's Gem price for a hero, or null for heroes the shop doesn't sell. */
export function medalPackCost(heroId: string): number | null {
  const h = SHOP_HEROES.find((x) => x.id === heroId);
  return h ? MEDAL_PACK.gems[h.rarity as keyof typeof MEDAL_PACK.gems] ?? null : null;
}

export interface HeroShopOffer { heroId: string; medals: number; gems: number; bought: boolean }

export class GameState {
  gold = new Decimal(0);
  stage = 1;
  bestStage = 1;
  /** Highest stage reached since the last Rekindle; sets the Ember payout. */
  runBestStage = 1;
  /** Where this run started: 1, or later with a Rekindle head start. */
  runStartStage = 1;
  /** Whether Rekindles take the head start (the player can turn it off on the Rekindle page). */
  headStart = true;
  embers = 0;
  emberLevels: Record<string, number> = Object.fromEntries(HEROES.map((h) => [h.id, 0]));
  rekindles = 0;
  /** Elemental Trials: tickets, when the next one started charging, best tier cleared per element, essences. */
  tickets = TICKET_CAP;
  ticketClock = Date.now();
  trialBest: Record<string, number> = {};
  /** Fastest win in seconds per Trial level, keyed "element:tier". */
  trialTimes: Record<string, number> = {};
  essences: Record<string, number> = {};
  /** Recruited heroes taken out of the lineup. They keep gold levels but don't fight. */
  benched: Record<string, boolean> = {};
  /** Market Row Stalls; level 0 means not opened. Reset on Rekindle. */
  stalls: Record<string, StallState> = Object.fromEntries(STALLS.map((s) => [s.id, { level: 0, progress: 0 }]));
  /** Every Ember ever earned; sets the Keeper level. */
  lifetimeEmbers = 0;
  /** Lifetime counters for achievements and Bootcamp. */
  stats: Record<StatKey, number> = Object.fromEntries(STAT_KEYS.map((k) => [k, 0])) as Record<StatKey, number>;
  /** Today's daily challenge progress; reset when the local day changes. */
  daily: { day: string; counts: Partial<Record<StatKey, number>>; claimed: StatKey[] } = { day: dayKey(), counts: {}, claimed: [] };
  /** Login calendar: days claimed so far (position in the 5-day cycle is this mod 5) and the last day claimed. */
  login = { count: 0, last: '' };
  /** Day of the last free Lucky Spin. */
  spinDay = '';
  /** Today's free Daily Medal Bundle: the heroes and medals it holds, rolled once a day. */
  medalBundle: { day: string; drops: Array<{ heroId: string; crests: number }>; claimed: boolean } = { day: '', drops: [], claimed: false };
  /** Achievement tiers already claimed, by achievement id. */
  achieved: Record<string, number> = {};
  /** Bootcamp goals already claimed. */
  bootcamp: string[] = [];
  /** Highest Stage Milestone claimed (a multiple of MILESTONE_STEP; 0 = none). Lifetime, never reset. */
  milestone = 0;
  /** Hero Crests (copies) per hero, for evolution. Nothing drops them yet. */
  crests: Record<string, number> = Object.fromEntries(HEROES.map((h) => [h.id, 0]));
  /** Evolution stars per hero (0-7). Permanent. */
  stars: Record<string, number> = Object.fromEntries(HEROES.map((h) => [h.id, 0]));
  /** Pink awakening stars per hero (0-8), never more than the hero's yellow stars. Permanent. */
  awaken: Record<string, number> = {};
  /** Awakening currency, earned in the Colosseum. */
  starmotes = 0;
  /** Colosseum (PvP): trophies, tickets, rewards and the current opponents. */
  pvp: PvpState = newPvp();
  /** While a Colosseum battle runs, star skills and builds follow the attack team instead of the lineup. Not saved. */
  skillTeam: Set<string> | null = null;
  gems = START_GEMS;
  levels: Record<string, number> = Object.fromEntries(HEROES.map((h) => [h.id, h.unlockCost === 0 ? 1 : 0]));
  /** False after losing to a boss: clears repeat the current stage until the player challenges again. */
  autoAdvance = true;
  /** Retry a lost boss on its own after AUTO_BOSS_SECONDS of farming. */
  autoBoss = true;
  /** When the next automatic boss retry is due (ms clock), 0 when not counting. Not saved. */
  bossRetryAt = 0;
  speed2x = false;
  autoUlt = false;
  muted = false;
  /** Sound effects and music volume, 0 to 1. */
  sfxVolume = 1;
  musicVolume = 0.6;
  /** First-time guide: the intro step the player is on (TUTORIAL_DONE once finished or skipped), and the one-off tips already shown. */
  tutorialStep = 0;
  tipsSeen: string[] = [];
  buyAmount: 1 | 10 | 'max' = 1;
  /** Relic levels (0 = not crafted), Enhances done per relic, equipped relic ids, owned slots and Enhance Stones. */
  relics: Record<string, number> = {};
  relicEnhance: Record<string, number> = {};
  equipped: string[] = [];
  relicSlots = RELIC_START_SLOTS;
  /** Team slots owned: how many heroes can fight at once (bought with Gems up to TEAM_SLOTS_MAX). */
  teamSlots = TEAM_SLOTS_START;
  /** Ultimate slots owned, and the heroes the player put in them (others in the team fill any open slot). */
  ultSlots = ULT_SLOTS_START;
  ultPicks: string[] = [];
  /** Team heroes the player took out of the Ultimate slots; they don't fill open slots. */
  ultSkip: string[] = [];
  /** The Relic Shop's offers (relic ids), when New relics can be used again, and whether it was ever stocked. */
  relicShop: { offers: string[]; refreshAt: number; rolled: boolean } = { offers: [], refreshAt: 0, rolled: false };
  enhanceStones = 0;
  /** Earned by giving medals to guildmates; spent in the guild shop. */
  guildCredits = 0;
  /** Guild shop: today's hero offers, Ember pouches bought today and Wild Medals bought this week. */
  guildShop: GuildShopState = { day: '', offers: [], pouches: 0, week: '', wild: 0 };
  /** When the guild shop's Gold Banner and War Horn run out (ms). */
  boosts: { banner: number; horn: number } = { banner: 0, horn: 0 };
  /** When the Gem Shop's Gold Boost runs out (ms). */
  goldBoostUntil = 0;
  /** Hourglasses used today (the Gem Shop limits them per day). */
  hourglasses: { day: string; used: number } = { day: '', used: 0 };
  /** Gem Hero Shop: the rotating offers and when they next refresh for free (ms). */
  heroShop: { offers: HeroShopOffer[]; refreshAt: number } = { offers: [], refreshAt: 0 };
  /** The Hero Shop set the player last looked at (its refreshAt), so a new set can light the Shop tab. */
  heroShopSeen = 0;
  /** Featured hero bundles bought this week. */
  featured: { week: number; small: boolean; big: boolean } = { week: 0, small: false, big: false };
  /** Trial tickets bought with Gems today. */
  ticketBuys: { day: string; used: number } = { day: '', used: 0 };
  /** Bought Trial tickets, kept apart from the ones that refill over time (up to BOUGHT_TICKET_CAP). */
  boughtTickets = 0;
  /** Limited deals: the week index each was last bought in, and Hero Vouchers not used yet. */
  deals: { crateWeek: number; voucherWeek: number } = { crateWeek: -1, voucherWeek: -1 };
  /** Ascendant Chests bought this Guild Boss week (Monday UTC). */
  ascChest: { week: string; bought: number } = { week: '', bought: 0 };
  vouchers = 0;
  /** Counts for Guild Quests not yet sent to the server. */
  guildQuestPending = { kills: 0, stages: 0, trials: 0 };
  /** Guild Research ranks of the player's guild, cached from the server (empty outside a guild). */
  guildResearch: Partial<Record<ResearchBranch, number>> = {};
  /** Legendary medals, made by maxed heroes from extra medals; any Legendary hero spends them to unlock and gain stars. */
  legendaryMedals = 0;
  /** Ascendant heroes' forms (src/ascendant.ts): 0 = Common up to 3 = Legendary. Missing = Common; a form never goes down. */
  forms: Record<string, number> = {};
  /**
   * Save fields this version of the game doesn't know (written by a newer version on another device). They are
   * written back untouched, so an older copy of the game never drops progress it can't read.
   */
  private unknownFields: SaveData = {};
  /** Market Row's own buy amount, separate from the heroes'. */
  stallBuyAmount: 1 | 10 | 'max' = 1;
  /** Smoothed gold per second and seconds per stage, used for offline earnings. */
  goldPerSec = 0;
  secondsPerStage = 20;
  lastSeen = Date.now();

  private listeners: Array<() => void> = [];

  onChange(fn: () => void) {
    this.listeners.push(fn);
  }

  emit() {
    for (const fn of this.listeners) fn();
  }

  /** Fighting level for a hero: gold level plus permanent Ember levels. */
  heroLevel(id: string): number {
    return effectiveLevel(this.levels[id] ?? 0, this.emberLevels[id] ?? 0);
  }

  reachStage(stage: number) {
    this.stage = stage;
    this.bestStage = Math.max(this.bestStage, stage);
    this.runBestStage = Math.max(this.runBestStage, stage);
  }

  /** Star skills currently in force (see skills.ts). */
  effects(): ActiveEffect[] {
    return activeEffects((id, star) => this.hasStar(id, star), (h) => this.formDef(h));
  }

  /** A hero as it is now: an Ascendant hero in its current form (look, stats, skills, rarity); any other hero as is. */
  formDef(def: HeroDef): HeroDef {
    const a = ascendantDef(def.id);
    return a ? resolveForm(a, this.formOf(def.id)) : def;
  }

  /** All-stat multiplier from a hero's yellow stars (x STAR_STAT_MULT each) and pink awakening stars (x AWAKEN_STAT_MULT each). */
  starMultiplier(id: string): number {
    return Math.pow(STAR_STAT_MULT, this.stars[id] ?? 0) * Math.pow(AWAKEN_STAT_MULT, this.awaken[id] ?? 0);
  }

  /** ATK and HP after levels, stars (x STAR_STAT_MULT each), ATK/HP star skills and relics. `level` overrides the hero's current level. */
  heroPower(base: HeroDef, level = this.heroLevel(base.id)): { atk: Decimal; hp: Decimal; defense: Decimal } {
    const def = this.formDef(base);
    const starMult = this.starMultiplier(def.id);
    const atkRelics = (1 + this.relicBonus('atk') + this.relicBonus(def.element)) * (1 + this.researchBonus('combat'));
    const hpRelics = 1 + this.relicBonus('hp') + this.relicBonus(`${def.element}Hp`);
    const fx = this.effects();
    const prof = heroProfile(def);
    return {
      atk: heroAtk(def, level).times(starMult * prof.atkMult * mulEffect(fx, 'atk', def.id) * atkRelics),
      hp: heroHp(def, level).times(starMult * prof.hpMult * mulEffect(fx, 'hp', def.id) * hpRelics),
      defense: heroDef(def, level).times(starMult * prof.defMult * mulEffect(fx, 'def', def.id) * (1 + this.relicBonus('def') + this.relicBonus(`${def.element}Def`))),
    };
  }

  /** How many heroes in the lineup bring each build effect (freeze, burn, poison, stun). */
  buildCounts(): Record<BuildEffect, number> {
    const counts = Object.fromEntries(BUILD_EFFECTS.map((e) => [e, 0])) as Record<BuildEffect, number>;
    for (const h of HEROES) if (this.skillsOn(h.id)) for (const e of heroBuildEffects(h)) counts[e]++;
    return counts;
  }

  /** A hero's permanent level: Ember levels only (at least 1) once recruited, 0 if not. Used by Trials and Combat Power. */
  permanentLevel(id: string): number {
    return (this.levels[id] ?? 0) > 0 ? Math.max(1, this.emberLevels[id] ?? 0) : 0;
  }

  /** A hero's Combat Power (src/stats.ts combatPower). Gold levels don't count, only what lasts: Ember levels, stars, relics and the rest. */
  heroCombatPower(def: HeroDef): Decimal {
    return combatPower(this.heroStats(def, this.permanentLevel(def.id)));
  }

  /** The player's total Combat Power: every recruited hero's Combat Power added up. */
  totalCombatPower(): Decimal {
    let total = new Decimal(0);
    for (const h of HEROES) if ((this.levels[h.id] ?? 0) > 0) total = total.plus(this.heroCombatPower(h));
    return total;
  }

  /** Every number on the hero's stat pages, as battle uses them. */
  heroStats(base: HeroDef, level = this.heroLevel(base.id)): HeroStats {
    const def = this.formDef(base);
    const fx = this.effects();
    const sum = (kind: Parameters<typeof sumEffect>[1]) => sumEffect(fx, kind, def.id);
    const mul = (kind: Parameters<typeof mulEffect>[1]) => mulEffect(fx, kind, def.id);
    const starMult = this.starMultiplier(def.id);
    const power = this.heroPower(def, level);
    const sig = def.signature;
    const cooldown = (def.attackCooldown * mul('attackSpeed')) / (1 + this.relicBonus('speed'));
    const splashMult = def.splash ? mul('splash') : 1;
    const prof = heroProfile(def);
    const counts = this.buildCounts();
    const build = Object.fromEntries(BUILD_EFFECTS.map((e) => [e, heroBuildEffects(def).includes(e) ? buildBonus(counts[e]) : { time: 0, dmg: 0 }])) as Record<BuildEffect, { time: number; dmg: number }>;
    return {
      atk: { value: power.atk, base: heroAtk(def, level).times(starMult * prof.atkMult) },
      hp: { value: power.hp, base: heroHp(def, level).times(starMult * prof.hpMult) },
      def: { value: power.defense, base: heroDef(def, level).times(starMult * prof.defMult) },
      critRate: prof.crit + sum('crit') + this.relicBonus('crit'),
      critDmg: (1 + prof.critDmg + sum('critDmg')) * (1 + this.relicBonus('critDmg')) - 1,
      attacksPerSec: { value: 1 / cooldown, base: 1 / def.attackCooldown },
      range: { value: def.range, base: def.range },
      moveSpeed: { value: def.moveSpeed, base: def.moveSpeed },
      effectRes: { value: prof.effectRes + sum('effectRes'), base: prof.effectRes },
      frenzy: { value: prof.frenzy + sum('frenzy'), base: prof.frenzy },
      dodge: { value: prof.dodge + sum('dodge') + this.relicBonus('dodge'), base: prof.dodge },
      stunChance: prof.stunChance + sum('stunChance'),
      stunTime: this.relicBonus('stunTime') + prof.effectTime + build.stun.time + build.stun.dmg,
      aoeRadius: splashMult - 1,
      aoeDmg: def.splash ? prof.aoeDmg + sum('aoeDmg') : 0,
      ultAtk: prof.ultAtk + sum('ultAtk'),
      knightShield: isKnight(def) ? prof.shield + this.relicBonus('knightShield') : 0,
      bonusGold: def.goldMult * (1 + prof.goldBonus) * mulEffect(fx, 'gold', null) * (1 + this.relicBonus('gold')) * (1 + this.researchBonus('prosperity')) - 1,
      freezeChance: prof.freezeChance + sum('freezeChance'),
      freezeTime: this.relicBonus('freezeTime') + prof.effectTime + build.freeze.time,
      freezeBlast: build.freeze.dmg,
      // Kindling-style Signatures burn on every hit.
      burnChance: sig?.kind === 'burn' ? 1 : prof.burnChance + sum('burnChance'),
      burnTime: this.relicBonus('burnTime') + prof.effectTime + build.burn.time,
      burnDmg: build.burn.dmg,
      poisonChance: prof.poisonChance + sum('poisonChance'),
      poisonTime: this.relicBonus('poisonTime') + prof.effectTime + build.poison.time,
      poisonDmg: build.poison.dmg,
      hasAoe: !!def.splash,
      isKnight: isKnight(def),
    };
  }

  /** Bonus (0.25 = +25%) from one relic's effect at its current level. */
  relicEffect(def: RelicDef, effect: RelicEffect, level = this.relics[def.id] ?? 0): number {
    let total = 0;
    for (const [e, v] of def.fx) if (e === effect) total += (v * level) / RELIC_BASE_MAX / 100;
    return total;
  }

  /** Total bonus (0.25 = +25%; crit and dodge are chance, 0.05 = +5 points) from equipped relics and completed sets with this effect. */
  relicBonus(effect: RelicEffect): number {
    let total = 0;
    // Cheaper hero levels work without a slot, so the bench refund (at today's price) never pays back more than was spent.
    const ids = effect === 'cost' ? Object.keys(this.relics) : this.equipped;
    for (const id of ids) {
      const def = RELICS.find((r) => r.id === id);
      if (def) total += this.relicEffect(def, effect);
    }
    for (const set of RELIC_SETS) {
      if (!this.setComplete(set.id)) continue;
      for (const [e, v] of set.bonus) if (e === effect) total += v / 100;
    }
    return total;
  }

  /** Pieces of a set crafted, and how many it has. Sets count crafted pieces, equipped or not. */
  setPieces(setId: string): { owned: number; total: number } {
    const pieces = RELICS.filter((r) => r.set === setId);
    return { owned: pieces.filter((r) => (this.relics[r.id] ?? 0) > 0).length, total: pieces.length };
  }

  setComplete(setId: string): boolean {
    const p = this.setPieces(setId);
    return p.total > 0 && p.owned === p.total;
  }

  /** Multiplier on hero level gold costs from relics: -768% means costs divide by 8.68. */
  levelCostMult(): number {
    return 1 / (1 + this.relicBonus('cost'));
  }

  /** Multiplier on Stall upgrade costs from relics. */
  stallCostMult(): number {
    return 1 / (1 + this.relicBonus('stallCost'));
  }

  /** Seconds for one cycle of a Stall, after relics that make Stalls faster. */
  stallCycle(def: StallDef): number {
    return def.cycle / (1 + this.relicBonus('stallTime'));
  }

  /** Highest relic star the player may craft: 1★ from the start, then one more for each star with a relic at full base level. */
  relicStarsOpen(): number {
    let open = 1;
    while (open < RELIC_MAX_STARS && RELICS.some((r) => r.stars === open && (this.relics[r.id] ?? 0) >= RELIC_BASE_MAX)) open++;
    return open;
  }

  relicOpen(def: RelicDef): boolean {
    return def.stars <= this.relicStarsOpen() || (this.relics[def.id] ?? 0) > 0;
  }

  /** Current level cap: the base max plus 5 for each Enhance. */
  relicMaxLevel(def: RelicDef): number {
    return RELIC_BASE_MAX + RELIC_ENHANCE_LEVELS * (this.relicEnhance[def.id] ?? 0);
  }

  /** Essence of each kind for the relic's next level, or null at its cap. */
  relicNextCost(def: RelicDef): number | null {
    const level = this.relics[def.id] ?? 0;
    return level >= this.relicMaxLevel(def) ? null : relicCost(level, def.craft);
  }

  /** Level up a relic you own with Essence. Relics you don't own come only from the Relic Shop, for Essence. */
  canUpgradeRelic(def: RelicDef): boolean {
    const cost = this.relicNextCost(def);
    return (this.relics[def.id] ?? 0) > 0 && cost !== null && def.essences.every((e) => (this.essences[e] ?? 0) >= cost);
  }

  /** Essence of each kind to craft this relic (its level 0 → 1 cost). */
  relicCraftCost(def: RelicDef): number {
    return relicCost(0, def.craft);
  }

  /** True when you have the Essence (and Enhance Stones) to craft this relic, were it found. */
  canAffordRelic(def: RelicDef): boolean {
    const cost = this.relicCraftCost(def);
    return def.essences.every((e) => (this.essences[e] ?? 0) >= cost) && this.enhanceStones >= (def.stones ?? 0);
  }

  /** Relics the shop may offer: stars opened, and not owned yet. */
  relicShopPool(): RelicDef[] {
    return RELICS.filter((r) => !this.relics[r.id] && this.relicOpen(r));
  }

  /** Fill the shop with up to RELIC_SHOP_SIZE random relics from the pool, no repeats. */
  private rollRelicShop(rng: () => number = Math.random): string[] {
    const pool = this.relicShopPool();
    const offers: string[] = [];
    while (offers.length < RELIC_SHOP_SIZE && pool.length) offers.push(pool.splice(Math.floor(rng() * pool.length), 1)[0].id);
    return offers;
  }

  /** The Relic Shop as it stands: rolled once when first opened, then only changed by buying or a New relics refresh. Offers you came to own another way drop out. */
  relicShopState(now = Date.now()) {
    if (!this.relicShop.rolled) this.relicShop = { offers: this.rollRelicShop(), refreshAt: 0, rolled: true };
    this.relicShop.offers = this.relicShop.offers.filter((id) => !this.relics[id]);
    return { offers: this.relicShop.offers.map((id) => RELICS.find((r) => r.id === id)!), refreshIn: Math.max(0, this.relicShop.refreshAt - now) };
  }

  /** New relics: re-roll the shop, then wait RELIC_SHOP_REFRESH_MINUTES before the next one. */
  refreshRelicShop(now = Date.now(), rng: () => number = Math.random): boolean {
    if (this.relicShopState(now).refreshIn > 0) return false;
    this.relicShop = { offers: this.rollRelicShop(rng), refreshAt: now + RELIC_SHOP_REFRESH_MINUTES * 60_000, rolled: true };
    this.save();
    return true;
  }

  /** Buy a shop relic with its Essence (and Stones for set pieces). It arrives at Lv 1 and goes into a free slot. Gems never buy relics. */
  buyRelic(id: string, now = Date.now()): boolean {
    const def = this.relicShopState(now).offers.find((r) => r.id === id);
    if (!def || !this.canAffordRelic(def)) return false;
    const cost = this.relicCraftCost(def);
    for (const e of def.essences) this.essences[e] -= cost;
    this.enhanceStones -= def.stones ?? 0;
    this.relics[def.id] = 1;
    if (this.equipped.length < this.relicSlots) this.equipped.push(def.id);
    this.relicShop.offers = this.relicShop.offers.filter((o) => o !== id);
    this.save();
    return true;
  }

  /** Level up an owned relic with Essence. */
  upgradeRelic(id: string): boolean {
    const def = RELICS.find((r) => r.id === id)!;
    if (!this.canUpgradeRelic(def)) return false;
    const cost = this.relicNextCost(def)!;
    for (const e of def.essences) this.essences[e] -= cost;
    this.relics[id] += 1;
    this.save();
    return true;
  }

  /** Enhance Stones for the relic's next Enhance: only at its cap, null when it can't be enhanced further. */
  enhanceCost(def: RelicDef): number | null {
    const done = this.relicEnhance[def.id] ?? 0;
    if (done >= RELIC_ENHANCE_COSTS.length || (this.relics[def.id] ?? 0) < this.relicMaxLevel(def)) return null;
    return RELIC_ENHANCE_COSTS[done];
  }

  enhanceRelic(id: string): boolean {
    const def = RELICS.find((r) => r.id === id)!;
    const cost = this.enhanceCost(def);
    if (cost === null || this.enhanceStones < cost) return false;
    this.enhanceStones -= cost;
    this.relicEnhance[id] = (this.relicEnhance[id] ?? 0) + 1;
    this.save();
    return true;
  }

  /** Equip or take off a crafted relic. Returns false when no slot is free. */
  toggleRelic(id: string): boolean {
    if (this.equipped.includes(id)) {
      this.equipped = this.equipped.filter((e) => e !== id);
    } else {
      if (!this.relics[id] || this.equipped.length >= this.relicSlots) return false;
      this.equipped.push(id);
    }
    this.save();
    return true;
  }

  /** Gems for the next relic slot, or null when all are bought. */
  nextSlotCost(): number | null {
    return RELIC_SLOT_COSTS[this.relicSlots - RELIC_START_SLOTS] ?? null;
  }

  /** Best stage needed before the next slot can be bought, or null when all are bought. */
  nextSlotStage(): number | null {
    return RELIC_SLOT_STAGES[this.relicSlots - RELIC_START_SLOTS] ?? null;
  }

  /** Gems for the next team slot, or null when all are bought. */
  nextTeamSlotCost(): number | null {
    return this.teamSlots >= TEAM_SLOTS_MAX ? null : (TEAM_SLOT_COSTS[this.teamSlots - TEAM_SLOTS_START] ?? null);
  }

  buyTeamSlot(): boolean {
    const cost = this.nextTeamSlotCost();
    if (cost === null || this.gems < cost) return false;
    this.gems -= cost;
    this.teamSlots += 1;
    this.save();
    return true;
  }

  /** Gems for the next Ultimate slot, or null when all are bought. */
  nextUltSlotCost(): number | null {
    return ULT_SLOT_COSTS[this.ultSlots - ULT_SLOTS_START] ?? null;
  }

  buyUltSlot(): boolean {
    const cost = this.nextUltSlotCost();
    if (cost === null || this.gems < cost) return false;
    this.gems -= cost;
    this.ultSlots += 1;
    this.save();
    return true;
  }

  /**
   * The team heroes whose Ultimates are slotted, in button order: the player's picks first, then the rest
   * of the team in roster order while slots are open.
   */
  ultHeroes(): string[] {
    const picks = this.ultPicks.filter((id) => this.inLineup(id)).slice(0, this.ultSlots);
    for (const h of HEROES) if (picks.length < this.ultSlots && this.inLineup(h.id) && !picks.includes(h.id) && !this.ultSkip.includes(h.id)) picks.push(h.id);
    return picks;
  }

  hasUltSlot(id: string): boolean {
    return this.ultHeroes().includes(id);
  }

  /**
   * Put a team hero's Ultimate in a slot or take it out. A picked hero takes the place of one who only filled
   * an open slot; when every slot holds a pick, someone has to come out first. A hero taken out stays out
   * until picked again. False when nothing changes.
   */
  setUltSlot(id: string, on: boolean): boolean {
    if (!this.inLineup(id) || on === this.hasUltSlot(id)) return false;
    const picked = this.ultPicks.filter((h) => this.inLineup(h));
    if (on) {
      if (picked.length >= this.ultSlots) return false;
      this.ultPicks = [...picked, id];
      this.ultSkip = this.ultSkip.filter((h) => h !== id);
    } else {
      this.ultPicks = picked.filter((h) => h !== id);
      this.ultSkip = [...this.ultSkip.filter((h) => h !== id), id];
    }
    this.save();
    return true;
  }

  buyRelicSlot(): boolean {
    const cost = this.nextSlotCost();
    if (cost === null || this.gems < cost || this.bestStage < (this.nextSlotStage() ?? 0)) return false;
    this.gems -= cost;
    this.relicSlots += 1;
    this.save();
    return true;
  }

  /** True when the hero is recruited and has evolved to at least `star`. */
  hasStar(id: string, star: number): boolean {
    return this.skillsOn(id) && (this.stars[id] ?? 0) >= star;
  }

  /** Whether a hero's star skills and build count right now: the lineup, or the Colosseum attack team mid-battle. */
  skillsOn(id: string): boolean {
    return this.skillTeam ? this.skillTeam.has(id) && (this.levels[id] ?? 0) > 0 : this.inLineup(id);
  }

  inLineup(id: string): boolean {
    return (this.levels[id] ?? 0) > 0 && !this.benched[id];
  }

  lineupCount(): number {
    return HEROES.filter((h) => this.inLineup(h.id)).length;
  }

  /** Gold spent raising a hero from level 1 to their current gold level. */
  goldSpent(id: string): Decimal {
    const def = HEROES.find((h) => h.id === id)!;
    let total = new Decimal(0);
    for (let l = 1; l < (this.levels[id] ?? 0); l++) total = total.plus(upgradeCost(def, l, this.levelCostMult()));
    return total;
  }

  /**
   * Put a recruited hero in or out of the lineup. Taking one out drops them to
   * gold level 1 and refunds that gold; Ember levels stay, since they also
   * count in Trials and PvP. Returns the gold refunded, or null when the
   * change isn't allowed.
   */
  setInLineup(id: string, on: boolean): Decimal | null {
    if ((this.levels[id] ?? 0) === 0) return null;
    if (on) {
      if (this.inLineup(id) || this.lineupCount() >= this.teamSlots) return null;
      delete this.benched[id];
      return new Decimal(0);
    }
    if (!this.inLineup(id) || this.lineupCount() <= 1) return null;
    const refund = this.goldSpent(id);
    this.gold = this.gold.plus(refund);
    this.levels[id] = 1;
    this.benched[id] = true;
    return refund;
  }

  /**
   * Give a hero medals. Once a hero is at their top star they can't use more, so every
   * LEGENDARY_MEDAL_RATE of them becomes a Legendary medal instead.
   */
  addCrests(id: string, amount: number) {
    this.crests[id] = (this.crests[id] ?? 0) + amount;
    if (!this.atTopStar(id)) return;
    const made = Math.floor(this.crests[id] / LEGENDARY_MEDAL_RATE);
    this.legendaryMedals += made;
    this.crests[id] -= made * LEGENDARY_MEDAL_RATE;
  }

  /**
   * Medals a hero can spend on unlocking and stars. Legendary heroes have none of their own:
   * they all draw on the shared Legendary medal pool, so the player picks which one to grow.
   */
  medalsFor(id: string): number {
    return isLegendary(id) ? this.legendaryMedals : (this.crests[id] ?? 0);
  }

  private spendMedals(id: string, n: number) {
    if (isLegendary(id)) this.legendaryMedals -= n;
    else this.crests[id] -= n;
  }

  /** Medals a locked hero needs to unlock (0 for the free starter); Legendary heroes take Legendary medals. */
  unlockCrests(def: HeroDef): number {
    if (def.unlockCost === 0) return 0;
    return def.rarity === 'legendary' ? LEGENDARY_UNLOCK_MEDALS : UNLOCK_CRESTS[def.rarity];
  }

  canUnlock(def: HeroDef): boolean {
    return (this.levels[def.id] ?? 0) === 0 && this.medalsFor(def.id) >= this.unlockCrests(def);
  }

  /** Spend a locked hero's medals to unlock them at level 1; benched if the team is full. */
  unlockHero(id: string): boolean {
    const def = HEROES.find((h) => h.id === id)!;
    if (!this.canUnlock(def)) return false;
    this.spendMedals(id, this.unlockCrests(def));
    this.levels[id] = 1;
    if (this.lineupCount() > this.teamSlots) this.benched[id] = true;
    this.save();
    return true;
  }

  /** Saves from before the rarity mix: a locked hero holding its old unlock cost in medals unlocks now. */
  unlockRaisedRarity() {
    for (const [id, cost] of Object.entries(RAISED_RARITY_OLD_COST)) {
      if ((this.levels[id] ?? 0) > 0 || (this.crests[id] ?? 0) < cost) continue;
      this.crests[id] -= cost;
      this.levels[id] = 1;
      if (this.lineupCount() > this.teamSlots) this.benched[id] = true;
    }
  }

  /** Open a Hero Chest: Crests (medals) for random heroes. Locked heroes unlock once they have enough. */
  /** Open `times` Hero Chests in one go (all or none). */
  summon(times = 1): SummonDrop[] | null {
    if (times < 1 || this.gems < CHEST_COST * times) return null;
    this.gems -= CHEST_COST * times;
    this.track('summons', times);
    const drops: SummonDrop[] = [];
    for (let i = 0; i < times; i++) drops.push(...this.rollChest());
    this.save();
    return drops;
  }

  /** The drops of one Hero Chest, paid for or not. */
  private rollChest(): SummonDrop[] {
    const drops: SummonDrop[] = [];
    for (let i = 0; i < CHEST_DROPS; i++) {
      const hero = pickByRarity(SHOP_HEROES, CHEST_RARITY_WEIGHTS);
      if (!hero) break;
      const crests = weighted(CREST_ROLLS[hero.rarity as keyof typeof CREST_ROLLS]);
      const locked = (this.levels[hero.id] ?? 0) === 0;
      const before = this.crests[hero.id] ?? 0;
      this.addCrests(hero.id, crests);
      // "New" marks the drop that brings a locked hero to their unlock count.
      const need = this.unlockCrests(hero);
      const isNew = locked && before < need && before + crests >= need;
      drops.push({ heroId: hero.id, crests, isNew });
    }
    return drops;
  }

  /**
   * A hero's top star in evolutions: 7★ for regular heroes, 8★ for Ascendant heroes (REGULAR_MAX_STARS).
   * Heroes that reached 8★ before the cap keep it.
   */
  maxStars(id: string): number {
    return isAscendant(id) ? MAX_STARS : REGULAR_MAX_STARS;
  }

  atTopStar(id: string): boolean {
    return (this.stars[id] ?? 0) >= this.maxStars(id);
  }

  evolveCost(id: string): number | null {
    const stars = this.stars[id] ?? 0;
    if (stars >= this.maxStars(id)) return null;
    return isLegendary(id) ? LEGENDARY_STAR_MEDALS[stars] : STAR_CRESTS[stars];
  }

  evolve(id: string): boolean {
    const cost = this.evolveCost(id);
    if (cost === null || (this.levels[id] ?? 0) <= 0 || this.medalsFor(id) < cost) return false;
    this.spendMedals(id, cost);
    this.stars[id] = (this.stars[id] ?? 0) + 1;
    this.addCrests(id, 0); // at the top star, leftover medals turn into Legendary medals
    this.save();
    return true;
  }

  /** Recruited heroes with enough medals for their next star. */
  evolvable(): HeroDef[] {
    return HEROES.filter((h) => {
      const cost = this.evolveCost(h.id);
      return cost !== null && (this.levels[h.id] ?? 0) > 0 && this.medalsFor(h.id) >= cost;
    });
  }

  /** Evolve every recruited hero as many stars as their medals allow. Returns each hero's stars before and after (1★ = 0). */
  evolveAll(): Array<{ id: string; from: number; to: number }> {
    const done: Array<{ id: string; from: number; to: number }> = [];
    for (const h of this.evolvable()) {
      const from = this.stars[h.id] ?? 0;
      while (this.evolve(h.id)) {
        /* keep going while medals last */
      }
      done.push({ id: h.id, from, to: this.stars[h.id] ?? 0 });
    }
    return done;
  }

  /** An Ascendant hero's form (0 = Common). */
  formOf(id: string): number {
    return clampForm(this.forms[id]);
  }

  /** Why an Ascendant hero can't take its next form yet, or null when it can. */
  ascendBlocker(id: string): AscendBlocker | null {
    return ascendBlocker(ascendantDef(id), this.ascendContext(id));
  }

  /** The next form's requirements, met or not, for the hero page (null for other heroes and at the last form). */
  ascendNeeds(id: string): Array<{ text: string; met: boolean }> | null {
    const def = ascendantDef(id);
    return def ? ascendNeeds(def, this.ascendContext(id), ESSENCE_NAMES[def.base.element]) : null;
  }

  private ascendContext(id: string): AscendContext {
    const def = ascendantDef(id);
    return {
      form: this.formOf(id),
      recruited: (this.levels[id] ?? 0) > 0,
      evolutions: this.stars[id] ?? 0,
      trialTier: def ? this.trialBest[def.base.element] ?? 0 : 0,
      bestStage: this.bestStage,
      essence: def ? this.essences[def.base.element] ?? 0 : 0,
      stones: this.enhanceStones,
    };
  }

  /** Take an Ascendant hero to its next form. Checks everything first, so a failed try spends nothing. Permanent. */
  ascend(id: string): boolean {
    const def = ascendantDef(id);
    if (!def || this.ascendBlocker(id) !== null) return false;
    const form = this.formOf(id);
    const step = def.steps[form];
    this.essences[def.base.element] -= step.essence;
    this.enhanceStones -= step.stones;
    this.forms[id] = form + 1;
    this.save();
    return true;
  }

  /** Awakening opens at player level AWAKEN_UNLOCK_LEVEL. */
  awakenOpen(): boolean {
    return this.keeperLevel() >= AWAKEN_UNLOCK_LEVEL;
  }

  /** Most pink stars a hero can hold now: its yellow stars (1★ = 1), up to MAX_AWAKEN. */
  awakenCap(id: string): number {
    return Math.min(MAX_AWAKEN, (this.stars[id] ?? 0) + 1);
  }

  /** Starmotes for the hero's next pink star, or null at the most pink stars there are. */
  awakenCost(id: string): number | null {
    const pink = this.awaken[id] ?? 0;
    return pink >= MAX_AWAKEN ? null : AWAKEN_STARMOTES[pink];
  }

  /** Why the hero can't take a pink star right now, or null if it can. */
  awakenBlock(id: string): string | null {
    const cost = this.awakenCost(id);
    if (cost === null) return 'Max pink stars';
    if (!this.awakenOpen()) return `Opens at player level ${AWAKEN_UNLOCK_LEVEL}`;
    if ((this.levels[id] ?? 0) <= 0) return 'Recruit this hero first';
    if ((this.awaken[id] ?? 0) >= this.awakenCap(id)) return `Evolve to ${(this.stars[id] ?? 0) + 2}★ first`;
    if (this.starmotes < cost) return `Need ${cost} Starmotes`;
    return null;
  }

  /** Spend Starmotes on the hero's next pink star. */
  awakenHero(id: string): boolean {
    const cost = this.awakenCost(id);
    if (cost === null || this.awakenBlock(id) !== null) return false;
    this.starmotes -= cost;
    this.awaken[id] = (this.awaken[id] ?? 0) + 1;
    this.save();
    return true;
  }
  // ---------- Colosseum (PvP) ----------

  /** The Colosseum opens with awakening, at player level AWAKEN_UNLOCK_LEVEL. */
  pvpOpen(): boolean {
    return this.awakenOpen();
  }

  pvpUnlockLevel(): number {
    return AWAKEN_UNLOCK_LEVEL;
  }

  /** The heroes the player fights with: the lineup. */
  pvpTeam(): HeroDef[] {
    return HEROES.filter((h) => this.inLineup(h.id));
  }

  /** CP of the fighting team only (what Colosseum matching uses). */
  teamCombatPower(): Decimal {
    return this.pvpTeam().reduce((t, h) => t.plus(this.heroCombatPower(h)), new Decimal(0));
  }

  /** A hero as a Colosseum fighter: permanent stats only, like CP. */
  pvpUnit(def: HeroDef): PvpUnit {
    const st = this.heroStats(def, this.permanentLevel(def.id));
    return { id: def.id, element: def.element, atk: st.atk.value, hp: st.hp.value, def: st.def.value, attacksPerSec: st.attacksPerSec.value, critRate: st.critRate, critDmg: st.critDmg, melee: def.range <= 60, flying: def.flying };
  }

  /** Colosseum tickets regained over time. Returns seconds until the next one (0 when full). */
  refreshPvpTickets(now = Date.now()): number {
    const p = this.pvp;
    const period = PVP_TICKET_MINUTES * 60000;
    if (p.clock > now) p.clock = now;
    if (p.tickets >= PVP_TICKET_CAP) {
      p.clock = now;
      return 0;
    }
    const earned = Math.floor((now - p.clock) / period);
    if (earned > 0) {
      p.tickets = Math.min(PVP_TICKET_CAP, p.tickets + earned);
      p.clock += earned * period;
      if (p.tickets >= PVP_TICKET_CAP) p.clock = now;
    }
    return p.tickets >= PVP_TICKET_CAP ? 0 : Math.ceil((p.clock + period - now) / 1000);
  }

  /** Extra Colosseum tickets left to buy today. */
  pvpBuysLeft(now = Date.now()): number {
    return this.pvp.buys.day === dayKey(now) ? Math.max(0, PVP_TICKET_BUYS - this.pvp.buys.used) : PVP_TICKET_BUYS;
  }

  buyPvpTicket(now = Date.now()): boolean {
    if (!this.pvpOpen() || this.pvpBuysLeft(now) <= 0 || this.gems < PVP_TICKET_GEMS) return false;
    const day = dayKey(now);
    if (this.pvp.buys.day !== day) this.pvp.buys = { day, used: 0 };
    this.gems -= PVP_TICKET_GEMS;
    this.pvp.buys.used++;
    this.pvp.tickets++;
    this.save();
    return true;
  }

  /**
   * Pay the daily and weekly rank rewards once their day or week has ended, then the
   * weekly drop. Uses the rank held now, which is the rank held when the period ended
   * since trophies only move in fights. Returns the new reward lines (also kept in pvp.notes).
   */
  pvpTick(now = Date.now()): string[] {
    if (!this.pvpOpen()) return [];
    const p = this.pvp;
    const day = dayKey(now);
    const week = weekKey(now);
    if (!p.day) {
      p.day = day;
      p.week = week;
      return [];
    }
    const lines: string[] = [];
    if (p.day !== day) {
      const r = rankIndex(p.trophies);
      this.starmotes += RANK_DAILY[r];
      lines.push(`Daily reward for ${rankName(r)}: ${RANK_DAILY[r]} Starmotes`);
      p.day = day;
    }
    if (p.week !== week) {
      const r = rankIndex(p.trophies);
      this.starmotes += RANK_WEEKLY[r];
      lines.push(`Weekly reward for ${rankName(r)}: ${RANK_WEEKLY[r]} Starmotes`);
      p.trophies = droppedTrophies(p.trophies);
      p.streak = 0;
      lines.push(`New week: you drop to ${rankName(rankIndex(p.trophies))}. Climb back up!`);
      p.week = week;
      p.refreshAt = 0;
    }
    if (lines.length) {
      p.notes.push(...lines);
      this.save();
    }
    return lines;
  }

  /** A Ghost team: heroes, stars and one Ember level for all, chosen so its CP lands near `target`. */
  buildGhost(seed: string, target: Decimal): PvpOpponent {
    const rand = seededRandom(seed);
    const name = ghostName(rand);
    const team = this.pvpAttackTeam();
    const size = Math.max(1, team.length);
    const avgStars = team.length ? Math.round(team.reduce((t, h) => t + (this.stars[h.id] ?? 0), 0) / team.length) : 0;
    const pool = PLAYABLE_HEROES.filter((h) => h.rarity !== 'legendary');
    const heroes: Array<{ id: string; stars: number }> = [];
    while (heroes.length < Math.min(size, pool.length)) {
      const h = pool[Math.floor(rand() * pool.length)];
      if (heroes.some((x) => x.id === h.id)) continue;
      heroes.push({ id: h.id, stars: Math.min(this.maxStars(h.id), Math.max(0, avgStars + Math.floor(rand() * 3) - 1)) });
    }
    const opp: PvpOpponent = { name, ghost: true, heroes, ember: 1, cp: '0' };
    const cpAt = (ember: number) => GameState.ghostState({ ...opp, ember }).teamCombatPower();
    // Grow the Ember level until the team passes the target, then narrow down.
    let lo = 1;
    let hi = 1;
    while (cpAt(hi).lt(target) && hi < 1e7) {
      lo = hi;
      hi *= 2;
    }
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2);
      if (cpAt(mid).lt(target)) lo = mid;
      else hi = mid;
    }
    // Take the Ember level just under the target, then scale its stats the rest of the way.
    opp.ember = cpAt(hi).lte(target) ? hi : lo;
    const cpWith = (power: number) => GameState.opponentCp({ ...opp, power });
    let pLo = 1;
    let pHi = 1;
    while (cpWith(pHi).lt(target) && pHi < 64) pHi *= 2;
    for (let i = 0; i < 20 && pHi > pLo; i++) {
      const mid = (pLo + pHi) / 2;
      if (cpWith(mid).lt(target)) pLo = mid;
      else pHi = mid;
    }
    opp.power = Math.round(pLo * 1000) / 1000;
    opp.cp = cpWith(opp.power).toString();
    return opp;
  }

  /** An opponent's team CP, with its power multiplier. */
  static opponentCp(opp: PvpOpponent): Decimal {
    const g = GameState.ghostState(opp);
    return opp.heroes.reduce((t, x) => {
      const def = HEROES.find((h) => h.id === x.id)!;
      return t.plus(combatPower(scaleStats(g.heroStats(def, g.permanentLevel(def.id)), opp.power ?? 1)));
    }, new Decimal(0));
  }

  /** A throwaway game holding only an opponent's team, to get its stats the same way as the player's. */
  static ghostState(opp: PvpOpponent): GameState {
    const g = new GameState();
    for (const h of HEROES) g.levels[h.id] = 0;
    g.teamSlots = Math.max(g.teamSlots, opp.heroes.length);
    for (const x of opp.heroes) {
      g.levels[x.id] = 1;
      g.emberLevels[x.id] = opp.ember;
      g.stars[x.id] = x.stars;
    }
    return g;
  }

  /**
   * Three new opponents from the player's rank, in random order. Real players from the server (`real`,
   * already in the player's rank) are picked at random among those near the player's power; Ghosts with
   * random teams at a random share of that power (a bit stronger in higher ranks) fill the rest.
   */
  rollPvpOpponents(now = Date.now(), real: PvpCandidate[] = []) {
    const p = this.pvp;
    const rand = seededRandom(`pvp:${p.refreshes}:${p.trophies}`);
    const mine = this.teamCpOf(this.pvpAttackTeam());
    const pressure = 1 + RANK_PRESSURE * rankIndex(p.trophies);
    const shuffle = <T>(xs: T[]) => {
      for (let i = xs.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [xs[i], xs[j]] = [xs[j], xs[i]];
      }
      return xs;
    };
    const seen = new Set<string>();
    const near = real.filter((c) => {
      if (seen.has(c.userId) || !c.team.length) return false;
      seen.add(c.userId);
      const ratio = mine.gt(0) ? new Decimal(c.cp).div(mine).toNumber() : 1;
      return ratio >= PVP_REAL_MIN && ratio <= PVP_REAL_MAX;
    });
    const picks: PvpOpponent[] = shuffle([...near].sort((x, y) => x.userId.localeCompare(y.userId)))
      .slice(0, 3)
      .map((c) => ({ name: c.name, ghost: false, heroes: c.team.map((x) => ({ id: x.id, stars: x.stars })), ember: 1, cp: c.cp, userId: c.userId, snap: c.team }));
    while (picks.length < 3) {
      const share = PVP_CP_MIN + rand() * (PVP_CP_MAX - PVP_CP_MIN);
      picks.push(this.buildGhost(`${p.refreshes}:${picks.length}`, mine.times(share * pressure)));
    }
    p.picks = shuffle(picks);
    p.refreshes++;
    p.refreshAt = now + PVP_REFRESH_MINUTES * 60000;
  }

  /** Free new opponents once the refresh timer is up (or there are none). */
  refreshPvpOpponents(now = Date.now(), real: PvpCandidate[] = []): boolean {
    if (!this.pvpOpen()) return false;
    if (this.pvp.picks.length && now < this.pvp.refreshAt) return false;
    this.rollPvpOpponents(now, real);
    this.save();
    return true;
  }

  /** Extra damage from the win streak on the next attack. */
  pvpStreakBonus(): number {
    return PVP_STREAK_DMG * Math.min(PVP_STREAK_MAX, this.pvp.streak);
  }

  /** Recruited heroes picked for a Colosseum team (attack or defense): falls back to the lineup, at most teamSlots. */
  private pvpPicked(ids: string[]): HeroDef[] {
    const picked = HEROES.filter((h) => ids.includes(h.id) && (this.levels[h.id] ?? 0) > 0).slice(0, this.teamSlots);
    return picked.length ? picked : this.pvpTeam();
  }

  /** The team the player attacks with. */
  pvpAttackTeam(): HeroDef[] {
    return this.pvpPicked(this.pvp.attack);
  }

  /** The team other players fight when they attack this player. */
  pvpDefenseTeam(): HeroDef[] {
    return this.pvpPicked(this.pvp.defense);
  }

  /** Set the attack or defense team (recruited heroes only, up to teamSlots). */
  setPvpTeam(kind: 'attack' | 'defense', ids: string[]): boolean {
    const clean = HEROES.filter((h) => ids.includes(h.id) && (this.levels[h.id] ?? 0) > 0).map((h) => h.id);
    if (!clean.length || clean.length > this.teamSlots) return false;
    this.pvp[kind] = clean;
    this.save();
    return true;
  }

  /** The defense team as the server keeps it, for other players to fight. */
  pvpSnapshot(): { p_trophies: number; p_team_cp: string; p_cp_log: number; p_team: PvpSnapHero[] } {
    const team = this.pvpDefenseTeam();
    const cp = this.teamCpOf(team);
    return {
      p_trophies: this.pvp.trophies,
      p_team_cp: cp.toString(),
      p_cp_log: cp.gt(1) ? Math.max(0, cp.log10()) : 0,
      p_team: team.map((h) => {
        const st = this.heroStats(h, this.permanentLevel(h.id));
        return { id: h.id, stars: this.stars[h.id] ?? 0, awaken: this.awaken[h.id] ?? 0, atk: st.atk.value.toString(), hp: st.hp.value.toString(), def: st.def.value.toString(), aps: st.attacksPerSec.value, crit: st.critRate, critDmg: st.critDmg, move: st.moveSpeed.value };
      }),
    };
  }

  /** CP of a set of heroes. */
  teamCpOf(team: HeroDef[]): Decimal {
    return team.reduce((t, h) => t.plus(this.heroCombatPower(h)), new Decimal(0));
  }

  /** An opponent's fighters, with stats worked out the same way as the player's. */
  pvpFoeUnits(foe: PvpOpponent): Array<{ def: HeroDef; unit: PvpUnit; stats: HeroStats }> {
    const g = GameState.ghostState(foe);
    if (foe.snap) {
      // A real player's team fights with the stats it was saved with; the rest of the sheet comes from the hero itself.
      return foe.snap.map((x) => {
        const def = HEROES.find((h) => h.id === x.id)!;
        const base = g.heroStats(def, 1);
        const pair = (v: string) => ({ value: new Decimal(v), base: new Decimal(v) });
        const stats: HeroStats = { ...base, atk: pair(x.atk), hp: pair(x.hp), def: pair(x.def), attacksPerSec: { value: x.aps, base: base.attacksPerSec.base }, critRate: x.crit, critDmg: x.critDmg, moveSpeed: { value: x.move, base: base.moveSpeed.base } };
        return { def, unit: { id: def.id, element: def.element, atk: stats.atk.value, hp: stats.hp.value, def: stats.def.value, attacksPerSec: x.aps, critRate: x.crit, critDmg: x.critDmg, melee: def.range <= 60, flying: def.flying }, stats };
      });
    }
    return foe.heroes.map((x) => {
      const def = HEROES.find((h) => h.id === x.id)!;
      const stats = scaleStats(g.heroStats(def, g.permanentLevel(def.id)), foe.power ?? 1);
      return { def, unit: { ...g.pvpUnit(def), atk: stats.atk.value, hp: stats.hp.value, def: stats.def.value }, stats };
    });
  }

  /** A quick no-luck run of the fight, for the "how it looks" line before a battle. */
  pvpForecast(slot: number): PvpResult | null {
    const foe = this.pvp.picks[slot];
    if (!foe) return null;
    return simulatePvp(this.pvpAttackTeam().map((h) => this.pvpUnit(h)), this.pvpFoeUnits(foe).map((f) => f.unit), this.pvpStreakBonus());
  }

  /** Whether the player can start a fight against this opponent now. */
  canStartPvp(slot: number, now = Date.now()): boolean {
    this.refreshPvpTickets(now);
    return this.pvpOpen() && this.pvp.active < 0 && !!this.pvp.picks[slot] && this.pvp.tickets > 0 && this.pvpAttackTeam().length > 0;
  }

  /**
   * Start a live Colosseum battle: spends the ticket now, so leaving or closing the game mid-fight
   * counts as a loss. Star skills follow the attack team while it fights (see skillTeam).
   */
  startPvp(slot: number, now = Date.now()): PvpOpponent | null {
    if (!this.canStartPvp(slot, now)) return null;
    this.pvpTick(now);
    const p = this.pvp;
    if (p.tickets >= PVP_TICKET_CAP) p.clock = now;
    p.tickets--;
    p.active = slot;
    this.skillTeam = new Set(this.pvpAttackTeam().map((h) => h.id));
    this.save();
    return p.picks[slot];
  }

  /** End the live battle: pays trophies and Starmotes (a loss still pays a little), then rolls new opponents. */
  finishPvp(won: boolean, now = Date.now()): PvpFight | null {
    const p = this.pvp;
    if (p.active < 0) return null;
    const foe = p.picks[p.active];
    p.active = -1;
    this.skillTeam = null;
    if (!foe) return null;
    const rankBefore = rankIndex(p.trophies);
    let trophies: number;
    let starmotes: number;
    let firstWin = false;
    if (won) {
      trophies = PVP_WIN_TROPHIES;
      starmotes = PVP_WIN_MOTES;
      if (p.firstWin !== dayKey(now)) {
        firstWin = true;
        p.firstWin = dayKey(now);
        starmotes += PVP_FIRST_WIN_MOTES;
      }
      p.streak++;
      p.wins++;
    } else {
      trophies = -Math.min(PVP_LOSS_TROPHIES, p.trophies);
      starmotes = PVP_LOSS_MOTES;
      p.streak = 0;
      p.losses++;
    }
    p.trophies += trophies;
    this.starmotes += starmotes;
    // New opponents come next (the game asks the server for real players first).
    p.picks = [];
    p.refreshAt = 0;
    this.save();
    return { foe, won, trophies, starmotes, firstWin, rankBefore, rankAfter: rankIndex(p.trophies) };
  }


  /** The first stage this run that opens Rekindle: past REKINDLE_STAGE, and HEAD_START_MIN_PUSH past a head start. */
  rekindleStage() {
    return Math.max(REKINDLE_STAGE + 1, this.runStartStage > 1 ? this.runStartStage + HEAD_START_MIN_PUSH : 0);
  }

  canRekindle() {
    return this.runBestStage >= this.rekindleStage();
  }

  /** The stage the next run would start at with a head start (1 when there's none yet). See HEAD_START_*. */
  headStartStage(): number {
    if (this.bestStage < HEAD_START_FROM) return 1;
    const team = HEROES.filter((h) => this.inLineup(h.id));
    if (!team.length) return 1;
    // Right after a Rekindle every hero is back to gold level 1, so the team's strength is its Ember levels.
    const level = team.reduce((t, h) => t + effectiveLevel(1, this.emberLevels[h.id] ?? 0), 0) / team.length;
    const cap = Math.min(this.bestStage * HEAD_START_SHARE, level * HEAD_START_POWER);
    const start = Math.floor((cap - 1) / BOSS_EVERY) * BOSS_EVERY + 1;
    return start > BOSS_EVERY ? start : 1;
  }

  /**
   * Spend gold across every recruited hero, always buying the cheapest next
   * level, so the team rises together. Returns how many levels were bought.
   */
  levelAll(): number {
    const team = HEROES.filter((h) => this.inLineup(h.id));
    let bought = 0;
    while (bought < 5000) {
      let pick: HeroDef | null = null;
      let best: Decimal | null = null;
      for (const h of team) {
        const c = upgradeCost(h, this.levels[h.id], this.levelCostMult());
        if (!best || c.lt(best)) {
          best = c;
          pick = h;
        }
      }
      if (!pick || !best || best.gt(this.gold)) break;
      this.gold = this.gold.minus(best);
      this.levels[pick.id] += 1;
      bought++;
    }
    this.track('levels', bought);
    return bought;
  }

  /** Permanent Market Row revenue multiplier from Rekindles. */
  marketRevenueMult() {
    return 1 + STALL_REKINDLE_REVENUE * this.rekindles;
  }

  /** Bonus Stall levels from Rekindles, given to every auto-collect Stall. */
  stallBonusLevels() {
    return Math.min(STALL_REKINDLE_LEVELS_CAP, STALL_REKINDLE_LEVELS * this.rekindles);
  }

  stallAuto(id: string) {
    return this.stalls[id].level >= STALL_AUTO_LEVEL;
  }

  stallEffectiveLevel(id: string) {
    const level = this.stalls[id].level;
    return level >= STALL_AUTO_LEVEL ? level + this.stallBonusLevels() : level;
  }

  stallIncome(def: StallDef): Decimal {
    return stallIncome(def, this.stallEffectiveLevel(def.id)).times(this.marketRevenueMult() * (1 + this.relicBonus('stall')));
  }

  stallReady(id: string) {
    const st = this.stalls[id];
    const def = STALLS.find((d) => d.id === id)!;
    return st.level > 0 && !this.stallAuto(id) && st.progress >= this.stallCycle(def);
  }

  /** Advance every open Stall; auto-collect ones pay out, the rest wait for a tap. Returns gold auto-collected. */
  tickMarket(dt: number): Decimal {
    let earned = new Decimal(0);
    for (const def of STALLS) {
      const st = this.stalls[def.id];
      if (st.level === 0) continue;
      st.progress += dt;
      const cycle = this.stallCycle(def);
      if (this.stallAuto(def.id)) {
        const cycles = Math.floor(st.progress / cycle);
        if (cycles > 0) {
          earned = earned.plus(this.stallIncome(def).times(cycles));
          st.progress -= cycles * cycle;
        }
      } else {
        st.progress = Math.min(st.progress, cycle);
      }
    }
    this.gold = this.gold.plus(earned);
    return earned;
  }

  collectStall(id: string): Decimal | null {
    if (!this.stallReady(id)) return null;
    const def = STALLS.find((d) => d.id === id)!;
    const amount = this.stallIncome(def);
    this.gold = this.gold.plus(amount);
    this.stalls[id].progress = 0;
    return amount;
  }

  /** Buy Stall levels at the Market's buy amount (opening a Stall always buys one). */
  buyStall(id: string): boolean {
    const def = STALLS.find((d) => d.id === id)!;
    const st = this.stalls[id];
    const { levels, cost } = stallBulkCost(def, st.level, this.stallBuyAmount, this.gold, this.stallCostMult());
    if (levels === 0 || cost.gt(this.gold)) return false;
    this.gold = this.gold.minus(cost);
    st.level += levels;
    return true;
  }

  /**
   * Spend gold across every open Stall, always buying the cheapest next
   * level, so the whole row rises together. Closed Stalls stay closed.
   * Returns how many levels were bought.
   */
  levelAllStalls(): number {
    const open = STALLS.filter((d) => this.stalls[d.id].level > 0);
    let bought = 0;
    while (bought < 5000) {
      let pick: StallDef | null = null;
      let best: Decimal | null = null;
      for (const d of open) {
        const c = stallUpgradeCost(d, this.stalls[d.id].level, this.stallCostMult());
        if (!best || c.lt(best)) {
          best = c;
          pick = d;
        }
      }
      if (!pick || !best || best.gt(this.gold)) break;
      this.gold = this.gold.minus(best);
      this.stalls[pick.id].level += 1;
      bought++;
    }
    this.track('levels', bought);
    return bought;
  }

  /** Gold per second from auto-collect Stalls, used for offline time. */
  marketAutoPerSec(): Decimal {
    let total = new Decimal(0);
    for (const def of STALLS) if (this.stallAuto(def.id)) total = total.plus(this.stallIncome(def).div(this.stallCycle(def)));
    return total;
  }

  /** Whether an element's Trial is open today (player's local day). */
  trialOpen(element: Element, now = Date.now()): boolean {
    const day = new Date(now).getDay();
    return TRIAL_SCHEDULE[element].includes(day) || ALL_TRIALS_WITH.some((e) => TRIAL_SCHEDULE[e].includes(day));
  }

  /** Days of the week (Date.getDay numbers) this element's Trial is open. */
  trialDays(element: Element): number[] {
    return [0, 1, 2, 3, 4, 5, 6].filter((day) => TRIAL_SCHEDULE[element].includes(day) || ALL_TRIALS_WITH.some((e) => TRIAL_SCHEDULE[e].includes(day)));
  }

  /** Medals one Trial win pays right now (double on an event weekend). */
  trialMedals(now = Date.now()): number {
    return TRIAL_MEDALS * (this.trialEventOn(now) ? TRIAL_EVENT_MEDAL_MULT : 1);
  }

  /** Trial tickets in hand: the refilling ones plus the bought stash. */
  trialTickets(): number {
    return this.tickets + this.boughtTickets;
  }

  /** Use one Trial ticket: refilling ones first, so the bought stash keeps for later. */
  private spendTrialTicket(now = Date.now()) {
    if (this.tickets > 0) {
      if (this.tickets >= TICKET_CAP) this.ticketClock = now;
      this.tickets -= 1;
    } else this.boughtTickets = Math.max(0, this.boughtTickets - 1);
  }

  /** Whether `now` falls in a week with a double-medal Trial weekend (and the Ticket Crate). */
  eventWeek(now = Date.now()): boolean {
    return (((weekIndex(now) - TRIAL_EVENT_PHASE) % TRIAL_EVENT_EVERY) + TRIAL_EVENT_EVERY) % TRIAL_EVENT_EVERY === 0;
  }

  /** Whether Trials pay double medals right now. */
  trialEventOn(now = Date.now()): boolean {
    return this.eventWeek(now) && TRIAL_EVENT_DAYS.includes(new Date(now).getDay());
  }

  /** Start of the local day `days` after the one holding `now`. */
  private dayStart(now: number, days = 0): number {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + days);
    return d.getTime();
  }

  /** The current or next double-medal weekend: [start, end) in ms. */
  nextTrialEvent(now = Date.now()): { start: number; end: number } {
    for (let i = 0; i < 7 * TRIAL_EVENT_EVERY + 7; i++) {
      const t = this.dayStart(now, i) + 12 * 3_600_000;
      if (!this.trialEventOn(t)) continue;
      let start = this.dayStart(t);
      while (this.trialEventOn(this.dayStart(start, -1) + 12 * 3_600_000)) start = this.dayStart(start, -1);
      let end = this.dayStart(t, 1);
      while (this.trialEventOn(end + 12 * 3_600_000)) end = this.dayStart(end, 1);
      return { start, end };
    }
    return { start: now, end: now };
  }

  /** End of the week (next Monday 00:00, local) holding `now`. */
  weekEnd(now = Date.now()): number {
    return this.dayStart(now, 7 - ((new Date(now).getDay() + 6) % 7));
  }

  /** This week's limited deal: the Ticket Crate in event weeks, the Hero Voucher otherwise. */
  dealState(now = Date.now()): { kind: 'crate' | 'voucher'; bought: boolean; endsAt: number; gems: number } {
    const week = weekIndex(now);
    const endsAt = this.weekEnd(now);
    return this.eventWeek(now)
      ? { kind: 'crate', bought: this.deals.crateWeek === week, endsAt, gems: TICKET_CRATE.gems }
      : { kind: 'voucher', bought: this.deals.voucherWeek === week, endsAt, gems: HERO_VOUCHER.gems };
  }

  /**
   * This week's Ascendant Chest: the released Ascendant hero whose element beats the Guild Boss of the week, how many
   * were bought and the next price (null when sold out). null when no such hero is out (`pool` is for tests).
   */
  ascendantChestState(now = Date.now(), pool: AscendantDef[] = ASCENDANT_HEROES.filter((a) => RELEASED_HEROES.includes(a.base.id) && HEROES.some((h) => h.id === a.base.id))) {
    const week = utcWeekStart(now);
    const boss = guildBossElement(week);
    const hero = pool.find((a) => a.base.element === COUNTERED_BY[boss])?.base;
    if (!hero) return null;
    const bought = this.ascChest.week === week ? this.ascChest.bought : 0;
    return { hero, boss, week, bought, next: ASCENDANT_CHEST[bought] ?? null, endsAt: Date.parse(week) + 7 * 86_400_000 };
  }

  /** Buy the next Ascendant Chest: the hero's crests plus a Hero Chest's drops. Nothing is spent when it can't be bought. */
  buyAscendantChest(now = Date.now(), pool?: AscendantDef[]): { heroId: string; crests: number; drops: SummonDrop[] } | null {
    const st = pool ? this.ascendantChestState(now, pool) : this.ascendantChestState(now);
    if (!st || !st.next || this.gems < st.next.gems) return null;
    this.gems -= st.next.gems;
    this.ascChest = { week: st.week, bought: st.bought + 1 };
    this.addCrests(st.hero.id, st.next.crests);
    const drops = this.rollChest();
    this.save();
    return { heroId: st.hero.id, crests: st.next.crests, drops };
  }

  /** Buy this week's deal. The Ticket Crate needs room in the bought-ticket stash. */
  buyDeal(now = Date.now()): boolean {
    const d = this.dealState(now);
    if (d.bought || this.gems < d.gems) return false;
    if (d.kind === 'crate') {
      if (this.boughtTickets + TICKET_CRATE.tickets > BOUGHT_TICKET_CAP) return false;
      this.boughtTickets += TICKET_CRATE.tickets;
      this.deals.crateWeek = weekIndex(now);
    } else {
      this.vouchers += 1;
      this.deals.voucherWeek = weekIndex(now);
    }
    this.gems -= d.gems;
    this.save();
    return true;
  }

  /** Medals a Hero Voucher gives this hero (fewer for rarer heroes); null for Legendaries. */
  voucherMedals(heroId: string): number | null {
    const h = SHOP_HEROES.find((x) => x.id === heroId);
    return h ? HERO_VOUCHER.medals[h.rarity as keyof typeof HERO_VOUCHER.medals] ?? null : null;
  }

  /** Spend a Hero Voucher on a hero of the player's choice. */
  useVoucher(heroId: string): SummonDrop[] | null {
    const n = this.voucherMedals(heroId);
    if (n === null || this.vouchers <= 0) return null;
    this.vouchers -= 1;
    return this.receiveGuildMedals([{ heroId, crests: n }]);
  }

  /** Days from today on: open Trials, double medals and the week's deal, for the events calendar. */
  calendar(days: number, now = Date.now()): Array<{ date: number; open: Element[]; double: boolean; deal: 'crate' | 'voucher' }> {
    const out: Array<{ date: number; open: Element[]; double: boolean; deal: 'crate' | 'voucher' }> = [];
    for (let i = 0; i < days; i++) {
      const t = this.dayStart(now, i) + 12 * 3_600_000;
      out.push({ date: this.dayStart(t), open: this.openTrials(t), double: this.trialEventOn(t), deal: this.eventWeek(t) ? 'crate' : 'voucher' });
    }
    return out;
  }

  openTrials(now = Date.now()): Element[] {
    return TRIAL_ROTATION.filter((e) => this.trialOpen(e, now));
  }

  /** Add tickets earned since the clock started; returns seconds until the next one (0 when full). */
  refreshTickets(now = Date.now()): number {
    const period = TICKET_MINUTES * 60000;
    // A clock set back (or a save from a device whose clock runs fast) would freeze regeneration.
    if (this.ticketClock > now) this.ticketClock = now;
    if (this.tickets >= TICKET_CAP) {
      this.ticketClock = now;
      return 0;
    }
    const earned = Math.floor((now - this.ticketClock) / period);
    if (earned > 0) {
      this.tickets = Math.min(TICKET_CAP, this.tickets + earned);
      this.ticketClock += earned * period;
      if (this.tickets >= TICKET_CAP) this.ticketClock = now;
    }
    return this.tickets >= TICKET_CAP ? 0 : Math.ceil((this.ticketClock + period - now) / 1000);
  }

  /** Trial strength uses Ember levels and stars only, not gold levels. */
  trialTeam() {
    return HEROES.filter((h) => this.inLineup(h.id)).map((def) => ({ def, ...this.heroPower(def, Math.max(1, this.emberLevels[def.id] ?? 0)) }));
  }

  /** Estimate a Trial fight against today's boss at `tier` (the Trials panel's prediction; the real fight is live). */
  simulateTrial(tier: number, element: Element) {
    const team = this.trialTeam();
    let dps = new Decimal(0);
    let hp = new Decimal(0);
    let defense = new Decimal(0);
    let incoming = 0;
    for (const m of team) {
      dps = dps.plus(m.atk.div(m.def.attackCooldown).times(elementMultiplier(m.def.element, element) * (1 + this.researchBonus('elemental'))));
      hp = hp.plus(m.hp);
      defense = defense.plus(m.defense);
      incoming += elementMultiplier(element, m.def.element);
    }
    const level = TRIAL_LEVELS[tier - 1];
    const bossHp = trialHp(level);
    // The boss's damage each second counts as one hit against the team's average Defense.
    const bossDps = defended(trialDps(level).times(team.length ? incoming / team.length : 1), team.length ? defense.div(team.length) : new Decimal(0));
    const killTime = dps.gt(0) ? bossHp.div(dps).toNumber() : Infinity;
    const wipeTime = bossDps.gt(0) ? hp.div(bossDps).toNumber() : Infinity;
    const seconds = Math.min(killTime, wipeTime, TRIAL_TIME);
    const won = killTime <= Math.min(wipeTime, TRIAL_TIME);
    return {
      won,
      seconds,
      bossLeft: won ? 0 : Math.max(0, 1 - seconds / killTime),
      teamLeft: Math.max(0, 1 - seconds / wipeTime),
      dps,
    };
  }

  /**
   * Whether the lineup would beat the stage `stage` boss, used offline. A cautious estimate: plain hits with
   * average crits, no Ultimates or Signatures, and only part of the time limit (the walk to the boss eats some).
   * The boss hits the front hero until it falls, then the next.
   */
  canBeatBoss(stage: number): { won: boolean; seconds: number } {
    const team = HEROES.filter((h) => this.inLineup(h.id)).map((def) => ({ def, stats: this.heroStats(def) }));
    const element = bossHasElement(stage) ? bossElement(stage) : null;
    const elemental = 1 + this.researchBonus('elemental');
    let dps = new Decimal(0);
    let survive = 0;
    for (const { def, stats } of team) {
      if (bossImmuneTo(stage, def.element)) continue;
      const mult = element ? elementMultiplier(def.element, element) * elemental : 1;
      const crit = 1 + Math.max(0, Math.min(1, stats.critRate)) * Math.max(0, stats.critDmg);
      dps = dps.plus(stats.atk.value.times(stats.attacksPerSec.value * mult * crit));
    }
    for (const { def, stats } of team) {
      const hit = bossAtk(stage).times(element ? elementMultiplier(element, def.element) : 1);
      const perSec = defended(hit, stats.def.value).div(OFFLINE_BOSS_COOLDOWN);
      survive += perSec.gt(0) ? stats.hp.value.div(perSec).toNumber() : Infinity;
    }
    const killTime = dps.gt(0) ? bossHp(stage).div(dps).toNumber() : Infinity;
    const won = killTime <= Math.min(survive, BOSS_TIME_LIMIT * OFFLINE_BOSS_TIME_SHARE);
    return { won, seconds: won ? killTime : Infinity };
  }

  /** Heroes owned with at least this many Ember levels. */
  heroesAtEmber(level: number): number {
    return HEROES.filter((h) => (this.levels[h.id] ?? 0) > 0 && (this.emberLevels[h.id] ?? 0) >= level).length;
  }

  /** Whether the player meets a Trial level's hero requirement. */
  trialReqMet(tier: number): boolean {
    const req = TRIAL_LEVELS[tier - 1].req;
    return !req || this.heroesAtEmber(req[1]) >= req[0];
  }

  /** Trials as a whole open after the stage 50 boss. */
  trialsUnlocked() {
    return this.bestStage >= TRIAL_UNLOCK_STAGE;
  }

  trialUnlocked(element: string) {
    return Math.min(TRIAL_TIERS, (this.trialBest[element] ?? 0) + 1);
  }

  /** Fastest win on a Trial level, in seconds, or null if never won since clear times were added. */
  trialTime(element: string, tier: number): number | null {
    return this.trialTimes[`${element}:${tier}`] ?? null;
  }

  /** A level won within half the timer can be Quick Battled. */
  canQuickTrial(element: string, tier: number): boolean {
    const t = this.trialTime(element, tier);
    return t !== null && t <= TRIAL_QUICK_TIME;
  }

  private trialPlayable(element: Element, tier: number): boolean {
    this.refreshTickets();
    return this.trialsUnlocked() && this.trialOpen(element) && this.trialTickets() > 0 && tier >= 1 && tier <= this.trialUnlocked(element) && this.trialReqMet(tier);
  }

  /**
   * Heroes a Trial of this element can pay medals to: every hero of the element except Legendaries (special means
   * only) and heroes already at their top star (Samuel, 2026-10-22), so finishing a color's Commons moves their share
   * to its Rares and Epics. A color with every hero maxed pays them all again (their medals become Legendary medals).
   */
  trialPool(element: Element): HeroDef[] {
    const all = PLAYABLE_HEROES.filter((h) => h.element === element && h.rarity !== 'legendary' && !isAscendant(h.id));
    const open = all.filter((h) => !this.atTopStar(h.id));
    return open.length ? open : all;
  }

  /** Whether a Trial fight can start now: open today, unlocked, requirement met and a ticket in hand. */
  canStartTrial(element: Element, tier: number): boolean {
    return this.trialPlayable(element, tier);
  }

  /**
   * End a live Trial fight. A win spends the ticket, records the clear time and pays out;
   * a loss (or leaving) keeps the ticket. Null when the Trial can't be played any more.
   */
  finishTrial(element: Element, tier: number, won: boolean, seconds: number): TrialResult | null {
    if (!this.trialPlayable(element, tier)) return null;
    const result: TrialResult = { won, seconds, essence: 0, stones: 0, medals: [] };
    if (!won) return result;
    const key = `${element}:${tier}`;
    this.trialTimes[key] = Math.min(this.trialTimes[key] ?? Infinity, Math.round(Math.max(0, seconds) * 10) / 10);
    return this.payTrial(element, tier, result);
  }

  /** Skip the fight on a level already won fast enough: same ticket, same reward as a win. */
  quickTrial(element: Element, tier: number): TrialResult | null {
    if (!this.trialPlayable(element, tier) || !this.canQuickTrial(element, tier)) return null;
    return this.payTrial(element, tier, { won: true, seconds: 0, essence: 0, stones: 0, medals: [] });
  }

  /** Quick Battle the same level up to `times` times in one go (stops when tickets run out). Null if none ran. */
  quickTrials(element: Element, tier: number, times: number): (TrialResult & { runs: number }) | null {
    const total: TrialResult & { runs: number } = { won: true, seconds: 0, essence: 0, stones: 0, medals: [], runs: 0 };
    for (let i = 0; i < times; i++) {
      const r = this.quickTrial(element, tier);
      if (!r) break;
      total.runs++;
      total.essence += r.essence;
      total.stones += r.stones;
      total.medals.push(...r.medals);
    }
    return total.runs ? total : null;
  }

  private payTrial(element: Element, tier: number, result: TrialResult): TrialResult {
    const level = TRIAL_LEVELS[tier - 1];
    this.spendTrialTicket();
    this.track('trials');
    const explore = 1 + this.researchBonus('exploration');
    result.essence = Math.round(level.essence * explore);
    this.essences[element] = (this.essences[element] ?? 0) + result.essence;
    result.stones = Math.round(trialStones(tier) * explore);
    this.enhanceStones += result.stones;
    // Each medal goes to a random hero of the element, rarer heroes less likely; both can land on the same one.
    const pool = this.trialPool(element);
    const medals = this.trialMedals();
    for (let i = 0; i < medals; i++) {
      const hero = pickByRarity(pool, TRIAL_RARITY_WEIGHTS);
      if (!hero) break;
      result.medals.push(hero.id);
      this.addCrests(hero.id, 1);
    }
    this.trialBest[element] = Math.max(this.trialBest[element] ?? 0, tier);
    this.save();
    return result;
  }

  keeperLevel() {
    return keeperLevel(this.lifetimeEmbers);
  }

  keeperBonus() {
    return 1 + KEEPER_BONUS_PER_LEVEL * (this.keeperLevel() - 1);
  }

  pendingEmbers() {
    return Math.floor(emberYield(this.runBestStage, REKINDLE_STAGE, this.keeperBonus()) * (1 + this.relicBonus('embers')));
  }

  /**
   * Prestige reset (GDD section 7): back to stage 1 and gold level 1, keep
   * Embers and Ember levels. `mult` is a Gem-bought 2x or 3x payout.
   */
  rekindle(mult = 1, headStart = this.headStart): RekindleResult | null {
    const base = this.pendingEmbers();
    if (base <= 0 || !this.canRekindle()) return null;
    const boost = REKINDLE_BOOSTS.find((b) => b.mult === mult);
    if (mult !== 1 && (!boost || this.gems < boost.gems)) return null;
    if (boost) this.gems -= boost.gems;
    const levelBefore = this.keeperLevel();
    const wheel = this.spinWheel(base);
    const gained = base * mult + wheel.embers;
    this.embers += gained;
    this.lifetimeEmbers += gained;
    this.rekindles += 1;
    // Every new player level comes with a gift of Enhance Stones.
    const levelsGained = this.keeperLevel() - levelBefore;
    const stones = levelsGained * LEVEL_GIFT_STONES;
    this.enhanceStones += stones;
    this.gold = new Decimal(0);
    const start = headStart ? this.headStartStage() : 1;
    this.headStart = headStart;
    this.stage = start;
    this.runBestStage = start;
    this.runStartStage = start;
    for (const def of STALLS) this.stalls[def.id] = { level: 0, progress: 0 };
    this.autoAdvance = true;
    for (const h of HEROES) this.levels[h.id] = h.unlockCost === 0 ? 1 : this.levels[h.id] > 0 ? 1 : 0;
    this.secondsPerStage = 20;
    this.goldPerSec = 0;
    this.save();
    return { embers: gained, wheel: wheel.lines, levelsGained, stones, start };
  }

  /** Buy `count` Ember levels (or as many as the Embers pay for); all or nothing for x1 / x10. */
  buyEmbers(id: string, count: 1 | 10 | 'max'): number {
    const level = this.emberLevels[id] ?? 0;
    const { levels, cost } = emberBulk(level, count, this.embers);
    if (levels <= 0 || cost > this.embers) return 0;
    this.embers -= cost;
    this.emberLevels[id] = level + levels;
    return levels;
  }

  /**
   * The player's own choice to take a hero's Ember levels back to +0. Every
   * Ember spent on them is refunded, so it can be spent on another hero.
   */
  resetEmbers(id: string): number {
    const level = this.emberLevels[id] ?? 0;
    if (level <= 0) return 0;
    const refund = emberRefund(level);
    this.emberLevels[id] = 0;
    this.embers += refund;
    this.save();
    return refund;
  }

  /** Rekindle Wheel slots unlocked by stages cleared this run (a head start's skipped stages don't count). */
  roadReached() {
    const slots = (stage: number) => (stage < ROAD_START ? 0 : 1 + Math.floor((stage - ROAD_START) / ROAD_STEP));
    return Math.min(ROAD_LENGTH, slots(this.runBestStage) - slots(this.runStartStage - 1));
  }

  /** Spin the Rekindle Wheel once per unlocked slot. Ember prizes are a share of `base` and are added by the caller. */
  private spinWheel(base: number) {
    const lines: string[] = [];
    let embers = 0;
    for (let i = 0; i < this.roadReached(); i++) {
      const prize = weighted(WHEEL_PRIZES.map((p) => [p.prize, p.weight] as [WheelPrize, number]));
      if (prize.kind === 'tickets') {
        this.refreshTickets();
        this.tickets = Math.min(TICKET_CAP, this.tickets + prize.amount);
        lines.push(`${prize.amount} Trial tickets`);
      } else if (prize.kind === 'stones') {
        this.enhanceStones += prize.amount;
        lines.push(`${prize.amount} Enhance Stones`);
      } else if (prize.kind === 'essence') {
        const els = Object.keys(ESSENCE_NAMES) as Element[];
        const el = els[Math.floor(Math.random() * els.length)];
        this.essences[el] = (this.essences[el] ?? 0) + prize.amount;
        lines.push(`${prize.amount} ${ESSENCE_NAMES[el]}`);
      } else {
        const extra = Math.floor(base * prize.share);
        embers += extra;
        lines.push(`+${Math.round(prize.share * 100)}% Embers`);
      }
    }
    return { lines, embers };
  }

  // ---------- free Gem sources (rewards.ts) ----------

  /** Start a fresh set of daily challenges when the local day has changed. */
  private rollDay(now = Date.now()) {
    const today = dayKey(now);
    if (this.daily.day !== today) this.daily = { day: today, counts: {}, claimed: [] };
  }

  /** Count progress toward daily challenges, achievements and Bootcamp. */
  track(stat: StatKey, n = 1) {
    if (n <= 0) return;
    this.rollDay();
    this.stats[stat] += n;
    this.daily.counts[stat] = (this.daily.counts[stat] ?? 0) + n;
    if (stat === 'kills' || stat === 'stages' || stat === 'trials') this.guildQuestPending[stat] += n;
  }

  /** Today's challenges with progress, and whether each is claimed. */
  dailies(now = Date.now()) {
    this.rollDay(now);
    return DAILIES.map((def) => ({ def, progress: Math.min(def.goal, this.daily.counts[def.stat] ?? 0), claimed: this.daily.claimed.includes(def.stat) }));
  }

  claimDaily(stat: StatKey): boolean {
    const row = this.dailies().find((r) => r.def.stat === stat);
    if (!row || row.claimed || row.progress < row.def.goal) return false;
    this.daily.claimed.push(stat);
    this.gems += DAILY_GEMS;
    this.save();
    return true;
  }

  /** Gold worth `minutes` of income, with a floor so new players still get something. */
  goldFor(minutes: number): Decimal {
    return Decimal.max(new Decimal(this.goldPerSec).times(minutes * 60), goldPerKill(this.stage).times(20 * minutes));
  }

  /** Pay out a reward. Free Hero Chests roll like bought ones. */
  grant(r: Reward): { gems: number; gold: Decimal; drops: SummonDrop[] } {
    const gems = r.gems ?? 0;
    const gold = r.goldMinutes ? this.goldFor(r.goldMinutes) : new Decimal(0);
    this.gems += gems;
    this.gold = this.gold.plus(gold);
    const drops: SummonDrop[] = [];
    for (let i = 0; i < (r.chests ?? 0); i++) drops.push(...this.rollChest());
    this.enhanceStones += r.stones ?? 0;
    if (r.tickets) {
      this.refreshTickets();
      this.tickets = Math.min(TICKET_CAP, this.tickets + r.tickets);
    }
    return { gems, gold, drops };
  }

  /** Which day of the 30-day login calendar is next (0-29), and whether it can be claimed today. */
  loginState(now = Date.now()) {
    return { day: this.login.count % LOGIN_CYCLE.length, ready: this.login.last !== dayKey(now) };
  }

  claimLogin(now = Date.now()) {
    const { day, ready } = this.loginState(now);
    if (!ready) return null;
    this.login = { count: this.login.count + 1, last: dayKey(now) };
    const got = this.grant(LOGIN_CYCLE[day]);
    this.save();
    return got;
  }

  spinReady(now = Date.now()) {
    return this.spinDay !== dayKey(now);
  }

  /** Use today's free Lucky Spin. Returns the slice it landed on. */
  spin(now = Date.now()) {
    if (!this.spinReady(now)) return null;
    this.spinDay = dayKey(now);
    const index = weighted(SPIN_SLICES.map((sl, i) => [i, sl.weight] as [number, number]));
    const got = this.grant(SPIN_SLICES[index].reward);
    this.save();
    return { index, ...got };
  }

  // ---------- guilds (the server side is in guild.ts) ----------

  /** Pay guild credits for medals given to a guildmate. Giving is free: the donor keeps their own medals. Returns the credits, or null for a bad hero or amount. */
  giveGuildMedals(id: string, n: number): number | null {
    const hero = HEROES.find((h) => h.id === id);
    if (!hero || hero.rarity === 'legendary' || n <= 0) return null;
    const credits = n * GUILD_CREDITS_PER_MEDAL[hero.rarity];
    this.guildCredits += credits;
    this.save();
    return credits;
  }

  /** Medals guildmates gave to this player's requests. */
  receiveGuildMedals(gifts: Array<{ heroId: string; crests: number }>): SummonDrop[] {
    const drops: SummonDrop[] = [];
    for (const { heroId, crests } of gifts) {
      const hero = HEROES.find((h) => h.id === heroId);
      if (!hero || crests <= 0) continue;
      const before = this.crests[heroId] ?? 0;
      const need = this.unlockCrests(hero);
      this.addCrests(heroId, crests);
      drops.push({ heroId, crests, isNew: (this.levels[heroId] ?? 0) === 0 && before < need && before + crests >= need });
    }
    if (drops.length) this.save();
    return drops;
  }

  /** Damage one Guild Boss attempt deals: the Trial team (Ember levels) hitting for the whole fight. */
  guildBossDamage(element: Element): Decimal {
    let dps = new Decimal(0);
    for (const m of this.trialTeam()) dps = dps.plus(m.atk.div(m.def.attackCooldown).times(elementMultiplier(m.def.element, element)));
    return dps.times(GUILD_BOSS_SECONDS * (1 + this.researchBonus('elemental'))).floor();
  }

  /** A Guild Research bonus as a fraction (0.1 = +10%), from the cached ranks. */
  researchBonus(branch: ResearchBranch): number {
    const rank = Math.min(GUILD_RESEARCH_MAX_RANK, Math.max(0, Math.floor(this.guildResearch[branch] ?? 0)));
    return rank * (GUILD_RESEARCH.find((b) => b.id === branch)?.perRank ?? 0);
  }

  /** Store the guild's research ranks (an empty object when not in a guild); true when they changed. */
  setGuildResearch(ranks: Partial<Record<ResearchBranch, number>>): boolean {
    const clean = cleanResearch(ranks);
    if (JSON.stringify(clean) === JSON.stringify(this.guildResearch)) return false;
    this.guildResearch = clean;
    this.save();
    return true;
  }

  /** Spend Guild Coins on research (after the server took them). */
  spendGuildCoins(n: number): boolean {
    if (!(n > 0) || this.guildCredits < n) return false;
    this.guildCredits -= n;
    this.save();
    return true;
  }

  /** Pay one Guild Boss attempt: Guild Coins (more for a bigger share of the boss) and some gold. */
  payGuildBossAttempt(level: number, damage: Decimal, hp: Decimal): { coins: number; gold: Decimal } {
    const coins = guildBossAttemptCoins(level, damage, hp, GUILD_BOSS_PAR_ATTEMPTS);
    const gold = this.goldFor(GUILD_BOSS_GOLD_MINUTES);
    this.guildCredits += coins;
    this.gold = this.gold.plus(gold);
    this.save();
    return { coins, gold };
  }

  /**
   * Guild Boss rewards the server let this player claim: for each level beaten, Guild Coins and a
   * share of lifetime Embers; for each finished week, Guild Coins and Hero Chests by the highest level beaten.
   */
  payGuildBossRewards(levels: number[], weeks: number[]): { coins: number; embers: number; drops: SummonDrop[] } {
    let coins = 0;
    let embers = 0;
    const drops: SummonDrop[] = [];
    for (const level of levels) {
      coins += guildBossKillCoins(level);
      embers += Math.max(GUILD_BOSS_KILL_MIN_EMBERS, Math.round(this.lifetimeEmbers * GUILD_BOSS_KILL_EMBERS));
    }
    for (const top of weeks) {
      const r = guildBossWeekReward(top);
      coins += r.coins;
      for (let i = 0; i < r.chests; i++) drops.push(...this.rollChest());
    }
    this.guildCredits += coins;
    this.embers += embers;
    this.lifetimeEmbers += embers;
    this.save();
    return { coins, embers, drops };
  }

  /** Guild shop stock for today: rolls new hero offers on a new day and resets the weekly Wild Medal count. */
  guildShopState(now = Date.now()) {
    const today = dayKey(now);
    if (this.guildShop.day !== today) {
      const offers: GuildOffer[] = [];
      const pool = SHOP_HEROES.filter((h) => guildRarity(h));
      for (let tries = 0; offers.length < GUILD_SHOP_OFFERS && tries < 50; tries++) {
        const h = pickByRarity(pool.filter((x) => !offers.some((o) => o.heroId === x.id)), CHEST_RARITY_WEIGHTS);
        const r = h && guildRarity(h);
        if (h && r) offers.push({ heroId: h.id, crests: GUILD_OFFER_MEDALS[r], cost: GUILD_OFFER_COST[r], bought: false });
      }
      this.guildShop = { ...this.guildShop, day: today, offers, pouches: 0 };
    }
    const week = weekKey(now);
    if (this.guildShop.week !== week) this.guildShop = { ...this.guildShop, week, wild: 0 };
    return this.guildShop;
  }

  guildItemReady(id: GuildShopId, now = Date.now()): boolean {
    const item = GUILD_SHOP.find((i) => i.id === id)!;
    if (this.guildCredits < item.cost) return false;
    if (id === 'tickets') {
      this.refreshTickets();
      return this.tickets < TICKET_CAP;
    }
    if (id === 'embers') return this.guildShopState(now).pouches < GUILD_EMBER_POUCHES_PER_DAY;
    if (id === 'banner' || id === 'horn') return this.boosts[id] - now < (GUILD_BOOST_MAX_MINUTES - GUILD_BOOST_MINUTES) * 60_000 + 1000;
    return true;
  }

  /** Spend Guild Coins on an always-in-stock item. A Hero Chest returns its drops, a pouch its Embers. */
  buyGuildItem(id: GuildShopId, now = Date.now()): { drops: SummonDrop[]; embers: number } | null {
    if (!this.guildItemReady(id, now)) return null;
    this.guildCredits -= GUILD_SHOP.find((i) => i.id === id)!.cost;
    let drops: SummonDrop[] = [];
    let embers = 0;
    if (id === 'chest') drops = this.rollChest();
    else if (id === 'stone') this.enhanceStones += 1;
    else if (id === 'tickets') this.tickets = Math.min(TICKET_CAP, this.tickets + 5);
    else if (id === 'embers') {
      embers = Math.max(10, Math.round(this.lifetimeEmbers * 0.01));
      this.embers += embers;
      this.lifetimeEmbers += embers;
      this.guildShop.pouches += 1;
    } else {
      this.boosts[id] = Math.min(now + GUILD_BOOST_MAX_MINUTES * 60_000, Math.max(now, this.boosts[id]) + GUILD_BOOST_MINUTES * 60_000);
    }
    this.save();
    return { drops, embers };
  }

  /** Pay a Guild Quest reward the server allowed: 'track1'..'track4' or a quest's personal reward. */
  payGuildQuest(reward: string): { coins: number; drops: SummonDrop[] } {
    const step = /^track([1-4])$/.exec(reward);
    const tier = step ? GUILD_QUEST_TRACK[Number(step[1]) - 1] : null;
    const coins = tier ? tier.coins : GUILD_QUEST_PERSONAL_COINS;
    const drops = tier?.chest ? this.rollChest() : [];
    this.guildCredits += coins;
    this.save();
    return { coins, drops };
  }

  /** Every gold multiplier from boosts on enemy and floating-chest gold: the guild's Gold Banner and the Gem Shop's Gold Boost. */
  goldBoostMult(now = Date.now()): number {
    return this.boostMult('banner', now) * (this.goldBoostUntil > now ? GOLD_BOOST_MULT : 1);
  }

  /** Hourglasses left to use today. */
  hourglassesLeft(now = Date.now()): number {
    return this.hourglasses.day === dayKey(now) ? Math.max(0, HOURGLASS_PER_DAY - this.hourglasses.used) : HOURGLASS_PER_DAY;
  }

  /** Spend Gems on an Hourglass: HOURGLASS_MINUTES of gold at once. Returns the gold, or null when it can't be bought. */
  useHourglass(now = Date.now()): Decimal | null {
    if (this.gems < HOURGLASS_GEMS || this.hourglassesLeft(now) <= 0) return null;
    const today = dayKey(now);
    this.hourglasses = { day: today, used: (this.hourglasses.day === today ? this.hourglasses.used : 0) + 1 };
    this.gems -= HOURGLASS_GEMS;
    const gold = this.goldFor(HOURGLASS_MINUTES);
    this.gold = this.gold.plus(gold);
    this.save();
    return gold;
  }

  /** Whether another Gold Boost fits under the cap. */
  goldBoostReady(now = Date.now()): boolean {
    return this.gems >= GOLD_BOOST_GEMS && this.goldBoostUntil - now <= (GOLD_BOOST_MAX_MINUTES - GOLD_BOOST_MINUTES) * 60_000 + 1000;
  }

  /** Spend Gems on GOLD_BOOST_MINUTES more of the Gold Boost (stacks up to GOLD_BOOST_MAX_MINUTES). */
  buyGoldBoost(now = Date.now()): boolean {
    if (!this.goldBoostReady(now)) return false;
    this.gems -= GOLD_BOOST_GEMS;
    this.goldBoostUntil = Math.min(now + GOLD_BOOST_MAX_MINUTES * 60_000, Math.max(now, this.goldBoostUntil) + GOLD_BOOST_MINUTES * 60_000);
    this.save();
    return true;
  }

  /** Medal pack: MEDAL_PACK.medals for a hero the player picked. */
  buyMedalPack(heroId: string): SummonDrop[] | null {
    const cost = medalPackCost(heroId);
    if (cost === null || this.gems < cost) return null;
    this.gems -= cost;
    return this.receiveGuildMedals([{ heroId, crests: MEDAL_PACK.medals }]);
  }

  private rollHeroShop(rng: () => number): HeroShopOffer[] {
    const offers: HeroShopOffer[] = [];
    // One of each rarity first so every set mixes them, then the rest by Hero Chest odds.
    const rarities: Array<keyof typeof HERO_SHOP_DEALS> = ['common', 'rare', 'epic'];
    for (let i = 0; i < HERO_SHOP_OFFERS; i++) {
      const left = SHOP_HEROES.filter((h) => !offers.some((o) => o.heroId === h.id));
      let rarity = rarities[i];
      if (!rarity) {
        const roll = rng() * 100;
        rarity = roll < CHEST_RARITY_WEIGHTS.common ? 'common' : roll < CHEST_RARITY_WEIGHTS.common + CHEST_RARITY_WEIGHTS.rare ? 'rare' : 'epic';
      }
      const pool = left.filter((h) => h.rarity === rarity);
      const from = pool.length ? pool : left;
      if (!from.length) break;
      const h = from[Math.floor(rng() * from.length)];
      const deal = HERO_SHOP_DEALS[h.rarity as keyof typeof HERO_SHOP_DEALS] ?? HERO_SHOP_DEALS.epic;
      offers.push({ heroId: h.id, medals: deal.medals, gems: deal.gems, bought: false });
    }
    return offers;
  }

  /** The rotating Hero Shop, rolled again for free once its timer runs out. */
  heroShopState(now = Date.now(), rng: () => number = Math.random) {
    if (!this.heroShop.offers.length || now >= this.heroShop.refreshAt) {
      this.heroShop = { offers: this.rollHeroShop(rng), refreshAt: now + HERO_SHOP_REFRESH_MINUTES * 60_000 };
    }
    return { offers: this.heroShop.offers, refreshIn: this.heroShop.refreshAt - now };
  }

  /** Pay HERO_SHOP_REFRESH_GEMS for a new set now; the free timer starts over. */
  refreshHeroShopEarly(now = Date.now(), rng: () => number = Math.random): boolean {
    if (this.gems < HERO_SHOP_REFRESH_GEMS) return false;
    this.gems -= HERO_SHOP_REFRESH_GEMS;
    this.heroShop = { offers: this.rollHeroShop(rng), refreshAt: now + HERO_SHOP_REFRESH_MINUTES * 60_000 };
    this.save();
    return true;
  }

  buyHeroShopOffer(index: number, now = Date.now()): SummonDrop[] | null {
    const offer = this.heroShopState(now).offers[index];
    if (!offer || offer.bought || this.gems < offer.gems) return null;
    this.gems -= offer.gems;
    offer.bought = true;
    return this.receiveGuildMedals([{ heroId: offer.heroId, crests: offer.medals }]);
  }

  /** This week's featured hero, whether the big bundle is on, and what's already bought. */
  featuredState(now = Date.now()) {
    const week = weekIndex(now);
    if (this.featured.week !== week) this.featured = { week, small: false, big: false };
    const hero = FEATURED_ORDER[((week % FEATURED_ORDER.length) + FEATURED_ORDER.length) % FEATURED_ORDER.length];
    return { hero, bigWeek: week % FEATURED_BIG_EVERY === 0, small: this.featured.small, big: this.featured.big };
  }

  buyFeatured(kind: 'small' | 'big', now = Date.now()): SummonDrop[] | null {
    const f = this.featuredState(now);
    const bundle = kind === 'small' ? FEATURED_BUNDLE : FEATURED_BIG_BUNDLE;
    if (f[kind] || (kind === 'big' && !f.bigWeek) || this.gems < bundle.gems) return null;
    this.gems -= bundle.gems;
    this.featured[kind] = true;
    return this.receiveGuildMedals([{ heroId: f.hero.id, crests: bundle.medals }]);
  }

  /** Trial tickets still on sale today. */
  ticketBuysLeft(now = Date.now()): number {
    return this.ticketBuys.day === dayKey(now) ? Math.max(0, TICKETS_PER_DAY - this.ticketBuys.used) : TICKETS_PER_DAY;
  }

  /** How many tickets can be bought right now: today's limit, the room under the cap and the Gems. */
  ticketsBuyable(now = Date.now()): number {
    this.refreshTickets(now);
    return Math.max(0, Math.min(this.ticketBuysLeft(now), BOUGHT_TICKET_CAP - this.boughtTickets, Math.floor(this.gems / TICKET_GEMS)));
  }

  buyTickets(n: number, now = Date.now()): boolean {
    if (!(n >= 1) || n > this.ticketsBuyable(now)) return false;
    const today = dayKey(now);
    this.ticketBuys = { day: today, used: (this.ticketBuys.day === today ? this.ticketBuys.used : 0) + n };
    this.gems -= n * TICKET_GEMS;
    this.boughtTickets += n;
    this.save();
    return true;
  }

  /** A guild shop boost's multiplier right now (1 when it isn't running). */
  boostMult(id: 'banner' | 'horn', now = Date.now()): number {
    return this.boosts[id] > now ? 1 + GUILD_BOOSTS[id] : 1;
  }

  /** Buy one of today's hero offers. */
  buyGuildOffer(index: number, now = Date.now()): SummonDrop[] | null {
    const offer = this.guildShopState(now).offers[index];
    if (!offer || offer.bought || this.guildCredits < offer.cost) return null;
    this.guildCredits -= offer.cost;
    offer.bought = true;
    return this.receiveGuildMedals([{ heroId: offer.heroId, crests: offer.crests }]);
  }

  /** Price of Wild Medals for a hero, or null for heroes they can't go to (Legendary, or not released yet). */
  wildMedalCost(heroId: string): number | null {
    const h = PLAYABLE_HEROES.find((x) => x.id === heroId);
    const r = h && guildRarity(h);
    return r ? GUILD_WILD_COST[r] : null;
  }

  /** Wild Medals still on sale this week. */
  wildMedalsLeft(now = Date.now()): number {
    return Math.max(0, GUILD_WILD_PER_WEEK - this.guildShopState(now).wild);
  }

  /** Buy n Wild Medals for a hero the player picked. */
  buyWildMedals(heroId: string, n: number, now = Date.now()): SummonDrop[] | null {
    const cost = this.wildMedalCost(heroId);
    if (cost === null || !(n >= 1) || n > this.wildMedalsLeft(now) || this.guildCredits < cost * n) return null;
    this.guildCredits -= cost * n;
    this.guildShop.wild += n;
    return this.receiveGuildMedals([{ heroId, crests: n }]);
  }

  /**
   * Today's Daily Medal Bundle: a few heroes' medals, rolled at the first look each day (Hero Chest
   * odds, the smallest drop size), free once enough daily challenges are finished.
   */
  medalBundleState(now = Date.now()) {
    const today = dayKey(now);
    if (this.medalBundle.day !== today) this.medalBundle = { day: today, drops: this.rollMedalBundle(), claimed: false };
    const done = this.dailies(now).filter((r) => r.progress >= r.def.goal).length;
    return { drops: this.medalBundle.drops, claimed: this.medalBundle.claimed, done, need: MEDAL_BUNDLE_DAILIES, ready: !this.medalBundle.claimed && done >= MEDAL_BUNDLE_DAILIES };
  }

  private rollMedalBundle(): Array<{ heroId: string; crests: number }> {
    const drops: Array<{ heroId: string; crests: number }> = [];
    for (let tries = 0; drops.length < MEDAL_BUNDLE_HEROES && tries < 50; tries++) {
      const left = SHOP_HEROES.filter((h) => !drops.some((d) => d.heroId === h.id));
      const hero = pickByRarity(left, CHEST_RARITY_WEIGHTS);
      if (!hero) break;
      drops.push({ heroId: hero.id, crests: CREST_ROLLS[hero.rarity as keyof typeof CREST_ROLLS][0][0] });
    }
    return drops;
  }

  /** Claim today's Daily Medal Bundle. Returns its drops, or null when it isn't ready. */
  claimMedalBundle(now = Date.now()): SummonDrop[] | null {
    if (!this.medalBundleState(now).ready) return null;
    this.medalBundle.claimed = true;
    const drops = this.medalBundle.drops.map(({ heroId, crests }) => {
      const hero = HEROES.find((h) => h.id === heroId)!;
      const before = this.crests[heroId] ?? 0;
      const need = this.unlockCrests(hero);
      this.addCrests(heroId, crests);
      return { heroId, crests, isNew: (this.levels[heroId] ?? 0) === 0 && before < need && before + crests >= need };
    });
    this.save();
    return drops;
  }

  /** Current value an achievement counts. */
  achievementValue(def: AchievementDef): number {
    switch (def.value) {
      case 'bestStage':
        return this.bestStage;
      case 'rekindles':
        return this.rekindles;
      case 'heroes':
        return HEROES.filter((h) => (this.levels[h.id] ?? 0) > 0).length;
      case 'stars':
        return HEROES.reduce((t, h) => t + ((this.levels[h.id] ?? 0) > 0 ? (this.stars[h.id] ?? 0) + 1 : 0), 0);
      default:
        return this.stats[def.value];
    }
  }

  /** Each achievement's next tier (null once all are claimed), its progress and whether it's ready. */
  achievements() {
    return ACHIEVEMENTS.map((def) => {
      const tier = this.achieved[def.id] ?? 0;
      const next = def.tiers[tier] ?? null;
      const value = this.achievementValue(def);
      return { def, tier, next, value, ready: !!next && value >= next[0] };
    });
  }

  claimAchievement(id: string): boolean {
    const row = this.achievements().find((a) => a.def.id === id);
    if (!row || !row.ready || !row.next) return false;
    this.achieved[id] = row.tier + 1;
    this.gems += row.next[1];
    this.save();
    return true;
  }

  bootcampDone(def: BootcampDef): boolean {
    const c = def.check;
    switch (c.kind) {
      case 'heroLevel':
        return HEROES.some((h) => (this.levels[h.id] ?? 0) >= c.level);
      case 'stage':
        return this.bestStage >= c.stage;
      case 'stat':
        return this.stats[c.stat] >= c.count;
      case 'team':
        return this.lineupCount() >= c.size;
      case 'star':
        return HEROES.some((h) => (this.levels[h.id] ?? 0) > 0 && (this.stars[h.id] ?? 0) + 1 >= c.stars);
      case 'rekindle':
        return this.rekindles > 0;
      case 'relic':
        return this.equipped.length > 0;
    }
  }

  claimBootcamp(id: string): boolean {
    const def = BOOTCAMP.find((b) => b.id === id);
    if (!def || this.bootcamp.includes(id) || !this.bootcampDone(def)) return false;
    this.bootcamp.push(id);
    this.gems += def.gems;
    this.save();
    return true;
  }

  /** Daily challenges, achievement tiers and Recruit Trials ready to claim, and the Gems they pay together. */
  goalsReady(): { count: number; gems: number } {
    let count = 0;
    let gems = 0;
    for (const r of this.dailies()) if (!r.claimed && r.progress >= r.def.goal) { count++; gems += DAILY_GEMS; }
    for (const a of this.achievements()) {
      // An achievement can be several tiers ahead; each ready tier counts.
      for (let t = a.tier; a.def.tiers[t] && a.value >= a.def.tiers[t][0]; t++) { count++; gems += a.def.tiers[t][1]; }
    }
    for (const b of BOOTCAMP) if (!this.bootcamp.includes(b.id) && this.bootcampDone(b)) { count++; gems += b.gems; }
    return { count, gems };
  }

  /** Claim every ready daily challenge, achievement tier and Recruit Trial at once. */
  claimAllGoals(): { count: number; gems: number } {
    const before = this.gems;
    let count = 0;
    for (const r of this.dailies()) if (this.claimDaily(r.def.stat)) count++;
    for (const a of ACHIEVEMENTS) while (this.claimAchievement(a.id)) count++;
    for (const b of BOOTCAMP) if (this.claimBootcamp(b.id)) count++;
    return { count, gems: this.gems - before };
  }

  /** Highest milestone stage whose boss has been beaten (best stage ever, so Rekindle can't farm it). */
  milestoneReached(): number {
    return Math.floor((this.bestStage - 1) / MILESTONE_STEP) * MILESTONE_STEP;
  }

  /** Milestones beaten but not yet claimed. */
  milestonesReady(): number {
    return Math.max(0, (this.milestoneReached() - this.milestone) / MILESTONE_STEP);
  }

  /** Claim every waiting Stage Milestone at once. Returns the total paid, or null when none is waiting. */
  claimMilestones(): { count: number; chests: number; stones: number; tickets: number; gold: Decimal; drops: SummonDrop[] } | null {
    const count = this.milestonesReady();
    if (count <= 0) return null;
    let chests = 0;
    let stones = 0;
    let tickets = 0;
    let minutes = 0;
    for (let m = this.milestone + MILESTONE_STEP; m <= this.milestoneReached(); m += MILESTONE_STEP) {
      const r = milestoneReward(m);
      chests += r.chests;
      stones += r.stones;
      tickets += r.tickets;
      minutes += r.goldMinutes;
    }
    this.milestone = this.milestoneReached();
    const drops: SummonDrop[] = [];
    for (let i = 0; i < chests; i++) drops.push(...this.rollChest());
    this.enhanceStones += stones;
    this.refreshTickets();
    this.tickets = Math.min(TICKET_CAP, this.tickets + tickets);
    const gold = this.goldFor(minutes);
    this.gold = this.gold.plus(gold);
    this.save();
    return { count, chests, stones, tickets, gold, drops };
  }

  /** True when a daily reward on the home panel is waiting: login, spin, challenges, Medal Bundle or a milestone. */
  homeWaiting(now = Date.now()): boolean {
    return (
      this.loginState(now).ready ||
      this.spinReady(now) ||
      this.milestonesReady() > 0 ||
      this.medalBundleState(now).ready ||
      this.dailies(now).some((r) => !r.claimed && r.progress >= r.def.goal)
    );
  }

  /** The Shop tab's red dot: a Gem goal to claim, or a Hero Shop set the player hasn't looked at yet. */
  shopWaiting(now = Date.now()): boolean {
    this.heroShopState(now);
    return this.rewardsWaiting() || this.heroShop.refreshAt !== this.heroShopSeen;
  }

  /** The player opened the Shop: the current Hero Shop set counts as seen. */
  seeHeroShop(now = Date.now()) {
    this.heroShopState(now);
    this.heroShopSeen = this.heroShop.refreshAt;
  }

  /** True when an achievement or Bootcamp goal is waiting (drives the Shop tab badge). */
  rewardsWaiting(): boolean {
    return (
      this.achievements().some((a) => a.ready) ||
      BOOTCAMP.some((b) => !this.bootcamp.includes(b.id) && this.bootcampDone(b))
    );
  }

  addGold(amount: Decimal) {
    this.gold = this.gold.plus(amount);
  }

  recordIncome(amount: Decimal, dtSeconds: number) {
    // Exponential moving average over roughly a minute of play.
    const instant = amount.toNumber() / Math.max(dtSeconds, 0.001);
    if (!Number.isFinite(instant)) return;
    const alpha = Math.min(1, dtSeconds / 60);
    this.goldPerSec = this.goldPerSec * (1 - alpha) + instant * alpha;
  }

  recordStageTime(seconds: number) {
    this.secondsPerStage = this.secondsPerStage * 0.7 + seconds * 0.3;
  }

  /**
   * Set before the page reloads with a different save (a wipe or a cloud
   * save), so nothing in this page writes the old state back.
   */
  static frozen = false;

  save() {
    if (GameState.frozen) return;
    // lastSeen marks when the game last ran. A hidden tab is paused (and paid
    // as offline time when it comes back), so it doesn't move the mark; and the
    // mark never moves backwards, so winding the clock back can't replay
    // offline earnings.
    if (typeof document === 'undefined' || !document.hidden) this.lastSeen = Math.max(this.lastSeen, Date.now());
    GameState.writeLocal(this.toJSON());
  }

  /** Lost to a boss: start counting down to the automatic retry. */
  startBossRetry(now = Date.now()) {
    this.bossRetryAt = now + AUTO_BOSS_SECONDS * 1000;
  }

  /** Seconds until the automatic boss retry, or null when none is coming (advancing, or Auto boss off). */
  bossRetryIn(now = Date.now()): number | null {
    if (this.autoAdvance || !this.autoBoss) return null;
    if (!this.bossRetryAt) this.startBossRetry(now);
    return Math.max(0, Math.ceil((this.bossRetryAt - now) / 1000));
  }

  /** A farming stage was cleared: go for the boss again if the retry is due. */
  retryBossIfDue(now = Date.now()): boolean {
    if (this.bossRetryIn(now) !== 0) return false;
    this.autoAdvance = true;
    this.bossRetryAt = 0;
    return true;
  }

  /** Everything a save holds, as plain JSON (also what goes to the cloud). */
  toJSON(): SaveData {
    return {
      ...this.unknownFields,
      gold: this.gold.toString(),
      stage: this.stage,
      bestStage: this.bestStage,
      runBestStage: this.runBestStage,
      runStartStage: this.runStartStage,
      headStart: this.headStart,
      embers: this.embers,
      emberLevels: this.emberLevels,
      rekindles: this.rekindles,
      lifetimeEmbers: this.lifetimeEmbers,
      stats: this.stats,
      daily: this.daily,
      login: this.login,
      spinDay: this.spinDay,
      medalBundle: this.medalBundle,
      guildShop: this.guildShop,
      guildQuestPending: this.guildQuestPending,
      boosts: this.boosts,
      goldBoostUntil: this.goldBoostUntil,
      hourglasses: this.hourglasses,
      heroShop: this.heroShop,
      heroShopSeen: this.heroShopSeen,
      featured: this.featured,
      ticketBuys: this.ticketBuys,
      boughtTickets: this.boughtTickets,
      deals: this.deals,
      ascChest: { ...this.ascChest },
      vouchers: this.vouchers,
      guildCredits: this.guildCredits,
      guildResearch: this.guildResearch,
      achieved: this.achieved,
      bootcamp: this.bootcamp,
      milestone: this.milestone,
      stalls: this.stalls,
      benched: this.benched,
      tickets: this.tickets,
      ticketClock: this.ticketClock,
      trialBest: this.trialBest,
      trialTimes: this.trialTimes,
      essences: this.essences,
      crests: this.crests,
      stars: this.stars,
      awaken: this.awaken,
      starmotes: this.starmotes,
      pvp: this.pvp,
      gems: this.gems,
      levels: this.levels,
      autoAdvance: this.autoAdvance,
      autoBoss: this.autoBoss,
      speed2x: this.speed2x,
      autoUlt: this.autoUlt,
      muted: this.muted,
      sfxVolume: this.sfxVolume,
      musicVolume: this.musicVolume,
      tutorialStep: this.tutorialStep,
      tipsSeen: this.tipsSeen,
      buyAmount: this.buyAmount,
      stallBuyAmount: this.stallBuyAmount,
      relics: this.relics,
      relicEnhance: this.relicEnhance,
      enhanceStones: this.enhanceStones,
      equipped: this.equipped,
      relicSlots: this.relicSlots,
      teamSlots: this.teamSlots,
      ultSlots: this.ultSlots,
      ultPicks: this.ultPicks,
      ultSkip: this.ultSkip,
      relicShop: this.relicShop,
      legendaryMedals: this.legendaryMedals,
      rarityMix: 1,
      forms: { ...this.forms },
      goldPerSec: this.goldPerSec,
      secondsPerStage: this.secondsPerStage,
      lastSeen: this.lastSeen,
    };
  }

  static writeLocal(data: SaveData) {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch {
      // Storage can be unavailable (private mode); the game still runs.
    }
  }

  static readLocal(): SaveData | null {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      // A damaged save: set it aside rather than letting the next autosave replace it.
      try {
        if (raw) localStorage.setItem(`${SAVE_KEY}-unreadable-${Date.now()}`, raw);
      } catch {
        /* ignore */
      }
      return null;
    }
  }

  /**
   * Saves from before the 20-hero roster use the old five ids. Move each old hero's progress onto the
   * hero who replaced them (Marin -> Brine and so on), keeping the higher value if both exist.
   */
  static migrateHeroIds(d: SaveData) {
    for (const key of ['levels', 'emberLevels', 'crests', 'stars', 'awaken', 'benched']) {
      const map = d[key];
      if (!map || typeof map !== 'object') continue;
      for (const [oldId, newId] of Object.entries(RENAMED_HEROES)) {
        if (!(oldId in map)) continue;
        const v = map[oldId];
        map[newId] = typeof v === 'number' ? Math.max(v, map[newId] ?? 0) : v;
        delete map[oldId];
      }
    }
  }

  load(): boolean {
    const d = GameState.readLocal();
    if (!d) return false;
    try {
      GameState.migrateHeroIds(d);
      this.gold = new Decimal(d.gold ?? 0);
      this.stage = d.stage ?? 1;
      this.bestStage = d.bestStage ?? this.stage;
      this.runBestStage = d.runBestStage ?? this.bestStage;
      this.runStartStage = d.runStartStage ?? 1;
      this.headStart = d.headStart ?? true;
      this.embers = d.embers ?? 0;
      this.emberLevels = { ...this.emberLevels, ...(d.emberLevels ?? {}) };
      this.rekindles = d.rekindles ?? 0;
      this.lifetimeEmbers = d.lifetimeEmbers ?? this.embers;
      this.benched = { ...(d.benched ?? {}) };
      this.stats = { ...this.stats, ...(d.stats ?? {}) };
      if (d.daily) this.daily = { day: String(d.daily.day ?? ''), counts: { ...(d.daily.counts ?? {}) }, claimed: [...(d.daily.claimed ?? [])] };
      if (d.login) this.login = { count: d.login.count ?? 0, last: String(d.login.last ?? '') };
      this.spinDay = String(d.spinDay ?? '');
      this.guildCredits = Math.max(0, Number(d.guildCredits) || 0);
      this.guildResearch = d.guildResearch && typeof d.guildResearch === 'object' ? cleanResearch(d.guildResearch) : {};
      const shop = d.guildShop;
      if (shop && typeof shop === 'object') {
        const offers = Array.isArray(shop.offers) ? shop.offers.filter((o: GuildOffer) => HEROES.some((h) => h.id === o?.heroId) && Number(o.crests) > 0 && Number(o.cost) > 0) : [];
        this.guildShop = {
          day: String(shop.day ?? ''),
          offers: offers.map((o: GuildOffer) => ({ heroId: o.heroId, crests: Number(o.crests), cost: Number(o.cost), bought: !!o.bought })),
          pouches: Math.max(0, Number(shop.pouches) || 0),
          week: String(shop.week ?? ''),
          wild: Math.max(0, Number(shop.wild) || 0),
        };
      }
      const q = d.guildQuestPending;
      if (q && typeof q === 'object') this.guildQuestPending = { kills: Math.max(0, Number(q.kills) || 0), stages: Math.max(0, Number(q.stages) || 0), trials: Math.max(0, Number(q.trials) || 0) };
      if (d.boosts && typeof d.boosts === 'object') this.boosts = { banner: Number(d.boosts.banner) || 0, horn: Number(d.boosts.horn) || 0 };
      this.goldBoostUntil = Number(d.goldBoostUntil) || 0;
      if (d.hourglasses && typeof d.hourglasses === 'object') this.hourglasses = { day: String(d.hourglasses.day ?? ''), used: Math.max(0, Number(d.hourglasses.used) || 0) };
      if (d.heroShop && Array.isArray(d.heroShop.offers)) {
        const offers = d.heroShop.offers
          .filter((o: any) => o && SHOP_HEROES.some((h) => h.id === o.heroId))
          .map((o: any) => ({ heroId: String(o.heroId), medals: Math.max(1, Math.floor(Number(o.medals) || 1)), gems: Math.max(1, Math.floor(Number(o.gems) || 1)), bought: !!o.bought }))
          .slice(0, HERO_SHOP_OFFERS);
        this.heroShop = { offers, refreshAt: Number(d.heroShop.refreshAt) || 0 };
        // Older saves have looked at whatever set they hold.
        this.heroShopSeen = typeof d.heroShopSeen === 'number' ? d.heroShopSeen : this.heroShop.refreshAt;
      }
      if (d.featured && typeof d.featured === 'object') this.featured = { week: Number(d.featured.week) || 0, small: !!d.featured.small, big: !!d.featured.big };
      if (d.ticketBuys && typeof d.ticketBuys === 'object') this.ticketBuys = { day: String(d.ticketBuys.day ?? ''), used: Math.max(0, Number(d.ticketBuys.used) || 0) };
      this.boughtTickets = Math.min(BOUGHT_TICKET_CAP, Math.max(0, Math.floor(Number(d.boughtTickets) || 0)));
      if (d.deals && typeof d.deals === 'object') this.deals = { crateWeek: Number.isFinite(Number(d.deals.crateWeek)) ? Number(d.deals.crateWeek) : -1, voucherWeek: Number.isFinite(Number(d.deals.voucherWeek)) ? Number(d.deals.voucherWeek) : -1 };
      if (d.ascChest && typeof d.ascChest === 'object') this.ascChest = { week: String(d.ascChest.week ?? ''), bought: Math.max(0, Math.floor(Number(d.ascChest.bought) || 0)) };
      this.vouchers = Math.max(0, Math.floor(Number(d.vouchers) || 0));
      if (d.medalBundle && Array.isArray(d.medalBundle.drops)) {
        const drops = d.medalBundle.drops.filter((x: { heroId?: unknown; crests?: unknown }) => HEROES.some((h) => h.id === x?.heroId) && Number(x.crests) > 0);
        this.medalBundle = { day: String(d.medalBundle.day ?? ''), drops: drops.map((x: { heroId: string; crests: number }) => ({ heroId: x.heroId, crests: Number(x.crests) })), claimed: !!d.medalBundle.claimed };
      }
      this.achieved = { ...(d.achieved ?? {}) };
      this.bootcamp = [...(d.bootcamp ?? [])];
      this.milestone = d.milestone ?? 0;
      this.tickets = d.tickets ?? TICKET_CAP;
      this.ticketClock = d.ticketClock ?? Date.now();
      this.trialBest = { ...(d.trialBest ?? {}) };
      this.trialTimes = {};
      for (const [k, v] of Object.entries(d.trialTimes ?? {})) if (typeof v === 'number' && Number.isFinite(v) && v >= 0) this.trialTimes[k] = v;
      this.essences = { ...(d.essences ?? {}) };
      for (const def of STALLS) {
        const st = d.stalls?.[def.id];
        if (st) this.stalls[def.id] = { level: st.level ?? 0, progress: st.progress ?? 0 };
      }
      this.crests = { ...this.crests, ...(d.crests ?? {}) };
      this.stars = { ...this.stars, ...(d.stars ?? {}) };
      this.awaken = { ...(d.awaken ?? {}) };
      this.starmotes = d.starmotes ?? 0;
      this.pvp = { ...newPvp(), ...(d.pvp ?? {}) };
      this.gems = d.gems ?? START_GEMS;
      this.levels = { ...this.levels, ...(d.levels ?? {}) };
      this.autoAdvance = d.autoAdvance ?? true;
      this.autoBoss = d.autoBoss ?? true;
      this.speed2x = !!d.speed2x;
      this.autoUlt = !!d.autoUlt;
      this.muted = !!d.muted;
      this.sfxVolume = typeof d.sfxVolume === 'number' ? Math.max(0, Math.min(1, d.sfxVolume)) : 1;
      this.musicVolume = typeof d.musicVolume === 'number' ? Math.max(0, Math.min(1, d.musicVolume)) : 0.6;
      // Saves from before the guide existed belong to players who already know the game: no intro, no tips.
      this.tutorialStep = typeof d.tutorialStep === 'number' ? d.tutorialStep : TUTORIAL_DONE;
      this.tipsSeen = Array.isArray(d.tipsSeen) ? d.tipsSeen.filter((t: unknown) => typeof t === 'string') : d.tutorialStep === undefined ? [...TIP_IDS] : [];
      this.buyAmount = d.buyAmount ?? 1;
      this.stallBuyAmount = d.stallBuyAmount ?? 1;
      // Relics no longer in the game (the list changed) are dropped.
      this.relics = Object.fromEntries(Object.entries(d.relics ?? {}).filter(([id]) => RELICS.some((r) => r.id === id))) as Record<string, number>;
      this.relicEnhance = { ...(d.relicEnhance ?? {}) };
      // Older saves kept Gem-shop offers as { id, bought }: keep the unbought ones.
      const relicShop = d.relicShop;
      if (relicShop && Array.isArray(relicShop.offers)) {
        const ids = relicShop.offers.map((o: unknown) => (typeof o === 'string' ? o : (o as { id?: string; bought?: boolean })?.bought ? null : (o as { id?: string })?.id));
        this.relicShop = { offers: ids.filter((id: unknown): id is string => typeof id === 'string' && RELICS.some((r) => r.id === id)).slice(0, RELIC_SHOP_SIZE), refreshAt: Number(relicShop.refreshAt) || 0, rolled: false };
        this.relicShop.rolled = typeof relicShop.rolled === 'boolean' ? relicShop.rolled : this.relicShop.offers.length > 0;
      }
      this.enhanceStones = d.enhanceStones ?? 0;
      // Older saves ran relics to level 50 across tiers I-V: keep those levels as Enhances.
      for (const def of RELICS) {
        const lv = this.relics[def.id] ?? 0;
        if (lv > this.relicMaxLevel(def)) {
          this.relicEnhance[def.id] = Math.min(RELIC_ENHANCE_COSTS.length, Math.ceil((lv - RELIC_BASE_MAX) / RELIC_ENHANCE_LEVELS));
          this.relics[def.id] = Math.min(lv, this.relicMaxLevel(def));
        }
      }
      this.relicSlots = d.relicSlots ?? RELIC_START_SLOTS;
      // Saves from before team slots fought with 5 heroes; they keep those slots.
      this.teamSlots = d.teamSlots ?? OLD_SAVE_TEAM_SLOTS;
      // Before Ultimate slots every hero could use theirs; those saves keep all 5.
      this.ultSlots = d.ultSlots ?? ULT_SLOTS_MAX;
      const heroIds = (v: unknown): string[] => (Array.isArray(v) ? v.filter((id: unknown): id is string => typeof id === 'string' && HEROES.some((h) => h.id === id)) : []);
      this.ultPicks = heroIds(d.ultPicks);
      this.ultSkip = heroIds(d.ultSkip);
      this.legendaryMedals = d.legendaryMedals ?? 0;
      this.forms = d.forms && typeof d.forms === 'object' ? { ...d.forms } : {};
      if (!d.rarityMix) this.unlockRaisedRarity();
      this.equipped = (d.equipped ?? []).filter((id: string) => this.relics[id]).slice(0, this.relicSlots);
      this.goldPerSec = d.goldPerSec ?? 0;
      this.secondsPerStage = d.secondsPerStage ?? 20;
      this.lastSeen = d.lastSeen ?? Date.now();
      this.sanitize();
      // Keep whatever this version doesn't know (rev belongs to the cloud copy, not the device save).
      this.unknownFields = {};
      const known = new Set(Object.keys(this.toJSON()));
      this.unknownFields = Object.fromEntries(Object.entries(d).filter(([k]) => !known.has(k) && k !== 'rev'));
      return true;
    } catch {
      // Keep the unreadable save aside so it can be recovered, instead of being overwritten by a fresh game.
      try {
        localStorage.setItem(`${SAVE_KEY}-unreadable-${Date.now()}`, JSON.stringify(d));
      } catch {
        /* ignore */
      }
      return false;
    }
  }

  /** Repair values a hand-edited, cloud-merged or older save could carry, so the game never runs on nonsense. */
  private sanitize() {
    const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
    if (!this.gold || Number.isNaN(this.gold.mantissa) || this.gold.lt(0)) this.gold = new Decimal(0);
    for (const [id, v] of Object.entries(this.forms)) {
      if (typeof v === 'number' && Number.isFinite(v)) this.forms[id] = clampForm(v);
      else delete this.forms[id];
    }
    this.stage = Math.max(1, Math.floor(num(this.stage, 1)));
    this.bestStage = Math.max(this.stage, Math.floor(num(this.bestStage, this.stage)));
    this.runBestStage = Math.max(this.stage, Math.floor(num(this.runBestStage, this.stage)));
    this.runStartStage = Math.min(this.runBestStage, Math.max(1, Math.floor(num(this.runStartStage, 1))));
    this.headStart = this.headStart !== false;
    this.gems = Math.max(0, Math.floor(num(this.gems, START_GEMS)));
    this.starmotes = Math.max(0, Math.floor(num(this.starmotes, 0)));
    const p = this.pvp;
    p.trophies = Math.max(0, Math.floor(num(p.trophies, 0)));
    p.tickets = Math.max(0, Math.floor(num(p.tickets, PVP_TICKET_CAP)));
    p.clock = num(p.clock, Date.now());
    p.streak = Math.max(0, Math.floor(num(p.streak, 0)));
    p.refreshes = Math.max(0, Math.floor(num(p.refreshes, 0)));
    p.refreshAt = num(p.refreshAt, 0);
    if (!Array.isArray(p.picks) || !p.picks.every((o) => o && Array.isArray(o.heroes) && o.heroes.every((x) => HEROES.some((h) => h.id === x?.id)))) p.picks = [];
    for (const o of p.picks) if (o.snap) o.snap = o.snap.map(cleanSnapHero).filter((x): x is PvpSnapHero => !!x);
    p.picks = p.picks.filter((o) => !o.snap || o.snap.length > 0);
    if (!Array.isArray(p.notes)) p.notes = [];
    if (!p.buys || typeof p.buys !== 'object') p.buys = { day: '', used: 0 };
    const ids = (v: unknown) => (Array.isArray(v) ? v.filter((id): id is string => typeof id === 'string' && HEROES.some((h) => h.id === id)) : []);
    p.attack = ids(p.attack);
    p.defense = ids(p.defense);
    // A battle cut short by closing the game counts as a loss (its ticket is already spent).
    if (typeof p.active === 'number' && p.active >= 0) this.finishPvp(false);
    p.active = -1;
    this.ultSlots = Math.min(ULT_SLOTS_MAX, Math.max(ULT_SLOTS_START, Math.floor(num(this.ultSlots, ULT_SLOTS_START))));
    this.teamSlots = Math.min(TEAM_SLOTS_MAX, Math.max(TEAM_SLOTS_START, Math.floor(num(this.teamSlots, TEAM_SLOTS_START))));
    this.embers = Math.max(0, num(this.embers, 0));
    this.tickets = Math.min(TICKET_CAP, Math.max(0, Math.floor(num(this.tickets, TICKET_CAP))));
    this.ticketClock = num(this.ticketClock, Date.now());
    this.lastSeen = num(this.lastSeen, Date.now());
    for (const k of STAT_KEYS) this.stats[k] = Math.max(0, num(this.stats[k], 0));
    this.login.count = Math.max(0, Math.floor(num(this.login.count, 0)));
    this.milestone = Math.max(0, Math.floor(num(this.milestone, 0) / MILESTONE_STEP) * MILESTONE_STEP);
    for (const h of HEROES) {
      this.levels[h.id] = Math.max(0, Math.floor(num(this.levels[h.id], 0)));
      this.emberLevels[h.id] = Math.max(0, Math.floor(num(this.emberLevels[h.id], 0)));
      this.crests[h.id] = Math.max(0, Math.floor(num(this.crests[h.id], 0)));
      this.stars[h.id] = Math.min(MAX_STARS, Math.max(0, Math.floor(num(this.stars[h.id], 0))));
      const pink = Math.min(this.awakenCap(h.id), Math.max(0, Math.floor(num(this.awaken[h.id], 0))));
      if (pink > 0) this.awaken[h.id] = pink;
      else delete this.awaken[h.id];
    }
    // The free starter is always recruited.
    for (const h of HEROES) if (h.unlockCost === 0 && this.levels[h.id] === 0) this.levels[h.id] = 1;
    // At most teamSlots fighters (extras are benched, keeping their levels), and never none.
    let fighting = 0;
    for (const h of HEROES) {
      if (this.levels[h.id] === 0 || this.benched[h.id]) continue;
      if (++fighting > this.teamSlots) this.benched[h.id] = true;
    }
    if (fighting === 0) {
      const first = HEROES.find((h) => this.levels[h.id] > 0);
      if (first) delete this.benched[first.id];
    }
  }

  static wipe() {
    GameState.frozen = true;
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* ignore */
    }
  }

  /** A brand-new game's save, as the account reset writes it to the device and the cloud. */
  static freshSave(rev?: number): SaveData {
    const data = new GameState().toJSON();
    return rev === undefined ? data : { ...data, rev };
  }

  /**
   * Account reset: replace this device's save with a fresh game and freeze
   * saving, so nothing still running in this page (autosave, pagehide, a cloud
   * upload) can write the old progress back before the reload.
   */
  static startOver(data: SaveData = GameState.freshSave()) {
    GameState.frozen = true;
    GameState.writeLocal(data);
  }

  /**
   * How far offline play pushes from the current stage in `seconds`: stage by
   * stage at the recent clear speed, and a boss only falls if the team could
   * actually beat it (canBeatBoss). Changes nothing.
   */
  offlineReach(seconds: number): { stages: number; bosses: number } {
    let bosses = 0;
    let left = seconds;
    const start = this.stage;
    if (!this.autoAdvance || this.secondsPerStage <= 0) return { stages: 0, bosses: 0 };
    let stage = this.stage;
    for (;;) {
      // Walk up to the stage before the next boss (or stay on the boss stage you're on).
      const boss = Math.ceil(stage / BOSS_EVERY) * BOSS_EVERY;
      const room = Math.max(0, boss - 1 - stage);
      const run = Math.min(room, Math.floor(left / this.secondsPerStage));
      stage += run;
      left -= run * this.secondsPerStage;
      if (run < room) break;
      const fight = this.canBeatBoss(boss);
      const cost = (stage < boss ? this.secondsPerStage : 0) + Math.max(this.secondsPerStage, fight.seconds);
      if (!fight.won || left < cost) break;
      left -= cost;
      stage = boss + 1;
      bosses++;
    }
    return { stages: stage - start, bosses };
  }

  /** The highest stage a full offline stretch (the 12 h cap) would reach from here. */
  maxOfflineStage(): number {
    return this.stage + this.offlineReach(OFFLINE_CAP_HOURS * 3600).stages;
  }

  /**
   * Offline earnings (GDD section 10): gold at the recent rate, and stage
   * progress at the recent clear speed. Offline play never beats a boss, so it
   * stops one stage short of the next boss. Capped at 12 hours.
   */
  applyOffline(seconds: number): OfflineReport | null {
    const capped = Math.min(seconds, OFFLINE_CAP_HOURS * 3600);
    if (capped < 60) return null;
    const market = this.marketAutoPerSec().times(capped);
    const gold = new Decimal(this.goldPerSec).times(capped).plus(market);
    // Stalls waiting for a tap fill up while you're away.
    for (const def of STALLS) if (this.stalls[def.id].level > 0 && !this.stallAuto(def.id)) this.stalls[def.id].progress = this.stallCycle(def);
    const start = this.stage;
    const { stages, bosses } = this.offlineReach(capped);
    this.gold = this.gold.plus(gold);
    this.reachStage(start + stages);
    return { seconds: capped, gold, stages, bosses, market };
  }
}

/** Enhance Stones for a Trial win: none below level 6, then 1, 2 from level 16, 3 at level 26. */
export function trialStones(tier: number): number {
  return tier >= 26 ? 3 : tier >= 16 ? 2 : tier >= 6 ? 1 : 0;
}

/** Pick from `[value, weight]` pairs by weight. */
function weighted<T>(table: Array<[T, number]>): T {
  let roll = Math.random() * table.reduce((t, [, w]) => t + w, 0);
  return (table.find(([, w]) => (roll -= w) < 0) ?? table[0])[0];
}

/** A random hero: a rarity by weight among rarities present in `heroes`, then a hero of it. Never Legendary. */
/** Drop chance (percent) per rarity, counting only rarities some hero in `heroes` has. Matches pickByRarity. */
export function rarityOdds(heroes: HeroDef[], weights: Partial<Record<Rarity, number>>): Array<[Rarity, number]> {
  const present = (Object.keys(weights) as Rarity[]).filter((r) => heroes.some((h) => h.rarity === r) && (weights[r] ?? 0) > 0);
  const total = present.reduce((t, r) => t + (weights[r] ?? 0), 0);
  return present.map((r) => [r, total > 0 ? ((weights[r] ?? 0) / total) * 100 : 0]);
}

function pickByRarity(heroes: HeroDef[], weights: Partial<Record<Rarity, number>>): HeroDef | null {
  const present = (Object.keys(weights) as Rarity[]).filter((r) => heroes.some((h) => h.rarity === r));
  if (!present.length) return null;
  const rarity = weighted(present.map((r) => [r, weights[r] ?? 0] as [Rarity, number]));
  const pool = heroes.filter((h) => h.rarity === rarity);
  return pool[Math.floor(Math.random() * pool.length)];
}
