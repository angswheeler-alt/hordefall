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

describe('Losing a normal stage', () => {
  let s: GameState;
  beforeEach(() => { localStorage.clear(); s = new GameState(); });

  it('drops back a stage to farm after two losses in a row, then tries again later', () => {
    s.stage = 49;
    expect(s.loseNormalStage(NOW)).toBe(false);
    expect(s.stage).toBe(49);
    expect(s.loseNormalStage(NOW)).toBe(true);
    expect(s.stage).toBe(48);
    expect(s.autoAdvance).toBe(false);
    expect(s.bossRetryIn(NOW)).toBe(AUTO_BOSS_SECONDS);
    expect(s.retryBossIfDue(NOW + AUTO_BOSS_SECONDS * 1000)).toBe(true);
    expect(s.autoAdvance).toBe(true);
  });

  it('counts only losses in a row, and never drops below stage 1', () => {
    s.stage = 10;
    s.loseNormalStage(NOW);
    s.stageLosses = 0; // a clear in between
    expect(s.loseNormalStage(NOW)).toBe(false);
    s.stage = 1;
    s.stageLosses = 0;
    s.loseNormalStage(NOW);
    expect(s.loseNormalStage(NOW)).toBe(false);
    expect(s.stage).toBe(1);
  });
});
