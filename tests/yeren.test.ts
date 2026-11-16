import { describe, it, expect } from 'vitest';
import { HEROES, POOL_HEROES, RELEASED_HEROES, HIDDEN_HEROES } from '../src/data';
import { rageStep, titanForm, titanArtKey, SIG_PLUS } from '../src/kits';
import { arenaItems, releasedUniques, isUnique, YEREN_ID, YEREN_RELEASED } from '../src/arenaShop';
import { heroForms } from '../src/heroForms';
import { ultFxStyle } from '../src/ultFx';
import { HERO_ANIMS } from '../src/heroAnims';

const yeren = HEROES.find((h) => h.id === 'yeren')!;

describe('Yeren, the titan shifter', () => {
  it('is a unique Earth Knight with his own Signature, Ultimate and star twists', () => {
    expect(yeren).toBeTruthy();
    expect(yeren.element).toBe('earth');
    expect(yeren.type).toBe('Knight');
    expect(yeren.unique).toBe(true);
    expect(yeren.rarity).toBe('epic');
    expect(yeren.statRarity).toBe('legendary');
    expect(yeren.signature?.kind).toBe('titan');
    expect(yeren.ult?.kind).toBe('roar');
    expect(yeren.sigPlus && yeren.ultPlus).toBeTruthy();
    for (const h of HEROES) if (h !== yeren) expect(h.signature?.kind, h.id).not.toBe('titan');
    expect(ultFxStyle(yeren)).toBe('rise');
  });

  it('is released with his art: sold in the Arena Shop, never in random pools', () => {
    expect(YEREN_RELEASED).toBe(true);
    expect(HIDDEN_HEROES).not.toContain('yeren');
    expect(RELEASED_HEROES).toContain('yeren');
    expect(POOL_HEROES.some((h) => h.id === 'yeren')).toBe(false);
    expect(isUnique(YEREN_ID)).toBe(true);
    expect(releasedUniques()).toContain(YEREN_ID);
    expect(arenaItems().some((i) => i.hero === YEREN_ID)).toBe(true);
  });

  it('has his run and attack sprites, bundled into the game code', () => {
    expect(HERO_ANIMS.yeren).toMatchObject({ run: 6, attack: 5 });
    const files = new Set(Object.keys(import.meta.glob('../src/assets/heroes/*.png')).map((f) => f.split('/').pop()));
    for (const f of ['yeren.png', 'yeren_run.png', 'yeren_attack.png']) expect(files.has(f), f).toBe(true);
  });

  it('has his own colossus sprites (Samuel 2026-11-16), drawn colossal next to his normal form', () => {
    const files = new Set(Object.keys(import.meta.glob('../src/assets/heroes/*.png')).map((f) => f.split('/').pop()));
    for (const f of ['yeren_titan.png', 'yeren_titan_run.png', 'yeren_titan_attack.png']) expect(files.has(f), f).toBe(true);
    const t = HERO_ANIMS[titanArtKey('yeren')], y = HERO_ANIMS.yeren;
    expect(t).toMatchObject({ run: 6, attack: 5 });
    // The colossus stands at least twice as tall as Yeren himself.
    expect(t.feet[1] - t.headTop).toBeGreaterThan(2 * (y.feet[1] - y.headTop));
  });

  it('is sold like Gogu once released, and never in random pools', () => {
    const items = arenaItems(true, true, true);
    const y = items.find((i) => i.hero === YEREN_ID)!;
    const g = items.find((i) => i.hero === 'kairo')!;
    expect({ ...y, id: 'x', hero: 'x' }).toEqual({ ...g, id: 'x', hero: 'x' });
    expect(releasedUniques(true, true, true, false)).toEqual(['pasta', 'kairo', 'yeren']);
    expect(arenaItems(true, true, false).some((i) => i.hero === YEREN_ID)).toBe(false);
  });

  it('fills Rage mostly from hits he takes, and shifts at a full bar', () => {
    const sig = yeren.signature;
    expect(rageStep(sig, 0, 1, 0)).toEqual({ rage: 5, shift: false });
    // 10% of max HP lost = 30 Rage: a third of his HP fills the bar.
    expect(rageStep(sig, 0, 0, 0.1).rage).toBeCloseTo(30);
    // Unbreakable Will: 50% faster.
    expect(rageStep(sig, 0, 1, 0, 1.5).rage).toBeCloseTo(7.5);
    expect(rageStep(sig, 97, 1, 0)).toEqual({ rage: 100, shift: true });
    // 20 blows with no damage taken.
    let r = 0, n = 0;
    while (!rageStep(sig, r, 1, 0).shift) { r = rageStep(sig, r, 1, 0).rage; n++; }
    expect(n + 1).toBe(20);
    expect(rageStep(undefined, 50, 3, 0.5)).toEqual({ rage: 0, shift: false });
  });

  it('becomes a 15 s colossus: a stone body of 4x max HP, slow 1.8x stomps', () => {
    const sig = yeren.signature;
    expect(titanForm(sig)).toEqual({ seconds: 15, body: 4, hide: 1, dmg: 1.8, cooldown: 1.25 });
    // Titan Bulk (SP2) makes the body bigger.
    expect(titanForm(sig, false, 1.3).body).toBeCloseTo(5.2);
    // 6★ Hardened Hide: 30% less damage to the body, 4 s longer.
    expect(titanForm(sig, true)).toMatchObject({ seconds: 19, hide: SIG_PLUS.titanHide });
    expect(SIG_PLUS.titanHide).toBe(0.7);
    expect(titanForm(undefined)).toEqual({ seconds: 0, body: 0, hide: 1, dmg: 1, cooldown: 1 });
  });

  it('is a tank (Samuel 2026-11-16): a Knight that pulls enemy attacks and scorches around him, drawn colossal', () => {
    expect(yeren.type).toBe('Knight');
    const sig = yeren.signature!;
    if (sig.kind !== 'titan') throw new Error('no titan');
    expect(sig.taunt).toBeGreaterThan(0);
    expect(sig.heat).toBeGreaterThan(sig.stomp);
    expect(sig.scale).toBeGreaterThanOrEqual(2);
    // Its blows hit only a little harder per second: it is there to soak, not to carry the damage.
    const f = titanForm(sig);
    expect(f.dmg / f.cooldown).toBeLessThan(1.6);
  });

  it('star skills are his own effects, and the aura is a team effect', () => {
    expect(yeren.sp1.effect).toEqual({ kind: 'rageGain', value: 1.5 });
    expect(yeren.sp2.effect).toEqual({ kind: 'titanBody', value: 1.3 });
    expect(yeren.aura.effect).toEqual({ kind: 'titanGuard', value: 0.75, team: true });
  });

  it('shows a Titan form on the Stars tab once the titan art lands', () => {
    expect(titanArtKey('yeren')).toBe('yeren_titan');
    expect(heroForms('yeren', () => false)).toBeNull();
    const f = heroForms('yeren', (k) => k === 'yeren_titan')!;
    expect(f.map((x) => x.art)).toEqual(['yeren', 'yeren_titan']);
    expect(f[1].name).toBe('Colossus');
  });
});
