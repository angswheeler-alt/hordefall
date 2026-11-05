import { describe, expect, it } from 'vitest';
import { GameState } from '../src/state';
import { emberYield } from '../src/formulas';
import { REKINDLE_STAGE } from '../src/data';

function fresh() {
  GameState.frozen = false;
  localStorage.clear();
  return new GameState();
}

describe('Rekindle short of the record', () => {
  it('pays by this run, softened toward the lifetime best', () => {
    const s = fresh();
    s.reachStage(400);
    s.runBestStage = 370;
    s.stage = 370;
    const keeper = s.keeperBonus();
    expect(s.pendingEmbers()).toBe(emberYield(370, REKINDLE_STAGE, keeper, 400));
    expect(s.pendingEmbers()).toBeGreaterThan(emberYield(370, REKINDLE_STAGE, keeper));
  });

  it('counts the team Ember levels a payout buys', () => {
    const s = fresh();
    s.embers = 0;
    expect(s.emberLevelsAffordable(0)).toBe(0);
    const some = s.emberLevelsAffordable(1000);
    expect(some).toBeGreaterThan(0);
    expect(s.emberLevelsAffordable(100000)).toBeGreaterThan(some);
  });
});
