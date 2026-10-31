import { beforeEach, describe, expect, it } from 'vitest';
import Decimal from 'break_infinity.js';
import { GameState, cleanSnapHero, type PvpCandidate } from '../src/state';
import { HEROES, AWAKEN_UNLOCK_LEVEL } from '../src/data';
import { keeperThreshold } from '../src/formulas';
import {
  RANK_TROPHIES, RANK_DAILY, RANK_WEEKLY, LEGEND, PVP_TICKET_CAP, PVP_TICKET_MINUTES, PVP_WIN_TROPHIES, PVP_WIN_MOTES, PVP_CP_MIN, PVP_CP_MAX, PVP_LOSS_TROPHIES, PVP_FIRST_WIN_MOTES, PVP_QUICK_CP,
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
  it('only gain trophies by winning at least 40% of fights', () => {
    // Expected trophies at win rate p: win * p - loss * (1 - p).
    expect(PVP_LOSS_TROPHIES / (PVP_WIN_TROPHIES + PVP_LOSS_TROPHIES)).toBeGreaterThanOrEqual(0.4);
  });

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

  it('build the same three opponents from the same seed, at a random share of the player\'s power', () => {
    const a = opened();
    const b = opened();
    a.rollPvpOpponents(WED);
    b.rollPvpOpponents(WED);
    expect(a.pvp.picks).toEqual(b.pvp.picks);
    expect(a.pvp.picks).toHaveLength(3);
    const mine = a.teamCpOf(a.pvpAttackTeam()).toNumber();
    for (const p of a.pvp.picks) {
      const ratio = Number(p.cp) / mine;
      expect(ratio).toBeGreaterThan(PVP_CP_MIN * 0.98);
      expect(ratio).toBeLessThan(PVP_CP_MAX * 1.02);
    }
    expect(a.pvp.picks.every((p) => p.ghost && p.heroes.length === a.pvpAttackTeam().length)).toBe(true);
    // Bot names look like usernames and never say "Ghost".
    expect(a.pvp.picks.every((p) => p.name.length > 2 && !/ghost/i.test(p.name))).toBe(true);
  });

  it('pay trophies and Starmotes for a win, with the first-win bonus once a day', () => {
    const s = opened();
    s.rollPvpOpponents(WED);
    expect(s.startPvp(1, WED)).not.toBeNull();
    expect(s.pvp.tickets).toBe(PVP_TICKET_CAP - 1);
    expect(s.skillTeam?.has(starter.id)).toBe(true);
    const r = s.finishPvp(true, WED)!;
    expect(s.skillTeam).toBeNull();
    expect(r.trophies).toBe(PVP_WIN_TROPHIES);
    expect(r.starmotes).toBe(PVP_WIN_MOTES + PVP_FIRST_WIN_MOTES);
    expect(s.pvp.streak).toBe(1);
    expect(s.pvp.picks).toEqual([]); // new opponents are fetched next
    s.rollPvpOpponents(WED);
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
    s.rollPvpOpponents(WED);
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

  it('open Quick Battle only when the attack team is clearly stronger, and pay it as a win', () => {
    const s = opened();
    s.rollPvpOpponents(WED);
    const mine = s.teamCpOf(s.pvpAttackTeam());
    // An opponent near the player's own power: no Quick Battle.
    expect(s.pvp.picks.every((p) => new Decimal(p.cp).times(PVP_QUICK_CP).gt(mine))).toBe(true);
    expect(s.canQuickPvp(0, WED)).toBe(false);
    expect(s.quickPvp(0, WED)).toBeNull();
    expect(s.pvp.tickets).toBe(PVP_TICKET_CAP);
    // A much weaker team (same heroes, a fraction of the power): Quick Battle opens.
    s.pvp.picks[0] = s.buildGhost('weak', mine.times(0.2));
    expect(s.canQuickPvp(0, WED)).toBe(true);
    const r = s.quickPvp(0, WED)!;
    expect(r.won).toBe(true);
    expect(r.trophies).toBe(PVP_WIN_TROPHIES);
    expect(s.pvp.tickets).toBe(PVP_TICKET_CAP - 1);
    expect(s.pvp.active).toBe(-1);
    expect(s.skillTeam).toBeNull();
    expect(s.pvp.streak).toBe(1);
    expect(s.pvp.picks).toEqual([]);
  });

  it('keep Quick Battle shut with no tickets, or when the CP edge loses the forecast', () => {
    const s = opened();
    s.rollPvpOpponents(WED);
    const mine = s.teamCpOf(s.pvpAttackTeam());
    s.pvp.picks[0] = s.buildGhost('weak', mine.times(0.2));
    expect(s.pvpClearlyStronger(0, { won: false, seconds: 60, hits: [], left: [[1], [1]] })).toBe(false);
    expect(s.pvpClearlyStronger(0, { won: true, seconds: 60, hits: [], left: [[0.3], [0]] })).toBe(false);
    s.pvp.tickets = 0;
    s.pvp.clock = WED;
    expect(s.canQuickPvp(0, WED)).toBe(false);
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

describe('Colosseum real opponents', () => {
  const snapOf = (s: GameState, cpScale: number): PvpCandidate => {
    const snap = s.pvpSnapshot();
    return { userId: `u${cpScale}`, name: `Player ${cpScale}`, cp: new Decimal(snap.p_team_cp).times(cpScale).toString(), team: snap.p_team };
  };

  it('upload the defense team with permanent stats only', () => {
    const s = opened();
    s.levels[starter.id] = 500; // gold levels don't count
    const snap = s.pvpSnapshot();
    expect(snap.p_team).toHaveLength(1);
    expect(snap.p_team[0].id).toBe(starter.id);
    expect(snap.p_team[0].hp).toBe(s.heroStats(starter, s.permanentLevel(starter.id)).hp.value.toString());
    expect(snap.p_cp_log).toBeGreaterThan(0);
  });

  it('mix in real players near the player\'s power, bots for the rest', () => {
    const s = opened();
    s.rollPvpOpponents(WED, [snapOf(s, 1.0), snapOf(s, 3)]);
    const real = s.pvp.picks.filter((p) => !p.ghost);
    expect(real).toHaveLength(1); // 3x is too far above the player
    expect(real[0].userId).toBe('u1');
    expect(s.pvp.picks).toHaveLength(3);
  });

  it('fight a real team with the stats it was saved with', () => {
    const s = opened();
    const c = snapOf(s, 1);
    c.team[0].atk = '12345';
    s.rollPvpOpponents(WED, [c]);
    const foe = s.pvpFoeUnits(s.pvp.picks.find((p) => !p.ghost)!);
    expect(foe[0].stats.atk.value.toString()).toBe('12345');
    expect(foe[0].unit.hp.toString()).toBe(c.team[0].hp);
  });

  it('reject bad saved heroes from the server', () => {
    const good = opened().pvpSnapshot().p_team[0];
    expect(cleanSnapHero(good)).toEqual(good);
    expect(cleanSnapHero({ ...good, id: 'nobody' })).toBeNull();
    expect(cleanSnapHero({ ...good, atk: 'NaN' })).toBeNull();
    expect(cleanSnapHero({ ...good, aps: Infinity })).toBeNull();
    expect(cleanSnapHero({ ...good, crit: 5 })!.crit).toBe(1);
    expect(cleanSnapHero(null)).toBeNull();
  });
});
