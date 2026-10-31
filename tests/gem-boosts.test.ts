import { beforeEach, describe, expect, it } from 'vitest';
import { GameState } from '../src/state';
import { HOURGLASS_GEMS, HOURGLASS_MINUTES, HOURGLASS_PER_DAY, GOLD_BOOST_GEMS, GOLD_BOOST_MINUTES, GOLD_BOOST_MAX_MINUTES, GOLD_BOOST_MULT } from '../src/data';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 21, 12);

describe('Hourglass', () => {
  let s: GameState;
  beforeEach(() => { localStorage.clear(); s = new GameState(); s.gems = 10_000; });

  it('pays the gold of its minutes and costs Gems', () => {
    const want = s.goldFor(HOURGLASS_MINUTES);
    const before = s.gold;
    const got = s.useHourglass(NOW);
    expect(got?.toString()).toBe(want.toString());
    expect(s.gold.minus(before).toString()).toBe(want.toString());
    expect(s.gems).toBe(10_000 - HOURGLASS_GEMS);
  });

  it('stops after the daily limit and comes back the next day', () => {
    for (let i = 0; i < HOURGLASS_PER_DAY; i++) expect(s.useHourglass(NOW)).not.toBeNull();
    expect(s.hourglassesLeft(NOW)).toBe(0);
    expect(s.useHourglass(NOW)).toBeNull();
    expect(s.hourglassesLeft(NOW + DAY)).toBe(HOURGLASS_PER_DAY);
    expect(s.useHourglass(NOW + DAY)).not.toBeNull();
  });

  it('needs enough Gems', () => {
    s.gems = HOURGLASS_GEMS - 1;
    expect(s.useHourglass(NOW)).toBeNull();
    expect(s.gems).toBe(HOURGLASS_GEMS - 1);
  });
});

describe('Gold Boost', () => {
  let s: GameState;
  beforeEach(() => { localStorage.clear(); s = new GameState(); s.gems = 10_000; });

  it('multiplies gold only while running', () => {
    const base = s.goldBoostMult(NOW);
    expect(s.buyGoldBoost(NOW)).toBe(true);
    expect(s.goldBoostMult(NOW)).toBe(base * GOLD_BOOST_MULT);
    expect(s.goldBoostMult(NOW + GOLD_BOOST_MINUTES * 60_000 + 1)).toBe(base);
  });

  it('stacks up to the cap', () => {
    const fits = GOLD_BOOST_MAX_MINUTES / GOLD_BOOST_MINUTES;
    for (let i = 0; i < fits; i++) expect(s.buyGoldBoost(NOW)).toBe(true);
    expect(s.goldBoostUntil).toBe(NOW + GOLD_BOOST_MAX_MINUTES * 60_000);
    expect(s.buyGoldBoost(NOW)).toBe(false);
    expect(s.gems).toBe(10_000 - fits * GOLD_BOOST_GEMS);
  });

  it('survives a save', () => {
    s.buyGoldBoost(NOW);
    s.useHourglass(NOW);
    s.save();
    const t = new GameState();
    expect(t.load()).toBe(true);
    expect(t.goldBoostUntil).toBe(s.goldBoostUntil);
    expect(t.hourglassesLeft(NOW)).toBe(HOURGLASS_PER_DAY - 1);
  });
});
