import { describe, expect, it } from 'vitest';
import Decimal from 'break_infinity.js';
import { GameState } from '../src/state';
import { enemyHp } from '../src/formulas';
import { JOURNAL_PAGES, JOURNAL_TIERS, cleanJournal, journalPage, mutantPageId } from '../src/journal';
import {
  MUTANT_GOLD,
  MUTATIONS,
  MUTATION_IDS,
  MUTATION_MAX_CHANCE,
  MUTATION_STAGE,
  mutantHpWorth,
  mutationChance,
  mutationLoad,
  rollMutation,
} from '../src/mutations';

function fresh() {
  GameState.frozen = false;
  localStorage.clear();
  return new GameState();
}

describe('mutation chance', () => {
  it('never mutates mobs up to stage 500', () => {
    for (const stage of [1, 100, 499, 500]) {
      expect(mutationChance(stage)).toBe(0);
      expect(rollMutation(stage, 0, 0)).toBeNull();
    }
  });

  it('starts at 5% on stage 501, +1% per 100 stages, capped at 15%', () => {
    expect(MUTATION_STAGE).toBe(501);
    expect(mutationChance(501)).toBeCloseTo(0.05);
    expect(mutationChance(600)).toBeCloseTo(0.05);
    expect(mutationChance(601)).toBeCloseTo(0.06);
    expect(mutationChance(1001)).toBeCloseTo(0.1);
    expect(mutationChance(1501)).toBeCloseTo(MUTATION_MAX_CHANCE);
    expect(mutationChance(5000)).toBeCloseTo(MUTATION_MAX_CHANCE);
  });

  it('rolls under the chance and picks each trait equally', () => {
    expect(rollMutation(501, 0.049, 0)?.id).toBe('armored');
    expect(rollMutation(501, 0.05, 0)).toBeNull();
    expect(MUTATION_IDS.map((_, i) => rollMutation(2000, 0, (i + 0.5) / MUTATION_IDS.length)!.id)).toEqual(MUTATION_IDS);
    expect(rollMutation(2000, 0, 0.9999)!.id).toBe('mending');
  });
});

describe('mutation balance', () => {
  it('every trait is tougher or nastier than a plain mob, never a free kill', () => {
    for (const m of Object.values(MUTATIONS)) {
      expect(mutantHpWorth(m)).toBeGreaterThanOrEqual(1);
      expect(m.hp * m.atk / m.cooldown).toBeGreaterThan(1);
    }
  });

  it('at the cap the average mob has about 12% more HP, which moves a wall back under 2 stages', () => {
    const load = mutationLoad(1501);
    expect(load.hp).toBeGreaterThan(1.1);
    expect(load.hp).toBeLessThan(1.14);
    expect(load.atk).toBeLessThan(1.1);
    // Enemy HP grows 7% a stage.
    expect(Math.log(load.hp) / Math.log(1.07)).toBeLessThan(2);
  });

  it('extra gold roughly pays back the extra HP, so gold per minute holds steady', () => {
    const load = mutationLoad(1501);
    expect(load.gold).toBeGreaterThan(1);
    expect(Math.abs(load.gold - load.hp)).toBeLessThan(0.05);
    expect(MUTANT_GOLD).toBe(1.5);
  });

  it('changes nothing up to stage 500', () => {
    expect(mutationLoad(500)).toEqual({ hp: 1, atk: 1, gold: 1 });
  });
});

describe('offline progress with mutants', () => {
  const team = (stage: number, share: number) => ({ dps: enemyHp(stage).times(15 / 8).times(share), hp: new Decimal('1e300'), def: new Decimal(0) });

  it('a team just able to clear plain mobs is stopped by mutants past stage 500', () => {
    const s = fresh();
    // Clears a stage-600 pile of plain mobs with 2% to spare, but mutants add ~4%.
    expect(s.canClearStage(600, team(600, 1.02))).toBe(false);
    expect(s.canClearStage(600, team(600, 1.06))).toBe(true);
  });

  it('stages up to 500 are judged as before', () => {
    const s = fresh();
    expect(s.canClearStage(500, team(500, 1.001))).toBe(true);
    expect(s.canClearStage(500, team(500, 0.999))).toBe(false);
  });

});

describe('mutant Journal pages', () => {
  it('adds one page per trait, with their own tiers', () => {
    const pages = JOURNAL_PAGES.filter((p) => p.group === 'mutant');
    expect(pages.map((p) => p.mutation)).toEqual(MUTATION_IDS);
    for (const p of pages) expect(p.tiers).toEqual(JOURNAL_TIERS.mutant);
    expect(journalPage(mutantPageId('armored'))?.name).toBe('Armored mutant');
  });

  it('counts kills and gives the damage bonus against that trait', () => {
    const s = fresh();
    const id = mutantPageId('swift');
    expect(s.journalMult(id)).toBe(1);
    expect(s.journalAdd(id, JOURNAL_TIERS.mutant[0])).toBe(1);
    expect(s.journalMult(id)).toBeCloseTo(1.03);
  });

  it('keeps mutant kills in a save', () => {
    expect(cleanJournal({ [mutantPageId('enraged')]: 12, mutant_bogus: 3 })).toEqual({ [mutantPageId('enraged')]: 12 });
  });
});
