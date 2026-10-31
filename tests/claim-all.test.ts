import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameState } from '../src/state';
import { DAILY_GEMS } from '../src/rewards';

const noon = new Date(2026, 9, 22, 12).getTime();

function fresh() {
  GameState.frozen = false;
  localStorage.clear();
  return new GameState();
}

afterEach(() => vi.useRealTimers());

describe('Claim all', () => {
  it('claims ready dailies, every ready achievement tier and Recruit Trials, and matches the preview', () => {
    vi.useFakeTimers();
    vi.setSystemTime(noon);
    const s = fresh();
    s.track('kills', 1000);
    s.track('stages', 20);
    s.reachStage(120);
    const preview = s.goalsReady();
    // Two dailies, kill tier 1 and stage tiers 50 and 100 at least.
    expect(preview.count).toBeGreaterThanOrEqual(5);
    const before = s.gems;
    const got = s.claimAllGoals();
    expect(got).toEqual(preview);
    expect(s.gems - before).toBe(preview.gems);
    expect(s.achieved.stage).toBe(2);
    expect(s.daily.claimed).toEqual(expect.arrayContaining(['kills', 'stages']));
    expect(s.goalsReady()).toEqual({ count: 0, gems: 0 });
    expect(s.claimAllGoals()).toEqual({ count: 0, gems: 0 });
    expect(preview.gems).toBeGreaterThanOrEqual(2 * DAILY_GEMS);
  });
});
