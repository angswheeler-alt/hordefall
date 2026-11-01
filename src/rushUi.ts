/**
 * Screens for Rush (Battle hub > Rush): the event page, the hero picker and the shop. Rules live in src/rush.ts and
 * GameState; the live fight itself runs through UI.fightRush (the Colosseum lane with one hero a side).
 */
import Decimal from 'break_infinity.js';
import { HEROES, type HeroDef } from './data';
import { fmt, fmtDuration } from './formulas';
import type { GameState, RushFight, RushPaid } from './state';
import {
  RUSH_BRACKETS,
  RUSH_CREST_LIMIT,
  RUSH_CREST_PACK,
  RUSH_DAILY_TICKETS,
  RUSH_FEATURED_BONUS,
  RUSH_FIGHT_TICKETS,
  RUSH_FOES,
  RUSH_FREE_HOURS,
  RUSH_FREE_MAX,
  RUSH_SHOP,
  RUSH_START_TICKETS,
  RUSH_STREAK_UP,
  RUSH_TIERS,
  RUSH_UNLOCK_LEVEL,
  rushLevelMult,
  rushWinPoints,
  type RushReward,
  type RushShopId,
} from './rush';
import { faceStyle, dropCards } from './ui';
import { dustChip, glyphDrops, unbinderChip } from './glyphUi';
import { matIcon } from './scoutUi';
import { play } from './sfx';
import { setHtml } from './taps';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (text: string) => String(text).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const hero = (id: string) => HEROES.find((h) => h.id === id)!;
const stars = (n: number) => `${n + 1}★`;
const fmtDay = (t: number) => new Date(t).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
export const coinChip = (n: number) => `<span class="mat-chip" title="Rush Coins"><i class="mat-ico rush-coin" aria-hidden="true"></i>${n.toLocaleString()}</span>`;

interface UiHooks {
  showModal(title: string, html: string, ok: string, action?: (() => void) | null, cancel?: boolean, cancelLabel?: string): void;
  render(): void;
  fightRush(bracket: number, foe: number, heroId: string): void;
  openGlyphBag(): void;
}

/** What a reward gives, as chips. */
export function rushRewardChips(r: RushReward): string {
  const out: string[] = [];
  if (r.glyph) out.push(`<span class="mat-chip"><i class="mat-ico glyph-chest" aria-hidden="true"></i>${r.glyph}</span>`);
  if (r.grand) out.push(`<span class="mat-chip"><i class="mat-ico glyph-grand" aria-hidden="true"></i>${r.grand}</span>`);
  if (r.dust) out.push(dustChip(r.dust));
  if (r.unbinder) out.push(unbinderChip(r.unbinder));
  if (r.gems) out.push(`<span class="mat-chip"><span class="gem"></span>${r.gems}</span>`);
  return out.join('');
}

export function rushPaidHtml(paid: RushPaid[]): string {
  return paid.map((p) => `<div class="sc-reward">${rushRewardChips(p.reward)}</div>${glyphDrops(p.glyphs)}`).join('');
}

/** The result of a Rush fight (live or Quick Battle). */
export function rushResultHtml(r: RushFight | null, quick = false): string {
  if (!r) return '';
  const head = `<p class="tf-result ${r.won ? 'win' : 'lose'}">${quick ? 'Quick Battle win!' : r.won ? 'Victory!' : 'Defeat.'} ${r.won ? `+${r.points} points${r.featured ? ' (featured hero)' : ''}` : 'No points'} · +${r.coins} Rush Coins</p>`;
  const lvl = r.levelUp ? `<p>${RUSH_STREAK_UP} wins in a row: <b>Rush level ${r.level}</b> (points x${rushLevelMult(r.level)}).</p>` : '';
  const tiers = r.tiers.length ? `<h4>Reward tier reached!</h4>${rushPaidHtml(r.tiers)}` : '';
  return head + lvl + tiers;
}

export class RushUI {
  private bracket = -1;

  constructor(private state: GameState, private ui: UiHooks) {
    $('rush').addEventListener('click', (e) => this.onClick(e));
  }

  /** The Rush card on the Battle hub. */
  renderHub(now = Date.now()) {
    const s = this.state;
    const open = s.rushOpen();
    const on = open && s.rushOn(now);
    if (on) s.rushSync(now);
    $('hub-rush-count').textContent = open ? s.rushCoins.toLocaleString() : '-';
    const w = s.rushWindow(now);
    $('hub-rush-note').textContent = !open ? `Opens at player level ${RUSH_UNLOCK_LEVEL}` : on ? `Ends in ${fmtDuration(Math.ceil((w.end - now) / 1000))} · Rush level ${s.rush.level}` : `Next Rush: ${fmtDay(w.start)}`;
  }

  private pickBracket(): number {
    const s = this.state;
    if (this.bracket >= 0) return this.bracket;
    for (let b = RUSH_BRACKETS.length - 1; b >= 0; b--) if (s.rushHeroes(b).length) return (this.bracket = b);
    return (this.bracket = 0);
  }

  /** The Rush page. */
  render(now = Date.now()) {
    const s = this.state;
    const host = $('rush');
    if (!s.rushOpen()) {
      setHtml(host, `<div class="trial-card"><p>A four-day event of one-on-one hero fights for Glyphs, Glyph Dust and Gems.</p><small>Opens at player level ${RUSH_UNLOCK_LEVEL}. You are level ${s.keeperLevel()}.</small></div>`);
      return;
    }
    const on = s.rushOn(now);
    if (on) s.rushSync(now);
    const r = s.rush;
    const w = s.rushWindow(now);
    const parts: string[] = [];
    if (on) {
      const nextTier = RUSH_TIERS[r.tiers];
      const streak = Array.from({ length: RUSH_STREAK_UP }, (_, i) => `<i class="${i < r.streak ? 'on' : ''}"></i>`).join('');
      parts.push(`<div class="rush-top">
        <div class="rush-stat"><small>Ends in</small><b data-rush-end="${w.end}"></b></div>
        <div class="rush-stat"><small>Points</small><b>${r.points.toLocaleString()}</b></div>
        <div class="rush-stat"><small>Rush level</small><b>${r.level} <span class="meta">x${rushLevelMult(r.level)}</span></b><span class="rush-streak" title="Wins in a row">${streak}</span></div>
        <div class="rush-stat"><small>Tickets</small><b><i class="ticket rush-ticket"></i>${r.tickets}</b></div>
      </div>
      <p class="meta">Free attacks: +1 per hero in <span data-rush-end="${s.rushNextFree(now)}"></span> (hold up to ${RUSH_FREE_MAX}). A fight without one costs ${RUSH_FIGHT_TICKETS} tickets.</p>`);
      const tierRows = RUSH_TIERS.map((t, i) => `<li class="${i < r.tiers ? 'done' : i === r.tiers ? 'next' : ''}"><b>${t.points.toLocaleString()}</b><span class="sc-reward">${rushRewardChips(t.reward)}</span></li>`).join('');
      parts.push(`<details class="rush-tiers"${r.tiers < RUSH_TIERS.length ? '' : ''}><summary>Reward tiers · ${nextTier ? `next at ${nextTier.points.toLocaleString()} points` : 'all reached!'}<div class="crest-bar"><div style="width:${nextTier ? Math.min(100, (r.points / nextTier.points) * 100) : 100}%"></div></div></summary><ul>${tierRows}</ul></details>`);
      const b = this.pickBracket();
      const tabs = RUSH_BRACKETS.map((x, i) => `<button type="button" class="chip${i === b ? ' on' : ''}" data-rb="${i}">${stars(x.min)}-${stars(x.max)}</button>`).join('');
      const foes = s.rushFoes(b, now);
      const heroes = s.rushHeroes(b);
      const cards = foes
        .map((f, i) => {
          const def = hero(f.hero);
          const pts = rushWinPoints(b, i, r.level, false);
          return `<div class="rush-foe ${RUSH_FOES[i].name.toLowerCase()}"><span class="face art" style="${faceStyle(def)}">${def.name[0]}</span><div><b>${esc(f.name)}</b><small>${esc(def.name)} ${stars(f.stars)} · CP ${fmt(new Decimal(f.cp))}</small><small>${RUSH_FOES[i].name} · win ${pts}+ points</small></div><button type="button" class="hot" data-rf="${i}">Fight</button></div>`;
        })
        .join('');
      parts.push(`<div class="rush-bracket"><div class="glyph-filter">${tabs}</div>${heroes.length ? cards : `<p class="meta">You have no ${stars(RUSH_BRACKETS[b].min)}-${stars(RUSH_BRACKETS[b].max)} heroes for this bracket.</p>`}</div>`);
      const feat = s
        .rushFeatured()
        .map((h) => `<span class="face art rush-feat" style="${faceStyle(h)}" title="${esc(h.name)}">${h.name[0]}</span>`)
        .join('');
      parts.push(`<h3>Featured heroes <small class="meta">+${Math.round(RUSH_FEATURED_BONUS * 100)}% points</small></h3><div class="rush-feats">${feat}</div>`);
    } else {
      parts.push(`<div class="trial-card"><p><b>Next Rush:</b> ${fmtDay(w.start)} to ${fmtDay(w.end - 1)}.</p><small>Rush runs Thursday to Sunday on the weekends without double Trial crests. Rush Coins and the shop stay open in between.</small></div>`);
    }
    parts.push(this.shopHtml(on));
    const html = parts.join('');
    // Rebuild only when something changes; the countdowns tick in place.
    if (host.dataset.html !== html) {
      host.dataset.html = html;
      host.innerHTML = html;
    }
    for (const el of host.querySelectorAll<HTMLElement>('[data-rush-end]')) {
      const text = fmtDuration(Math.max(0, Math.ceil((Number(el.dataset.rushEnd) - now) / 1000)));
      if (el.textContent !== text) el.textContent = text;
    }
  }

  private shopHtml(on: boolean): string {
    const s = this.state;
    const items = (Object.keys(RUSH_SHOP) as RushShopId[])
      .map((id) => {
        const d = RUSH_SHOP[id];
        const left = s.rushShopLeft(id);
        const ico = id === 'coreR' ? matIcon('coreR') : `<i class="mat-ico ${id === 'glyph' ? 'glyph-chest' : id === 'grand' ? 'glyph-grand' : id === 'dust' ? 'dust' : 'unbinder'}" aria-hidden="true"></i>`;
        return `<div class="rush-item">${ico}<div><b>${d.name}</b><small>${d.text} · ${left}/${d.limit} left</small></div><button type="button" class="wood-btn small" data-rs="${id}" ${left > 0 && s.rushCoins >= d.coins ? '' : 'disabled'}>${d.coins} <i class="mat-ico rush-coin"></i></button></div>`;
      })
      .join('');
    const crests = on
      ? s
          .rushFeatured()
          .map((h) => {
            const cost = s.rushCrestCost(h.id);
            if (cost === null) return '';
            const left = s.rushShopLeft(`crest:${h.id}`);
            return `<div class="rush-item"><span class="face art" style="${faceStyle(h)}">${h.name[0]}</span><div><b>${esc(h.name)} x${RUSH_CREST_PACK} crests</b><small>${left}/${RUSH_CREST_LIMIT} left</small></div><button type="button" class="wood-btn small" data-rc="${h.id}" ${left > 0 && s.rushCoins >= cost ? '' : 'disabled'}>${cost} <i class="mat-ico rush-coin"></i></button></div>`;
          })
          .join('')
      : '';
    return `<h3>Rush Shop ${coinChip(s.rushCoins)}</h3><div class="rush-shop">${items}${crests}</div><p class="meta">Limits reset each Rush. <button type="button" class="wood-btn small" data-rbag>Glyph bag</button></p>`;
  }

  private onClick(e: Event) {
    const el = e.target as HTMLElement;
    const btn = el.closest<HTMLButtonElement>('button');
    if (!btn || btn.disabled) return;
    const s = this.state;
    if (btn.dataset.rb !== undefined) {
      this.bracket = Number(btn.dataset.rb);
      return this.render();
    }
    if (btn.dataset.rf !== undefined) return this.openPicker(this.pickBracket(), Number(btn.dataset.rf));
    if (btn.dataset.rbag !== undefined) return this.ui.openGlyphBag();
    if (btn.dataset.rs) {
      const paid = s.buyRushItem(btn.dataset.rs as RushShopId);
      if (!paid) return;
      play('chest');
      const what = btn.dataset.rs === 'coreR' ? `<div class="sc-reward big"><span class="mat-chip">${matIcon('coreR')}1</span></div>` : rushPaidHtml([paid]);
      this.ui.showModal(RUSH_SHOP[btn.dataset.rs as RushShopId].name, what, 'Collect');
      this.ui.render();
      return;
    }
    if (btn.dataset.rc) {
      const drops = s.buyRushCrests(btn.dataset.rc);
      if (!drops) return;
      play('chest');
      this.ui.showModal('Rush Shop', dropCards(drops), 'Collect');
      this.ui.render();
    }
  }

  /** Pick the hero to send against an opponent. */
  private openPicker(bracket: number, foe: number) {
    const s = this.state;
    const f = s.rush.foes[bracket]?.[foe];
    if (!f) return;
    const featured = new Set(s.rushFeatured().map((h) => h.id));
    const tile = (h: HeroDef) => {
      const free = s.rushFree(h.id);
      const block = s.rushBlock(bracket, foe, h.id);
      return `<button type="button" class="g-pick rush-pick" data-rh="${h.id}" ${block ? 'disabled' : ''}><span class="face art" style="${faceStyle(h)}">${h.name[0]}</span><b>${esc(s.formDef(h).name)}</b><small>${stars(s.stars[h.id] ?? 0)} · CP ${fmt(s.heroCombatPower(h))}</small><small>${free > 0 ? `Free x${free}` : `${RUSH_FIGHT_TICKETS} tickets`}${featured.has(h.id) ? ' · <b class="rush-plus">+20%</b>' : ''}</small></button>`;
    };
    const opp = hero(f.hero);
    this.ui.showModal(
      `vs ${esc(f.name)}`,
      `<p>${esc(opp.name)} ${stars(f.stars)} · CP ${fmt(new Decimal(f.cp))}. Pick your hero.</p><div class="g-picks">${s.rushHeroes(bracket).map(tile).join('')}</div>`,
      'Cancel',
    );
    $('modal-body').onclick = (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-rh]');
      if (b && !b.disabled) this.confirm(bracket, foe, b.dataset.rh!);
    };
  }

  private confirm(bracket: number, foe: number, heroId: string) {
    const s = this.state;
    const f = s.rush.foes[bracket]?.[foe];
    if (!f) return;
    const h = hero(heroId);
    const fc = s.rushForecast(bracket, foe, heroId);
    const quick = s.canQuickRush(bracket, foe, heroId);
    const free = s.rushFree(heroId);
    const line = fc ? (fc.won ? `Forecast: a win, about ${Math.round(fc.left[0][0] * 100)}% HP left.` : 'Forecast: a loss. Luck, Ultimates and skills can still turn it.') : '';
    this.ui.showModal(
      `${esc(s.formDef(h).name)} vs ${esc(hero(f.hero).name)}`,
      `<p>${line}</p><p class="meta">Uses ${free > 0 ? 'a free attack' : `${RUSH_FIGHT_TICKETS} tickets`}. Leaving the fight counts as a loss.</p><div class="glyph-actions"><button type="button" class="hot" data-rgo="fight">Fight</button>${quick ? '<button type="button" class="wood-btn" data-rgo="quick">Quick Battle</button>' : ''}</div>`,
      'Cancel',
    );
    $('modal-body').onclick = (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-rgo]');
      if (!b) return;
      $('modal').hidden = true;
      if (b.dataset.rgo === 'quick') {
        const r = s.quickRush(bracket, foe, heroId);
        if (!r) return;
        play('unlock');
        this.ui.showModal('Rush', rushResultHtml(r, true), 'Okay');
        this.ui.render();
      } else this.ui.fightRush(bracket, foe, heroId);
    };
  }

  help() {
    this.ui.showModal(
      'Rush',
      `<p>A four-day event, Thursday to Sunday, on the weekends without double Trial crests. Your hero fights one other hero in the lane.</p>
       <p><b>Brackets:</b> heroes fight in a bracket by their yellow stars: 1-3★, 3-5★ or 5-7★. Higher brackets pay more points and coins. Each bracket offers an Easy, Even and Hard opponent; harder ones pay more.</p>
       <p><b>Attacks:</b> every hero starts with a free attack and gets another every ${RUSH_FREE_HOURS} hours (up to ${RUSH_FREE_MAX}). Without one, a fight costs ${RUSH_FIGHT_TICKETS} tickets. You get ${RUSH_START_TICKETS} tickets at the start and ${RUSH_DAILY_TICKETS} more each day.</p>
       <p><b>Rush level:</b> ${RUSH_STREAK_UP} wins in a row raise it, and each level adds x${0.25} to the points you earn for the rest of the event. A loss resets the streak, not the level.</p>
       <p><b>Featured heroes</b> earn ${Math.round(RUSH_FEATURED_BONUS * 100)}% more points, and their crests are in the Rush Shop.</p>
       <p><b>Rewards:</b> points pass reward tiers with Glyph Chests, Glyph Dust, Unbinders and Gems. Every fight pays Rush Coins for the Rush Shop.</p>`,
      'Got it',
    );
  }
}
