/**
 * The "Today" card at the top of Home: one list of everything worth doing right now, each with a Go button that
 * jumps to where it lives. Nothing moves; the card only points. Pure rules here, src/ui.ts draws it.
 */

/** Where a Go button takes the player. */
export type TodayGo = 'login' | 'spin' | 'daily' | 'bundle' | 'trials' | 'arena' | 'scout' | 'guild' | 'rush';

export interface TodayRow {
  id: TodayGo;
  label: string;
  /** Short status, e.g. "14/20 tickets". */
  status: string;
  /** Nothing left to do here today. */
  done: boolean;
  /** Something is waiting right now (a claim, full tickets): the Go button glows. */
  hot: boolean;
}

/** What the card needs to know about the game right now. */
export interface TodayView {
  login: { ready: boolean; day: number };
  spinReady: boolean;
  dailies: { claimed: number; claimable: number; total: number };
  bundle: { claimed: boolean; ready: boolean };
  trials: { unlocked: boolean; open: string[]; allOpen: boolean; tickets: number; cap: number; double: boolean };
  pvp: { open: boolean; tickets: number; cap: number };
  scout: { open: boolean; ready: number; running: number };
  /** Guild Boss fights left; null when not in a guild or the server didn't say. */
  guildFights: number | null;
  rush: { open: boolean; on: boolean; endsIn: string };
}

/** The card is for new players: it goes away for good once they've claimed this many daily logins (Samuel 2026-11-17). */
export const TODAY_LOGIN_DAYS = 7;

/** Whether the Today card shows: only while the player is new. */
export function todayShown(loginDays: number): boolean {
  return loginDays < TODAY_LOGIN_DAYS;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function todayRows(v: TodayView): TodayRow[] {
  const rows: TodayRow[] = [];
  rows.push({
    id: 'login',
    label: 'Daily login',
    status: v.login.ready ? `Day ${v.login.day + 1} ready` : 'Claimed',
    done: !v.login.ready,
    hot: v.login.ready,
  });
  rows.push({ id: 'spin', label: 'Free spin', status: v.spinReady ? 'Ready' : 'Used', done: !v.spinReady, hot: v.spinReady });
  const d = v.dailies;
  rows.push({
    id: 'daily',
    label: 'Daily challenges',
    status: `${d.claimed}/${d.total} claimed`,
    done: d.claimed >= d.total,
    hot: d.claimable > 0,
  });
  rows.push({
    id: 'bundle',
    label: 'Crest Bundle',
    status: v.bundle.claimed ? 'Claimed' : v.bundle.ready ? 'Ready' : 'After challenges',
    done: v.bundle.claimed,
    hot: v.bundle.ready && !v.bundle.claimed,
  });
  const t = v.trials;
  if (t.unlocked) {
    const which = t.allOpen ? 'All' : t.open.map(cap).join(', ');
    rows.push({
      id: 'trials',
      label: t.double ? 'Trials · x2 crests' : 'Trials',
      status: t.open.length ? `${which} · ${t.tickets}/${t.cap}` : 'None open today',
      done: !t.open.length || t.tickets <= 0,
      hot: t.open.length > 0 && t.tickets >= t.cap,
    });
  }
  if (v.pvp.open) {
    rows.push({
      id: 'arena',
      label: 'Colosseum',
      status: `${v.pvp.tickets}/${v.pvp.cap} fights`,
      done: v.pvp.tickets <= 0,
      hot: v.pvp.tickets >= v.pvp.cap,
    });
  }
  if (v.scout.open) {
    const s = v.scout;
    rows.push({
      id: 'scout',
      label: 'Scouting',
      status: s.ready ? `${s.ready} back` : s.running ? `${s.running} out` : 'Send heroes out',
      done: !s.ready && s.running > 0,
      hot: s.ready > 0,
    });
  }
  if (v.guildFights !== null) {
    rows.push({
      id: 'guild',
      label: 'Guild Boss',
      status: `${v.guildFights} fight${v.guildFights === 1 ? '' : 's'} left`,
      done: v.guildFights <= 0,
      hot: false,
    });
  }
  if (v.rush.open && v.rush.on) {
    rows.push({ id: 'rush', label: 'Rush', status: `Ends in ${v.rush.endsIn}`, done: false, hot: false });
  }
  return rows;
}

/** How many rows still have something to do. */
export function todayLeft(rows: TodayRow[]): number {
  return rows.filter((r) => !r.done).length;
}

/** One day of the events calendar (GameState.calendar). */
export interface CalendarDay {
  date: number;
  double: boolean;
  rush: boolean;
}

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** First and last day of each run of days where `pick` holds, e.g. "Thu–Sun" or "today". */
function spans(days: CalendarDay[], pick: (d: CalendarDay) => boolean): string[] {
  const out: string[] = [];
  for (let i = 0; i < days.length; i++) {
    if (!pick(days[i])) continue;
    let j = i;
    while (j + 1 < days.length && pick(days[j + 1])) j++;
    const a = i === 0 ? 'now' : DAY[new Date(days[i].date).getDay()];
    const b = DAY[new Date(days[j].date).getDay()];
    out.push(i === j ? (i === 0 ? 'today' : a) : i === 0 ? `now–${b}` : `${a}–${b}`);
    i = j;
  }
  return out;
}

/** The "This week" line: x2 Trial days, Rush days and the Hero Shop deal over the next 7 days (today first). */
export function weekLine(days: CalendarDay[], deal: { kind: 'crate' | 'voucher'; bought: boolean } | null): string {
  const week = days.slice(0, 7);
  const parts: string[] = [];
  const dbl = spans(week, (d) => d.double);
  if (dbl.length) parts.push(`x2 Trials ${dbl.join(', ')}`);
  const rush = spans(week, (d) => d.rush);
  if (rush.length) parts.push(`Rush ${rush.join(', ')}`);
  if (deal && !deal.bought) parts.push(deal.kind === 'crate' ? 'Ticket Crate deal' : 'Hero Voucher deal');
  return parts.join(' · ');
}
