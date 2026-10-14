import type { SupabaseClient } from '@supabase/supabase-js';
import {
  HEROES, GUILD_MAX_MEMBERS, GUILD_REQUEST_GOALS, GUILD_REQUEST_HOURS, GUILD_REQUEST_OPEN_HOURS, GUILD_DONATE_MAX, GUILD_CREDITS_PER_MEDAL, GUILD_SHOP,
  type HeroDef, type GuildShopId,
} from './data';
import type { GameState } from './state';
import type { Account } from './account';
import { faceStyle, dropCards, type UI } from './ui';
import { play } from './sfx';

// Guilds: browse, create and join; members and ranks; chat; medal requests
// and donations for guild credits; and a guild shop. The rules are enforced
// on the server (supabase/guilds.sql); this file only reads and asks.

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
/** How often an open Guild tab checks for new chat, requests and gifts. */
const POLL_SECONDS = 10;
const HOUR = 3_600_000;

type Role = 'leader' | 'officer' | 'member';
interface GuildRow { id: string; name: string; description: string; min_stage: number; created_at: string; guild_members?: Array<{ count: number }> }
interface MemberRow { user_id: string; guild_id: string; username: string; role: Role; best_stage: number; joined_at: string }
interface MessageRow { id: number; user_id: string; username: string; body: string; created_at: string }
interface RequestRow { id: number; user_id: string; username: string; hero_id: string; goal: number; received: number; collected: number; created_at: string }

type View = 'requests' | 'chat' | 'members' | 'shop';
const VIEWS: Array<[View, string]> = [['requests', 'Requests'], ['chat', 'Chat'], ['members', 'Members'], ['shop', 'Shop']];
const ROLE_ORDER: Record<Role, number> = { leader: 0, officer: 1, member: 2 };
const ROLE_NAME: Record<Role, string> = { leader: 'Leader', officer: 'Officer', member: 'Member' };

const hero = (id: string) => HEROES.find((h) => h.id === id);
const requestable = (h: HeroDef) => h.rarity !== 'legendary';
const goalFor = (h: HeroDef) => GUILD_REQUEST_GOALS[h.rarity as keyof typeof GUILD_REQUEST_GOALS];
const ago = (iso: string) => {
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  return mins < 1 ? 'now' : mins < 60 ? `${mins}m` : mins < 1440 ? `${Math.floor(mins / 60)}h` : `${Math.floor(mins / 1440)}d`;
};
const untilText = (ms: number) => {
  const mins = Math.ceil(ms / 60000);
  return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
};

export class Guild {
  private mode: 'off' | 'browse' | 'home' | null = null;
  private view: View = 'requests';
  private me: MemberRow | null = null;
  private guild: GuildRow | null = null;
  private members: MemberRow[] = [];
  private messages: MessageRow[] = [];
  private requests: RequestRow[] = [];
  /** Medals this player already gave, per request id. */
  private given = new Map<number, number>();
  /** When this player last asked for medals. */
  private lastAsk = 0;
  private list: GuildRow[] = [];
  private busy = false;
  private lastUser: string | null | undefined = undefined;
  private lastFetch = 0;
  private error = '';

  constructor(
    private state: GameState,
    private account: Account,
    private ui: UI,
  ) {
    account.listeners.push(() => {
      if (account.userId !== this.lastUser) {
        this.lastUser = account.userId;
        this.me = null;
        this.mode = null;
        void this.refresh();
      }
    });
    setInterval(() => {
      if (this.visible() && Date.now() - this.lastFetch > POLL_SECONDS * 1000) void this.refresh();
    }, 1000);
    // Opening the tab fetches right away.
    document.querySelector('#tabbar button[data-tab="guild"]')?.addEventListener('click', () => void this.refresh());
    $('guild-root').addEventListener('click', (e) => this.onClick(e));
    $('guild-root').addEventListener('submit', (e) => {
      e.preventDefault();
      const form = e.target as HTMLFormElement;
      if (form.id === 'g-create') void this.create(form);
      else if (form.id === 'g-chat') void this.chat(form);
      else if (form.id === 'g-edit') void this.edit(form);
    });
    this.render();
  }

  private get db(): SupabaseClient | null {
    return this.account.client;
  }

  private visible() {
    return !document.hidden && !$('guild-root').closest<HTMLElement>('.panel')!.hidden;
  }

  /** Guilds open to signed-in players after their first Rekindle. */
  private locked(): string | null {
    if (!this.db) return 'Guilds need online accounts, which are switched off in this build.';
    if (!this.account.userId) return 'Sign in to join a guild. Guilds are shared with other players, so they need an account.';
    if (this.state.rekindles < 1) return 'Guilds open after your first Rekindle.';
    return null;
  }

  // ---------- server ----------

  async refresh() {
    if (this.busy) return;
    if (this.locked()) {
      this.render();
      return;
    }
    this.busy = true;
    this.lastFetch = Date.now();
    try {
      await this.fetch();
      this.error = '';
    } catch (e) {
      this.error = this.message(e);
    } finally {
      this.busy = false;
    }
    this.render();
  }

  private async fetch() {
    const db = this.db!;
    const uid = this.account.userId!;
    const mine = await db.from('guild_members').select('*').eq('user_id', uid).maybeSingle();
    if (mine.error) throw mine.error;
    this.me = mine.data as MemberRow | null;
    if (!this.me) {
      const res = await db.from('guilds').select('*, guild_members(count)').order('created_at', { ascending: false }).limit(50);
      if (res.error) throw res.error;
      this.list = (res.data as GuildRow[]).sort((a, b) => count(b) - count(a));
      return;
    }
    const gid = this.me.guild_id;
    if (this.me.best_stage < this.state.bestStage) void db.rpc('touch_guild_member', { p_best_stage: this.state.bestStage });
    const since = new Date(Date.now() - GUILD_REQUEST_OPEN_HOURS * HOUR).toISOString();
    const [g, members, messages, requests, last] = await Promise.all([
      db.from('guilds').select('*').eq('id', gid).maybeSingle(),
      db.from('guild_members').select('*').eq('guild_id', gid),
      db.from('guild_messages').select('id, user_id, username, body, created_at').eq('guild_id', gid).order('id', { ascending: false }).limit(50),
      db.from('guild_requests').select('*').eq('guild_id', gid).gte('created_at', since).order('created_at', { ascending: false }),
      db.from('guild_requests').select('created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(1),
    ]);
    for (const r of [g, members, messages, requests, last]) if (r.error) throw r.error;
    this.guild = g.data as GuildRow;
    this.members = (members.data as MemberRow[]).sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || b.best_stage - a.best_stage);
    this.messages = (messages.data as MessageRow[]).reverse();
    this.requests = requests.data as RequestRow[];
    this.lastAsk = last.data?.length ? Date.parse((last.data[0] as { created_at: string }).created_at) : 0;
    const ids = this.requests.map((r) => r.id);
    this.given.clear();
    if (ids.length) {
      const d = await db.from('guild_donations').select('request_id, amount').eq('donor_id', uid).in('request_id', ids);
      if (d.error) throw d.error;
      for (const row of d.data as Array<{ request_id: number; amount: number }>) this.given.set(row.request_id, (this.given.get(row.request_id) ?? 0) + row.amount);
    }
    await this.collect();
  }

  /** Bring in medals guildmates gave since the last look. */
  private async collect() {
    // Includes requests older than the open window, which the list above leaves out.
    const res = await this.db!.rpc('collect_guild_medals');
    if (res.error) throw res.error;
    const gifts = (res.data as Array<{ hero_id: string; amount: number }>).map((r) => ({ heroId: r.hero_id, crests: r.amount }));
    if (!gifts.length) return;
    const drops = this.state.receiveGuildMedals(gifts);
    for (const r of this.requests) r.collected = r.received;
    play('chest');
    this.ui.showModal('Guild gift', `Your guildmates sent you medals.${dropCards(drops)}`, 'Collect');
    this.ui.render();
  }

  /** Run a server function, show its error, and refresh. */
  private async call(fn: string, args: Record<string, unknown> = {}): Promise<unknown> {
    const res = await this.db!.rpc(fn, args);
    if (res.error) {
      this.ui.showModal('Guild', esc(this.message(res.error)), 'Okay');
      return undefined;
    }
    await this.refresh();
    return res.data ?? true;
  }

  private message(e: unknown) {
    const text = (e as { message?: string })?.message ?? String(e);
    // Tables or functions missing: guilds.sql hasn't been run on this project yet.
    if (/does not exist|schema cache|PGRST20[0-9]|42P01|42883/i.test(text)) return 'Guilds aren\'t set up on the server yet (supabase/guilds.sql needs to be run once).';
    return text;
  }

  // ---------- actions ----------

  private async create(form: HTMLFormElement) {
    const data = new FormData(form);
    await this.call('create_guild', {
      p_name: String(data.get('name') ?? ''),
      p_description: String(data.get('description') ?? ''),
      p_min_stage: Number(data.get('min') ?? 0) || 0,
      p_best_stage: this.state.bestStage,
    });
  }

  private async chat(form: HTMLFormElement) {
    const input = form.querySelector<HTMLInputElement>('input')!;
    const body = input.value.trim();
    if (!body) return;
    input.value = '';
    const res = await this.db!.rpc('post_guild_message', { p_body: body });
    if (res.error) {
      input.value = body;
      this.ui.showModal('Guild', esc(this.message(res.error)), 'Okay');
      return;
    }
    await this.refresh();
  }

  private async edit(form: HTMLFormElement) {
    const data = new FormData(form);
    await this.call('update_guild', { p_description: String(data.get('description') ?? ''), p_min_stage: Number(data.get('min') ?? 0) || 0 });
  }

  private async donate(req: RequestRow) {
    const h = hero(req.hero_id);
    if (!h || (this.state.crests[h.id] ?? 0) < 1) return;
    const res = await this.db!.rpc('donate_guild_medals', { p_request: req.id, p_amount: 1 });
    if (res.error) {
      this.ui.showModal('Guild', esc(this.message(res.error)), 'Okay');
      return;
    }
    const took = Number(res.data) || 0;
    if (took > 0 && this.state.giveGuildMedals(h.id, took) !== null) {
      play('coin');
      req.received += took;
      this.given.set(req.id, (this.given.get(req.id) ?? 0) + took);
      this.ui.render();
    }
    this.render();
  }

  private pickHero() {
    const faces = HEROES.filter(requestable)
      .map((h) => {
        const owned = (this.state.levels[h.id] ?? 0) > 0;
        return `<button type="button" class="g-pick" data-hero="${h.id}"><span class="face art" style="${faceStyle(h)}">${h.name[0]}</span><b>${esc(h.name)}</b><small>${owned ? '' : 'Locked · '}asks ${goalFor(h)}</small></button>`;
      })
      .join('');
    this.ui.showModal(
      'Ask for medals',
      `<p>Guildmates can each give up to ${GUILD_DONATE_MAX}. Rarer heroes ask for fewer: Common ${GUILD_REQUEST_GOALS.common}, Rare ${GUILD_REQUEST_GOALS.rare}, Epic ${GUILD_REQUEST_GOALS.epic}. You can ask once every ${GUILD_REQUEST_HOURS} hours.</p><div class="g-picks">${faces}</div>`,
      'Cancel',
    );
    $('modal-body').querySelectorAll<HTMLButtonElement>('.g-pick').forEach((btn) =>
      btn.addEventListener('click', () => {
        const h = hero(btn.dataset.hero!)!;
        $('modal').hidden = true;
        void this.call('request_guild_medals', { p_hero: h.id, p_goal: goalFor(h) });
      }),
    );
  }

  private memberMenu(m: MemberRow) {
    const mine = this.me!.role;
    const options: Array<[string, string]> = [];
    if (mine === 'leader') {
      if (m.role === 'member') options.push(['officer', 'Make officer']);
      if (m.role === 'officer') options.push(['member', 'Make member']);
      options.push(['leader', 'Make leader (you become an officer)']);
    }
    if (mine === 'leader' || (mine === 'officer' && m.role === 'member')) options.push(['kick', 'Remove from guild']);
    if (!options.length) return;
    this.ui.showModal(
      esc(m.username),
      `<p>${ROLE_NAME[m.role]} · best stage ${m.best_stage.toLocaleString()}</p><div class="g-menu">${options.map(([id, label]) => `<button type="button" data-act="${id}" class="${id === 'kick' ? 'hot' : ''}">${label}</button>`).join('')}</div>`,
      'Cancel',
    );
    $('modal-body').querySelectorAll<HTMLButtonElement>('[data-act]').forEach((btn) =>
      btn.addEventListener('click', () => {
        $('modal').hidden = true;
        const act = btn.dataset.act!;
        if (act === 'kick') void this.call('kick_guild_member', { p_user: m.user_id });
        else void this.call('set_guild_role', { p_user: m.user_id, p_role: act });
      }),
    );
  }

  private leave() {
    const alone = this.members.length <= 1;
    this.ui.showModal(
      'Leave the guild?',
      `${alone ? 'You are the last member, so the guild will close.' : this.me!.role === 'leader' ? 'An officer (or the longest-serving member) becomes leader.' : 'You can join another guild right away.'} Your open medal request is dropped. Guild credits stay with you.`,
      'Leave',
      () => void this.call('leave_guild'),
      true,
      'Stay',
    );
  }

  private onClick(e: Event) {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-g]');
    if (!el || (el as HTMLButtonElement).disabled) return;
    const [kind, arg] = el.dataset.g!.split(':');
    if (kind === 'signin') this.account.signIn();
    else if (kind === 'retry') void this.refresh();
    else if (kind === 'join') void this.call('join_guild', { p_guild: arg, p_best_stage: this.state.bestStage });
    else if (kind === 'view') {
      this.view = arg as View;
      this.render();
    } else if (kind === 'ask') this.pickHero();
    else if (kind === 'give') {
      const req = this.requests.find((r) => r.id === Number(arg));
      if (req) void this.donate(req);
    } else if (kind === 'member') {
      const m = this.members.find((x) => x.user_id === arg);
      if (m) this.memberMenu(m);
    } else if (kind === 'leave') this.leave();
    else if (kind === 'buy') {
      const got = this.state.buyGuildItem(arg as GuildShopId);
      if (!got) return;
      play('chest');
      if (got.drops.length) this.ui.showModal('Hero Chest', `${dropCards(got.drops)}Bought with guild credits.`, 'Collect');
      this.ui.render();
      this.render();
    }
  }

  // ---------- drawing ----------

  render() {
    const root = $('guild-root');
    const locked = this.locked();
    const mode = locked || (!this.me && this.error && !this.list.length) ? 'off' : this.me ? 'home' : this.lastFetch ? 'browse' : 'off';
    if (mode !== this.mode) {
      this.mode = mode;
      root.innerHTML = mode === 'home' ? this.homeShell() : mode === 'browse' ? this.browseShell() : '<div class="soon-card" id="g-off"></div>';
    }
    if (mode === 'off') {
      const text = locked ?? (this.error ? this.error : 'Loading your guild…');
      const button = !this.account.userId && this.db ? '<button type="button" class="hot" data-g="signin">Sign in</button>' : this.error && !locked ? '<button type="button" data-g="retry">Try again</button>' : '';
      setHtml($('g-off'), `<h3>Guilds</h3><p class="soon-when">${esc(text)}</p><ul><li>Up to ${GUILD_MAX_MEMBERS} members with chat and officer ranks.</li><li>Ask guildmates for a hero's medals and give medals to earn guild credits.</li><li>Spend credits in the guild shop.</li></ul>${button}`);
    } else if (mode === 'browse') this.renderBrowse();
    else this.renderHome();
  }

  private browseShell() {
    return `<div class="rw-card"><h3>Start a guild</h3>
      <form id="g-create" class="g-form">
        <input name="name" maxlength="24" minlength="3" required placeholder="Guild name" autocomplete="off">
        <input name="description" maxlength="140" placeholder="A line about your guild (optional)" autocomplete="off">
        <label>Minimum stage to join <input name="min" type="number" min="0" step="50" value="0"></label>
        <button type="submit" class="hot rw-wide">Create guild</button>
      </form></div>
      <div class="rw-card"><h3>Join a guild <small id="g-list-note"></small></h3><ul id="g-list" class="rw-list"></ul></div>`;
  }

  private renderBrowse() {
    $('g-list-note').textContent = this.error ? this.error : `${this.list.length} guild${this.list.length === 1 ? '' : 's'}`;
    setHtml(
      $('g-list'),
      this.list.length
        ? this.list
            .map((g) => {
              const n = count(g);
              const full = n >= GUILD_MAX_MEMBERS;
              const low = this.state.bestStage < g.min_stage;
              return `<li><div class="rw-text"><span><b>${esc(g.name)}</b></span><small>${n}/${GUILD_MAX_MEMBERS} members${g.min_stage ? ` · stage ${g.min_stage.toLocaleString()}+` : ''}${g.description ? ` · ${esc(g.description)}` : ''}</small></div><button type="button" class="gem-btn" data-g="join:${g.id}" ${full || low ? 'disabled' : ''}>${full ? 'Full' : low ? 'Too early' : 'Join'}</button></li>`;
            })
            .join('')
        : '<li><div class="rw-text"><span>No guilds yet. Start the first one!</span></div></li>',
    );
  }

  private homeShell() {
    return `<div class="rw-card g-head"><h3 id="g-name"></h3><p id="g-desc"></p><div class="g-tabs">${VIEWS.map(([id, label]) => `<button type="button" data-g="view:${id}" data-view="${id}">${label}</button>`).join('')}</div></div>
      <div id="g-view"></div>`;
  }

  private renderHome() {
    const g = this.guild!;
    $('g-name').innerHTML = `${esc(g.name)} <small>${this.members.length}/${GUILD_MAX_MEMBERS} · ${this.state.guildCredits.toLocaleString()} credits</small>`;
    $('g-desc').textContent = g.description || (this.error ? '' : 'No description yet.');
    if (this.error) $('g-desc').textContent = this.error;
    for (const b of $('guild-root').querySelectorAll<HTMLButtonElement>('[data-view]')) b.classList.toggle('on', b.dataset.view === this.view);
    const view = $('g-view');
    if (view.dataset.view !== this.view) {
      view.dataset.view = this.view;
      view.innerHTML =
        this.view === 'chat'
          ? `<div class="rw-card"><ul id="g-chat-list" class="g-chat"></ul><form id="g-chat" class="g-chat-form"><input maxlength="200" placeholder="Say something" autocomplete="off"><button type="submit" class="hot">Send</button></form></div>`
          : this.view === 'members'
            ? `<div class="rw-card"><ul id="g-members" class="rw-list"></ul></div><div id="g-edit-box"></div><button type="button" class="wood-btn rw-wide" data-g="leave">Leave guild</button>`
            : this.view === 'shop'
              ? `<div class="rw-card"><h3>Guild shop <small id="g-credits"></small></h3><p>Earn credits by giving medals: Common ${GUILD_CREDITS_PER_MEDAL.common}, Rare ${GUILD_CREDITS_PER_MEDAL.rare}, Epic ${GUILD_CREDITS_PER_MEDAL.epic} each.</p><ul id="g-shop" class="rw-list"></ul></div>`
              : `<div class="rw-card"><h3>Your request <small id="g-ask-note"></small></h3><div id="g-mine"></div></div><div class="rw-card"><h3>Guildmates' requests</h3><ul id="g-requests" class="rw-list"></ul></div>`;
      if (this.view === 'members' && this.me!.role !== 'member') {
        $('g-edit-box').innerHTML = `<div class="rw-card"><h3>Guild settings</h3><form id="g-edit" class="g-form"><input name="description" maxlength="140" placeholder="A line about your guild" value="${esc(g.description)}"><label>Minimum stage to join <input name="min" type="number" min="0" step="50" value="${g.min_stage}"></label><button type="submit" class="rw-wide">Save</button></form></div>`;
      }
    }
    if (this.view === 'chat') this.renderChat();
    else if (this.view === 'members') this.renderMembers();
    else if (this.view === 'shop') this.renderShop();
    else this.renderRequests();
  }

  private renderChat() {
    const list = $('g-chat-list');
    const stick = list.scrollTop + list.clientHeight >= list.scrollHeight - 8;
    setHtml(
      list,
      this.messages.length
        ? this.messages.map((m) => `<li class="${m.user_id === this.me!.user_id ? 'me' : ''}"><b>${esc(m.username)}</b> <small>${ago(m.created_at)}</small><p>${esc(m.body)}</p></li>`).join('')
        : '<li class="g-empty">No messages yet. Say hello!</li>',
    );
    if (stick) list.scrollTop = list.scrollHeight;
  }

  private renderMembers() {
    setHtml(
      $('g-members'),
      this.members
        .map((m) => {
          const self = m.user_id === this.me!.user_id;
          const canManage = !self && (this.me!.role === 'leader' || (this.me!.role === 'officer' && m.role === 'member'));
          return `<li><div class="rw-text"><span><b>${esc(m.username)}</b>${self ? ' (you)' : ''}</span><small>${ROLE_NAME[m.role]} · best stage ${m.best_stage.toLocaleString()}</small></div>${canManage ? `<button type="button" data-g="member:${m.user_id}">Manage</button>` : ''}</li>`;
        })
        .join(''),
    );
  }

  private renderRequests() {
    const uid = this.me!.user_id;
    const now = Date.now();
    const next = this.lastAsk + GUILD_REQUEST_HOURS * HOUR;
    const mine = this.requests.find((r) => r.user_id === uid);
    $('g-ask-note').textContent = next > now ? `next in ${untilText(next - now)}` : 'ready';
    const ask = `<button type="button" class="hot rw-wide" data-g="ask" ${next > now ? 'disabled' : ''}>${next > now ? `Ask again in ${untilText(next - now)}` : 'Ask for medals'}</button>`;
    setHtml($('g-mine'), (mine ? this.requestRow(mine, true) : '<p>Ask your guildmates for a hero\'s medals.</p>') + ask);
    const others = this.requests.filter((r) => r.user_id !== uid);
    setHtml($('g-requests'), others.length ? others.map((r) => this.requestRow(r, false)).join('') : '<li><div class="rw-text"><span>No open requests right now.</span></div></li>');
  }

  private requestRow(r: RequestRow, mine: boolean) {
    const h = hero(r.hero_id);
    if (!h) return '';
    const pct = Math.min(100, (r.received / r.goal) * 100);
    const have = this.state.crests[h.id] ?? 0;
    const given = this.given.get(r.id) ?? 0;
    const full = r.received >= r.goal;
    const left = Date.parse(r.created_at) + GUILD_REQUEST_OPEN_HOURS * HOUR - Date.now();
    const meta = mine
      ? `${r.received}/${r.goal} given · ${full ? 'full' : left > 0 ? `open ${untilText(left)}` : 'closed'}`
      : `${esc(r.username)} · ${r.received}/${r.goal} · you have ${have} · gave ${given}/${GUILD_DONATE_MAX}`;
    const canGive = !mine && !full && left > 0 && have > 0 && given < GUILD_DONATE_MAX;
    const btn = mine ? '' : `<button type="button" class="gem-btn" data-g="give:${r.id}" ${canGive ? '' : 'disabled'}>Give 1<small>+${GUILD_CREDITS_PER_MEDAL[h.rarity as keyof typeof GUILD_CREDITS_PER_MEDAL]} credits</small></button>`;
    const body = `<span class="face art" style="${faceStyle(h)}">${h.name[0]}</span><div class="rw-text"><span><b>${esc(h.name)}</b></span><div class="rw-bar"><i style="width:${pct}%"></i></div><small>${meta}</small></div>${btn}`;
    return mine ? `<div class="g-req">${body}</div>` : `<li class="g-req">${body}</li>`;
  }

  private renderShop() {
    $('g-credits').textContent = `${this.state.guildCredits.toLocaleString()} credits`;
    setHtml(
      $('g-shop'),
      GUILD_SHOP.map(
        (i) =>
          `<li><div class="rw-text"><span><b>${i.name}</b></span><small>${i.text}</small></div><button type="button" class="gem-btn" data-g="buy:${i.id}" ${this.state.guildItemReady(i.id) ? '' : 'disabled'}>${i.cost} credits</button></li>`,
      ).join(''),
    );
  }
}

function count(g: GuildRow) {
  return g.guild_members?.[0]?.count ?? 0;
}

function setHtml(el: HTMLElement, html: string) {
  if (el.innerHTML !== html) el.innerHTML = html;
}
