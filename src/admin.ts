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
