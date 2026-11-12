import { describe, expect, it } from 'vitest';
import { RELICS, RELIC_SETS, RELIC_SET_START_SHARE, RELIC_BASE_MAX } from '../src/data';

// Set balance (2026-11-12): crit-chance set bonuses multiply with stacked crit damage, so they stay small,
// and a just-finished set starts no stronger than its Lv 1 pieces do.
describe('relic set balance', () => {
  it('a new set starts at the same share as a Lv 1 piece', () => {
    expect(RELIC_SET_START_SHARE).toBeLessThanOrEqual(1 / RELIC_BASE_MAX);
  });
  it('crit-chance set bonuses stay small', () => {
    for (const set of RELIC_SETS) for (const [e, v] of set.bonus) if (e === 'crit') expect(v, set.id).toBeLessThanOrEqual(6);
  });
  it('set text matches its crit number', () => {
    for (const set of RELIC_SETS) for (const [e, v] of set.bonus) if (e === 'crit') expect(set.text, set.id).toContain(`+${v}% crit chance`);
  });
  it('every set has pieces', () => {
    for (const set of RELIC_SETS) expect(RELICS.some((r) => r.set === set.id), set.id).toBe(true);
  });
});
