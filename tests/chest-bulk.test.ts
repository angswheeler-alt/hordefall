import { describe, expect, it } from 'vitest';
import { GameState } from '../src/state';
import { CHEST_BULK, CHEST_COST, CHEST_DROPS } from '../src/data';

function fresh() {
  GameState.frozen = false;
  localStorage.clear();
  return new GameState();
}

describe('Open 10 Hero Chests', () => {
  it('opens all ten at once and pays for all ten', () => {
    const s = fresh();
    s.gems = CHEST_COST * CHEST_BULK + 5;
    const drops = s.summon(CHEST_BULK);
    expect(drops).toHaveLength(CHEST_DROPS * CHEST_BULK);
    expect(s.gems).toBe(5);
    expect(s.stats.summons).toBe(CHEST_BULK);
    const total = drops!.reduce((n, d) => n + d.crests, 0);
    const owned = Object.values(s.crests).reduce((n, c) => n + c, 0);
    expect(owned).toBeGreaterThanOrEqual(total);
  });

  it('opens none when ten are not affordable', () => {
    const s = fresh();
    s.gems = CHEST_COST * CHEST_BULK - 1;
    expect(s.summon(CHEST_BULK)).toBeNull();
    expect(s.gems).toBe(CHEST_COST * CHEST_BULK - 1);
  });
});
