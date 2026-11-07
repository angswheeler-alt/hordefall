import { beforeEach, describe, expect, it } from 'vitest';
import Decimal from 'break_infinity.js';
import { GameState, bigLoad, bigSave } from '../src/state';
import { emberBulk, emberCost, emberYield, keeperLevel, keeperThreshold } from '../src/formulas';

beforeEach(() => localStorage.clear());

describe('Embers past the Number limit', () => {
  it('ember costs, payouts and keeper levels stay finite far past 1e308', () => {
    expect(emberCost(20000).isFinite()).toBe(true);
    expect(emberCost(20000).gt('1e500')).toBe(true);
    expect(emberYield(20000, 125).isFinite()).toBe(true);
    expect(emberYield(20000, 125).gt('1e308')).toBe(true);
    const lvl = keeperLevel(new Decimal('1e5000'));
    expect(Number.isFinite(lvl)).toBe(true);
    expect(new Decimal('1e5000').gte(keeperThreshold(lvl - 1))).toBe(true);
    expect(new Decimal('1e5000').lt(keeperThreshold(lvl))).toBe(true);
    for (const n of [0, 99, 100, 199, 200, 12345, 1e9]) {
      let slow = 1;
      while (n >= keeperThreshold(slow).toNumber()) slow++;
      expect(keeperLevel(n)).toBe(slow);
    }
  });

  it('a huge Ember wallet still buys levels', () => {
    const r = emberBulk(15000, 'max', emberCost(15000).times(3));
    expect(r.levels).toBeGreaterThan(0);
    expect(r.cost.isFinite()).toBe(true);
  });

  it('saves small amounts as plain numbers and huge ones as text', () => {
    expect(bigSave(new Decimal(1234))).toBe(1234);
    expect(typeof bigSave(new Decimal('1e400'))).toBe('string');
    expect(bigLoad('1e400').eq(new Decimal('1e400'))).toBe(true);
    expect(bigLoad(77).toNumber()).toBe(77);
    expect(bigLoad(null).toNumber()).toBe(0);
    expect(bigLoad(-5).toNumber()).toBe(0);
    expect(bigLoad('junk').toNumber()).toBe(0);
    expect(bigLoad(Infinity).toNumber()).toBe(0);
  });

  it('an old save with number Embers loads unchanged, a huge wallet round-trips', () => {
    const s = new GameState();
    s.embers = new Decimal(321);
    expect(typeof s.toJSON().embers).toBe('number');

    s.embers = new Decimal('3.5e900');
    s.lifetimeEmbers = new Decimal('7e900');
    s.save();
    const t = new GameState();
    expect(t.load()).toBe(true);
    expect(t.embers.eq(new Decimal('3.5e900'))).toBe(true);
    expect(t.lifetimeEmbers.eq(new Decimal('7e900'))).toBe(true);
    expect(Number.isFinite(t.keeperLevel())).toBe(true);
  });
});
