import { beforeEach, describe, expect, it, vi } from 'vitest';
import Decimal from 'break_infinity.js';
import { heroProfile, heroBuildEffects, buildBonus, BUILD_EFFECTS } from '../src/profiles';
import { GameState, rarityOdds, weekKey } from '../src/state';
import { emberBulk, emberCost, emberRefund } from '../src/formulas';
import { mulEffect } from '../src/skills';
import {
  HEROES, STAR_STAT_MULT, MASTERY_EVOLUTIONS, AURA_EVOLUTIONS, STAR_CRESTS, MAX_STARS, LEGENDARY_MEDAL_RATE, CHEST_COST, CHEST_DROPS, CHEST_RARITY_WEIGHTS, TEAM_SLOTS_START, TEAM_SLOTS_MAX, TEAM_SLOT_COSTS, OLD_SAVE_TEAM_SLOTS, ULT_SLOTS_START, ULT_SLOTS_MAX, ULT_SLOT_COSTS,
  TICKET_CAP, TICKET_MINUTES, OFFLINE_CAP_HOURS, REKINDLE_STAGE, HEAD_START_FROM, HEAD_START_MIN_PUSH, ROAD_START, ROAD_STEP, RELICS, RELIC_SETS, RELIC_SLOT_COSTS, RELIC_SLOT_STAGES, RELIC_START_SLOTS, RELIC_BASE_MAX, RELIC_ENHANCE_COSTS, TRIAL_LEVELS, TRIAL_QUICK_TIME, RENAMED_HEROES, GUILD_CREDITS_PER_MEDAL, bossWeakness,
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
    s.relicEnhance[RELICS[0].id] = 1;
    s.enhanceStones = 7;
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

  it('account reset replaces the save with a fresh game that autosave cannot overwrite', () => {
    const s = fresh();
    s.stage = 420;
    s.gems = 5000;
    s.save();
    GameState.startOver(GameState.freshSave(7));
    s.save(); // the old page's autosave fires before the reload
    const saved = JSON.parse(localStorage.getItem('hordefall-save-v1')!);
    expect(saved.stage).toBe(1);
    expect(saved.rev).toBe(7);
    GameState.frozen = false;
    const after = new GameState();
    expect(after.load()).toBe(true);
    expect(after.stage).toBe(1);
    expect(after.gems).toBe(fresh().gems);
    expect(HEROES.filter((h) => after.levels[h.id] > 0).map((h) => h.id)).toEqual([starter.id]);
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

  it('is capped and stops one stage before a boss the team cannot beat', () => {
    const s = fresh();
    s.goldPerSec = 10;
    s.secondsPerStage = 1;
    s.stage = 3;
    const r = s.applyOffline(1e9)!;
    expect(r.seconds).toBe(OFFLINE_CAP_HOURS * 3600);
    expect(s.stage).toBe(49);
    expect(r.gold.gte(10 * OFFLINE_CAP_HOURS * 3600)).toBe(true);
  });

  it('beats bosses the team can beat, and stops before the first one it cannot', () => {
    const s = fresh();
    const team = HEROES.filter((h) => h.rarity === 'common').slice(0, 5);
    for (const h of HEROES) s.levels[h.id] = team.includes(h) ? 100 : 0;
    s.secondsPerStage = 1;
    s.stage = 3;
    expect(s.canBeatBoss(100).won).toBe(true);
    expect(s.canBeatBoss(150).won).toBe(false);
    const r = s.applyOffline(1e9)!;
    expect(r.bosses).toBe(2);
    expect(s.stage).toBe(149);
    expect(r.stages).toBe(146);
  });

  it('maxOfflineStage shows where a full offline stretch would stop, without moving', () => {
    const s = fresh();
    const team = HEROES.filter((h) => h.rarity === 'common').slice(0, 5);
    for (const h of HEROES) s.levels[h.id] = team.includes(h) ? 100 : 0;
    s.secondsPerStage = 1;
    s.stage = 3;
    expect(s.maxOfflineStage()).toBe(149);
    expect(s.stage).toBe(3);
    s.autoAdvance = false;
    expect(s.maxOfflineStage()).toBe(3);
  });

  it('does not beat a boss without enough time left, or with a team that is too weak', () => {
    const s = fresh();
    const team = HEROES.filter((h) => h.rarity === 'common').slice(0, 5);
    for (const h of HEROES) s.levels[h.id] = team.includes(h) ? 92 : 0;
    s.secondsPerStage = 1;
    s.stage = 50;
    expect(s.canBeatBoss(100).won).toBe(false);
    s.applyOffline(1e9);
    expect(s.stage).toBe(99);
    const t = fresh();
    for (const h of HEROES) t.levels[h.id] = team.includes(h) ? 100 : 0;
    t.secondsPerStage = 30;
    t.stage = 98;
    t.applyOffline(61);
    expect(t.stage).toBe(99);
  });

  it('cannot hurt an element-locked boss with the wrong element', () => {
    const s = fresh();
    for (const h of HEROES) s.levels[h.id] = h.id === starter.id ? 5000 : 0;
    expect(s.canBeatBoss(600).won).toBe(starter.element === bossWeakness(600));
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
    expect(s.lineupCount()).toBe(s.teamSlots);
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

  it('each star multiplies stats by 1.5, and 7★ adds the Type Mastery', () => {
    const s = fresh();
    const a = s.heroPower(starter, 10).atk;
    s.stars[starter.id] = 1;
    // Star skills can add more, so at least x1.5, and well short of the original's x2.
    expect(s.heroPower(starter, 10).atk.gte(a.times(STAR_STAT_MULT))).toBe(true);
    expect(STAR_STAT_MULT).toBe(1.5);
    const ranger = HEROES.find((h) => h.type === 'Ranger')!;
    s.levels[ranger.id] = 10;
    s.stars[ranger.id] = MASTERY_EVOLUTIONS - 1;
    const before = s.heroStats(ranger).critRate;
    s.stars[ranger.id] = MASTERY_EVOLUTIONS;
    expect(s.heroStats(ranger).critRate).toBeGreaterThanOrEqual(before + 0.1 - 1e-9);
  });

  it('element auras reach only heroes of that element', () => {
    const s = fresh();
    const byId = (id: string) => HEROES.find((h) => h.id === id)!;
    for (const id of ['blaze', 'ember', 'thorn', 'flint']) s.levels[id] = 10;
    const emberDef = s.heroPower(byId('ember')).defense;
    const thornDef = s.heroPower(byId('thorn')).defense;
    const emberCritDmg = s.heroStats(byId('ember')).critDmg;
    const thornCritDmg = s.heroStats(byId('thorn')).critDmg;
    s.stars.blaze = AURA_EVOLUTIONS;
    s.stars.flint = AURA_EVOLUTIONS;
    // Forge Guard (Flare): Fire heroes +40% Defense. Hot Blood (Flint): Fire heroes +20% crit damage.
    expect(s.heroPower(byId('ember')).defense.div(emberDef).toNumber()).toBeCloseTo(1.4, 6);
    expect(s.heroPower(byId('thorn')).defense.div(thornDef).toNumber()).toBeCloseTo(1, 6);
    expect(s.heroStats(byId('ember')).critDmg - emberCritDmg).toBeCloseTo(0.2, 6);
    expect(s.heroStats(byId('thorn')).critDmg).toBeCloseTo(thornCritDmg, 6);
  });

  it('enemy-side auras reach the team-wide query, element HP auras only their element', () => {
    const s = fresh();
    const byId = (id: string) => HEROES.find((h) => h.id === id)!;
    for (const id of ['shade', 'brook', 'thorn']) s.levels[id] = 10;
    const brineHp = s.heroPower(starter, 10).hp;
    const thornHp = s.heroPower(byId('thorn')).hp;
    s.stars.shade = AURA_EVOLUTIONS;
    s.stars.brook = AURA_EVOLUTIONS;
    // Dread Veil (Shade): enemies attack 10% slower. Spring Blessing (Brook): Water heroes +15% HP.
    expect(mulEffect(s.effects(), 'enemyHaste', null)).toBeCloseTo(0.9, 6);
    s.levels.dread = 10;
    s.stars.dread = AURA_EVOLUTIONS;
    // Shatter Armor (Dread): enemies take 15% more damage.
    expect(mulEffect(s.effects(), 'enemyVuln', null)).toBeCloseTo(1.15, 6);
    expect(s.heroPower(starter, 10).hp.div(brineHp).toNumber()).toBeCloseTo(1.15, 6);
    expect(s.heroPower(byId('thorn')).hp.div(thornHp).toNumber()).toBeCloseTo(1, 6);
  });

  it('a Support in the lineup rallies the whole team (+15% ATK) from 1★', () => {
    const s = fresh();
    const a = s.heroPower(starter, 10).atk;
    const support = HEROES.find((h) => h.type === 'Support')!;
    s.levels[support.id] = 1;
    expect(s.heroPower(starter, 10).atk.div(a).toNumber()).toBeCloseTo(1.15, 6);
    s.benched[support.id] = true;
    expect(s.heroPower(starter, 10).atk.div(a).toNumber()).toBeCloseTo(1, 6);
  });

  it('two Supports rally additively (+30% ATK, not +32.25%)', () => {
    const s = fresh();
    const a = s.heroPower(starter, 10).atk;
    const supports = HEROES.filter((h) => h.type === 'Support').slice(0, 2);
    expect(supports).toHaveLength(2);
    for (const h of supports) s.levels[h.id] = 1;
    expect(s.heroPower(starter, 10).atk.div(a).toNumber()).toBeCloseTo(1.3, 6);
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

  it('open only after the stage 50 boss', () => {
    const s = fresh();
    const element = s.openTrials()[0];
    expect(s.canStartTrial(element, 1)).toBe(false);
    expect(s.finishTrial(element, 1, true, 10)).toBeNull();
    s.bestStage = 51;
    expect(s.canStartTrial(element, 1)).toBe(true);
    expect(s.finishTrial(element, 1, true, 10)).not.toBeNull();
  });

  it('each trial level pays more than the last', () => {
    for (let i = 1; i < TRIAL_LEVELS.length; i++) {
      expect(TRIAL_LEVELS[i].essence).toBeGreaterThan(TRIAL_LEVELS[i - 1].essence);
      expect(TRIAL_LEVELS[i].medals).toBeGreaterThan(TRIAL_LEVELS[i - 1].medals);
    }
  });

  it('a win hands out all its medals, more than the element has heroes', () => {
    const s = fresh();
    s.bestStage = 51;
    const element = s.openTrials()[0];
    s.trialBest[element] = 7;
    for (const h of HEROES) if (h.element === element) s.levels[h.id] = 1;
    for (const h of HEROES) s.emberLevels[h.id] = 500;
    const before = HEROES.reduce((t, h) => t + (s.crests[h.id] ?? 0), 0);
    const r = s.finishTrial(element, 8, true, 20)!;
    expect(r.won).toBe(true);
    expect(r.medals).toHaveLength(TRIAL_LEVELS[7].medals);
    expect(HEROES.reduce((t, h) => t + (s.crests[h.id] ?? 0), 0) - before).toBe(TRIAL_LEVELS[7].medals);
  });
});

describe('live trial fights', () => {
  function ready() {
    const s = fresh();
    s.bestStage = 51;
    return { s, element: s.openTrials()[0] };
  }

  it('a loss keeps the ticket and pays nothing', () => {
    const { s, element } = ready();
    const tickets = s.tickets;
    const r = s.finishTrial(element, 1, false, 30)!;
    expect(r.won).toBe(false);
    expect(s.tickets).toBe(tickets);
    expect(r.essence).toBe(0);
    expect(r.medals).toEqual([]);
    expect(s.trialBest[element] ?? 0).toBe(0);
    expect(s.trialTime(element, 1)).toBeNull();
  });

  it('a win spends one ticket, pays out, opens the next level and keeps the fastest time', () => {
    const { s, element } = ready();
    const tickets = s.tickets;
    const r = s.finishTrial(element, 1, true, 12)!;
    expect(s.tickets).toBe(tickets - 1);
    expect(r.essence).toBe(TRIAL_LEVELS[0].essence);
    expect(s.trialUnlocked(element)).toBe(2);
    s.finishTrial(element, 1, true, 20);
    expect(s.trialTime(element, 1)).toBe(12);
  });

  it("can't skip ahead or play without a ticket", () => {
    const { s, element } = ready();
    expect(s.canStartTrial(element, 3)).toBe(false);
    expect(s.finishTrial(element, 3, true, 5)).toBeNull();
    s.tickets = 0;
    s.ticketClock = Date.now();
    expect(s.canStartTrial(element, 1)).toBe(false);
    expect(s.finishTrial(element, 1, true, 5)).toBeNull();
  });
});

describe('trial level unlocks', () => {
  it('winning the highest open level opens the next one for that element only', () => {
    const s = fresh();
    s.bestStage = 51;
    const [element] = s.openTrials();
    expect(s.trialUnlocked(element)).toBe(1);
    expect(s.finishTrial(element, 2, true, 10)).toBeNull();
    expect(s.finishTrial(element, 1, true, 10)!.won).toBe(true);
    expect(s.trialUnlocked(element)).toBe(2);
    const other = ['water', 'earth', 'fire', 'light', 'dark'].find((e) => e !== element)!;
    expect(s.trialUnlocked(other)).toBe(1);
  });
});

describe('trial quick battle', () => {
  function strong() {
    const s = fresh();
    s.bestStage = 51;
    const element = s.openTrials()[0];
    for (const h of HEROES) if (h.element === element) s.levels[h.id] = 1;
    for (const h of HEROES) s.emberLevels[h.id] = 500;
    return { s, element };
  }

  it('is locked until a level is won, then unlocks on a fast win', () => {
    const { s, element } = strong();
    expect(s.canQuickTrial(element, 1)).toBe(false);
    expect(s.quickTrial(element, 1)).toBeNull();
    const r = s.finishTrial(element, 1, true, 8.24)!;
    expect(r.won).toBe(true);
    expect(s.trialTime(element, 1)).toBe(8.2);
    expect(s.canQuickTrial(element, 1)).toBe(true);
    expect(s.canQuickTrial(element, 2)).toBe(false);
  });

  it('a slow win records the time but does not unlock it', () => {
    const { s, element } = strong();
    s.finishTrial(element, 1, true, TRIAL_QUICK_TIME + 1);
    expect(s.trialTime(element, 1)).toBe(TRIAL_QUICK_TIME + 1);
    expect(s.canQuickTrial(element, 1)).toBe(false);
    expect(s.quickTrial(element, 1)).toBeNull();
  });

  it('costs one ticket and pays the same as a normal win', () => {
    const { s, element } = strong();
    s.finishTrial(element, 1, true, 8);
    const tickets = s.tickets;
    const ess = s.essences[element] ?? 0;
    const crests = HEROES.reduce((t, h) => t + (s.crests[h.id] ?? 0), 0);
    const r = s.quickTrial(element, 1)!;
    expect(r.won).toBe(true);
    expect(s.tickets).toBe(tickets - 1);
    expect(r.essence).toBe(TRIAL_LEVELS[0].essence);
    expect((s.essences[element] ?? 0) - ess).toBe(r.essence);
    expect(r.medals).toHaveLength(TRIAL_LEVELS[0].medals);
    expect(HEROES.reduce((t, h) => t + (s.crests[h.id] ?? 0), 0) - crests).toBe(TRIAL_LEVELS[0].medals);
  });

  it('can run several times at once, stopping when tickets run out', () => {
    const { s, element } = strong();
    s.finishTrial(element, 1, true, 8);
    s.tickets = 7;
    s.ticketClock = Date.now();
    const ess = s.essences[element] ?? 0;
    const r = s.quickTrials(element, 1, 5)!;
    expect(r.runs).toBe(5);
    expect(s.tickets).toBe(2);
    expect(r.essence).toBe(5 * TRIAL_LEVELS[0].essence);
    expect((s.essences[element] ?? 0) - ess).toBe(r.essence);
    expect(r.medals).toHaveLength(5 * TRIAL_LEVELS[0].medals);
    const rest = s.quickTrials(element, 1, 10)!;
    expect(rest.runs).toBe(2);
    expect(s.tickets).toBe(0);
    expect(s.quickTrials(element, 1, 1)).toBeNull();
  });

  it('needs a ticket', () => {
    const { s, element } = strong();
    s.finishTrial(element, 1, true, 8);
    s.tickets = 0;
    s.ticketClock = Date.now();
    expect(s.quickTrial(element, 1)).toBeNull();
  });

  it('clear times survive a save, and old saves without them load', () => {
    const { s, element } = strong();
    s.finishTrial(element, 1, true, 8);
    s.save();
    const again = new GameState();
    again.load();
    expect(again.canQuickTrial(element, 1)).toBe(true);
    const data = JSON.parse(localStorage.getItem('hordefall-save-v1')!);
    delete data.trialTimes;
    localStorage.setItem('hordefall-save-v1', JSON.stringify(data));
    const old = new GameState();
    old.load();
    expect(old.trialTimes).toEqual({});
    expect(old.canQuickTrial(element, 1)).toBe(false);
  });
});

describe('relics', () => {
  it('buy slots with gems in order, then stop', () => {
    const s = fresh();
    s.gems = 1e6;
    expect(s.buyRelicSlot()).toBe(false); // stage gate
    s.bestStage = RELIC_SLOT_STAGES[RELIC_SLOT_STAGES.length - 1];
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
    s.relics[def.id] = 1;
    expect(s.upgradeRelic(def.id)).toBe(false);
    for (const e of def.essences) s.essences[e] = 1e9;
    expect(s.upgradeRelic(def.id)).toBe(true);
    expect(s.relics[def.id]).toBe(2);
    expect(s.essences[def.essences[0]]).toBeLessThan(1e9);
  });

  it("can't craft a relic you don't own by upgrading it: new relics only come from discovery", () => {
    const s = fresh();
    const def = RELICS[0];
    for (const e of def.essences) s.essences[e] = 1e9;
    expect(s.upgradeRelic(def.id)).toBe(false);
    expect(s.relics[def.id] ?? 0).toBe(0);
  });

  it('opens the next star by maxing a relic of the star below', () => {
    const s = fresh();
    const two = RELICS.find((r) => r.stars === 2)!;
    for (const e of two.essences) s.essences[e] = 1e12;
    expect(s.relicStarsOpen()).toBe(1);
    expect(s.relicShopPool().some((r) => r.id === two.id)).toBe(false);
    s.relics[RELICS.find((r) => r.stars === 1)!.id] = RELIC_BASE_MAX;
    expect(s.relicStarsOpen()).toBe(2);
    expect(s.relicShopPool().some((r) => r.id === two.id)).toBe(true);
  });

  it('Enhance Stones raise the cap by 5 only at max level', () => {
    const s = fresh();
    const def = RELICS[0];
    s.enhanceStones = 1000;
    s.relics[def.id] = RELIC_BASE_MAX - 1;
    expect(s.enhanceRelic(def.id)).toBe(false);
    s.relics[def.id] = RELIC_BASE_MAX;
    expect(s.relicNextCost(def)).toBeNull();
    expect(s.enhanceRelic(def.id)).toBe(true);
    expect(s.enhanceStones).toBe(1000 - RELIC_ENHANCE_COSTS[0]);
    expect(s.relicMaxLevel(def)).toBe(RELIC_BASE_MAX + 5);
    expect(s.relicNextCost(def)).not.toBeNull();
  });

  it('a set gives its bonus once every piece is crafted, equipped or not', () => {
    const s = fresh();
    const set = RELIC_SETS[0];
    const pieces = RELICS.filter((r) => r.set === set.id);
    const [effect, value] = set.bonus[0];
    for (const p of pieces.slice(1)) s.relics[p.id] = 1;
    expect(s.relicBonus(effect)).toBe(0);
    s.relics[pieces[0].id] = 1;
    expect(s.relicBonus(effect)).toBeCloseTo(value / 100);
  });

  it('a piece gives each of its effects, reaching the listed number at level 20', () => {
    const s = fresh();
    const def = RELICS.find((r) => r.fx.length === 2)!;
    s.relics[def.id] = RELIC_BASE_MAX;
    s.equipped = [def.id];
    for (const [e, v] of def.fx) expect(s.relicBonus(e)).toBeCloseTo(v / 100);
  });

  it('set pieces need Enhance Stones to craft', () => {
    const s = fresh();
    const def = RELICS.find((r) => r.stones)!;
    for (const r of RELICS.filter((x) => x.stars < def.stars)) s.relics[r.id] = RELIC_BASE_MAX;
    for (const e of def.essences) s.essences[e] = 1e12;
    s.relicShop = { offers: [def.id], refreshAt: 0, rolled: true };
    expect(s.buyRelic(def.id)).toBe(false);
    s.enhanceStones = def.stones!;
    expect(s.buyRelic(def.id)).toBe(true);
    expect(s.enhanceStones).toBe(0);
  });

  it('hero level discounts divide the cost and work without a slot', () => {
    const s = fresh();
    const def = RELICS.find((r) => r.fx.some(([e]) => e === 'cost'))!;
    s.relics[def.id] = RELIC_BASE_MAX;
    s.equipped = [];
    const v = def.fx.find(([e]) => e === 'cost')![1];
    expect(s.levelCostMult()).toBeCloseTo(1 / (1 + v / 100));
  });

  it('Defense relics raise hero Defense, element ones only for their element', () => {
    const s = fresh();
    const before = s.heroPower(starter).defense;
    expect(before.gt(0)).toBe(true);
    const piece = RELICS.find((r) => r.fx.some(([e]) => e === `${starter.element}Def`))!;
    s.relics[piece.id] = RELIC_BASE_MAX;
    s.equipped = [piece.id];
    expect(s.heroPower(starter).defense.gt(before)).toBe(true);
    const other = HEROES.find((h) => h.element !== starter.element)!;
    const otherBefore = new GameState().heroPower(other).defense;
    expect(s.heroPower(other).defense.toString()).toBe(otherBefore.toString());
  });

  it('hero stats: one calculation for the stat pages and battle', () => {
    const s = fresh();
    const st = s.heroStats(starter);
    expect(st.atk.value.toString()).toBe(s.heroPower(starter).atk.toString());
    expect(st.effectRes.value).toBeCloseTo(heroProfile(starter).effectRes);
    expect(st.attacksPerSec.base).toBeCloseTo(1 / starter.attackCooldown);
    const fast = RELIC_SETS.find((set) => set.bonus.some(([e]) => e === 'speed'))!;
    for (const r of RELICS.filter((x) => x.set === fast.id)) s.relics[r.id] = 1;
    expect(s.heroStats(starter).attacksPerSec.value).toBeGreaterThan(st.attacksPerSec.base);
    const burner = HEROES.find((h) => h.signature?.kind === 'burn');
    if (burner) expect(s.heroStats(burner).burnChance).toBe(1);
    const knight = HEROES.find((h) => h.type === 'Knight')!;
    expect(s.heroStats(knight).isKnight).toBe(true);
  });

  it('every hero has its own specialty, and builds of shared effects get stronger', () => {
    for (const h of HEROES) expect(heroProfile(h).specialty.length, h.id).toBeGreaterThan(0);
    // No two heroes share the same stats: every full profile (Type shape plus specialty) differs.
    const shapes = HEROES.map((h) => {
      const { specialty: _, ...stats } = heroProfile(h);
      return JSON.stringify(stats);
    });
    expect(new Set(shapes).size).toBe(HEROES.length);
    const s = fresh();
    // Builds: two heroes who share an effect make it last longer (roster changes, so use whichever pair exists).
    const effect = BUILD_EFFECTS.find((e) => HEROES.filter((h) => heroBuildEffects(h).includes(e)).length >= 2)!;
    const pair = HEROES.filter((h) => heroBuildEffects(h).includes(effect)).slice(0, 2);
    const time = `${effect}Time` as 'freezeTime' | 'burnTime' | 'poisonTime' | 'stunTime';
    for (const h of HEROES) s.levels[h.id] = 0;
    s.levels[pair[0].id] = 1;
    const solo = s.heroStats(pair[0]);
    s.levels[pair[1].id] = 1;
    expect(s.heroStats(pair[0])[time]).toBeGreaterThan(solo[time]);
    expect(buildBonus(3).dmg).toBeGreaterThan(buildBonus(2).dmg);
  });

  it('specialty bonuses reach the stat sheet', () => {
    const s = fresh();
    const byId = (id: string) => HEROES.find((h) => h.id === id)!;
    for (const id of ['brine', 'marina', 'aegis', 'flint', 'briar']) s.levels[id] = 1;
    expect(s.heroStats(byId('brine')).ultAtk).toBeCloseTo(0.2);
    expect(s.heroStats(byId('marina')).critRate).toBeCloseTo(0.2);
    expect(s.heroStats(byId('aegis')).stunChance).toBeCloseTo(0.1);
    expect(s.heroStats(byId('flint')).bonusGold).toBeCloseTo(1); // 2x gold, like Crush's Extra Gold
    expect(s.heroStats(byId('briar')).critRate).toBeGreaterThanOrEqual(0.25);
  });

  it('drops relics that are no longer in the game from old saves', () => {
    const s = fresh();
    s.relics.sigil = 5;
    s.equipped = ['sigil'];
    s.save();
    const t = new GameState();
    t.load();
    expect(t.relics.sigil).toBeUndefined();
    expect(t.equipped).toEqual([]);
  });

  it('old saves past level 20 keep their levels as Enhances', () => {
    const s = fresh();
    s.relics.warbanner = 30;
    s.save();
    const s2 = new GameState();
    expect(s2.load()).toBe(true);
    expect(s2.relics.warbanner).toBe(30);
    expect(s2.relicEnhance.warbanner).toBe(2);
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

  it('keeps every hero\'s Ember levels and only resets gold levels', () => {
    const s = fresh();
    s.levels[starter.id] = 140;
    s.emberLevels[starter.id] = 37;
    s.emberLevels[other.id] = 12;
    s.reachStage(REKINDLE_STAGE + 20);
    expect(s.rekindle(1)).not.toBeNull();
    expect(s.emberLevels[starter.id]).toBe(37);
    expect(s.emberLevels[other.id]).toBe(12);
    expect(s.levels[starter.id]).toBe(1);
    expect(s.heroLevel(starter.id)).toBe(1 + 37);
    const t = new GameState();
    expect(t.load()).toBe(true);
    expect(t.emberLevels[starter.id]).toBe(37);
    expect(t.emberLevels[other.id]).toBe(12);
  });

  it('buys Ember levels x1, x10 and max', () => {
    const s = fresh();
    s.embers = emberBulk(0, 10, 0).cost + 1;
    expect(s.buyEmbers(starter.id, 10)).toBe(10);
    expect(s.emberLevels[starter.id]).toBe(10);
    expect(s.embers).toBe(1);
    expect(s.buyEmbers(starter.id, 10)).toBe(0);
    expect(s.emberLevels[starter.id]).toBe(10);
    s.embers = 100;
    const want = emberBulk(10, 'max', 100);
    expect(s.buyEmbers(starter.id, 'max')).toBe(want.levels);
    expect(s.embers).toBe(100 - want.cost);
    expect(s.embers).toBeLessThan(emberCost(10 + want.levels));
  });

  it('refunds every Ember spent when the player resets a hero', () => {
    const s = fresh();
    s.embers = 5;
    s.emberLevels[starter.id] = 30;
    const refund = s.resetEmbers(starter.id);
    expect(refund).toBe(emberRefund(30));
    expect(refund).toBe(Array.from({ length: 30 }, (_, i) => emberCost(i)).reduce((a, b) => a + b, 0));
    expect(s.emberLevels[starter.id]).toBe(0);
    expect(s.embers).toBe(5 + refund);
    expect(s.resetEmbers(starter.id)).toBe(0);
    expect(s.embers).toBe(5 + refund);
  });

  it("won't take a boosted rekindle without the gems", () => {
    const s = fresh();
    s.reachStage(REKINDLE_STAGE + 20);
    s.gems = 0;
    expect(s.rekindle(3)).toBeNull();
    expect(s.rekindles).toBe(0);
  });
});

describe('rekindle head start', () => {
  /** A player whose best stage is `best`, with the starter at this many Ember levels. */
  function veteran(best: number, ember: number) {
    const s = fresh();
    s.reachStage(best);
    s.emberLevels[starter.id] = ember;
    return s;
  }

  it('is off below the head start stage', () => {
    const s = veteran(HEAD_START_FROM - 1, 5000);
    expect(s.headStartStage()).toBe(1);
    s.rekindle(1);
    expect(s.stage).toBe(1);
  });

  it('starts just after a boss, held back by both the best stage and the team\'s Ember levels', () => {
    // 40% of 1000 is 400; Ember 5000 doesn't limit it.
    expect(veteran(1000, 5000).headStartStage()).toBe(351);
    // Level 1 + 400 Ember = 401, x0.8 = 320.8: stage 301.
    expect(veteran(1000, 400).headStartStage()).toBe(301);
    // A weak team gets no head start at all.
    expect(veteran(1000, 40).headStartStage()).toBe(1);
  });

  it('a Rekindle starts the new run there, unless the player turned it off', () => {
    const s = veteran(1000, 5000);
    const r = s.rekindle(1)!;
    expect(r.start).toBe(351);
    expect(s.stage).toBe(351);
    expect(s.runBestStage).toBe(351);
    expect(s.bestStage).toBe(1000);
    const t = veteran(1000, 5000);
    t.headStart = false;
    t.rekindle(1);
    expect(t.stage).toBe(1);
  });

  it("can't be Rekindled again right away, and skipped stages give no Wheel slots", () => {
    const s = veteran(1000, 5000);
    s.rekindle(1);
    expect(s.canRekindle()).toBe(false);
    expect(s.rekindle(1)).toBeNull();
    expect(s.roadReached()).toBe(0);
    s.reachStage(351 + HEAD_START_MIN_PUSH - 1);
    expect(s.canRekindle()).toBe(false);
    s.reachStage(351 + HEAD_START_MIN_PUSH);
    expect(s.canRekindle()).toBe(true);
    // Slots unlock every 50 stages from ROAD_START; 351 -> 401 crosses only the one at 400.
    expect(s.roadReached()).toBe(1);
    expect(ROAD_START + 5 * ROAD_STEP).toBe(400);
  });

  it('survives a save, and old saves start from stage 1', () => {
    const s = veteran(1000, 5000);
    s.rekindle(1);
    s.headStart = false;
    s.save();
    const t = new GameState();
    t.load();
    expect(t.runStartStage).toBe(351);
    expect(t.headStart).toBe(false);
    const data = JSON.parse(localStorage.getItem('hordefall-save-v1')!);
    delete data.runStartStage;
    delete data.headStart;
    localStorage.setItem('hordefall-save-v1', JSON.stringify(data));
    const old = new GameState();
    old.load();
    expect(old.runStartStage).toBe(1);
    expect(old.headStart).toBe(true);
  });
});

describe('save repair', () => {
  it('benches extra fighters beyond the lineup size and keeps their levels', () => {
    fresh();
    const levels = Object.fromEntries(HEROES.map((h) => [h.id, 40]));
    localStorage.setItem('hordefall-save-v1', JSON.stringify({ gold: '0', levels, benched: {} }));
    const s = new GameState();
    s.load();
    expect(s.lineupCount()).toBe(OLD_SAVE_TEAM_SLOTS);
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

describe('Daily Medal Bundle', () => {
  it('holds different heroes, opens after three daily challenges, and pays once a day', () => {
    const s = fresh();
    const day1 = new Date(2026, 9, 14, 12).getTime();
    const b = s.medalBundleState(day1);
    expect(b.drops.length).toBe(3);
    expect(new Set(b.drops.map((d) => d.heroId)).size).toBe(3);
    expect(b.drops.every((d) => HEROES.find((h) => h.id === d.heroId)!.rarity !== 'legendary')).toBe(true);
    expect(b.ready).toBe(false);
    expect(s.claimMedalBundle(day1)).toBeNull();

    vi.useFakeTimers();
    vi.setSystemTime(day1);
    s.track('kills', 300);
    s.track('stages', 20);
    expect(s.medalBundleState(day1).ready).toBe(false);
    s.track('minutes', 15);
    expect(s.medalBundleState(day1).ready).toBe(true);
    expect(s.homeWaiting(day1)).toBe(true);

    const before = b.drops.map((d) => s.crests[d.heroId] ?? 0);
    const drops = s.claimMedalBundle(day1)!;
    expect(drops.map((d) => d.heroId)).toEqual(b.drops.map((d) => d.heroId));
    b.drops.forEach((d, i) => expect(s.crests[d.heroId]).toBe(before[i] + d.crests));
    expect(s.claimMedalBundle(day1)).toBeNull();

    // Same bundle after a reload; a new one the next day.
    s.save();
    const again = new GameState();
    again.load();
    expect(again.medalBundleState(day1)).toMatchObject({ claimed: true, drops: b.drops });
    const next = again.medalBundleState(day1 + 86_400_000);
    expect(next.claimed).toBe(false);
    expect(next.done).toBe(0);
  });
});

describe('guild medals and credits', () => {
  it('giving medals pays credits by rarity and keeps your own medals', () => {
    const s = fresh();
    const common = HEROES.find((h) => h.rarity === 'common')!;
    s.crests[common.id] = 4;
    expect(s.giveGuildMedals(common.id, 0)).toBeNull();
    expect(s.giveGuildMedals(common.id, 3)).toBe(3 * GUILD_CREDITS_PER_MEDAL.common);
    expect(s.crests[common.id]).toBe(4);
    expect(s.guildCredits).toBe(3 * GUILD_CREDITS_PER_MEDAL.common);
    // Giving doesn't need medals of your own.
    expect(s.giveGuildMedals(HEROES.find((h) => h.rarity === 'common' && !s.crests[h.id])!.id, 1)).toBe(GUILD_CREDITS_PER_MEDAL.common);
  });

  it('received medals can unlock a hero', () => {
    const s = fresh();
    const locked = HEROES.find((h) => h.rarity === 'common' && !s.levels[h.id])!;
    const drops = s.receiveGuildMedals([{ heroId: locked.id, crests: 20 }, { heroId: 'nobody', crests: 5 }]);
    expect(drops).toEqual([{ heroId: locked.id, crests: 20, isNew: true }]);
  });

  it('the guild shop spends credits and keeps tickets under the cap', () => {
    const s = fresh();
    expect(s.buyGuildItem('stone')).toBeNull();
    s.guildCredits = 1000;
    expect(s.buyGuildItem('chest')!.drops.length).toBe(CHEST_DROPS);
    expect(s.buyGuildItem('stone')).not.toBeNull();
    expect(s.enhanceStones).toBe(1);
    s.tickets = TICKET_CAP;
    expect(s.guildItemReady('tickets')).toBe(false);
    s.tickets = TICKET_CAP - 2;
    s.buyGuildItem('tickets');
    expect(s.tickets).toBe(TICKET_CAP);
    expect(s.guildCredits).toBe(1000 - 60 - 40 - 30);
    s.save();
    const t = new GameState();
    t.load();
    expect(t.guildCredits).toBe(s.guildCredits);
  });
});

describe('Guild Boss rewards', () => {
  it('damage uses the Trial team and the element edge', () => {
    const s = fresh();
    const plain = s.guildBossDamage(starter.element === 'light' ? 'water' : 'light');
    expect(plain.gt(0)).toBe(true);
    const weakTo = (['water', 'fire', 'earth'] as const).find((e) => e !== starter.element && ({ water: 'fire', fire: 'earth', earth: 'water' } as Record<string, string>)[starter.element] === e);
    if (weakTo) expect(s.guildBossDamage(weakTo).toNumber()).toBeCloseTo(plain.toNumber() * 4, -1);
  });

  it('attempts, beaten levels and the weekly reward pay out', () => {
    const s = fresh();
    const a = s.payGuildBossAttempt(3, new Decimal(0), new Decimal(1000));
    expect(a.coins).toBe(13);
    expect(a.gold.gt(0)).toBe(true);
    s.lifetimeEmbers = 50_000;
    const k = s.payGuildBossRewards([1, 2], []);
    expect(k).toMatchObject({ coins: 33 + 36, embers: 125 + 125 });
    expect(k.drops.length).toBe(0);
    const w = s.payGuildBossRewards([], [7]);
    expect(w).toMatchObject({ coins: 170, embers: 0 });
    expect(w.drops.length).toBe(3 * CHEST_DROPS);
    expect(s.guildCredits).toBe(13 + 69 + 170);
    s.lifetimeEmbers = 0;
    expect(s.payGuildBossRewards([1], []).embers).toBe(5);
  });
});

describe('Guild Research', () => {
  it('ranks give their bonuses, are capped and saved', () => {
    const s = fresh();
    const atk = s.heroPower(starter).atk;
    const boss = s.guildBossDamage('light');
    expect(s.setGuildResearch({ combat: 5, elemental: 2, prosperity: 99 })).toBe(true);
    expect(s.setGuildResearch({ combat: 5, elemental: 2, prosperity: 99 })).toBe(false);
    expect(s.researchBonus('combat')).toBeCloseTo(0.1);
    expect(s.researchBonus('prosperity')).toBeCloseTo(0.5);
    expect(s.researchBonus('exploration')).toBe(0);
    expect(s.heroPower(starter).atk.toNumber()).toBeCloseTo(atk.toNumber() * 1.1, -1);
    expect(s.guildBossDamage('light').toNumber()).toBeCloseTo(boss.toNumber() * 1.1 * 1.06, -2);
    const again = new GameState();
    again.load();
    expect(again.guildResearch).toEqual({ combat: 5, elemental: 2, prosperity: 10 });
    s.setGuildResearch({});
    expect(s.researchBonus('combat')).toBe(0);
  });

  it('Guild Coins only go down when there are enough', () => {
    const s = fresh();
    s.guildCredits = 150;
    expect(s.spendGuildCoins(200)).toBe(false);
    expect(s.spendGuildCoins(100)).toBe(true);
    expect(s.guildCredits).toBe(50);
  });
});

describe('Guild shop', () => {
  const day = new Date(2026, 9, 14, 12).getTime();

  it('rolls daily hero offers that can each be bought once', () => {
    const s = fresh();
    s.guildCredits = 1000;
    const shop = s.guildShopState(day);
    expect(shop.offers.length).toBe(4);
    expect(new Set(shop.offers.map((o) => o.heroId)).size).toBe(4);
    const first = shop.offers[0];
    const before = s.crests[first.heroId] ?? 0;
    expect(s.buyGuildOffer(0, day)).not.toBeNull();
    expect(s.crests[first.heroId]).toBe(before + first.crests);
    expect(s.guildCredits).toBe(1000 - first.cost);
    expect(s.buyGuildOffer(0, day)).toBeNull();
    const ids = shop.offers.map((o) => o.heroId).join();
    expect(s.guildShopState(day + 3600_000).offers.map((o) => o.heroId).join()).toBe(ids);
    expect(s.guildShopState(day + 24 * 3600_000).offers.every((o) => !o.bought)).toBe(true);
  });

  it('Wild Medals go to a picked hero, up to the weekly cap', () => {
    const s = fresh();
    s.guildCredits = 10_000;
    const common = HEROES.find((h) => h.id === 'brine')!;
    const legend = HEROES.find((h) => h.rarity === 'legendary');
    if (legend) expect(s.buyWildMedals(legend.id, 1, day)).toBeNull();
    expect(s.buyWildMedals(common.id, 15, day)).not.toBeNull();
    expect(s.wildMedalsLeft(day)).toBe(5);
    expect(s.buyWildMedals(common.id, 6, day)).toBeNull();
    expect(s.guildCredits).toBe(10_000 - 15 * 8);
    const nextWeek = day + 7 * 24 * 3600_000;
    expect(weekKey(nextWeek)).not.toBe(weekKey(day));
    expect(s.wildMedalsLeft(nextWeek)).toBe(20);
  });

  it('Ember pouches are limited per day and boosts stack to two hours', () => {
    const s = fresh();
    s.guildCredits = 10_000;
    s.lifetimeEmbers = 5_000;
    for (let i = 0; i < 3; i++) expect(s.buyGuildItem('embers', day)!.embers).toBeGreaterThanOrEqual(50);
    expect(s.buyGuildItem('embers', day)).toBeNull();
    expect(s.boostMult('banner', day)).toBe(1);
    for (let i = 0; i < 4; i++) expect(s.buyGuildItem('banner', day)).not.toBeNull();
    expect(s.buyGuildItem('banner', day)).toBeNull();
    expect(s.boostMult('banner', day + 119 * 60_000)).toBe(1.5);
    expect(s.boostMult('banner', day + 121 * 60_000)).toBe(1);
    const again = new GameState();
    again.load();
    expect(again.boosts.banner).toBe(s.boosts.banner);
    expect(again.guildShop.pouches).toBe(3);
  });
});

describe('Guild Quests', () => {
  it('counts kills, stages and Trials for the next report and pays rewards', () => {
    const s = fresh();
    s.track('kills', 7);
    s.track('stages');
    s.track('summons');
    expect(s.guildQuestPending).toEqual({ kills: 7, stages: 1, trials: 0 });
    s.save();
    const again = new GameState();
    again.load();
    expect(again.guildQuestPending).toEqual({ kills: 7, stages: 1, trials: 0 });
    expect(s.payGuildQuest('kills')).toEqual({ coins: 15, drops: [] });
    expect(s.payGuildQuest('track2').coins).toBe(60);
    const last = s.payGuildQuest('track4');
    expect(last.coins).toBe(120);
    expect(last.drops.length).toBe(CHEST_DROPS);
    expect(s.guildCredits).toBe(15 + 60 + 120);
  });
});

describe('Relic list', () => {
  it('has unique ids, relics at every star from 1★ to 8★, and 3 pieces in every set', () => {
    expect(new Set(RELICS.map((r) => r.id)).size).toBe(RELICS.length);
    for (let stars = 1; stars <= 8; stars++) expect(RELICS.some((r) => r.stars === stars)).toBe(true);
    for (let stars = 2; stars <= 3; stars++) expect(RELICS.filter((r) => r.stars === stars).length).toBeGreaterThanOrEqual(4);
    for (const set of RELIC_SETS) expect(RELICS.filter((r) => r.set === set.id).length).toBe(3);
    for (const r of RELICS.filter((x) => x.set)) expect(RELIC_SETS.some((set) => set.id === r.set)).toBe(true);
  });

  it('crafting costs more for every star up', () => {
    const cheapest = (n: number) => Math.min(...RELICS.filter((r) => r.stars === n).map((r) => r.craft));
    const dearest = (n: number) => Math.max(...RELICS.filter((r) => r.stars === n).map((r) => r.craft));
    for (let stars = 2; stars <= 8; stars++) expect(cheapest(stars)).toBeGreaterThan(dearest(stars - 1));
  });

  it('opens 8★ relics only after a 7★ relic reaches level 20', () => {
    const s = fresh();
    for (const r of RELICS.filter((x) => x.stars < 7)) s.relics[r.id] = RELIC_BASE_MAX;
    const seven = RELICS.find((r) => r.stars === 7)!;
    s.relics[seven.id] = 1;
    expect(s.relicStarsOpen()).toBe(7);
    s.relics[seven.id] = RELIC_BASE_MAX;
    expect(s.relicStarsOpen()).toBe(8);
  });
});

describe('Relic Shop', () => {
  const NOW = 1_800_000_000_000;
  const ones = RELICS.filter((r) => r.stars === 1);

  it('offers 3 different relics you do not own, from opened stars only, and keeps them when reopened', () => {
    const s = fresh();
    s.relics[ones[0].id] = 1;
    const first = s.relicShopState(NOW).offers.map((r) => r.id);
    expect(first.length).toBe(3);
    expect(new Set(first).size).toBe(3);
    expect(first).not.toContain(ones[0].id);
    for (const id of first) expect(RELICS.find((r) => r.id === id)!.stars).toBe(1);
    expect(s.relicShopState(NOW + 5 * 3_600_000).offers.map((r) => r.id)).toEqual(first);
  });

  it('sells for Essence (never Gems): Lv 1, equipped into a free slot, gone from the shop', () => {
    const s = fresh();
    s.gems = 10_000;
    const def = s.relicShopState(NOW).offers[0];
    expect(s.buyRelic(def.id, NOW)).toBe(false);
    expect(s.gems).toBe(10_000);
    const cost = s.relicCraftCost(def);
    for (const e of def.essences) s.essences[e] = cost + 7;
    expect(s.buyRelic(def.id, NOW)).toBe(true);
    expect(s.relics[def.id]).toBe(1);
    expect(s.equipped).toContain(def.id);
    for (const e of def.essences) expect(s.essences[e]).toBe(7);
    expect(s.gems).toBe(10_000);
    expect(s.relicShopState(NOW).offers.map((r) => r.id)).not.toContain(def.id);
    expect(s.buyRelic(def.id, NOW)).toBe(false);
  });

  it("can't buy a relic that isn't on offer", () => {
    const s = fresh();
    const offered = s.relicShopState(NOW).offers.map((r) => r.id);
    const other = ones.find((r) => !offered.includes(r.id))!;
    for (const e of other.essences) s.essences[e] = 1e9;
    expect(s.buyRelic(other.id, NOW)).toBe(false);
  });

  it('New relics re-rolls the shop, then waits 40 minutes', () => {
    const s = fresh();
    s.relicShopState(NOW);
    expect(s.refreshRelicShop(NOW)).toBe(true);
    expect(s.relicShopState(NOW).refreshIn).toBe(40 * 60_000);
    expect(s.refreshRelicShop(NOW + 39 * 60_000)).toBe(false);
    expect(s.refreshRelicShop(NOW + 40 * 60_000)).toBe(true);
  });

  it('round-trips through the save, and keeps unbought offers from the old Gem shop', () => {
    const s = fresh();
    s.relicShopState(NOW);
    s.refreshRelicShop(NOW);
    s.save();
    const t = new GameState();
    t.load();
    expect(t.relicShop).toEqual(s.relicShop);
    const old = { ...s.toJSON(), relicShop: { offers: [{ id: ones[0].id, bought: true }, { id: ones[1].id, bought: false }], restockAt: 1, refreshAt: 0 } };
    localStorage.setItem('hordefall-save-v1', JSON.stringify(old));
    const u = new GameState();
    u.load();
    expect(u.relicShop.offers).toEqual([ones[1].id]);
  });
});

describe('Evolve all', () => {
  it('evolves every recruited hero as far as their medals go, and skips the rest', () => {
    const s = fresh();
    const [a, b] = HEROES.filter((h) => h.id !== starter.id).slice(0, 2);
    s.levels[a.id] = 1;
    s.levels[b.id] = 1;
    s.crests[starter.id] = STAR_CRESTS[0] + STAR_CRESTS[1]; // two stars' worth
    s.crests[a.id] = STAR_CRESTS[0]; // one star
    s.crests[b.id] = STAR_CRESTS[0] - 1; // not enough
    expect(s.evolvable().map((h) => h.id).sort()).toEqual([starter.id, a.id].sort());
    const done = s.evolveAll();
    expect(done).toEqual(expect.arrayContaining([{ id: starter.id, from: 0, to: 2 }, { id: a.id, from: 0, to: 1 }]));
    expect(done.length).toBe(2);
    expect(s.stars[b.id] ?? 0).toBe(0);
    expect(s.crests[starter.id]).toBe(0);
    expect(s.evolvable().length).toBe(0);
    expect(s.evolveAll()).toEqual([]);
  });

  it('ignores medals for heroes not recruited yet', () => {
    const s = fresh();
    s.crests[other.id] = 10_000;
    expect(s.evolvable().some((h) => h.id === other.id)).toBe(false);
  });
});

describe('team slots', () => {
  it('a new game fights with 3 heroes, and each slot up to 10 is bought with Gems', () => {
    const s = fresh();
    expect(s.teamSlots).toBe(TEAM_SLOTS_START);
    for (const h of HEROES) s.levels[h.id] = 1;
    for (const h of HEROES) s.benched[h.id] = true;
    delete s.benched[starter.id];
    for (const h of HEROES) s.setInLineup(h.id, true);
    expect(s.lineupCount()).toBe(3);
    s.gems = 0;
    expect(s.buyTeamSlot()).toBe(false);
    s.gems = TEAM_SLOT_COSTS.reduce((a, b) => a + b, 0);
    for (let i = TEAM_SLOTS_START; i < TEAM_SLOTS_MAX; i++) expect(s.buyTeamSlot()).toBe(true);
    expect(s.gems).toBe(0);
    expect(s.teamSlots).toBe(TEAM_SLOTS_MAX);
    expect(s.nextTeamSlotCost()).toBeNull();
    s.gems = 99999;
    expect(s.buyTeamSlot()).toBe(false);
    for (const h of HEROES) s.setInLineup(h.id, true);
    expect(s.lineupCount()).toBe(TEAM_SLOTS_MAX);
  });

  it('has a price for every slot it sells', () => {
    expect(TEAM_SLOT_COSTS.length).toBe(TEAM_SLOTS_MAX - TEAM_SLOTS_START);
  });

  it('saves bought slots, and saves from before slots keep their 5 fighters', () => {
    const s = fresh();
    s.gems = 1000;
    s.buyTeamSlot();
    s.save();
    const back = new GameState();
    back.load();
    expect(back.teamSlots).toBe(TEAM_SLOTS_START + 1);
    localStorage.setItem('hordefall-save-v1', JSON.stringify({ gold: '0' }));
    const old = new GameState();
    old.load();
    expect(old.teamSlots).toBe(OLD_SAVE_TEAM_SLOTS);
    localStorage.setItem('hordefall-save-v1', JSON.stringify({ gold: '0', teamSlots: 99 }));
    const bad = new GameState();
    bad.load();
    expect(bad.teamSlots).toBe(TEAM_SLOTS_MAX);
  });

  it('a hero unlocked with a full team waits on the bench', () => {
    const s = fresh();
    const commons = HEROES.filter((h) => h.rarity === 'common' && h.id !== starter.id).slice(0, 3);
    for (const h of commons.slice(0, 2)) s.levels[h.id] = 1;
    expect(s.lineupCount()).toBe(3);
    s.crests[commons[2].id] = 10;
    expect(s.unlockHero(commons[2].id)).toBe(true);
    expect(s.inLineup(commons[2].id)).toBe(false);
  });
});

describe('Ultimate slots', () => {
  /** A fresh game with five team heroes (enough slots bought). */
  function teamOfFive() {
    const s = fresh();
    s.teamSlots = 5;
    const team = [starter, ...HEROES.filter((h) => h.rarity === 'common' && h.id !== starter.id).slice(0, 4)];
    for (const h of team) s.levels[h.id] = 1;
    return { s, ids: team.map((h) => h.id) };
  }

  it('the first 3 team heroes hold the Ultimate slots until the player picks', () => {
    const { s, ids } = teamOfFive();
    expect(s.ultSlots).toBe(ULT_SLOTS_START);
    expect(s.ultHeroes()).toHaveLength(3);
    expect(s.hasUltSlot(ids[4]) || s.hasUltSlot(ids[3])).toBe(true);
    expect(s.ultHeroes().every((id) => s.inLineup(id))).toBe(true);
  });

  it('picking a hero bumps one who only filled a slot; with every slot picked, someone must come out first', () => {
    const { s } = teamOfFive();
    const out = HEROES.filter((h) => s.inLineup(h.id) && !s.hasUltSlot(h.id)).map((h) => h.id);
    expect(out).toHaveLength(2);
    expect(s.setUltSlot(out[0], true)).toBe(true);
    expect(s.hasUltSlot(out[0])).toBe(true);
    expect(s.ultHeroes()).toHaveLength(3);
    expect(s.setUltSlot(out[0], true)).toBe(false); // already has one
    expect(s.setUltSlot(out[1], true)).toBe(true);
    const waiting = HEROES.filter((h) => s.inLineup(h.id) && !s.hasUltSlot(h.id)).map((h) => h.id);
    expect(s.setUltSlot(waiting[0], true)).toBe(true); // the third pick fills the last slot
    expect(s.setUltSlot(waiting[1], true)).toBe(false); // every slot is a pick now
    expect(s.setUltSlot(out[0], false)).toBe(true);
    expect(s.hasUltSlot(out[0])).toBe(false);
    expect(s.setUltSlot(waiting[1], true)).toBe(true);
  });

  it('a hero taken out stays out instead of refilling the open slot', () => {
    const { s } = teamOfFive();
    const first = s.ultHeroes()[0];
    s.setUltSlot(first, false);
    expect(s.hasUltSlot(first)).toBe(false);
    expect(s.ultHeroes()).toHaveLength(3); // a benched-from-slots hero's place goes to the next teammate
  });

  it('buys 2 more slots with Gems, up to 5', () => {
    const { s } = teamOfFive();
    s.gems = ULT_SLOT_COSTS.reduce((a, b) => a + b, 0);
    expect(s.buyUltSlot()).toBe(true);
    expect(s.buyUltSlot()).toBe(true);
    expect(s.buyUltSlot()).toBe(false);
    expect(s.ultSlots).toBe(ULT_SLOTS_MAX);
    expect(s.gems).toBe(0);
    expect(s.ultHeroes()).toHaveLength(5);
  });

  it('saves slots and picks; saves from before slots keep all 5', () => {
    const { s } = teamOfFive();
    const out = HEROES.find((h) => s.inLineup(h.id) && !s.hasUltSlot(h.id))!.id;
    s.setUltSlot(out, true);
    s.save();
    const back = new GameState();
    back.load();
    expect(back.ultPicks).toEqual([out]);
    expect(back.hasUltSlot(out)).toBe(true);
    expect(back.ultSlots).toBe(ULT_SLOTS_START);
    localStorage.setItem('hordefall-save-v1', JSON.stringify({ gold: '0' }));
    const old = new GameState();
    old.load();
    expect(old.ultSlots).toBe(ULT_SLOTS_MAX);
  });
});
