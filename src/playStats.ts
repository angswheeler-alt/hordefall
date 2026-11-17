/**
 * Anonymous play stats (supabase/play-stats.sql): one small row per player per day, so the admin can see how far
 * players get, how long they play, which screens they open and whether they come back. No names or accounts: each
 * device makes up a random id. The rules are pure here; watchPlay wires them to the page.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { dayKey } from './rewards';

const STORE = 'hordefall-play-v1';
/** How often active time is counted, and how often a changed day is sent. */
const TICK_SECONDS = 15;
const SEND_EVERY_MS = 5 * 60_000;

export interface PlayLog {
  id: string;
  day: string;
  seconds: number;
  tabs: string[];
}

/** A new random device id: 24 lower-case letters and digits. */
export function newPlayerId(rand: () => number = Math.random): string {
  const abc = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 24; i++) id += abc[Math.floor(rand() * abc.length) % abc.length];
  return id;
}

/** The log for `today`: a new day starts again from zero, keeping the id. */
export function rollDay(log: PlayLog, today: string): PlayLog {
  return log.day === today ? log : { id: log.id, day: today, seconds: 0, tabs: [] };
}

/** Count active seconds (capped at a day). */
export function addSeconds(log: PlayLog, today: string, seconds: number): PlayLog {
  const l = rollDay(log, today);
  return { ...l, seconds: Math.min(86_400, l.seconds + Math.max(0, seconds)) };
}

/** Note a screen opened today (lower-case letters only, at most 20 kinds). */
export function addTab(log: PlayLog, today: string, tab: string): PlayLog {
  const l = rollDay(log, today);
  if (!/^[a-z]{1,20}$/.test(tab) || l.tabs.includes(tab) || l.tabs.length >= 20) return l;
  return { ...l, tabs: [...l.tabs, tab] };
}

/** Read a stored log, or start one with a new id. */
export function parseLog(raw: string | null, today: string, rand: () => number = Math.random): PlayLog {
  try {
    const d = raw ? JSON.parse(raw) : null;
    if (d && typeof d.id === 'string' && /^[a-z0-9]{16,40}$/.test(d.id)) {
      const tabs = Array.isArray(d.tabs) ? d.tabs.filter((t: unknown) => typeof t === 'string' && /^[a-z]{1,20}$/.test(t)).slice(0, 20) : [];
      return rollDay({ id: d.id, day: typeof d.day === 'string' ? d.day : today, seconds: Number(d.seconds) || 0, tabs }, today);
    }
  } catch {
    // A damaged log just starts again.
  }
  return { id: newPlayerId(rand), day: today, seconds: 0, tabs: [] };
}

export interface PlaySnapshot {
  bestStage: number;
  stage: number;
  rekindles: number;
  daysPlayed: number;
  signedIn: boolean;
}

/** Arguments for report_play. */
export function playPayload(log: PlayLog, s: PlaySnapshot) {
  return {
    p_player: log.id,
    p_day: log.day,
    p_best_stage: Math.floor(s.bestStage),
    p_stage: Math.floor(s.stage),
    p_rekindles: Math.floor(s.rekindles),
    p_minutes: Math.floor(log.seconds / 60),
    p_days_played: Math.floor(s.daysPlayed),
    p_signed_in: s.signedIn,
    p_tabs: log.tabs,
  };
}

/** Which screen a tap opened, for the tabs list: main tabs, Battle modes, Settings. */
export function tappedScreen(el: Element | null): string | null {
  const tab = el?.closest<HTMLElement>('#tabbar [data-tab]')?.dataset.tab;
  if (tab) return tab;
  const mode = el?.closest<HTMLElement>('[data-battle-go]')?.dataset.battleGo;
  if (mode && mode !== 'hub') return mode;
  if (el?.closest('#settings-btn')) return 'settings';
  if (el?.closest('#today [data-today]')) return 'today';
  return null;
}

/** Start counting this device's play and sending one row a day (every 5 minutes while it changes, and on leaving). */
export function watchPlay(client: () => SupabaseClient | null, snapshot: () => PlaySnapshot) {
  const read = () => {
    try {
      return localStorage.getItem(STORE);
    } catch {
      return null;
    }
  };
  let log = parseLog(read(), dayKey());
  const keep = () => {
    try {
      localStorage.setItem(STORE, JSON.stringify(log));
    } catch {
      // Private mode: still counts for this visit.
    }
  };
  keep();
  let sentKey = '';
  const send = () => {
    const db = client();
    if (!db) return;
    const payload = playPayload(log, snapshot());
    const key = JSON.stringify(payload);
    if (key === sentKey) return;
    sentKey = key;
    void db.rpc('report_play', payload).then(
      () => undefined,
      () => undefined,
    );
  };
  setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    log = addSeconds(log, dayKey(), TICK_SECONDS);
    keep();
  }, TICK_SECONDS * 1000);
  setInterval(send, SEND_EVERY_MS);
  setTimeout(send, 60_000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') send();
  });
  document.addEventListener(
    'click',
    (e) => {
      const screen = tappedScreen(e.target as Element | null);
      if (!screen) return;
      log = addTab(log, dayKey(), screen);
      keep();
    },
    true,
  );
}
