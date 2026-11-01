import { describe, expect, it } from 'vitest';
import Decimal from 'break_infinity.js';
import { fmt, parseAmount } from '../src/formulas';
import { joinButton, joinRules } from '../src/guild';

describe('typed-in amounts (guild Combat Power minimums)', () => {
  it('reads plain numbers, letters and scientific notation', () => {
    expect(parseAmount('')!.toNumber()).toBe(0);
    expect(parseAmount('250')!.toNumber()).toBe(250);
    expect(parseAmount('1,500')!.toNumber()).toBe(1500);
    expect(parseAmount('1.5M')!.toNumber()).toBe(1.5e6);
    expect(parseAmount('2 qa')!.toNumber()).toBe(2e15);
    expect(parseAmount('1e40')!.log10()).toBeCloseTo(40);
  });

  it('reads back what fmt writes, including the letters after Dc', () => {
    for (const v of [new Decimal(12_300), new Decimal('4.56e33'), new Decimal('7.89e45'), new Decimal('1.23e200')]) {
      const back = parseAmount(fmt(v))!;
      expect(back.log10()).toBeCloseTo(v.log10(), 2);
    }
  });

  it('rejects text that is not an amount', () => {
    expect(parseAmount('lots')).toBeNull();
    expect(parseAmount('-5')).toBeNull();
    expect(parseAmount('5 XYZ')).toBeNull();
  });
});

describe('guild join rules in the list', () => {
  const me = { bestStage: 600, cpLog: 6.3, applied: false };
  it('open guilds join, apply guilds apply', () => {
    expect(joinButton({ min_stage: 0, join_mode: 'open', min_cp_log: 0 }, 3, me)).toEqual({ label: 'Join', act: 'join' });
    expect(joinButton({ min_stage: 0, join_mode: 'apply', min_cp_log: 0 }, 3, me)).toEqual({ label: 'Apply', act: 'apply' });
    expect(joinButton({ min_stage: 0 }, 3, me).act).toBe('join');
  });
  it('checks members, stage and Combat Power', () => {
    expect(joinButton({ min_stage: 0, join_mode: 'open' }, 30, me).act).toBeNull();
    expect(joinButton({ min_stage: 700, join_mode: 'open' }, 3, me).label).toBe('Too early');
    expect(joinButton({ min_stage: 0, join_mode: 'apply', min_cp_log: 7 }, 3, me).label).toBe('Need CP');
    expect(joinButton({ min_stage: 0, join_mode: 'open', min_cp_log: 6.3 }, 3, me).act).toBe('join');
  });
  it('an application can always be cancelled', () => {
    expect(joinButton({ min_stage: 9999, join_mode: 'apply' }, 30, { ...me, applied: true })).toEqual({ label: 'Cancel', act: 'unapply' });
  });
  it('describes the rules in one line', () => {
    expect(joinRules({ min_stage: 0, join_mode: 'open', min_cp: '0', min_cp_log: 0 })).toBe('Open');
    expect(joinRules({ min_stage: 500, join_mode: 'apply', min_cp: '1500000', min_cp_log: 6.18 })).toBe('Apply to join · stage 500+ · 1.50M CP+');
  });
});
