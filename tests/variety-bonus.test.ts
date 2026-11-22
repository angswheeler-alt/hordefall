import { describe, expect, it } from 'vitest';
import { GameState } from '../src/state';
import { HEROES, VARIETY_BONUS_PER_TYPE } from '../src/data';
import { mulEffect, varietyTypes } from '../src/skills';

/** A fresh save fighting with exactly these heroes (recruited, 1★, so no star skills get in the way). */
function teamOf(ids: string[]): GameState {
  const s = new GameState();
  for (const id of ids) { s.levels[id] = 1; s.stars[id] = 0; }
  s.skillTeam = new Set(ids);
  return s;
}
const atkMult = (s: GameState, id: string) => mulEffect(s.effects(), 'atk', id);

describe('Variety bonus', () => {
  it('counts each different Type once', () => {
    const s = teamOf(['glimmer', 'boneswords', 'brine', 'barnacle']); // Rogue, Rogue, Samurai, Knight
    expect(varietyTypes((id, st) => s.hasStar(id, st)).sort()).toEqual(['Knight', 'Rogue', 'Samurai']);
  });

  it('gives the whole team +4% ATK per Type', () => {
    expect(VARIETY_BONUS_PER_TYPE).toBe(0.04);
    const one = teamOf(['glimmer', 'boneswords']);
    expect(atkMult(one, 'glimmer')).toBeCloseTo(1.04, 6);
    const three = teamOf(['glimmer', 'boneswords', 'brine', 'barnacle']);
    expect(atkMult(three, 'glimmer')).toBeCloseTo(1.12, 6);
    expect(atkMult(three, 'barnacle')).toBeCloseTo(1.12, 6);
  });

  it('raises team ATK in hero stats, so a mixed team hits harder than a single-Type one', () => {
    const mono = teamOf(['glimmer', 'boneswords']);
    const mixed = teamOf(['glimmer', 'brine']);
    const atk = (s: GameState) => s.heroStats(HEROES.find((h) => h.id === 'glimmer')!, 10).atk.value.toNumber();
    expect(atk(mixed) / atk(mono)).toBeCloseTo(1.08 / 1.04, 4);
  });

  it('is nothing for an empty team', () => {
    expect(varietyTypes(() => false)).toEqual([]);
  });
});
