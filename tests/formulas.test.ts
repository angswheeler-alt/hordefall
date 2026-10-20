import { describe, expect, it } from 'vitest';
import Decimal from 'break_infinity.js';
import { defended, bulkCost, enemyHp, fmt, upgradeCost, stallBulkCost, emberYield, emberCost, keeperLevel, keeperThreshold, relicCost, guildBossHp, guildBossAttemptCoins, guildBossKillCoins, researchPointsFor, researchRank } from '../src/formulas';
import { HEROES, STALLS, elementBoss, bossElement, bossLabel, stageBoss, bossWeakness, bossHasElement, bossImmuneTo, STRONG_VS } from '../src/data';

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

  it('relic costs double every two levels and scale with stars', () => {
    expect(relicCost(2, 1)).toBe(relicCost(0, 1) * 2);
    expect(relicCost(10, 4)).toBe(relicCost(10, 1) * 4);
  });
});

describe('Ember economy', () => {
  const levelsFor = (embers: number) => {
    let l = 0;
    while (embers >= emberCost(l)) embers -= emberCost(l++);
    return l;
  };

  it('a first Rekindle still buys a few dozen levels', () => {
    const l = levelsFor(emberYield(145, 125));
    expect(l).toBeGreaterThan(25);
    expect(l).toBeLessThan(50);
  });

  it("late Rekindles don't run away", () => {
    // A stage 300 Rekindle used to buy ~5,600 levels on a single hero.
    expect(levelsFor(emberYield(300, 125))).toBeLessThan(300);
    expect(levelsFor(emberYield(1000, 125))).toBeLessThan(1300);
  });

  it('each extra Rekindle stage buys less than one Ember level, so progress levels off', () => {
    // At 1.2 levels per stage every Rekindle went ~40% further than the last, without end.
    const gain = levelsFor(emberYield(1100, 125)) - levelsFor(emberYield(1000, 125));
    expect(gain).toBeLessThan(100);
    expect(gain).toBeGreaterThan(70);
  });

  it('Defense equal to a hit halves it and never blocks it fully', () => {
    expect(defended(new Decimal(100), new Decimal(100)).toNumber()).toBeCloseTo(50);
    expect(defended(new Decimal(100), new Decimal(0)).toNumber()).toBe(100);
    expect(defended(new Decimal(100), new Decimal(1e9)).toNumber()).toBeGreaterThan(0);
  });
});

describe('Guild Boss', () => {
  it('health matches the server formula in supabase/guilds.sql', () => {
    expect(guildBossHp(1).toNumber()).toBe(1221881);
    expect(guildBossHp(10).toNumber()).toBe(141557760000);
  });

  it('every attempt pays the base, and a full share doubles it', () => {
    const hp = guildBossHp(5);
    expect(guildBossAttemptCoins(5, new Decimal(0), hp)).toBe(15);
    expect(guildBossAttemptCoins(5, hp.div(30), hp)).toBe(23);
    expect(guildBossAttemptCoins(5, hp, hp)).toBe(30);
    expect(guildBossKillCoins(5)).toBe(75);
  });
});

describe('Guild Research ranks', () => {
  it('match the server costs', () => {
    expect(researchPointsFor(1)).toBe(300);
    expect(researchPointsFor(10)).toBe(115_500);
    expect(researchRank(299)).toBe(0);
    expect(researchRank(300)).toBe(1);
    expect(researchRank(1499)).toBe(1);
    expect(researchRank(1500)).toBe(2);
    expect(researchRank(1e9)).toBe(10);
  });
});

describe('named element bosses', () => {
  it('names each 100th-stage boss from 600 after its element', () => {
    expect(elementBoss(500)).toBeNull();
    expect(elementBoss(650)).toBeNull();
    expect(elementBoss(600)).toMatchObject({ name: 'Ignivar', element: 'fire' });
    expect(elementBoss(700)).toMatchObject({ name: 'Nerath', element: 'water' });
    expect(elementBoss(800)).toMatchObject({ name: 'Tharos', element: 'earth' });
    expect(elementBoss(900)).toMatchObject({ name: 'Nyxara', element: 'dark' });
    expect(elementBoss(1000)).toMatchObject({ name: 'Aureth', element: 'light' });
    expect(elementBoss(1100)).toMatchObject({ name: 'Ignivar', element: 'fire' });
    for (let s = 600; s <= 2000; s += 100) expect(elementBoss(s)!.element).toBe(bossElement(s));
  });

  it('has the five bosses take turns on every boss stage', () => {
    expect(bossLabel(900)).toBe('Nyxara, the Hollow Moon');
    expect([50, 100, 150, 200, 250, 300].map((s) => stageBoss(s).name)).toEqual(['Ignivar', 'Nerath', 'Tharos', 'Nyxara', 'Aureth', 'Ignivar']);
    expect(bossLabel(50)).toBe('Ignivar, the Ashen Colossus');
    for (let s = 600; s <= 2000; s += 100) expect(stageBoss(s).art).toBe(bossElement(s));
  });

  it('gives bosses no element before stage 600, and their own after', () => {
    for (let s = 50; s < 600; s += 50) {
      expect(bossHasElement(s)).toBe(false);
      expect(bossWeakness(s)).toBeNull();
    }
    for (let s = 600; s <= 2000; s += 50) {
      expect(bossHasElement(s)).toBe(true);
      expect(bossElement(s)).toBe(stageBoss(s).art);
      expect(STRONG_VS[bossWeakness(s)!]).toBe(bossElement(s));
    }
  });
});

describe('element-locked bosses (stage 600+)', () => {
  const ALL = ['water', 'fire', 'earth', 'light', 'dark'] as const;
  it('anyone can hurt bosses before 600', () => {
    for (const e of ALL) expect(bossImmuneTo(550, e)).toBe(false);
  });
  it('from 600 only the counter element hurts the boss', () => {
    // Fire boss: only Water. Water: only Earth. Earth: only Fire. Dark: only Light. Light: only Dark.
    const only = { fire: 'water', water: 'earth', earth: 'fire', dark: 'light', light: 'dark' } as const;
    for (let s = 600; s <= 1500; s += 50) {
      const counter = only[bossElement(s)];
      for (const e of ALL) expect(bossImmuneTo(s, e)).toBe(e !== counter);
      expect(bossImmuneTo(s, null)).toBe(true);
    }
    expect(bossImmuneTo(600, 'water')).toBe(false);
    expect(bossImmuneTo(600, 'fire')).toBe(true);
  });
});
