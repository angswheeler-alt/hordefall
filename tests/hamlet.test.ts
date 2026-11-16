import { describe, it, expect } from 'vitest';
import { HEROES, POOL_HEROES, RELEASED_HEROES, HIDDEN_HEROES } from '../src/data';
import { HERO_ANIMS } from '../src/heroAnims';
import { bannerStep, SIG_PLUS } from '../src/kits';

const hamlet = HEROES.find((h) => h.id === 'hamlet')!;

describe('Hamlet', () => {
  it('is a Rare Water Support healer with his own Signature, Ultimate and 5★/6★ text', () => {
    expect(hamlet).toBeTruthy();
    expect(hamlet.rarity).toBe('rare');
    expect(hamlet.element).toBe('water');
    expect(hamlet.type).toBe('Support');
    expect(hamlet.heals).toBe(true);
    expect(hamlet.signature?.kind).toBe('banner');
    expect(hamlet.ult?.kind).toBe('rally');
    expect(hamlet.ultPlus && hamlet.sigPlus).toBeTruthy();
    for (const h of HEROES) if (h !== hamlet) {
      expect(h.signature?.kind, h.id).not.toBe('banner');
      expect(h.ult?.kind, h.id).not.toBe('rally');
    }
  });

  it('is released into the normal random pools', () => {
    expect(HIDDEN_HEROES).not.toContain('hamlet');
    expect(RELEASED_HEROES).toContain('hamlet');
    expect(POOL_HEROES.some((h) => h.id === 'hamlet')).toBe(true);
  });

  it('has his animated sprites', () => {
    expect(HERO_ANIMS.hamlet).toBeTruthy();
    expect(HERO_ANIMS.hamlet.run).toBe(6);
    expect(HERO_ANIMS.hamlet.attack).toBe(5);
  });

  it('raises the banner every 12 seconds for +20% ATK nearby, +30% team-wide at 6★', () => {
    const sig = hamlet.signature;
    expect(bannerStep(sig, 11.9).raise).toBe(false);
    const b = bannerStep(sig, 12);
    expect(b.raise).toBe(true);
    expect(b.atk).toBeCloseTo(1.2);
    expect(b.radius).toBe(220);
    const plus = bannerStep(sig, 12, true);
    expect(plus.atk).toBeCloseTo(1 + SIG_PLUS.bannerAtk);
    expect(plus.radius).toBe(Infinity);
    expect(bannerStep(undefined, 99)).toEqual({ raise: false, atk: 1, radius: 0 });
  });
});
