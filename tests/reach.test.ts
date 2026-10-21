import { describe, it, expect } from 'vitest';
import Decimal from 'break_infinity.js';
import { HEROES } from '../src/data';
import { MOB_KINDS } from '../src/mobs';
import { canReach, isMelee, pickVictim } from '../src/reach';
import { simulatePvp, type PvpUnit } from '../src/colosseum';

const flyer = { flying: true };
const walker = {};

describe('melee vs flyers', () => {
  it('melee attackers on the ground cannot hit flying heroes', () => {
    expect(canReach({ range: MOB_KINDS.grunt.range }, flyer)).toBe(false);
    expect(canReach({ range: MOB_KINDS.brute.range }, flyer)).toBe(false);
    expect(canReach({ range: MOB_KINDS.grunt.range }, walker)).toBe(true);
  });

  it('ranged and magic attackers, other flyers and bosses still can', () => {
    expect(canReach({ range: MOB_KINDS.caster.range }, flyer)).toBe(true);
    expect(canReach({ range: MOB_KINDS.flyer.range, flying: true }, flyer)).toBe(true);
    expect(canReach({ range: 40, isBoss: true }, flyer)).toBe(true);
  });

  it('melee heroes on the ground cannot hit flying mobs either', () => {
    const brine = HEROES.find((h) => h.id === 'brine')!;
    expect(canReach(brine, { flying: true })).toBe(false);
    expect(canReach(brine, {})).toBe(true);
    expect(canReach({ range: 30, flying: true }, { flying: true })).toBe(true);
    expect(canReach(HEROES.find((h) => h.id === 'rook')!, { flying: true })).toBe(true);
  });

  it('counts every hero Type the same way the Colosseum front line does', () => {
    for (const h of HEROES) expect(isMelee(h)).toBe(h.range <= 60);
    expect(HEROES.some((h) => h.flying && isMelee(h))).toBe(true);
  });
});

describe('who an enemy goes for', () => {
  const grunt = { x: 500, range: 22 };

  it('skips a flying hero in front for the ground hero behind it', () => {
    const pick = pickVictim(grunt, [
      { x: 400, alive: true, flying: true },
      { x: 300, alive: true },
    ]);
    expect(pick.target?.x).toBe(300);
  });

  it('turns back for a ground hero it walked past', () => {
    const pick = pickVictim(grunt, [
      { x: 450, alive: true, flying: true },
      { x: 560, alive: true },
    ]);
    expect(pick.target?.x).toBe(560);
  });

  it('waits under the nearest flyer when only flyers are left', () => {
    const pick = pickVictim(grunt, [
      { x: 200, alive: true, flying: true },
      { x: 420, alive: true, flying: true },
      { x: 480, alive: false },
    ]);
    expect(pick).toEqual({ holdX: 420 });
  });

  it('a caster still shoots the flyer', () => {
    expect(pickVictim({ x: 500, range: 100 }, [{ x: 420, alive: true, flying: true }]).target?.x).toBe(420);
  });

  it('has nothing to do when the whole team is down', () => {
    expect(pickVictim(grunt, [{ x: 420, alive: false }])).toEqual({});
  });
});

describe('Colosseum forecast', () => {
  const unit = (o: Partial<PvpUnit>): PvpUnit => ({
    id: 'x', element: 'water', atk: new Decimal(10), hp: new Decimal(100), def: new Decimal(0), attacksPerSec: 1, critRate: 0, critDmg: 0, melee: true, ...o,
  });

  it('a melee team cannot touch a flying team', () => {
    const r = simulatePvp([unit({ atk: new Decimal(1000) })], [unit({ flying: true, melee: false, atk: new Decimal(1) })]);
    expect(r.won).toBe(false);
    expect(r.hits.every((h) => h.side === 1)).toBe(true);
  });

  it('melee hit the ground units and skip the flyers', () => {
    // fightOrder puts the melee ground unit first (index 0), the flyer second.
    const r = simulatePvp([unit({})], [unit({ flying: true, melee: false, atk: new Decimal(0) }), unit({ atk: new Decimal(0) })]);
    expect(r.hits.filter((h) => h.side === 0).every((h) => h.to === 0)).toBe(true);
    expect(r.left[1]).toEqual([0, 1]);
  });
});
