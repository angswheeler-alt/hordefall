import { describe, expect, it } from 'vitest';
import { screenGap } from '../src/screenGap';

describe('screenGap (installed iPhone app bottom band)', () => {
  it('measures the band when the installed app gets a short viewport', () => {
    expect(screenGap(844, 780, true, true)).toBe(64);
  });
  it('does nothing in a normal browser tab', () => {
    expect(screenGap(844, 700, false, true)).toBe(0);
  });
  it('does nothing in landscape or when the viewport already fills the screen', () => {
    expect(screenGap(844, 780, true, false)).toBe(0);
    expect(screenGap(844, 844, true, true)).toBe(0);
  });
  it('ignores sizes that are not a status-bar sized band', () => {
    expect(screenGap(844, 840, true, true)).toBe(0);
    expect(screenGap(844, 600, true, true)).toBe(0);
  });
});
