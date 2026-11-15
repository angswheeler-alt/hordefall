import { describe, expect, it } from 'vitest';
import { HEROES, byRarity, heroRank, type Rank } from '../src/data';

const rank: Record<Rank, number> = { common: 0, rare: 1, epic: 2, legendary: 3, unique: 4 };

describe('Collection order', () => {
  it('lists Commons first, then Rares, Epics, Legendaries and Uniques within each element', () => {
    for (const el of new Set(HEROES.map((h) => h.element))) {
      const list = byRarity(HEROES.filter((h) => h.element === el));
      for (let i = 1; i < list.length; i++) expect(rank[heroRank(list[i])]).toBeGreaterThanOrEqual(rank[heroRank(list[i - 1])]);
    }
  });

  it('keeps heroes of the same rarity in their usual order', () => {
    const rares = HEROES.filter((h) => h.rarity === 'rare');
    expect(byRarity(rares).map((h) => h.id)).toEqual(rares.map((h) => h.id));
  });
});
