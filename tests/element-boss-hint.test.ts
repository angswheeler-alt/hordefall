import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../src/state';
import { HEROES, bossWeakness } from '../src/data';

beforeEach(() => localStorage.clear());

describe('element boss hint', () => {
  it('names the missing element only on element boss stages the lineup cannot hurt', () => {
    const s = new GameState();
    const owned = HEROES.filter((h) => s.inLineup(h.id));
    const weak = bossWeakness(700)!;
    const hasWeak = owned.some((h) => h.element === weak);
    expect(s.missingBossElement(700)).toBe(hasWeak ? null : weak);
    expect(s.missingBossElement(650)).toBeNull();
    expect(s.missingBossElement(699)).toBeNull();
    const helper = HEROES.find((h) => h.element === weak)!;
    s.levels[helper.id] = 1;
    delete s.benched[helper.id];
    expect(s.missingBossElement(700)).toBeNull();
  });
});
