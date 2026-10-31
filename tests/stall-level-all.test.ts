import { describe, it, expect } from 'vitest';
import Decimal from 'break_infinity.js';
import { GameState } from '../src/state';
import { STALLS } from '../src/data';
import { stallUpgradeCost } from '../src/formulas';

describe('Market Level all', () => {
  it('opens the next Stalls it can afford, then levels the row', () => {
    GameState.frozen = false;
    localStorage.clear();
    const s = new GameState();
    for (const d of STALLS) s.stalls[d.id].level = 0;
    s.stalls[STALLS[0].id].level = 5;
    const mult = s.stallCostMult();
    const open2 = stallUpgradeCost(STALLS[1], 0, mult).plus(stallUpgradeCost(STALLS[2], 0, mult));
    // Enough for Stalls 2 and 3 plus a little, never enough for Stall 4.
    s.gold = open2.plus(stallUpgradeCost(STALLS[0], 5, mult).times(1.01));
    expect(s.gold.lt(open2.plus(stallUpgradeCost(STALLS[3], 0, mult)))).toBe(true);
    expect(s.levelAllStalls()).toBeGreaterThanOrEqual(3);
    expect(s.stalls[STALLS[1].id].level).toBeGreaterThan(0);
    expect(s.stalls[STALLS[2].id].level).toBeGreaterThan(0);
    expect(s.stalls[STALLS[3].id].level).toBe(0);
    expect(s.gold.gte(0)).toBe(true);
  });

  it('does nothing when the next Stall and every level are too dear', () => {
    GameState.frozen = false;
    localStorage.clear();
    const s = new GameState();
    for (const d of STALLS) s.stalls[d.id].level = 0;
    s.gold = new Decimal(0);
    expect(s.levelAllStalls()).toBe(0);
    expect(STALLS.every((d) => s.stalls[d.id].level === 0)).toBe(true);
  });
});
