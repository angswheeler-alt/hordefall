import { describe, expect, it } from 'vitest';
import { elementWheelSvg } from '../src/elementWheel';
import { STRONG_VS, elementMultiplier } from '../src/data';

describe('element wheel', () => {
  it('draws exactly the matchups battle uses', () => {
    const svg = elementWheelSvg();
    const arrows = [...svg.matchAll(/data-from="(\w+)" data-to="(\w+)".*?>x([\d.]+)</g)].map((m) => [m[1], m[2], Number(m[3])]);
    expect(arrows.length).toBe(5);
    for (const [from, to, mult] of arrows) {
      expect(STRONG_VS[from as keyof typeof STRONG_VS]).toBe(to);
      expect(elementMultiplier(from as never, to as never)).toBe(mult);
    }
  });
});
