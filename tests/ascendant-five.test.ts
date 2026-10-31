import { describe, it, expect } from 'vitest';
import { HEROES, RELEASED_HEROES, elementBoss, type HeroDef } from '../src/data';
import { ASCENDANT_FIVE } from '../src/heroes/ascendant';
import { maskTriggers, barrageHits, zealState, torrentMults, spiritTargets } from '../src/kits';
import { resolveForm, chargeOf, chargeStep, chargeDamageMult, chargeText, COUNTERED_BY, MAX_FORM, type Charge } from '../src/ascendant';

const ELEMENTS = ['dark', 'fire', 'light', 'water', 'earth'] as const;
const dps = (h: HeroDef) => h.baseAtk / h.attackCooldown;
const forms = (i: number) => [0, 1, 2, 3].map((f) => resolveForm(ASCENDANT_FIVE[i], f));

describe('the five Ascendant heroes', () => {
  it('are one per element under codename ids, and released', () => {
    expect(ASCENDANT_FIVE.map((a) => a.base.id)).toEqual(ELEMENTS.map((e) => `asc_${e}`));
    expect(ASCENDANT_FIVE.map((a) => a.base.element)).toEqual([...ELEMENTS]);
    for (const a of ASCENDANT_FIVE) {
      expect(HEROES.some((h) => h.id === a.base.id)).toBe(true);
      expect(RELEASED_HEROES).toContain(a.base.id);
      expect(a.base.rarity).toBe('common');
    }
  });

  it('keep their element in every form, so every hit counts as that element (Earth wind included)', () => {
    ASCENDANT_FIVE.forEach((a, i) => {
      for (const f of forms(i)) expect(f.element).toBe(a.base.element);
    });
  });

  it('have their own art key and a Charge in every form, shown in the Signature text', () => {
    ASCENDANT_FIVE.forEach((a, i) => {
      forms(i).forEach((f, n) => {
        expect(f.art).toBe(n === 0 ? a.base.id : `${a.base.id}_f${n + 1}`);
        const c = chargeOf(f)!;
        expect(c).toBeDefined();
        expect(f.trait.text).toContain(chargeText(c));
        expect(f.signature).toBeDefined();
        expect(f.ult).toBeDefined();
      });
      expect(new Set(a.forms.map((f) => f.formName)).size).toBe(4);
    });
  });

  it('need the element boss they counter for their Legendary form', () => {
    for (const a of ASCENDANT_FIVE) {
      const boss = elementBoss(a.steps[MAX_FORM - 1].bestStage)!;
      expect(boss).not.toBeNull();
      expect(COUNTERED_BY[boss.element]).toBe(a.base.element);
    }
  });

  it('grow every form, starting no stronger than a Rare and ending at most 15% over the best Epic or Legendary of their Type', () => {
    ASCENDANT_FIVE.forEach((a, i) => {
      const f = forms(i);
      for (let n = 1; n <= MAX_FORM; n++) {
        expect(dps(f[n])).toBeGreaterThan(dps(f[n - 1]));
        expect(f[n].baseHp).toBeGreaterThanOrEqual(f[n - 1].baseHp);
      }
      const same = HEROES.filter((h) => h.type === a.base.type && !h.squad);
      const rares = same.filter((h) => h.rarity === 'rare' || h.rarity === 'common');
      const tops = same.filter((h) => h.rarity === 'epic' || h.rarity === 'legendary');
      expect(dps(f[0])).toBeLessThanOrEqual(Math.max(...rares.map(dps)));
      expect(dps(f[MAX_FORM])).toBeLessThanOrEqual(1.15 * Math.max(...tops.map(dps)));
      expect(f[MAX_FORM].baseHp).toBeLessThanOrEqual(1.5 * Math.max(...tops.map((h) => h.baseHp)));
    });
  });

  it('give the Dark swordsman the best boss damage of the five', () => {
    const boss = (i: number) => {
      const f = forms(i)[MAX_FORM];
      return dps(f) * chargeDamageMult(chargeOf(f)!, true);
    };
    for (let i = 1; i < ASCENDANT_FIVE.length; i++) expect(boss(0)).toBeGreaterThan(boss(i));
  });
});

describe('their own moves', () => {
  it('each has a Signature and Ultimate kind no other hero uses, kept through every form', () => {
    const others = HEROES.filter((h) => !h.id.startsWith('asc_'));
    const sigs = ASCENDANT_FIVE.map((_, i) => forms(i).map((f) => f.signature!.kind));
    const ults = ASCENDANT_FIVE.map((_, i) => forms(i).map((f) => f.ult!.kind));
    for (const kinds of [...sigs, ...ults]) expect(new Set(kinds).size).toBe(1);
    const own = [...sigs.map((k) => k[0]), ...ults.map((k) => k[0])];
    expect(new Set(own).size).toBe(10);
    for (const kind of own) {
      expect(others.some((h) => h.signature?.kind === kind || h.ult?.kind === kind)).toBe(false);
    }
    expect(sigs.map((k) => k[0])).toEqual(['mask', 'barrage', 'zeal', 'torrent', 'spirit']);
    expect(ults.map((k) => k[0])).toEqual(['crescent', 'bounce', 'sanctuary', 'hydro', 'tempest']);
  });

  it('mask goes on once a life, under its HP line or on a killing blow', () => {
    const mask = { kind: 'mask' as const, below: 0.3, heal: 0.3, haste: 0.5, seconds: 6, plusSeconds: 10 };
    expect(maskTriggers(mask, 0.5, false)).toBe(false);
    expect(maskTriggers(mask, 0.2, false)).toBe(true);
    expect(maskTriggers(mask, 0.2, true)).toBe(false);
    // A killing blow puts it on too (battle leaves the hero at 1% HP).
    expect(maskTriggers(mask, -0.5, false)).toBe(true);
  });

  it('barrage, zeal, torrent and spirit follow their numbers', () => {
    const barrage = { kind: 'barrage' as const, every: 4, hits: 4, plusHits: 6, mult: 0.6 };
    expect([1, 2, 3, 4, 8].map((n) => barrageHits(barrage, n))).toEqual([1, 1, 1, 4, 4]);
    expect(barrageHits(barrage, 4, true)).toBe(6);
    const zeal = { kind: 'zeal' as const, perStack: 0.1, max: 5, plusMax: 8, waveAt: 5, wave: 30 };
    expect(zealState(zeal, 0)).toEqual({ stacks: 0, cooldown: 1, wave: 0 });
    expect(zealState(zeal, 4).wave).toBe(0);
    expect(zealState(zeal, 9)).toEqual({ stacks: 5, cooldown: 1 / 1.5, wave: 30 });
    expect(zealState(zeal, 9, true).stacks).toBe(8);
    const torrent = { kind: 'torrent' as const, below: 0.4, plusBelow: 0.6, dmg: 1.5, guard: 0.6 };
    expect(torrentMults(torrent, 0.5)).toEqual({ dmg: 1, taken: 1 });
    expect(torrentMults(torrent, 0.5, true)).toEqual({ dmg: 1.5, taken: 0.6 });
    expect(torrentMults(torrent, 0.3)).toEqual({ dmg: 1.5, taken: 0.6 });
    const spirit = { kind: 'spirit' as const, every: 3, targets: 2, plusTargets: 3, mult: 1 };
    expect([1, 2, 3, 6].map((n) => spiritTargets(spirit, n))).toEqual([0, 0, 2, 2]);
    expect(spiritTargets(spirit, 3, true)).toBe(3);
  });
});

describe('Charge', () => {
  const c: Charge = { stacks: 3, boost: 'damage', value: 1 };

  it('fires on every Nth attack in a row and starts over', () => {
    let stacks = 0;
    const fired: boolean[] = [];
    for (let i = 0; i < 7; i++) {
      const s = chargeStep(stacks, c);
      stacks = s.stacks;
      fired.push(s.fired);
    }
    expect(fired).toEqual([false, false, true, false, false, true, false]);
  });

  it('boosts damage by kind', () => {
    expect(chargeDamageMult(c, false)).toBe(2);
    expect(chargeDamageMult({ stacks: 5, boost: 'bossDamage', value: 3 }, true)).toBe(4);
    expect(chargeDamageMult({ stacks: 5, boost: 'bossDamage', value: 3 }, false)).toBe(2.5);
    expect(chargeDamageMult({ stacks: 5, boost: 'attackSpeed', value: 0.5 }, true)).toBe(1);
  });

  it('reads well on the hero page', () => {
    expect(chargeText(c)).toBe('Charge: every 3rd attack in a row hits for +100% damage.');
    expect(chargeText({ stacks: 6, boost: 'attackSpeed', value: 0.3 })).toBe('Charge: every 6th attack in a row speeds up attacks by 30% for 4 seconds.');
  });
});
