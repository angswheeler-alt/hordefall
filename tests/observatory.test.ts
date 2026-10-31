import { describe, expect, it } from 'vitest';
import { GameState } from '../src/state';
import { TICKET_CAP } from '../src/data';
import { OBSERVATORY, OBSERVATORY_RESPEC_GEMS, sigilCost, sigilsEarned, sigilsSpent } from '../src/observatory';
import { keeperThreshold } from '../src/formulas';

function fresh() {
  GameState.frozen = false;
  localStorage.clear();
  return new GameState();
}

/** A save past its first Rekindle with `n` Sigils earned (all from Rekindles, player level 1). */
function withSigils(n: number) {
  const s = fresh();
  s.rekindles = n;
  s.lifetimeEmbers = 0;
  return s;
}

describe('Observatory', () => {
  it('is closed before the first Rekindle', () => {
    const s = fresh();
    expect(s.observatoryOpen()).toBe(false);
    expect(s.buyObservatory('embers')).toBe(false);
    s.rekindles = 1;
    expect(s.observatoryOpen()).toBe(true);
  });

  it('earns one Sigil per Rekindle and per player level past 1', () => {
    expect(sigilsEarned(0, 1)).toBe(0);
    expect(sigilsEarned(3, 5)).toBe(7);
    const s = fresh();
    s.rekindles = 2;
    s.lifetimeEmbers = keeperThreshold(3); // player level 4
    expect(s.keeperLevel()).toBe(4);
    expect(s.sigils()).toBe(5);
  });

  it('ranks cost one more Sigil each and come out of the pool', () => {
    expect([0, 1, 2].map(sigilCost)).toEqual([1, 2, 3]);
    expect(sigilsSpent(3)).toBe(6);
    const s = withSigils(3);
    expect(s.buyObservatory('embers')).toBe(true);
    expect(s.buyObservatory('embers')).toBe(true);
    expect(s.sigils()).toBe(0);
    expect(s.buyObservatory('embers')).toBe(false);
    expect(s.obsRank('embers')).toBe(2);
  });

  it('stops at each constellation\'s max rank', () => {
    const s = withSigils(10_000);
    for (const d of OBSERVATORY) {
      for (let i = 0; i < d.max + 3; i++) s.buyObservatory(d.id);
      expect(s.obsRank(d.id)).toBe(d.max);
    }
  });

  it('Ember Lens raises the Rekindle payout', () => {
    const s = withSigils(3);
    s.reachStage(300);
    const before = s.pendingEmbers();
    s.buyObservatory('embers');
    s.buyObservatory('embers');
    expect(before).toBeGreaterThan(100);
    expect(s.pendingEmbers() / before).toBeCloseTo(1.2, 2);
  });

  it('Pilgrim Star raises the Trial ticket cap, and refills fill to it', () => {
    const s = withSigils(3);
    expect(s.ticketCap()).toBe(TICKET_CAP);
    s.buyObservatory('tickets');
    s.buyObservatory('tickets');
    expect(s.ticketCap()).toBe(TICKET_CAP + 2);
    s.tickets = TICKET_CAP;
    s.ticketClock = 0;
    s.refreshTickets(10 * 60 * 60 * 1000);
    expect(s.tickets).toBe(TICKET_CAP + 2);
  });

  it('switching off removes the buff but keeps the Sigils placed', () => {
    const s = withSigils(1);
    s.buyObservatory('tickets');
    s.tickets = TICKET_CAP + 1;
    expect(s.toggleObservatory('tickets')).toBe(true);
    expect(s.ticketCap()).toBe(TICKET_CAP);
    expect(s.tickets).toBe(TICKET_CAP);
    expect(s.sigils()).toBe(0);
    s.toggleObservatory('tickets');
    expect(s.ticketCap()).toBe(TICKET_CAP + 1);
    // Nothing to switch on an empty constellation.
    expect(s.toggleObservatory('speed')).toBe(false);
  });

  it('battle and offline speed grow with their ranks', () => {
    const s = withSigils(3);
    expect(s.gameSpeedBonus()).toBe(1);
    s.buyObservatory('speed');
    expect(s.gameSpeedBonus()).toBeCloseTo(1.025);
    s.buyObservatory('offline');
    expect(s.offlineSpeed()).toBeCloseTo(1.05);
  });

  it('offline time counts for more with Dreaming Moon, the 12 h cap stays on real time', () => {
    const a = withSigils(1);
    a.goldPerSec = 100;
    const b = withSigils(1);
    b.goldPerSec = 100;
    b.buyObservatory('offline');
    const ra = a.applyOffline(3600)!;
    const rb = b.applyOffline(3600)!;
    expect(ra.seconds).toBe(3600);
    expect(rb.seconds).toBe(3600);
    expect(rb.gold.toNumber()).toBeGreaterThan(ra.gold.toNumber());
    expect(b.applyOffline(48 * 3600)!.seconds).toBe(12 * 3600);
  });

  it('Leaping Star skips a normal stage on a low roll, never a boss stage', () => {
    const s = withSigils(1);
    s.reachStage(10);
    expect(s.rollStageSkip(0)).toBe(0); // no ranks yet
    s.buyObservatory('skip');
    expect(s.rollStageSkip(0.5)).toBe(0); // 1% chance, roll too high
    expect(s.rollStageSkip(0.005)).toBe(10);
    expect(s.stage).toBe(11);
    s.reachStage(50);
    expect(s.rollStageSkip(0)).toBe(0);
    expect(s.stage).toBe(50);
    s.autoAdvance = false;
    s.reachStage(12);
    expect(s.rollStageSkip(0)).toBe(0);
  });

  it('taking every Sigil back costs Gems', () => {
    const s = withSigils(3);
    s.buyObservatory('skip');
    s.buyObservatory('skip');
    s.toggleObservatory('skip');
    s.gems = OBSERVATORY_RESPEC_GEMS - 1;
    expect(s.respecObservatory()).toBe(false);
    s.gems = OBSERVATORY_RESPEC_GEMS;
    expect(s.respecObservatory()).toBe(true);
    expect(s.gems).toBe(0);
    expect(s.sigils()).toBe(3);
    expect(s.obsOff).toEqual([]);
    expect(s.respecObservatory()).toBe(false); // nothing placed
  });

  it('saves and loads ranks and switches, and drops junk', () => {
    const s = withSigils(10);
    s.buyObservatory('tickets');
    s.buyObservatory('speed');
    s.toggleObservatory('speed');
    s.tickets = TICKET_CAP + 1;
    s.save();
    const t = new GameState();
    t.load();
    expect(t.obsRank('tickets')).toBe(1);
    expect(t.obsRank('speed')).toBe(1);
    expect(t.obsOff).toEqual(['speed']);
    expect(t.tickets).toBe(TICKET_CAP + 1);

    const raw = JSON.parse(localStorage.getItem('hordefall-save-v1')!);
    raw.observatory = { tickets: 999, nope: 4, speed: 'x' };
    raw.obsOff = ['nope', 'tickets'];
    localStorage.setItem('hordefall-save-v1', JSON.stringify(raw));
    const u = new GameState();
    u.load();
    expect(u.observatory).toEqual({ tickets: OBSERVATORY.find((d) => d.id === 'tickets')!.max });
    expect(u.obsOff).toEqual(['tickets']);
  });
});
