import { beforeEach, describe, expect, it } from 'vitest';
import { GameState } from '../src/state';
import { HEROES, STAR_EMBER_BONUS } from '../src/data';
import { EMBER_COST_GROWTH, RARITY_STAT_MULT, heroAtk, heroHp } from '../src/formulas';

beforeEach(() => localStorage.clear());

describe('late-game pace (economy audit 2026-11-07)', () => {
  it('Ember levels cost 6.8% more each', () => {
    expect(EMBER_COST_GROWTH).toBe(1.068);
  });

  it('rarer heroes get bigger base ATK and HP', () => {
    const c = HEROES.find((h) => h.rarity === 'common')!;
    const e = { ...c, rarity: 'epic' as const };
    expect(heroAtk(e, 50).div(heroAtk(c, 50)).toNumber()).toBeCloseTo(RARITY_STAT_MULT.epic, 6);
    expect(heroHp(e, 50).div(heroHp(c, 50)).toNumber()).toBeCloseTo(RARITY_STAT_MULT.epic, 6);
  });

  it('stars make Ember levels count more, rounded down', () => {
    const s = new GameState();
    const id = HEROES.find((h) => h.unlockCost === 0)!.id;
    s.emberLevels[id] = 1000;
    s.stars[id] = 0;
    expect(s.starEmberLevels(id)).toBe(1000);
    s.stars[id] = 6;
    expect(s.starEmberLevels(id)).toBe(Math.floor(1000 * (1 + 6 * STAR_EMBER_BONUS)));
    expect(s.heroLevel(id)).toBeGreaterThanOrEqual(1030);
  });
});
