import type { SupabaseClient } from '@supabase/supabase-js';
import type { Account } from './account';
import { busyWhile } from './taps';

// All chat: one room for every signed-in player (supabase/chat.sql). A card on the
// home panel shows the newest message and opens the chat. Players can mute
// someone on this device; admins can delete a message for everyone.

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (text: string) => String(text).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
/** How often the open chat checks for new messages. */
const OPEN_POLL_MS = 5_000;
/** How often the home card refreshes while the home panel shows. */
const CARD_POLL_MS = 60_000;
const SHOWN = 60;
const MUTE_KEY = 'hordefall-muted';

export interface ChatMessage { id: number; user_id: string; username: string; body: string; created_at: string }

const missingServer = (message: string) => /does not exist|schema cache|PGRST20[0-9]|42883|42P01/i.test(message);

export function ago(iso: string, now = Date.now()): string {
  const mins = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
  return mins < 1 ? 'now' : mins < 60 ? `${mins}m` : mins < 1440 ? `${Math.floor(mins / 60)}h` : `${Math.floor(mins / 1440)}d`;
}

/** Messages to show, oldest first, without muted players. */
export function visibleMessages(newestFirst: ChatMessage[], muted: ReadonlySet<string>): ChatMessage[] {
  return newestFirst.filter((m) => !muted.has(m.user_id)).reverse();
}

function readMuted(): Map<string, string> {
  try {
    const raw = JSON.parse(localStorage.getItem(MUTE_KEY) ?? '{}') as Record<string, string>;
    return new Map(Object.entries(raw));
  } catch {
    return new Map();
  }
}

export class WorldChat {
  private messages: ChatMessage[] = [];
  private muted = readMuted();
  private error = '';
  private picked: number | null = null;
  private lastFetch = 0;
  private busy = false;

  constructor(private account: Account) {
    this.build();
    account.listeners.push(() => void this.refresh(true));
    setInterval(() => {
      const open = !$('wchat').hidden;
      const wait = open ? OPEN_POLL_MS : CARD_POLL_MS;
      if (!document.hidden && (open || this.homeShowing()) && Date.now() - this.lastFetch >= wait) void this.refresh();
    }, 1000);
    void this.refresh(true);
  }

  private get db(): SupabaseClient | null {
    return this.account.client;
  }

  private homeShowing() {
    const panel = $('home').closest<HTMLElement>('.panel');
    return !!panel && !panel.hidden;
  }

  private build() {
    const card = document.createElement('button');
    card.id = 'home-chat';
    card.className = 'rw-card chat-home';
    card.innerHTML = '<span class="chat-home-icon" aria-hidden="true"></span><span class="chat-home-text"><b>All chat</b><small id="home-chat-last"></small></span>';
    const anchor = $('home-obs');
    anchor.parentElement!.insertBefore(card, anchor);
    card.addEventListener('click', () => this.open());

    const overlay = document.createElement('div');
    overlay.id = 'wchat';
    overlay.hidden = true;
    overlay.innerHTML = `<div class="rk-card wchat-card" role="dialog" aria-modal="true" aria-labelledby="wchat-title">
        <button id="wchat-close" class="rk-close" aria-label="Close">&#x2715;</button>
        <h2 id="wchat-title">All chat</h2>
        <p class="rk-note">Everyone who's signed in. Be kind. Tap a message to mute its player.</p>
        <ul id="wchat-list" class="g-chat wchat-list"></ul>
        <form id="wchat-form" class="g-chat-form"><input maxlength="200" placeholder="Say something" autocomplete="off" enterkeyhint="send"><button type="submit" class="hot">Send</button></form>
        <div id="wchat-muted" class="wchat-muted"></div>
      </div>`;
    document.body.appendChild(overlay);
    $('wchat-close').addEventListener('click', () => (overlay.hidden = true));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.hidden = true;
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-w]');
      if (!el) return;
      const [kind, arg] = el.dataset.w!.split(':');
      if (kind === 'pick') {
        this.picked = this.picked === Number(arg) ? null : Number(arg);
        this.render();
      } else if (kind === 'mute') {
        const m = this.messages.find((x) => x.user_id === arg);
        this.setMuted(arg, m?.username ?? 'player', true);
      } else if (kind === 'unmute') this.setMuted(arg, '', false);
      else if (kind === 'delete') void busyWhile(el, this.remove(Number(arg)));
      else if (kind === 'signin') {
        overlay.hidden = true;
        this.account.signIn();
      }
    });
    $('wchat-form').addEventListener('submit', (e) => {
      e.preventDefault();
      void this.send();
    });
  }

  private open() {
    $('wchat').hidden = false;
    this.picked = null;
    this.render(true);
    void this.refresh(true);
  }

  private setMuted(userId: string, name: string, on: boolean) {
    if (on) this.muted.set(userId, name);
    else this.muted.delete(userId);
    try {
      localStorage.setItem(MUTE_KEY, JSON.stringify(Object.fromEntries(this.muted)));
    } catch {
      // Storage can be off (private mode); the mute lasts until the page closes.
    }
    this.picked = null;
    this.render();
  }

  async refresh(force = false) {
    if (this.busy || (!force && Date.now() - this.lastFetch < 1000)) return;
    this.lastFetch = Date.now();
    if (!this.db || !this.account.userId) {
      this.messages = [];
      this.render();
      return;
    }
    this.busy = true;
    try {
      const res = await this.db.from('world_messages').select('id, user_id, username, body, created_at').order('id', { ascending: false }).limit(SHOWN);
      if (res.error) throw res.error;
      this.messages = res.data as ChatMessage[];
      this.error = '';
    } catch (e) {
      const text = (e as { message?: string })?.message ?? String(e);
      this.error = missingServer(text) ? 'All chat isn\'t set up on the server yet (supabase/chat.sql needs to be run once).' : 'Couldn\'t reach the chat. Trying again soon.';
    } finally {
      this.busy = false;
    }
    this.render();
  }

  private async send() {
    const input = $('wchat-form').querySelector<HTMLInputElement>('input')!;
    const body = input.value.trim();
    if (!body || !this.db || !this.account.userId) return;
    input.value = '';
    const res = await this.db.rpc('post_world_message', { p_body: body });
    if (res.error) {
      input.value = body;
      this.error = missingServer(res.error.message) ? 'All chat isn\'t set up on the server yet (supabase/chat.sql needs to be run once).' : res.error.message;
      this.render();
      return;
    }
    this.error = '';
    await this.refresh(true);
    const list = $('wchat-list');
    list.scrollTop = list.scrollHeight;
  }

  private async remove(id: number) {
    const res = await this.db!.rpc('delete_world_message', { p_id: id });
    if (res.error) this.error = res.error.message;
    this.picked = null;
    await this.refresh(true);
  }

  private render(toBottom = false) {
    const signedIn = !!this.db && !!this.account.userId;
    const shown = visibleMessages(this.messages, new Set(this.muted.keys()));
    const last = shown[shown.length - 1];
    $('home-chat-last').textContent = !this.db
      ? 'Needs online accounts.'
      : !signedIn
        ? 'Sign in to chat with other players.'
        : last
          ? `${last.username}: ${last.body}`
          : this.error || 'Say hello to everyone!';
    if ($('wchat').hidden) return;
    const list = $('wchat-list');
    const stick = toBottom || list.scrollTop + list.clientHeight >= list.scrollHeight - 8;
    const me = this.account.userId;
    const admin = this.account.isAdmin;
    list.innerHTML = !signedIn
      ? `<li class="g-empty">Sign in to read and write in all chat.</li><li class="g-empty"><button type="button" class="hot" data-w="signin">Sign in</button></li>`
      : (this.error ? `<li class="g-empty">${esc(this.error)}</li>` : '') +
        (shown.length
          ? shown
              .map((m) => {
                const mine = m.user_id === me;
                const actions =
                  this.picked === m.id
                    ? `<div class="wchat-acts">${mine ? '' : `<button type="button" data-w="mute:${m.user_id}">Mute ${esc(m.username)}</button>`}${admin ? `<button type="button" class="hot" data-w="delete:${m.id}">Delete</button>` : ''}</div>`
                    : '';
                return `<li class="${mine ? 'me' : ''}" data-w="pick:${m.id}"><b>${esc(m.username)}</b> <small>${ago(m.created_at)}</small><p>${esc(m.body)}</p>${actions}</li>`;
              })
              .join('')
          : this.error
            ? ''
            : '<li class="g-empty">No messages yet. Say hello!</li>');
    if (stick) list.scrollTop = list.scrollHeight;
    $('wchat-form').hidden = !signedIn;
    $('wchat-muted').innerHTML = this.muted.size
      ? `Muted: ${[...this.muted].map(([id, name]) => `<button type="button" data-w="unmute:${id}">${esc(name || 'player')} ✕</button>`).join(' ')}`
      : '';
  }
}
