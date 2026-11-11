import { beforeEach, describe, expect, it } from 'vitest';
import { GameState } from '../src/state';
import { HEROES, SPEED_UNLOCK_STAGE } from '../src/data';

beforeEach(() => localStorage.clear());

describe('First ten minutes', () => {
  it('switches 2x speed on by itself the first time it unlocks, early', () => {
    const s = new GameState();
    expect(SPEED_UNLOCK_STAGE).toBeLessThanOrEqual(10);
    expect(s.speed2x).toBe(false);
    s.reachStage(SPEED_UNLOCK_STAGE - 1);
    expect(s.speed2x).toBe(false);
    s.reachStage(SPEED_UNLOCK_STAGE);
    expect(s.speed2x).toBe(true);
    // Turned off later, it stays off.
    s.speed2x = false;
    s.reachStage(SPEED_UNLOCK_STAGE + 5);
    expect(s.speed2x).toBe(false);
  });

  it('Heroes tab Power climbs with gold levels while Combat Power stays put', () => {
    const s = new GameState();
    const def = HEROES.find((h) => (s.levels[h.id] ?? 0) > 0)!;
    const cp = s.heroCombatPower(def);
    const power = s.heroLivePower(def);
    s.levels[def.id] += 10;
    expect(s.heroLivePower(def).gt(power)).toBe(true);
    expect(s.heroCombatPower(def).eq(cp)).toBe(true);
  });
});
