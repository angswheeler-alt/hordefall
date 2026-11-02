import { describe, it, expect } from 'vitest';
import sql from '../supabase/errors.sql?raw';
import { errorFingerprint, toReport, ReportGate, MAX_REPORTS } from '../src/errorReport';

describe('error reports', () => {
  it('gives the same error the same fingerprint, whatever the numbers in it', () => {
    const a = toReport(new TypeError("Cannot read properties of undefined (reading 'hp') at 12"))!;
    const b = toReport(new TypeError("Cannot read properties of undefined (reading 'hp') at 98"))!;
    expect(a.fingerprint).toBe(b.fingerprint);
    expect(a.fingerprint).toMatch(/^[a-z0-9]{1,16}$/);
    expect(errorFingerprint('x', '')).not.toBe(errorFingerprint('y', ''));
  });

  it('skips browser noise', () => {
    expect(toReport('ResizeObserver loop completed with undelivered notifications.')).toBeNull();
    expect(toReport(undefined, 'Script error.')).toBeNull();
    expect(toReport('')).toBeNull();
    expect(toReport('Boom')?.message).toBe('Boom');
  });

  it('sends each error once and only a few per session', () => {
    const gate = new ReportGate();
    const r = toReport(new Error('one'))!;
    expect(gate.allow(r)).toBe(true);
    expect(gate.allow(r)).toBe(false);
    let sent = 1;
    for (let i = 0; i < 20; i++) if (gate.allow(toReport(new Error(`other ${String.fromCharCode(97 + i)}`))!)) sent++;
    expect(sent).toBe(MAX_REPORTS);
  });

  it('lets anyone send but only admins read or clear', () => {
    expect(sql).toMatch(/grant execute on function public\.report_error\([^)]*\) to anon, authenticated/);
    expect(sql).toMatch(/revoke all on function public\.admin_error_reports\(\), public\.admin_clear_error\(text\) from public, anon/);
    expect(sql).toMatch(/alter table public\.error_reports enable row level security/);
    for (const fn of ['admin_error_reports', 'admin_clear_error']) expect(sql).toMatch(new RegExp(`function public\\.${fn}[\\s\\S]*?save_admins`));
  });
});
