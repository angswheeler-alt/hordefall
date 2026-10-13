import { beforeEach, describe, expect, it, vi } from 'vitest';
import Decimal from 'break_infinity.js';
import { GameState, rarityOdds } from '../src/state';
import {
  HEROES, STAR_CRESTS, MAX_STARS, LEGENDARY_MEDAL_RATE, CHEST_COST, CHEST_DROPS, CHEST_RARITY_WEIGHTS, LINEUP_SIZE,
  TICKET_CAP, TICKET_MINUTES, OFFLINE_CAP_HOURS, REKINDLE_STAGE, RELICS, RELIC_SLOT_COSTS, RELIC_START_SLOTS, TRIAL_LEVELS, RENAMED_HEROES,
} from '../src/data';

const starter = HEROES.find((h) => h.unlockCost === 0)!;
const other = HEROES.find((h) => h.unlockCost !== 0)!;

function fresh() {
  GameState.frozen = false;
  localStorage.clear();
  return new GameState();
}

beforeEach(() => {
  vi.useRealTimers();
});

describe('a new game', () => {
  it('starts with only the free starter recruited and in the lineup', () => {
    const s = fresh();
    expect(s.levels[starter.id]).toBe(1);
    expect(HEROES.filter((h) => s.levels[h.id] > 0).map((h) => h.id)).toEqual([starter.id]);
    expect(s.lineupCount()).toBe(1);
  });
});

describe('saving', () => {
  it('round-trips every field through toJSON/load', () => {
    const s = fresh();
    s.gold = new Decimal('1.5e40');
    s.stage = 77;
    s.reachStage(77);
    s.gems = 1234;
    s.embers = 55;
    s.emberLevels[starter.id] = 9;
    s.crests[other.id] = 42;
    s.stars[starter.id] = 2;
    s.essences.fire = 300;
    s.relics[RELICS[0].id] = 3;
    s.equipped = [RELICS[0].id];
    s.save();
    const t = new GameState();
    expect(t.load()).toBe(true);
    expect(t.toJSON()).toEqual(s.toJSON());
    expect(t.gold.toString()).toBe(s.gold.toString());
  });

  it('has no NaN, null or Infinity in a fresh save', () => {
    const s = fresh();
    const walk = (v: unknown, path: string): void => {
      if (typeof v === 'number') expect(Number.isFinite(v), path).toBe(true);
      else if (v === null) throw new Error(`null at ${path}`);
      else if (typeof v === 'object') for (const [k, x] of Object.entries(v as object)) walk(x, `${path}.${k}`);
    };
    walk(s.toJSON(), 'save');
  });

  it('moves old hero ids to their new names', () => {
    fresh();
    const [oldId, newId] = Object.entries(RENAMED_HEROES)[0];
    localStorage.setItem('hordefall-save-v1', JSON.stringify({ gold: '0', levels: { [oldId]: 30 }, crests: { [oldId]: 7 } }));
    const s = new GameState();
    s.load();
    expect(s.levels[newId]).toBe(30);
    expect(s.crests[newId]).toBe(7);
    expect(s.levels[oldId]).toBeUndefined();
  });

  it('survives a corrupt save without throwing', () => {
    fresh();
    localStorage.setItem('hordefall-save-v1', '{not json');
    const s = new GameState();
    expect(() => s.load()).not.toThrow();
  });

  it('stops saving once frozen (before a reload with another save)', () => {
    const s = fresh();
    s.save();
    GameState.wipe();
    s.gems = 999;
    s.save();
    expect(localStorage.getItem('hordefall-save-v1')).toBeNull();
    GameState.frozen = false;
  });

  it('never moves lastSeen backwards', () => {
    const s = fresh();
    s.lastSeen = Date.now() + 3_600_000; // the clock was wound back after a visit "in the future"
    const ahead = s.lastSeen;
    s.save();
    expect(s.lastSeen).toBe(ahead);
  });
});

describe('offline earnings', () => {
  it('pays nothing under a minute or for negative time', () => {
    const s = fresh();
    expect(s.applyOffline(30)).toBeNull();
    expect(s.applyOffline(-5000)).toBeNull();
  });

  it('is capped and stops one stage before the next boss', () => {
    const s = fresh();
    s.goldPerSec = 10;
    s.secondsPerStage = 1;
    s.stage = 3;
    const r = s.applyOffline(1e9)!;
    expect(r.seconds).toBe(OFFLINE_CAP_HOURS * 3600);
    expect(s.stage).toBe(49);
    expect(r.gold.gte(10 * OFFLINE_CAP_HOURS * 3600)).toBe(true);
  });
});

describe('lineup', () => {
  it('refunds exactly the gold spent when a hero is benched', () => {
    const s = fresh();
    s.levels[other.id] = 25;
    const spent = s.goldSpent(other.id);
    const before = s.gold;
    const refund = s.setInLineup(other.id, false)!;
    expect(refund.toString()).toBe(spent.toString());
    expect(s.gold.toString()).toBe(before.plus(spent).toString());
    expect(s.levels[other.id]).toBe(1);
    // Benching again refunds nothing more.
    expect(s.setInLineup(other.id, false)).toBeNull();
  });

  it('never benches the last hero or exceeds the lineup size', () => {
    const s = fresh();
    expect(s.setInLineup(starter.id, false)).toBeNull();
    for (const h of HEROES) s.levels[h.id] = 1;
    s.benched = {};
    expect(s.lineupCount()).toBeLessThanOrEqual(HEROES.length);
    for (const h of HEROES) s.benched[h.id] = true;
    s.benched[starter.id] = false;
    delete s.benched[starter.id];
    for (const h of HEROES) s.setInLineup(h.id, true);
    expect(s.lineupCount()).toBe(LINEUP_SIZE);
  });
});

describe('medals, unlocks and evolution', () => {
  it('unlocks a hero only with enough crests', () => {
    const s = fresh();
    const need = s.unlockCrests(other)!;
    s.crests[other.id] = need - 1;
    expect(s.unlockHero(other.id)).toBe(false);
    s.crests[other.id] = need;
    expect(s.unlockHero(other.id)).toBe(true);
    expect(s.levels[other.id]).toBe(1);
    expect(s.crests[other.id]).toBe(0);
  });

  it('evolves up to the max and no further, only when unlocked', () => {
    const s = fresh();
    s.crests[other.id] = 1e6;
    expect(s.evolve(other.id)).toBe(false); // still locked
    s.crests[starter.id] = STAR_CRESTS.reduce((a, b) => a + b, 0) + 25;
    for (let i = 0; i < MAX_STARS; i++) expect(s.evolve(starter.id)).toBe(true);
    expect(s.evolve(starter.id)).toBe(false);
    expect(s.stars[starter.id]).toBe(MAX_STARS);
    // Leftover medals at max stars became Legendary medals.
    expect(s.legendaryMedals).toBe(Math.floor(25 / LEGENDARY_MEDAL_RATE));
    expect(s.crests[starter.id]).toBe(25 % LEGENDARY_MEDAL_RATE);
  });

  it('each star doubles stats', () => {
    const s = fresh();
    const a = s.heroPower(starter, 10).atk;
    s.stars[starter.id] = 1;
    // Star skills can add more, so at least double.
    expect(s.heroPower(starter, 10).atk.gte(a.times(2))).toBe(true);
  });

  it('opening a chest costs gems and gives crests', () => {
    const s = fresh();
    s.gems = CHEST_COST - 1;
    expect(s.summon()).toBeNull();
    s.gems = CHEST_COST;
    const drops = s.summon()!;
    expect(drops).toHaveLength(CHEST_DROPS);
    expect(s.gems).toBe(0);
    const total = Object.values(s.crests).reduce((a, b) => a + b, 0);
    expect(total).toBe(drops.reduce((a, d) => a + d.crests, 0));
  });

  it('shows chest odds that add up to 100% and only for rarities that exist', () => {
    const odds = rarityOdds(HEROES, CHEST_RARITY_WEIGHTS);
    expect(odds.reduce((t, [, p]) => t + p, 0)).toBeCloseTo(100);
    for (const [r] of odds) expect(HEROES.some((h) => h.rarity === r)).toBe(true);
  });
});

describe('trial tickets', () => {
  it('regenerate one per period up to the cap', () => {
    const s = fresh();
    const t0 = 1_000_000_000_000;
    s.tickets = 5;
    s.ticketClock = t0;
    s.refreshTickets(t0 + 3 * TICKET_MINUTES * 60000 + 10);
    expect(s.tickets).toBe(8);
    s.refreshTickets(t0 + 1000 * TICKET_MINUTES * 60000);
    expect(s.tickets).toBe(TICKET_CAP);
  });

  it("don't freeze when the ticket clock is in the future", () => {
    const s = fresh();
    const now = 1_000_000_000_000;
    s.tickets = 5;
    s.ticketClock = now + 86_400_000;
    const wait = s.refreshTickets(now);
    expect(wait).toBeLessThanOrEqual(TICKET_MINUTES * 60);
  });

  it('each trial level pays more than the last', () => {
    for (let i = 1; i < TRIAL_LEVELS.length; i++) expect(TRIAL_LEVELS[i].essence).toBeGreaterThan(TRIAL_LEVELS[i - 1].essence);
  });
});

describe('relics', () => {
  it('buy slots with gems in order, then stop', () => {
    const s = fresh();
    s.gems = 1e6;
    for (const cost of RELIC_SLOT_COSTS) {
      const before = s.gems;
      expect(s.buyRelicSlot()).toBe(true);
      expect(before - s.gems).toBe(cost);
    }
    expect(s.buyRelicSlot()).toBe(false);
    expect(s.relicSlots).toBe(RELIC_START_SLOTS + RELIC_SLOT_COSTS.length);
  });

  it("can't equip more relics than slots", () => {
    const s = fresh();
    for (const r of RELICS) s.relics[r.id] = 1;
    for (const r of RELICS) s.toggleRelic(r.id);
    expect(s.equipped.length).toBe(s.relicSlots);
  });

  it('upgrades spend essence and fail without it', () => {
    const s = fresh();
    const def = RELICS[0];
    expect(s.upgradeRelic(def.id)).toBe(false);
    for (const e of def.essences) s.essences[e] = 1e9;
    expect(s.upgradeRelic(def.id)).toBe(true);
    expect(s.relics[def.id]).toBe(1);
  });
});

describe('rekindle', () => {
  it('is only possible past the Rekindle stage and keeps embers', () => {
    const s = fresh();
    expect(s.canRekindle()).toBe(false);
    s.reachStage(REKINDLE_STAGE + 20);
    expect(s.canRekindle()).toBe(true);
    const r = s.rekindle(1)!;
    expect(r.embers).toBeGreaterThan(0);
    expect(s.stage).toBe(1);
    expect(s.embers).toBe(r.embers);
    expect(s.rekindles).toBe(1);
    expect(s.canRekindle()).toBe(false);
  });

  it("won't take a boosted rekindle without the gems", () => {
    const s = fresh();
    s.reachStage(REKINDLE_STAGE + 20);
    s.gems = 0;
    expect(s.rekindle(3)).toBeNull();
    expect(s.rekindles).toBe(0);
  });
});

describe('save repair', () => {
  it('benches extra fighters beyond the lineup size and keeps their levels', () => {
    fresh();
    const levels = Object.fromEntries(HEROES.map((h) => [h.id, 40]));
    localStorage.setItem('hordefall-save-v1', JSON.stringify({ gold: '0', levels, benched: {} }));
    const s = new GameState();
    s.load();
    expect(s.lineupCount()).toBe(LINEUP_SIZE);
    expect(HEROES.every((h) => s.levels[h.id] === 40)).toBe(true);
  });

  it('repairs nonsense numbers and always keeps the starter', () => {
    fresh();
    localStorage.setItem('hordefall-save-v1', JSON.stringify({ gold: 'NaN', stage: -4, gems: 'lots', tickets: 999, levels: { [starter.id]: 0 }, stars: { [starter.id]: 99 } }));
    const s = new GameState();
    s.load();
    expect(s.gold.toString()).toBe('0');
    expect(s.stage).toBe(1);
    expect(s.gems).toBeGreaterThanOrEqual(0);
    expect(s.tickets).toBe(TICKET_CAP);
    expect(s.levels[starter.id]).toBe(1);
    expect(s.stars[starter.id]).toBe(MAX_STARS);
    expect(s.lineupCount()).toBe(1);
  });

  it('sets a damaged save aside instead of losing it', () => {
    fresh();
    localStorage.setItem('hordefall-save-v1', '{"gold": "1e10", broken');
    expect(new GameState().load()).toBe(false);
    const kept = (localStorage as any).keys().filter((k: string) => k.startsWith('hordefall-save-v1-unreadable-'));
    expect(kept).toHaveLength(1);
    expect(localStorage.getItem(kept[0])).toContain('1e10');
  });
});
