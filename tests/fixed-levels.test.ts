import { beforeEach, describe, expect, it } from 'vitest';
import Decimal from 'break_infinity.js';
import { GameState } from '../src/state';
import { HEROES, FIXED_LEVEL, AWAKEN_UNLOCK_LEVEL } from '../src/data';
import { keeperThreshold } from '../src/formulas';
import battleSrc from '../src/BattleScene.ts?raw';

// User rule (2026-11-04): Ember levels count only on stages and in Trials, gold levels only on stages.
// Guild Boss, Colosseum, Rush and Expedition fight at FIXED_LEVEL.

const starter = HEROES.find((h) => h.unlockCost === 0)!;

function player(): GameState {
  const s = new GameState();
  s.lifetimeEmbers = keeperThreshold(AWAKEN_UNLOCK_LEVEL - 1);
  return s;
}

beforeEach(() => localStorage.clear());

describe('Ember and gold levels by mode', () => {
  it('stages use gold plus Ember levels, Trials Ember levels only', () => {
    const s = player();
    s.levels[starter.id] = 40;
    s.emberLevels[starter.id] = 25;
    expect(s.heroLevel(starter.id)).toBe(65);
    expect(s.heroStats(starter).atk.value.eq(s.heroStats(starter, 65).atk.value)).toBe(true);
    const trial = s.trialTeam().find((m) => m.def.id === starter.id)!;
    expect(trial.atk.eq(s.heroPower(starter, 25).atk)).toBe(true);
  });

  it('Guild Boss, Colosseum and Rush ignore gold and Ember levels', () => {
    const s = player();
    const base = s.pvpUnit(starter);
    const cp = s.fixedCombatPower(starter);
    const boss = s.guildBossTeam()[0];
    s.levels[starter.id] = 500;
    s.emberLevels[starter.id] = 400;
    expect(s.fixedLevel(starter.id)).toBe(FIXED_LEVEL);
    expect(s.pvpUnit(starter).atk.eq(base.atk)).toBe(true);
    expect(s.pvpUnit(starter).hp.eq(base.hp)).toBe(true);
    expect(s.fixedCombatPower(starter).eq(cp)).toBe(true);
    expect(s.guildBossTeam()[0].atk.eq(boss.atk)).toBe(true);
    expect(s.pvpSnapshot().p_team[0].atk).toBe(base.atk.toString());
    // Combat Power on the hero sheet and the Top Power board still counts Ember levels.
    expect(s.heroCombatPower(starter).gt(cp)).toBe(true);
  });

  it('stars still make heroes stronger in those modes', () => {
    const s = player();
    const before = s.fixedCombatPower(starter);
    s.stars[starter.id] = 3;
    expect(s.fixedCombatPower(starter).gt(before)).toBe(true);
  });

  it('a hero not recruited has no fixed level', () => {
    const s = player();
    const locked = HEROES.find((h) => (s.levels[h.id] ?? 0) === 0)!;
    expect(s.fixedLevel(locked.id)).toBe(0);
  });

  it('Ghosts land near their target CP, far above or below the old multiplier range', () => {
    const s = player();
    for (const target of [new Decimal(50), new Decimal(1e4), new Decimal('1e12')]) {
      const g = GameState.fitGhost({ name: 'x', ghost: true, heroes: [{ id: starter.id, stars: 0 }], ember: 1, cp: '0' }, target);
      expect(g.ember).toBe(1);
      const cp = GameState.opponentCp(g);
      expect(cp.lte(target.times(1.001))).toBe(true);
      expect(cp.gte(target.times(0.99))).toBe(true);
    }
    void s;
  });

  it('the battle lane picks the level by mode', () => {
    const src = battleSrc;
    const body = src.slice(src.indexOf('private levelOf('), src.indexOf('private levelOf(') + 300);
    expect(body).toContain('if (this.pvp || this.trial?.guild) return this.state.fixedLevel(heroId);');
    expect(body).toContain('if (this.trial) return this.state.permanentLevel(heroId);');
  });

  it('an older save rolls its Colosseum and Rush opponents again, once', () => {
    const old = { gold: '0', levels: { [starter.id]: 5 }, pvp: { picks: [{ name: 'a', ghost: true, heroes: [{ id: starter.id, stars: 0 }], ember: 900, cp: '1e40' }], refreshAt: 9e15, active: -1 } };
    localStorage.setItem('hordefall-save-v1', JSON.stringify(old));
    const s = new GameState();
    s.load();
    expect(s.pvp.picks).toEqual([]);
    expect(s.pvp.refreshAt).toBe(0);
    localStorage.setItem('hordefall-save-v1', JSON.stringify({ ...old, fixedLevels: 1 }));
    const t = new GameState();
    t.load();
    expect(t.pvp.picks).toHaveLength(1);
  });
});
