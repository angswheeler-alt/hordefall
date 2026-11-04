import { describe, expect, it } from 'vitest';
import Decimal from 'break_infinity.js';
import { compareTag } from '../src/formulas';

describe('compareTag (hero compare across number letters)', () => {
  it('reads small gaps as percents', () => {
    expect(compareTag(145, 100)).toEqual({ text: '+45%', dir: 1 });
    expect(compareTag(70, 100)).toEqual({ text: '-30%', dir: -1 });
  });
  it('treats near-equal values as the same', () => {
    expect(compareTag(1002, 1000)).toEqual({ text: '=', dir: 0 });
  });
  it('reads big gaps as multiples, even across suffixes like Qa vs Qi', () => {
    const qa = new Decimal('14.4e15');
    const qi = new Decimal('1.19e18');
    expect(compareTag(qi, qa)).toEqual({ text: 'x82.6', dir: 1 });
    expect(compareTag(qa, qi)).toEqual({ text: '÷82.6', dir: -1 });
  });
  it('uses short letters for huge gaps', () => {
    expect(compareTag(new Decimal('5e30'), new Decimal('1e20'))!.text).toBe('x50.0B');
  });
  it('skips a missing or zero base', () => {
    expect(compareTag(5, 0)).toBeNull();
    expect(compareTag(0, 5)).toEqual({ text: '-100%', dir: -1 });
  });
});

import { NUMBER_LETTERS_NOTE } from '../src/formulas';
describe('number letters guide', () => {
  it('lists the letters in order so Qi comes before Sx', () => {
    expect(NUMBER_LETTERS_NOTE).toContain('T < Qa < Qi < Sx < Sp');
  });
});
