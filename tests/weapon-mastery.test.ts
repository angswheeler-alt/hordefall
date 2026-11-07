import { beforeEach, describe, expect, it } from 'vitest';
import { GameState } from '../src/state';
import { HEROES } from '../src/data';
import { MASTERY_STEP, WEAPON_MAX_LEVEL, masteryCost, masteryMult } from '../src/weapons';

beforeEach(() => localStorage.clear());

describe('Weapon Mastery', () => {
  it('opens only at max weapon level, spends materials and adds 5% ATK and HP per rank', () => {
    const s = new GameState();
    const h = HEROES.find((x) => x.unlockCost === 0)!;
    expect(s.masteryCost(h.id)).toBeNull();
    expect(s.masteryBlock(h.id)).toBe(`Weapon level ${WEAPON_MAX_LEVEL} first`);
    s.weapons[h.id] = WEAPON_MAX_LEVEL;
    const before = s.heroPower(h);
    const cost = masteryCost(0)!;
    s.forge = { ore: cost.ore!, crystal: cost.crystal!, coreC: cost.coreC!, coreR: cost.coreR!, coreE: cost.coreE! };
    expect(s.upgradeMastery(h.id)).toBe(true);
    expect(s.masteryRank(h.id)).toBe(1);
    expect(s.forge).toEqual({ ore: 0, crystal: 0, coreC: 0, coreR: 0, coreE: 0 });
    expect(s.heroPower(h).atk.div(before.atk).toNumber()).toBeCloseTo(MASTERY_STEP);
    expect(s.upgradeMastery(h.id)).toBe(false);
    expect(s.masteryBlock(h.id)).toBe('Not enough materials');
  });

  it('costs grow every rank and the rank survives a save and load', () => {
    expect(masteryCost(10)!.ore!).toBeGreaterThan(masteryCost(9)!.ore!);
    expect(masteryCost(5)!.coreE).toBe(2);
    expect(masteryMult(3)).toBeCloseTo(Math.pow(MASTERY_STEP, 3));
    const s = new GameState();
    const h = HEROES.find((x) => x.unlockCost === 0)!;
    s.weaponMastery[h.id] = 4;
    GameState.writeLocal(s.toJSON());
    const t = new GameState();
    expect(t.load()).toBe(true);
    expect(t.masteryRank(h.id)).toBe(4);
  });
});

describe('Weapon Mastery cap', () => {
  it('stops at rank 20', () => {
    expect(masteryCost(19)).not.toBeNull();
    expect(masteryCost(20)).toBeNull();
  });
});
