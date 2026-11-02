/**
 * Error reports: when the game hits an uncaught error or a failed promise on a player's
 * phone, send a short report to the server (supabase/errors.sql) so the admin hears about
 * bugs on admin.html. The same error is sent once per session, and at most a few per session.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

/** Most reports one session sends. */
export const MAX_REPORTS = 5;

export interface ErrorReport {
  fingerprint: string;
  message: string;
  stack: string;
}

/** Errors that aren't the game's fault (browser quirks, extensions, other sites' scripts). */
const NOISE = [/ResizeObserver loop/i, /^Script error\.?$/i, /chrome-extension:|moz-extension:|safari-extension:|webkit-masked-url:/i, /^Load failed$/i];

/** A short stable id for an error: the message plus the first line of its stack (numbers stripped). */
export function errorFingerprint(message: string, stack: string): string {
  const firstFrame = stack.split('\n').find((l) => /at |@/.test(l)) ?? '';
  // Strip numbers so the same bug with different values (and builds) lands on one row.
  const text = `${message}|${firstFrame}`.replace(/\d+/g, '#').replace(/[?&]v=[^:)]*/g, '');
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

/** Turn whatever was thrown into a report, or null for noise. */
export function toReport(error: unknown, fallbackMessage = ''): ErrorReport | null {
  const err = error instanceof Error ? error : null;
  const message = (err ? `${err.name}: ${err.message}` : typeof error === 'string' ? error : fallbackMessage || String(error ?? '')).trim();
  const stack = (err?.stack ?? '').slice(0, 2000);
  if (!message || NOISE.some((re) => re.test(message) || re.test(stack))) return null;
  return { fingerprint: errorFingerprint(message, stack), message: message.slice(0, 300), stack };
}

/** Decides which reports go out: each error once, and only MAX_REPORTS per session. */
export class ReportGate {
  private seen = new Set<string>();

  allow(report: ErrorReport): boolean {
    if (this.seen.has(report.fingerprint) || this.seen.size >= MAX_REPORTS) return false;
    this.seen.add(report.fingerprint);
    return true;
  }
}

/** Listen for errors and send them with the client `db()` gives (none yet: hold them until there is one). */
export function watchErrors(db: () => SupabaseClient | null, stage: () => number) {
  const gate = new ReportGate();
  const waiting: ErrorReport[] = [];
  let flush: ReturnType<typeof setInterval> | undefined;
  const client0 = () => {
    try {
      return db();
    } catch {
      return null;
    }
  };
  const send = (r: ErrorReport) => {
    const client = client0();
    if (!client) {
      // Errors from before the online client is ready go out once it is.
      if (waiting.length < MAX_REPORTS) waiting.push(r);
      flush ??= setInterval(() => {
        if (!client0()) return;
        clearInterval(flush);
        flush = undefined;
        waiting.splice(0).forEach(send);
      }, 5000);
      return;
    }
    void client
      .rpc('report_error', {
        p_fingerprint: r.fingerprint,
        p_message: r.message,
        p_stack: r.stack,
        p_place: `${location.host}${location.pathname}`,
        p_user_agent: navigator.userAgent,
        p_stage: stage(),
      })
      .then(
        () => undefined,
        () => undefined,
      );
  };
  const handle = (error: unknown, fallback?: string) => {
    try {
      const r = toReport(error, fallback);
      if (r && gate.allow(r)) send(r);
    } catch {
      // Reporting must never cause an error of its own.
    }
  };
  window.addEventListener('error', (e) => handle(e.error ?? e.message, e.message));
  window.addEventListener('unhandledrejection', (e) => handle(e.reason, 'Unhandled promise rejection'));
}
