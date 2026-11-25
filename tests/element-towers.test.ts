import { describe, expect, it } from 'vitest';
import Decimal from 'break_infinity.js';
import { GameState } from '../src/state';
import { HEROES, POOL_HEROES } from '../src/data';
import { TOWER_ELEMENTS, TOWER_FOE, TOWER_GROWTH, towerDays, towerFoeTeam, towerReward } from '../src/towers';

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
      for (const floor of [1, 7, 10, 50, 100, 500]) {
        const team = towerFoeTeam(el, floor);
        expect(team.length).toBe(5);
        expect(new Set(team.map((x) => x.id)).size).toBe(5);
        for (const x of team) expect(def(x.id).element).toBe(TOWER_FOE[el]);
        expect(towerFoeTeam(el, floor)).toEqual(team);
      }
      expect(['legendary', 'epic']).toContain(def(towerFoeTeam(el, 10)[0].id).rarity);
    }
  });

  it('pays rewards only, never gold: crests every floor, more on every 5th, 10th and 25th', () => {
    expect(towerReward(1)).toEqual({ crests: 5, gems: 5, stones: 0, epicCrests: 0, chest: null, essenceShare: 0.5 });
    expect(towerReward(5).stones).toBe(5);
    expect(towerReward(10).epicCrests).toBe(10);
    expect(towerReward(25).chest).toBe('glyph');
    expect(towerReward(100).chest).toBe('grand');
    expect(Object.keys(towerReward(50))).not.toContain('gold');
    expect(Object.keys(towerReward(50))).not.toContain('wild');
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

  it('never ends: every floor is stronger by the growth step, far past floor 100', () => {
    const s = ready('light');
    for (const f of [20, 150, 300]) {
      const a = new Decimal(s.towerFoe('light', f).cp);
      const b = new Decimal(s.towerFoe('light', f + 1).cp);
      expect(b.div(a).toNumber()).toBeCloseTo(TOWER_GROWTH, 1);
    }
    s.towers.floors.light = 1000;
    expect(s.towerNext('light')).toBe(1001);
    expect(s.towerBlock('light', SATURDAY)).toBe('');
  });
});

describe('Element Towers in the game', () => {
  it('opens after the first Rekindle', () => {
    const s = ready();
    s.rekindles = 0;
    expect(s.towersOpen()).toBe(false);
    expect(s.towerBlock('water', SATURDAY)).toMatch(/Rekindle/);
    s.rekindles = 1;
    expect(s.towerBlock('water', SATURDAY)).toBe('');
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

  it('a won floor pays crests of that element and moves on; a lost one costs nothing', () => {
    const s = ready();
    const gems = s.gems;
    const epics = POOL_HEROES.filter((h) => h.element === 'water' && h.rarity === 'epic').map((h) => h.id);
    const crestsOf = () => POOL_HEROES.filter((h) => h.element === 'water').reduce((t, h) => t + (s.crests[h.id] ?? 0), 0);
    const before = crestsOf();
    expect(s.towerFightStart('water', MONDAY)).not.toBeNull();
    expect(s.skillTeam?.size).toBeGreaterThan(0);
    expect(s.towerFightEnd(false)?.reward).toBeNull();
    expect(s.skillTeam).toBeNull();
    expect(s.towerNext('water')).toBe(1);
    expect(crestsOf()).toBe(before);

    for (let f = 1; f <= 10; f++) {
      expect(s.towerFightStart('water', MONDAY)?.name).toBe(`Floor ${f}`);
      const r = s.towerFightEnd(true)!;
      expect(r.floor).toBe(f);
      expect(r.crests.length).toBe(5);
      if (f === 10) expect(epics).toContain(r.epic?.id);
      else expect(r.epic).toBeNull();
      for (const id of r.crests) {
        expect(def(id).element).toBe('water');
        expect(def(id).rarity).not.toBe('legendary');
      }
    }
    expect(s.towerCleared('water')).toBe(10);
    expect(crestsOf() - before).toBe(50 + 10);
    expect(s.gems - gems).toBe(50);
    expect(s.essences.water).toBeGreaterThan(0);
  });

  it('won\'t start a closed tower', () => {
    const s = ready('fire');
    expect(s.towerFightStart('fire', MONDAY)).toBeNull();
    expect(s.towerFightStart('fire', SATURDAY)?.name).toBe('Floor 1');
  });

  it('a weak team is told the floor looks too strong', () => {
    const weak = ready('light', 0);
    weak.towers.floors.light = 20;
    expect(weak.towerForecast('light')?.won).toBe(false);
  });

  it('floors and teams survive a save and load; bad values are repaired', () => {
    const s = ready();
    s.towers.floors.water = 12;
    s.towers.teams.water = [POOL_HEROES.find((h) => h.element === 'water')!.id, 'nobody'];
    GameState.writeLocal({ ...s.toJSON(), towers: { ...s.towers, floors: { ...s.towers.floors, earth: -5, fire: 'x' } } });
    const t = new GameState();
    expect(t.load()).toBe(true);
    expect(t.towers.floors).toEqual({ water: 12 });
    expect(t.towers.teams.water?.length).toBe(1);
  });
});

describe('heroes with no element in the towers', () => {
  it('Pasta (no element) can join every tower, not only the Dark one', () => {
    for (const el of TOWER_ELEMENTS) {
      const s = ready(el);
      s.levels.pasta = 1;
      s.stars.pasta = 7;
      expect(s.towerAutoTeam(el)).toContain('pasta');
      expect(s.setTowerTeam(el, ['pasta'])).toBe(true);
      expect(s.towerTeam(el).map((h) => h.id)).toEqual(['pasta']);
    }
  });

  it('other elements are still kept out', () => {
    const s = ready('water');
    const fire = POOL_HEROES.find((h) => h.element === 'fire')!;
    s.levels[fire.id] = 1;
    expect(s.setTowerTeam('water', [fire.id])).toBe(false);
    expect(s.towerAutoTeam('water')).not.toContain(fire.id);
  });
});
