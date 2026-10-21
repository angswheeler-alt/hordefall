import { beforeEach, describe, expect, it } from 'vitest';
import { GameState } from '../src/state';
import { HEROES, AWAKEN_STARMOTES, AWAKEN_STAT_MULT, AWAKEN_UNLOCK_LEVEL, MAX_AWAKEN, STAR_STAT_MULT } from '../src/data';
import { keeperThreshold } from '../src/formulas';

const starter = HEROES.find((h) => h.unlockCost === 0)!;

/** A fresh game at player level AWAKEN_UNLOCK_LEVEL. */
function opened(): GameState {
  const s = new GameState();
  s.lifetimeEmbers = keeperThreshold(AWAKEN_UNLOCK_LEVEL - 1);
  return s;
}

beforeEach(() => localStorage.clear());

describe('Pink awakening stars', () => {
  it('pace days, then weeks, then months: costs only go up, 8 stars in all', () => {
    expect(MAX_AWAKEN).toBe(8);
    for (let i = 1; i < AWAKEN_STARMOTES.length; i++) expect(AWAKEN_STARMOTES[i]).toBeGreaterThan(AWAKEN_STARMOTES[i - 1]);
    expect(AWAKEN_STAT_MULT).toBe(1.5);
  });

  it('stay closed below the unlock player level', () => {
    const s = new GameState();
    s.starmotes = 10_000;
    expect(s.awakenOpen()).toBe(false);
    expect(s.awakenHero(starter.id)).toBe(false);
    expect(s.awaken[starter.id] ?? 0).toBe(0);
    expect(opened().awakenOpen()).toBe(true);
  });

  it('cost Starmotes and never pass the yellow stars', () => {
    const s = opened();
    s.starmotes = AWAKEN_STARMOTES[0] + AWAKEN_STARMOTES[1];
    expect(s.awakenHero(starter.id)).toBe(true);
    expect(s.awaken[starter.id]).toBe(1);
    expect(s.starmotes).toBe(AWAKEN_STARMOTES[1]);
    // 1★ hero: one pink star at most.
    expect(s.awakenHero(starter.id)).toBe(false);
    expect(s.awakenBlock(starter.id)).toMatch(/Evolve to 2★/);
    s.stars[starter.id] = 1;
    expect(s.awakenHero(starter.id)).toBe(true);
    expect(s.awaken[starter.id]).toBe(2);
    expect(s.starmotes).toBe(0);
  });

  it('need enough Starmotes and a recruited hero', () => {
    const s = opened();
    s.starmotes = AWAKEN_STARMOTES[0] - 1;
    expect(s.awakenHero(starter.id)).toBe(false);
    const locked = HEROES.find((h) => (s.levels[h.id] ?? 0) === 0)!;
    s.starmotes = 10_000;
    expect(s.awakenBlock(locked.id)).toMatch(/Recruit/);
  });

  it('multiply all stats by 1.5 each and raise Combat Power', () => {
    const s = opened();
    const before = s.heroPower(starter);
    const cpBefore = s.heroCombatPower(starter);
    s.awaken[starter.id] = 1;
    const after = s.heroPower(starter);
    expect(after.atk.div(before.atk).toNumber()).toBeCloseTo(AWAKEN_STAT_MULT, 6);
    expect(after.hp.div(before.hp).toNumber()).toBeCloseTo(AWAKEN_STAT_MULT, 6);
    expect(after.defense.div(before.defense).toNumber()).toBeCloseTo(AWAKEN_STAT_MULT, 6);
    expect(s.heroCombatPower(starter).gt(cpBefore)).toBe(true);
    s.stars[starter.id] = 2;
    s.awaken[starter.id] = 3;
    expect(s.starMultiplier(starter.id)).toBeCloseTo(Math.pow(STAR_STAT_MULT, 2) * Math.pow(AWAKEN_STAT_MULT, 3), 9);
  });

  it('save, load, survive Rekindle and get clamped to the yellow stars', () => {
    const s = opened();
    s.stars[starter.id] = 3;
    s.awaken[starter.id] = 3;
    s.starmotes = 42;
    s.save();
    const t = new GameState();
    expect(t.load()).toBe(true);
    expect(t.awaken[starter.id]).toBe(3);
    expect(t.starmotes).toBe(42);
    // A hand-edited save with more pink than yellow stars is clamped.
    const raw = JSON.parse(localStorage.getItem([...(localStorage as any).keys()].find((k: string) => !k.includes('unreadable'))!)!);
    raw.awaken[starter.id] = 8;
    raw.starmotes = -5;
    GameState.writeLocal(raw);
    const u = new GameState();
    u.load();
    expect(u.awaken[starter.id]).toBe(4);
    expect(u.starmotes).toBe(0);
  });
});
