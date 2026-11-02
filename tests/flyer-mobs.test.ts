import { describe, it, expect } from 'vitest';
import { MOB_KINDS } from '../src/mobs';
import { enemyGoal, flyerVictim } from '../src/reach';

const flyer = { x: 400, range: MOB_KINDS.flyer.range, flying: true };
const hero = (x: number, extra: { flying?: boolean; alive?: boolean } = {}) => ({ x, alive: true, ...extra });

describe('flying mobs never turn back', () => {
  it('hits a hero that has already flown or walked past it while it is in reach', () => {
    const past = hero(flyer.x + flyer.range - 1);
    expect(flyerVictim(flyer, [past])).toBe(past);
  });

  it('prefers a hero in front of it when one is in reach too', () => {
    const front = hero(flyer.x - 5);
    const past = hero(flyer.x + 20);
    expect(flyerVictim(flyer, [past, front])).toBe(front);
  });

  it('has no victim once every hero is out of reach, front or behind', () => {
    expect(flyerVictim(flyer, [hero(flyer.x + flyer.range + 1), hero(flyer.x - flyer.range - 1)])).toBeUndefined();
    expect(flyerVictim(flyer, [hero(flyer.x + 5, { alive: false })])).toBeUndefined();
  });

  it('always heads for the heroes’ crystal, even with heroes behind it', () => {
    expect(enemyGoal(flyer, hero(flyer.x + 200), undefined, false)).toBe(-Infinity);
    expect(enemyGoal(flyer, hero(flyer.x + 200), undefined, true)).toBe(-Infinity);
    expect(enemyGoal(flyer, undefined, undefined, false)).toBe(-Infinity);
  });

  it('walking mobs still turn back for a hero behind them, or wait under a flyer', () => {
    const grunt = { x: 400, range: 22 };
    expect(enemyGoal(grunt, hero(500), undefined, false)).toBeGreaterThan(grunt.x);
    expect(enemyGoal(grunt, undefined, 450, false)).toBe(450);
    expect(enemyGoal(grunt, undefined, 450, true)).toBe(-Infinity);
  });
});
