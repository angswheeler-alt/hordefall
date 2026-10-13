import Decimal from 'break_infinity.js';
import { HEROES, OFFLINE_CAP_HOURS, BOSS_EVERY, REKINDLE_STAGE, KEEPER_BONUS_PER_LEVEL, ROAD_START, ROAD_STEP, ROAD_LENGTH, ROAD_GEMS, REKINDLE_BOOSTS, LINEUP_SIZE, TRIAL_ROTATION, TRIAL_TIERS, TRIAL_TIME, TICKET_MINUTES, TICKET_CAP, elementMultiplier, STALLS, STALL_AUTO_LEVEL, STALL_REKINDLE_REVENUE, STALL_REKINDLE_LEVELS, STALL_REKINDLE_LEVELS_CAP, START_GEMS, MILESTONE_GEMS, CHEST_COST, CHEST_DROPS, CREST_ROLLS, STAR_CRESTS, MAX_STARS } from './data';
import { trialHp, trialDps, stallIncome, stallUpgradeCost, upgradeCost, emberYield, keeperLevel, effectiveLevel, heroAtk, heroHp } from './formulas';
import type { HeroDef, StallDef, Element } from './data';

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

export interface TrialResult {
  won: boolean;
  /** Seconds the fight lasted (capped at the time limit). */
  seconds: number;
  /** Boss HP fraction left at the end, team HP fraction left at the end. */
  bossLeft: number;
  teamLeft: number;
  essence: number;
  crests: number;
  heroId: string;
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
  essences: Record<string, number> = {};
  /** Recruited heroes taken out of the lineup. They keep gold levels but don't fight. */
  benched: Record<string, boolean> = {};
  /** Market Row Stalls; level 0 means not opened. Reset on Rekindle. */
  stalls: Record<string, StallState> = Object.fromEntries(STALLS.map((s) => [s.id, { level: 0, progress: 0 }]));
  /** Every Ember ever earned; sets the Keeper level. */
  lifetimeEmbers = 0;
  /** Ember Road markers already paid out. */
  roadClaimed = 0;
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
    // First time past each 10-stage mark pays a few Gems.
    const newMarks = Math.floor(stage / 10) - Math.floor(this.bestStage / 10);
    if (newMarks > 0) this.gems += newMarks * MILESTONE_GEMS;
    this.stage = stage;
    this.bestStage = Math.max(this.bestStage, stage);
    this.runBestStage = Math.max(this.runBestStage, stage);
  }

  /** ATK and HP after levels, stars (x2 each) and team auras. `level` overrides the hero's current level. */
  heroPower(def: HeroDef, level = this.heroLevel(def.id)): { atk: Decimal; hp: Decimal } {
    const starMult = Math.pow(2, this.stars[def.id] ?? 0);
    return {
      atk: heroAtk(def, level).times(starMult * (this.hasStar('pyra', 4) ? 1.15 : 1)),
      hp: heroHp(def, level).times(starMult * (this.hasStar('marin', 4) ? 1.2 : 1)),
    };
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
    for (let l = 1; l < (this.levels[id] ?? 0); l++) total = total.plus(upgradeCost(def, l));
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

  /** Open a Hero Chest: Crests for random heroes; a drop for an unrecruited hero recruits them. */
  summon(): SummonDrop[] | null {
    if (this.gems < CHEST_COST) return null;
    this.gems -= CHEST_COST;
    const total = CREST_ROLLS.reduce((t, [, w]) => t + w, 0);
    const drops: SummonDrop[] = [];
    for (let i = 0; i < CHEST_DROPS; i++) {
      const hero = HEROES[Math.floor(Math.random() * HEROES.length)];
      let roll = Math.random() * total;
      const crests = (CREST_ROLLS.find(([, w]) => (roll -= w) < 0) ?? CREST_ROLLS[0])[0];
      const isNew = (this.levels[hero.id] ?? 0) === 0;
      if (isNew) {
        this.levels[hero.id] = 1;
        if (this.lineupCount() > LINEUP_SIZE) this.benched[hero.id] = true;
      }
      this.crests[hero.id] = (this.crests[hero.id] ?? 0) + crests;
      drops.push({ heroId: hero.id, crests, isNew });
    }
    this.save();
    return drops;
  }

  evolveCost(id: string): number | null {
    const stars = this.stars[id] ?? 0;
    return stars >= MAX_STARS ? null : STAR_CRESTS[stars];
  }

  evolve(id: string): boolean {
    const cost = this.evolveCost(id);
    if (cost === null || (this.crests[id] ?? 0) < cost) return false;
    this.crests[id] -= cost;
    this.stars[id] = (this.stars[id] ?? 0) + 1;
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
        const c = upgradeCost(h, this.levels[h.id]);
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
    return stallIncome(def, this.stallEffectiveLevel(def.id)).times(this.marketRevenueMult());
  }

  stallReady(id: string) {
    const st = this.stalls[id];
    const def = STALLS.find((d) => d.id === id)!;
    return st.level > 0 && !this.stallAuto(id) && st.progress >= def.cycle;
  }

  /** Advance every open Stall; auto-collect ones pay out, the rest wait for a tap. Returns gold auto-collected. */
  tickMarket(dt: number): Decimal {
    let earned = new Decimal(0);
    for (const def of STALLS) {
      const st = this.stalls[def.id];
      if (st.level === 0) continue;
      st.progress += dt;
      if (this.stallAuto(def.id)) {
        const cycles = Math.floor(st.progress / def.cycle);
        if (cycles > 0) {
          earned = earned.plus(this.stallIncome(def).times(cycles));
          st.progress -= cycles * def.cycle;
        }
      } else {
        st.progress = Math.min(st.progress, def.cycle);
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

  buyStall(id: string): boolean {
    const def = STALLS.find((d) => d.id === id)!;
    const st = this.stalls[id];
    const cost = stallUpgradeCost(def, st.level);
    if (cost.gt(this.gold)) return false;
    this.gold = this.gold.minus(cost);
    st.level += 1;
    return true;
  }

  /** Gold per second from auto-collect Stalls, used for offline time. */
  marketAutoPerSec(): Decimal {
    let total = new Decimal(0);
    for (const def of STALLS) if (this.stallAuto(def.id)) total = total.plus(this.stallIncome(def).div(def.cycle));
    return total;
  }

  /** Today's Trial element (changes at midnight UTC). */
  trialElement(now = Date.now()): Element {
    return TRIAL_ROTATION[Math.floor(now / 86400000) % TRIAL_ROTATION.length];
  }

  /** Add tickets earned since the clock started; returns seconds until the next one (0 when full). */
  refreshTickets(now = Date.now()): number {
    const period = TICKET_MINUTES * 60000;
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
  simulateTrial(tier: number, element = this.trialElement()) {
    const team = this.trialTeam();
    let dps = new Decimal(0);
    let hp = new Decimal(0);
    let incoming = 0;
    for (const m of team) {
      dps = dps.plus(m.atk.div(m.def.attackCooldown).times(elementMultiplier(m.def.element, element)));
      hp = hp.plus(m.hp);
      incoming += elementMultiplier(element, m.def.element);
    }
    const bossHp = trialHp(tier);
    const bossDps = trialDps(tier).times(team.length ? incoming / team.length : 1);
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

  trialUnlocked(element: string) {
    return Math.min(TRIAL_TIERS, (this.trialBest[element] ?? 0) + 1);
  }

  /** Spend a ticket on today's Trial. A loss gives the ticket back. */
  playTrial(tier: number): TrialResult | null {
    this.refreshTickets();
    const element = this.trialElement();
    if (this.tickets <= 0 || tier < 1 || tier > this.trialUnlocked(element)) return null;
    const sim = this.simulateTrial(tier, element);
    const hero = HEROES.find((h) => h.element === element)!;
    const result: TrialResult = { won: sim.won, seconds: sim.seconds, bossLeft: sim.bossLeft, teamLeft: sim.teamLeft, essence: 0, crests: 0, heroId: hero.id };
    if (!sim.won) return result;
    if (this.tickets >= TICKET_CAP) this.ticketClock = Date.now();
    this.tickets -= 1;
    result.essence = 2 * tier;
    result.crests = 3 + tier;
    this.essences[element] = (this.essences[element] ?? 0) + result.essence;
    this.crests[hero.id] = (this.crests[hero.id] ?? 0) + result.crests;
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
    return emberYield(this.runBestStage, REKINDLE_STAGE, this.keeperBonus());
  }

  /** Ember Road markers reached by the best stage ever. */
  roadReached() {
    if (this.bestStage < ROAD_START) return 0;
    return Math.min(ROAD_LENGTH, 1 + Math.floor((this.bestStage - ROAD_START) / ROAD_STEP));
  }

  /** Gems waiting on Ember Road markers reached since the last Rekindle. */
  pendingRoadGems() {
    return Math.max(0, this.roadReached() - this.roadClaimed) * ROAD_GEMS;
  }

  /**
   * Prestige reset (GDD section 7): back to stage 1 and gold level 1, keep
   * Embers and Ember levels. `mult` is a Gem-bought 2x or 3x payout.
   */
  rekindle(mult = 1): { embers: number; gems: number } | null {
    const base = this.pendingEmbers();
    if (base <= 0) return null;
    const boost = REKINDLE_BOOSTS.find((b) => b.mult === mult);
    if (mult !== 1 && (!boost || this.gems < boost.gems)) return null;
    if (boost) this.gems -= boost.gems;
    const gained = base * mult;
    const roadGems = this.pendingRoadGems();
    this.gems += roadGems;
    this.roadClaimed = this.roadReached();
    this.embers += gained;
    this.lifetimeEmbers += gained;
    this.rekindles += 1;
    this.gold = new Decimal(0);
    this.stage = 1;
    this.runBestStage = 1;
    for (const def of STALLS) this.stalls[def.id] = { level: 0, progress: 0 };
    this.autoAdvance = true;
    for (const h of HEROES) this.levels[h.id] = h.unlockCost === 0 ? 1 : this.levels[h.id] > 0 ? 1 : 0;
    this.secondsPerStage = 20;
    this.goldPerSec = 0;
    this.save();
    return { embers: gained, gems: roadGems };
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

  save() {
    this.lastSeen = Date.now();
    const data = {
      gold: this.gold.toString(),
      stage: this.stage,
      bestStage: this.bestStage,
      runBestStage: this.runBestStage,
      embers: this.embers,
      emberLevels: this.emberLevels,
      rekindles: this.rekindles,
      lifetimeEmbers: this.lifetimeEmbers,
      roadClaimed: this.roadClaimed,
      stalls: this.stalls,
      benched: this.benched,
      tickets: this.tickets,
      ticketClock: this.ticketClock,
      trialBest: this.trialBest,
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
      goldPerSec: this.goldPerSec,
      secondsPerStage: this.secondsPerStage,
      lastSeen: this.lastSeen,
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch {
      // Storage can be unavailable (private mode); the game still runs.
    }
  }

  load(): boolean {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(SAVE_KEY);
    } catch {
      return false;
    }
    if (!raw) return false;
    try {
      const d = JSON.parse(raw);
      this.gold = new Decimal(d.gold ?? 0);
      this.stage = d.stage ?? 1;
      this.bestStage = d.bestStage ?? this.stage;
      this.runBestStage = d.runBestStage ?? this.bestStage;
      this.embers = d.embers ?? 0;
      this.emberLevels = { ...this.emberLevels, ...(d.emberLevels ?? {}) };
      this.rekindles = d.rekindles ?? 0;
      this.lifetimeEmbers = d.lifetimeEmbers ?? this.embers;
      this.roadClaimed = d.roadClaimed ?? 0;
      this.benched = { ...(d.benched ?? {}) };
      this.tickets = d.tickets ?? TICKET_CAP;
      this.ticketClock = d.ticketClock ?? Date.now();
      this.trialBest = { ...(d.trialBest ?? {}) };
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
      this.goldPerSec = d.goldPerSec ?? 0;
      this.secondsPerStage = d.secondsPerStage ?? 20;
      this.lastSeen = d.lastSeen ?? Date.now();
      return true;
    } catch {
      return false;
    }
  }

  static wipe() {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* ignore */
    }
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
    for (const def of STALLS) if (this.stalls[def.id].level > 0 && !this.stallAuto(def.id)) this.stalls[def.id].progress = def.cycle;
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
