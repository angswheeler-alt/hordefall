import { beforeEach, describe, expect, it } from 'vitest';
import { GameState } from '../src/state';
import { AUTO_BOSS_SECONDS } from '../src/data';

const NOW = Date.UTC(2026, 9, 22, 12);

describe('Auto boss', () => {
  let s: GameState;
  beforeEach(() => { localStorage.clear(); s = new GameState(); });

  it('is on for new players and saved', () => {
    expect(s.autoBoss).toBe(true);
    s.autoBoss = false;
    s.save();
    const t = new GameState();
    expect(t.load()).toBe(true);
    expect(t.autoBoss).toBe(false);
  });

  it('counts down while farming after a boss loss, then advances on the next clear', () => {
    s.autoAdvance = false;
    s.startBossRetry(NOW);
    expect(s.bossRetryIn(NOW)).toBe(AUTO_BOSS_SECONDS);
    expect(s.retryBossIfDue(NOW + 10_000)).toBe(false);
    expect(s.autoAdvance).toBe(false);
    expect(s.retryBossIfDue(NOW + AUTO_BOSS_SECONDS * 1000)).toBe(true);
    expect(s.autoAdvance).toBe(true);
    expect(s.bossRetryIn(NOW + AUTO_BOSS_SECONDS * 1000)).toBeNull();
  });

  it('never retries when switched off or already advancing', () => {
    s.autoAdvance = false;
    s.autoBoss = false;
    s.startBossRetry(NOW);
    expect(s.bossRetryIn(NOW + 999_999)).toBeNull();
    expect(s.retryBossIfDue(NOW + 999_999)).toBe(false);
    expect(s.autoAdvance).toBe(false);
    s.autoAdvance = true;
    s.autoBoss = true;
    expect(s.retryBossIfDue(NOW + 999_999)).toBe(false);
  });

  it('starts counting on a save loaded mid-farm', () => {
    s.autoAdvance = false;
    s.bossRetryAt = 0;
    expect(s.bossRetryIn(NOW)).toBe(AUTO_BOSS_SECONDS);
  });
});
