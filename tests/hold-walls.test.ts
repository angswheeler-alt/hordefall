import { describe, expect, it } from 'vitest';
import { GameState, weekIndex } from '../src/state';
import { HEROES, POOL_HEROES } from '../src/data';
import { WALL_COUNT, WALL_RAIDS, WALL_SIZE, WALL_WAVES, wallFoeTeam, wallRaids, wallReward } from '../src/walls';

const def = (id: string) => HEROES.find((h) => h.id === id)!;
/** A save past its first Rekindle that owns every regular hero at `stars`. */
function ready(stars = 3): GameState {
  const s = new GameState();
  s.rekindles = 1;
  for (const h of POOL_HEROES) {
    s.levels[h.id] = 1;
    s.stars[h.id] = stars;
  }
  return s;
}
const MONDAY = new Date(2026, 10, 23, 12).getTime();
const TUESDAY = new Date(2026, 10, 24, 12).getTime();
const NEXT_MONDAY = new Date(2026, 10, 30, 12).getTime();

describe('Hold the Walls rules', () => {
  it('raids each wall with a different element every week, and every element raids', () => {
    for (const r of WALL_RAIDS) expect(new Set(r).size).toBe(WALL_COUNT);
    expect(new Set(WALL_RAIDS.flat()).size).toBe(5);
    expect(wallRaids(weekIndex(MONDAY))).toEqual(wallRaids(weekIndex(MONDAY + 5 * 86_400_000)));
    expect(wallRaids(weekIndex(MONDAY))).not.toEqual(wallRaids(weekIndex(NEXT_MONDAY)));
  });

  it('waves are raiders of the wall element only, the same all week', () => {
    for (const wave of [1, 9, 10, 30]) {
      const team = wallFoeTeam('fire', 100, 0, wave);
      expect(team.length).toBe(5);
      expect(new Set(team.map((x) => x.id)).size).toBe(5);
      for (const x of team) expect(def(x.id).element).toBe('fire');
      expect(wallFoeTeam('fire', 100, 0, wave)).toEqual(team);
    }
    expect(def(wallFoeTeam('fire', 100, 0, 10)[0].id).rarity).toBe('epic');
  });

  it('pays Stones and crests for waves held in total, never gold or Gems', () => {
    expect(wallReward([10, 10, 10])).toEqual({ stones: 6, crests: 3 });
    expect(wallReward([0, 0, 4])).toEqual({ stones: 0, crests: 0 });
    expect(Object.keys(wallReward([30, 30, 30]))).not.toContain('gold');
    expect(Object.keys(wallReward([30, 30, 30]))).not.toContain('gems');
  });
});

describe('Hold the Walls in the game', () => {
  it('opens after the first Rekindle', () => {
    const s = ready();
    s.rekindles = 0;
    expect(s.wallsBlock(MONDAY)).toMatch(/Rekindle/);
    s.rekindles = 1;
    s.setWallTeams(s.wallsAutoTeams(MONDAY));
    expect(s.wallsBlock(MONDAY)).toBe('');
  });

  it('auto-set fills three walls of five with counters, a hero on one wall only', () => {
    const s = ready();
    const teams = s.wallsAutoTeams(MONDAY);
    expect(teams.length).toBe(WALL_COUNT);
    const all = teams.flat();
    expect(all.length).toBe(WALL_COUNT * WALL_SIZE);
    expect(new Set(all).size).toBe(all.length);
    // Every hero there hits the raiders at least evenly.
    const raids = s.wallRaids(MONDAY);
    const beats: Record<string, string> = { water: 'fire', fire: 'earth', earth: 'water', light: 'dark', dark: 'light' };
    teams.forEach((t, i) => expect(t.some((id) => beats[def(id).element] === raids[i])).toBe(true));
  });

  it('refuses a hero on two walls or too many on one', () => {
    const s = ready();
    const [a, b, c, d, e, f] = POOL_HEROES.map((h) => h.id);
    expect(s.setWallTeams([[a], [a], []])).toBe(false);
    expect(s.setWallTeams([[a, b, c, d, e, f], [], []])).toBe(false);
    expect(s.setWallTeams([[a, b], [c], []])).toBe(true);
    expect(s.wallTeams().map((t) => t.length)).toEqual([2, 1, 0]);
  });

  it('stronger heroes hold more waves', () => {
    const weak = ready(0);
    const strong = ready(6);
    weak.setWallTeams(weak.wallsAutoTeams(MONDAY));
    strong.setWallTeams(strong.wallsAutoTeams(MONDAY));
    const w = weak.wallsForecast(MONDAY);
    const st = strong.wallsForecast(MONDAY);
    for (let i = 0; i < WALL_COUNT; i++) {
      expect(st[i]).toBeGreaterThanOrEqual(w[i]);
      expect(st[i]).toBeLessThanOrEqual(WALL_WAVES);
    }
    expect(st.reduce((a, b) => a + b)).toBeGreaterThan(w.reduce((a, b) => a + b));
  });

  it('defends once a day, pays crests to heroes on the walls, and week chests once', () => {
    const s = ready(6);
    s.setWallTeams(s.wallsAutoTeams(MONDAY));
    const stones = s.enhanceStones;
    const stood = new Set(s.walls.teams.flat());
    const r = s.wallsDefend(MONDAY)!;
    expect(r.total).toBe(r.waves.reduce((a, b) => a + b, 0));
    expect(r.total).toBeGreaterThan(0);
    expect(s.enhanceStones - stones).toBe(r.stones);
    expect(r.crests.length).toBe(Math.floor(r.total / 10));
    for (const id of r.crests) expect(stood.has(id)).toBe(true);
    expect(s.wallsDefend(MONDAY)).toBeNull();
    expect(s.wallsBlock(MONDAY)).toMatch(/tomorrow/);
    const again = s.wallsDefend(TUESDAY)!;
    expect(again.total).toBe(r.total);
    expect(again.chests.length).toBe(0);
    expect(s.wallsWeekBest(TUESDAY)).toBe(r.total);
    expect(s.wallsWeekBest(NEXT_MONDAY)).toBe(0);
  });

  it('watching a wall replays the wave that broke it and pays nothing', () => {
    const s = ready(2);
    s.setWallTeams(s.wallsAutoTeams(MONDAY));
    const r = s.wallsDefend(MONDAY)!;
    const stones = s.enhanceStones;
    const w = s.wallWatchStart(0, MONDAY)!;
    expect(w.wave).toBe(Math.min(WALL_WAVES, r.waves[0] + 1));
    expect(w.ids).toEqual(s.walls.teams[0]);
    expect(s.skillTeam?.size).toBe(w.ids.length);
    s.wallWatchEnd();
    expect(s.skillTeam).toBeNull();
    expect(s.enhanceStones).toBe(stones);
  });

  it('walls survive a save and load; bad values are repaired', () => {
    const s = ready();
    const ids = POOL_HEROES.slice(0, 3).map((h) => h.id);
    s.setWallTeams([[ids[0]], [ids[1]], [ids[2]]]);
    GameState.writeLocal({ ...s.toJSON(), walls: { ...s.walls, teams: [[ids[0], 'nobody'], [ids[0], ids[1]], [ids[2]]], best: -4, paid: [0, 9], last: [3, 'x', 50] } });
    const t = new GameState();
    expect(t.load()).toBe(true);
    expect(t.walls.teams).toEqual([[ids[0]], [ids[1]], [ids[2]]]);
    expect(t.walls.best).toBe(0);
    expect(t.walls.paid).toEqual([0]);
    expect(t.walls.last).toEqual([3, 0, WALL_WAVES]);
  });
});
