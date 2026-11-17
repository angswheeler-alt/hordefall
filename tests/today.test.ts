import { describe, expect, it } from 'vitest';
import { todayLeft, todayRows, weekLine, type TodayView } from '../src/today';

const base = (): TodayView => ({
  login: { ready: true, day: 3 },
  spinReady: true,
  dailies: { claimed: 0, claimable: 1, total: 3 },
  bundle: { claimed: false, ready: false },
  trials: { unlocked: false, open: [], allOpen: false, tickets: 20, cap: 20, double: false },
  pvp: { open: false, tickets: 10, cap: 10 },
  scout: { open: false, ready: 0, running: 0 },
  guildFights: null,
  rush: { open: false, on: false, endsIn: '' },
});

describe('Today card', () => {
  it('a new player sees only the home dailies', () => {
    const rows = todayRows(base());
    expect(rows.map((r) => r.id)).toEqual(['login', 'spin', 'daily', 'bundle']);
    expect(rows.find((r) => r.id === 'login')!.status).toBe('Day 4 ready');
    expect(todayLeft(rows)).toBe(4);
  });

  it('adds Trials, Colosseum, Scouting, Guild Boss and Rush once they are open', () => {
    const v = base();
    v.trials = { unlocked: true, open: ['earth', 'light'], allOpen: false, tickets: 20, cap: 20, double: true };
    v.pvp.open = true;
    v.scout = { open: true, ready: 2, running: 1 };
    v.guildFights = 3;
    v.rush = { open: true, on: true, endsIn: '2d 4h' };
    const rows = todayRows(v);
    expect(rows.map((r) => r.id)).toEqual(['login', 'spin', 'daily', 'bundle', 'trials', 'arena', 'scout', 'guild', 'rush']);
    const trials = rows.find((r) => r.id === 'trials')!;
    expect(trials.label).toBe('Trials · x2 crests');
    expect(trials.status).toBe('Earth, Light · 20/20');
    expect(trials.hot).toBe(true);
    expect(rows.find((r) => r.id === 'scout')!.status).toBe('2 back');
    expect(rows.find((r) => r.id === 'guild')!.status).toBe('3 fights left');
  });

  it('everything claimed and spent counts as all done', () => {
    const v = base();
    v.login.ready = false;
    v.spinReady = false;
    v.dailies = { claimed: 3, claimable: 0, total: 3 };
    v.bundle = { claimed: true, ready: true };
    v.trials = { unlocked: true, open: ['fire'], allOpen: false, tickets: 0, cap: 20, double: false };
    v.pvp = { open: true, tickets: 0, cap: 10 };
    v.scout = { open: true, ready: 0, running: 3 };
    v.guildFights = 0;
    expect(todayLeft(todayRows(v))).toBe(0);
  });

  it('a day with no Trials open is done for Trials', () => {
    const v = base();
    v.trials = { unlocked: true, open: [], allOpen: false, tickets: 20, cap: 20, double: false };
    const t = todayRows(v).find((r) => r.id === 'trials')!;
    expect(t.status).toBe('None open today');
    expect(t.done).toBe(true);
  });
});

describe('This week line', () => {
  // Tue 17 Nov 2026 local noon, then the next six days.
  const day = (i: number) => new Date(2026, 10, 17 + i, 12).getTime();
  it('names x2 Trial days, Rush days and an unbought deal', () => {
    const days = Array.from({ length: 7 }, (_, i) => ({ date: day(i), double: i === 4 || i === 5, rush: i >= 2 && i <= 5 }));
    expect(weekLine(days, { kind: 'voucher', bought: false })).toBe('x2 Trials Sat–Sun · Rush Thu–Sun · Hero Voucher deal');
  });
  it('says now when it runs today, and leaves out a bought deal', () => {
    const days = Array.from({ length: 7 }, (_, i) => ({ date: day(i), double: false, rush: i <= 1 }));
    expect(weekLine(days, { kind: 'crate', bought: true })).toBe('Rush now–Wed');
  });
});
