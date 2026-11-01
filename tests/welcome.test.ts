import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameState } from '../src/state';
import { AWAKEN_UNLOCK_LEVEL, HEROES } from '../src/data';
import { RANK_DAILY } from '../src/colosseum';
import { keeperThreshold } from '../src/formulas';
import { eventNews, defenseNews, colosseumNews } from '../src/welcome';

// Local dates, so the weekday is the same in every time zone.
const at = (m: number, d: number, h = 12) => new Date(2026, m - 1, d, h).getTime();
const FRI = at(11, 6); // the week of a double-crest weekend (Sat 7 + Sun 8 Nov, the first of the month)
const SAT = at(11, 7);
const TUE = at(11, 10); // the week after: no event

let s: GameState;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FRI);
  localStorage.clear();
  s = new GameState();
  s.bestStage = 51; // Trials open
});
afterEach(() => vi.useRealTimers());

describe('While you were away: events', () => {
  it('says nothing when nothing changed', () => {
    expect(eventNews(s, FRI, FRI + 3_600_000)).toEqual([]);
    expect(eventNews(s, FRI, FRI)).toEqual([]);
  });

  it('tells a double-crest weekend started and which Trials open today', () => {
    const text = eventNews(s, FRI, SAT).join(' ');
    expect(text).toMatch(/Double Trial crests.*started/);
    expect(text).toMatch(/All five Trials are open today/);
    expect(text).toMatch(/new day/i);
    expect(text).not.toMatch(/Guild Boss|Hero Shop/);
  });

  it('tells the weekend ended, and a new week brings a Hero Shop deal and a Guild Boss', () => {
    const text = eventNews(s, SAT, TUE).join(' ');
    expect(text).toMatch(/double Trial crests weekend has ended/);
    expect(text).toMatch(/Hero Voucher/);
    expect(text).toMatch(/New Guild Boss week/);
    expect(text).toMatch(/Trials open today:/);
  });

  it('tells a weekend that came and went while away', () => {
    expect(eventNews(s, FRI, TUE).join(' ')).toMatch(/missed a double Trial crests weekend/);
  });

  it('leaves out Trial news before Trials unlock', () => {
    s.bestStage = 1;
    const text = eventNews(s, FRI, TUE).join(' ');
    expect(text).not.toMatch(/Trial/);
    expect(text).toMatch(/Guild Boss/);
  });
});

describe('While you were away: Colosseum', () => {
  it('pays the daily rank reward on opening and lists it', () => {
    s.lifetimeEmbers = keeperThreshold(AWAKEN_UNLOCK_LEVEL - 1);
    s.emberLevels[HEROES.find((h) => h.unlockCost === 0)!.id] = 50;
    expect(s.pvpOpen()).toBe(true);
    s.pvpTick(FRI);
    const lines = colosseumNews(s, SAT);
    expect(lines.join(' ')).toMatch(/Daily reward/);
    expect(s.starmotes).toBe(RANK_DAILY[0]);
  });

  it('counts defense fights since the player left, newest first, with safe names', () => {
    const iso = (t: number) => new Date(t).toISOString();
    const log = [
      { attacker: '<b>Zed</b>', attackerWon: true, at: iso(SAT + 2000) },
      { attacker: 'Mira', attackerWon: false, at: iso(SAT + 1000) },
      { attacker: 'Old', attackerWon: true, at: iso(FRI) },
    ];
    const lines = defenseNews(log, SAT);
    expect(lines[0]).toMatch(/attacked <b>2<\/b> times: <b>1<\/b> held, <b>1<\/b> lost/);
    expect(lines[1]).toBe('Lost to &lt;b&gt;Zed&lt;/b&gt;');
    expect(lines[2]).toBe('Beat Mira');
    expect(lines).toHaveLength(3);
    expect(defenseNews(log, SAT + 5000)).toEqual([]);
  });
});
