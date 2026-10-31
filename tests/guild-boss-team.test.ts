import { beforeEach, describe, expect, it } from 'vitest';
import { GameState } from '../src/state';
import { HEROES } from '../src/data';

const starter = HEROES.find((h) => h.unlockCost === 0)!;
const other = HEROES.find((h) => h.id !== starter.id && h.element !== starter.element)!;

beforeEach(() => localStorage.clear());

describe('Guild Boss team', () => {
  it('falls back to the stage lineup until a team is saved', () => {
    const s = new GameState();
    expect(s.guildBossHeroes().map((h) => h.id)).toEqual(s.pvpTeam().map((h) => h.id));
  });

  it('a saved team fights the boss, leaves the lineup alone and is saved', () => {
    const s = new GameState();
    s.levels[other.id] = 1;
    s.benched[other.id] = true;
    const lineup = s.pvpTeam().map((h) => h.id);
    expect(lineup).not.toContain(other.id);
    expect(s.setGuildBossTeam([other.id])).toBe(true);
    expect(s.guildBossHeroes().map((h) => h.id)).toEqual([other.id]);
    expect(s.guildBossTeam().map((m) => m.def.id)).toEqual([other.id]);
    expect(s.pvpTeam().map((h) => h.id)).toEqual(lineup);
    const t = new GameState();
    t.levels[other.id] = 1;
    t.load();
    expect(t.guildBossHeroes().map((h) => h.id)).toEqual([other.id]);
  });

  it('only recruited heroes, never more than the team slots, never empty', () => {
    const s = new GameState();
    const locked = HEROES.find((h) => (s.levels[h.id] ?? 0) === 0)!;
    expect(s.setGuildBossTeam([locked.id])).toBe(false);
    expect(s.setGuildBossTeam([])).toBe(false);
    const many = HEROES.slice(0, s.teamSlots + 1);
    for (const h of many) s.levels[h.id] = 1;
    expect(s.setGuildBossTeam(many.map((h) => h.id))).toBe(false);
    expect(s.setGuildBossTeam(many.slice(0, s.teamSlots).map((h) => h.id))).toBe(true);
    // Losing slots (or a hero) keeps the saved pick within the limit.
    s.teamSlots -= 1;
    expect(s.guildBossHeroes().length).toBe(s.teamSlots);
  });
});
