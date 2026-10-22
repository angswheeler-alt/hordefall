import { describe, it, expect } from 'vitest';
import { isAscendant } from '../src/heroes/ascendant';
import Decimal from 'break_infinity.js';
import { HEROES, HERO_TYPES, TYPE_MASTERY, type HeroType } from '../src/data';
import { comboMult, executeMult, signatureReflect, splitHeal, controlEnd, BOSS_CC, SIG_PLUS } from '../src/kits';

// The five heroes built to the hero standard (design/base-heroes.md).
const standard = HEROES.filter((h) => ['brine', 'ember', 'thorn', 'lumen', 'rook'].includes(h.id));
const byId = (id: string) => HEROES.find((h) => h.id === id)!;

describe('hero standard', () => {
  it('has one standard hero per element, each a different Type', () => {
    expect(standard.map((h) => h.element).sort()).toEqual(['dark', 'earth', 'fire', 'light', 'water']);
    expect(new Set(standard.map((h) => h.type)).size).toBe(5);
  });

  it('gives every hero one of the ten Types, and all ten are in use', () => {
    expect(Object.keys(HERO_TYPES)).toHaveLength(10);
    for (const h of HEROES) expect(HERO_TYPES[h.type], h.id).toBeTruthy();
    expect(new Set(HEROES.map((h) => h.type)).size).toBe(10);
  });

  it('gives every standard hero a Signature and Ultimate of their own (Types can repeat)', () => {
    for (const h of standard) {
      expect(h.signature && h.ult && h.ultPlus).toBeTruthy();
    }
    for (const key of ['signature', 'ult'] as const) {
      const seen = standard.map((h) => JSON.stringify(h[key]));
      expect(new Set(seen).size).toBe(seen.length);
    }
    const kits = standard.map((h) => JSON.stringify([h.sp1.effect, h.sp2.effect, h.aura.effect]));
    expect(new Set(kits).size).toBe(kits.length);
  });

  it('keeps stats inside each Type budget', () => {
    const melee = { atk: [4.5, 6.5], hp: [45, 70] } as { atk: [number, number]; hp: [number, number] };
    const budget: Record<HeroType, { atk: [number, number]; hp: [number, number] }> = {
      Knight: { atk: [2.5, 4], hp: [140, 170] },
      Brawler: { atk: [2.5, 6], hp: [70, 170] },
      Barbarian: { atk: [4.5, 8], hp: [45, 75] },
      Lancer: melee,
      Samurai: melee,
      Rogue: melee,
      Ranger: { atk: [5, 7], hp: [40, 50] },
      Gunner: { atk: [5, 7], hp: [40, 50] },
      Magician: { atk: [7, 9.5], hp: [35, 60] },
      Support: { atk: [2.5, 3.5], hp: [50, 60] },
    };
    // Ascendant heroes have their own limits per form (tests/ascendant-five.test.ts).
    for (const h of HEROES.filter((x) => !isAscendant(x.id))) {
      const b = budget[h.type];
      expect(h.baseAtk).toBeGreaterThanOrEqual(b.atk[0]);
      expect(h.baseAtk).toBeLessThanOrEqual(b.atk[1]);
      expect(h.baseHp).toBeGreaterThanOrEqual(b.hp[0]);
      expect(h.baseHp).toBeLessThanOrEqual(b.hp[1]);
    }
  });

  it('keeps Brine as the free starter', () => {
    expect(byId('brine').unlockCost).toBe(0);
    expect(byId('brine').type).toBe('Samurai');
  });
});

describe('signatures', () => {
  const brine = byId('brine').signature;
  it('Riptide Combo ramps 10% a hit up to +50%', () => {
    expect(comboMult(brine, 0)).toBe(1);
    expect(comboMult(brine, 2)).toBeCloseTo(1.2);
    expect(comboMult(brine, 9)).toBeCloseTo(1.5);
    expect(comboMult(byId('rook').signature, 9)).toBe(1);
  });

  it('Executioner doubles damage below 30% HP', () => {
    const rook = byId('rook').signature;
    expect(executeMult(rook, 0.29)).toBe(2);
    expect(executeMult(rook, 0.3)).toBe(1);
    expect(executeMult(brine, 0.1)).toBe(1);
  });

  it('Bramble Hide reflects 20%', () => {
    expect(signatureReflect(byId('thorn').signature)).toBe(0.2);
    expect(signatureReflect(brine)).toBe(0);
  });

  it('Guiding Light turns overhealing into a shield capped at 20% of max HP', () => {
    const lumen = byId('lumen').signature;
    const d = (n: number) => new Decimal(n);
    const a = splitHeal(lumen, d(30), d(10), d(0), d(100));
    expect(a.hp.toNumber()).toBe(10);
    expect(a.shield.toNumber()).toBe(20);
    const b = splitHeal(lumen, d(5), d(0), d(18), d(100));
    expect(b.shield.toNumber()).toBe(20);
    const c = splitHeal(brine, d(30), d(10), d(0), d(100));
    expect(c.hp.toNumber()).toBe(10);
    expect(c.shield.toNumber()).toBe(0);
  });
});

describe('6-8★ unlocks', () => {
  it('gives every standard hero a Signature+ and every Type a Mastery', () => {
    for (const h of standard) expect(h.sigPlus, h.id).toBeTruthy();
    for (const t of Object.keys(HERO_TYPES) as HeroType[]) expect(TYPE_MASTERY[t].text, t).toBeTruthy();
  });

  it('Executioner+ works from 40% HP and Guiding Light+ shields up to 40%', () => {
    const rook = HEROES.find((h) => h.id === 'rook')!.signature;
    expect(executeMult(rook, 0.35)).toBe(1);
    expect(executeMult(rook, 0.35, true)).toBe(2);
    const lumen = HEROES.find((h) => h.id === 'lumen')!.signature;
    const max = new Decimal(100);
    expect(splitHeal(lumen, new Decimal(100), new Decimal(0), new Decimal(0), max, true).shield.toNumber()).toBe(100 * SIG_PLUS.overhealCap);
  });
});

describe('boss crowd-control resistance', () => {
  it('halves control on bosses and then makes them immune for a moment', () => {
    expect(controlEnd(false, 10, 0, 0, 2)).toEqual({ until: 12, immuneUntil: 0 });
    const first = controlEnd(true, 10, 0, 0, 2)!;
    expect(first.until).toBe(11);
    expect(first.immuneUntil).toBe(11 + BOSS_CC.immune);
    expect(controlEnd(true, 12, first.until, first.immuneUntil, 2)).toBeNull();
    expect(controlEnd(true, 13.5, first.until, first.immuneUntil, 2)?.until).toBe(14.5);
    // Bramble Wall names its own boss duration.
    expect(controlEnd(true, 0, 0, 0, 3, 1)?.until).toBe(1);
  });
});

describe('full roster', () => {
  it('gives every hero a unique id and a profile of its own', async () => {
    const { HERO_PROFILES } = await import('../src/profiles');
    const ids = HEROES.map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const h of HEROES) expect(HERO_PROFILES[h.id], h.id).toBeTruthy();
  });

  it('releases every hero (heroes without art use placeholder art)', async () => {
    const { RELEASED_HEROES } = await import('../src/data');
    for (const h of HEROES) expect(RELEASED_HEROES, h.id).toContain(h.id);
  });

  it('makes troop Commons squads of three, and only Commons', () => {
    const squads = HEROES.filter((h) => h.squad);
    expect(squads.length).toBe(10);
    for (const h of squads) {
      expect(h.squad).toBe(3);
      expect(h.rarity).toBe('common');
    }
  });

  it('keeps whole-team auras modest (element-only auras can go higher)', () => {
    for (const h of HEROES) {
      const fx = h.aura.effect;
      if (!fx?.team || fx.element) continue;
      if (fx.kind === 'atk' || fx.kind === 'hp' || fx.kind === 'def') expect(fx.value, h.id).toBeLessThanOrEqual(1.25);
      if (fx.kind === 'damageTaken') expect(fx.value, h.id).toBeGreaterThanOrEqual(0.88);
    }
  });
});
