import { describe, expect, it } from 'vitest';
import Decimal from 'break_infinity.js';
import { combatPower, type HeroStats } from '../src/stats';
import { GameState } from '../src/state';
import { HEROES } from '../src/data';

const pair = (v: number) => ({ value: v, base: v });
const big = (v: number) => ({ value: new Decimal(v), base: new Decimal(v) });
const base = (): HeroStats => ({
  atk: big(100), hp: big(1000), def: big(10), critRate: 0.1, critDmg: 1.5, attacksPerSec: pair(1), range: pair(30), moveSpeed: pair(100),
  effectRes: pair(0), frenzy: pair(0), lifesteal: 0, dodge: pair(0), stunChance: 0, stunTime: 0, aoeRadius: 0, aoeDmg: 0, ultAtk: 0, knightShield: 0, bonusGold: 0,
  freezeChance: 0, freezeTime: 0, freezeBlast: 0, burnChance: 0, burnTime: 0, burnDmg: 0, poisonChance: 0, poisonTime: 0, poisonDmg: 0, hasAoe: false, isKnight: false,
});
const cp = (over: Partial<HeroStats>) => combatPower({ ...base(), ...over }).toNumber();

describe('Combat Power', () => {
  it('is a whole positive number', () => {
    const v = cp({});
    expect(v).toBeGreaterThan(0);
    expect(Number.isInteger(v)).toBe(true);
  });

  it('goes up with every combat stat', () => {
    const start = cp({});
    const better: Partial<HeroStats>[] = [
      { atk: big(200) }, { hp: big(2000) }, { def: big(100) }, { critRate: 0.3 }, { critDmg: 3 }, { attacksPerSec: pair(2) }, { range: pair(120) },
      { moveSpeed: pair(150) }, { effectRes: pair(0.3) }, { frenzy: pair(0.2) }, { dodge: pair(0.2) }, { stunChance: 0.2 }, { ultAtk: 0.5 },
      { knightShield: 0.2 }, { freezeChance: 0.2 }, { burnChance: 0.5 }, { poisonChance: 0.5 }, { hasAoe: true },
    ];
    for (const b of better) expect(cp(b), JSON.stringify(Object.keys(b))).toBeGreaterThan(start);
  });

  it('ignores Bonus Gold, which is not combat', () => {
    expect(cp({ bonusGold: 5 })).toBe(cp({}));
  });

  it('needs both damage and toughness: doubling Atk and HP doubles it', () => {
    expect(cp({ atk: big(200), hp: big(2000), def: big(20) }) / cp({})).toBeCloseTo(2, 2);
  });

  it('copes with huge late-game numbers', () => {
    const v = combatPower({ ...base(), atk: { value: new Decimal('1e300'), base: new Decimal(1) }, hp: { value: new Decimal('1e300'), base: new Decimal(1) } });
    expect(v.gt('1e299')).toBe(true);
  });

  it('total Combat Power adds up every recruited hero and grows with Ember levels, not gold levels', () => {
    GameState.frozen = false;
    localStorage.clear();
    const s = new GameState();
    const owned = HEROES.filter((h) => (s.levels[h.id] ?? 0) > 0);
    const sum = owned.reduce((t, h) => t.plus(s.heroCombatPower(h)), new Decimal(0));
    expect(s.totalCombatPower().eq(sum)).toBe(true);
    const before = s.totalCombatPower();
    s.levels[owned[0].id] = 50;
    expect(s.totalCombatPower().eq(before)).toBe(true);
    s.emberLevels[owned[0].id] = 50;
    expect(s.totalCombatPower().gt(before)).toBe(true);
  });
});

describe('profile report', () => {
  it('sends total Combat Power with its log10, best stage, Rekindles and the team', async () => {
    const { profilePayload } = await import('../src/social');
    GameState.frozen = false;
    localStorage.clear();
    const s = new GameState();
    s.reachStage(42);
    const p = profilePayload(s);
    expect(p.p_total_cp).toBe(s.totalCombatPower().toString());
    expect(p.p_cp_log).toBeCloseTo(Math.log10(s.totalCombatPower().toNumber()), 6);
    expect(p.p_best_stage).toBe(42);
    expect(p.p_team.length).toBe(s.lineupCount());
    expect(p.p_team[0].stars).toBeGreaterThanOrEqual(1);
    expect(p.p_total_cp).toMatch(/^[0-9.e+]{1,40}$/);
  });
});
