import { describe, expect, it } from 'vitest';
import { isAscendant } from '../src/heroes/ascendant';
import { GameState } from '../src/state';
import { HEROES, UNLOCK_CRESTS, RAISED_RARITY_OLD_COST, type Element } from '../src/data';

function fresh() {
  GameState.frozen = false;
  localStorage.clear();
  return new GameState();
}

describe('rarity mix', () => {
  it('every element has more Rares than Commons or Epics', () => {
    for (const el of ['water', 'fire', 'earth', 'light', 'dark'] as Element[]) {
      const n = (r: string) => HEROES.filter((h) => h.element === el && h.rarity === r && !isAscendant(h.id)).length;
      expect(n('common')).toBeLessThanOrEqual(6);
      expect(n('rare')).toBeGreaterThan(n('common'));
      expect(n('rare')).toBeGreaterThan(n('epic'));
    }
  });

  it('raised heroes really are rarer now, and the starter stays free', () => {
    for (const [id, old] of Object.entries(RAISED_RARITY_OLD_COST)) {
      const h = HEROES.find((x) => x.id === id)!;
      expect(h.rarity === 'rare' || h.rarity === 'epic').toBe(true);
      expect(UNLOCK_CRESTS[h.rarity as 'rare' | 'epic']).toBeGreaterThan(old);
    }
    const s = fresh();
    expect(s.unlockCrests(HEROES.find((h) => h.id === 'brine')!)).toBe(0);
  });

  it('an old save unlocks a locked raised hero that already had its old unlock cost', () => {
    fresh();
    localStorage.setItem('hordefall-save-v1', JSON.stringify({ gold: '0', levels: { brine: 5 }, crests: { flint: 14, ember: 9, nyx: 30, fern: 3 } }));
    const s = new GameState();
    s.load();
    expect(s.levels.flint).toBe(1);
    expect(s.crests.flint).toBe(4);
    expect(s.levels.nyx).toBe(1);
    expect(s.crests.nyx).toBe(0);
    expect(s.levels.ember ?? 0).toBe(0);
    expect(s.crests.ember).toBe(9);
    expect(s.levels.fern ?? 0).toBe(0);
  });

  it('runs only once: a save made after the change keeps the new costs', () => {
    fresh();
    localStorage.setItem('hordefall-save-v1', JSON.stringify({ gold: '0', levels: { brine: 5 }, crests: { flint: 14 }, rarityMix: 1 }));
    const s = new GameState();
    s.load();
    expect(s.levels.flint ?? 0).toBe(0);
    expect(s.crests.flint).toBe(14);
  });
});
