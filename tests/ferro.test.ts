import { describe, it, expect } from 'vitest';
import { HEROES, POOL_HEROES, RELEASED_HEROES, HIDDEN_HEROES } from '../src/data';
import { reactorStep, salvoSize, salvoTargets, thrustersGrounded } from '../src/kits';
import { arenaItems, releasedUniques, isUnique, FERRO_RELEASED } from '../src/arenaShop';
import { canReach } from '../src/reach';
import { HERO_ANIMS } from '../src/heroAnims';

const ferro = HEROES.find((h) => h.id === 'ferro')!;
const sig = ferro.signature;

describe('Ferro', () => {
  it('is a flying Fire Gunner, one of a kind, with his own Signature, Ultimate and 5★/6★ text', () => {
    expect(ferro).toBeTruthy();
    expect(ferro.element).toBe('fire');
    expect(ferro.type).toBe('Gunner');
    expect(ferro.flying).toBe(true);
    expect(ferro.unique).toBe(true);
    expect(ferro.signature?.kind).toBe('reactor');
    expect(ferro.ult?.kind).toBe('solar');
    expect(ferro.ultPlus && ferro.sigPlus).toBeTruthy();
    for (const h of HEROES) if (h !== ferro) {
      expect(h.signature?.kind, h.id).not.toBe('reactor');
      expect(h.ult?.kind, h.id).not.toBe('solar');
    }
    expect(isUnique('ferro')).toBe(true);
  });

  it('is released with his sprites, sold in the Arena Shop, and never joins random pools', () => {
    expect(FERRO_RELEASED).toBe(true);
    expect(HIDDEN_HEROES).not.toContain('ferro');
    expect(RELEASED_HEROES).toContain('ferro');
    expect(POOL_HEROES.some((h) => h.id === 'ferro')).toBe(false);
    expect(arenaItems().some((i) => i.hero === 'ferro')).toBe(true);
    expect(releasedUniques()).toContain('ferro');
    expect(arenaItems(true, true, true, false).some((i) => i.hero === 'ferro')).toBe(false);
    expect(HERO_ANIMS.ferro).toMatchObject({ run: 6, attack: 5 });
    // Released, he sells next to Pasta and Gogu at the same price and limit.
    const item = arenaItems(true, true, true, true).find((i) => i.hero === 'ferro')!;
    const gogu = arenaItems(true, true, true, true).find((i) => i.hero === 'kairo')!;
    expect({ ...item, id: '', hero: '' }).toEqual({ ...gogu, id: '', hero: '' });
    expect(releasedUniques(true, true, true, true)).toContain('ferro');
  });

  it('fires a Salvo of 4 missiles every 6th shot (6 missiles at 6★)', () => {
    let charge = 0;
    const fired: number[] = [];
    for (let i = 1; i <= 12; i++) {
      const s = reactorStep(sig, charge);
      charge = s.charge;
      if (s.missiles) fired.push(i);
      if (s.missiles) expect(s.missiles).toBe(4);
    }
    expect(fired).toEqual([6, 12]);
    expect(reactorStep(sig, 5, true).missiles).toBe(6);
    expect(salvoSize(sig)).toBe(4);
    expect(salvoSize(sig, true)).toBe(6);
    // His Ultimate fills the forge to every - 1, so the next shot fires.
    expect(reactorStep(sig, 5).missiles).toBe(4);
    expect(reactorStep(undefined, 5)).toEqual({ charge: 0, missiles: 0 });
  });

  it('sends one missile per enemy, nearest first, and the spares into the toughest', () => {
    const foes = [{ dist: 200, hp: 10 }, { dist: 50, hp: 5 }, { dist: 120, hp: 90 }];
    expect(salvoTargets(foes, 4)).toEqual([1, 2, 0, 2]);
    expect(salvoTargets(foes, 2)).toEqual([1, 2]);
    expect(salvoTargets([{ dist: 10, hp: 1 }], 4)).toEqual([0, 0, 0, 0]);
    expect(salvoTargets([], 4)).toEqual([]);
  });

  it('lands under 35% HP and lifts off again once healed to 60%', () => {
    expect(thrustersGrounded(sig, false, 0.5)).toBe(false);
    expect(thrustersGrounded(sig, false, 0.34)).toBe(true);
    expect(thrustersGrounded(sig, true, 0.5)).toBe(true);
    expect(thrustersGrounded(sig, true, 0.6)).toBe(false);
    expect(thrustersGrounded(HEROES.find((h) => h.id === 'scorch')!.signature, false, 0.1)).toBe(false);
  });

  it('is out of ground melee reach in the air, but not once he lands', () => {
    const melee = { range: 30 };
    expect(canReach(melee, { flying: true })).toBe(false);
    expect(canReach(melee, { flying: false })).toBe(true);
    expect(canReach({ range: 30, isBoss: true }, { flying: true })).toBe(true);
    expect(canReach({ range: 150 }, { flying: true })).toBe(true);
  });
});
