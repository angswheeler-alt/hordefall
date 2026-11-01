import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameState } from '../src/state';
import { MONTHLY_CREST_PACK } from '../src/data';

const at = (m: number, d: number, h = 12) => new Date(2026, m - 1, d, h).getTime();

let s: GameState;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(at(11, 1));
  localStorage.clear();
  s = new GameState();
  s.gems = 10_000;
});
afterEach(() => vi.useRealTimers());

describe('Monthly Crest Pack', () => {
  it('trades Gems for Wild Crests once a month', () => {
    const now = at(11, 3);
    expect(s.monthlyPackState(now).bought).toBe(false);
    expect(s.buyMonthlyPack(now)).toBe(true);
    expect(s.gems).toBe(10_000 - MONTHLY_CREST_PACK.gems);
    expect(s.wildCrests).toBe(MONTHLY_CREST_PACK.wild);
    expect(s.buyMonthlyPack(at(11, 30))).toBe(false);
    expect(s.wildCrests).toBe(MONTHLY_CREST_PACK.wild);
    expect(s.monthlyPackState(at(11, 30)).endsAt).toBe(new Date(2026, 11, 1).getTime());
    expect(s.buyMonthlyPack(at(12, 1))).toBe(true);
    expect(s.wildCrests).toBe(2 * MONTHLY_CREST_PACK.wild);
  });

  it('needs enough Gems and spends nothing otherwise', () => {
    s.gems = MONTHLY_CREST_PACK.gems - 1;
    expect(s.buyMonthlyPack(at(11, 3))).toBe(false);
    expect(s.gems).toBe(MONTHLY_CREST_PACK.gems - 1);
    expect(s.wildCrests).toBe(0);
  });

  it('remembers the purchase after a reload', () => {
    s.buyMonthlyPack(at(11, 3));
    s.save();
    const t = new GameState();
    expect(t.load()).toBe(true);
    expect(t.monthlyPackState(at(11, 20)).bought).toBe(true);
    expect(t.monthlyPackState(at(12, 2)).bought).toBe(false);
  });
});
