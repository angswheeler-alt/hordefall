import Decimal from 'break_infinity.js';
import { HEROES, OFFLINE_CAP_HOURS, BOSS_EVERY, REKINDLE_STAGE, START_GEMS, MILESTONE_GEMS, CHEST_COST, CHEST_DROPS, CREST_ROLLS, STAR_CRESTS, MAX_STARS } from './data';
import { emberYield, effectiveLevel, emberCost, heroAtk, heroHp } from './formulas';
import type { HeroDef } from './data';

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
    return (this.levels[id] ?? 0) > 0 && (this.stars[id] ?? 0) >= star;
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
      if (isNew) this.levels[hero.id] = 1;
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

  /** Embers spent on a hero's Ember levels. */
  embersSpent(id: string): number {
    let total = 0;
    for (let l = 0; l < (this.emberLevels[id] ?? 0); l++) total += emberCost(l);
    return total;
  }

  /** Take a hero's Ember levels back as Embers (stand-in for removing them from the lineup). */
  refundEmbers(id: string): number {
    const back = this.embersSpent(id);
    this.embers += back;
    this.emberLevels[id] = 0;
    this.save();
    return back;
  }

  canRekindle() {
    return this.runBestStage > REKINDLE_STAGE;
  }

  pendingEmbers() {
    return emberYield(this.runBestStage, REKINDLE_STAGE);
  }

  /** Prestige reset (GDD section 7): back to stage 1 and gold level 1, keep Embers and Ember levels. */
  rekindle(): number {
    const gained = this.pendingEmbers();
    if (gained <= 0) return 0;
    this.embers += gained;
    this.rekindles += 1;
    this.gold = new Decimal(0);
    this.stage = 1;
    this.runBestStage = 1;
    this.autoAdvance = true;
    for (const h of HEROES) this.levels[h.id] = h.unlockCost === 0 ? 1 : this.levels[h.id] > 0 ? 1 : 0;
    this.secondsPerStage = 20;
    this.goldPerSec = 0;
    this.save();
    return gained;
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
    const gold = new Decimal(this.goldPerSec).times(capped);
    let stages = 0;
    if (this.autoAdvance && this.secondsPerStage > 0 && this.stage % BOSS_EVERY !== 0) {
      const nextBoss = Math.ceil((this.stage + 1) / BOSS_EVERY) * BOSS_EVERY;
      const room = Math.max(0, nextBoss - 1 - this.stage);
      stages = Math.min(room, Math.floor(capped / this.secondsPerStage));
    }
    this.gold = this.gold.plus(gold);
    this.reachStage(this.stage + stages);
    return { seconds: capped, gold, stages };
  }
}
