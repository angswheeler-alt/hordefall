import { describe, expect, it } from 'vitest';
import { RELICS } from '../src/data';

describe('relic prices', () => {
  const byStar = (n: number) => RELICS.filter((r) => r.stars === n).map((r) => r.craft);

  it('every star from 2★ costs more to craft than any relic a star below', () => {
    const top = Math.max(...RELICS.map((r) => r.stars));
    for (let n = 2; n <= top; n++) expect(Math.min(...byStar(n))).toBeGreaterThan(Math.max(...byStar(n - 1)));
  });

  it('4★ relics cost at least 400,000 Essence, so a pile of Trial Essence does not buy every set at once', () => {
    expect(Math.min(...byStar(4))).toBeGreaterThanOrEqual(400_000);
    expect(Math.min(...byStar(5))).toBeGreaterThanOrEqual(20_000_000);
  });
});
