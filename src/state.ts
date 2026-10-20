import Decimal from 'break_infinity.js';
import { DAILIES, DAILY_GEMS, MEDAL_BUNDLE_HEROES, MEDAL_BUNDLE_DAILIES, LOGIN_CYCLE, SPIN_SLICES, ACHIEVEMENTS, BOOTCAMP, STAT_KEYS, MILESTONE_STEP, milestoneReward, dayKey, type Reward, type StatKey, type AchievementDef, type BootcampDef } from './rewards';
import { HEROES, OFFLINE_CAP_HOURS, BOSS_EVERY, REKINDLE_STAGE, KEEPER_BONUS_PER_LEVEL, LEVEL_GIFT_STONES, REKINDLE_BOOSTS, ROAD_START, ROAD_STEP, ROAD_LENGTH, WHEEL_PRIZES, ESSENCE_NAMES, LINEUP_SIZE, TRIAL_ROTATION, TRIAL_SCHEDULE, TRIAL_TIERS, TRIAL_LEVELS, TRIAL_TIME, TRIAL_QUICK_TIME, TRIAL_UNLOCK_STAGE, TICKET_MINUTES, TICKET_CAP, elementMultiplier, STALLS, STALL_AUTO_LEVEL, STALL_REKINDLE_REVENUE, STALL_REKINDLE_LEVELS, STALL_REKINDLE_LEVELS_CAP, START_GEMS, RELICS, RELIC_SETS, RELIC_BASE_MAX, RELIC_ENHANCE_LEVELS, RELIC_ENHANCE_COSTS, RELIC_MAX_STARS, RELIC_START_SLOTS, RELIC_SLOT_COSTS, RELIC_SLOT_STAGES, CHEST_COST, CHEST_DROPS, CREST_ROLLS, CHEST_RARITY_WEIGHTS, TRIAL_RARITY_WEIGHTS, STAR_CRESTS, MAX_STARS, UNLOCK_CRESTS, LEGENDARY_MEDAL_RATE, GUILD_CREDITS_PER_MEDAL, GUILD_SHOP, type GuildShopId, GUILD_EMBER_POUCHES_PER_DAY, GUILD_BOOST_MINUTES, GUILD_BOOST_MAX_MINUTES, GUILD_BOOSTS, GUILD_SHOP_OFFERS, GUILD_OFFER_MEDALS, GUILD_OFFER_COST, GUILD_WILD_COST, GUILD_WILD_PER_WEEK, GUILD_QUEST_TRACK, GUILD_QUEST_PERSONAL_COINS, STAR_STAT_MULT, GUILD_BOSS_SECONDS, GUILD_BOSS_PAR_ATTEMPTS, GUILD_BOSS_GOLD_MINUTES, GUILD_RESEARCH, GUILD_RESEARCH_MAX_RANK, type ResearchBranch } from './data';
import { relicCost, trialHp, trialDps, stallIncome, stallUpgradeCost, stallBulkCost, upgradeCost, emberYield, emberRefund, emberBulk, keeperLevel, effectiveLevel, heroAtk, heroHp, heroDef, defended, goldPerKill, guildBossAttemptCoins, guildBossKillCoins } from './formulas';
import type { WheelPrize, HeroDef, StallDef, Element, RelicDef, RelicEffect, Rarity } from './data';
import { RENAMED_HEROES, PLAYABLE_HEROES } from './data';
import { activeEffects, mulEffect, sumEffect, type ActiveEffect } from './skills';
import { isKnight, combatPower, type HeroStats } from './stats';
import { heroProfile, heroBuildEffects, buildBonus, BUILD_EFFECTS, type BuildEffect } from './profiles';

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
}

export type SaveData = Record<string, any>;

export interface TrialResult {
  won: boolean;
  /** Seconds the fight lasted (capped at the time limit). */
  seconds: number;
  /** Boss HP fraction left at the end, team HP fraction left at the end. */
  bossLeft: number;
  teamLeft: number;
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

export class GameState {
  gold = new Decimal(0);
  stage = 1;
  bestStage = 1;
  /** Highest stage reached since the last Rekindle; sets the Ember payout. */
  runBestStage = 1;
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
  gems = START_GEMS;
  levels: Record<string, number> = Object.fromEntries(HEROES.map((h) => [h.id, h.unlockCost === 0 ? 1 : 0]));
  /** False after losing to a boss: clears repeat the current stage until the player challenges again. */
  autoAdvance = true;
  speed2x = false;
  autoUlt = false;
  muted = false;
  buyAmount: 1 | 10 | 'max' = 1;
  /** Relic levels (0 = not crafted), Enhances done per relic, equipped relic ids, owned slots and Enhance Stones. */
  relics: Record<string, number> = {};
  relicEnhance: Record<string, number> = {};
  equipped: string[] = [];
  relicSlots = RELIC_START_SLOTS;
  enhanceStones = 0;
  /** Earned by giving medals to guildmates; spent in the guild shop. */
  guildCredits = 0;
  /** Guild shop: today's hero offers, Ember pouches bought today and Wild Medals bought this week. */
  guildShop: GuildShopState = { day: '', offers: [], pouches: 0, week: '', wild: 0 };
  /** When the guild shop's Gold Banner and War Horn run out (ms). */
  boosts: { banner: number; horn: number } = { banner: 0, horn: 0 };
  /** Counts for Guild Quests not yet sent to the server. */
  guildQuestPending = { kills: 0, stages: 0, trials: 0 };
  /** Guild Research ranks of the player's guild, cached from the server (empty outside a guild). */
  guildResearch: Partial<Record<ResearchBranch, number>> = {};
  /** Legendary medals, made by 8★ heroes from extra medals; Legendary heroes will use them. */
  legendaryMedals = 0;
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
    return activeEffects((id, star) => this.hasStar(id, star));
  }

  /** ATK and HP after levels, stars (x STAR_STAT_MULT each), ATK/HP star skills and relics. `level` overrides the hero's current level. */
  heroPower(def: HeroDef, level = this.heroLevel(def.id)): { atk: Decimal; hp: Decimal; defense: Decimal } {
    const starMult = Math.pow(STAR_STAT_MULT, this.stars[def.id] ?? 0);
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
    for (const h of HEROES) if (this.inLineup(h.id)) for (const e of heroBuildEffects(h)) counts[e]++;
    return counts;
  }

  /** A hero's Combat Power (src/stats.ts combatPower) at their current level, or at `level`. */
  heroCombatPower(def: HeroDef, level = this.heroLevel(def.id)): Decimal {
    return combatPower(this.heroStats(def, level));
  }

  /** The player's total Combat Power: every recruited hero's Combat Power added up. */
  totalCombatPower(): Decimal {
    let total = new Decimal(0);
    for (const h of HEROES) if ((this.levels[h.id] ?? 0) > 0) total = total.plus(this.heroCombatPower(h));
    return total;
  }

  /** Every number on the hero's stat pages, as battle uses them. */
  heroStats(def: HeroDef, level = this.heroLevel(def.id)): HeroStats {
    const fx = this.effects();
    const sum = (kind: Parameters<typeof sumEffect>[1]) => sumEffect(fx, kind, def.id);
    const mul = (kind: Parameters<typeof mulEffect>[1]) => mulEffect(fx, kind, def.id);
    const starMult = Math.pow(STAR_STAT_MULT, this.stars[def.id] ?? 0);
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

  canUpgradeRelic(def: RelicDef): boolean {
    const cost = this.relicNextCost(def);
    if (!this.relicOpen(def) || cost === null || !def.essences.every((e) => (this.essences[e] ?? 0) >= cost)) return false;
    return (this.relics[def.id] ?? 0) > 0 || this.enhanceStones >= (def.stones ?? 0);
  }

  /** Craft (level 0) or upgrade a relic with Essence. A newly crafted relic goes into a free slot. */
  upgradeRelic(id: string): boolean {
    const def = RELICS.find((r) => r.id === id)!;
    if (!this.canUpgradeRelic(def)) return false;
    const cost = this.relicNextCost(def)!;
    for (const e of def.essences) this.essences[e] -= cost;
    const crafted = !this.relics[id];
    if (crafted) this.enhanceStones -= def.stones ?? 0;
    this.relics[id] = (this.relics[id] ?? 0) + 1;
    if (crafted && this.equipped.length < this.relicSlots) this.equipped.push(id);
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
    return this.inLineup(id) && (this.stars[id] ?? 0) >= star;
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
      if (this.inLineup(id) || this.lineupCount() >= LINEUP_SIZE) return null;
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
   * Give a hero medals. Once a hero is 8★ they can't use more, so every
   * LEGENDARY_MEDAL_RATE of them becomes a Legendary medal instead.
   */
  addCrests(id: string, amount: number) {
    this.crests[id] = (this.crests[id] ?? 0) + amount;
    if ((this.stars[id] ?? 0) < MAX_STARS) return;
    const made = Math.floor(this.crests[id] / LEGENDARY_MEDAL_RATE);
    this.legendaryMedals += made;
    this.crests[id] -= made * LEGENDARY_MEDAL_RATE;
  }

  /** Crests a locked hero needs to unlock (0 for the free starter), or null for Legendary heroes, which only come through special means. */
  unlockCrests(def: HeroDef): number | null {
    if (def.unlockCost === 0) return 0;
    return def.rarity === 'legendary' ? null : UNLOCK_CRESTS[def.rarity];
  }

  canUnlock(def: HeroDef): boolean {
    const need = this.unlockCrests(def);
    return need !== null && (this.levels[def.id] ?? 0) === 0 && (this.crests[def.id] ?? 0) >= need;
  }

  /** Spend a locked hero's Crests to unlock them at level 1; benched if the team is full. */
  unlockHero(id: string): boolean {
    const def = HEROES.find((h) => h.id === id)!;
    if (!this.canUnlock(def)) return false;
    this.crests[id] -= this.unlockCrests(def)!;
    this.levels[id] = 1;
    if (this.lineupCount() > LINEUP_SIZE) this.benched[id] = true;
    this.save();
    return true;
  }

  /** Open a Hero Chest: Crests (medals) for random heroes. Locked heroes unlock once they have enough. */
  summon(): SummonDrop[] | null {
    if (this.gems < CHEST_COST) return null;
    this.gems -= CHEST_COST;
    this.track('summons');
    const drops = this.rollChest();
    this.save();
    return drops;
  }

  /** The drops of one Hero Chest, paid for or not. */
  private rollChest(): SummonDrop[] {
    const drops: SummonDrop[] = [];
    for (let i = 0; i < CHEST_DROPS; i++) {
      const hero = pickByRarity(PLAYABLE_HEROES, CHEST_RARITY_WEIGHTS);
      if (!hero) break;
      const crests = weighted(CREST_ROLLS[hero.rarity as keyof typeof CREST_ROLLS]);
      const locked = (this.levels[hero.id] ?? 0) === 0;
      const before = this.crests[hero.id] ?? 0;
      this.addCrests(hero.id, crests);
      // "New" marks the drop that brings a locked hero to their unlock count.
      const need = this.unlockCrests(hero);
      const isNew = locked && need !== null && before < need && before + crests >= need;
      drops.push({ heroId: hero.id, crests, isNew });
    }
    return drops;
  }

  evolveCost(id: string): number | null {
    const stars = this.stars[id] ?? 0;
    return stars >= MAX_STARS ? null : STAR_CRESTS[stars];
  }

  evolve(id: string): boolean {
    const cost = this.evolveCost(id);
    if (cost === null || (this.levels[id] ?? 0) <= 0 || (this.crests[id] ?? 0) < cost) return false;
    this.crests[id] -= cost;
    this.stars[id] = (this.stars[id] ?? 0) + 1;
    this.addCrests(id, 0); // at 8★, leftover medals turn into Legendary medals
    this.save();
    return true;
  }

  canRekindle() {
    return this.runBestStage > REKINDLE_STAGE;
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
    return TRIAL_SCHEDULE[element].includes(new Date(now).getDay());
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

  /** Simulate a Trial fight against today's boss at `tier`. */
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
    return this.trialsUnlocked() && this.trialOpen(element) && this.tickets > 0 && tier >= 1 && tier <= this.trialUnlocked(element) && this.trialReqMet(tier);
  }

  /** Spend a ticket on an open Trial. A loss gives the ticket back. */
  playTrial(element: Element, tier: number): TrialResult | null {
    if (!this.trialPlayable(element, tier)) return null;
    const sim = this.simulateTrial(tier, element);
    const result: TrialResult = { won: sim.won, seconds: sim.seconds, bossLeft: sim.bossLeft, teamLeft: sim.teamLeft, essence: 0, stones: 0, medals: [] };
    if (!sim.won) return result;
    const key = `${element}:${tier}`;
    this.trialTimes[key] = Math.min(this.trialTimes[key] ?? Infinity, Math.round(sim.seconds * 10) / 10);
    return this.payTrial(element, tier, result);
  }

  /** Skip the fight on a level already won fast enough: same ticket, same reward as a win. */
  quickTrial(element: Element, tier: number): TrialResult | null {
    if (!this.trialPlayable(element, tier) || !this.canQuickTrial(element, tier)) return null;
    return this.payTrial(element, tier, { won: true, seconds: 0, bossLeft: 0, teamLeft: 1, essence: 0, stones: 0, medals: [] });
  }

  private payTrial(element: Element, tier: number, result: TrialResult): TrialResult {
    const level = TRIAL_LEVELS[tier - 1];
    if (this.tickets >= TICKET_CAP) this.ticketClock = Date.now();
    this.tickets -= 1;
    this.track('trials');
    const explore = 1 + this.researchBonus('exploration');
    result.essence = Math.round(level.essence * explore);
    this.essences[element] = (this.essences[element] ?? 0) + result.essence;
    result.stones = Math.round(trialStones(tier) * explore);
    this.enhanceStones += result.stones;
    // Medals go to different random heroes of the element while there are enough of them.
    // Medals go to different heroes of the element where possible, picked by rarity weight.
    // Legendary heroes only come through special means, so they get none.
    const pool = PLAYABLE_HEROES.filter((h) => h.element === element);
    for (let i = 0; i < level.medals; i++) {
      const left = pool.filter((h) => !result.medals.includes(h.id));
      const hero = pickByRarity(left.length ? left : pool, TRIAL_RARITY_WEIGHTS);
      if (!hero) break;
      const id = hero.id;
      result.medals.push(id);
      this.addCrests(id, 1);
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
  rekindle(mult = 1): RekindleResult | null {
    const base = this.pendingEmbers();
    if (base <= 0) return null;
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
    this.stage = 1;
    this.runBestStage = 1;
    for (const def of STALLS) this.stalls[def.id] = { level: 0, progress: 0 };
    this.autoAdvance = true;
    for (const h of HEROES) this.levels[h.id] = h.unlockCost === 0 ? 1 : this.levels[h.id] > 0 ? 1 : 0;
    this.secondsPerStage = 20;
    this.goldPerSec = 0;
    this.save();
    return { embers: gained, wheel: wheel.lines, levelsGained, stones };
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

  /** Rekindle Wheel slots unlocked by this run's best stage. */
  roadReached() {
    if (this.runBestStage < ROAD_START) return 0;
    return Math.min(ROAD_LENGTH, 1 + Math.floor((this.runBestStage - ROAD_START) / ROAD_STEP));
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
      drops.push({ heroId, crests, isNew: (this.levels[heroId] ?? 0) === 0 && need !== null && before < need && before + crests >= need });
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

  /** Reward for a beaten Guild Boss: Guild Coins, a Hero Chest and 1% of lifetime Embers (at least 10). */
  payGuildBossKill(level: number): { coins: number; embers: number; drops: SummonDrop[] } {
    const coins = guildBossKillCoins(level);
    const embers = Math.max(10, Math.round(this.lifetimeEmbers * 0.01));
    this.guildCredits += coins;
    this.embers += embers;
    this.lifetimeEmbers += embers;
    const drops = this.rollChest();
    this.save();
    return { coins, embers, drops };
  }

  /** Guild shop stock for today: rolls new hero offers on a new day and resets the weekly Wild Medal count. */
  guildShopState(now = Date.now()) {
    const today = dayKey(now);
    if (this.guildShop.day !== today) {
      const offers: GuildOffer[] = [];
      const pool = PLAYABLE_HEROES.filter((h) => guildRarity(h));
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
      const left = PLAYABLE_HEROES.filter((h) => !drops.some((d) => d.heroId === h.id));
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
      return { heroId, crests, isNew: (this.levels[heroId] ?? 0) === 0 && need !== null && before < need && before + crests >= need };
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

  /** True when any free reward is waiting (drives the Shop tab badge). */
  rewardsWaiting(now = Date.now()): boolean {
    return (
      this.loginState(now).ready ||
      this.spinReady(now) ||
      this.milestonesReady() > 0 ||
      this.medalBundleState(now).ready ||
      this.dailies(now).some((r) => !r.claimed && r.progress >= r.def.goal) ||
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

  /** Everything a save holds, as plain JSON (also what goes to the cloud). */
  toJSON(): SaveData {
    return {
      gold: this.gold.toString(),
      stage: this.stage,
      bestStage: this.bestStage,
      runBestStage: this.runBestStage,
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
      gems: this.gems,
      levels: this.levels,
      autoAdvance: this.autoAdvance,
      speed2x: this.speed2x,
      autoUlt: this.autoUlt,
      muted: this.muted,
      buyAmount: this.buyAmount,
      stallBuyAmount: this.stallBuyAmount,
      relics: this.relics,
      relicEnhance: this.relicEnhance,
      enhanceStones: this.enhanceStones,
      equipped: this.equipped,
      relicSlots: this.relicSlots,
      legendaryMedals: this.legendaryMedals,
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
    for (const key of ['levels', 'emberLevels', 'crests', 'stars', 'benched']) {
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
      this.gems = d.gems ?? START_GEMS;
      this.levels = { ...this.levels, ...(d.levels ?? {}) };
      this.autoAdvance = d.autoAdvance ?? true;
      this.speed2x = !!d.speed2x;
      this.autoUlt = !!d.autoUlt;
      this.muted = !!d.muted;
      this.buyAmount = d.buyAmount ?? 1;
      this.stallBuyAmount = d.stallBuyAmount ?? 1;
      // Relics no longer in the game (the list changed to follow the original) are dropped.
      this.relics = Object.fromEntries(Object.entries(d.relics ?? {}).filter(([id]) => RELICS.some((r) => r.id === id))) as Record<string, number>;
      this.relicEnhance = { ...(d.relicEnhance ?? {}) };
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
      this.legendaryMedals = d.legendaryMedals ?? 0;
      this.equipped = (d.equipped ?? []).filter((id: string) => this.relics[id]).slice(0, this.relicSlots);
      this.goldPerSec = d.goldPerSec ?? 0;
      this.secondsPerStage = d.secondsPerStage ?? 20;
      this.lastSeen = d.lastSeen ?? Date.now();
      this.sanitize();
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
    this.stage = Math.max(1, Math.floor(num(this.stage, 1)));
    this.bestStage = Math.max(this.stage, Math.floor(num(this.bestStage, this.stage)));
    this.runBestStage = Math.max(this.stage, Math.floor(num(this.runBestStage, this.stage)));
    this.gems = Math.max(0, Math.floor(num(this.gems, START_GEMS)));
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
    }
    // The free starter is always recruited.
    for (const h of HEROES) if (h.unlockCost === 0 && this.levels[h.id] === 0) this.levels[h.id] = 1;
    // At most LINEUP_SIZE fighters (extras are benched, keeping their levels), and never none.
    let fighting = 0;
    for (const h of HEROES) {
      if (this.levels[h.id] === 0 || this.benched[h.id]) continue;
      if (++fighting > LINEUP_SIZE) this.benched[h.id] = true;
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
    let stages = 0;
    if (this.autoAdvance && this.secondsPerStage > 0 && this.stage % BOSS_EVERY !== 0) {
      const nextBoss = Math.ceil((this.stage + 1) / BOSS_EVERY) * BOSS_EVERY;
      const room = Math.max(0, nextBoss - 1 - this.stage);
      stages = Math.min(room, Math.floor(capped / this.secondsPerStage));
    }
    this.gold = this.gold.plus(gold);
    this.reachStage(this.stage + stages);
    return { seconds: capped, gold, stages, market };
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
