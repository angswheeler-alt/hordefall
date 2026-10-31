import { describe, expect, it } from 'vitest';
import { GameState } from '../src/state';
import { HEROES } from '../src/data';
import { emberCost } from '../src/formulas';

function fresh() {
  GameState.frozen = false;
  localStorage.clear();
  return new GameState();
}

describe('Ember all', () => {
  it('spends Embers on the team, cheapest next level first, and leaves benched heroes alone', () => {
    const s = fresh();
    const [a, b, c] = HEROES.slice(0, 3).map((h) => h.id);
    for (const id of [a, b, c]) s.levels[id] = 10;
    s.benched[c] = true;
    s.emberLevels[a] = 20;
    s.embers = 500;
    const got = s.emberAll();
    expect(got.levels).toBeGreaterThan(0);
    expect(got.spent).toBe(500 - s.embers);
    // Nothing left that the cheapest team hero could buy.
    const team = [a, b].filter((id) => s.inLineup(id));
    expect(Math.min(...team.map((id) => emberCost(s.emberLevels[id] ?? 0)))).toBeGreaterThan(s.embers);
    // The hero that started behind caught up to within one level.
    expect(Math.abs((s.emberLevels[a] ?? 0) - (s.emberLevels[b] ?? 0))).toBeLessThanOrEqual(1);
    expect(s.emberLevels[c] ?? 0).toBe(0);
    expect(s.canEmberAll()).toBe(false);
  });

  it('buys nothing without Embers', () => {
    const s = fresh();
    s.embers = 0;
    expect(s.canEmberAll()).toBe(false);
    expect(s.emberAll()).toEqual({ levels: 0, spent: 0, heroes: 0 });
  });
});
