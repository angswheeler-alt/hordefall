import { beforeEach, describe, expect, it } from 'vitest';
import { GameState } from '../src/state';
import { HEROES } from '../src/data';
import { emberStageBonus, plateauStages, PAY_STAGE_GROWTH, REBIRTH_FROM_LEVEL, REBIRTH_PAY_STAGES } from '../src/formulas';

beforeEach(() => localStorage.clear());

const team = (s: GameState) => HEROES.filter((h) => s.inLineup(h.id));

describe('Ember payout curve (emberMid)', () => {
  it('is unchanged up to stage 2,000 and grows faster after', () => {
    const at = (stage: number) => emberStageBonus(stage, 125).toNumber();
    expect(at(1000)).toBeCloseTo(Math.pow(1.06, 1000 - 126), 6);
    expect(at(2000)).toBeCloseTo(Math.pow(1.06, 2000 - 126), -2);
    // 6.05% a stage from 2,000, 6.2% from 4,000
    expect(emberStageBonus(2100, 125).div(emberStageBonus(2000, 125)).toNumber()).toBeCloseTo(Math.pow(1.0605, 100), 3);
    expect(emberStageBonus(4100, 125).div(emberStageBonus(4000, 125)).toNumber() / Math.pow(1.062, 100)).toBeCloseTo(1, 3);
  });
});

describe('Plateau breaker', () => {
  it('pays nothing for 3 days, then 5 pay stages a day up to 100', () => {
    expect(plateauStages(0)).toBe(0);
    expect(plateauStages(3)).toBe(0);
    expect(plateauStages(4)).toBe(5);
    expect(plateauStages(10)).toBe(35);
    expect(plateauStages(60)).toBe(100);
  });

  it('raises the Rekindle payout and resets when a new 50-stage milestone is reached', () => {
    const s = new GameState();
    s.reachStage(300);
    const base = s.pendingEmbers();
    s.bestStageAt = Date.now() - 10 * 86400000;
    expect(s.plateauPayStages()).toBeCloseTo(35, 3);
    expect(s.pendingEmbers().div(base).toNumber()).toBeCloseTo(Math.pow(PAY_STAGE_GROWTH, 35), 1);
    s.reachStage(320); // same milestone: no reset
    expect(s.plateauPayStages()).toBeGreaterThan(30);
    s.reachStage(350);
    expect(s.plateauPayStages()).toBe(0);
  });

  it('is saved and old saves start with a fresh clock', () => {
    const s = new GameState();
    s.bestStageAt = Date.now() - 5 * 86400000;
    s.save();
    const copy = new GameState();
    expect(copy.load()).toBe(true);
    expect(copy.bestStageAt).toBe(s.bestStageAt);
    const old = JSON.parse(JSON.stringify(s.toJSON()));
    delete old.bestStageAt;
    GameState.writeLocal(old);
    const fresh = new GameState();
    expect(fresh.load()).toBe(true);
    expect(Date.now() - fresh.bestStageAt).toBeLessThan(5000);
  });
});

describe('Rebirth', () => {
  function ready() {
    const s = new GameState();
    s.reachStage(500);
    for (const h of team(s)) s.emberLevels[h.id] = REBIRTH_FROM_LEVEL;
    return s;
  }

  it('is closed below the opening level', () => {
    const s = new GameState();
    s.reachStage(500);
    for (const h of team(s)) s.emberLevels[h.id] = REBIRTH_FROM_LEVEL - 1;
    expect(s.canRebirth()).toBe(false);
    expect(s.rebirth()).toBe(false);
  });

  it('resets Ember levels and Embers, keeps the peak for Trials and adds permanent pay stages', () => {
    const s = ready();
    s.embers = s.embers.plus(1e9);
    const before = s.pendingEmbers();
    expect(s.rebirth()).toBe(true);
    for (const h of team(s)) expect(s.emberLevels[h.id]).toBe(0);
    expect(s.embers.toNumber()).toBe(0);
    expect(s.rebirths).toBe(1);
    expect(s.rebirthPayStages()).toBe(REBIRTH_PAY_STAGES);
    expect(s.payStageBonus()).toBeCloseTo(Math.pow(PAY_STAGE_GROWTH, REBIRTH_PAY_STAGES), 6);
    const id = team(s)[0].id;
    expect(s.emberPeak[id]).toBe(REBIRTH_FROM_LEVEL);
    expect(s.heroesAtEmber(REBIRTH_FROM_LEVEL)).toBeGreaterThan(0);
    expect(before.gte(0)).toBe(true);
  });

  it('pays by the record stage until the team is back at the old level, then by the run', () => {
    const s = ready();
    s.reachStage(1000);
    s.rebirth();
    s.runBestStage = 300;
    expect(s.rebirthCatchUp()).toBe(true);
    expect(s.payRunStage()).toBe(1000);
    for (const h of team(s)) s.emberLevels[h.id] = REBIRTH_FROM_LEVEL;
    expect(s.rebirthCatchUp()).toBe(false);
    expect(s.payRunStage()).toBe(300);
  });

  it('needs a higher level for the next Rebirth', () => {
    const s = ready();
    s.rebirth();
    for (const h of team(s)) s.emberLevels[h.id] = REBIRTH_FROM_LEVEL;
    expect(s.canRebirth()).toBe(false);
    for (const h of team(s)) s.emberLevels[h.id] = REBIRTH_FROM_LEVEL + 50;
    expect(s.canRebirth()).toBe(true);
  });

  it('survives a save and load', () => {
    const s = ready();
    s.rebirth();
    s.save();
    const copy = new GameState();
    expect(copy.load()).toBe(true);
    expect(copy.rebirths).toBe(1);
    expect(copy.rebirthLevel).toBe(REBIRTH_FROM_LEVEL);
    expect(copy.emberPeak[team(s)[0].id]).toBe(REBIRTH_FROM_LEVEL);
    expect(copy.payStageBonus()).toBeCloseTo(s.payStageBonus(), 6);
  });
});
