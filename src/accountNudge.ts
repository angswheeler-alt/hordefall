/**
 * A friendly nudge for guests to make an account, so a cleared or lost phone doesn't wipe their progress.
 * Shown once after the stage 50 boss and once more on their second day (two daily logins). Pure rules here;
 * src/main.ts shows the pop-up. The ids are stored in the save's tipsSeen list so each shows only once.
 */
import { BOSS_EVERY } from './data';

export const NUDGE_BOSS = 'account-boss50';
export const NUDGE_DAY2 = 'account-day2';

export const NUDGE_TITLE = 'Keep your progress safe';
export const NUDGE_TEXT =
  '<p>Right now your progress is only saved on this phone. If the phone is cleared, lost or replaced, it\'s gone.</p>' +
  '<p>Make a free account (just a username and password) to back it up online. It also lets you join a guild and add friends.</p>';

export interface NudgeView {
  /** Signed in already (or no online saves in this build). */
  signedIn: boolean;
  online: boolean;
  tutorialDone: boolean;
  bestStage: number;
  /** Daily login rewards claimed so far (one per day played). */
  loginDays: number;
  seen: readonly string[];
}

/** The login-day count stored with the first nudge ("account-boss50:3"), or null before it was shown. */
function firstNudgeDay(seen: readonly string[]): number | null {
  const tag = seen.find((t) => t.startsWith(`${NUDGE_BOSS}:`));
  return tag ? Number(tag.slice(NUDGE_BOSS.length + 1)) || 0 : null;
}

/**
 * The tipsSeen entry to record if a nudge is due now, or null. The first nudge records the login-day count it was
 * shown on, so the second waits for a later day even for a player who was already past stage 50 and day 2.
 */
export function nudgeDue(v: NudgeView): string | null {
  if (v.signedIn || !v.online || !v.tutorialDone) return null;
  const first = firstNudgeDay(v.seen);
  if (first === null) return v.bestStage > BOSS_EVERY || v.loginDays >= 2 ? `${NUDGE_BOSS}:${v.loginDays}` : null;
  if (!v.seen.includes(NUDGE_DAY2) && v.loginDays >= 2 && v.loginDays > first) return NUDGE_DAY2;
  return null;
}
