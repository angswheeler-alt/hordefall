import { describe, expect, it } from 'vitest';
import { exitRunStep } from '../src/movement';

/** Steps a hero through the 0.9 s between a stage clear and the next stage, in 1/60 s frames. */
function runFor(x: number, speed: number, seconds: number) {
  const dt = 1 / 60;
  let t = 0;
  while (t < seconds - 1e-9) {
    x = exitRunStep(x, speed, t, dt);
    t += dt;
  }
  return x;
}

describe('after-clear exit run', () => {
  it('only ever moves heroes right', () => {
    expect(exitRunStep(100, 110, 0, 0.1)).toBeGreaterThan(100);
    expect(exitRunStep(100, 0, 0, 0)).toBe(100);
    expect(exitRunStep(100, -50, 0, 0.1)).toBeGreaterThanOrEqual(100);
  });

  it('speeds up as it goes', () => {
    const early = exitRunStep(0, 110, 0, 0.1);
    const late = exitRunStep(0, 110, 0.6, 0.1);
    expect(late).toBeGreaterThan(early);
  });

  it('gets a slow back-line hero off the lane before the next stage starts', () => {
    // A ranged hero shooting the crystal from ~185 px away (crystal at 1404, lane ends at 1440).
    expect(runFor(1404 - 14 - 185, 100, 0.9)).toBeGreaterThan(1440 + 22);
  });
});
