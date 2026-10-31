import { beforeEach, describe, expect, it } from 'vitest';
import { GameState } from '../src/state';
import { HEROES, elementMultiplier } from '../src/data';
import { guildBossElement, utcWeekStart } from '../src/formulas';
import { sortHeroes, nextTeamSort, TEAM_SORTS } from '../src/teamSort';

const starter = HEROES.find((h) => h.unlockCost === 0)!;
const others = HEROES.filter((h) => h.id !== starter.id && h.rarity !== 'legendary').slice(0, 8);

beforeEach(() => localStorage.clear());

/** A save with the starter plus eight more heroes; the first `inTeam` of them in the lineup. */
function roster(inTeam: number) {
  const s = new GameState();
  s.teamSlots = 3;
  others.forEach((h, i) => {
    s.levels[h.id] = 10 + i * 10;
    if (i >= inTeam) s.benched[h.id] = true;
  });
  return s;
}

describe('quick swap', () => {
  it('swaps a benched hero in for a team member in one step, refunding the one going out', () => {
    const s = roster(2);
    const [a, , c] = others;
    expect(s.lineupCount()).toBe(3);
    const spent = s.goldSpent(a.id);
    const before = s.gold;
    const refund = s.swapInLineup(c.id, a.id)!;
    expect(refund.toString()).toBe(spent.toString());
    expect(s.gold.toString()).toBe(before.plus(spent).toString());
    expect(s.inLineup(c.id)).toBe(true);
    expect(s.inLineup(a.id)).toBe(false);
    expect(s.levels[a.id]).toBe(1);
    expect(s.lineupCount()).toBe(3);
  });

  it('the hero coming in takes over the Ultimate pick', () => {
    const s = roster(2);
    const [a, b, c] = others;
    s.ultPicks = [b.id, a.id];
    s.swapInLineup(c.id, a.id);
    expect(s.ultPicks).toEqual([b.id, c.id]);
  });

  it('refuses swaps that make no sense', () => {
    const s = roster(2);
    const [a, b, c] = others;
    const locked = HEROES.find((h) => (s.levels[h.id] ?? 0) === 0)!;
    expect(s.swapInLineup(b.id, a.id)).toBeNull(); // already in
    expect(s.swapInLineup(c.id, others[4].id)).toBeNull(); // not in the team
    expect(s.swapInLineup(locked.id, a.id)).toBeNull(); // not recruited
  });
});

describe('best team', () => {
  it('picks the strongest heroes by Combat Power, at most the team slots', () => {
    const s = roster(2);
    const ids = s.bestTeamIds('stage');
    expect(ids.length).toBe(s.teamSlots);
    const owned = HEROES.filter((h) => (s.levels[h.id] ?? 0) > 0);
    const cut = Math.min(...ids.map((id) => s.heroCombatPower(HEROES.find((h) => h.id === id)!).toNumber()));
    for (const h of owned) if (!ids.includes(h.id)) expect(s.heroCombatPower(h).toNumber()).toBeLessThanOrEqual(cut);
  });

  it('for the Guild Boss it weighs the element edge against this week\'s boss', () => {
    const s = roster(2);
    const now = Date.UTC(2026, 9, 28);
    const boss = guildBossElement(utcWeekStart(now));
    const score = (id: string) => {
      const h = HEROES.find((x) => x.id === id)!;
      return s.heroCombatPower(h).toNumber() * elementMultiplier(h.element, boss);
    };
    const ids = s.bestTeamIds('guild', now);
    const owned = HEROES.filter((h) => (s.levels[h.id] ?? 0) > 0);
    const cut = Math.min(...ids.map(score));
    for (const h of owned) if (!ids.includes(h.id)) expect(score(h.id)).toBeLessThanOrEqual(cut);
  });

  it('setLineup makes the lineup exactly those heroes and refunds everyone benched', () => {
    const s = roster(2);
    const target = [others[5].id, others[6].id, others[7].id];
    const going = s.pvpTeam().map((h) => h.id);
    const owed = going.reduce((t, id) => t + s.goldSpent(id).toNumber(), 0);
    const before = s.gold.toNumber();
    const refund = s.setLineup(target)!;
    expect(refund.toNumber()).toBeCloseTo(owed);
    expect(s.gold.toNumber()).toBeCloseTo(before + owed);
    expect(s.pvpTeam().map((h) => h.id).sort()).toEqual([...target].sort());
    expect(s.setLineup([])).toBeNull();
    expect(s.setLineup(others.slice(0, 4).map((h) => h.id))).toBeNull();
  });
});

describe('Manage Team sort', () => {
  it('sorts by level, stars and rarity, best first', () => {
    const s = roster(2);
    const owned = HEROES.filter((h) => (s.levels[h.id] ?? 0) > 0);
    const byLevel = sortHeroes(owned, 'level', s).map((h) => s.heroLevel(h.id));
    expect(byLevel).toEqual([...byLevel].sort((a, b) => b - a));
    s.stars[others[0].id] = 4;
    expect(sortHeroes(owned, 'stars', s)[0].id).toBe(others[0].id);
    const rank = { common: 0, rare: 1, epic: 2, legendary: 3 };
    const byRarity = sortHeroes(owned, 'rarity', s).map((h) => rank[h.rarity]);
    expect(byRarity).toEqual([...byRarity].sort((a, b) => b - a));
    const byCp = sortHeroes(owned, 'cp', s).map((h) => s.heroCombatPower(h).toNumber());
    expect(byCp).toEqual([...byCp].sort((a, b) => b - a));
  });

  it('the Sort button cycles through every sort', () => {
    let by = TEAM_SORTS[0];
    const seen = new Set([by]);
    for (let i = 0; i < TEAM_SORTS.length; i++) seen.add((by = nextTeamSort(by)));
    expect(seen.size).toBe(TEAM_SORTS.length);
    expect(by).toBe(TEAM_SORTS[0]);
  });
});

describe('Manage Team sort on the Colosseum and Guild Boss tabs', () => {
  it('sorts by Ember level there, since those teams fight at Ember levels', () => {
    const s = roster(2);
    const owned = HEROES.filter((h) => (s.levels[h.id] ?? 0) > 0);
    s.emberLevels[others[0].id] = 30; // lowest gold level, the only Ember levels
    expect(sortHeroes(owned, 'level', s, true)[0].id).toBe(others[0].id);
    expect(sortHeroes(owned, 'level', s)[0].id).toBe(others[7].id);
  });
});
