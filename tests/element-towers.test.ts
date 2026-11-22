import { describe, expect, it } from 'vitest';
import Decimal from 'break_infinity.js';
import { GameState } from '../src/state';
import { HEROES, POOL_HEROES } from '../src/data';
import { TOWER_ELEMENTS, TOWER_FLOORS, TOWER_FOE, TOWER_GROWTH, towerDays, towerFoeTeam, towerReward } from '../src/towers';

const def = (id: string) => HEROES.find((h) => h.id === id)!;
/** A save past its first Rekindle that owns every regular hero of `el` at `stars`. */
function ready(el = 'water', stars = 3): GameState {
  const s = new GameState();
  s.rekindles = 1;
  for (const h of POOL_HEROES.filter((x) => x.element === el)) {
    s.levels[h.id] = 1;
    s.stars[h.id] = stars;
  }
  return s;
}
const MONDAY = new Date(2026, 10, 23, 12).getTime();
const SATURDAY = new Date(2026, 10, 28, 12).getTime();

describe('Element Towers rules', () => {
  it('each tower fights the element it beats', () => {
    expect(TOWER_FOE).toEqual({ water: 'fire', fire: 'earth', earth: 'water', light: 'dark', dark: 'light' });
  });

  it('floors are teams of the foe element only, the same every time, led by the strongest', () => {
    for (const el of TOWER_ELEMENTS) {
      for (const floor of [1, 7, 10, 50, 100]) {
        const team = towerFoeTeam(el, floor, 'normal');
        expect(team.length).toBe(5);
        expect(new Set(team.map((x) => x.id)).size).toBe(5);
        for (const x of team) expect(def(x.id).element).toBe(TOWER_FOE[el]);
        expect(towerFoeTeam(el, floor, 'normal')).toEqual(team);
      }
      const boss = def(towerFoeTeam(el, 10, 'normal')[0].id);
      expect(['legendary', 'epic']).toContain(boss.rarity);
    }
  });

  it('pays rewards only, never gold: more on every 5th, 10th and 25th floor, double on Hard', () => {
    expect(towerReward(1, 'normal')).toEqual({ wild: 2, stones: 0, gems: 0, chest: null, essenceShare: 0.5 });
    expect(towerReward(5, 'normal').stones).toBe(5);
    expect(towerReward(10, 'normal').gems).toBe(40);
    expect(towerReward(25, 'normal').chest).toBe('glyph');
    expect(towerReward(10, 'hard')).toMatchObject({ wild: 4, stones: 10, gems: 80 });
    expect(Object.keys(towerReward(50, 'hard'))).not.toContain('gold');
  });

  it('opens each tower two weekdays, and all of them on the weekend', () => {
    for (const el of TOWER_ELEMENTS) {
      const days = towerDays(el);
      expect(days).toContain(6);
      expect(days).toContain(0);
      expect(days.filter((d) => d >= 1 && d <= 5).length).toBe(2);
    }
    const s = ready();
    expect(TOWER_ELEMENTS.filter((el) => s.towerOpenToday(el, MONDAY))).toEqual(['water', 'dark']);
    expect(TOWER_ELEMENTS.every((el) => s.towerOpenToday(el, SATURDAY))).toBe(true);
  });

  it('floors get stronger by the growth step', () => {
    const s = ready();
    const a = new Decimal(s.towerFoe('light', 20, 'normal').cp);
    const b = new Decimal(s.towerFoe('light', 21, 'normal').cp);
    expect(b.div(a).toNumber()).toBeCloseTo(TOWER_GROWTH, 1);
    // Hard floor 1 is as strong as the step after Normal floor 100.
    const top = new Decimal(s.towerFoe('dark', TOWER_FLOORS, 'normal').cp);
    const hard = new Decimal(s.towerFoe('dark', 1, 'hard').cp);
    expect(hard.div(top).toNumber()).toBeCloseTo(TOWER_GROWTH, 1);
  });
});

describe('Element Towers in the game', () => {
  it('opens after the first Rekindle', () => {
    const s = ready();
    s.rekindles = 0;
    expect(s.towersOpen()).toBe(false);
    expect(s.towerBlock('water', 'normal', SATURDAY)).toMatch(/Rekindle/);
    s.rekindles = 1;
    expect(s.towerBlock('water', 'normal', SATURDAY)).toBe('');
  });

  it('only lets heroes of the tower element in', () => {
    const s = ready('water');
    const team = s.towerTeam('water');
    expect(team.length).toBeGreaterThan(0);
    expect(team.length).toBeLessThanOrEqual(s.teamSlots);
    expect(team.every((h) => h.element === 'water')).toBe(true);
    const water = team.map((h) => h.id);
    const fire = POOL_HEROES.find((h) => h.element === 'fire')!.id;
    s.levels[fire] = 1;
    expect(s.setTowerTeam('water', [fire])).toBe(false);
    expect(s.setTowerTeam('water', [water[0], fire])).toBe(true);
    expect(s.towerTeam('water').map((h) => h.id)).toEqual([water[0]]);
    expect(s.towerTeam('fire').every((h) => h.element === 'fire')).toBe(true);
  });

  it('a won floor pays and moves on; a lost one costs nothing and can be fought again', () => {
    const s = ready();
    const gems = s.gems;
    const wild = s.wildCrests;
    expect(s.towerFightStart('water', 'normal', MONDAY)).not.toBeNull();
    expect(s.skillTeam?.size).toBeGreaterThan(0);
    expect(s.towerFightEnd(false)?.reward).toBeNull();
    expect(s.skillTeam).toBeNull();
    expect(s.towerNext('water', 'normal')).toBe(1);
    expect(s.wildCrests).toBe(wild);

    for (let f = 1; f <= 10; f++) {
      expect(s.towerFightStart('water', 'normal', MONDAY)?.name).toBe(`Floor ${f}`);
      expect(s.towerFightEnd(true)?.floor).toBe(f);
    }
    expect(s.towerCleared('water', 'normal')).toBe(10);
    expect(s.wildCrests - wild).toBe(20);
    expect(s.gems - gems).toBe(40);
    expect(s.essences.water).toBeGreaterThan(0);
  });

  it('won\'t start a closed tower, and Hard waits for all Normal floors', () => {
    const s = ready('fire');
    expect(s.towerFightStart('fire', 'normal', MONDAY)).toBeNull();
    expect(s.towerFightStart('fire', 'hard', SATURDAY)).toBeNull();
    s.towers.normal.fire = TOWER_FLOORS;
    expect(s.towerNext('fire', 'normal')).toBeNull();
    expect(s.towerHardOpen('fire')).toBe(true);
    expect(s.towerFightStart('fire', 'hard', SATURDAY)?.name).toBe('Floor 1');
  });

  it('a stronger team looks better in the forecast', () => {
    const weak = ready('light', 0);
    const strong = ready('light', 6);
    weak.towers.normal.light = strong.towers.normal.light = 20;
    expect(weak.towerForecast('light', 'normal')?.won).toBe(false);
    expect(strong.fixedTeamCp(strong.towerTeam('light')).gt(weak.fixedTeamCp(weak.towerTeam('light')))).toBe(true);
  });

  it('floors and teams survive a save and load; bad values are repaired', () => {
    const s = ready();
    s.towers.normal.water = 12;
    s.towers.hard.water = 4; // Hard without Normal cleared is dropped
    s.towers.teams.water = [POOL_HEROES.find((h) => h.element === 'water')!.id, 'nobody'];
    GameState.writeLocal({ ...s.toJSON(), towers: { ...s.towers, normal: { ...s.towers.normal, earth: 999 } } });
    const t = new GameState();
    expect(t.load()).toBe(true);
    expect(t.towers.normal).toEqual({ water: 12, earth: TOWER_FLOORS });
    expect(t.towers.hard).toEqual({});
    expect(t.towers.teams.water?.length).toBe(1);
  });
});
