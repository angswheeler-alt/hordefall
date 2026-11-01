import { describe, expect, it } from 'vitest';
import { BUY_AMOUNT_LIMIT, buyAmountLabel, buyAmountToSlider, clampAmount, normalizeBuyAmount, sliderToBuyAmount } from '../src/amountSlider';
import { GameState } from '../src/state';
import { bulkCost, emberBulk } from '../src/formulas';
import { HEROES } from '../src/data';
import Decimal from 'break_infinity.js';

describe('amount slider', () => {
  it('keeps amounts whole and between 1 and the most', () => {
    expect(clampAmount(0, 50)).toBe(1);
    expect(clampAmount(-3, 50)).toBe(1);
    expect(clampAmount(37.4, 50)).toBe(37);
    expect(clampAmount(80, 50)).toBe(50);
    expect(clampAmount(NaN, 50)).toBe(1);
    expect(clampAmount(5, 0)).toBe(1);
  });

  it('maps the level slider: 1 to the limit, then Max', () => {
    expect(sliderToBuyAmount(1)).toBe(1);
    expect(sliderToBuyAmount(37)).toBe(37);
    expect(sliderToBuyAmount(BUY_AMOUNT_LIMIT)).toBe(BUY_AMOUNT_LIMIT);
    expect(sliderToBuyAmount(BUY_AMOUNT_LIMIT + 1)).toBe('max');
    expect(buyAmountToSlider('max')).toBe(BUY_AMOUNT_LIMIT + 1);
    expect(buyAmountToSlider(25)).toBe(25);
    expect(buyAmountLabel(25)).toBe('Buy x25');
    expect(buyAmountLabel('max')).toBe('Buy max');
  });

  it('loads old and odd saved buy amounts safely', () => {
    expect(normalizeBuyAmount(1)).toBe(1);
    expect(normalizeBuyAmount(10)).toBe(10);
    expect(normalizeBuyAmount('max')).toBe('max');
    expect(normalizeBuyAmount(undefined)).toBe(1);
    expect(normalizeBuyAmount('x')).toBe(1);
    expect(normalizeBuyAmount(5000)).toBe(BUY_AMOUNT_LIMIT);
    GameState.frozen = false;
    localStorage.clear();
    const s = new GameState();
    s.buyAmount = 37;
    s.stallBuyAmount = 'max';
    GameState.writeLocal(s.toJSON());
    const t = new GameState();
    expect(t.load()).toBe(true);
    expect(t.buyAmount).toBe(37);
    expect(t.stallBuyAmount).toBe('max');
  });

  it('any amount buys exactly that many levels', () => {
    const def = HEROES[0];
    expect(bulkCost(def, 5, 37, new Decimal(0)).levels).toBe(37);
    expect(emberBulk(3, 23, 0).levels).toBe(23);
  });
});
