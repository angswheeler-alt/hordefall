import { describe, it, expect } from 'vitest';
import { HEROES, byRarity, heroRank } from '../src/data';
import { UNIQUE_HEROES } from '../src/arenaShop';

describe('Unique rank', () => {
  it('every one-of-a-kind hero shows the Unique rank, and only they do', () => {
    const uniques = HEROES.filter((h) => heroRank(h) === 'unique').map((h) => h.id).sort();
    expect(uniques).toEqual([...UNIQUE_HEROES].sort());
  });

  it('keeps their rarity for costs', () => {
    for (const id of UNIQUE_HEROES) expect(HEROES.find((h) => h.id === id)!.rarity).toBe('epic');
  });

  it('sorts Unique heroes after Legendaries', () => {
    const sorted = byRarity(HEROES);
    const firstUnique = sorted.findIndex((h) => h.unique);
    expect(sorted.slice(firstUnique).every((h) => h.unique)).toBe(true);
    expect(sorted.slice(0, firstUnique).some((h) => h.rarity === 'legendary')).toBe(true);
  });
});
