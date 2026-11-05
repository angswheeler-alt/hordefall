import { beforeEach, describe, expect, it } from 'vitest';
import { GameState } from '../src/state';
import { HEROES } from '../src/data';
import { moveItem, dropIndex } from '../src/teamDrag';

const recruits = HEROES.filter((h) => h.rarity !== 'legendary').slice(0, 5);

beforeEach(() => localStorage.clear());

function team() {
  const s = new GameState();
  s.teamSlots = 4;
  for (const h of HEROES) s.levels[h.id] = 0;
  recruits.forEach((h, i) => {
    s.levels[h.id] = 5;
    if (i === 4) s.benched[h.id] = true;
  });
  return s;
}
const ids = (s: GameState) => s.lineupOrdered().map((h) => h.id);

describe('team order', () => {
  it('starts in roster order', () => {
    expect(ids(team())).toEqual(recruits.slice(0, 4).map((h) => h.id));
  });

  it('follows the order the player sets, and keeps the lineup itself the same', () => {
    const s = team();
    const [a, b, c, d] = recruits;
    s.setTeamOrder([c.id, a.id, d.id, b.id]);
    expect(ids(s)).toEqual([c.id, a.id, d.id, b.id]);
    expect(s.pvpTeam().map((h) => h.id).sort()).toEqual([a.id, b.id, c.id, d.id].sort());
  });

  it('heroes missing from the order go last; benched heroes are ignored', () => {
    const s = team();
    const [a, b, c, d, e] = recruits;
    s.setTeamOrder([d.id, e.id, b.id]);
    expect(ids(s)).toEqual([d.id, b.id, a.id, c.id]);
  });

  it('a hero swapped in takes the place of the one going out', () => {
    const s = team();
    const [a, b, c, d, e] = recruits;
    s.setTeamOrder([d.id, c.id, b.id, a.id]);
    s.swapInLineup(e.id, c.id);
    expect(ids(s)).toEqual([d.id, e.id, b.id, a.id]);
  });

  it('is kept in the save', () => {
    const s = team();
    const [a, b, c, d] = recruits;
    s.setTeamOrder([b.id, d.id, a.id, c.id]);
    s.save();
    const t = new GameState();
    t.load();
    expect(t.teamOrder).toEqual([b.id, d.id, a.id, c.id]);
    expect(ids(t)).toEqual([b.id, d.id, a.id, c.id]);
  });

  it('a damaged saved order is cleaned on load', () => {
    const s = team();
    s.teamOrder = ['nobody', recruits[1].id, recruits[1].id] as string[];
    s.save();
    const t = new GameState();
    t.load();
    expect(t.teamOrder).toEqual([recruits[1].id]);
  });
});

describe('drag helpers', () => {
  it('moves one item', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c']);
    expect(moveItem(['a', 'b'], 1, 1)).toEqual(['a', 'b']);
  });

  it('finds the drop spot from the pointer', () => {
    const centers = [26, 82, 138, 194];
    expect(dropIndex(centers, 0, 10)).toBe(0);
    expect(dropIndex(centers, 0, 150)).toBe(2);
    expect(dropIndex(centers, 3, 90)).toBe(2);
    expect(dropIndex(centers, 3, 300)).toBe(3);
  });
});
