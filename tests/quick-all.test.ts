import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameState } from '../src/state';
import { TRIAL_UNLOCK_STAGE, TRIAL_ROTATION } from '../src/data';

// A Saturday: every Trial is open.
const SAT = new Date(2026, 9, 31, 12).getTime();

function fresh() {
  GameState.frozen = false;
  localStorage.clear();
  const s = new GameState();
  s.reachStage(TRIAL_UNLOCK_STAGE + 1);
  return s;
}

afterEach(() => vi.useRealTimers());

describe('Quick all Trials', () => {
  it('picks each open Trial\'s highest fast-won level', () => {
    vi.useFakeTimers();
    vi.setSystemTime(SAT);
    const s = fresh();
    s.trialBest.water = 3;
    s.trialTimes['water:1'] = 5;
    s.trialTimes['water:2'] = 6;
    s.trialTimes['water:3'] = 9999; // won, but too slow to Quick
    s.trialBest.fire = 1;
    s.trialTimes['fire:1'] = 4;
    expect(s.quickAllPlan()).toEqual([
      { element: 'water', tier: 2 },
      { element: 'fire', tier: 1 },
    ].sort((a, b) => TRIAL_ROTATION.indexOf(a.element as never) - TRIAL_ROTATION.indexOf(b.element as never)));
  });

  it('spends only free tickets, shared in turn, and keeps the bought stash', () => {
    vi.useFakeTimers();
    vi.setSystemTime(SAT);
    const s = fresh();
    s.trialBest.water = 1;
    s.trialTimes['water:1'] = 5;
    s.trialBest.fire = 1;
    s.trialTimes['fire:1'] = 5;
    s.tickets = 5;
    s.boughtTickets = 7;
    const runs = s.quickAllTrials()!;
    expect(runs.map((r) => r.result.runs).sort()).toEqual([2, 3]);
    expect(runs.every((r) => r.result.medals.length > 0 && r.result.essence > 0)).toBe(true);
    expect(s.tickets).toBe(0);
    expect(s.boughtTickets).toBe(7);
    expect(s.quickAllTrials()).toBeNull();
  });

  it('does nothing with no Quick-able Trial', () => {
    vi.useFakeTimers();
    vi.setSystemTime(SAT);
    const s = fresh();
    s.tickets = 5;
    expect(s.quickAllPlan()).toEqual([]);
    expect(s.quickAllTrials()).toBeNull();
    expect(s.tickets).toBe(5);
  });
});
