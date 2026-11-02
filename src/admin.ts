import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, USERNAME_DOMAIN } from './config';

/**
 * Admin-only save recovery (admin.html). Search a player, look at their cloud
 * save and backups, and restore one. Every call goes through the admin_*
 * functions in supabase/save-backups.sql, which refuse anyone not in
 * save_admins, so this page holds no secrets.
 */

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const escape = (text: string) => text.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'none');
const num = (n: number | null) => (n === null || n === undefined ? '-' : n.toLocaleString());

interface Player { user_id: string; username: string; best_stage: number | null; updated_at: string | null }
interface Version { id: number; kind: 'current' | 'backup'; best_stage: number; stage: number; rekindles: number; saved_at: string; reason: string }

const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let player: Player | null = null;

function note(id: string, text: string, kind: 'err' | 'good' | 'muted' = 'muted') {
  const el = $(id);
  el.textContent = text;
  el.className = `note ${kind}`;
}

/** Show the tool if the signed-in player is an admin; otherwise the sign-in box. */
async function enter() {
  const { data } = await db.auth.getSession();
  if (!data.session) {
    $('login').hidden = false;
    $('tool').hidden = true;
    return;
  }
  const { data: admin, error } = await db.rpc('is_save_admin');
  if (error || !admin) {
    $('login').hidden = false;
    $('tool').hidden = true;
    note('login-note', error ? `Couldn't check admin access: ${error.message}` : 'This account is not an admin.', 'err');
    return;
  }
  $('login').hidden = true;
  $('tool').hidden = false;
  $<HTMLInputElement>('query').focus();
}

$('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  note('login-note', 'Signing in…');
  const username = $<HTMLInputElement>('name').value.trim().toLowerCase();
  const { error } = await db.auth.signInWithPassword({ email: `${username}@${USERNAME_DOMAIN}`, password: $<HTMLInputElement>('password').value });
  if (error) {
    note('login-note', /invalid login/i.test(error.message) ? 'Wrong username or password.' : error.message, 'err');
    return;
  }
  note('login-note', '');
  await enter();
});

$('signout').addEventListener('click', async () => {
  await db.auth.signOut();
  $('versions-box').hidden = true;
  await enter();
});

$('search-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  note('search-note', 'Searching…');
  const { data, error } = await db.rpc('admin_find_players', { p_query: $<HTMLInputElement>('query').value });
  if (error) {
    note('search-note', error.message, 'err');
    return;
  }
  const players = (data ?? []) as Player[];
  note('search-note', players.length ? `${players.length} player${players.length === 1 ? '' : 's'} (up to 25 shown). Pick one to see their saves.` : 'No players found.');
  const body = $('players').querySelector('tbody')!;
  body.innerHTML = players
    .map((p, i) => `<tr class="pick" data-i="${i}"><td>${escape(p.username)}</td><td>${num(p.best_stage)}</td><td>${when(p.updated_at)}</td></tr>`)
    .join('');
  $('players').hidden = !players.length;
  body.querySelectorAll<HTMLTableRowElement>('tr').forEach((row) =>
    row.addEventListener('click', () => {
      body.querySelectorAll('tr').forEach((r) => r.classList.toggle('sel', r === row));
      player = players[Number(row.dataset.i)];
      void showVersions();
    }),
  );
});

async function showVersions(message?: string) {
  if (!player) return;
  $('versions-box').hidden = false;
  $('save-data').hidden = true;
  $('versions-title').textContent = `${player.username}'s saves`;
  const { data, error } = await db.rpc('admin_save_versions', { p_user: player.user_id });
  if (error) {
    note('versions-note', error.message, 'err');
    return;
  }
  const versions = (data ?? []) as Version[];
  const body = $('versions').querySelector('tbody')!;
  body.innerHTML = versions
    .map(
      (v, i) => `<tr><td>${v.kind === 'current' ? '<b>Current save</b>' : `Backup${v.reason ? ` <span class="muted">(${escape(v.reason)})</span>` : ''}`}</td>
        <td>${num(v.best_stage)}</td><td>${num(v.stage)}</td><td>${num(v.rekindles)}</td><td>${when(v.saved_at)}</td>
        <td><button type="button" data-view="${i}">View</button>${v.kind === 'backup' ? ` <button type="button" class="hot" data-restore="${i}">Restore</button>` : ''}</td></tr>`,
    )
    .join('');
  if (message) note('versions-note', message, 'good');
  else note('versions-note', versions.length ? `${versions.length - (versions[0]?.kind === 'current' ? 1 : 0)} backups.` : 'No cloud save or backups for this player.');
  body.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((b) => b.addEventListener('click', () => void view(versions[Number(b.dataset.view)])));
  body.querySelectorAll<HTMLButtonElement>('[data-restore]').forEach((b) => b.addEventListener('click', () => void restore(versions[Number(b.dataset.restore)])));
}

async function view(v: Version) {
  const { data, error } = await db.rpc('admin_save_data', { p_user: player!.user_id, p_backup: v.id });
  if (error) {
    note('versions-note', error.message, 'err');
    return;
  }
  $('save-data').textContent = JSON.stringify(data, null, 2);
  $('save-data').hidden = false;
}

async function restore(v: Version) {
  const p = player!;
  const ok = confirm(`Restore ${p.username}'s backup from ${when(v.saved_at)} (best stage ${num(v.best_stage)}, ${num(v.rekindles)} Rekindles)?\n\nTheir current cloud save is kept as a backup first.`);
  if (!ok) return;
  const { error } = await db.rpc('admin_restore_save', { p_user: p.user_id, p_backup: v.id });
  if (error) {
    note('versions-note', error.message, 'err');
    return;
  }
  await showVersions(`Restored. ${p.username}'s game loads it the next time it opens (if that device has more progress, it asks which save to keep).`);
}

void enter();

interface Flag { username: string; kind: string; claimed: string; allowed: string; created_at: string }

/** Fair play notes (supabase/social.sql): numbers save_profile or save_colosseum_team cut down. */
$('flags-load').addEventListener('click', async () => {
  note('flags-note', 'Loading…');
  const { data, error } = await db.rpc('admin_fair_play_flags');
  if (error) {
    note('flags-note', /does not exist|Could not find/i.test(error.message) ? 'Run social.sql in Supabase first.' : error.message, 'err');
    return;
  }
  const flags = (data ?? []) as Flag[];
  note('flags-note', flags.length ? `${flags.length} note${flags.length === 1 ? '' : 's'} (up to 200).` : 'No notes. Nobody has sent numbers that look made up.');
  $('flags').querySelector('tbody')!.innerHTML = flags
    .map((f) => `<tr><td>${escape(f.username ?? '?')}</td><td>${escape(f.kind)}</td><td>${escape(f.claimed)}</td><td>${escape(f.allowed)}</td><td>${when(f.created_at)}</td></tr>`)
    .join('');
  $('flags').hidden = !flags.length;
});
interface ErrorRow { fingerprint: string; message: string; stack: string; place: string; user_agent: string; stage: number | null; count: number; first_seen: string; last_seen: string }

/** Error reports (supabase/errors.sql): crashes the game sent from players' phones. */
async function showErrors() {
  note('errors-note', 'Loading…');
  const { data, error } = await db.rpc('admin_error_reports');
  if (error) {
    note('errors-note', /does not exist|Could not find/i.test(error.message) ? 'Run errors.sql in Supabase first.' : error.message, 'err');
    return;
  }
  const rows = (data ?? []) as ErrorRow[];
  note('errors-note', rows.length ? `${rows.length} kind${rows.length === 1 ? '' : 's'} of error (up to 200).` : 'No errors reported.', rows.length ? 'muted' : 'good');
  const body = $('errors').querySelector('tbody')!;
  body.innerHTML = rows
    .map((r, i) => `<tr class="pick" data-i="${i}"><td>${escape(r.message)}</td><td>${num(r.count)}</td><td>${when(r.last_seen)}</td><td><button type="button" data-fixed="${i}">Fixed</button></td></tr>`)
    .join('');
  $('errors').hidden = !rows.length;
  $('error-detail').hidden = true;
  body.querySelectorAll<HTMLTableRowElement>('tr').forEach((row) =>
    row.addEventListener('click', async (e) => {
      const r = rows[Number(row.dataset.i)];
      if ((e.target as HTMLElement).closest('[data-fixed]')) {
        const { error: err } = await db.rpc('admin_clear_error', { p_fingerprint: r.fingerprint });
        if (err) return note('errors-note', err.message, 'err');
        return showErrors();
      }
      body.querySelectorAll('tr').forEach((x) => x.classList.toggle('sel', x === row));
      const detail = $('error-detail');
      detail.textContent = [r.message, '', `Times: ${r.count}   First: ${when(r.first_seen)}   Last: ${when(r.last_seen)}`, `Best stage: ${num(r.stage)}`, `Where: ${r.place}`, `Phone/browser: ${r.user_agent}`, '', r.stack || '(no stack)'].join('\n');
      detail.hidden = false;
    }),
  );
}
$('errors-load').addEventListener('click', () => void showErrors());

interface ReportRow { id: number; kind: 'chat' | 'guild' | 'name'; reported_name: string; reporter_name: string; message_id: number | null; body: string; reports: number; created_at: string }

const REPORT_KINDS = { chat: 'All chat', guild: 'Guild chat', name: 'Username' } as const;

/** Player reports (supabase/reports.sql): reported chat messages and names. */
async function showReports() {
  note('reports-note', 'Loading…');
  const { data, error } = await db.rpc('admin_player_reports');
  if (error) {
    note('reports-note', /does not exist|Could not find/i.test(error.message) ? 'Run reports.sql in Supabase first.' : error.message, 'err');
    return;
  }
  // One row per reported message or name (the newest report), with how many players reported it.
  const seen = new Set<string>();
  const rows = ((data ?? []) as ReportRow[]).filter((r) => {
    const key = `${r.kind}:${r.reported_name}:${r.message_id ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  note('reports-note', rows.length ? `${rows.length} open report${rows.length === 1 ? '' : 's'}.` : 'No open reports.', rows.length ? 'muted' : 'good');
  const body = $('reports').querySelector('tbody')!;
  body.innerHTML = rows
    .map(
      (r, i) =>
        `<tr><td>${escape(r.reported_name)}</td><td><b>${REPORT_KINDS[r.kind] ?? escape(r.kind)}</b>${r.body ? `<br>"${escape(r.body)}"` : ''}<br><small class="muted">first from ${escape(r.reporter_name ?? '?')}</small></td><td>${num(Number(r.reports))}</td><td>${when(r.created_at)}</td><td>${
          r.kind === 'name' ? '' : `<button type="button" data-close="${i}" data-del="1">Delete message</button> `
        }<button type="button" data-close="${i}">Done</button></td></tr>`,
    )
    .join('');
  $('reports').hidden = !rows.length;
  body.querySelectorAll<HTMLButtonElement>('[data-close]').forEach((b) =>
    b.addEventListener('click', async () => {
      const r = rows[Number(b.dataset.close)];
      const { error: err } = await db.rpc('admin_close_report', { p_id: r.id, p_delete_message: b.dataset.del === '1' });
      if (err) return note('reports-note', err.message, 'err');
      await showReports();
    }),
  );
}
$('reports-load').addEventListener('click', () => void showReports());
