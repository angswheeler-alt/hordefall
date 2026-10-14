import type { SupabaseClient } from '@supabase/supabase-js';
import {
  HEROES, RELEASED_HEROES, GUILD_MAX_MEMBERS, GUILD_REQUEST_GOALS, GUILD_REQUEST_HOURS, GUILD_REQUEST_OPEN_HOURS, GUILD_DONATE_MAX, GUILD_CREDITS_PER_MEDAL, GUILD_SHOP,
  GUILD_BOSS_ATTEMPTS, GUILD_BOSS_NAMES, GUILD_BOSS_PAR_ATTEMPTS, ELEMENT_COLORS, elementMultiplier, GUILD_RESEARCH, GUILD_RESEARCH_MAX_RANK, guildResearchPerAttempt, GUILD_WILD_PER_WEEK, GUILD_WILD_COST, GUILD_EMBER_POUCHES_PER_DAY, GUILD_QUESTS, GUILD_QUEST_TRACK, GUILD_QUEST_PERSONAL_COINS,
  type HeroDef, type GuildShopId, type Element, type ResearchBranch,
} from './data';
import Decimal from 'break_infinity.js';
import { fmt, guildBossAttemptCoins, guildBossKillCoins, researchPointsFor, researchRank } from './formulas';
import type { GameState } from './state';
import type { Account } from './account';
import { faceStyle, dropCards, type UI } from './ui';
import { play } from './sfx';

// Guilds: browse, create and join; the daily Guild Boss; Guild Research; weekly Guild Quests; members and ranks;
// chat; medal requests and donations for Guild Coins; and a guild shop. The rules are enforced
// on the server (supabase/guilds.sql); this file only reads and asks.

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
/** How often an open Guild tab checks for new chat, requests and gifts. */
const POLL_SECONDS = 10;
const HOUR = 3_600_000;
/** How often quest counts are sent while in a guild, even with the tab closed. */
const QUEST_REPORT_SECONDS = 60;
/** Guild Coins the two Research buttons put in. */
const RESEARCH_GIFTS = [100, 1000];

type Role = 'leader' | 'officer' | 'member';
interface GuildRow { id: string; name: string; description: string; min_stage: number; created_at: string; research_focus?: ResearchBranch; guild_members?: Array<{ count: number }> }
interface MemberRow { user_id: string; guild_id: string; username: string; role: Role; best_stage: number; joined_at: string }
interface MessageRow { id: number; user_id: string; username: string; body: string; created_at: string }
interface BossRow { guild_id: string; day: string; level: number; element: Element; hp: number | string; damage: number | string; killed_at: string | null }
interface HitRow { user_id: string; username: string; damage: number | string; day: string }
interface QuestRow { kind: string; goal: number; progress: number; mine: number; personal: number }
interface QuestData { week: string; members: number; quests: QuestRow[]; claimed: string[] }
interface RequestRow { id: number; user_id: string; username: string; hero_id: string; goal: number; received: number; collected: number; created_at: string }

type View = 'boss' | 'research' | 'quests' | 'shop' | 'requests' | 'chat' | 'members' | 'shop';
const VIEWS: Array<[View, string]> = [['boss', 'Boss'], ['research', 'Research'], ['quests', 'Quests'], ['shop', 'Shop'], ['requests', 'Requests'], ['chat', 'Chat'], ['members', 'Members']];
const ROLE_ORDER: Record<Role, number> = { leader: 0, officer: 1, member: 2 };
const ROLE_NAME: Record<Role, string> = { leader: 'Leader', officer: 'Officer', member: 'Member' };

const hero = (id: string) => HEROES.find((h) => h.id === id);
const requestable = (h: HeroDef) => h.rarity !== 'legendary' && RELEASED_HEROES.includes(h.id);
const utcDay = () => new Date().toISOString().slice(0, 10);
const big = (v: number | string) => new Decimal(v);
const goalFor = (h: HeroDef) => GUILD_REQUEST_GOALS[h.rarity as keyof typeof GUILD_REQUEST_GOALS];
const ago = (iso: string) => {
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  return mins < 1 ? 'now' : mins < 60 ? `${mins}m` : mins < 1440 ? `${Math.floor(mins / 60)}h` : `${Math.floor(mins / 1440)}d`;
};
const untilText = (ms: number) => {
  const mins = Math.ceil(ms / 60000);
  if (mins >= 48 * 60) return `${Math.floor(mins / 1440)}d ${Math.floor((mins % 1440) / 60)}h`;
  return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
};

export class Guild {
  private mode: 'off' | 'browse' | 'home' | null = null;
  private view: View = 'boss';
  private boss: BossRow | null = null;
  /** Today's boss hits in this guild. */
  private hits: HitRow[] = [];
  /** Beaten bosses (by day) this player hit and hasn't claimed yet. */
  private claimable: BossRow[] = [];
  private fighting = false;
  private me: MemberRow | null = null;
  private guild: GuildRow | null = null;
  private members: MemberRow[] = [];
  private messages: MessageRow[] = [];
  private requests: RequestRow[] = [];
  private quests: QuestData | null = null;
  private reporting = false;
  /** Research points per branch. */
  private research: Partial<Record<ResearchBranch, number>> = {};
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
    setInterval(() => void this.reportQuests().catch(() => undefined), QUEST_REPORT_SECONDS * 1000);
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
      this.research = {};
      this.quests = null;
      // Counts made outside a guild don't carry into the next one.
      this.state.guildQuestPending = { kills: 0, stages: 0, trials: 0 };
      if (this.state.setGuildResearch({})) this.ui.render();
      const res = await db.from('guilds').select('*, guild_members(count)').order('created_at', { ascending: false }).limit(50);
      if (res.error) throw res.error;
      this.list = (res.data as GuildRow[]).sort((a, b) => count(b) - count(a));
      return;
    }
    const gid = this.me.guild_id;
    if (this.me.best_stage < this.state.bestStage) void db.rpc('touch_guild_member', { p_best_stage: this.state.bestStage });
    const since = new Date(Date.now() - GUILD_REQUEST_OPEN_HOURS * HOUR).toISOString();
    const [g, members, messages, requests, last, research] = await Promise.all([
      db.from('guilds').select('*').eq('id', gid).maybeSingle(),
      db.from('guild_members').select('*').eq('guild_id', gid),
      db.from('guild_messages').select('id, user_id, username, body, created_at').eq('guild_id', gid).order('id', { ascending: false }).limit(50),
      db.from('guild_requests').select('*').eq('guild_id', gid).gte('created_at', since).order('created_at', { ascending: false }),
      db.from('guild_requests').select('created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(1),
      db.from('guild_research').select('branch, points').eq('guild_id', gid),
    ]);
    for (const r of [g, members, messages, requests, last, research]) if (r.error) throw r.error;
    this.setResearch(research.data as Array<{ branch: ResearchBranch; points: number | string }>);
    this.guild = g.data as GuildRow;
    this.members = (members.data as MemberRow[]).sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || b.best_stage - a.best_stage);
    this.messages = (messages.data as MessageRow[]).reverse();
    this.requests = requests.data as RequestRow[];
    this.lastAsk = last.data?.length ? Date.parse((last.data[0] as { created_at: string }).created_at) : 0;
    await this.fetchBoss();
    await this.reportQuests();
    const quests = await db.rpc('guild_quests');
    if (quests.error) throw quests.error;
    this.quests = quests.data as QuestData;
    const ids = this.requests.map((r) => r.id);
    this.given.clear();
    if (ids.length) {
      const d = await db.from('guild_donations').select('request_id, amount').eq('donor_id', uid).in('request_id', ids);
      if (d.error) throw d.error;
      for (const row of d.data as Array<{ request_id: number; amount: number }>) this.given.set(row.request_id, (this.given.get(row.request_id) ?? 0) + row.amount);
    }
    await this.collect();
  }

  /** Keep the points and hand the ranks to the game, which applies the bonuses. */
  private setResearch(rows: Array<{ branch: ResearchBranch; points: number | string }>) {
    this.research = {};
    const ranks: Partial<Record<ResearchBranch, number>> = {};
    for (const r of rows) {
      this.research[r.branch] = Number(r.points);
      ranks[r.branch] = researchRank(Number(r.points));
    }
    if (this.state.setGuildResearch(ranks)) this.ui.render();
  }

  /** Send the game's quest counts since the last report. */
  private async reportQuests() {
    const p = this.state.guildQuestPending;
    if (this.reporting || !this.me || !this.db || !this.account.userId || p.kills + p.stages + p.trials === 0) return;
    this.reporting = true;
    try {
      const sent = { ...p };
      const res = await this.db.rpc('report_guild_quests', { p_kills: Math.min(sent.kills, 2e9), p_stages: Math.min(sent.stages, 2e9), p_trials: Math.min(sent.trials, 2e9) });
      if (res.error) throw res.error;
      // Counts made while the report was on its way stay for the next one.
      const now = this.state.guildQuestPending;
      now.kills = Math.max(0, now.kills - sent.kills);
      now.stages = Math.max(0, now.stages - sent.stages);
      now.trials = Math.max(0, now.trials - sent.trials);
    } finally {
      this.reporting = false;
    }
  }

  private async claimQuest(reward: string) {
    const res = await this.db!.rpc('claim_guild_quest', { p_reward: reward });
    if (res.error) {
      this.ui.showModal('Guild Quests', esc(this.message(res.error)), 'Okay');
      return;
    }
    if (res.data === true) {
      const got = this.state.payGuildQuest(reward);
      play('chest');
      this.ui.showModal('Quest reward', `<p>+${got.coins} Guild Coins${got.drops.length ? ' · a Hero Chest' : ''}</p>${got.drops.length ? dropCards(got.drops) : ''}`, 'Collect');
      this.ui.render();
    }
    await this.refresh();
  }

  private async contribute(branch: ResearchBranch, amount: number) {
    if (this.state.guildCredits < amount) return;
    const res = await this.db!.rpc('contribute_guild_research', { p_branch: branch, p_amount: amount });
    if (res.error) {
      this.ui.showModal('Guild Research', esc(this.message(res.error)), 'Okay');
      return;
    }
    const taken = Number(res.data) || 0;
    if (taken > 0) {
      this.state.spendGuildCoins(taken);
      play('coin');
    }
    await this.refresh();
  }

  private async fetchBoss() {
    const db = this.db!;
    const uid = this.account.userId!;
    const gid = this.me!.guild_id;
    const boss = await db.rpc('guild_boss_today');
    if (boss.error) throw boss.error;
    this.boss = boss.data as BossRow;
    const weekAgo = new Date(Date.now() - 7 * 24 * HOUR).toISOString().slice(0, 10);
    const [hits, mine, beaten, claims] = await Promise.all([
      db.from('guild_boss_hits').select('user_id, username, damage, day').eq('guild_id', gid).eq('day', this.boss.day),
      db.from('guild_boss_hits').select('day').eq('guild_id', gid).eq('user_id', uid).gte('day', weekAgo),
      db.from('guild_boss_days').select('*').eq('guild_id', gid).gte('day', weekAgo).not('killed_at', 'is', null),
      db.from('guild_boss_claims').select('day').eq('guild_id', gid).eq('user_id', uid).gte('day', weekAgo),
    ]);
    for (const r of [hits, mine, beaten, claims]) if (r.error) throw r.error;
    this.hits = hits.data as HitRow[];
    const hitDays = new Set((mine.data as Array<{ day: string }>).map((r) => r.day));
    const claimed = new Set((claims.data as Array<{ day: string }>).map((r) => r.day));
    this.claimable = (beaten.data as BossRow[]).filter((b) => hitDays.has(b.day) && !claimed.has(b.day));
  }

  private async fightBoss() {
    const boss = this.boss;
    if (!boss || this.fighting) return;
    this.fighting = true;
    this.render();
    try {
      const damage = this.state.guildBossDamage(boss.element);
      const res = await this.db!.rpc('hit_guild_boss', { p_damage: damage.toString() });
      if (res.error) {
        this.ui.showModal('Guild Boss', esc(this.message(res.error)), 'Okay');
        return;
      }
      const r = res.data as { attempt: number; level: number; hp: number | string; damage: number | string; killed: boolean };
      const hp = big(r.hp);
      const pay = this.state.payGuildBossAttempt(r.level, damage, hp);
      play(r.killed ? 'chest' : 'coin');
      const pct = hp.gt(0) ? damage.div(hp).times(100).toNumber() : 0;
      const share = pct > 100 ? 'more than its whole health' : `${pct >= 0.1 ? pct.toFixed(1) : '<0.1'}% of its health`;
      const focus = GUILD_RESEARCH.find((b) => b.id === this.guild?.research_focus);
      let html = `<p>Your team dealt <b>${fmt(damage)}</b> damage (${share}).</p><p>+${pay.coins} Guild Coins · +${fmt(pay.gold)} gold${focus ? ` · +${guildResearchPerAttempt(r.level)} ${focus.name} research` : ''}</p>`;
      if (r.killed) {
        html += '<p><b>Boss beaten!</b> Everyone who hit it today can claim the kill reward. A stronger boss comes tomorrow.</p>';
      }
      this.ui.showModal(`Attempt ${r.attempt}/${GUILD_BOSS_ATTEMPTS}`, html, 'Nice');
      this.ui.render();
    } finally {
      this.fighting = false;
      await this.refresh();
    }
  }

  private async claimBoss(day: string) {
    const res = await this.db!.rpc('claim_guild_boss', { p_day: day });
    if (res.error) {
      this.ui.showModal('Guild Boss', esc(this.message(res.error)), 'Okay');
      return;
    }
    if (res.data !== null && res.data !== undefined) {
      const got = this.state.payGuildBossKill(Number(res.data));
      play('chest');
      this.ui.showModal(
        'Boss reward',
        `<p>+${got.coins} Guild Coins · +${got.embers.toLocaleString()} Embers · a Hero Chest</p>${dropCards(got.drops)}`,
        'Collect',
      );
      this.ui.render();
    }
    await this.refresh();
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

  /** Wild Medals: pick any non-Legendary hero, then how many. */
  private pickWild() {
    const left = this.state.wildMedalsLeft();
    const faces = HEROES.filter(requestable)
      .map((h) => {
        const cost = this.state.wildMedalCost(h.id)!;
        const owned = (this.state.levels[h.id] ?? 0) > 0;
        return `<button type="button" class="g-pick" data-hero="${h.id}" ${this.state.guildCredits < cost ? 'disabled' : ''}><span class="face art" style="${faceStyle(h)}">${h.name[0]}</span><b>${esc(h.name)}</b><small>${owned ? '' : 'Locked · '}${cost} each</small></button>`;
      })
      .join('');
    this.ui.showModal(
      'Wild Medals',
      `<p>Pick the hero these medals go to. ${left} of ${GUILD_WILD_PER_WEEK} left this week. You have ${this.state.guildCredits.toLocaleString()} Guild Coins.</p><div class="g-picks">${faces}</div>`,
      'Cancel',
    );
    $('modal-body').querySelectorAll<HTMLButtonElement>('.g-pick').forEach((btn) =>
      btn.addEventListener('click', () => this.wildAmount(hero(btn.dataset.hero!)!)),
    );
  }

  private wildAmount(h: HeroDef) {
    const cost = this.state.wildMedalCost(h.id)!;
    const most = Math.min(this.state.wildMedalsLeft(), Math.floor(this.state.guildCredits / cost));
    const amounts = [...new Set([1, 5, most].filter((n) => n >= 1 && n <= most))].sort((a, b) => a - b);
    this.ui.showModal(
      `Medals for ${esc(h.name)}`,
      `<p>${cost} Guild Coins each.</p><div class="g-wild-amounts">${amounts.map((n) => `<button type="button" class="gem-btn" data-n="${n}">${n === most && n > 5 ? 'Max ' : ''}x${n}<small>${(n * cost).toLocaleString()} coins</small></button>`).join('')}</div>`,
      'Cancel',
    );
    $('modal-body').querySelectorAll<HTMLButtonElement>('[data-n]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const drops = this.state.buyWildMedals(h.id, Number(btn.dataset.n));
        if (!drops) return;
        play('chest');
        this.ui.showModal('Wild Medals', `${dropCards(drops)}Bought with Guild Coins.`, 'Collect');
        this.ui.render();
        this.render();
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
      `${alone ? 'You are the last member, so the guild will close.' : this.me!.role === 'leader' ? 'An officer (or the longest-serving member) becomes leader.' : 'You can join another guild right away.'} Your open medal request is dropped. Guild Coins stay with you.`,
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
    else if (kind === 'fight') void this.fightBoss();
    else if (kind === 'claim') void this.claimBoss(arg);
    else if (kind === 'quest') void this.claimQuest(arg);
    else if (kind === 'research') {
      const [branch, amount] = arg.split('/');
      void this.contribute(branch as ResearchBranch, Number(amount));
    } else if (kind === 'focus') void this.call('set_guild_research_focus', { p_branch: arg });
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
      if (got.drops.length) this.ui.showModal('Hero Chest', `${dropCards(got.drops)}Bought with Guild Coins.`, 'Collect');
      else if (got.embers) this.ui.showModal('Ember pouch', `<p>+${got.embers.toLocaleString()} Embers</p>`, 'Nice');
      this.ui.render();
      this.render();
    } else if (kind === 'offer') {
      const drops = this.state.buyGuildOffer(Number(arg));
      if (!drops) return;
      play('chest');
      this.ui.showModal('Guild shop', `${dropCards(drops)}Bought with Guild Coins.`, 'Collect');
      this.ui.render();
      this.render();
    } else if (kind === 'wild') this.pickWild();
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
      setHtml($('g-off'), `<h3>Guilds</h3><p class="soon-when">${esc(text)}</p><ul><li>Up to ${GUILD_MAX_MEMBERS} members with chat and officer ranks.</li><li>Ask guildmates for a hero's medals and give medals to earn Guild Coins.</li><li>Fight a daily Guild Boss together, take on weekly quests, research shared bonuses and spend Guild Coins in the guild shop.</li></ul>${button}`);
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
    $('g-name').innerHTML = `${esc(g.name)} <small>${this.members.length}/${GUILD_MAX_MEMBERS} · ${this.state.guildCredits.toLocaleString()} Guild Coins</small>`;
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
              ? `<div class="rw-card"><h3>Today's heroes <small id="g-credits"></small></h3><p id="g-offers-note"></p><div id="g-offers" class="g-offers"></div></div>
                 <div class="rw-card"><h3>Wild Medals <small id="g-wild-note"></small></h3><p>Medals for any hero you pick: Common ${GUILD_WILD_COST.common}, Rare ${GUILD_WILD_COST.rare}, Epic ${GUILD_WILD_COST.epic} coins each.</p><button type="button" class="gem-btn rw-wide" data-g="wild" id="g-wild">Pick a hero</button></div>
                 <div class="rw-card"><h3>Always in stock</h3><p>Earn Guild Coins from the Guild Boss and by giving medals: Common ${GUILD_CREDITS_PER_MEDAL.common}, Rare ${GUILD_CREDITS_PER_MEDAL.rare}, Epic ${GUILD_CREDITS_PER_MEDAL.epic} each.</p><ul id="g-shop" class="rw-list"></ul></div>`
              : this.view === 'quests'
                ? `<div class="rw-card"><h3>Guild rewards <small id="g-week"></small></h3><p>Every quest counts toward the guild's weekly track. Members who helped this week claim each step.</p><div class="rw-bar g-track-bar"><i id="g-track-fill"></i></div><div id="g-track" class="g-track"></div></div><div class="rw-card"><h3>This week's quests</h3><p>Goals grow with the guild. Do half a member's share of a quest for ${GUILD_QUEST_PERSONAL_COINS} Guild Coins of your own.</p><ul id="g-quests" class="rw-list"></ul></div>`
                : this.view === 'research'
                ? `<div class="rw-card"><h3>Guild Research <small id="g-research-coins"></small></h3><p>Bonuses for every member. Put Guild Coins into a branch (1 coin = 1 point), and every Guild Boss attempt adds 10 + the boss's level to the focus branch. Up to rank ${GUILD_RESEARCH_MAX_RANK}.</p><ul id="g-research" class="rw-list"></ul></div>`
                : this.view === 'boss'
                ? `<div class="rw-card g-boss" id="g-boss"></div><div id="g-claims"></div><div class="rw-card"><h3>Today's damage <small id="g-board-note"></small></h3><ul id="g-board" class="rw-list"></ul></div>`
                : `<div class="rw-card"><h3>Your request <small id="g-ask-note"></small></h3><div id="g-mine"></div></div><div class="rw-card"><h3>Guildmates' requests</h3><ul id="g-requests" class="rw-list"></ul></div>`;
      if (this.view === 'members' && this.me!.role !== 'member') {
        $('g-edit-box').innerHTML = `<div class="rw-card"><h3>Guild settings</h3><form id="g-edit" class="g-form"><input name="description" maxlength="140" placeholder="A line about your guild" value="${esc(g.description)}"><label>Minimum stage to join <input name="min" type="number" min="0" step="50" value="${g.min_stage}"></label><button type="submit" class="rw-wide">Save</button></form></div>`;
      }
    }
    if (this.view === 'chat') this.renderChat();
    else if (this.view === 'members') this.renderMembers();
    else if (this.view === 'shop') this.renderShop();
    else if (this.view === 'boss') this.renderBoss();
    else if (this.view === 'research') this.renderResearch();
    else if (this.view === 'quests') this.renderQuests();
    else this.renderRequests();
  }

  private renderBoss() {
    const boss = this.boss;
    if (!boss) {
      setHtml($('g-boss'), '<p>Loading the boss…</p>');
      return;
    }
    const uid = this.me!.user_id;
    const hp = big(boss.hp);
    const dealt = big(boss.damage);
    const left = Decimal.max(0, hp.minus(dealt));
    const used = this.hits.filter((h) => h.user_id === uid).length;
    const killed = !!boss.killed_at;
    const mine = this.state.guildBossDamage(boss.element);
    const team = this.state.trialTeam();
    const strong = team.filter((m) => elementMultiplier(m.def.element, boss.element) > 1).length;
    const weak = team.filter((m) => elementMultiplier(m.def.element, boss.element) < 1).length;
    const tip = strong ? `${strong} of your heroes hit it extra hard.` : weak ? `${weak} of your heroes are weak against it.` : 'No hero in your team has the element edge.';
    const now = new Date();
    const reset = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1) - now.getTime();
    const coins = guildBossAttemptCoins(boss.level, mine, hp, GUILD_BOSS_PAR_ATTEMPTS);
    const btn = killed
      ? '<button type="button" class="rw-wide" disabled>Beaten! A stronger boss comes tomorrow</button>'
      : `<button type="button" class="hot rw-wide" data-g="fight" ${used >= GUILD_BOSS_ATTEMPTS || this.fighting || !team.length ? 'disabled' : ''}>${this.fighting ? 'Fighting…' : used >= GUILD_BOSS_ATTEMPTS ? 'No attempts left today' : `Fight (${GUILD_BOSS_ATTEMPTS - used} left) · about ${fmt(mine)} damage`}</button>`;
    setHtml(
      $('g-boss'),
      `<div class="g-boss-top"><span class="g-boss-face" style="background:#${ELEMENT_COLORS[boss.element].toString(16).padStart(6, '0')}">${GUILD_BOSS_NAMES[boss.element][0]}</span>
        <div><b>${GUILD_BOSS_NAMES[boss.element]}</b><small>Level ${boss.level} · ${boss.element} · new boss in ${untilText(reset)}</small></div></div>
       <div class="g-boss-bar"><i style="width:${hp.gt(0) ? Math.max(0, Math.min(100, left.div(hp).times(100).toNumber())) : 0}%"></i><span>${killed ? 'Beaten' : `${fmt(left)} / ${fmt(hp)}`}</span></div>
       <p>Every member gets ${GUILD_BOSS_ATTEMPTS} attempts a day with their Trial team (Ember levels). Each attempt pays at least ${10 + boss.level} Guild Coins and more for bigger hits (about ${coins} for yours), plus gold. Beat it together for ${guildBossKillCoins(boss.level)} Guild Coins, a Hero Chest and Embers each. ${tip}</p>${btn}`,
    );
    setHtml(
      $('g-claims'),
      this.claimable
        .map((b) => `<div class="rw-card g-claim"><div class="rw-text"><span><b>Level ${b.level} boss beaten</b></span><small>${b.day === utcDay() ? 'today' : b.day} · ${guildBossKillCoins(b.level)} Guild Coins, a Hero Chest and Embers</small></div><button type="button" class="hot" data-g="claim:${b.day}">Claim</button></div>`)
        .join(''),
    );
    const totals = new Map<string, { name: string; dmg: Decimal; n: number }>();
    for (const h of this.hits) {
      const t = totals.get(h.user_id) ?? { name: h.username, dmg: new Decimal(0), n: 0 };
      t.dmg = t.dmg.plus(big(h.damage));
      t.n++;
      totals.set(h.user_id, t);
    }
    const rows = [...totals.entries()].sort((a, b) => b[1].dmg.cmp(a[1].dmg));
    $('g-board-note').textContent = `${rows.length}/${this.members.length} joined in`;
    setHtml(
      $('g-board'),
      rows.length
        ? rows
            .map(([id, t], i) => `<li class="${id === uid ? 'g-me' : ''}"><div class="rw-text"><span><b>${i + 1}. ${esc(t.name)}</b></span><small>${fmt(t.dmg)} damage · ${hp.gt(0) ? t.dmg.div(hp).times(100).toNumber().toFixed(1) : 0}% · ${t.n}/${GUILD_BOSS_ATTEMPTS} attempts</small></div></li>`)
            .join('')
        : '<li><div class="rw-text"><span>No one has fought today yet. Be the first!</span></div></li>',
    );
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
    const btn = mine ? '' : `<button type="button" class="gem-btn" data-g="give:${r.id}" ${canGive ? '' : 'disabled'}>Give 1<small>+${GUILD_CREDITS_PER_MEDAL[h.rarity as keyof typeof GUILD_CREDITS_PER_MEDAL]} coins</small></button>`;
    const body = `<span class="face art" style="${faceStyle(h)}">${h.name[0]}</span><div class="rw-text"><span><b>${esc(h.name)}</b></span><div class="rw-bar"><i style="width:${pct}%"></i></div><small>${meta}</small></div>${btn}`;
    return mine ? `<div class="g-req">${body}</div>` : `<li class="g-req">${body}</li>`;
  }

  private renderQuests() {
    const q = this.quests;
    if (!q) return;
    const claimed = new Set(q.claimed);
    const end = Date.parse(`${q.week}T00:00:00Z`) + 7 * 24 * HOUR;
    $('g-week').textContent = `resets in ${untilText(Math.max(0, end - Date.now()))}`;
    const pct = q.quests.reduce((sum, r) => sum + Math.min(1, Number(r.progress) / Number(r.goal)), 0) / q.quests.length;
    const helped = q.quests.some((r) => Number(r.mine) > 0);
    $('g-track-fill').style.width = `${Math.floor(pct * 100)}%`;
    setHtml(
      $('g-track'),
      GUILD_QUEST_TRACK.map((t, i) => {
        const key = `track${i + 1}`;
        const reached = pct >= (i + 1) / 4;
        const label = claimed.has(key) ? 'Claimed' : reached ? (helped ? 'Claim' : 'Help first') : `${(i + 1) * 25}%`;
        return `<button type="button" class="gem-btn g-step${claimed.has(key) ? ' done' : ''}" data-g="quest:${key}" ${reached && helped && !claimed.has(key) ? '' : 'disabled'}>${label}<small>${t.coins} coins${t.chest ? ' + chest' : ''}</small></button>`;
      }).join(''),
    );
    setHtml(
      $('g-quests'),
      q.quests
        .map((r) => {
          const def = GUILD_QUESTS.find((d) => d.kind === r.kind);
          if (!def) return '';
          const progress = Number(r.progress), goal = Number(r.goal), mine = Number(r.mine), personal = Number(r.personal);
          const done = claimed.has(r.kind);
          const ready = mine >= personal && !done;
          return `<li><div class="rw-text"><span><b>${def.name}</b> ${Math.min(progress, goal).toLocaleString()}/${goal.toLocaleString()}</span><div class="rw-bar"><i style="width:${Math.min(100, Math.floor((progress / goal) * 100))}%"></i></div><small>You: ${mine.toLocaleString()}/${personal.toLocaleString()} for your reward</small></div><button type="button" class="gem-btn" data-g="quest:${r.kind}" ${ready ? '' : 'disabled'}>${done ? 'Done' : `${GUILD_QUEST_PERSONAL_COINS} coins`}</button></li>`;
        })
        .join(''),
    );
  }

  private renderResearch() {
    $('g-research-coins').textContent = `${this.state.guildCredits.toLocaleString()} Guild Coins`;
    const lead = this.me!.role !== 'member';
    const focus = this.guild?.research_focus ?? 'combat';
    setHtml(
      $('g-research'),
      GUILD_RESEARCH.map((b) => {
        const points = this.research[b.id] ?? 0;
        const rank = researchRank(points);
        const max = rank >= GUILD_RESEARCH_MAX_RANK;
        const from = researchPointsFor(rank);
        const to = researchPointsFor(Math.min(GUILD_RESEARCH_MAX_RANK, rank + 1));
        const pct = max ? 100 : Math.floor(((points - from) / (to - from)) * 100);
        const now = Math.round(rank * b.perRank * 100);
        const next = max ? 'max rank' : `next +${Math.round((rank + 1) * b.perRank * 100)}% at ${(to - points).toLocaleString()} more`;
        const isFocus = b.id === focus;
        const tag = isFocus ? ' <em class="g-focus">Boss focus</em>' : '';
        const gifts = RESEARCH_GIFTS.map(
          (n) => `<button type="button" class="gem-btn" data-g="research:${b.id}/${n}" ${max || this.state.guildCredits < n ? 'disabled' : ''}>+${n.toLocaleString()}<small>coins</small></button>`,
        ).join('');
        const focusBtn = lead && !isFocus && !max ? `<button type="button" class="wood-btn g-focus-btn" data-g="focus:${b.id}">Make boss focus</button>` : '';
        return `<li class="g-research"><div class="rw-text"><span><b>${b.name}</b> rank ${rank}/${GUILD_RESEARCH_MAX_RANK}${tag}</span><small>+${now}% ${b.what} · ${next}</small><div class="rw-bar"><i style="width:${pct}%"></i></div>${focusBtn}</div><div class="g-research-btns">${gifts}</div></li>`;
      }).join('') + '<li><div class="rw-text"><span><b>Expedition</b></span><small>+5% expedition rewards per rank. Comes with Expeditions.</small></div></li>',
    );
  }

  private renderShop() {
    const now = Date.now();
    const shop = this.state.guildShopState(now);
    const coins = this.state.guildCredits;
    $('g-credits').textContent = `${coins.toLocaleString()} Guild Coins`;
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    $('g-offers-note').textContent = `A new set of heroes in ${untilText(midnight.getTime() - now)}. Each offer can be bought once.`;
    setHtml(
      $('g-offers'),
      shop.offers
        .map((o, i) => {
          const h = hero(o.heroId)!;
          return `<div class="g-offer${o.bought ? ' done' : ''}"><span class="face art" style="${faceStyle(h)}">${h.name[0]}</span><b>${esc(h.name)}</b><small>${o.crests} medals</small><button type="button" class="gem-btn" data-g="offer:${i}" ${o.bought || coins < o.cost ? 'disabled' : ''}>${o.bought ? 'Bought' : `${o.cost} coins`}</button></div>`;
        })
        .join(''),
    );
    const left = this.state.wildMedalsLeft(now);
    $('g-wild-note').textContent = `${left}/${GUILD_WILD_PER_WEEK} left this week`;
    ($('g-wild') as HTMLButtonElement).disabled = left <= 0 || coins < GUILD_WILD_COST.common;
    setHtml(
      $('g-shop'),
      GUILD_SHOP.map((i) => {
        let note = '';
        if (i.id === 'embers') note = ` · ${Math.max(0, GUILD_EMBER_POUCHES_PER_DAY - shop.pouches)} left today`;
        if ((i.id === 'banner' || i.id === 'horn') && this.state.boosts[i.id] > now) note = ` · running, ${untilText(this.state.boosts[i.id] - now)} left`;
        return `<li><div class="rw-text"><span><b>${i.name}</b></span><small>${i.text}${note}</small></div><button type="button" class="gem-btn" data-g="buy:${i.id}" ${this.state.guildItemReady(i.id, now) ? '' : 'disabled'}>${i.cost} coins</button></li>`;
      }).join(''),
    );
  }
}

function count(g: GuildRow) {
  return g.guild_members?.[0]?.count ?? 0;
}

function setHtml(el: HTMLElement, html: string) {
  if (el.innerHTML !== html) el.innerHTML = html;
}
