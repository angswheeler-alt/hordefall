import { beforeEach, describe, expect, it } from 'vitest';
import { GameState } from '../src/state';
import { HEROES, AWAKEN_UNLOCK_LEVEL } from '../src/data';
import { keeperThreshold } from '../src/formulas';
import { ARENA_HEROES, ARENA_ITEMS, GLORY_LOSS, GLORY_WIN, PASTA_ID, PASTA_UNLOCK, arenaItems, fightGlory, pastaDrop } from '../src/arenaShop';

const MON = new Date('2026-11-09T12:00:00').getTime();
const DAY = 86_400_000;
const starter = HEROES.find((h) => h.unlockCost === 0)!;

function opened(): GameState {
  const s = new GameState();
  s.lifetimeEmbers = keeperThreshold(AWAKEN_UNLOCK_LEVEL - 1);
  s.emberLevels[starter.id] = 50;
  return s;
}

beforeEach(() => localStorage.clear());

describe('Glory', () => {
  it('pays for every fight, won or lost', () => {
    expect(fightGlory(true)).toBe(GLORY_WIN);
    expect(fightGlory(false)).toBe(GLORY_LOSS);
  });

  it('banks fight Starmotes for the season payout and pays Glory now', () => {
    const s = opened();
    s.pvpTick(MON);
    s.rollPvpOpponents(MON);
    expect(s.startPvp(0, MON)).not.toBeNull();
    const r = s.finishPvp(true, MON)!;
    expect(r.glory).toBe(GLORY_WIN);
    expect(s.glory).toBe(GLORY_WIN);
    expect(s.starmotes).toBe(0);
    expect(s.pvp.season).toBe(r.starmotes);
    s.pvpTick(MON + 7 * DAY);
    expect(s.starmotes).toBeGreaterThanOrEqual(r.starmotes);
    expect(s.pvp.season).toBe(0);
  });

  it('survives a save and load', () => {
    const s = opened();
    s.glory = 321;
    s.arenaBuys = { week: 'x', n: { wild: 2 } };
    s.save();
    const t = new GameState();
    t.load();
    expect(t.glory).toBe(321);
    expect(t.arenaBuys.n.wild).toBe(2);
  });
});

describe('Arena Shop', () => {
  it('sells the four permanent heroes, 2 Rare and 2 Epic, all real released heroes', () => {
    const defs = ARENA_HEROES.map((id) => HEROES.find((h) => h.id === id)!);
    expect(defs.every(Boolean)).toBe(true);
    expect(defs.filter((h) => h.rarity === 'rare')).toHaveLength(2);
    expect(defs.filter((h) => h.rarity === 'epic')).toHaveLength(2);
    for (const id of ARENA_HEROES) expect(ARENA_ITEMS.some((i) => i.hero === id)).toBe(true);
  });

  it('never sells Colosseum tickets, and hides Pasta until he is released', () => {
    expect(ARENA_ITEMS.some((i) => /ticket/i.test(i.id))).toBe(false);
    expect(arenaItems(false).some((i) => i.hero === PASTA_ID)).toBe(false);
    expect(arenaItems(true).some((i) => i.hero === PASTA_ID)).toBe(true);
  });

  it('spends Glory, gives the item and keeps to the weekly limit', () => {
    const s = opened();
    const core = ARENA_ITEMS.find((i) => i.id === 'coreE')!;
    s.glory = core.price * 3;
    const before = s.forge.coreE;
    expect(s.buyArena('coreE', MON)).toBe(true);
    expect(s.forge.coreE).toBe(before + 1);
    expect(s.glory).toBe(core.price * 2);
    expect(s.buyArena('coreE', MON)).toBe(false); // 1 a week
    expect(s.buyArena('coreE', MON + 7 * DAY)).toBe(true); // next season
  });

  it('gives hero crests and refuses when Glory is short', () => {
    const s = opened();
    const item = ARENA_ITEMS.find((i) => i.id === 'h:valorian')!;
    s.glory = item.price - 1;
    expect(s.buyArena(item.id, MON)).toBe(false);
    s.glory = item.price;
    expect(s.buyArena(item.id, MON)).toBe(true);
    expect(s.crests.valorian).toBe(item.amount);
  });
});

describe('Pasta', () => {
  it('takes 100 crests to unlock and stays hidden from players for now', async () => {
    const { RELEASED_HEROES } = await import('../src/data');
    const s = new GameState();
    expect(s.unlockCrests(HEROES.find((h) => h.id === PASTA_ID)!)).toBe(PASTA_UNLOCK);
    expect(RELEASED_HEROES).not.toContain(PASTA_ID);
  });

  it('rare drops only once released, at the given chance', () => {
    expect(pastaDrop(() => 0, 0.01, 4, false)).toBe(0);
    expect(pastaDrop(() => 0.005, 0.01, 4, true)).toBe(4);
    expect(pastaDrop(() => 0.5, 0.01, 4, true)).toBe(0);
  });
});
