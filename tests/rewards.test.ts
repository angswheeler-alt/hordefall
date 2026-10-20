import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameState } from '../src/state';
import { HEROES, START_GEMS, ROAD_START, ROAD_STEP, ROAD_LENGTH, REKINDLE_STAGE, RELICS, WHEEL_PRIZES, LEVEL_GIFT_STONES } from '../src/data';
import { DAILIES, DAILY_GEMS, LOGIN_CYCLE, BOOTCAMP, ACHIEVEMENTS, dayKey } from '../src/rewards';

function fresh() {
  GameState.frozen = false;
  localStorage.clear();
  return new GameState();
}

const DAY = 24 * 3600 * 1000;
const noon = new Date(2026, 9, 13, 12).getTime();

beforeEach(() => {
  vi.useRealTimers();
});

describe('stage progress', () => {
  it('pays no Gems for stages or bosses any more', () => {
    const s = fresh();
    s.reachStage(500);
    expect(s.gems).toBe(START_GEMS);
  });
});

describe('daily challenges', () => {
  it('pay 5 Gems each, 25 a day, once each', () => {
    vi.useFakeTimers();
    vi.setSystemTime(noon);
    const s = fresh();
    expect(DAILIES.length * DAILY_GEMS).toBe(25);
    for (const d of DAILIES) {
      expect(s.claimDaily(d.stat)).toBe(false);
      s.track(d.stat, d.goal);
      expect(s.claimDaily(d.stat)).toBe(true);
      expect(s.claimDaily(d.stat)).toBe(false);
    }
    expect(s.gems).toBe(START_GEMS + 25);
  });

  it('reset on a new day but lifetime stats keep counting', () => {
    vi.useFakeTimers();
    vi.setSystemTime(noon);
    const s = fresh();
    s.track('kills', 300);
    s.claimDaily('kills');
    vi.setSystemTime(noon + DAY);
    const row = s.dailies().find((r) => r.def.stat === 'kills')!;
    expect(row.progress).toBe(0);
    expect(row.claimed).toBe(false);
    expect(s.stats.kills).toBe(300);
    expect(s.daily.day).toBe(dayKey(noon + DAY));
  });
});

describe('login calendar', () => {
  it('claims once a day through all 30 days, then starts over', () => {
    const s = fresh();
    let gems = s.gems;
    for (let i = 0; i < LOGIN_CYCLE.length; i++) {
      const now = noon + i * DAY;
      expect(s.claimLogin(now)).not.toBeNull();
      expect(s.claimLogin(now)).toBeNull();
      const paid = s.gems - gems;
      gems = s.gems;
      expect(paid).toBe(LOGIN_CYCLE[i].gems ?? 0);
    }
    expect(LOGIN_CYCLE.length).toBe(30);
    expect(s.loginState(noon + 30 * DAY)).toEqual({ day: 0, ready: true });
  });

  it('pays a balanced month: about the old Gems, plus stones and tickets', () => {
    const total = (k: 'gems' | 'chests' | 'goldMinutes' | 'stones' | 'tickets') => LOGIN_CYCLE.reduce((t, r) => t + (r[k] ?? 0), 0);
    expect(total('gems')).toBe(350);
    expect(total('chests')).toBe(15);
    expect(total('goldMinutes')).toBe(300);
    expect(total('stones')).toBe(19);
    expect(total('tickets')).toBe(17);
    // Every week pays at least as much as the one before.
    const weekGems = [0, 1, 2, 3].map((w) => LOGIN_CYCLE.slice(w * 7, w * 7 + 7).reduce((t, r) => t + (r.gems ?? 0), 0));
    for (let w = 1; w < 4; w++) expect(weekGems[w]).toBeGreaterThanOrEqual(weekGems[w - 1]);
  });

  it('gives Enhance Stones and Trial tickets (up to the ticket cap)', () => {
    const s = fresh();
    const stones = s.enhanceStones;
    s.grant({ stones: 4, tickets: 3 });
    expect(s.enhanceStones).toBe(stones + 4);
    s.tickets = 0;
    s.grant({ tickets: 3 });
    expect(s.tickets).toBe(3);
    s.grant({ tickets: 999 });
    expect(s.tickets).toBeLessThanOrEqual(20);
    expect(s.loginState(noon).day).toBe(0);
  });

  it('gives free Hero Chests without spending Gems', () => {
    const s = fresh();
    s.claimLogin(noon);
    s.claimLogin(noon + DAY);
    expect(LOGIN_CYCLE[2].chests).toBe(1);
    const got = s.claimLogin(noon + 2 * DAY)!;
    expect(got.drops.length).toBeGreaterThan(0);
    expect(s.gems).toBe(START_GEMS);
    expect(s.stats.summons).toBe(0);
  });
});

describe('Lucky Spin', () => {
  it('spins once a day', () => {
    const s = fresh();
    expect(s.spin(noon)).not.toBeNull();
    expect(s.spin(noon + 1000)).toBeNull();
    expect(s.spin(noon + DAY)).not.toBeNull();
  });
});

describe('achievements', () => {
  it('pay each tier once, in order', () => {
    const s = fresh();
    const stage = ACHIEVEMENTS.find((a) => a.id === 'stage')!;
    expect(s.claimAchievement('stage')).toBe(false);
    s.reachStage(stage.tiers[1][0]);
    expect(s.claimAchievement('stage')).toBe(true);
    expect(s.claimAchievement('stage')).toBe(true);
    expect(s.claimAchievement('stage')).toBe(false);
    expect(s.gems).toBe(START_GEMS + stage.tiers[0][1] + stage.tiers[1][1]);
  });
});

describe('Bootcamp', () => {
  it('pays when a goal is met, once', () => {
    const s = fresh();
    const lv = BOOTCAMP.find((b) => b.id === 'lv10')!;
    expect(s.claimBootcamp('lv10')).toBe(false);
    s.levels[HEROES[0].id] = 10;
    expect(s.claimBootcamp('lv10')).toBe(true);
    expect(s.claimBootcamp('lv10')).toBe(false);
    expect(s.gems).toBe(START_GEMS + lv.gems);
  });

  it('counts equipped relics', () => {
    const s = fresh();
    expect(s.bootcampDone(BOOTCAMP.find((b) => b.id === 'relic')!)).toBe(false);
    s.relics[RELICS[0].id] = 1;
    s.equipped = [RELICS[0].id];
    expect(s.bootcampDone(BOOTCAMP.find((b) => b.id === 'relic')!)).toBe(true);
  });
});

describe('Rekindle Wheel', () => {
  it('unlocks slots by this run’s best stage and spins once per slot without paying Gems', () => {
    const s = fresh();
    s.reachStage(REKINDLE_STAGE + 1);
    expect(s.roadReached()).toBe(0);
    s.reachStage(ROAD_START + 2 * ROAD_STEP);
    expect(s.roadReached()).toBe(3);
    const gems = s.gems;
    const r = s.rekindle(1)!;
    expect(r.wheel.length).toBe(3);
    expect(s.gems).toBe(gems);
    expect(s.roadReached()).toBe(0);
    s.reachStage(ROAD_START + 100 * ROAD_STEP);
    expect(s.roadReached()).toBe(ROAD_LENGTH);
  });

  it('never pays medals', () => {
    expect(WHEEL_PRIZES.every((p) => (p.prize.kind as string) !== 'chest')).toBe(true);
    const s = fresh();
    s.reachStage(ROAD_START + 100 * ROAD_STEP);
    const crests = { ...s.crests };
    const r = s.rekindle(1)!;
    expect(r.wheel.length).toBe(ROAD_LENGTH);
    expect(r.wheel.some((line) => line.includes('Chest'))).toBe(false);
    expect(r.levelsGained).toBeGreaterThan(0);
    expect(r.stones).toBe(r.levelsGained * LEVEL_GIFT_STONES);
    expect(s.crests).toEqual(crests);
  });
});

describe('saves', () => {
  it('keep reward progress', () => {
    const s = fresh();
    s.track('kills', 42);
    s.claimLogin(noon);
    s.spin(noon);
    s.bootcamp.push('lv10');
    s.achieved.stage = 2;
    s.save();
    const t = new GameState();
    t.load();
    expect(t.stats.kills).toBe(42);
    expect(t.login.count).toBe(1);
    expect(t.spinDay).toBe(dayKey(noon));
    expect(t.bootcamp).toEqual(['lv10']);
    expect(t.achieved.stage).toBe(2);
  });
});

describe('released heroes', () => {
  it('chests, the medal bundle, the guild shop and Wild Medals only give released heroes', async () => {
    const { RELEASED_HEROES } = await import('../src/data');
    const s = fresh();
    s.gems = 1e6;
    const ids = new Set<string>();
    for (let i = 0; i < 200; i++) for (const d of s.summon() ?? []) ids.add(d.heroId);
    for (const d of s.medalBundleState(noon).drops) ids.add(d.heroId);
    for (const o of s.guildShopState(noon).offers) ids.add(o.heroId);
    for (const id of ids) expect(RELEASED_HEROES).toContain(id);
    const { HEROES: all } = await import('../src/data');
    const hidden = all.find((h) => !RELEASED_HEROES.includes(h.id));
    if (hidden) expect(s.wildMedalCost(hidden.id)).toBeNull();
    expect(s.wildMedalCost('brine')).not.toBeNull();
  });
});

describe('Stage Milestones', () => {
  it('pay once per 50th-stage boss beaten, on the best stage ever', () => {
    const s = fresh();
    expect(s.milestonesReady()).toBe(0);
    expect(s.claimMilestones()).toBeNull();
    s.reachStage(50); // the stage 50 boss isn't beaten yet
    expect(s.milestonesReady()).toBe(0);
    s.reachStage(51);
    expect(s.milestonesReady()).toBe(1);
    expect(s.rewardsWaiting()).toBe(true);
    const stones = s.enhanceStones;
    const got = s.claimMilestones()!;
    expect(got.count).toBe(1);
    expect(got.stones).toBe(1);
    expect(got.chests).toBe(0);
    expect(s.enhanceStones).toBe(stones + 1);
    expect(s.gems).toBe(START_GEMS);
    expect(s.claimMilestones()).toBeNull();
  });

  it('claims every waiting milestone at once and never pays Gems', () => {
    const s = fresh();
    s.tickets = 0;
    s.reachStage(501); // 50..500: ten milestones
    const got = s.claimMilestones()!;
    expect(got.count).toBe(10);
    // 100,200,300,400 pay 1 chest; 500 pays 3.
    expect(got.chests).toBe(7);
    expect(got.drops.length).toBeGreaterThan(0);
    expect(got.stones).toBe(5 + 4 + 5);
    expect(got.tickets).toBe(4 * 3 + 5);
    expect(s.tickets).toBe(17);
    expect(s.gems).toBe(START_GEMS);
    expect(s.milestone).toBe(500);
  });

  it("can't be farmed again after a Rekindle", () => {
    const s = fresh();
    s.reachStage(301);
    s.claimMilestones();
    s.stage = 1;
    s.runBestStage = 1;
    s.reachStage(301);
    expect(s.milestonesReady()).toBe(0);
    s.reachStage(351);
    expect(s.milestonesReady()).toBe(1);
  });

  it('survive a save and load', () => {
    const s = fresh();
    s.reachStage(201);
    s.claimMilestones();
    const t = new GameState();
    t.load();
    expect(t.milestone).toBe(200);
    expect(t.milestonesReady()).toBe(0);
  });
});
