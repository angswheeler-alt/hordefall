import { beforeEach, describe, expect, it } from 'vitest';
import Decimal from 'break_infinity.js';
import { GameState } from '../src/state';
import { HEROES } from '../src/data';

const starter = HEROES.find((h) => h.unlockCost === 0)!;
const other = HEROES.find((h) => h.id !== starter.id && h.rarity !== 'legendary')!;

beforeEach(() => localStorage.clear());

/** A rich save with the starter and one more hero on the team. */
function save() {
  const s = new GameState();
  s.teamSlots = 3;
  s.levels[other.id] = 20;
  s.gold = new Decimal('1e30');
  s.embers = new Decimal('1e30');
  return s;
}

describe('only heroes on the team can be levelled', () => {
  it('team heroes take gold and Ember levels', () => {
    const s = save();
    expect(s.levelBlock(other.id)).toBeNull();
    expect(s.buyGoldLevels(other.id, 1)).toBe(1);
    expect(s.levels[other.id]).toBe(21);
    expect(s.buyEmbers(other.id, 1)).toBe(1);
    expect(s.emberLevels[other.id]).toBe(1);
  });

  it('a benched hero takes no gold or Ember levels and nothing is spent', () => {
    const s = save();
    s.emberLevels[other.id] = 5;
    s.setInLineup(other.id, false);
    const gold = s.gold.toString();
    const embers = s.embers.toString();
    expect(s.levelBlock(other.id)).toBe('Add to team to level');
    expect(s.buyGoldLevels(other.id, 1)).toBe(0);
    expect(s.buyGoldLevels(other.id, 'max')).toBe(0);
    expect(s.buyEmbers(other.id, 1)).toBe(0);
    expect(s.buyEmbers(other.id, 'max')).toBe(0);
    expect(s.levels[other.id]).toBe(1);
    expect(s.emberLevels[other.id]).toBe(5);
    expect(s.gold.toString()).toBe(gold);
    expect(s.embers.toString()).toBe(embers);
  });

  it('benching still refunds gold levels and keeps Embers; back on the team levelling works again', () => {
    const s = save();
    s.emberLevels[other.id] = 5;
    const spent = s.goldSpent(other.id);
    const before = s.gold;
    expect(s.setInLineup(other.id, false)!.toString()).toBe(spent.toString());
    expect(s.gold.toString()).toBe(before.plus(spent).toString());
    expect(s.emberLevels[other.id]).toBe(5);
    s.setInLineup(other.id, true);
    expect(s.buyGoldLevels(other.id, 1)).toBe(1);
    expect(s.buyEmbers(other.id, 1)).toBe(1);
    expect(s.emberLevels[other.id]).toBe(6);
  });

  it('a locked hero takes no levels', () => {
    const s = save();
    const locked = HEROES.find((h) => !s.levels[h.id])!;
    expect(s.levelBlock(locked.id)).not.toBeNull();
    expect(s.buyGoldLevels(locked.id, 1)).toBe(0);
    expect(s.buyEmbers(locked.id, 1)).toBe(0);
  });
});
