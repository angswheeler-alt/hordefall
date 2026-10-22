import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameState, SHOP_HEROES } from '../src/state';
import { HEROES, TICKET_CAP, BOUGHT_TICKET_CAP, TICKET_CRATE, HERO_VOUCHER, TRIAL_MEDALS, TRIAL_EVENT_MEDAL_MULT, TRIAL_ROTATION } from '../src/data';

// Local dates, so the weekday is the same in every time zone.
const at = (m: number, d: number, h = 12) => new Date(2026, m - 1, d, h).getTime();
const MON = at(10, 19); // a week with a double-medal weekend
const WED = at(10, 21);
const SAT = at(10, 24);
const SUN = at(10, 25);
const NEXT_SAT = at(10, 31); // the week after: no event

let s: GameState;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(WED);
  localStorage.clear();
  s = new GameState();
  s.gems = 100_000;
  s.bestStage = 51;
});
afterEach(() => vi.useRealTimers());

describe('Trial days', () => {
  it('open every element on Saturday and Sunday', () => {
    expect(s.openTrials(SAT)).toEqual(TRIAL_ROTATION);
    expect(s.openTrials(SUN)).toEqual(TRIAL_ROTATION);
  });

  it('open each element only on its own weekdays', () => {
    expect(s.openTrials(MON).sort()).toEqual(['dark', 'fire']);
    expect(s.openTrials(at(10, 20)).sort()).toEqual(['earth', 'light']);
    expect(s.openTrials(WED).sort()).toEqual(['fire', 'water']);
    expect(s.openTrials(at(10, 22)).sort()).toEqual(['earth', 'light']);
    expect(s.openTrials(at(10, 23)).sort()).toEqual(['dark', 'water']);
    expect(s.trialDays('earth')).toEqual([0, 2, 4, 6]);
  });

  it('give every element two weekdays plus the weekend', () => {
    for (const e of TRIAL_ROTATION) expect(s.trialDays(e)).toHaveLength(4);
  });
});

describe('double-medal weekends', () => {
  it('run Saturday and Sunday every other week', () => {
    expect(s.trialEventOn(SAT)).toBe(true);
    expect(s.trialEventOn(SUN)).toBe(true);
    expect(s.trialEventOn(at(10, 23))).toBe(false);
    expect(s.trialEventOn(NEXT_SAT)).toBe(false);
    expect(s.trialEventOn(at(11, 7))).toBe(true);
    expect(s.nextTrialEvent(WED)).toEqual({ start: at(10, 24, 0), end: at(10, 26, 0) });
    expect(s.nextTrialEvent(at(10, 27)).start).toBe(at(11, 7, 0));
  });

  it('pay double Trial medals, Quick Battles too', () => {
    vi.setSystemTime(SAT);
    expect(s.finishTrial('water', 1, true, 10)!.medals).toHaveLength(TRIAL_MEDALS * TRIAL_EVENT_MEDAL_MULT);
    s.trialTimes['water:1'] = 5;
    expect(s.quickTrial('water', 1)!.medals).toHaveLength(TRIAL_MEDALS * TRIAL_EVENT_MEDAL_MULT);
    vi.setSystemTime(NEXT_SAT);
    expect(s.finishTrial('water', 1, true, 10)!.medals).toHaveLength(TRIAL_MEDALS);
  });

  it('show on the calendar', () => {
    const days = s.calendar(28, MON);
    expect(days).toHaveLength(28);
    expect(days.filter((d) => d.double).map((d) => new Date(d.date).getDate())).toEqual([24, 25, 7, 8]);
    expect(days[0].deal).toBe('crate');
    expect(days[7].deal).toBe('voucher');
  });
});

describe('bought ticket stash', () => {
  it('is used after the free tickets', () => {
    s.tickets = 1;
    s.ticketClock = WED;
    s.boughtTickets = 2;
    expect(s.trialTickets()).toBe(3);
    s.finishTrial('water', 1, true, 10);
    expect([s.tickets, s.boughtTickets]).toEqual([0, 2]);
    s.finishTrial('water', 1, true, 10);
    expect([s.tickets, s.boughtTickets]).toEqual([0, 1]);
    expect(s.canStartTrial('water', 1)).toBe(true);
    s.finishTrial('water', 1, true, 10);
    expect(s.canStartTrial('water', 1)).toBe(false);
  });
});

describe('limited deals', () => {
  it('sell the Ticket Crate once in an event week', () => {
    const d = s.dealState(WED);
    expect(d.kind).toBe('crate');
    expect(s.buyDeal(WED)).toBe(true);
    expect(s.boughtTickets).toBe(TICKET_CRATE.tickets);
    expect(s.tickets).toBe(TICKET_CAP);
    expect(s.gems).toBe(100_000 - TICKET_CRATE.gems);
    expect(s.buyDeal(SUN)).toBe(false);
    expect(s.dealState(WED).endsAt).toBe(at(10, 26, 0));
  });

  it('need room in the stash for the crate', () => {
    s.boughtTickets = BOUGHT_TICKET_CAP - TICKET_CRATE.tickets + 1;
    expect(s.buyDeal(WED)).toBe(false);
  });

  it('sell a Hero Voucher in the other week, used on any non-Legendary hero', () => {
    const t = at(10, 28);
    expect(s.dealState(t).kind).toBe('voucher');
    expect(s.buyDeal(t)).toBe(true);
    expect(s.buyDeal(t)).toBe(false);
    expect(s.vouchers).toBe(1);
    const legend = HEROES.find((h) => h.rarity === 'legendary')!;
    expect(s.useVoucher(legend.id)).toBeNull();
    const epic = SHOP_HEROES.find((h) => h.rarity === 'epic')!;
    expect(s.useVoucher(epic.id)?.[0].crests).toBe(HERO_VOUCHER.medals.epic);
    expect(s.vouchers).toBe(0);
    expect(s.useVoucher(epic.id)).toBeNull();
    expect(HERO_VOUCHER.medals.common).toBeGreaterThan(HERO_VOUCHER.medals.rare);
    expect(HERO_VOUCHER.medals.rare).toBeGreaterThan(HERO_VOUCHER.medals.epic);
  });

  it('save the stash, vouchers and what was bought', () => {
    s.buyDeal(WED);
    s.vouchers = 2;
    s.save();
    const t = new GameState();
    expect(t.load()).toBe(true);
    expect(t.boughtTickets).toBe(TICKET_CRATE.tickets);
    expect(t.vouchers).toBe(2);
    expect(t.dealState(WED).bought).toBe(true);
  });
});
