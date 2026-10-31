import { describe, expect, it } from 'vitest';
import { GameState } from '../src/state';
import { HERO_SHOP_REFRESH_MINUTES } from '../src/data';

const NOW = Date.UTC(2026, 9, 22, 12);

function fresh() {
  GameState.frozen = false;
  localStorage.clear();
  return new GameState();
}

describe('Shop red dot', () => {
  it('ignores Gems on hand and lights for a new Hero Shop set until the Shop is opened', () => {
    const s = fresh();
    s.gems = 100_000;
    expect(s.shopWaiting(NOW)).toBe(true);
    s.seeHeroShop(NOW);
    expect(s.shopWaiting(NOW)).toBe(false);
    const later = NOW + HERO_SHOP_REFRESH_MINUTES * 60_000 + 1;
    expect(s.shopWaiting(later)).toBe(true);
    s.seeHeroShop(later);
    expect(s.shopWaiting(later)).toBe(false);
  });

  it('leaves Gem goals to the Home tab (Goals), not the Shop', () => {
    const s = fresh();
    s.seeHeroShop(NOW);
    s.reachStage(60);
    expect(s.rewardsWaiting()).toBe(true);
    expect(s.shopWaiting(NOW)).toBe(false);
    expect(s.goalsWaiting()).toBe(true);
    expect(s.homeWaiting(NOW)).toBe(true);
  });

  it('splits the Home dot into Today and Goals', () => {
    const s = fresh();
    // A fresh save has today's login and free spin waiting, but no goal yet.
    expect(s.todayWaiting(NOW)).toBe(true);
    expect(s.goalsWaiting()).toBe(false);
    expect(s.homeWaiting(NOW)).toBe(true);
  });

  it('keeps the seen set across a save and load', () => {
    const s = fresh();
    s.seeHeroShop(NOW);
    s.save();
    const t = new GameState();
    expect(t.load()).toBe(true);
    expect(t.shopWaiting(NOW)).toBe(false);
  });
});
