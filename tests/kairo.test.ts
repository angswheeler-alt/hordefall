import { describe, it, expect } from 'vitest';
import { HEROES, POOL_HEROES, RELEASED_HEROES } from '../src/data';
import { surgeStage, surgeMults, cannonMult, SIG_PLUS } from '../src/kits';
import { ultFxStyle } from '../src/ultFx';

const kairo = HEROES.find((h) => h.id === 'kairo')!;

describe('Kairo', () => {
  it('is a Light Brawler with his own Signature, Ultimate and 6★ text', () => {
    expect(kairo).toBeTruthy();
    expect(kairo.element).toBe('light');
    expect(kairo.type).toBe('Brawler');
    expect(kairo.signature?.kind).toBe('surge');
    expect(kairo.ult?.kind).toBe('cannon');
    expect(kairo.ultPlus && kairo.sigPlus).toBeTruthy();
    for (const h of HEROES) if (h !== kairo) expect(h.signature?.kind, h.id).not.toBe('surge');
  });

  it('stays hidden and out of random pools until his art is in', () => {
    expect(RELEASED_HEROES).not.toContain('kairo');
    expect(POOL_HEROES.some((h) => h.id === 'kairo')).toBe(false);
  });

  it('climbs a surge stage every 8 seconds, up to 3', () => {
    const sig = kairo.signature;
    expect(surgeStage(sig, 0)).toBe(0);
    expect(surgeStage(sig, 7.9)).toBe(0);
    expect(surgeStage(sig, 8)).toBe(1);
    expect(surgeStage(sig, 16)).toBe(2);
    expect(surgeStage(sig, 24)).toBe(3);
    expect(surgeStage(sig, 999)).toBe(3);
    // 6★ jump adds a stage but never past the top.
    expect(surgeStage(sig, 0, 1)).toBe(1);
    expect(surgeStage(sig, 24, 1)).toBe(3);
    expect(surgeStage(undefined, 99)).toBe(0);
  });

  it('gives +30/+60/+100% ATK and faster attacks from stage 2', () => {
    const sig = kairo.signature;
    expect(surgeMults(sig, 0)).toEqual({ dmg: 1, cooldown: 1 });
    expect(surgeMults(sig, 1)).toEqual({ dmg: 1.3, cooldown: 1 });
    expect(surgeMults(sig, 2)).toEqual({ dmg: 1.6, cooldown: 0.85 });
    expect(surgeMults(sig, 3)).toEqual({ dmg: 2, cooldown: 0.85 });
    expect(surgeMults(undefined, 3)).toEqual({ dmg: 1, cooldown: 1 });
  });

  it('Sky Cannon: 5★ Spirit Sphere grows 20% per living teammate, up to +100%', () => {
    const ult = kairo.ult;
    expect(cannonMult(ult, false, 4)).toBe(1);
    expect(cannonMult(ult, true, 0)).toBe(1);
    expect(cannonMult(ult, true, 2)).toBeCloseTo(1.4);
    expect(cannonMult(ult, true, 9)).toBeCloseTo(2);
    expect(ultFxStyle(kairo)).toBe('sweep');
  });

  it('6★ second wind triggers under 20% HP and heals 30%', () => {
    expect(SIG_PLUS.surgeBelow).toBe(0.2);
    expect(SIG_PLUS.surgeHeal).toBe(0.3);
  });

  it('Afterimage adds dodge on his stat sheet and the aura is a team effect', () => {
    expect(kairo.sp1.effect).toEqual({ kind: 'afterimage', value: 0.15 });
    expect(kairo.aura.effect?.team).toBe(true);
  });
});
