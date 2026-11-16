import { describe, it, expect } from 'vitest';
import { HEROES, POOL_HEROES, RELEASED_HEROES, HIDDEN_HEROES } from '../src/data';
import { rageStep, titanForm, titanArtKey, SIG_PLUS } from '../src/kits';
import { arenaItems, releasedUniques, isUnique, YEREN_ID, YEREN_RELEASED } from '../src/arenaShop';
import { heroForms } from '../src/heroForms';
import { ultFxStyle } from '../src/ultFx';

const yeren = HEROES.find((h) => h.id === 'yeren')!;

describe('Yeren, the titan shifter', () => {
  it('is a unique Earth Barbarian with his own Signature, Ultimate and star twists', () => {
    expect(yeren).toBeTruthy();
    expect(yeren.element).toBe('earth');
    expect(yeren.type).toBe('Barbarian');
    expect(yeren.unique).toBe(true);
    expect(yeren.rarity).toBe('epic');
    expect(yeren.statRarity).toBe('legendary');
    expect(yeren.signature?.kind).toBe('titan');
    expect(yeren.ult?.kind).toBe('roar');
    expect(yeren.sigPlus && yeren.ultPlus).toBeTruthy();
    for (const h of HEROES) if (h !== yeren) expect(h.signature?.kind, h.id).not.toBe('titan');
    expect(ultFxStyle(yeren)).toBe('rise');
  });

  it('stays hidden (no shop, no drops, no pools) until his art is in', () => {
    expect(YEREN_RELEASED).toBe(false);
    expect(HIDDEN_HEROES).toContain('yeren');
    expect(RELEASED_HEROES).not.toContain('yeren');
    expect(POOL_HEROES.some((h) => h.id === 'yeren')).toBe(false);
    expect(isUnique(YEREN_ID)).toBe(true);
    expect(releasedUniques()).not.toContain(YEREN_ID);
    expect(arenaItems().some((i) => i.hero === YEREN_ID)).toBe(false);
  });

  it('is sold like Gogu once released, and never in random pools', () => {
    const items = arenaItems(true, true, true);
    const y = items.find((i) => i.hero === YEREN_ID)!;
    const g = items.find((i) => i.hero === 'kairo')!;
    expect({ ...y, id: 'x', hero: 'x' }).toEqual({ ...g, id: 'x', hero: 'x' });
    expect(releasedUniques(true, true, true, false)).toEqual(['pasta', 'kairo', 'yeren']);
    expect(arenaItems(true, true, false).some((i) => i.hero === YEREN_ID)).toBe(false);
  });

  it('fills Rage from blows landed and HP lost, and shifts at a full bar', () => {
    const sig = yeren.signature;
    expect(rageStep(sig, 0, 1, 0)).toEqual({ rage: 10, shift: false });
    // 10% of max HP lost = 15 Rage.
    expect(rageStep(sig, 0, 0, 0.1).rage).toBeCloseTo(15);
    // Grapple Rig: 50% faster.
    expect(rageStep(sig, 0, 1, 0, 1.5).rage).toBeCloseTo(15);
    expect(rageStep(sig, 95, 1, 0)).toEqual({ rage: 100, shift: true });
    // 10 blows with no damage taken.
    let r = 0, n = 0;
    while (!rageStep(sig, r, 1, 0).shift) { r = rageStep(sig, r, 1, 0).rage; n++; }
    expect(n + 1).toBe(10);
    expect(rageStep(undefined, 50, 3, 0.5)).toEqual({ rage: 0, shift: false });
  });

  it('becomes a 12 s titan: 3.5x hits, a stone body of 2.5x max HP', () => {
    const sig = yeren.signature;
    expect(titanForm(sig)).toEqual({ seconds: 12, body: 2.5, hide: 1, dmg: 3.5, cooldown: 1 });
    // Titan Bulk (SP2) makes the body bigger.
    expect(titanForm(sig, false, 1.3).body).toBeCloseTo(3.25);
    // 6★ Hardened Hide: 30% less damage to the body, 4 s longer.
    expect(titanForm(sig, true)).toMatchObject({ seconds: 16, hide: SIG_PLUS.titanHide });
    expect(SIG_PLUS.titanHide).toBe(0.7);
    expect(titanForm(undefined)).toEqual({ seconds: 0, body: 0, hide: 1, dmg: 1, cooldown: 1 });
  });

  it('hits hard as the titan but not forever: about half the fight in each form', () => {
    const f = titanForm(yeren.signature);
    expect(f.dmg / f.cooldown).toBeGreaterThan(2.5);
    expect(f.dmg / f.cooldown).toBeLessThanOrEqual(3.5);
  });

  it('star skills are his own effects, and the aura is a team effect', () => {
    expect(yeren.sp1.effect).toEqual({ kind: 'rageGain', value: 1.5 });
    expect(yeren.sp2.effect).toEqual({ kind: 'titanBody', value: 1.3 });
    expect(yeren.aura.effect).toEqual({ kind: 'titanGuard', value: 0.8, team: true });
  });

  it('shows a Titan form on the Stars tab once the titan art lands', () => {
    expect(titanArtKey('yeren')).toBe('yeren_titan');
    expect(heroForms('yeren', () => false)).toBeNull();
    const f = heroForms('yeren', (k) => k === 'yeren_titan')!;
    expect(f.map((x) => x.art)).toEqual(['yeren', 'yeren_titan']);
    expect(f[1].name).toBe('Titan');
  });
});
