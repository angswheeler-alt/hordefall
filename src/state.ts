import Decimal from 'break_infinity.js';
import { HEROES, OFFLINE_CAP_HOURS, BOSS_EVERY } from './data';

const SAVE_KEY = 'hordefall-save-v1';

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
    this.stage += stages;
    this.bestStage = Math.max(this.bestStage, this.stage);
    return { seconds: capped, gold, stages };
  }
}
