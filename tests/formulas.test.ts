import { describe, expect, it } from 'vitest';
import Decimal from 'break_infinity.js';
import { bulkCost, enemyHp, fmt, upgradeCost, stallBulkCost, emberYield, keeperLevel, keeperThreshold, relicCost } from '../src/formulas';
import { HEROES, STALLS } from '../src/data';

const hero = HEROES.find((h) => h.unlockCost !== 0)!;

describe('formatting', () => {
  it('formats small, suffixed and huge numbers', () => {
    expect(fmt(0)).toBe('0');
    expect(fmt(2.5)).toBe('2.5');
    expect(fmt(999)).toBe('999');
    expect(fmt(1500)).toBe('1.50K');
    expect(fmt(new Decimal('1e36'))).toMatch(/^\d/);
    expect(fmt(new Decimal('1e300'))).toBe('1.00e300');
  });
});

describe('bulk buying', () => {
  it('max buys exactly what is affordable', () => {
    const gold = new Decimal(1e6);
    const { levels, cost } = bulkCost(hero, 10, 'max', gold);
    expect(cost.lte(gold)).toBe(true);
    expect(cost.plus(upgradeCost(hero, 10 + levels)).gt(gold)).toBe(true);
  });

  it('x10 costs the sum of ten single levels', () => {
    let sum = new Decimal(0);
    for (let l = 5; l < 15; l++) sum = sum.plus(upgradeCost(hero, l));
    expect(bulkCost(hero, 5, 10, new Decimal(0)).cost.toString()).toBe(sum.toString());
  });

  it('opening a stall buys exactly one level', () => {
    expect(stallBulkCost(STALLS[0], 0, 'max', new Decimal(1e30)).levels).toBe(1);
  });
});

describe('progression curves', () => {
  it('enemy HP keeps growing and stays finite to stage 5000', () => {
    let prev = enemyHp(1);
    for (let s = 2; s <= 5000; s += 7) {
      const hp = enemyHp(s);
      expect(hp.gt(prev)).toBe(true);
      prev = hp;
    }
  });

  it('Rekindle pays nothing at or below the Rekindle stage', () => {
    expect(emberYield(125, 125)).toBe(0);
    expect(emberYield(126, 125)).toBeGreaterThan(0);
  });

  it('Keeper levels follow the thresholds', () => {
    expect(keeperLevel(0)).toBe(1);
    expect(keeperLevel(keeperThreshold(1))).toBe(2);
  });

  it('relic tier steps cost three times as much', () => {
    expect(relicCost(10, 10)).toBe(Math.round(20 * Math.pow(2, 5)) * 3);
  });
});
