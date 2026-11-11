import { describe, expect, it } from 'vitest';
import { RELICS } from '../src/data';

// 2026-11-11 (Samuel): 7★ and 8★ relics were slowed so 8★ opens around month 10 for a regular player.
describe('top relic prices', () => {
  const craft = (stars: number) => [...new Set(RELICS.filter((r) => r.stars === stars).map((r) => r.craft))];

  it('7★ relics craft for 6 billion and 8★ for 50 billion Essence', () => {
    expect(craft(7)).toEqual([6_000_000_000]);
    expect(craft(8)).toEqual([50_000_000_000]);
  });

  it('each star still costs more than the one below', () => {
    for (let s = 2; s <= 8; s++) expect(Math.min(...craft(s))).toBeGreaterThan(Math.max(...craft(s - 1)));
  });
});
