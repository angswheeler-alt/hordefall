import { describe, it, expect } from 'vitest';
import { HEROES, POOL_HEROES, RELEASED_HEROES } from '../src/data';
import { surgeStage, surgeMults, surgeDrain, cannonMult, surgeArt, SIG_PLUS } from '../src/kits';
import { ultFxStyle } from '../src/ultFx';

const kairo = HEROES.find((h) => h.id === 'kairo')!;

describe('Kairo', () => {
  it('is a Light Brawler with his own Signature, Ultimate and 6★ text', () => {
    expect(kairo).toBeTruthy();
    expect(kairo.name).toBe('Gogu');
    expect(kairo.element).toBe('light');
    expect(kairo.type).toBe('Brawler');
    expect(kairo.signature?.kind).toBe('surge');
    expect(kairo.ult?.kind).toBe('cannon');
    expect(kairo.ultPlus && kairo.sigPlus).toBeTruthy();
    for (const h of HEROES) if (h !== kairo) expect(h.signature?.kind, h.id).not.toBe('surge');
  });

  it('is released but stays out of random pools (Arena Shop and rare drops only)', () => {
    expect(RELEASED_HEROES).toContain('kairo');
    expect(POOL_HEROES.some((h) => h.id === 'kairo')).toBe(false);
  });

  it('climbs a surge stage every 7 seconds, up to Overdrive (stage 4) at 28 s', () => {
    const sig = kairo.signature;
    expect(surgeStage(sig, 0)).toBe(0);
    expect(surgeStage(sig, 6.9)).toBe(0);
    expect(surgeStage(sig, 7)).toBe(1);
    expect(surgeStage(sig, 14)).toBe(2);
    expect(surgeStage(sig, 21)).toBe(3);
    expect(surgeStage(sig, 28)).toBe(4);
    expect(surgeStage(sig, 999)).toBe(4);
    // 6★ jump adds a stage but never past the top.
    expect(surgeStage(sig, 0, 1)).toBe(1);
    expect(surgeStage(sig, 21, 1)).toBe(4);
    expect(surgeStage(sig, 28, 1)).toBe(4);
    expect(surgeStage(undefined, 99)).toBe(0);
  });

  it('gives +30/+60/+100% ATK and faster attacks from stage 2', () => {
    const sig = kairo.signature;
    expect(surgeMults(sig, 0)).toEqual({ dmg: 1, cooldown: 1 });
    expect(surgeMults(sig, 1)).toEqual({ dmg: 1.3, cooldown: 1 });
    expect(surgeMults(sig, 2)).toEqual({ dmg: 1.6, cooldown: 0.85 });
    expect(surgeMults(sig, 3)).toEqual({ dmg: 2, cooldown: 0.85 });
    expect(surgeMults(sig, 4)).toEqual({ dmg: 2.5, cooldown: 0.85 });
    expect(surgeMults(undefined, 3)).toEqual({ dmg: 1, cooldown: 1 });
  });

  it('Overdrive burns 2% max HP a second, only at stage 4, never below 10%', () => {
    const sig = kairo.signature;
    expect(surgeDrain(sig, 3, 0.8, 1)).toBe(0.8);
    expect(surgeDrain(sig, 4, 0.8, 1)).toBeCloseTo(0.78);
    expect(surgeDrain(sig, 4, 0.11, 5)).toBe(0.1);
    expect(surgeDrain(sig, 4, 0.05, 5)).toBe(0.05);
    expect(surgeDrain(undefined, 4, 0.8, 1)).toBe(0.8);
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

  it('picks the best surge look he has for his stage', () => {
    const only2 = (id: string) => id === 'kairo_surge';
    expect(surgeArt(1, only2)).toBeNull();
    expect(surgeArt(2, only2)).toBe('kairo_surge');
    expect(surgeArt(4, only2)).toBe('kairo_surge');
    expect(surgeArt(3, (id) => id === 'kairo_surge')).toBe('kairo_surge');
    const all = () => true;
    expect(surgeArt(1, all)).toBe('kairo_surge1');
    expect(surgeArt(3, all)).toBe('kairo_ascend3');
    expect(surgeArt(4, all)).toBe('kairo_overdrive');
  });
});
