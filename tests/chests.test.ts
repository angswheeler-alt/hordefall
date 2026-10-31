import { describe, it, expect } from 'vitest';
import { chestsAllowed, laneMode } from '../src/chests';

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
