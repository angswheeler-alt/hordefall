import { describe, expect, it } from 'vitest';
import { nudgeDue, NUDGE_DAY2, type NudgeView } from '../src/accountNudge';

const guest = (o: Partial<NudgeView> = {}): NudgeView => ({ signedIn: false, online: true, tutorialDone: true, bestStage: 1, loginDays: 1, seen: [], ...o });

describe('account nudge for guests', () => {
  it('waits until the stage 50 boss is beaten', () => {
    expect(nudgeDue(guest({ bestStage: 50 }))).toBeNull();
    expect(nudgeDue(guest({ bestStage: 51 }))).toBe('account-boss50:1');
  });
  it('never shows to signed-in players, offline builds or mid-guide', () => {
    expect(nudgeDue(guest({ bestStage: 900, signedIn: true }))).toBeNull();
    expect(nudgeDue(guest({ bestStage: 900, online: false }))).toBeNull();
    expect(nudgeDue(guest({ bestStage: 900, tutorialDone: false }))).toBeNull();
  });
  it('asks once more on a later day, never twice the same day', () => {
    expect(nudgeDue(guest({ bestStage: 900, loginDays: 1, seen: ['account-boss50:1'] }))).toBeNull();
    expect(nudgeDue(guest({ bestStage: 900, loginDays: 2, seen: ['account-boss50:1'] }))).toBe(NUDGE_DAY2);
    // A guest already past day 2 gets the first nudge today and the second on a later day.
    expect(nudgeDue(guest({ bestStage: 900, loginDays: 9 }))).toBe('account-boss50:9');
    expect(nudgeDue(guest({ bestStage: 900, loginDays: 9, seen: ['account-boss50:9'] }))).toBeNull();
    expect(nudgeDue(guest({ bestStage: 900, loginDays: 10, seen: ['account-boss50:9'] }))).toBe(NUDGE_DAY2);
  });
  it('stops after both', () => {
    expect(nudgeDue(guest({ bestStage: 900, loginDays: 30, seen: ['account-boss50:2', NUDGE_DAY2] }))).toBeNull();
  });
});
