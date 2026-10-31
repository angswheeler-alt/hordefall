import { describe, it, expect } from 'vitest';
import { HEROES, PLAYABLE_HEROES, type Signature } from '../src/data';
import { drenchVuln, heatStep, quarryMult, quarryCarry } from '../src/kits';
import { SHOP_HEROES } from '../src/state';
import { HERO_ANIMS } from '../src/heroAnims';

const sigOf = (id: string): Signature | undefined => HEROES.find((h) => h.id === id)?.signature;

describe('Water, Fire and Earth Legendaries', () => {
  it('every element has a Legendary, all released with art', () => {
    for (const el of ['water', 'fire', 'earth', 'light', 'dark'] as const) {
      expect(PLAYABLE_HEROES.some((h) => h.element === el && h.rarity === 'legendary')).toBe(true);
    }
    for (const id of ['varuun', 'ashtor', 'talonra']) {
      expect(PLAYABLE_HEROES.find((h) => h.id === id)?.rarity).toBe('legendary');
      expect(HERO_ANIMS[id]).toBeDefined();
    }
  });

  it('Legendaries stay out of the shops', () => {
    expect(SHOP_HEROES.some((h) => ['varuun', 'ashtor', 'talonra'].includes(h.id))).toBe(false);
  });

  it('Drench: +15% from Water heroes, +25% at 6★, nothing for other Signatures', () => {
    expect(drenchVuln(sigOf('varuun'))).toBeCloseTo(1.15);
    expect(drenchVuln(sigOf('varuun'), true)).toBeCloseTo(1.25);
    expect(drenchVuln(sigOf('ashtor'))).toBe(1);
  });

  it('Rising Heat: builds +6% per Heat, erupts at 8 and starts over', () => {
    const sig = sigOf('ashtor');
    let heat = 0;
    const mults: number[] = [];
    for (let i = 0; i < 9; i++) {
      const step = heatStep(sig, heat);
      mults.push(step.mult);
      heat = step.heat;
    }
    expect(mults[0]).toBe(1);
    expect(mults[7]).toBeCloseTo(1.42);
    expect(mults[8]).toBe(4);
    expect(heat).toBe(0);
    expect(heatStep(sig, 8, true)).toEqual({ heat: 0, mult: 6, erupt: true });
    expect(heatStep(sigOf('varuun'), 8)).toEqual({ heat: 0, mult: 1, erupt: false });
  });

  it('Quarry: +5% per arrow up to +50%, keeps half the streak after a kill (all of it at 6★)', () => {
    const sig = sigOf('talonra');
    expect(quarryMult(sig, 0)).toBe(1);
    expect(quarryMult(sig, 4)).toBeCloseTo(1.2);
    expect(quarryMult(sig, 50)).toBeCloseTo(1.5);
    expect(quarryCarry(sig, 9)).toBe(4);
    expect(quarryCarry(sig, 9, true)).toBe(9);
    expect(quarryCarry(sigOf('ashtor'), 9)).toBe(0);
  });
});
