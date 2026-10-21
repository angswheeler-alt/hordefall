import { describe, expect, it } from 'vitest';
import uiSrc from '../src/ui.ts?raw';
import guildSrc from '../src/guild.ts?raw';
import { fmt } from '../src/formulas';

describe('Ember amounts use the short number format', () => {
  it('formats plain-number Ember totals like gold', () => {
    expect(fmt(950)).toBe('950');
    expect(fmt(12_345)).toBe('12.3K');
    expect(fmt(4_560_000)).toBe('4.56M');
    expect(fmt(7.8e17)).toBe('780Qa');
    expect(fmt(1.5e30)).toBe('1.50No');
  });

  it('never prints Embers or Gems as raw full numbers in the UI', () => {
    const src = uiSrc + guildSrc;
    expect(src).not.toMatch(/String\((s|this\.state)\.(embers|gems)\)/);
    expect(src).not.toMatch(/embers\.toLocaleString\(\)/);
    expect(src).toContain("$('embers').textContent = fmt(s.embers)");
    expect(src).toContain("$('sheet-embers').textContent = fmt(s.embers)");
  });
});
