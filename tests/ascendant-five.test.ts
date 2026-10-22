import { describe, it, expect } from 'vitest';
import { HEROES, RELEASED_HEROES, elementBoss, type HeroDef } from '../src/data';
import { ASCENDANT_FIVE } from '../src/heroes/ascendant';
import { resolveForm, chargeOf, chargeStep, chargeDamageMult, chargeText, COUNTERED_BY, MAX_FORM, type Charge } from '../src/ascendant';

const ELEMENTS = ['dark', 'fire', 'light', 'water', 'earth'] as const;
const dps = (h: HeroDef) => h.baseAtk / h.attackCooldown;
const forms = (i: number) => [0, 1, 2, 3].map((f) => resolveForm(ASCENDANT_FIVE[i], f));

describe('the five Ascendant heroes', () => {
  it('are one per element under codename ids, and still hidden', () => {
    expect(ASCENDANT_FIVE.map((a) => a.base.id)).toEqual(ELEMENTS.map((e) => `asc_${e}`));
    expect(ASCENDANT_FIVE.map((a) => a.base.element)).toEqual([...ELEMENTS]);
    for (const a of ASCENDANT_FIVE) {
      expect(HEROES.some((h) => h.id === a.base.id)).toBe(false);
      expect(RELEASED_HEROES).not.toContain(a.base.id);
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
