import { beforeEach, describe, expect, it } from 'vitest';
import Decimal from 'break_infinity.js';
import { GameState } from '../src/state';
import { HEROES, AWAKEN_UNLOCK_LEVEL } from '../src/data';
import { keeperThreshold } from '../src/formulas';
import {
  RANK_TROPHIES, RANK_DAILY, RANK_WEEKLY, LEGEND, PVP_TICKET_CAP, PVP_TICKET_MINUTES, PVP_BANDS, PVP_LOSS_TROPHIES, PVP_FIRST_WIN_MOTES,
  rankIndex, rankName, droppedTrophies, seededRandom, simulatePvp, type PvpUnit,
} from '../src/colosseum';

const starter = HEROES.find((h) => h.unlockCost === 0)!;
// Local noon on a Wednesday and the days after it, so day and week changes are exact.
const WED = new Date(2026, 9, 21, 12).getTime();
const DAY = 86_400_000;

function opened(): GameState {
  const s = new GameState();
  s.lifetimeEmbers = keeperThreshold(AWAKEN_UNLOCK_LEVEL - 1);
  s.emberLevels[starter.id] = 50;
  return s;
}

const unit = (over: Partial<PvpUnit>): PvpUnit => ({ id: 'x', element: 'water', atk: new Decimal(10), hp: new Decimal(100), def: new Decimal(1), attacksPerSec: 1, critRate: 0, critDmg: 0, melee: true, ...over });

beforeEach(() => localStorage.clear());

describe('Colosseum ranks', () => {
  it('climb Bronze I to Legend, each step needing more trophies', () => {
    expect(rankName(0)).toBe('Bronze I');
    expect(rankName(5)).toBe('Silver III');
    expect(rankName(LEGEND)).toBe('Legend');
    for (let i = 2; i < LEGEND; i++) expect(RANK_TROPHIES[i] - RANK_TROPHIES[i - 1]).toBeGreaterThanOrEqual(RANK_TROPHIES[i - 1] - RANK_TROPHIES[Math.max(0, i - 2)]);
    expect(rankIndex(0)).toBe(0);
    expect(rankIndex(59)).toBe(0);
    expect(rankIndex(60)).toBe(1);
    expect(rankIndex(99_999)).toBe(LEGEND);
    for (let i = 1; i < RANK_DAILY.length; i++) {
      expect(RANK_DAILY[i]).toBeGreaterThan(RANK_DAILY[i - 1]);
      expect(RANK_WEEKLY[i]).toBeGreaterThan(RANK_WEEKLY[i - 1]);
    }
  });

  it('drop one full rank each week, never below Bronze I', () => {
    expect(rankIndex(droppedTrophies(RANK_TROPHIES[7] + 5))).toBe(4);
    expect(droppedTrophies(RANK_TROPHIES[7] + 5)).toBe(RANK_TROPHIES[4]);
    expect(droppedTrophies(50)).toBe(0);
    expect(rankIndex(droppedTrophies(5000))).toBe(LEGEND - 1 - 3);
  });
});

describe('Colosseum rewards', () => {
  it('pay the daily reward for the rank held, and the weekly one plus the drop on Monday', () => {
    const s = opened();
    expect(s.pvpTick(WED)).toEqual([]); // first open only starts the clocks
    s.pvp.trophies = RANK_TROPHIES[7] + 10; // Gold II
    s.pvpTick(WED + DAY); // Thursday
    expect(s.starmotes).toBe(RANK_DAILY[7]);
    s.pvpTick(WED + DAY + 3600_000); // same day: nothing more
    expect(s.starmotes).toBe(RANK_DAILY[7]);
    const lines = s.pvpTick(WED + 5 * DAY); // next Monday
    expect(s.starmotes).toBe(2 * RANK_DAILY[7] + RANK_WEEKLY[7]);
    expect(s.pvp.trophies).toBe(RANK_TROPHIES[4]);
    expect(lines.join(' ')).toMatch(/drop to Silver II/);
  });

  it('stay closed below the unlock level', () => {
    const s = new GameState();
    expect(s.pvpOpen()).toBe(false);
    expect(s.pvpTick(WED)).toEqual([]);
    expect(s.startPvp(0, WED)).toBeNull();
  });
});

describe('Colosseum tickets and fights', () => {
  it('regain tickets over time and spend one per battle', () => {
    const s = opened();
    s.pvp.tickets = 0;
    s.pvp.clock = WED;
    s.refreshPvpTickets(WED + PVP_TICKET_MINUTES * 60_000 * 3);
    expect(s.pvp.tickets).toBe(3);
    s.refreshPvpTickets(WED + PVP_TICKET_MINUTES * 60_000 * 100);
    expect(s.pvp.tickets).toBe(PVP_TICKET_CAP);
  });

  it('build the same Ghosts from the same seed, near the target CP', () => {
    const a = opened();
    const b = opened();
    a.rollPvpOpponents(WED);
    b.rollPvpOpponents(WED);
    expect(a.pvp.picks).toEqual(b.pvp.picks);
    expect(a.pvp.picks).toHaveLength(3);
    const mine = a.teamCpOf(a.pvpAttackTeam()).toNumber();
    const cps = a.pvp.picks.map((p) => Number(p.cp));
    // Weaker < Even < Stronger, each within reach of its band.
    expect(cps[0]).toBeLessThan(cps[2]);
    PVP_BANDS.forEach((band, i) => expect(Math.abs(cps[i] / (mine * band.cp) - 1)).toBeLessThan(0.02));
    expect(cps[0]).toBeLessThan(cps[1]);
    expect(cps[1]).toBeLessThan(cps[2]);
    expect(a.pvp.picks.every((p) => p.ghost && p.heroes.length === a.pvpAttackTeam().length)).toBe(true);
  });

  it('pay trophies and Starmotes for a win, with the first-win bonus once a day', () => {
    const s = opened();
    s.rollPvpOpponents(WED);
    const band = PVP_BANDS[s.pvp.picks[1].band];
    expect(s.startPvp(1, WED)).not.toBeNull();
    expect(s.pvp.tickets).toBe(PVP_TICKET_CAP - 1);
    expect(s.skillTeam?.has(starter.id)).toBe(true);
    const r = s.finishPvp(true, WED)!;
    expect(s.skillTeam).toBeNull();
    expect(r.trophies).toBe(band.win);
    expect(r.starmotes).toBe(band.motes + PVP_FIRST_WIN_MOTES);
    expect(s.pvp.streak).toBe(1);
    s.startPvp(1, WED);
    const r2 = s.finishPvp(true, WED)!;
    expect(r2.firstWin).toBe(false);
    expect(s.pvpStreakBonus()).toBeCloseTo(0.2, 9);
  });

  it('take trophies for a loss (never below zero) and reset the streak', () => {
    const s = opened();
    s.rollPvpOpponents(WED);
    s.pvp.trophies = 3;
    s.pvp.streak = 2;
    s.startPvp(0, WED);
    const r = s.finishPvp(false, WED)!;
    expect(r.trophies).toBe(-3);
    expect(s.pvp.trophies).toBe(0);
    expect(s.pvp.streak).toBe(0);
    s.pvp.trophies = 100;
    s.startPvp(0, WED);
    s.finishPvp(false, WED);
    expect(s.pvp.trophies).toBe(100 - PVP_LOSS_TROPHIES);
  });

  it('count a battle cut short by closing the game as a loss', () => {
    const s = opened();
    s.rollPvpOpponents(WED);
    s.pvp.trophies = 50;
    s.startPvp(0, WED);
    s.save();
    const t = new GameState();
    expect(t.load()).toBe(true);
    expect(t.pvp.active).toBe(-1);
    expect(t.pvp.trophies).toBe(50 - PVP_LOSS_TROPHIES);
    expect(t.pvp.tickets).toBe(PVP_TICKET_CAP - 1);
  });

  it('keep attack and defense teams to recruited heroes', () => {
    const s = opened();
    const locked = HEROES.find((h) => (s.levels[h.id] ?? 0) === 0)!;
    expect(s.setPvpTeam('defense', [locked.id])).toBe(false);
    expect(s.setPvpTeam('defense', [starter.id, locked.id])).toBe(true);
    expect(s.pvpDefenseTeam().map((h) => h.id)).toEqual([starter.id]);
  });
});

describe('Colosseum fight forecast', () => {
  it('is the same every time and favours the stronger team', () => {
    const strong = [unit({ atk: new Decimal(20) })];
    const weak = [unit({})];
    const a = simulatePvp(strong, weak);
    expect(a).toEqual(simulatePvp(strong, weak));
    expect(a.won).toBe(true);
    expect(simulatePvp(weak, strong).won).toBe(false);
  });

  it('counts elements: Water beats an equal Fire team', () => {
    expect(simulatePvp([unit({ element: 'water' })], [unit({ element: 'fire' })]).won).toBe(true);
    expect(simulatePvp([unit({ element: 'fire' })], [unit({ element: 'water' })]).won).toBe(false);
  });

  it('works with huge stats', () => {
    const big = (n: string) => new Decimal(n);
    const r = simulatePvp([unit({ atk: big('1e400'), hp: big('1e402'), def: big('1e398') })], [unit({ atk: big('1e399'), hp: big('1e402'), def: big('1e398') })]);
    expect(r.won).toBe(true);
  });

  it('seeded random is repeatable', () => {
    const a = seededRandom('x');
    const b = seededRandom('x');
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});
