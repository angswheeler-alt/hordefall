import { describe, it, expect } from 'vitest';
import { chestsAllowed, chestTapArea, laneMode, CHEST_SCALE, CHEST_Y_MAX, CHEST_Y_MIN } from '../src/chests';

describe('floating chests', () => {
  it('fly only during the normal stage run', () => {
    expect(chestsAllowed(laneMode({ trial: null, pvp: null }))).toBe(true);
  });

  it('never appear in Trials or Colosseum fights', () => {
    expect(laneMode({ trial: {}, pvp: null })).toBe('trial');
    expect(laneMode({ trial: null, pvp: {} })).toBe('pvp');
    expect(chestsAllowed('trial')).toBe(false);
    expect(chestsAllowed('pvp')).toBe(false);
  });
});

describe('floating chest taps', () => {
  it('tap box is much bigger than the art and centred on it', () => {
    const a = chestTapArea(31, 15);
    expect(a.w * CHEST_SCALE).toBeGreaterThanOrEqual(80);
    expect(a.h * CHEST_SCALE).toBeGreaterThanOrEqual(60);
    expect(a.x + a.w / 2).toBeCloseTo(31 / 2);
    expect(a.y + a.h / 2).toBeCloseTo(15 / 2);
  });

  it('chests fly below the Fight boss and Settings buttons', () => {
    // Fight boss button ends near y 78; chest top (art 15 px x1.5, bob up 8) must stay clear.
    expect(CHEST_Y_MIN - (15 * CHEST_SCALE) / 2 - 8).toBeGreaterThanOrEqual(78);
    expect(CHEST_Y_MAX).toBeGreaterThanOrEqual(CHEST_Y_MIN);
  });
});
