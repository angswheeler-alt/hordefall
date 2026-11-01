import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameState } from '../src/state';
import { GUILD_CHESTS_PER_WEEK, GUILD_SHOP } from '../src/data';

const at = (m: number, d: number, h = 12) => new Date(2026, m - 1, d, h).getTime();
const chestCost = GUILD_SHOP.find((i) => i.id === 'chest')!.cost;

let s: GameState;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(at(11, 2));
  localStorage.clear();
  s = new GameState();
  s.guildCredits = 100_000;
});
afterEach(() => vi.useRealTimers());

describe('Guild Shop Hero Chest weekly limit', () => {
  it('sells GUILD_CHESTS_PER_WEEK chests a week, then waits for the next week', () => {
    const mon = at(11, 2);
    for (let i = 0; i < GUILD_CHESTS_PER_WEEK; i++) expect(s.buyGuildItem('chest', mon)).not.toBeNull();
    expect(s.guildItemReady('chest', at(11, 8))).toBe(false);
    expect(s.buyGuildItem('chest', at(11, 8))).toBeNull();
    expect(s.guildCredits).toBe(100_000 - GUILD_CHESTS_PER_WEEK * chestCost);
    expect(s.buyGuildItem('chest', at(11, 9))).not.toBeNull();
  });

  it('keeps the count in the save', () => {
    const mon = at(11, 2);
    for (let i = 0; i < 4; i++) s.buyGuildItem('chest', mon);
    s.save();
    const t = new GameState();
    expect(t.load()).toBe(true);
    expect(t.guildShop.chests).toBe(4);
  });
});
