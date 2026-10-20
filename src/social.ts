import type { SupabaseClient } from '@supabase/supabase-js';
import Decimal from 'break_infinity.js';
import { HEROES } from './data';
import { fmt } from './formulas';
import type { GameState } from './state';
import type { Account } from './account';
import { faceStyle } from './ui';
import { HERO_ANIMS } from './heroAnims';

// Profiles, friends and leaderboards. The game reports this player's profile
// (total Combat Power, best stage, Rekindles, team); everything else is read
// through the functions in supabase/social.sql, which check the rules.

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (text: string) => String(text).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
/** How often a signed-in game reports its profile (only when something changed, or every 10 minutes). */
const REPORT_SECONDS = 60;
const REPORT_ANYWAY_MS = 10 * 60_000;

type SView = 'me' | 'friends' | 'cp' | 'stage';
interface TeamEntry { id: string; level: number; stars: number; cp: string }
interface Profile { user_id: string; username: string; total_cp: string; best_stage: number; rekindles: number; team: TeamEntry[]; updated_at: string | null }
interface FriendRow { user_id: string; username: string; status: 'friend' | 'incoming' | 'outgoing'; total_cp: string; best_stage: number; updated_at: string | null }
interface BoardRow { rank: number; user_id: string; username: string; total_cp: string; best_stage: number; is_me: boolean; is_friend: boolean }

/** A server that hasn't had social.sql run yet. */
const missingServer = (message: string) => /does not exist|schema cache|PGRST20[0-9]|42883|42P01/i.test(message);

/** This player's profile as the game reports it. */
export function profilePayload(state: GameState) {
  const total = state.totalCombatPower();
  const team: TeamEntry[] = HEROES.filter((h) => (state.levels[h.id] ?? 0) > 0 && state.inLineup(h.id)).map((h) => ({
    id: h.id,
    level: state.heroLevel(h.id),
    stars: (state.stars[h.id] ?? 0) + 1,
    cp: state.heroCombatPower(h).toString(),
  }));
  return {
    p_total_cp: total.toString(),
    p_cp_log: total.gt(1) ? Math.max(0, total.log10()) : 0,
    p_best_stage: state.bestStage,
    p_rekindles: state.rekindles,
    p_team: team,
  };
}

export class Social {
  private view: SView = 'me';
  /** A friend whose profile is open, over the Friends or leaderboard list. */
  private viewing: string | null = null;
  private lastReport = '';
  private lastReportAt = 0;
  private serverMissing = false;
  private note = '';
  private noteErr = false;

  constructor(
    private state: GameState,
    private account: Account,
  ) {
    $('profile-btn').addEventListener('click', () => this.open());
    $('social-close').addEventListener('click', () => ($('social').hidden = true));
    $('social').addEventListener('click', (e) => {
      if (e.target === $('social')) $('social').hidden = true;
    });
    $('social-tabs').addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-sview]');
      if (!b) return;
      this.view = b.dataset.sview as SView;
      this.viewing = null;
      this.note = '';
      void this.render();
    });
    $('social-body').addEventListener('click', (e) => void this.onClick(e));
    $('social-body').addEventListener('submit', (e) => {
      e.preventDefault();
      void this.addFriend(e.target as HTMLFormElement);
    });
    account.listeners.push(() => void this.report());
    setInterval(() => void this.report(), REPORT_SECONDS * 1000);
  }

  private get db(): SupabaseClient | null {
    return this.account.userId ? this.account.client : null;
  }

  private open() {
    $('social').hidden = false;
    void this.report(true);
    void this.render();
  }

  /** Send this player's profile when it changed (or now and then anyway). */
  private async report(force = false) {
    const db = this.db;
    if (!db || this.serverMissing) return;
    const payload = profilePayload(this.state);
    const key = JSON.stringify(payload);
    if (!force && key === this.lastReport && Date.now() - this.lastReportAt < REPORT_ANYWAY_MS) return;
    const { error } = await db.rpc('save_profile', payload);
    if (error) {
      if (missingServer(error.message)) this.serverMissing = true;
      return;
    }
    this.lastReport = key;
    this.lastReportAt = Date.now();
  }

  private setBody(html: string) {
    for (const b of $('social-tabs').querySelectorAll<HTMLElement>('[data-sview]')) b.classList.toggle('on', b.dataset.sview === this.view);
    $('social-title').textContent = this.view === 'me' ? 'Profile' : this.view === 'friends' ? 'Friends' : 'Leaderboards';
    $('social-body').innerHTML = html;
  }

  private noteHtml() {
    return `<p class="sp-note${this.noteErr ? ' err' : ''}">${esc(this.note)}</p>`;
  }

  private async render() {
    const db = this.db;
    if (!db) {
      this.setBody(`<p>Sign in to get a profile, add friends and join the leaderboards.</p><button type="button" class="wood-btn small" data-signin>Sign in / Create account</button>`);
      return;
    }
    if (this.serverMissing) {
      this.setBody('<p>Profiles and leaderboards are not switched on yet: the server needs supabase/social.sql run once.</p>');
      return;
    }
    if (this.viewing) return this.renderProfile(this.viewing, true);
    if (this.view === 'me') return this.renderProfile(this.account.userId!, false);
    if (this.view === 'friends') return this.renderFriends();
    return this.renderBoard(this.view);
  }

  private fail(message: string) {
    if (missingServer(message)) {
      this.serverMissing = true;
      void this.render();
      return;
    }
    this.setBody(`<p class="sp-note err">${esc(message)}</p>`);
  }

  private async renderProfile(userId: string, other: boolean) {
    this.setBody('<p>Loading…</p>');
    const { data, error } = await this.db!.rpc('get_profile', { p_user: userId });
    if (error) return this.fail(error.message);
    const p = data as Profile;
    const slots = Array.from({ length: 5 }, (_, i) => {
      const t = p.team?.[i];
      const h = t && HEROES.find((x) => x.id === t.id);
      if (!t || !h) return '<div><span class="face"></span><small>Empty</small></div>';
      return `<div><span class="face art" style="${faceStyle(h)}">${HERO_ANIMS[h.id] ? '' : h.name[0]}</span><b>${esc(h.name)}</b><small>Lv ${Number(t.level).toLocaleString()} · ${'★'.repeat(Math.max(1, Number(t.stars) || 1))}</small><span class="cp">${fmt(new Decimal(t.cp || 0))}</span></div>`;
    }).join('');
    const updated = p.updated_at ? `Updated ${new Date(p.updated_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}.` : 'No profile reported yet.';
    this.setBody(`
      ${other ? '<button type="button" class="link" data-back>‹ Back</button>' : ''}
      <div class="sp-head"><b>${esc(p.username)}</b><small class="muted">${other ? 'Friend' : 'You'}</small></div>
      <div class="sp-stats"><div><span>Total Combat Power</span><b>${fmt(new Decimal(p.total_cp || 0))}</b></div><div><span>Best stage</span><b>${Number(p.best_stage).toLocaleString()}</b></div><div><span>Rekindles</span><b>${Number(p.rekindles).toLocaleString()}</b></div></div>
      <h3 class="sp-section">Team</h3><div class="sp-team">${slots}</div>
      <p>${updated} ${other ? '' : 'Your friends can see this profile; everyone signed in sees your name, Combat Power and best stage on the leaderboards.'}</p>
      ${other ? `<button type="button" class="wood-btn small danger" data-remove="${esc(p.user_id)}">Remove friend</button>` : ''}`);
  }

  private async renderFriends() {
    this.setBody('<p>Loading…</p>');
    const { data, error } = await this.db!.rpc('my_friends');
    if (error) return this.fail(error.message);
    const rows = (data ?? []) as FriendRow[];
    const incoming = rows.filter((r) => r.status === 'incoming');
    const outgoing = rows.filter((r) => r.status === 'outgoing');
    const friends = rows.filter((r) => r.status === 'friend');
    const line = (r: FriendRow) => `<small>CP ${fmt(new Decimal(r.total_cp || 0))} · stage ${Number(r.best_stage).toLocaleString()}</small>`;
    const section = (title: string, list: FriendRow[], row: (r: FriendRow) => string) => (list.length ? `<h3 class="sp-section">${title}</h3>${list.map(row).join('')}` : '');
    this.setBody(`
      <form class="sp-add"><input name="name" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="20" placeholder="Friend's username" required><button class="hot">Add friend</button></form>
      ${this.noteHtml()}
      ${section('Friend requests', incoming, (r) => `<div class="sp-row sp-friend"><div class="who"><b>${esc(r.username)}</b>${line(r)}</div><div class="acts"><button type="button" class="hot" data-accept="${r.user_id}">Accept</button><button type="button" data-decline="${r.user_id}">No</button></div></div>`)}
      ${section(`Friends (${friends.length})`, friends, (r) => `<div class="sp-row sp-friend"><div class="who"><b>${esc(r.username)}</b>${line(r)}</div><button type="button" class="link" data-view="${r.user_id}">Profile</button></div>`)}
      ${section('Waiting for an answer', outgoing, (r) => `<div class="sp-row sp-friend"><div class="who"><b>${esc(r.username)}</b><small>Request sent</small></div><button type="button" class="link" data-remove="${r.user_id}">Cancel</button></div>`)}
      ${rows.length ? '' : '<p>No friends yet. Add one by their username.</p>'}`);
  }

  private async renderBoard(kind: 'cp' | 'stage') {
    this.setBody('<p>Loading…</p>');
    const { data, error } = await this.db!.rpc('leaderboard', { p_kind: kind, p_limit: 50 });
    if (error) return this.fail(error.message);
    const rows = (data ?? []) as BoardRow[];
    const val = (r: BoardRow) => (kind === 'cp' ? fmt(new Decimal(r.total_cp || 0)) : `Stage ${Number(r.best_stage).toLocaleString()}`);
    const sub = (r: BoardRow) => (kind === 'cp' ? `Best stage ${Number(r.best_stage).toLocaleString()}` : `CP ${fmt(new Decimal(r.total_cp || 0))}`);
    const list = rows
      .map((r) => `<div class="sp-row${r.is_me ? ' me' : ''}"${r.is_friend ? ` data-view="${r.user_id}" role="button" tabindex="0"` : ''}><span class="rk">${Number(r.rank).toLocaleString()}</span><div class="who"><b>${esc(r.username)}${r.is_me ? ' (you)' : r.is_friend ? ' · friend' : ''}</b><small>${sub(r)}</small></div><span class="val">${val(r)}</span></div>`)
      .join('');
    this.setBody(`<p>${kind === 'cp' ? 'Highest total Combat Power' : 'Highest stage beaten'}, top 50. Tap a friend to see their profile.</p>${list || '<p>No one on the board yet.</p>'}`);
  }

  private async onClick(e: Event) {
    const t = e.target as HTMLElement;
    const db = this.db;
    if (t.closest('[data-signin]')) {
      $('social').hidden = true;
      this.account.signIn();
      return;
    }
    if (t.closest('[data-back]')) {
      this.viewing = null;
      return this.render();
    }
    const view = t.closest<HTMLElement>('[data-view]');
    if (view) {
      this.viewing = view.dataset.view!;
      return this.render();
    }
    if (!db) return;
    const accept = t.closest<HTMLElement>('[data-accept]');
    const decline = t.closest<HTMLElement>('[data-decline]');
    if (accept || decline) {
      const { error } = await db.rpc('answer_friend_request', { p_user: (accept ?? decline)!.dataset[accept ? 'accept' : 'decline'], p_accept: !!accept });
      this.note = error ? error.message : accept ? 'You are friends now.' : 'Request declined.';
      this.noteErr = !!error;
      return this.render();
    }
    const remove = t.closest<HTMLElement>('[data-remove]');
    if (remove) {
      if (this.viewing && !confirm('Remove this friend?')) return;
      const { error } = await db.rpc('remove_friend', { p_user: remove.dataset.remove });
      this.viewing = null;
      this.view = 'friends';
      this.note = error ? error.message : '';
      this.noteErr = !!error;
      return this.render();
    }
  }

  private async addFriend(form: HTMLFormElement) {
    const db = this.db;
    if (!db) return;
    const name = (new FormData(form).get('name') as string).trim();
    if (!name) return;
    const { data, error } = await db.rpc('send_friend_request', { p_username: name });
    this.note = error ? error.message : data === 'friends' ? `You and ${name} are friends now.` : `Friend request sent to ${name}.`;
    this.noteErr = !!error;
    if (error && missingServer(error.message)) this.serverMissing = true;
    await this.render();
  }
}
