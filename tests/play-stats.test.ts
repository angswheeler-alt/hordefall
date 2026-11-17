import { describe, expect, it } from 'vitest';
import { addSeconds, addTab, newPlayerId, parseLog, playPayload } from '../src/playStats';

const fixed = () => 0.5;

describe('anonymous play stats', () => {
  it('makes a 24-character id that the server accepts', () => {
    expect(newPlayerId(fixed)).toMatch(/^[a-z0-9]{24}$/);
  });
  it('keeps the id and starts a new day from zero', () => {
    let log = parseLog(null, '2026-11-17', fixed);
    log = addSeconds(log, '2026-11-17', 600);
    log = addTab(log, '2026-11-17', 'heroes');
    log = addTab(log, '2026-11-17', 'heroes');
    expect(log).toMatchObject({ day: '2026-11-17', seconds: 600, tabs: ['heroes'] });
    const next = addTab(log, '2026-11-18', 'battle');
    expect(next).toEqual({ id: log.id, day: '2026-11-18', seconds: 0, tabs: ['battle'] });
  });
  it('reads a stored log back, and starts over from a damaged one', () => {
    const log = { id: 'abcdefghijklmnopqrstuvwx', day: '2026-11-17', seconds: 90, tabs: ['home', 'BAD tab'] };
    expect(parseLog(JSON.stringify(log), '2026-11-17', fixed)).toEqual({ ...log, tabs: ['home'] });
    expect(parseLog('{oops', '2026-11-17', fixed).seconds).toBe(0);
    expect(parseLog(JSON.stringify({ id: 'x' }), '2026-11-17', fixed).id).toMatch(/^[a-z0-9]{24}$/);
  });
  it('ignores odd screen names and caps a day', () => {
    const log = parseLog(null, '2026-11-17', fixed);
    expect(addTab(log, '2026-11-17', '<b>').tabs).toEqual([]);
    expect(addSeconds(log, '2026-11-17', 1e9).seconds).toBe(86_400);
  });
  it('sends whole minutes and numbers only', () => {
    const log = { id: 'abcdefghijklmnopqrstuvwx', day: '2026-11-17', seconds: 179, tabs: ['home'] };
    expect(playPayload(log, { bestStage: 950.7, stage: 900, rekindles: 6, daysPlayed: 9, signedIn: false })).toEqual({
      p_player: log.id,
      p_day: '2026-11-17',
      p_best_stage: 950,
      p_stage: 900,
      p_rekindles: 6,
      p_minutes: 2,
      p_days_played: 9,
      p_signed_in: false,
      p_tabs: ['home'],
    });
  });
});
