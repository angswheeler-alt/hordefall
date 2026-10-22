import { DEV_TOOLS } from './config';
import Decimal from 'break_infinity.js';
import { type HeroStats, type BigStat, type StatPair } from './stats';
import { heroProfile, heroBuildEffects, buildBonus } from './profiles';
import { HEROES, byRarity, OFFLINE_CAP_HOURS, AWAKEN_STARMOTES, AWAKEN_STAT_MULT, PLAYABLE_HEROES, RELEASED_HEROES, HERO_TYPES, ELEMENT_COLORS, ULT_UNLOCK_LEVEL, SPEED_UNLOCK_STAGE, REKINDLE_STAGE, HEAD_START_MIN_PUSH, BOSS_EVERY, REKINDLE_BOOSTS, ROAD_START, ROAD_STEP, ROAD_LENGTH, KEEPER_BONUS_PER_LEVEL, LEVEL_GIFT_STONES, STAR_CRESTS, CHEST_COST, CHEST_DROPS, CREST_ROLLS, CHEST_RARITY_WEIGHTS, ULT_STAR_BONUS, AURA_EVOLUTIONS, ULT_PLUS_EVOLUTIONS, SIG_PLUS_EVOLUTIONS, MASTERY_EVOLUTIONS, ASCENDED_EVOLUTIONS, ASCENDED_ULT_COOLDOWN, TYPE_MASTERY, LEGENDARY_MEDAL_RATE, LEGENDARY_UNLOCK_MEDALS, ULT_MULTIPLIER, ULT_COOLDOWN, TEAM_SLOTS_MAX, HOURGLASS_GEMS, HOURGLASS_MINUTES, HOURGLASS_PER_DAY, GOLD_BOOST_GEMS, GOLD_BOOST_MINUTES, GOLD_BOOST_MAX_MINUTES, GOLD_BOOST_MULT, MEDAL_PACK, HERO_SHOP_REFRESH_GEMS, FEATURED_BUNDLE, FEATURED_BIG_BUNDLE, TICKET_GEMS, TICKETS_PER_DAY, BOUGHT_TICKET_CAP, TICKET_CRATE, HERO_VOUCHER, TRIAL_EVENT_MEDAL_MULT, RELICS, RELIC_SETS, RELIC_BASE_MAX, RELIC_MAX_STARS, RELIC_SHOP_REFRESH_MINUTES, TRIAL_ROTATION, DAY_NAMES, TRIAL_TIERS, TRIAL_LEVELS, TRIAL_TIME, TRIAL_QUICK_TIME, TRIAL_BOSS_NAMES, TRIAL_BOSS_ART, TRIAL_RARITY_WEIGHTS, ESSENCE_NAMES, TICKET_CAP, STALLS, STALL_AUTO_LEVEL, STALL_MILESTONE, STALL_REKINDLE_REVENUE, STALL_REKINDLE_LEVELS, STALL_REKINDLE_LEVELS_CAP, type HeroDef, type StallDef, type Element, type RelicDef } from './data';
import { play } from './sfx';
import { elementWheelSvg, ELEMENT_WHEEL_NOTE } from './elementWheel';
import { HERO_ANIMS } from './heroAnims';
import { setMuted, setVolumes } from './sfx';
import { BOSS_ANIMS, BOSS_ANIM_FRAMES } from './bossAnims';
import { bulkCost, upgradeCost, stallUpgradeCost, stallBulkCost, trialHp, isBossStage, emberCost, emberRefund, emberBulk, emberStageBonus, keeperThreshold, fmt, fmtDuration } from './formulas';
import type { GameState, OfflineReport, SummonDrop, RekindleResult, TrialResult, PvpOpponent } from './state';
import { DAILIES, DAILY_GEMS, LOGIN_CYCLE, SPIN_SLICES, BOOTCAMP, MILESTONE_STEP, milestoneReward, milestoneText, rewardText, type Reward } from './rewards';
import { rarityOdds, SHOP_HEROES, medalPackCost } from './state';
import { FORM_RARITIES, MAX_FORM } from './ascendant';
import { ascendantDef } from './heroes/ascendant';
import type { BattleScene } from './BattleScene';
import type { ColosseumLink } from './colosseumLink';
import { PVP_TICKET_CAP, PVP_TICKET_GEMS, PVP_WIN_TROPHIES, PVP_WIN_MOTES, PVP_LOSS_TROPHIES, PVP_LOSS_MOTES, RANK_DAILY, RANK_WEEKLY, RANK_TROPHIES, LEGEND, rankIndex, rankName, droppedTrophies } from './colosseum';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
/** Set innerHTML only when it changed, so 5x-a-second renders don't rebuild nodes under the player's finger. */
const setHtml = (el: HTMLElement, html: string) => {
  if (el.dataset.html === html) return;
  el.dataset.html = html;
  el.innerHTML = html;
};
const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
const escHtml = (text: string) => String(text).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
/** Inline style for a hero face: their sprite's head and shoulders over their element colour. */
/**
 * Hero portrait URL, made absolute: a relative url() inside a CSS variable resolves against the
 * stylesheet that uses it (assets/ in a build), not the page, so portraits went missing there.
 */
const heroArt = (id: string) => (HERO_ANIMS[id] ? `url('${new URL(`heroes/${id}.png`, document.baseURI).href}')` : 'none');
// Stall and relic icons (art/icons/make_icons.py), bundled so the single-file build carries them too.
const iconUrls = (files: Record<string, string>) => Object.fromEntries(Object.entries(files).map(([f, url]) => [f.split('/').pop()!.slice(0, -4), url]));
const STALL_ICONS = iconUrls(import.meta.glob('./assets/stalls/*.png', { eager: true, query: '?url', import: 'default' }));
const RELIC_ICONS = iconUrls(import.meta.glob('./assets/relics/*.png', { eager: true, query: '?url', import: 'default' }));
// Heroes still waiting for art show their initial on the element color instead of a picture.
export const faceStyle = (def: HeroDef) =>
  `background-color:${hex(ELEMENT_COLORS[def.element])};--art:${heroArt(def.id)}${HERO_ANIMS[def.id] ? '' : ';color:#fff !important;text-shadow:0 1px 0 #000 !important'}`;
const SWORD = '<i class="ico ico-atk" aria-hidden="true"></i>';
const HEART = '<i class="ico ico-hp" aria-hidden="true"></i>';
const ULT_ICONS: Record<string, string> = {
  water: '<svg viewBox="0 0 24 24"><path d="M12 2c4 6 7 9 7 13a7 7 0 0 1-14 0c0-4 3-7 7-13z"/></svg>',
  earth: '<svg viewBox="0 0 24 24"><path d="M5 19C5 9 11 4 21 3c-1 10-6 16-16 16zm0 0l8-8"/></svg>',
  fire: '<svg viewBox="0 0 24 24"><path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-7 0 2 1 3 2 3 0-3-1-5 1-8z"/></svg>',
  dark: '<svg viewBox="0 0 24 24"><path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11z"/></svg>',
  light: '<svg viewBox="0 0 24 24"><path d="M12 2l2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z"/></svg>',
};
/** 'home' is the daily panel under the battle; it shows when no tab is open. */
const TABS = ['home', 'heroes', 'market', 'relics', 'battle', 'shop', 'guild'] as const;
type Tab = (typeof TABS)[number];

interface HeroRow {
  def: HeroDef;
  root: HTMLElement;
  level: HTMLElement;
  emberBadge: HTMLElement;
  stats: HTMLElement;
  button: HTMLButtonElement;
  label: HTMLElement;
  cost: HTMLElement;
  ember: HTMLElement;
  stars: HTMLElement;
}

interface StallRow {
  def: StallDef;
  root: HTMLElement;
  level: HTMLElement;
  fill: HTMLElement;
  amount: HTMLElement;
  meta: HTMLElement;
  button: HTMLButtonElement;
  cost: HTMLElement;
  label: HTMLElement;
  collect: HTMLButtonElement;
}

interface UltButton {
  def: HeroDef;
  button: HTMLButtonElement;
  cd: HTMLElement;
}

/** HTML overlay for everything that isn't the lane: gold, hero upgrades, toggles. */

/** CSS for a Trial boss portrait: the first idle frame in a `size` px box. */
function bossFace(el: Element, size: number): Partial<CSSStyleDeclaration> {
  const id = BOSS_ANIMS[TRIAL_BOSS_ART[el]] ? TRIAL_BOSS_ART[el] : el;
  const a = BOSS_ANIMS[id];
  if (!a) return {};
  const [x0, x1] = a.idleX ?? [0, a.frame[0]];
  const tall = a.frame[1] - a.headTop;
  // A long four-legged boss (head off to one side, a shrine or chimneys on top) is shown whole, centred on
  // itself; an upright one is zoomed in a little past the frame width so the head and shoulders fill the box.
  const whole = a.frame[0] > 100;
  const scale = whole ? (size / Math.max(x1 - x0, tall)) * 1.05 : (size / a.frame[0]) * 1.35;
  const top = whole ? -a.headTop * scale + (size - tall * scale) / 2 : -Math.max(0, a.headTop - 4) * scale;
  return {
    backgroundImage: `url(bosses/${id}_idle.png)`,
    backgroundSize: `${a.frame[0] * BOSS_ANIM_FRAMES.idle * scale}px auto`,
    backgroundPosition: `${size / 2 - ((x0 + x1) / 2) * scale}px ${top}px`,
  };
}

export class UI {
  private rows: HeroRow[] = [];
  private ults: UltButton[] = [];

  constructor(
    private state: GameState,
    private scene: () => BattleScene | undefined,
    private hooks: { simulateAway: () => void; resetAccount: () => Promise<string | null>; rekindle: (mult: number) => void },
  ) {
    this.buildHeroes();
    this.buildUlts();
    this.bindControls();
    this.buildMarket();
    this.buildRelics();
    let last = performance.now();
    setInterval(() => {
      const now = performance.now();
      // A hidden tab is paid as offline time when it comes back (Market Row included), so don't tick it here.
      if (document.hidden) {
        last = now;
        return;
      }
      this.state.tickMarket(Math.min(5, (now - last) / 1000));
      last = now;
      this.render();
    }, 200);
    this.render();
  }

  private buildHeroes() {
    const host = $('heroes');
    for (const def of HEROES) {
      const root = document.createElement('div');
      root.className = 'hero';
      root.innerHTML = `
        <div class="face art" role="button" tabindex="0" aria-label="Open ${def.name}" style="${faceStyle(def)}">${def.name[0]}<span class="pember"></span><span class="plv"></span></div>
        <div class="who" role="button" tabindex="0" aria-label="Open ${def.name}">
          <div class="banner" style="--el:${hex(ELEMENT_COLORS[def.element])}"><span class="name">${def.name}</span><span class="stars-mini"></span></div>
          <div class="stats"></div>
          <div class="meta">${rarityTag(def)} ${heroTitle(def)} <span class="ember-chip"></span></div>
        </div>
        <div class="btns">
          <button class="gold-up"><span class="cost"></span><span class="label"></span></button>
        </div>`;
      host.appendChild(root);
      const button = root.querySelector('.gold-up') as HTMLButtonElement;
      button.addEventListener('click', () => this.buy(def));
      for (const el of root.querySelectorAll<HTMLElement>('.face, .who')) {
        el.addEventListener('click', () => this.openSheet(def.id));
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this.openSheet(def.id);
          }
        });
      }
      this.rows.push({
        def,
        root,
        level: root.querySelector('.plv') as HTMLElement,
        emberBadge: root.querySelector('.pember') as HTMLElement,
        stats: root.querySelector('.stats') as HTMLElement,
        button,
        label: root.querySelector('.label') as HTMLElement,
        cost: root.querySelector('.gold-up .cost') as HTMLElement,
        ember: root.querySelector('.ember-chip') as HTMLElement,
        stars: root.querySelector('.stars-mini') as HTMLElement,
      });
    }
  }

  /** Collection page: every hero in element-coloured tiles, grouped by element. */
  private openCollection() {
    $('coll').hidden = false;
    this.renderCollection();
  }

  private closeCollection() {
    $('coll').hidden = true;
  }

  /** Heroes the game shows: the released ones, plus any this save already owns. */
  private shownHeroes() {
    return HEROES.filter((h) => RELEASED_HEROES.includes(h.id) || (this.state.levels[h.id] ?? 0) > 0);
  }

  private renderCollection() {
    const s = this.state;
    const shown = this.shownHeroes();
    const elements = [...new Set(shown.map((h) => h.element))];
    const owned = shown.filter((h) => (s.levels[h.id] ?? 0) > 0).length;
    $('coll-count').textContent = `${owned}/${shown.length}`;
    $('coll-legend').textContent = `Legendary medals: ${s.legendaryMedals.toLocaleString()}. ${LEGENDARY_HOW}`;
    const groups = elements.map((el) => {
      const tiles = byRarity(shown.filter((h) => h.element === el))
        .map((h) => {
          const recruited = (s.levels[h.id] ?? 0) > 0;
          const crests = s.medalsFor(h.id);
          // Bar fills toward the next unlock or evolution; at max stars the hero is Maxed.
          const need = recruited ? s.evolveCost(h.id) : s.unlockCrests(h);
          const maxed = recruited && need === null;
          const pct = need ? Math.min(100, (crests / need) * 100) : 0;
          const stars = recruited ? `<span class="ct-stars">★${(s.stars[h.id] ?? 0) + 1}</span>` : '';
          const foot = maxed ? '<span class="ct-maxed">Maxed</span>' : `<div class="ct-bar"><i style="width:${pct}%"></i></div><span class="ct-count">${crests.toLocaleString()}</span>`;
          return `<div class="ct${recruited ? '' : ' locked'}${s.canUnlock(h) ? ' ready' : ''}${s.inLineup(h.id) ? ' team' : ''}"><button type="button" class="ct-tile" data-coll="${h.id}" aria-label="${h.name}" style="--el:${hex(ELEMENT_COLORS[el])}"><span class="ct-art" style="--art:${heroArt(h.id)}">${HERO_ANIMS[h.id] ? '' : h.name[0]}</span>${stars}<span class="ct-name">${h.name}${rarityTag(h)}</span></button>${foot}</div>`;
        })
        .join('');
      return `<section class="ct-group">${tiles}</section>`;
    });
    setHtml($('coll-body'), groups.join(''));
  }

  /** Manage Team filter (an element, or null for everyone) and the hero whose quick stats are open. */
  private teamFilter: Element | null = null;
  private teamPeek: string | null = null;

  /**
   * Manage Team: pick which recruited heroes fight. The team sits in a strip of
   * slots at the top; everyone owned is a grid of cards below (filterable by
   * element), and tapping a card shows that hero's stats at a glance.
   */
  private openTeam(note = '') {
    const s = this.state;
    const count = s.lineupCount();
    const owned = HEROES.filter((h) => (s.levels[h.id] ?? 0) > 0);
    const team = owned.filter((h) => s.inLineup(h.id));
    const peek = this.teamPeek ? HEROES.find((h) => h.id === this.teamPeek) : undefined;
    const starsOf = (h: HeroDef) => `<span class="tm-stars">${'★'.repeat(Math.max(1, (s.stars[h.id] ?? 0) + 1))}</span>`;
    const face = (h: HeroDef, cls = '') => `<span class="face art${cls}" style="${faceStyle(h)}">${HERO_ANIMS[h.id] ? '' : h.name[0]}</span>`;
    const slotCost = s.nextTeamSlotCost();
    const slots = Array.from({ length: TEAM_SLOTS_MAX }, (_, i) => {
      const h = team[i];
      if (h) return `<button type="button" class="tm-slot on" data-peek="${h.id}" aria-label="${h.name}">${face(h)}<small>${h.name}</small></button>`;
      if (i < s.teamSlots) return '<span class="tm-slot empty"><span class="face"></span><small>Empty</small></span>';
      // The next slot can be bought here; the ones after it show as locked.
      if (i === s.teamSlots && slotCost !== null)
        return `<button type="button" class="tm-slot buy" data-buy-slot ${s.gems < slotCost ? 'disabled' : ''} aria-label="Buy team slot ${i + 1} for ${slotCost} Gems"><span class="face">+</span><small>${slotCost} Gems</small></button>`;
      return '<span class="tm-slot locked" aria-hidden="true"><span class="face">🔒</span><small>Locked</small></span>';
    }).join('');
    let body: string;
    if (peek) {
      body = this.teamPeekHtml(peek, count);
    } else {
      const shown = owned
        .filter((h) => !this.teamFilter || h.element === this.teamFilter)
        .sort((a, b) => Number(s.inLineup(b.id)) - Number(s.inLineup(a.id)) || s.heroLevel(b.id) - s.heroLevel(a.id));
      const chips = [null, ...TRIAL_ROTATION]
        .map((e) => `<button type="button" class="tm-chip${this.teamFilter === e ? ' on' : ''}" data-filter="${e ?? ''}"${e ? ` style="--el:${hex(ELEMENT_COLORS[e])}"` : ''}>${e ? cap(e) : 'All'}</button>`)
        .join('');
      const cards = shown
        .map((h) => `<button type="button" class="tm-card${s.inLineup(h.id) ? ' on' : ''}" data-peek="${h.id}" style="--el:${hex(ELEMENT_COLORS[h.element])}">${face(h)}<b>${h.name}</b>${rarityTag(h)}<small>Lv ${s.heroLevel(h.id).toLocaleString()}</small><small class="tm-cp">CP ${fmt(s.heroCombatPower(h))}</small>${starsOf(h)}</button>`)
        .join('');
      body = `<div class="tm-chips">${chips}</div><div class="tm-grid">${cards || '<p class="team-help">No heroes of this element yet.</p>'}</div>
        <p class="team-help">Tap a hero to see their stats and add or remove them. Taking a hero out drops them to gold level 1 and gives that gold back. Their Ember levels stay. New heroes are unlocked in Collection.</p>`;
    }
    this.showModal(
      `Team ${count}/${s.teamSlots}`,
      `<button type="button" class="tm-x" data-team-close aria-label="Close">✕</button><p class="tm-total">Total Combat Power <b>${fmt(s.totalCombatPower())}</b></p>${note ? `<p class="team-note">${note}</p>` : ''}<div class="tm-slots">${slots}</div>${this.ultSlotsHtml()}<div class="tm-scroll">${body}</div>`,
      'Done',
    );
    $('modal').classList.add('team-mode');
  }

  /** In a team hero's quick stats: whether their Ultimate has a slot, and a button to change it. */
  private ultToggleHtml(h: HeroDef): string {
    const s = this.state;
    const has = s.hasUltSlot(h.id);
    const picksFull = s.ultPicks.filter((id) => s.inLineup(id)).length >= s.ultSlots;
    const note = has ? 'Their Ultimate is on the battle bar.' : picksFull ? 'All Ultimate slots are taken. Take another hero out first, or buy a slot.' : 'Their Ultimate is off: they fight without it.';
    return `<p class="team-help tm-ult-note">${note}</p><button type="button" class="tm-ult-toggle${has ? '' : ' hot'}" data-ult="${h.id}" ${!has && picksFull ? 'disabled' : ''}>${has ? 'Take Ultimate out' : 'Give Ultimate a slot'}</button>`;
  }

  /** The Ultimate slots line in Manage Team: who holds them, and the next slot for Gems. */
  private ultSlotsHtml(): string {
    const s = this.state;
    const held = s.ultHeroes().map((id) => HEROES.find((h) => h.id === id)!.name);
    const cost = s.nextUltSlotCost();
    const buy = cost === null ? '' : `<button type="button" class="tm-ult-buy" data-buy-ult ${s.gems < cost ? 'disabled' : ''}>+1 slot · ${cost} Gems</button>`;
    return `<div class="tm-ults"><span><b>Ultimates ${held.length}/${s.ultSlots}</b> ${held.length ? held.join(', ') : 'none'}</span>${buy}</div>`;
  }

  /** A hero's quick stats inside Manage Team, with Add/Remove and a link to the full hero page. */
  private teamPeekHtml(h: HeroDef, count: number): string {
    const s = this.state;
    const st = s.heroStats(h);
    const prof = heroProfile(h);
    const on = s.inLineup(h.id);
    const spent = s.goldSpent(h.id);
    const label = on ? (spent.gt(0) ? `Remove (+${fmt(spent)} gold)` : 'Remove') : 'Add to team';
    const disabled = (on && count <= 1) || (!on && count >= s.teamSlots);
    const why = on && count <= 1 ? 'The team needs at least one hero.' : !on && count >= s.teamSlots ? `The team is full (${s.teamSlots}). Remove someone first, or buy another team slot.` : '';
    const pct = (n: number) => `${(Math.round(n * 1000) / 10).toLocaleString()}%`;
    const num = (n: number) => (Math.round(n * 100) / 100).toLocaleString();
    const stat = (label: string, value: string) => `<div><span>${label}</span><b>${value}</b></div>`;
    const ember = s.emberLevels[h.id] ?? 0;
    return `<div class="tm-peek" style="--el:${hex(ELEMENT_COLORS[h.element])}">
      <div class="tm-peek-head"><span class="face art" style="${faceStyle(h)}">${HERO_ANIMS[h.id] ? '' : h.name[0]}</span>
        <div><b class="tm-peek-name">${h.name}</b> ${rarityTag(h)}<small>${heroTitle(h)} · ${'★'.repeat(Math.max(1, (s.stars[h.id] ?? 0) + 1))}</small>
        <small>Level ${s.heroLevel(h.id).toLocaleString()}${ember ? ` (incl. +${ember.toLocaleString()} Ember)` : ''} · ${on ? 'In team' : 'Benched'}</small></div></div>
      <p class="tm-cp-big">Combat Power <b>${fmt(s.heroCombatPower(h))}</b></p>
      <div class="tm-stats">${stat('Atk', fmt(st.atk.value))}${stat('HP', fmt(st.hp.value))}${stat('Def', fmt(st.def.value))}${stat('Atk per sec', num(st.attacksPerSec.value))}${stat('Crit', pct(st.critRate))}${stat('Crit Dmg', `+${pct(st.critDmg)}`)}${stat('Range', num(st.range.value))}${stat('Move', num(st.moveSpeed.value))}${stat('Dodge', pct(st.dodge.value))}</div>
      <p class="tm-spec">${prof.specialty}</p>
      ${why ? `<p class="team-help">${why}</p>` : ''}
      ${on ? this.ultToggleHtml(h) : ''}
      <div class="tm-peek-btns"><button type="button" data-peek-back>Back</button><button type="button" data-team-page="${h.id}">Hero page</button><button type="button" data-lineup="${h.id}" class="${on ? '' : 'hot'}" ${disabled ? 'disabled' : ''}>${label}</button></div>
    </div>`;
  }

  private stallRows: StallRow[] = [];

  private relicRows: { def: RelicDef; root: HTMLElement; eff: HTMLElement; tier: HTMLElement; cost: HTMLElement; up: HTMLButtonElement; equip: HTMLButtonElement }[] = [];
  private setHeads: { id: string; stars: number; box: HTMLElement; root: HTMLElement; count: HTMLElement }[] = [];
  /** Section titles on My relics, with the relics under each, so empty sections hide. */
  private relicSections: { head: HTMLElement; defs: RelicDef[] }[] = [];
  private catalogTiles: { def: RelicDef; root: HTMLElement; status: HTMLElement }[] = [];

  private relicArt(def: RelicDef) {
    const [a, b] = def.essences;
    return `<div class="relic-art" style="--a:${hex(ELEMENT_COLORS[a])};--b:${hex(ELEMENT_COLORS[b])}" aria-hidden="true"><img class="relic-img" src="${RELIC_ICONS[def.id]}" alt="" draggable="false"><span class="relic-stars">${def.stars > 5 ? `${def.stars}★` : '★'.repeat(def.stars)}</span></div>`;
  }

  /** "All heroes ATK +40%" style text for a relic's effects at a level. */
  private relicEffectText(def: RelicDef, level: number) {
    const names: Record<string, string> = {
      atk: 'All heroes ATK',
      hp: 'All heroes HP',
      def: 'All heroes Defense',
      speed: 'Team attack speed',
      crit: 'Crit chance',
      critDmg: 'Crit damage',
      dodge: 'Dodge chance',
      gold: 'Gold from enemies and chests',
      stall: 'Stall income',
      stallCost: 'Stall upgrade costs',
      stallTime: 'Stall speed',
      cost: 'Hero level costs',
      embers: 'Embers from Rekindle',
      stunTime: 'Stun time',
      freezeTime: 'Freeze time',
      burnTime: 'Burn time',
      poisonTime: 'Poison time',
      knightShield: 'Knight shield HP',
    };
    const effectName = (e: string) =>
      names[e] ?? (e.endsWith('Hp') ? `${cap(e.slice(0, -2))} heroes HP` : e.endsWith('Def') ? `${cap(e.slice(0, -3))} heroes Defense` : `${cap(e)} heroes ATK`);
    const pct = (n: number) => `${Math.round(n * 1000) / 10}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return def.fx.map(([e]) => `${effectName(e)} ${e === 'cost' || e === 'stallCost' ? '−' : '+'}${pct(this.state.relicEffect(def, e, level))}%`).join(' · ');
  }

  /** Essence (and Stones) chips for a cost, red where you're short. */
  private relicCostHtml(def: RelicDef, cost: number, stones = 0) {
    const s = this.state;
    return (
      def.essences.map((e) => `<span class="${(s.essences[e] ?? 0) < cost ? 'short' : ''}" title="${ESSENCE_NAMES[e]}"><i class="ess-${e}" style="--el:${hex(ELEMENT_COLORS[e])}"></i>${fmt(cost)}</span>`).join('') +
      (stones ? `<span class="${s.enhanceStones < stones ? 'short' : ''}" title="Enhance Stones"><i class="stone"></i>${stones}</span>` : '')
    );
  }

  private buildRelics() {
    const host = $('relics');
    const catalog = $('relic-catalog');
    const section = (title: string, defs: RelicDef[]) => {
      const h = document.createElement('h3');
      h.className = 'relic-section';
      h.textContent = title;
      host.appendChild(h);
      this.relicSections.push({ head: h, defs });
      const c = document.createElement('h3');
      c.className = 'relic-section';
      c.textContent = title;
      catalog.appendChild(c);
    };
    const tiles = () => {
      const grid = document.createElement('div');
      grid.className = 'relic-grid';
      catalog.appendChild(grid);
      return grid;
    };
    const tile = (def: RelicDef, grid: HTMLElement) => {
      const root = document.createElement('button');
      root.type = 'button';
      root.className = 'relic-tile';
      root.innerHTML = `${this.relicArt(def)}<b>${def.name}</b><small class="rt-status"></small>`;
      root.addEventListener('click', () => this.showRelic(def));
      grid.appendChild(root);
      this.catalogTiles.push({ def, root, status: root.querySelector('.rt-status') as HTMLElement });
    };
    const row = (def: RelicDef, parent: HTMLElement = host) => {
      const root = document.createElement('div');
      root.className = 'relic';
      root.innerHTML = `
        ${this.relicArt(def)}
        <div class="relic-info"><b>${def.name} <small class="tier" style="display:inline"></small></b><span class="eff"></span><small>${def.blurb}</small><div class="relic-cost"></div></div>
        <div class="relic-btns"><button class="wood-btn small up"></button><button class="wood-btn small equip"></button></div>`;
      parent.appendChild(root);
      const up = root.querySelector('.up') as HTMLButtonElement;
      const equip = root.querySelector('.equip') as HTMLButtonElement;
      up.addEventListener('click', () => {
        const ok = this.state.relicNextCost(def) === null ? this.state.enhanceRelic(def.id) : this.state.upgradeRelic(def.id);
        if (ok) {
          play('unlock');
          this.scene()?.syncHeroes();
          this.render();
        }
      });
      equip.addEventListener('click', () => {
        if (this.state.toggleRelic(def.id)) {
          this.scene()?.syncHeroes();
          this.render();
        }
      });
      this.relicRows.push({ def, root, eff: root.querySelector('.eff') as HTMLElement, tier: root.querySelector('.tier') as HTMLElement, cost: root.querySelector('.relic-cost') as HTMLElement, up, equip });
    };
    const byStars = (list: RelicDef[]) => [...list].sort((x, y) => x.stars - y.stars);
    const normal = byStars(RELICS.filter((r) => !r.set));
    section('Relics', normal);
    normal.forEach((d) => row(d));
    const normalGrid = tiles();
    normal.forEach((d) => tile(d, normalGrid));
    for (const stars of [...new Set(RELIC_SETS.map((set) => RELICS.find((r) => r.set === set.id)!.stars))].sort()) {
      section(`${stars}★ sets`, RELICS.filter((r) => r.set && r.stars === stars));
      for (const set of RELIC_SETS) {
        const pieces = byStars(RELICS.filter((r) => r.set === set.id));
        if (pieces[0].stars !== stars) continue;
        const box = document.createElement('div');
        box.className = 'relic-setbox';
        const head = document.createElement('button');
        head.className = 'relic-set';
        head.style.setProperty('--el', set.element ? hex(ELEMENT_COLORS[set.element]) : 'var(--gold)');
        head.innerHTML = `<b>${set.name} set <span class="set-count"></span></b><small>Own all ${pieces.length} pieces: ${set.text}</small>`;
        head.addEventListener('click', () => {
          box.dataset.user = '1';
          box.classList.toggle('open');
        });
        box.appendChild(head);
        host.appendChild(box);
        this.setHeads.push({ id: set.id, stars, box, root: head, count: head.querySelector('.set-count') as HTMLElement });
        pieces.forEach((d) => row(d, box));
        const ch = document.createElement('div');
        ch.className = 'relic-set static';
        ch.style.setProperty('--el', set.element ? hex(ELEMENT_COLORS[set.element]) : 'var(--gold)');
        ch.innerHTML = `<b>${set.name} set</b><small>Own all ${pieces.length} pieces: ${set.text}</small>`;
        catalog.appendChild(ch);
        const grid = tiles();
        pieces.forEach((d) => tile(d, grid));
      }
    }
    for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-relic-go]')) {
      btn.addEventListener('click', () => {
        for (const pane of document.querySelectorAll<HTMLElement>('[data-relic-pane]')) pane.hidden = pane.dataset.relicPane !== btn.dataset.relicGo;
        this.render();
      });
    }
    // The Battle tab is a hub of mode cards; each opens its own page with a Back button.
    // Absolute URLs: a url() inside a CSS variable resolves against the stylesheet, not the page.
    const bg = (f: string) => `url("${new URL(`bg/${f}`, document.baseURI).href}")`;
    document.querySelector<HTMLElement>('.mode-card.arena')!.style.setProperty('--art', `${bg('colosseum_far.png')} center 40% / cover, ${bg('colosseum_sky.png')} center / cover`);
    for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-battle-go]')) {
      btn.addEventListener('click', () => {
        for (const pane of document.querySelectorAll<HTMLElement>('[data-battle-pane]')) pane.hidden = pane.dataset.battlePane !== btn.dataset.battleGo;
        $('panels').scrollTop = 0;
        this.renderBattle();
      });
    }
    $('relic-shop').addEventListener('click', (e) => {
      const el = e.target as HTMLElement;
      const buy = el.closest<HTMLButtonElement>('[data-buy-relic]');
      if (buy) {
        if (buy.disabled) return;
        const def = RELICS.find((r) => r.id === buy.dataset.buyRelic)!;
        if (!this.state.buyRelic(def.id)) return;
        play('unlock');
        this.scene()?.syncHeroes();
        this.render();
        this.showRelic(def, 'Relic bought!');
        return;
      }
      const peek = el.closest<HTMLElement>('[data-peek-relic]');
      if (peek) this.showRelic(RELICS.find((r) => r.id === peek.dataset.peekRelic)!);
    });
    $('relic-new').addEventListener('click', () => {
      if (this.state.relicShopState().refreshIn > 0) return;
      this.showModal(
        'New relics?',
        `Are you sure you want to refresh the Relic Shop? The relics on offer are swapped for new ones, and you can do it again in ${RELIC_SHOP_REFRESH_MINUTES} minutes.`,
        'Refresh',
        () => {
          if (this.state.refreshRelicShop()) {
            play('unlock');
            this.render();
          }
        },
        true,
        'Cancel',
      );
    });
    $('relic-buyslot').addEventListener('click', () => {
      if (this.state.buyRelicSlot()) {
        play('unlock');
        this.render();
      }
    });
  }

  /** A pop-up with everything about one relic: effects, what it costs to craft, its set, and whether you own it. */
  private showRelic(def: RelicDef, title = def.name) {
    const s = this.state;
    const level = s.relics[def.id] ?? 0;
    const set = def.set ? RELIC_SETS.find((x) => x.id === def.set) : undefined;
    const rarity = ['', 'Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic', 'Ancient', 'Divine'][def.stars] ?? '';
    const status = level
      ? `You own it · Lv ${level}/${s.relicMaxLevel(def)}${s.equipped.includes(def.id) ? ' · equipped' : ''}`
      : !s.relicOpen(def)
        ? `Locked: ${def.stars}★ relics open when a ${def.stars - 1}★ relic reaches level ${RELIC_BASE_MAX}.`
        : s.canAffordRelic(def)
          ? `Not owned yet. You have the Essence for it if it shows up in the Relic Shop.`
          : `Not owned yet. When it shows up in the Relic Shop, buy it with the Essence below.`;
    const html = `<div class="relic-peek">
      ${this.relicArt(def)}
      <div>${title === def.name ? '' : `<b>${def.name}</b>`}<small class="rp-rarity r${def.stars}">${'★'.repeat(def.stars)} ${rarity}${set ? ` · ${set.name} set` : ''}</small><small>${def.blurb}</small></div>
    </div>
    <p class="rp-status">${status}</p>
    ${level ? `<p class="rp-line"><b>Now:</b> ${this.relicEffectText(def, level)}</p>` : ''}
    <p class="rp-line"><b>At level ${RELIC_BASE_MAX}:</b> ${this.relicEffectText(def, RELIC_BASE_MAX)}</p>
    ${level ? '' : `<div class="rp-line"><b>To craft:</b> <span class="relic-cost">${this.relicCostHtml(def, s.relicCraftCost(def), def.stones ?? 0)}</span></div>`}
    ${set ? `<p class="rp-line"><b>${set.name} set (${s.setPieces(set.id).owned}/${s.setPieces(set.id).total}):</b> ${set.text}</p>` : ''}`;
    this.showModal(title, html, 'Close');
  }

  /** Returns true when something on the Relics tab is worth a look (an upgrade for an equipped relic, a free slot, or a shop relic you can afford). */
  private renderRelics(): boolean {
    const s = this.state;
    let worthALook = false;
    const owned = (d: RelicDef) => (s.relics[d.id] ?? 0) > 0;
    $('relic-slots').textContent = `Equipped ${s.equipped.length}/${s.relicSlots}`;
    setHtml(
      $('relic-ess'),
      TRIAL_ROTATION.map((e) => `<span style="--el:${hex(ELEMENT_COLORS[e])}" title="${ESSENCE_NAMES[e]}"><i class="ess-${e}"></i>${fmt(s.essences[e] ?? 0)}</span>`).join('') +
        `<span title="Enhance Stones, from Trial level 6 and up, the Rekindle Wheel and player level-ups"><i class="stone"></i>${fmt(s.enhanceStones)}</span>`,
    );
    const slotCost = s.nextSlotCost();
    const slotStage = s.nextSlotStage() ?? 0;
    const slotBtn = $<HTMLButtonElement>('relic-buyslot');
    slotBtn.hidden = slotCost === null;
    slotBtn.textContent = s.bestStage < slotStage ? `+1 slot at stage ${slotStage}` : `+1 slot · ${slotCost} Gems`;
    slotBtn.disabled = slotCost === null || s.gems < slotCost || s.bestStage < slotStage;
    const freeSlot = s.equipped.length < s.relicSlots;
    const starsOpen = s.relicStarsOpen();

    // Relic Shop: the offers, their Essence prices, and the New relics timer.
    const shop = s.relicShopState();
    const newBtn = $<HTMLButtonElement>('relic-new');
    newBtn.disabled = shop.refreshIn > 0;
    newBtn.textContent = shop.refreshIn > 0 ? `New relics in ${Math.ceil(shop.refreshIn / 60_000)}m` : 'New relics';
    const rarity = ['', 'Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic', 'Ancient', 'Divine'];
    const shopHtml = shop.offers
      .map((def) => {
        const can = s.canAffordRelic(def);
        if (can) worthALook = true;
        return `<div class="relic shop-offer r${def.stars}">
          <button type="button" class="relic-peek-btn" data-peek-relic="${def.id}" aria-label="Look at ${def.name}">${this.relicArt(def)}</button>
          <div class="relic-info"><b>${def.name}</b><small class="rs-rarity">${rarity[def.stars] ?? ''}${def.set ? ` · ${RELIC_SETS.find((x) => x.id === def.set)!.name} set` : ''}</small><span class="eff">At Lv ${RELIC_BASE_MAX}: ${this.relicEffectText(def, RELIC_BASE_MAX)}</span></div>
          <button class="wood-btn levelall relic-buy" data-buy-relic="${def.id}" ${can ? '' : 'disabled'}><span class="relic-cost">${this.relicCostHtml(def, s.relicCraftCost(def), def.stones ?? 0)}</span>Buy</button>
        </div>`;
      })
      .join('');
    const nextStar = starsOpen < RELIC_MAX_STARS ? `<p class="market-note">${starsOpen + 1}★ relics join the shop once a ${starsOpen}★ relic reaches level ${RELIC_BASE_MAX}.</p>` : '';
    setHtml(
      $('relic-shop'),
      (shopHtml ||
        (s.relicShopPool().length
          ? `<p class="market-note">Nothing left on offer. ${shop.refreshIn > 0 ? 'New relics arrive when the timer runs out.' : 'Tap New relics for more.'}</p>`
          : '<p class="market-note">You own every relic you can get right now.</p>')) + nextStar,
    );

    for (const sec of this.relicSections) sec.head.hidden = !sec.defs.some(owned);
    for (const h of this.setHeads) {
      const p = s.setPieces(h.id);
      h.count.textContent = `${p.owned}/${p.total}`;
      h.root.classList.toggle('done', p.owned === p.total);
      h.box.hidden = p.owned === 0;
      if (!h.box.dataset.user) h.box.classList.add('open');
    }
    $('relics-empty').hidden = RELICS.some(owned);
    for (const r of this.relicRows) {
      const level = s.relics[r.def.id] ?? 0;
      r.root.hidden = level === 0;
      if (!level) continue;
      const on = s.equipped.includes(r.def.id);
      const cost = s.relicNextCost(r.def);
      const can = s.canUpgradeRelic(r.def);
      const enhance = s.enhanceCost(r.def);
      r.root.classList.toggle('on', on);
      r.tier.textContent = `· Lv ${level}/${s.relicMaxLevel(r.def)}`;
      r.eff.textContent = this.relicEffectText(r.def, level);
      if (cost !== null) setHtml(r.cost, this.relicCostHtml(r.def, cost));
      else if (enhance !== null) setHtml(r.cost, `<span class="${s.enhanceStones < enhance ? 'short' : ''}" title="Enhance Stones"><i class="stone"></i>${enhance} → cap +5</span>`);
      else setHtml(r.cost, '<span>Max level</span>');
      r.up.textContent = cost !== null ? 'Upgrade' : enhance !== null ? 'Enhance' : 'Maxed';
      r.up.disabled = cost !== null ? !can : enhance === null || s.enhanceStones < enhance;
      r.equip.textContent = on ? 'Take off' : 'Equip';
      r.equip.disabled = !on && !freeSlot;
      if ((on && can) || (!on && freeSlot)) worthALook = true;
    }
    for (const t of this.catalogTiles) {
      const level = s.relics[t.def.id] ?? 0;
      const open = s.relicOpen(t.def);
      t.root.classList.toggle('owned', level > 0);
      t.root.classList.toggle('locked', !open);
      t.status.textContent = level ? `Lv ${level}` : open ? 'Not found' : 'Locked';
    }
    return worthALook;
  }

  private buildMarket() {
    const host = $('stalls');
    for (const def of STALLS) {
      const root = document.createElement('div');
      root.className = 'stall';
      root.innerHTML = `
        <div class="stall-art" style="--c:${hex(def.color)}" aria-hidden="true"><img class="stall-img" src="${STALL_ICONS[def.id]}" alt="" draggable="false"><span class="stall-lv"></span></div>
        <div class="stall-info">
          <div class="banner" style="--el:${hex(def.color)}"><span class="name">${def.name}</span></div>
          <button class="stall-bar" aria-label="Collect ${def.name}"><i></i><span class="stall-amt"></span></button>
          <div class="meta"></div>
        </div>
        <button class="gold-up"><span class="cost"></span><span class="label"></span></button>`;
      host.appendChild(root);
      const button = root.querySelector('.gold-up') as HTMLButtonElement;
      button.addEventListener('click', () => {
        const before = this.state.stalls[def.id].level;
        if (this.state.buyStall(def.id)) {
          const after = this.state.stalls[def.id].level;
          if (before === 0 || (before < STALL_AUTO_LEVEL && after >= STALL_AUTO_LEVEL)) play('unlock');
          this.render();
        }
      });
      const collect = root.querySelector('.stall-bar') as HTMLButtonElement;
      collect.addEventListener('click', () => {
        if (this.state.collectStall(def.id)) {
          play('coin');
          this.render();
        }
      });
      this.stallRows.push({
        def,
        root,
        level: root.querySelector('.stall-lv') as HTMLElement,
        fill: root.querySelector('.stall-bar i') as HTMLElement,
        amount: root.querySelector('.stall-amt') as HTMLElement,
        meta: root.querySelector('.stall-info .meta') as HTMLElement,
        button,
        cost: root.querySelector('.gold-up .cost') as HTMLElement,
        label: root.querySelector('.gold-up .label') as HTMLElement,
        collect,
      });
    }
  }

  private renderMarket(): boolean {
    const s = this.state;
    let anyReady = false;
    const bonus = s.stallBonusLevels();
    $('market-note').textContent =
      s.rekindles > 0
        ? `Rekindle bonus: Stall income x${s.marketRevenueMult().toFixed(2)}, +${bonus} levels on auto-collect Stalls.`
        : `Tap a full bar to collect. Stalls collect themselves from level ${STALL_AUTO_LEVEL}.`;
    let prevOpen = true;
    for (const r of this.stallRows) {
      const st = s.stalls[r.def.id];
      const open = st.level > 0;
      const auto = s.stallAuto(r.def.id);
      const ready = s.stallReady(r.def.id);
      anyReady ||= ready;
      r.root.classList.toggle('locked', !open);
      r.root.classList.toggle('ready', ready);
      r.root.hidden = !open && !prevOpen;
      prevOpen = open;
      const eff = s.stallEffectiveLevel(r.def.id);
      r.level.textContent = open ? `Lv ${eff}` : '';
      const income = s.stallIncome(r.def);
      r.fill.style.width = open ? `${Math.min(100, (st.progress / s.stallCycle(r.def)) * 100)}%` : '0%';
      r.amount.textContent = !open ? 'Closed' : ready ? `Collect ${fmt(income)}` : `${fmt(income)}`;
      r.collect.disabled = !ready;
      const toMilestone = STALL_MILESTONE - (st.level % STALL_MILESTONE);
      r.meta.textContent = !open
        ? `${r.def.blurb} ${fmt(stallIncomePreview(r.def))} gold every ${fmtSecs(s.stallCycle(r.def))}.`
        : `${fmt(income)} every ${fmtSecs(s.stallCycle(r.def))} · ${auto ? 'Auto-collect' : `Auto at Lv ${STALL_AUTO_LEVEL}`} · x3 in ${toMilestone} Lv`;
      const bulk = stallBulkCost(r.def, st.level, s.stallBuyAmount, s.gold, s.stallCostMult());
      const shown = bulk.levels > 0 ? bulk : stallBulkCost(r.def, st.level, 1, s.gold, s.stallCostMult());
      r.cost.textContent = fmt(shown.cost);
      r.label.textContent = open ? `Level +${shown.levels}` : 'Open';
      r.button.disabled = shown.cost.gt(s.gold);
    }
    $<HTMLButtonElement>('stall-levelall').disabled = !STALLS.some((d) => s.stalls[d.id].level > 0 && stallUpgradeCost(d, s.stalls[d.id].level, s.stallCostMult()).lte(s.gold));
    $('stall-buyamt').textContent = `Buy ${s.stallBuyAmount === 'max' ? 'max' : `x${s.stallBuyAmount}`}`;
    return anyReady;
  }

  private buildUlts() {
    const host = $('ults');
    for (const def of HEROES) {
      const button = document.createElement('button');
      button.className = 'ult';
      button.style.setProperty('--el', hex(ELEMENT_COLORS[def.element]));
      button.innerHTML = `${ULT_ICONS[def.element]}<span class="cd"></span>`;
      button.setAttribute('aria-label', `${def.name} ultimate: ${def.ultimate.name}`);
      button.title = `${def.name}: ${def.ultimate.name} (unlocks at Lv ${ULT_UNLOCK_LEVEL})`;
      button.addEventListener('click', () => this.scene()?.triggerUlt(def.id));
      host.appendChild(button);
      this.ults.push({ def, button, cd: button.querySelector('.cd') as HTMLElement });
    }
  }

  private bindControls() {
    $('speed').addEventListener('click', () => {
      this.state.speed2x = !this.state.speed2x;
      this.render();
    });
    $('settings-btn').addEventListener('click', () => ($('settings').hidden = false));
    $('settings-close').addEventListener('click', () => ($('settings').hidden = true));
    $('settings').addEventListener('click', (e) => {
      if (e.target === $('settings')) $('settings').hidden = true;
    });
    $('mute').addEventListener('click', () => {
      this.state.muted = !this.state.muted;
      setMuted(this.state.muted);
      this.render();
    });
    for (const id of ['vol-sfx', 'vol-music'] as const) {
      const input = $<HTMLInputElement>(id);
      input.value = String(Math.round((id === 'vol-sfx' ? this.state.sfxVolume : this.state.musicVolume) * 100));
      input.addEventListener('input', () => {
        const v = Number(input.value) / 100;
        if (id === 'vol-sfx') this.state.sfxVolume = v;
        else this.state.musicVolume = v;
        setVolumes(this.state.sfxVolume, this.state.musicVolume);
        this.render();
      });
      // A sample of the new effects level.
      if (id === 'vol-sfx') input.addEventListener('change', () => play('coin'));
    }
    $('autoult').addEventListener('click', () => {
      this.state.autoUlt = !this.state.autoUlt;
      this.render();
    });
    $('boss').addEventListener('click', () => this.scene()?.challengeBoss());
    $('autoboss').addEventListener('click', () => {
      this.state.autoBoss = !this.state.autoBoss;
      this.state.bossRetryAt = 0;
      this.render();
    });
    $('tr-down').addEventListener('click', () => this.stepTier(-1));
    $('tr-up').addEventListener('click', () => this.stepTier(1));
    $('tr-fight').addEventListener('click', () => this.fightTrial());
    $('tr-quick').addEventListener('click', () => this.pickQuickCount());
    $('pvp').addEventListener('click', (e) => this.onPvpClick(e));
    $('trial-leave').addEventListener('click', () => {
      const scene = this.scene();
      if (scene?.inPvp()) {
        if ($('trial-leave').textContent === 'Leave') scene.leavePvp();
        else this.endPvpScreen();
        return;
      }
      // Mid-fight, leaving counts as a loss (the ticket is kept); after it, this goes back to the run.
      if (scene?.inTrial() && $('trial-leave').textContent === 'Leave') {
        this.trialLeft = true;
        scene.leaveTrial();
      }
      else this.endTrial();
    });
    $('tr-list').addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-el]');
      if (!btn || btn.disabled) return;
      this.trialPick = btn.dataset.el as Element;
      this.trialTier = 0;
      this.trialEntered = true;
      this.renderTrials();
    });
    $('tr-back').addEventListener('click', () => {
      this.trialEntered = false;
      this.renderTrials();
    });
    $('evolve-all').addEventListener('click', () => {
      const done = this.state.evolveAll();
      if (!done.length) return;
      play('unlock');
      this.scene()?.syncHeroes();
      this.render();
      const rows = done
        .map(({ id, from, to }) => {
          const h = HEROES.find((x) => x.id === id)!;
          return `<li><span class="face art" style="${faceStyle(h)}">${HERO_ANIMS[h.id] ? '' : h.name[0]}</span><b>${h.name}</b><span class="stars">${from + 1}★ → ${to + 1}★</span></li>`;
        })
        .join('');
      this.showModal('Evolved!', `${done.length} hero${done.length === 1 ? '' : 'es'} gained stars.<ul class="evo-list">${rows}</ul>`, 'Nice');
    });
    $('levelall').addEventListener('click', () => {
      if (this.state.levelAll() > 0) {
        play('unlock');
        this.scene()?.syncHeroes();
        this.render();
      }
    });
    $('sheet-buyamt').addEventListener('click', () => $('buyamt').click());
    $('buyamt').addEventListener('click', () => {
      const order: Array<1 | 10 | 'max'> = [1, 10, 'max'];
      this.state.buyAmount = order[(order.indexOf(this.state.buyAmount) + 1) % order.length];
      this.render();
    });
    $('stall-levelall').addEventListener('click', () => {
      if (this.state.levelAllStalls() > 0) {
        play('unlock');
        this.render();
      }
    });
    $('stall-buyamt').addEventListener('click', () => {
      const order: Array<1 | 10 | 'max'> = [1, 10, 'max'];
      this.state.stallBuyAmount = order[(order.indexOf(this.state.stallBuyAmount) + 1) % order.length];
      this.render();
    });
    // Test shortcuts stay out of regular players' hands: only dev builds or a ?dev link show them.
    $('devtools').hidden = !DEV_TOOLS;
    $('sim').addEventListener('click', () => {
      if (DEV_TOOLS) this.hooks.simulateAway();
    });
    $('acct-reset').addEventListener('click', () => this.confirmReset());
    $('modal-ok').addEventListener('click', () => {
      $('modal').hidden = true;
      const action = this.modalAction;
      this.modalAction = null;
      action?.();
    });
    $('modal-cancel').addEventListener('click', () => {
      $('modal').hidden = true;
      this.modalAction = null;
    });
    $('rekindle').addEventListener('click', () => this.openRekindle());
    $('rk-head-on').addEventListener('change', () => {
      this.state.headStart = $<HTMLInputElement>('rk-head-on').checked;
      this.state.save();
      this.renderRekindle();
    });
    $('rk-close').addEventListener('click', () => this.closeRekindle());
    $('rk').addEventListener('click', (e) => {
      if (e.target === $('rk')) this.closeRekindle();
    });
    $('rk-buttons').addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('button');
      if (!btn || btn.disabled) return;
      this.closeRekindle();
      this.hooks.rekindle(Number(btn.dataset.mult));
    });

    $('summon').addEventListener('click', () => this.confirmChest());
    $('gs-hourglass').addEventListener('click', () => {
      const gold = this.state.useHourglass();
      if (!gold) return;
      play('coin');
      this.render();
    });
    for (const n of [1, 5]) {
      $(`gs-ticket${n}`).addEventListener('click', () => {
        if (!this.state.buyTickets(n)) return;
        play('coin');
        this.render();
      });
    }
    $('hs-refresh').addEventListener('click', () => {
      if (!this.state.refreshHeroShopEarly()) return;
      play('unlock');
      this.render();
    });
    $('hs-pack').addEventListener('click', () => this.pickMedalPack());
    $('hs-deal').addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-deal]');
      if (!btn || btn.disabled) return;
      if (btn.dataset.deal === 'use') return this.pickVoucherHero();
      const kind = this.state.dealState().kind;
      if (!this.state.buyDeal()) return;
      play('unlock');
      this.showModal(kind === 'crate' ? 'Ticket Crate' : 'Hero Voucher', kind === 'crate' ? `<p>${TICKET_CRATE.tickets} Trial tickets went to your bought stash (${this.state.boughtTickets}/${BOUGHT_TICKET_CAP}). They're used after your free tickets run out.</p>` : '<p>You have a Hero Voucher. Use it now, or keep it for later.</p>', 'Okay');
      this.render();
    });
    $('hs-asc').addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-asc]');
      if (!btn || btn.disabled) return;
      const got = this.state.buyAscendantChest();
      if (!got) return;
      play('chest');
      const h = HEROES.find((x) => x.id === got.heroId);
      this.showModal('Ascendant Chest', `<p><b>+${got.crests} ${h?.name ?? ''} crests</b></p>${dropCards(got.drops)}Bought with Gems.`, 'Collect');
      this.render();
    });
    $('events-btn').addEventListener('click', () => this.showCalendar());
    $('rewards').addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-hs]');
      if (!btn || btn.disabled) return;
      const [kind, arg] = btn.dataset.hs!.split(':');
      const drops = kind === 'offer' ? this.state.buyHeroShopOffer(Number(arg)) : this.state.buyFeatured(arg as 'small' | 'big');
      if (!drops) return;
      play('chest');
      this.scene()?.syncHeroes();
      this.showModal('Hero Shop', `${dropCards(drops)}Bought with Gems.`, 'Collect');
      this.render();
    });
    $('gs-boost').addEventListener('click', () => {
      if (!this.state.buyGoldBoost()) return;
      play('unlock');
      this.render();
    });
    $('chest-btn').addEventListener('click', () => this.confirmChest());
    $('collection-btn').addEventListener('click', () => this.openCollection());
    const wheel = () => this.showModal('Element wheel', `${elementWheelSvg()}<p class="ew-note">${ELEMENT_WHEEL_NOTE}</p>`, 'Got it');
    $('elements-btn').addEventListener('click', wheel);
    $('tr-elements').addEventListener('click', wheel);
    $('coll-back').addEventListener('click', () => this.closeCollection());
    $('coll-body').addEventListener('click', (e) => {
      const tile = (e.target as HTMLElement).closest<HTMLElement>('[data-coll]');
      if (tile) this.openSheet(tile.dataset.coll!);
    });
    $('team-btn').addEventListener('click', () => {
      this.teamPeek = null;
      this.openTeam();
    });
    $('modal-body').addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      const peek = t.closest<HTMLElement>('[data-peek]');
      if (peek) {
        this.teamPeek = peek.dataset.peek!;
        this.openTeam();
        return;
      }
      const filter = t.closest<HTMLElement>('[data-filter]');
      if (filter) {
        this.teamFilter = (filter.dataset.filter || null) as Element | null;
        this.openTeam();
        return;
      }
      if (t.closest('[data-peek-back]')) {
        this.teamPeek = null;
        this.openTeam();
        return;
      }
      const buyUlt = t.closest<HTMLButtonElement>('button[data-buy-ult]');
      if (buyUlt) {
        if (!buyUlt.disabled && this.state.buyUltSlot()) {
          play('unlock');
          this.render();
          this.openTeam(`Ultimate slot ${this.state.ultSlots} unlocked.`);
        }
        return;
      }
      const ult = t.closest<HTMLButtonElement>('button[data-ult]');
      if (ult) {
        if (!ult.disabled && this.state.setUltSlot(ult.dataset.ult!, !this.state.hasUltSlot(ult.dataset.ult!))) {
          play('unlock');
          this.render();
          this.openTeam();
        }
        return;
      }
      const buySlot = t.closest<HTMLButtonElement>('button[data-buy-slot]');
      if (buySlot) {
        if (!buySlot.disabled && this.state.buyTeamSlot()) {
          play('unlock');
          this.render();
          this.openTeam(`Team slot ${this.state.teamSlots} unlocked.`);
        }
        return;
      }
      if (t.closest('[data-team-close]')) {
        $('modal-ok').click();
        return;
      }
      const page = t.closest<HTMLElement>('[data-team-page]');
      if (page) {
        $('modal-ok').click();
        this.openSheet(page.dataset.teamPage!);
        return;
      }
      const btn = t.closest<HTMLButtonElement>('button[data-lineup]');
      if (!btn || btn.disabled) return;
      const id = btn.dataset.lineup!;
      const refund = this.state.setInLineup(id, !this.state.inLineup(id));
      if (refund === null) return;
      play(refund.gt(0) ? 'coin' : 'unlock');
      this.scene()?.syncHeroes();
      this.render();
      const name = HEROES.find((h) => h.id === id)!.name;
      this.openTeam(this.state.inLineup(id) ? '' : `${name} left the team. ${fmt(refund)} gold came back; their Embers stay.`);
    });
    for (const btn of $('tabbar').querySelectorAll<HTMLButtonElement>('button')) {
      // Tapping the open tab again closes it, same as the down arrow.
      btn.addEventListener('click', () => {
        play('tap');
        this.setTab(this.tab === btn.dataset.tab ? 'home' : (btn.dataset.tab as Tab));
      });
    }
    $('home-btn').addEventListener('click', () => this.setTab('home'));
    $('home-wheel').addEventListener('click', () => this.showModal('Element wheel', `${elementWheelSvg()}<p class="ew-note">${ELEMENT_WHEEL_NOTE}</p>`, 'Got it'));
    setHtml($('home-wheel'), `${elementWheelSvg()}<small>Elements</small>`);
    this.setTab('home');
    $('freegems').addEventListener('click', () => {
      if (!DEV_TOOLS) return;
      this.state.gems += 100;
      this.render();
    });
    $('freemotes').addEventListener('click', () => {
      if (!DEV_TOOLS) return;
      this.state.starmotes += 500;
      this.render();
    });
    this.bindRewards();
    $('sheet-evolve').addEventListener('click', () => {
      if (this.sheetHero && this.state.evolve(this.sheetHero)) {
        play('unlock');
        this.scene()?.syncHeroes();
        this.render();
      }
    });
    $('sheet-ascend-btn').addEventListener('click', () => {
      const id = this.sheetHero;
      if (id && this.state.ascend(id)) {
        play('unlock');
        this.scene()?.syncHeroes();
        this.openSheet(id);
        this.render();
      }
    });
    $('sheet-awaken').addEventListener('click', () => {
      if (this.sheetHero && this.state.awakenHero(this.sheetHero)) {
        play('unlock');
        this.render();
      }
    });
    $('sheet-close').addEventListener('click', () => this.closeSheet());
    $('sheet-stats').addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-statpage]');
      if (!btn) return;
      this.statPage = (this.statPage + Number(btn.dataset.statpage) + 3) % 3;
      this.renderSheet();
    });
    $('sheet').addEventListener('click', (e) => {
      if (e.target === $('sheet')) this.closeSheet();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      // Close the top-most overlay first. A pop-up mid-Trial (button disabled) stays open.
      if (!$('acct-dialog').hidden) $('acct-cancel').click();
      else if (!$('modal').hidden) {
        if (!$<HTMLButtonElement>('modal-ok').disabled) $('modal-ok').click();
      } else if (!$('settings').hidden) $('settings-close').click();
      else if (!$('rk').hidden) this.closeRekindle();
      else if (this.sheetHero) this.closeSheet();
      else if (!$('coll').hidden) this.closeCollection();
    });
    const step = (dir: number) => {
      const shown = this.shownHeroes();
      const i = shown.findIndex((h) => h.id === this.sheetHero);
      this.openSheet(shown[(i + dir + shown.length) % shown.length].id);
    };
    $('sheet-prev').addEventListener('click', () => step(-1));
    $('sheet-next').addEventListener('click', () => step(1));
    $('sheet-gold-up').addEventListener('click', () => {
      const def = HEROES.find((h) => h.id === this.sheetHero);
      if (def) this.buy(def);
    });
    $('sheet-ember-up').addEventListener('click', () => {
      const def = HEROES.find((h) => h.id === this.sheetHero);
      if (def) this.buyEmber(def);
    });
    $('sheet-ember-reset').addEventListener('click', () => {
      const def = HEROES.find((h) => h.id === this.sheetHero);
      if (def) this.confirmEmberReset(def);
    });
  }

  /** The player's choice to take a hero back to Ember +0, with every Ember refunded. */
  private confirmEmberReset(def: HeroDef) {
    const level = this.state.emberLevels[def.id] ?? 0;
    if (level <= 0) return;
    this.showModal(
      `Reset ${def.name}'s Embers?`,
      `${def.name} goes from Ember level <b>+${level}</b> back to <b>+0</b>, and you get back all <b class="ember-text">${fmt(emberRefund(level))} Embers</b> spent on them to use on any hero.`,
      'Reset Embers',
      () => {
        this.state.resetEmbers(def.id);
        this.scene()?.syncHeroes();
        this.render();
      },
      true,
      'Cancel',
    );
  }

  /** Hero Chest pop-up: shows what's inside and asks before spending Gems. */
  private confirmChest() {
    const s = this.state;
    // Real odds: only rarities that have heroes can drop, so the weights are re-normalised.
    const odds = rarityOdds(PLAYABLE_HEROES, CHEST_RARITY_WEIGHTS)
      .map(([r, pct]) => `<li><b>${cap(r)}</b><span>${+pct.toFixed(1)}% · ${CREST_ROLLS[r as keyof typeof CREST_ROLLS].map(([c]) => c).join('/')} crests</span></li>`)
      .join('');
    const faces = PLAYABLE_HEROES.map((h) => `<span class="face art" title="${h.name}" style="${faceStyle(h)}">${h.name[0]}</span>`).join('');
    const afford = s.gems >= CHEST_COST;
    this.showModal(
      'Hero Chest',
      `<div class="chest-pop"><div class="chest-art" aria-hidden="true"></div>
        <p>${CHEST_DROPS} drops of Hero Crests. Collect enough to unlock a hero, then keep collecting to evolve them. Legendary heroes never drop.</p>
        <div class="chest-heroes">${faces}</div>
        <ul class="chest-odds">${odds}</ul>
        <p class="chest-wallet">You have <b>${s.gems}</b> Gems${afford ? '' : `. You need ${CHEST_COST - s.gems} more.`}</p></div>`,
      afford ? `Buy · ${CHEST_COST} Gems` : 'Okay',
      afford ? () => this.summon() : null,
      afford,
      'Cancel',
    );
  }

  private summon() {
    const drops = this.state.summon();
    if (!drops) return;
    play('chest');
    this.scene()?.syncHeroes();
    this.showSummon(drops);
    this.render();
  }

  private showSummon(drops: SummonDrop[]) {
    const cards = dropCards(drops);
    const canAgain = this.state.gems >= CHEST_COST;
    this.showModal(
      'Hero Chest',
      `${cards}Tap a hero to evolve them when their Crest bar is full.`,
      canAgain ? `Open another (${CHEST_COST} Gems)` : 'Done',
      canAgain ? () => this.summon() : null,
      canAgain,
      'Done',
    );
  }

  // ---------- hero page ----------

  private sheetHero: string | null = null;
  /** Which of the three stat pages the hero page shows. */
  private statPage = 0;

  openSheet(id: string) {
    this.sheetHero = id;
    // An Ascendant hero shows its current form's name, rarity and story.
    const def = this.state.formDef(HEROES.find((h) => h.id === id)!);
    const face = $('sheet-face');
    face.textContent = def.name[0];
    face.classList.add('art');
    face.setAttribute('style', faceStyle(def));
    $('sheet-name').textContent = def.name;
    $('sheet-rarity').innerHTML = rarityTag(def);
    $('sheet-sub').textContent = heroTitle(def);
    $('sheet-bio').textContent = def.bio;
    $('sheet').hidden = false;
    this.renderSheet();
  }

  private closeSheet() {
    this.sheetHero = null;
    $('sheet').hidden = true;
  }

  private renderSheet() {
    const id = this.sheetHero;
    if (!id) return;
    const s = this.state;
    const def = HEROES.find((h) => h.id === id)!;
    const gold = s.levels[id] ?? 0;
    const ember = s.emberLevels[id] ?? 0;
    const eff = s.heroLevel(id);
    const stars = s.stars[id] ?? 0;
    const legendary = def.rarity === 'legendary';
    const crests = s.medalsFor(id);

    // A hero is 1★ when unlocked; each evolution adds a star, up to 8★.
    setHtml($('sheet-stars'), [0, ...STAR_CRESTS].map((_, i) => `<span class="${gold > 0 && i <= stars ? 'on' : ''}">★</span>`).join(''));
    // Pink awakening stars sit under the yellow ones once awakening opens (or the hero has some).
    const pink = s.awaken[id] ?? 0;
    $('sheet-pink').hidden = !s.awakenOpen() && pink === 0;
    setHtml($('sheet-pink'), AWAKEN_STARMOTES.map((_, i) => `<span class="${i < pink ? 'on' : ''}">★</span>`).join(''));
    const shownLevel = gold > 0 ? eff : 1 + ember;
    const prof = heroProfile(def);
    const counts = s.buildCounts();
    const builds = heroBuildEffects(def).map((e) => {
      const n = counts[e];
      const b = buildBonus(n);
      const what = b.time > 0 ? ` (+${Math.round(b.time * 100)}% time${b.dmg > 0 ? (e === 'stun' ? ', +50% more' : ', +50% damage') : ''})` : '';
      return `${cap(e)} build: ${n} in team${what}`;
    });
    const top = `<b>${def.type}</b> · ${HERO_TYPES[def.type]}<br>${prof.specialty}${def.flying ? '<br><small>Flies: melee enemies can\'t hit it.</small>' : ''}${builds.length ? `<br><small>${builds.join(' · ')}. 2 heroes with the same effect: +25% time; 3: +50% damage too.</small>` : ''}`;
    const sheetStats = s.heroStats(def, shownLevel);
    setHtml($('sheet-stats'), statPages(sheetStats, gold > 0 ? String(eff) : 'Locked', this.statPage, top, gold > 0 ? fmt(s.heroCombatPower(def)) : ''));

    $('sheet-gold-lvl').textContent = gold > 0 ? String(gold) : '(locked)';
    const { levels, cost } = bulkCost(def, gold, s.buyAmount, s.gold, s.levelCostMult());
    const shown = levels > 0 ? { levels, cost } : bulkCost(def, gold, 1, s.gold, s.levelCostMult());
    const goldBtn = $<HTMLButtonElement>('sheet-gold-up');
    goldBtn.classList.toggle('unlock', gold === 0);
    if (gold === 0) {
      const need = s.unlockCrests(def);
      (goldBtn.querySelector('.label') as HTMLElement).textContent = 'Unlock';
      (goldBtn.querySelector('.cost') as HTMLElement).textContent = medalCount(def, Math.min(crests, need), need);
      goldBtn.disabled = !s.canUnlock(def);
    } else {
      (goldBtn.querySelector('.label') as HTMLElement).textContent = `Level +${shown.levels}`;
      (goldBtn.querySelector('.cost') as HTMLElement).textContent = fmt(shown.cost);
      goldBtn.disabled = shown.cost.gt(s.gold);
    }

    $('sheet-ember-lvl').textContent = `+${ember}`;
    $('sheet-embers').textContent = fmt(s.embers);
    const eb = emberBulk(ember, s.buyAmount, s.embers);
    const eShown = eb.levels > 0 ? eb : emberBulk(ember, 1, s.embers);
    const emberBtn = $<HTMLButtonElement>('sheet-ember-up');
    (emberBtn.querySelector('.label') as HTMLElement).textContent = `Ember +${eShown.levels}`;
    (emberBtn.querySelector('.cost') as HTMLElement).textContent = `${fmt(eShown.cost)} Ember${eShown.cost === 1 ? '' : 's'}`;
    emberBtn.disabled = eShown.cost > s.embers;
    $('sheet-buyamt').textContent = `Buy ${s.buyAmount === 'max' ? 'max' : `x${s.buyAmount}`}`;
    $('sheet-ember-note').textContent = 'Ember levels stay on this hero through Rekindle and out of the team, and count in Trials and PvP. Only a reset takes them off.';
    $('sheet-ember-reset').hidden = ember <= 0;
    emberBtn.title = s.rekindles === 0 ? `Earn Embers by Rekindling after stage ${REKINDLE_STAGE}` : '';

    const ultReady = eff >= ULT_UNLOCK_LEVEL;
    const ability = (kind: string, a: { name: string; text: string }, tag = '', ready = false) =>
      `<li><span class="kind">${kind}</span>${tag ? `<span class="tag${ready ? ' ready' : ''}">${tag}</span>` : ''}<div><b>${a.name}</b></div><p>${a.text}</p></li>`;
    // Skills come from an Ascendant hero's current form; crests and stars stay the hero's own.
    const now = s.formDef(def);
    const form = s.formOf(id);
    const html = [
      ability('Basic attack', now.basic),
      ability('Ultimate', now.ultimate, ultReady ? 'Unlocked' : `Unlocks at Lv ${ULT_UNLOCK_LEVEL}`, ultReady),
      ability(now.signature ? 'Signature' : 'Trait', now.trait),
    ].join('');
    // Only re-render lists when content changes, so taps and hover states aren't lost every frame.
    if ($('sheet-abilities').dataset.key !== `${id}:${ultReady}:${form}`) {
      $('sheet-abilities').innerHTML = html;
      $('sheet-abilities').dataset.key = `${id}:${ultReady}:${form}`;
    }
    this.renderAscension(id);

    const next = s.evolveCost(id);
    $('sheet-crest-label').textContent = legendary ? 'Legendary crests' : 'Hero Crests';
    $('sheet-crests').textContent = next === null ? (legendary ? 'Max stars' : `Max stars · ${s.legendaryMedals} Legendary crests`) : `${crests} / ${next} for ${stars + 2}★`;
    $('sheet-crest-note').textContent = legendary ? LEGENDARY_HOW : next === null
      ? `Every ${LEGENDARY_MEDAL_RATE} more crests this hero gets become 1 Legendary crest, spent on Legendary heroes in the Collection.`
      : 'Hero Chests give copies of heroes as Hero Crests. Spend Crests to evolve: each star multiplies all stats by 1.5 and unlocks something new.';
    $('sheet-crest-fill').style.width = next === null ? '100%' : `${Math.min(100, (crests / next) * 100)}%`;
    const evolve = $<HTMLButtonElement>('sheet-evolve');
    evolve.hidden = next === null || crests < next || gold === 0;
    evolve.textContent = `Evolve to ${stars + 2}★ (${next} ${legendary ? 'Legendary crests' : 'Crests'})`;
    const moteCost = s.awakenCost(id);
    const block = s.awakenBlock(id);
    $('sheet-starmotes').textContent = moteCost === null ? `${s.starmotes} · Max pink stars` : `${s.starmotes} / ${moteCost} for pink ${pink + 1}★`;
    $('sheet-mote-fill').style.width = moteCost === null ? '100%' : `${Math.min(100, (s.starmotes / moteCost) * 100)}%`;
    const awaken = $<HTMLButtonElement>('sheet-awaken');
    awaken.hidden = block !== null;
    awaken.textContent = `Awaken to pink ${pink + 1}★ (${moteCost} Starmotes)`;
    $('sheet-awaken-note').textContent = `${block && block !== `Need ${moteCost} Starmotes` ? `${block}. ` : ''}Each pink star multiplies all stats by ${AWAKEN_STAT_MULT}. A hero can hold as many pink stars as yellow stars. Starmotes come from the Colosseum.`;
    const unlocks: Array<[number, string, string]> = [
      [1, `${now.sp1.name}`, now.sp1.text],
      [2, `${now.sp2.name}`, now.sp2.text],
      [AURA_EVOLUTIONS, `Aura: ${now.aura.name}`, now.aura.text],
      [ULT_PLUS_EVOLUTIONS, `${now.ultimate.name}+`, now.ultPlus ?? `Ultimate hits for ${ULT_MULTIPLIER * ULT_STAR_BONUS}x instead of ${ULT_MULTIPLIER}x.`],
      ...(now.signature && now.sigPlus ? [[SIG_PLUS_EVOLUTIONS, `${now.trait.name}+`, now.sigPlus] as [number, string, string]] : []),
      [MASTERY_EVOLUTIONS, `${def.type} Mastery: ${TYPE_MASTERY[def.type].name}`, TYPE_MASTERY[def.type].text],
      [ASCENDED_EVOLUTIONS, 'Ascended', `The Ultimate recharges in ${ASCENDED_ULT_COOLDOWN} seconds instead of ${ULT_COOLDOWN}. Every ${LEGENDARY_MEDAL_RATE} extra crests for this hero become a Legendary crest, used to get Legendary heroes.`],
    ];
    if ($('sheet-unlocks').dataset.key !== `${id}:${stars}:${form}`) {
      $('sheet-unlocks').innerHTML = unlocks
        .map(([star, name, text]) => {
          const on = stars >= star;
          return `<li class="${on ? '' : 'locked'}"><span class="kind">${star + 1}★</span><span class="tag${on ? ' ready' : ''}">${on ? 'Unlocked' : 'Locked'}</span><div><b>${name}</b></div><p>${text}</p></li>`;
        })
        .join('');
      $('sheet-unlocks').dataset.key = `${id}:${stars}:${form}`;
    }
  }

  /** The hero page's Ascension section: shown only for Ascendant heroes. */
  private renderAscension(id: string) {
    const s = this.state;
    const def = ascendantDef(id);
    $('sheet-ascend').hidden = !def;
    if (!def) return;
    const form = s.formOf(id);
    const shown = s.formDef(HEROES.find((h) => h.id === id) ?? def.base);
    $('sheet-form-name').textContent = `${def.forms[form].formName} · ${cap(shown.rarity)}`;
    $('sheet-form-next').textContent = form >= MAX_FORM ? 'Final form' : `Next: ${def.forms[form + 1].formName} (${cap(FORM_RARITIES[form + 1])})`;
    const needs = s.ascendNeeds(id) ?? [];
    const key = `${id}:${form}:${needs.map((n) => +n.met).join('')}`;
    if ($('sheet-ascend-needs').dataset.key !== key) {
      setHtml($('sheet-ascend-needs'), needs.map((n) => `<li class="${n.met ? 'met' : ''}">${n.met ? '✓' : '○'} ${n.text}</li>`).join(''));
      $('sheet-ascend-needs').dataset.key = key;
    }
    const btn = $<HTMLButtonElement>('sheet-ascend-btn');
    btn.hidden = form >= MAX_FORM;
    btn.disabled = s.ascendBlocker(id) !== null;
    btn.textContent = form >= MAX_FORM ? 'Ascend' : `Ascend to ${def.forms[form + 1].formName}`;
  }

  private modalAction: (() => void) | null = null;

  /** Account reset, asked twice (in-game pop-ups: confirm() is blocked in some embedded viewers). */
  private confirmReset() {
    this.showModal(
      'Reset account?',
      'This erases <b>all</b> your progress: stages, heroes, stars, Embers, Gems, relics and everything else. You start a brand-new game. If you are signed in, your online save is erased too and you leave your guild.',
      'Reset',
      () =>
        this.showModal(
          'Are you sure?',
          'There is no way to get this progress back.',
          'Yes, erase everything',
          () => {
            this.showModal('Resetting…', 'Starting a new game.', 'Okay');
            $<HTMLButtonElement>('modal-ok').disabled = true;
            void this.hooks.resetAccount().then((error) => {
              if (error) this.showModal('Reset failed', `${error.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)} Nothing was erased. Try again when you're online.`, 'Okay');
            });
          },
          true,
          'Keep my progress',
        ),
      true,
      'Cancel',
    );
  }

  showModal(title: string, html: string, ok: string, action: (() => void) | null = null, cancel = false, cancelLabel = 'Not yet') {
    $('modal').classList.remove('team-mode');
    $('modal-title').textContent = title;
    $('modal-body').innerHTML = html;
    $('modal-ok').textContent = ok;
    // A Trial fight disables this while it plays; any new pop-up must be closable.
    $<HTMLButtonElement>('modal-ok').disabled = false;
    $('modal-cancel').hidden = !cancel;
    $('modal-cancel').textContent = cancelLabel;
    this.modalAction = action;
    $('modal').hidden = false;
  }

  private tab: Tab = 'home';

  /** Open a tab's section in place of the home panel ('home' closes it). */
  private setTab(tab: Tab) {
    // Coming back to a tab always starts on its main page, not a sub-page left open earlier.
    if (tab !== this.tab) this.resetSubPages();
    this.tab = tab;
    for (const panel of $('panels').querySelectorAll<HTMLElement>('.panel')) panel.hidden = panel.dataset.tab !== tab;
    $('panels').scrollTop = 0;
    for (const btn of $('tabbar').querySelectorAll<HTMLButtonElement>('button')) {
      const on = btn.dataset.tab === tab;
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-current', on ? 'page' : 'false');
    }
    $('home-btn').hidden = tab === 'home';
    if (tab === 'home') {
      this.offlineAt = 0;
      this.renderHome();
    }
    if (tab === 'shop') this.renderRewards();
    if (tab === 'battle') this.renderBattle();
  }

  /** Relics back to the owned list, Battle back to its hub of mode cards (a live fight has its own screen, so it's untouched). */
  private resetSubPages() {
    for (const pane of document.querySelectorAll<HTMLElement>('[data-relic-pane]')) pane.hidden = pane.dataset.relicPane !== 'mine';
    for (const pane of document.querySelectorAll<HTMLElement>('[data-battle-pane]')) pane.hidden = pane.dataset.battlePane !== 'hub';
    this.trialEntered = false;
  }

  private badge(tab: Tab, on: boolean) {
    const b = $('tabbar').querySelector<HTMLElement>(`button[data-tab="${tab}"] .badge`);
    if (b) b.hidden = !on;
  }

  private trialTier = 0;
  private trialPick: Element | null = null;
  /** Whether a Trial's level page is showing (after Enter) instead of the list of all five. */
  private trialEntered = false;

  /** The Trial being looked at: the player's pick if it's open today, else the first open one. */
  private trialEl(): Element {
    const open = this.state.openTrials();
    if (!this.trialPick || !open.includes(this.trialPick)) this.trialPick = open[0];
    return this.trialPick;
  }

  private stepTier(dir: number) {
    const max = this.state.trialUnlocked(this.trialEl());
    this.trialTier = Math.min(max, Math.max(1, this.currentTier() + dir));
    this.renderTrials();
  }

  private currentTier() {
    const max = this.state.trialUnlocked(this.trialEl());
    if (this.trialTier < 1 || this.trialTier > max) this.trialTier = max;
    return this.trialTier;
  }

  private renderTrials() {
    const s = this.state;
    const wait = s.refreshTickets();
    const mm = Math.floor(wait / 60);
    const ss = String(wait % 60).padStart(2, '0');
    const stash = s.boughtTickets ? ` <span class="tr-stash" title="Bought tickets, used after the free ones">+${s.boughtTickets} bought</span>` : '';
    const event = s.trialEventOn() ? ' <span class="tr-event">x2 crests today</span>' : '';
    setHtml($('tr-tickets'), `<i class="ticket"></i>${s.tickets}/${TICKET_CAP}${stash} ${wait ? `<small>next ${mm}:${ss}</small>` : '<small>(Maxed)</small>'}${event}`);
    const open = s.openTrials();
    const unlocked = s.trialsUnlocked();
    // A Trial that closed at midnight (or was never open) drops back to the list.
    if (this.trialEntered && (!unlocked || !this.trialPick || !open.includes(this.trialPick))) this.trialEntered = false;
    $('tr-list').hidden = this.trialEntered;
    $('tr-detail').hidden = !this.trialEntered;
    const medals = s.trialMedals();
    const listKey = `${open.join(',')}:${unlocked}:${medals}`;
    if ($('tr-list').dataset.key !== listKey) {
      $('tr-list').dataset.key = listKey;
      $('tr-list').innerHTML = (unlocked ? '' : '<p class="trial-lock">Trials open once you beat the stage 50 boss.</p>') + TRIAL_ROTATION.map((e) => {
        const isOpen = open.includes(e);
        const days = s.trialDays(e).map((d) => DAY_NAMES[d]).join(', ');
        const face = Object.entries(bossFace(e, 60)).map(([k, v]) => `${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}:${v}`).join(';');
        const btn = unlocked ? 'Enter' : 'Locked';
        return `<div class="trial-entry${isOpen ? ' open' : ''}" style="--el:${hex(ELEMENT_COLORS[e])}">` +
          `<span class="trial-portrait" style="${face}" title="${cap(e)}"></span>` +
          `<div class="trial-entry-text"><b>${TRIAL_BOSS_NAMES[e]} <span>(${days})</span></b>` +
          `<small>Rewards: <i class="ess-${e}" title="${ESSENCE_NAMES[e]}"></i> and <i class="medal" title="${medals} crests for random ${cap(e)} heroes"></i> x${medals}</small></div>` +
          `<button class="trial-enter${isOpen && unlocked ? ' lit' : ''}" data-el="${e}" ${isOpen && unlocked ? '' : 'disabled'} title="${isOpen ? (unlocked ? `Open today` : 'Opens after the stage 50 boss') : `Open ${days}`}">${btn}</button>` +
          `</div>`;
      }).join('');
    }
    setHtml($('tr-ess'), TRIAL_ROTATION.map((e) => `<span style="--el:${hex(ELEMENT_COLORS[e])}" title="${ESSENCE_NAMES[e]}"><i class="ess-${e}"></i>${fmt(s.essences[e] ?? 0)}</span>`).join(''));
    if (!this.trialEntered) return;
    const el = this.trialEl();
    const tier = this.currentTier();
    if ($('tr-detail').dataset.el !== el) {
      $('tr-detail').dataset.el = el;
      const face = $('tr-face');
      face.style.setProperty('--el', hex(ELEMENT_COLORS[el]));
      face.textContent = BOSS_ANIMS[el] ? '' : TRIAL_BOSS_NAMES[el][0];
      Object.assign(face.style, bossFace(el, 48));
      $('tr-name').textContent = `${TRIAL_BOSS_NAMES[el]} (${cap(el)})`;
    }
    const level = TRIAL_LEVELS[tier - 1];
    $('tr-info').textContent = `Uses Ember levels and stars, not gold levels. Drops ${ESSENCE_NAMES[el]} and ${s.trialMedals()} crests, each for a random ${cap(el)} hero.`;
    if ($('tr-medals').dataset.key !== el) {
      $('tr-medals').dataset.key = el;
      const odds = rarityOdds(s.trialPool(el), TRIAL_RARITY_WEIGHTS).map(([r, pct]) => `${cap(r)} ${+pct.toFixed(1)}%`).join(' · ');
      setHtml($('tr-medals'), `Crest odds: ${odds}`);
    }
    $('tr-tier').textContent = `Level ${tier} / ${TRIAL_TIERS}`;
    $<HTMLButtonElement>('tr-down').disabled = tier <= 1;
    $<HTMLButtonElement>('tr-up').disabled = tier >= s.trialUnlocked(el);
    const sim = s.simulateTrial(tier, el);
    const reqMet = s.trialReqMet(tier);
    const req = level.req
      ? `<span class="${reqMet ? 'win' : 'lose'}">Needs ${level.req[0]} heroes at Ember ${level.req[1]}+ (you have ${s.heroesAtEmber(level.req[1])})</span>`
      : 'No hero requirement';
    const best = s.trialTime(el, tier);
    const quickOk = s.canQuickTrial(el, tier);
    const bestLine = best === null
      ? `Win in ${TRIAL_QUICK_TIME}s or less to unlock Quick Battle`
      : `Best clear <b>${best}s</b> · ${quickOk ? '<span class="win">Quick Battle unlocked</span>' : `win in ${TRIAL_QUICK_TIME}s or less to unlock Quick Battle`}`;
    // On the highest open level, say what opens the next one (and what that one will need).
    const top = s.trialUnlocked(el);
    const next = TRIAL_LEVELS[tier];
    const nextReq = next?.req ? ` (it needs ${next.req[0]} heroes at Ember ${next.req[1]}+, you have ${s.heroesAtEmber(next.req[1])})` : '';
    const nextLine = tier < top
      ? ''
      : !next
        ? ((s.trialBest[el] ?? 0) >= TRIAL_TIERS ? '<span class="win">Top level cleared</span><br>' : 'This is the top level<br>')
        : `<b>Win this level to open level ${tier + 1}</b>${nextReq}<br>`;
    $('tr-up').title = tier < top ? `Level ${tier + 1}` : next ? `Win level ${tier} to open level ${tier + 1}` : 'Top level';
    setHtml($('tr-odds'), `Difficulty <b>${level.difficulty.toLocaleString()}</b> · reward <b>${fmt(level.essence)}</b> Essence · ${s.trialMedals()} crests${s.trialEventOn() ? ' (x2 weekend)' : ''}<br>${req}<br>${nextLine}${bestLine}<br>Boss HP <b>${fmt(trialHp(level))}</b> · team damage in ${TRIAL_TIME}s <b>${fmt(sim.dps.times(TRIAL_TIME))}</b> · <span class="${sim.won ? 'win' : 'lose'}">${sim.won ? 'Should be winnable' : 'Too strong for now'}</span>`);
    const fight = $<HTMLButtonElement>('tr-fight');
    const have = s.trialTickets();
    fight.disabled = !unlocked || have <= 0 || !reqMet;
    fight.textContent = !unlocked ? 'Beat the stage 50 boss' : !reqMet ? 'Locked' : have > 0 ? 'Fight · 1 ticket' : 'No tickets';
    const quick = $<HTMLButtonElement>('tr-quick');
    quick.hidden = !unlocked || !reqMet || !quickOk;
    quick.disabled = have <= 0;
    quick.title = 'Quick Battle: skip the fight, same reward as a win for each ticket spent';
    if (!quick.hidden) fight.textContent = have > 0 ? 'Fight' : 'No tickets';
    quick.textContent = 'Quick';
  }

  /** Quick Battle: choose how many tickets to spend on this level at once. */
  private pickQuickCount() {
    const s = this.state;
    s.refreshTickets();
    const tier = this.currentTier();
    const el = this.trialEl();
    const have = s.trialTickets();
    if (!s.canQuickTrial(el, tier) || have <= 0) return;
    const counts = [...new Set([1, 5, 10, s.tickets, have].filter((n) => n >= 1 && n <= have))].sort((a, b) => a - b);
    const buttons = counts.map((n) => `<button type="button" class="wood-btn levelall" data-quick="${n}">${n === have && n > 1 ? `All ${n}` : `x${n}`}</button>`).join('');
    const stash = s.boughtTickets ? ` (${s.tickets} free + ${s.boughtTickets} bought; free ones go first)` : '';
    this.showModal(
      `Quick Battle · Level ${tier}`,
      `<p>Skip the fight and take a win's reward for each ticket. You have <b>${have}</b> ticket${have === 1 ? '' : 's'}${stash}.</p><div class="quick-counts">${buttons}</div>`,
      'Cancel',
    );
    $('modal-body').querySelectorAll<HTMLButtonElement>('[data-quick]').forEach((b) =>
      b.addEventListener('click', () => this.quickTrials(el, tier, Number(b.dataset.quick))),
    );
  }

  private quickTrials(el: Element, tier: number, times: number) {
    const result = this.state.quickTrials(el, tier, times);
    if (!result) return;
    this.showModal(
      `${TRIAL_BOSS_NAMES[el]} · Level ${tier}`,
      `<p class="tf-result win">Quick Battle${result.runs > 1 ? ` x${result.runs}` : ''}! ${this.trialWinText(el, result)}`,
      'Okay',
    );
    play('clear');
    this.render();
  }

  /** Play a Trial: a live fight on its own screen. */
  private fightTrial() {
    const s = this.state;
    const tier = this.currentTier();
    const el = this.trialEl();
    const title = `${TRIAL_BOSS_NAMES[el]} · Level ${tier}`;
    const scene = this.scene();
    if (!scene || scene.inTrial() || !s.canStartTrial(el, tier)) return;
    this.closeSheet();
    document.body.classList.add('in-trial');
    $('trial-hud').hidden = false;
    $('trial-hud-name').textContent = `${title} (${cap(el)})`;
    $('trial-leave').textContent = 'Leave';
    this.trialLeft = false;
    scene.startTrial(el, tier, (won, seconds) => {
      $('trial-leave').textContent = 'Back';
      const result = s.finishTrial(el, tier, won, seconds);
      const html = result?.won
        ? `<p class="tf-result win">Victory in ${seconds}s! ${this.trialWinText(el, result)}`
        : this.trialLeft
          ? `<p class="tf-result lose">You left the Trial. Your ticket was kept.</p>`
          : `<p class="tf-result lose">Defeated. Your ticket was kept. Raise Ember levels or stars and try again.</p>`;
      // Let the last blow and the banner play before the result.
      window.setTimeout(() => {
        if (scene.inTrial()) this.showModal(title, html, 'Okay', () => this.endTrial());
      }, 1200);
      this.render();
    });
  }

  /** Whether the player left the Trial in progress (shown instead of "Defeated"). */
  private trialLeft = false;

  /** Leave the Trial screen and go back to the run. */
  private endTrial() {
    const scene = this.scene();
    if (scene?.inTrial()) scene.closeTrial();
    document.body.classList.remove('in-trial');
    $('trial-hud').hidden = true;
    this.render();
  }

  /** The reward line (closes the caller's open <p>) and pictures of the heroes the crests went to. */
  private trialWinText(el: Element, result: TrialResult) {
    // Group repeats: "Brine x3, Ripple x2".
    const medalCounts = new Map<string, number>();
    for (const id of result.medals) medalCounts.set(id, (medalCounts.get(id) ?? 0) + 1);
    // Pictures of the heroes the crests went to, with how many each got.
    const faces = [...medalCounts].map(([id, n]) => {
      const h = HEROES.find((x) => x.id === id)!;
      return `<span class="trial-medal"><span class="face art" style="${faceStyle(h)}">${HERO_ANIMS[h.id] ? '' : h.name[0]}</span><b>${h.name}</b><small>x${n}</small></span>`;
    }).join('');
    return `+${fmt(result.essence)} ${ESSENCE_NAMES[el]}${result.stones ? ` · +${result.stones} Enhance Stone${result.stones === 1 ? '' : 's'}` : ''} · ${result.medals.length} crest${result.medals.length === 1 ? '' : 's'}:</p><div class="trial-won">${faces}</div>`;
  }

  // ---------- Colosseum ----------

  /** Which Colosseum page shows: the rank and three opponents, one opponent before battle, or a team picker. */
  private pvpView: 'list' | 'foe' | 'team' = 'list';
  private pvpSlot = 0;
  private pvpPickKind: 'attack' | 'defense' = 'attack';
  private pvpPickIds: string[] = [];
  private pvpForecastKey = '';
  /** The Colosseum server link (real opponents, defense log); null until main.ts sets it. */
  private pvpServer: ColosseumLink | null = null;
  private pvpFinding = false;

  setPvpServer(link: ColosseumLink) {
    this.pvpServer = link;
  }

  /** New opponents: real players from the server where there are some, bots for the rest. */
  private async pvpFindOpponents() {
    if (this.pvpFinding) return;
    this.pvpFinding = true;
    try {
      const real = (await this.pvpServer?.candidates().catch(() => [])) ?? [];
      this.state.refreshPvpOpponents(Date.now(), real);
    } finally {
      this.pvpFinding = false;
    }
    if (this.tab === 'battle') this.renderPvp();
  }

  /** Top players and this player's defense log, in a pop-up. */
  private async showPvpBoard() {
    const esc = escHtml;
    const board = await this.pvpServer?.board().catch(() => null);
    if (!board) {
      this.showModal('Colosseum', '<p>Sign in to see the leaderboard and who attacked your defense team. If you are signed in, the server needs supabase/colosseum.sql run once.</p>', 'Okay');
      return;
    }
    const top = board.top.length
      ? board.top.map((r) => `<li${r.isMe ? ' class="me"' : ''}><b>${r.rank}.</b> ${esc(r.username)} <small>${rankName(rankIndex(r.trophies))} · ${r.trophies}</small></li>`).join('')
      : '<li>Nobody yet.</li>';
    const log = board.log.length
      ? board.log.map((l) => `<li>${esc(l.attacker)} ${l.attackerWon ? 'beat your defense' : 'lost to your defense'} <small>${new Date(l.at).toLocaleString()}</small></li>`).join('')
      : '<li>Nobody has attacked your defense team yet.</li>';
    this.showModal('Colosseum', `<h3>Top players</h3><ol class="pvp-list">${top}</ol><h3>Your defense log</h3><ul class="pvp-list">${log}</ul>`, 'Okay');
  }
  private pvpForecastValue: ReturnType<GameState['pvpForecast']> = null;

  private pvpFace(h: HeroDef, stars?: number) {
    const st = stars ?? this.state.stars[h.id] ?? 0;
    return `<span class="face art" title="${h.name} ${st + 1}★" style="${faceStyle(h)};border-color:${hex(ELEMENT_COLORS[h.element])}">${HERO_ANIMS[h.id] ? '' : h.name[0]}</span>`;
  }

  private pvpFoeFaces(foe: PvpOpponent) {
    return foe.heroes.map((x) => this.pvpFace(HEROES.find((h) => h.id === x.id)!, x.stars)).join('');
  }

  private renderPvp() {
    const s = this.state;
    s.pvpTick();
    const p = s.pvp;
    const wait = s.refreshPvpTickets();
    const mm = Math.floor(wait / 3600);
    const m2 = String(Math.floor((wait % 3600) / 60)).padStart(2, '0');
    setHtml($('pvp-tickets'), s.pvpOpen() ? `<i class="ticket"></i>${p.tickets}/${PVP_TICKET_CAP} ${wait ? `<small>next ${mm}:${m2}</small>` : '<small>(Maxed)</small>'}` : '');
    if (!s.pvpOpen()) {
      setHtml($('pvp'), `<p>Fight other players' teams, climb from Bronze to Legend and earn Starmotes for pink awakening stars.</p><small>Opens at player level ${s.pvpUnlockLevel()}. You are level ${s.keeperLevel()}.</small>`);
      return;
    }
    if (!p.picks.length) {
      void this.pvpFindOpponents();
      setHtml($('pvp'), '<p>Finding opponents…</p>');
      return;
    }
    if (this.pvpView === 'team') return setHtml($('pvp'), this.pvpTeamHtml());
    if (this.pvpView === 'foe' && p.picks[this.pvpSlot]) return setHtml($('pvp'), this.pvpFoeHtml(this.pvpSlot));
    this.pvpView = 'list';
    const r = rankIndex(p.trophies);
    const next = r < LEGEND ? RANK_TROPHIES[r + 1] : null;
    const fill = next === null ? 100 : ((p.trophies - RANK_TROPHIES[r]) / (next - RANK_TROPHIES[r])) * 100;
    const refreshIn = Math.max(0, Math.ceil((p.refreshAt - Date.now()) / 1000));
    const notes = p.notes.length ? `<div class="pvp-notes">${p.notes.map((n) => `<span>${n}</span>`).join('')}<button class="wood-btn small" data-pvp="notes-ok">Got it</button></div>` : '';
    const foes = p.picks
      .map(
        (foe, i) => `<button class="pvp-foe" data-pvp="foe" data-slot="${i}">
          <div class="who"><b>${escHtml(foe.name)}</b><span><small>CP ${fmt(new Decimal(foe.cp))}</small></span><span class="faces">${this.pvpFoeFaces(foe)}</span></div>
          <div class="pvp-pay">Win: +${PVP_WIN_TROPHIES} trophies<br>+${PVP_WIN_MOTES} Starmotes</div>
        </button>`,
      )
      .join('');
    const buys = s.pvpBuysLeft();
    const ticketBtn = p.tickets <= 0 && buys > 0 ? `<button class="wood-btn small gem-btn" data-pvp="buy" ${s.gems < PVP_TICKET_GEMS ? 'disabled' : ''}>+1 ticket (${PVP_TICKET_GEMS} Gems, ${buys} left today)</button>` : '';
    setHtml(
      $('pvp'),
      `${notes}
      <div class="pvp-rank"><div style="flex:1"><div class="badge-rank">${rankName(r)}</div><small>${p.trophies} trophies${next === null ? '' : ` · ${next - p.trophies} to ${rankName(r + 1)}`}</small><div class="pvp-bar"><div style="width:${fill}%"></div></div></div>
        <div class="pvp-pay">${s.starmotes} Starmotes<br><small>${p.wins}W ${p.losses}L${p.streak ? ` · streak ${p.streak} (+${Math.round(s.pvpStreakBonus() * 100)}% dmg)` : ''}</small></div></div>
      <small>Daily ${RANK_DAILY[r]} · Weekly ${RANK_WEEKLY[r]} Starmotes at this rank. On Monday the weekly reward pays, then you drop to ${rankName(rankIndex(droppedTrophies(p.trophies)))}.</small>
      ${foes}
      <div class="pvp-row"><button class="wood-btn small" data-pvp="board">Leaderboard &amp; log</button><button class="wood-btn small" data-pvp="refresh" ${refreshIn ? 'disabled' : ''}>${refreshIn ? `New opponents in ${Math.floor(refreshIn / 60)}:${String(refreshIn % 60).padStart(2, '0')}` : 'New opponents'}</button>${ticketBtn}</div>
      <div class="pvp-team"><div class="pvp-row"><b>Defense team</b><button class="wood-btn small" data-pvp="team" data-kind="defense">Edit</button></div><span class="faces">${s.pvpDefenseTeam().map((h) => this.pvpFace(h)).join('')}</span><small>Other players fight this team. Losing on defense never costs trophies.</small></div>`,
    );
  }

  private pvpFoeHtml(slot: number) {
    const s = this.state;
    const foe = s.pvp.picks[slot];
    const team = s.pvpAttackTeam();
    const mine = s.teamCpOf(team);
    // The forecast runs a whole fight, so it is worked out once per opponent, team and streak.
    const key = `${s.pvp.refreshes}:${slot}:${team.map((h) => h.id).join(',')}:${s.pvp.streak}`;
    if (this.pvpForecastKey !== key) {
      this.pvpForecastKey = key;
      this.pvpForecastValue = s.pvpForecast(slot);
    }
    const fc = this.pvpForecastValue;
    // Only a rough read: the live battle (respawns, crystals, Ultimates) can go either way unless one side is far ahead.
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
    const forecast = !fc ? '' : fc.won && avg(fc.left[0]) > 0.6 ? ['win', 'Looks winnable.'] : !fc.won && avg(fc.left[1]) > 0.6 ? ['lose', 'Looks tough. Try other elements or a stronger team.'] : ['close', 'Could go either way.'];
    const can = s.canStartPvp(slot);
    return `<div class="pvp-row"><button class="wood-btn small" data-pvp="back">‹ Back</button></div>
      <div class="pvp-team"><b>${escHtml(foe.name)} <small>CP ${fmt(new Decimal(foe.cp))}</small></b><span class="faces">${this.pvpFoeFaces(foe)}</span></div>
      <div class="pvp-team"><div class="pvp-row"><b>Your attack team <small>CP ${fmt(mine)}</small></b><button class="wood-btn small" data-pvp="team" data-kind="attack">Change</button></div><span class="faces">${team.map((h) => this.pvpFace(h)).join('')}</span></div>
      ${forecast ? `<small class="pvp-forecast ${forecast[0]}">${forecast[1]}</small>` : ''}
      <small>Your team starts at the blue crystal and theirs at the red one. Fallen fighters come back after 10 seconds. The first crystal destroyed loses. Win: +${PVP_WIN_TROPHIES} trophies and ${PVP_WIN_MOTES} Starmotes. Loss: -${PVP_LOSS_TROPHIES} trophies, ${PVP_LOSS_MOTES} Starmote.</small>
      <button class="wood-btn levelall" data-pvp="fight" ${can ? '' : 'disabled'}>${s.pvp.tickets > 0 ? 'Battle! (1 ticket)' : 'No tickets left'}</button>`;
  }

  private pvpTeamHtml() {
    const s = this.state;
    const owned = HEROES.filter((h) => (s.levels[h.id] ?? 0) > 0).sort((a, b) => s.heroCombatPower(b).cmp(s.heroCombatPower(a)));
    const picks = owned
      .map((h) => `<button class="${this.pvpPickIds.includes(h.id) ? 'on' : ''}" data-pvp="pick" data-id="${h.id}">${this.pvpFace(h)}<span>${h.name}</span><small>${fmt(s.heroCombatPower(h))}</small></button>`)
      .join('');
    return `<div class="pvp-row"><b>${this.pvpPickKind === 'attack' ? 'Attack' : 'Defense'} team ${this.pvpPickIds.length}/${s.teamSlots}</b><small>CP ${fmt(s.teamCpOf(owned.filter((h) => this.pvpPickIds.includes(h.id))))}</small></div>
      <small>Pick up to ${s.teamSlots} heroes. They fight at their Ember levels, stars and relics (gold levels don't count).</small>
      <div class="pvp-pick">${picks}</div>
      <div class="pvp-row"><button class="wood-btn small" data-pvp="team-cancel">Cancel</button><button class="wood-btn small levelall" data-pvp="team-save" ${this.pvpPickIds.length ? '' : 'disabled'}>Save team</button></div>`;
  }

  private onPvpClick(e: Event) {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-pvp]');
    if (!btn || (btn as HTMLButtonElement).disabled) return;
    const s = this.state;
    switch (btn.dataset.pvp) {
      case 'foe':
        this.pvpSlot = Number(btn.dataset.slot);
        this.pvpView = 'foe';
        break;
      case 'back':
        this.pvpView = 'list';
        break;
      case 'refresh':
        if (Date.now() >= s.pvp.refreshAt) {
          s.pvp.picks = [];
          void this.pvpFindOpponents();
        }
        break;
      case 'board':
        void this.showPvpBoard();
        return;
      case 'buy':
        if (s.buyPvpTicket()) play('unlock');
        break;
      case 'notes-ok':
        s.pvp.notes = [];
        s.save();
        break;
      case 'team':
        this.pvpPickKind = btn.dataset.kind === 'defense' ? 'defense' : 'attack';
        this.pvpPickIds = (this.pvpPickKind === 'attack' ? s.pvpAttackTeam() : s.pvpDefenseTeam()).map((h) => h.id);
        this.pvpView = 'team';
        break;
      case 'pick': {
        const id = btn.dataset.id!;
        if (this.pvpPickIds.includes(id)) this.pvpPickIds = this.pvpPickIds.filter((x) => x !== id);
        else if (this.pvpPickIds.length < s.teamSlots) this.pvpPickIds.push(id);
        break;
      }
      case 'team-cancel':
        this.pvpView = this.pvpPickKind === 'attack' ? 'foe' : 'list';
        break;
      case 'team-save':
        s.setPvpTeam(this.pvpPickKind, this.pvpPickIds);
        if (this.pvpPickKind === 'defense') void this.pvpServer?.report(true);
        this.pvpView = this.pvpPickKind === 'attack' ? 'foe' : 'list';
        break;
      case 'fight':
        this.fightPvp(this.pvpSlot);
        return;
    }
    this.renderPvp();
  }

  /** Start a live Colosseum battle on the lane. */
  private fightPvp(slot: number) {
    const s = this.state;
    const scene = this.scene();
    if (!scene || scene.inTrial() || scene.inPvp() || !s.canStartPvp(slot)) return;
    const bonus = s.pvpStreakBonus();
    const ids = s.pvpAttackTeam().map((h) => h.id);
    const foe = s.startPvp(slot);
    if (!foe) return;
    this.closeSheet();
    document.body.classList.add('in-trial');
    $('trial-hud').hidden = false;
    $('trial-hud-name').textContent = `Colosseum vs ${foe.name}`;
    const defender = foe.userId;
    $('trial-hud-note').textContent = 'Fighters fight at their Ember levels and get back up after 10 seconds. Destroy the red crystal before they destroy yours.';
    $('trial-leave').textContent = 'Leave';
    scene.startPvp(ids, s.pvpFoeUnits(foe).map((f) => ({ def: f.def, stats: f.stats })), bonus, (won) => {
      $('trial-leave').textContent = 'Back';
      const r = s.finishPvp(won);
      if (defender) void this.pvpServer?.reportFight(defender, won);
      const html = !r
        ? ''
        : `<p class="tf-result ${r.won ? 'win' : 'lose'}">${r.won ? 'Victory!' : 'Defeat.'} ${r.trophies > 0 ? `+${r.trophies} trophies` : r.trophies < 0 ? `${r.trophies} trophies` : 'No trophies lost'} · +${r.starmotes} Starmote${r.starmotes === 1 ? '' : 's'}${r.firstWin ? ' (first win today +10)' : ''}</p>${r.rankAfter !== r.rankBefore ? `<p>${r.rankAfter > r.rankBefore ? 'Ranked up' : 'Dropped'} to <b>${rankName(r.rankAfter)}</b>!</p>` : ''}`;
      this.pvpView = 'list';
      window.setTimeout(() => {
        if (scene.inPvp()) this.showModal('Colosseum', html, 'Okay', () => this.endPvpScreen());
      }, 1200);
      this.render();
    });
  }

  /** The battle meter under the Colosseum or Trial lane: damage dealt, taken and healed by each fighter so far. */
  private renderPvpMeter() {
    const box = $('pvp-meter');
    const m = this.scene()?.battleMeter() ?? null;
    box.hidden = !m;
    if (!m) return;
    const kinds = [
      ['dealt', 'Dealt'],
      ['taken', 'Taken'],
      ['healed', 'Healed'],
    ] as const;
    const top = Object.fromEntries(kinds.map(([k]) => [k, m.mine.reduce((x, r) => Decimal.max(x, r[k]), new Decimal(0))])) as Record<(typeof kinds)[number][0], Decimal>;
    const share = (v: Decimal, max: Decimal) => (max.gt(0) ? Math.round(v.div(max).toNumber() * 100) : 0);
    const rows = m.mine
      .map((r) => {
        const def = HEROES.find((h) => h.id === r.id);
        if (!def) return '';
        const bars = kinds.map(([k]) => `<div class="pm-bar ${k}"><i style="width:${share(r[k], top[k])}%"></i><span>${fmt(r[k])}</span></div>`).join('');
        return `<div class="pm-row"><span class="face art" style="${faceStyle(def)}">${HERO_ANIMS[def.id] ? '' : def.name[0]}</span><b>${def.name}</b>${bars}</div>`;
      })
      .join('');
    const sum = (k: (typeof kinds)[number][0]) => m.mine.reduce((x, r) => x.plus(r[k]), new Decimal(0));
    const html = `<div class="pm-head"><span></span><span></span>${kinds.map(([, n]) => `<span>${n}</span>`).join('')}</div>${rows}
      <div class="pm-total"><span>Your team</span>${kinds.map(([k]) => `<span class="${k}">${fmt(sum(k))}</span>`).join('')}</div>
      <div class="pm-total foes"><span>${m.trial ? 'Boss' : 'Their team'}</span>${kinds.map(([k]) => `<span class="${k}">${fmt(m.foes[k])}</span>`).join('')}</div>`;
    if (box.innerHTML !== html) box.innerHTML = html;
  }

  /** Leave the battle screen and go back to the run. */
  private endPvpScreen() {
    const scene = this.scene();
    if (scene?.inPvp()) scene.closePvp();
    document.body.classList.remove('in-trial');
    $('trial-hud').hidden = true;
    $('trial-hud-note').textContent = 'Your team fights at its Ember levels. Fallen heroes stay down until the Trial ends. Beat the boss before time runs out.';
    this.render();
  }

  private renderBattle() {
    this.renderTrials();
    this.renderPvp();
    const s = this.state;
    const open = s.openTrials();
    const trialsOn = s.trialsUnlocked();
    $('hub-tr-tickets').textContent = `${s.tickets}/${TICKET_CAP}${s.boughtTickets ? ` +${s.boughtTickets}` : ''}`;
    const all = open.length === TRIAL_ROTATION.length ? 'all elements' : open.map(cap).join(', ');
    $('hub-tr-note').textContent = trialsOn ? (open.length ? `${s.trialEventOn() ? 'x2 crests! ' : ''}Open today: ${all}` : 'None open today') : 'Opens after the stage 50 boss';
    $('hub-tr-alert').hidden = !(trialsOn && open.length && s.trialTickets() > 0);
    const pvpOn = s.pvpOpen();
    $('hub-pvp-tickets').textContent = pvpOn ? `${s.pvp.tickets}/${PVP_TICKET_CAP}` : '-';
    $('hub-pvp-note').textContent = pvpOn ? `${rankName(rankIndex(s.pvp.trophies))} · ${s.pvp.trophies} trophies` : `Opens at player level ${s.pvpUnlockLevel()}`;
    $('hub-pvp-alert').hidden = !(pvpOn && s.pvp.tickets > 0);
  }

  /** The Rekindle rewards page: what this Rekindle pays and what it moves forward. */
  private openRekindle() {
    if (!this.state.canRekindle()) return;
    this.renderRekindle();
    $('rk').hidden = false;
  }

  private closeRekindle() {
    $('rk').hidden = true;
  }

  private renderRekindle() {
    const s = this.state;
    const base = s.pendingEmbers();
    $('rk-embers').textContent = `+${fmt(base)}`;
    $('rk-stage').textContent = s.runBestStage.toLocaleString();
    const stageBonus = emberStageBonus(s.runBestStage, REKINDLE_STAGE);
    $('rk-stagebonus').textContent = `x${stageBonus < 100 ? stageBonus.toFixed(2) : fmt(stageBonus)}`;
    $('rk-keeperbonus').textContent = `x${s.keeperBonus().toFixed(2)}`;

    const plus = (r: number) => `+${Math.round(r * 100)}%`;
    $('rk-mr-rev').textContent = `${plus(STALL_REKINDLE_REVENUE * s.rekindles)} → ${plus(STALL_REKINDLE_REVENUE * (s.rekindles + 1))}`;
    $('rk-mr-lv').textContent = `+${s.stallBonusLevels()} → +${Math.min(STALL_REKINDLE_LEVELS_CAP, STALL_REKINDLE_LEVELS * (s.rekindles + 1))}`;
    const reached = s.roadReached();
    $('rk-road-count').textContent = `${reached}/${ROAD_LENGTH}`;
    setHtml($('rk-dots'), Array.from({ length: ROAD_LENGTH }, (_, i) => {
      const cls = i < reached ? 'on' : i === reached ? 'next' : '';
      return `<i class="${cls}" title="Stage ${ROAD_START + i * ROAD_STEP}"></i>`;
    }).join(''));
    $('rk-road-gems').textContent = reached > 0 ? `${reached} spin${reached === 1 ? '' : 's'}` : '';
    $('rk-road-next').textContent =
      (reached < ROAD_LENGTH ? `Next unlock at stage ${(ROAD_START + reached * ROAD_STEP).toLocaleString()} this run. ` : 'Every slot unlocked. ') +
      'Each slot spins the wheel once when you Rekindle: Trial tickets, Trial Essence, Enhance Stones or extra Embers.';

    const level = s.keeperLevel();
    const from = level === 1 ? 0 : keeperThreshold(level - 1);
    const to = keeperThreshold(level);
    const pct = (v: number) => `${Math.max(0, Math.min(100, ((v - from) / (to - from)) * 100))}%`;
    $('rk-level').textContent = String(level);
    $('rk-nextlvl').textContent = `Lv ${level + 1}: Embers x${(s.keeperBonus() + KEEPER_BONUS_PER_LEVEL).toFixed(2)} + 🎁 ${LEVEL_GIFT_STONES} Enhance Stones`;
    $('rk-bar-fill').style.width = pct(s.lifetimeEmbers);
    $('rk-bar-gain').style.width = pct(s.lifetimeEmbers + base);
    $('rk-bar-now').textContent = `Lifetime Embers: ${fmt(s.lifetimeEmbers)}`;
    $('rk-bar-next').textContent = fmt(to);

    const buttons = [
      `<button class="go" data-mult="1"><small>+${fmt(base)} Embers</small>Rekindle</button>`,
      ...REKINDLE_BOOSTS.map(
        (b) =>
          `<button class="boost" data-mult="${b.mult}" ${s.gems < b.gems ? 'disabled' : ''}><small>+${fmt(base * b.mult)} Embers</small>${b.mult}x<span class="gemcost">${b.gems} Gems</span></button>`,
      ),
    ];
    setHtml($('rk-buttons'), buttons.join(''));
    const head = s.headStartStage();
    $('rk-head').hidden = head <= 1;
    $<HTMLInputElement>('rk-head-on').checked = s.headStart;
    setHtml($('rk-head-text'), `Head start: begin the next run at <b>stage ${head.toLocaleString()}</b>. Wheel slots only count stages you clear, and Rekindle opens ${HEAD_START_MIN_PUSH} stages past the start.`);
    const start = head > 1 && s.headStart ? head : 1;
    $('rk-reset-note').textContent = `You go back to stage ${start.toLocaleString()} and every hero drops to gold level 1. Embers, Ember levels, stars and Gems stay.`;
  }

  // ---------- free rewards (Shop tab) ----------

  private spinning = false;

  private bindRewards() {
    // Fortune Wheel: equal slices, labels turned to face out.
    const n = SPIN_SLICES.length;
    const deg = 360 / n;
    const wheel = $('spin-wheel');
    wheel.style.background = `conic-gradient(${SPIN_SLICES.map((sl, i) => `${sl.color} ${i * deg}deg ${(i + 1) * deg}deg`).join(',')})`;
    wheel.innerHTML = SPIN_SLICES.map((sl, i) => `<span style="transform:rotate(${i * deg + deg / 2}deg)"><em>${sliceLabel(sl.reward)}</em></span>`).join('');

    $('login-claim').addEventListener('click', () => {
      const day = this.state.loginState().day;
      const got = this.state.claimLogin();
      if (!got) return;
      play('chest');
      this.scene()?.syncHeroes();
      this.showReward(`Day ${day + 1} reward`, LOGIN_CYCLE[day], got);
      this.render();
    });
    $('spin-btn').addEventListener('click', () => {
      if (this.spinning) return;
      const got = this.state.spin();
      if (!got) return;
      this.spinning = true;
      play('coin');
      // Five full turns, then stop with the winning slice under the pointer at the top.
      const prev = Number(wheel.dataset.turn ?? 0);
      const target = Math.ceil(prev / 360) * 360 + 5 * 360 + (360 - (got.index * deg + deg / 2));
      wheel.dataset.turn = String(target);
      wheel.style.transform = `rotate(${target}deg)`;
      window.setTimeout(() => {
        this.spinning = false;
        play('chest');
        this.scene()?.syncHeroes();
        this.showReward('Fortune Wheel', SPIN_SLICES[got.index].reward, got);
        this.render();
      }, 3200);
      this.render();
    });
    $('bundle-claim').addEventListener('click', () => {
      const drops = this.state.claimMedalBundle();
      if (!drops) return;
      play('chest');
      this.scene()?.syncHeroes();
      this.showModal('Daily Crest Bundle', `${dropCards(drops)}Come back tomorrow for a new bundle.`, 'Collect');
      this.render();
    });
    $('ms-claim').addEventListener('click', () => {
      const got = this.state.claimMilestones();
      if (!got) return;
      play('chest');
      this.scene()?.syncHeroes();
      const paid = milestoneText({ chests: got.chests, stones: got.stones, tickets: got.tickets, goldMinutes: 0 });
      const gold = got.gold.gt(0) ? `${paid ? ' + ' : ''}${fmt(got.gold)} gold` : '';
      const what = got.count === 1 ? 'a Stage Milestone' : `${got.count} Stage Milestones`;
      this.showModal('Stage Milestone', `You claimed ${what}: <b>${paid}${gold}</b>.${dropCards(got.drops)}`, 'Collect');
      this.render();
    });
    $('rewards').addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-claim]');
      if (!btn || btn.disabled) return;
      const [kind, id] = btn.dataset.claim!.split(':');
      const ok =
        kind === 'daily' ? this.state.claimDaily(id as (typeof DAILIES)[number]['stat']) : kind === 'ach' ? this.state.claimAchievement(id) : this.state.claimBootcamp(id);
      if (ok) {
        play('coin');
        this.render();
      }
    });
  }

  private showReward(title: string, reward: Reward, got: { gold: Decimal; drops: SummonDrop[] }) {
    const gold = got.gold.gt(0) ? ` (${fmt(got.gold)} gold)` : '';
    this.showModal(title, `You got <b>${rewardText(reward)}</b>${gold}.${dropCards(got.drops)}`, 'Collect');
  }

  /** One list row per goal, built once and updated in place so a tap never lands on a replaced button. */
  private rewardRows = new Map<string, { li: HTMLElement; text: HTMLElement; fill: HTMLElement; meta: HTMLElement; button: HTMLButtonElement }>();

  private rewardRow(list: HTMLElement, key: string, text: string, progress: number, goal: number, meta: string, state: 'claim' | 'wait' | 'done' | 'hide') {
    let row = this.rewardRows.get(key);
    if (!row) {
      const li = document.createElement('li');
      li.innerHTML = `<div class="rw-text"><span></span><div class="rw-bar"><i></i></div><small></small></div><button class="gem-btn" data-claim="${key}">Claim</button>`;
      list.appendChild(li);
      row = { li, text: li.querySelector('span')!, fill: li.querySelector('i')!, meta: li.querySelector('small')!, button: li.querySelector('button')! };
      this.rewardRows.set(key, row);
    }
    row.li.hidden = state === 'hide';
    if (row.text.textContent !== text) row.text.textContent = text;
    row.fill.style.width = `${Math.min(100, (progress / Math.max(1, goal)) * 100)}%`;
    if (row.meta.textContent !== meta) row.meta.textContent = meta;
    row.button.disabled = state !== 'claim';
    row.button.textContent = state === 'done' ? 'Done' : 'Claim';
    row.li.classList.toggle('ready', state === 'claim');
    row.li.classList.toggle('done', state === 'done');
  }

  /** Crest pack: pick any hero (not Legendary), then confirm. */
  private pickMedalPack() {
    const s = this.state;
    const faces = SHOP_HEROES.map((h) => {
      const owned = (s.levels[h.id] ?? 0) > 0;
      return `<button type="button" class="g-pick" data-hero="${h.id}"><span class="face art" style="${faceStyle(h)}">${h.name[0]}</span><b>${h.name}</b><small>${owned ? '' : 'Locked · '}${medalPackCost(h.id)} Gems</small></button>`;
    }).join('');
    this.showModal(
      'Crest pack',
      `<p>${MEDAL_PACK.medals} crests for the hero you pick: Common ${MEDAL_PACK.gems.common}, Rare ${MEDAL_PACK.gems.rare}, Epic ${MEDAL_PACK.gems.epic} Gems. You have ${s.gems.toLocaleString()} Gems.</p><div class="g-picks">${faces}</div>`,
      'Cancel',
    );
    $('modal-body').querySelectorAll<HTMLButtonElement>('.g-pick').forEach((btn) =>
      btn.addEventListener('click', () => {
        const h = HEROES.find((x) => x.id === btn.dataset.hero)!;
        const cost = medalPackCost(h.id)!;
        const afford = s.gems >= cost;
        this.showModal(
          `Crests for ${h.name}`,
          `<p>${MEDAL_PACK.medals} ${h.name} crests for ${cost} Gems. You have ${s.gems.toLocaleString()}${afford ? '' : `, ${cost - s.gems} short`}.</p>`,
          afford ? `Buy · ${cost} Gems` : 'Okay',
          afford
            ? () => {
                const drops = s.buyMedalPack(h.id);
                if (!drops) return;
                play('chest');
                this.scene()?.syncHeroes();
                this.showModal('Crest pack', `${dropCards(drops)}Bought with Gems.`, 'Collect');
                this.render();
              }
            : null,
          afford,
          'Cancel',
        );
      }),
    );
  }

  /** The Hero Shop card: this week's featured hero, the rotating offers and the crest pack button. */
  private renderHeroShop(now: number) {
    const s = this.state;
    const gems = s.gems;
    const face = (h: HeroDef) => `<span class="face art" style="${faceStyle(h)}">${h.name[0]}</span>`;
    const f = s.featuredState(now);
    const bundle = (kind: 'small' | 'big', b: { medals: number; gems: number }, label: string) =>
      `<button type="button" class="gem-btn" data-hs="featured:${kind}" ${f[kind] || gems < b.gems ? 'disabled' : ''}>${f[kind] ? 'Bought' : `${label} · ${b.medals} crests<small>${b.gems} Gems</small>`}</button>`;
    setHtml(
      $('hs-featured'),
      `${face(f.hero)}<div class="hs-feat-text"><b>Featured: ${f.hero.name}</b><small>${cap(f.hero.rarity)} · ${cap(f.hero.element)}. A new hero every Monday; every hero comes back in turn.</small></div>
      <div class="hs-feat-buy">${bundle('small', FEATURED_BUNDLE, 'Bundle')}${f.bigWeek ? bundle('big', FEATURED_BIG_BUNDLE, 'Big bundle') : ''}</div>`,
    );
    const shop = s.heroShopState(now);
    setHtml(
      $('hs-offers'),
      shop.offers
        .map((o, i) => {
          const h = HEROES.find((x) => x.id === o.heroId)!;
          return `<div class="g-offer${o.bought ? ' done' : ''}">${face(h)}<b>${h.name}</b><small>${o.medals} crests</small><button type="button" class="gem-btn" data-hs="offer:${i}" ${o.bought || gems < o.gems ? 'disabled' : ''}>${o.bought ? 'Bought' : `${o.gems} <span class="gem"></span>`}</button></div>`;
        })
        .join(''),
    );
    const mins = Math.max(1, Math.ceil(shop.refreshIn / 60_000));
    $('hs-note').textContent = `new heroes in ${mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`}`;
    const rf = $<HTMLButtonElement>('hs-refresh');
    rf.disabled = gems < HERO_SHOP_REFRESH_GEMS;
    setHtml(rf, `Refresh now · ${HERO_SHOP_REFRESH_GEMS} <span class="gem"></span>`);
    setHtml($('hs-pack'), `Pick a hero · ${MEDAL_PACK.medals} crests from ${MEDAL_PACK.gems.common} <span class="gem"></span>`);
    const deal = s.dealState(now);
    const left = deal.endsAt - now;
    const ends = left >= 86_400_000 ? `${Math.floor(left / 86_400_000)}d ${Math.floor((left % 86_400_000) / 3_600_000)}h` : `${Math.floor(left / 3_600_000)}h ${Math.ceil((left % 3_600_000) / 60_000)}m`;
    const crateRoom = deal.kind !== 'crate' || s.boughtTickets + TICKET_CRATE.tickets <= BOUGHT_TICKET_CAP;
    const what = deal.kind === 'crate'
      ? `<b>Ticket Crate</b><small>${TICKET_CRATE.tickets} Trial tickets into your bought stash, saved for this weekend's x${TRIAL_EVENT_MEDAL_MULT} crest Trials.${crateRoom ? '' : ` Stash too full (${s.boughtTickets}/${BOUGHT_TICKET_CAP}).`}</small>`
      : `<b>Hero Voucher</b><small>Pick any hero when you use it: Common ${HERO_VOUCHER.medals.common}, Rare ${HERO_VOUCHER.medals.rare} or Epic ${HERO_VOUCHER.medals.epic} crests. Keeps until used.</small>`;
    const buy = `<button type="button" class="gem-btn" data-deal="buy" ${deal.bought || gems < deal.gems || !crateRoom ? 'disabled' : ''}>${deal.bought ? 'Bought' : `${deal.gems} <span class="gem"></span>`}</button>`;
    const use = s.vouchers > 0 ? `<button type="button" class="wood-btn" data-deal="use">Use Hero Voucher (${s.vouchers})</button>` : '';
    setHtml($('hs-deal'), `<div class="deal-head"><div><span class="deal-tag">Limited deal · ends in ${ends}</span>${what}</div>${buy}</div>${use}`);
    // The Ascendant Chest: only while an Ascendant hero that beats this week's Guild Boss is out.
    const asc = s.ascendantChestState(now);
    $('hs-asc').hidden = !asc;
    if (asc) {
      const h = asc.hero;
      const n = asc.next;
      const leftMs = asc.endsAt - now;
      const ascBuy = `<button type="button" class="gem-btn" data-asc="buy" ${!n || gems < n.gems ? 'disabled' : ''}>${n ? `${n.gems} <span class="gem"></span>` : 'Sold out'}</button>`;
      setHtml(
        $('hs-asc'),
        `<div class="deal-head">${face(h)}<div><span class="deal-tag">Ascendant Chest · ${cap(asc.boss)} boss week · ends in ${leftMs >= 86_400_000 ? `${Math.floor(leftMs / 86_400_000)}d ${Math.floor((leftMs % 86_400_000) / 3_600_000)}h` : `${Math.floor(leftMs / 3_600_000)}h ${Math.ceil((leftMs % 3_600_000) / 60_000)}m`}</span><b>${h.name}</b><small>${n ? `${n.crests} ${h.name} crests plus a Hero Chest's crests for other heroes. Bought ${asc.bought} this week; each one costs more and gives more ${h.name} crests. Prices reset Monday.` : 'All chests bought this week. Prices reset Monday.'}</small></div>${ascBuy}</div>`,
      );
    }
  }

  /** Spend a Hero Voucher: pick any non-Legendary hero, fewer medals for rarer ones. */
  private pickVoucherHero() {
    const s = this.state;
    if (s.vouchers <= 0) return;
    const faces = SHOP_HEROES.map((h) => {
      const owned = (s.levels[h.id] ?? 0) > 0;
      return `<button type="button" class="g-pick" data-hero="${h.id}"><span class="face art" style="${faceStyle(h)}">${h.name[0]}</span><b>${h.name}</b><small>${owned ? '' : 'Locked · '}${s.voucherMedals(h.id)} crests</small></button>`;
    }).join('');
    this.showModal('Hero Voucher', `<p>Pick the hero who gets the crests. You have ${s.vouchers} voucher${s.vouchers === 1 ? '' : 's'}.</p><div class="g-picks">${faces}</div>`, 'Cancel');
    $('modal-body').querySelectorAll<HTMLButtonElement>('.g-pick').forEach((btn) =>
      btn.addEventListener('click', () => {
        const h = HEROES.find((x) => x.id === btn.dataset.hero)!;
        this.showModal(`Voucher for ${h.name}?`, `<p>${s.voucherMedals(h.id)} ${h.name} crests for 1 Hero Voucher.</p>`, 'Use voucher', () => {
          const drops = s.useVoucher(h.id);
          if (!drops) return;
          play('chest');
          this.scene()?.syncHeroes();
          this.showModal('Hero Voucher', `${dropCards(drops)}`, 'Collect');
          this.render();
        }, true, 'Cancel');
      }),
    );
  }

  /** Settings > Events: four weeks of open Trials, double-medal weekends and the weekly deals. */
  private showCalendar() {
    const s = this.state;
    const now = Date.now();
    const monday = new Date(now);
    monday.setHours(12, 0, 0, 0);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const days = s.calendar(28, monday.getTime());
    const today = new Date(now).toDateString();
    const head = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => `<span class="cal-h">${d}</span>`).join('');
    const cells = days.map((d) => {
      const date = new Date(d.date);
      const past = d.date + 86_400_000 <= now;
      const dots = d.open.map((e) => `<i style="background:${hex(ELEMENT_COLORS[e])}" title="${cap(e)}"></i>`).join('');
      const cls = `cal-day${past ? ' past' : ''}${date.toDateString() === today ? ' today' : ''}${d.double ? ' double' : ''}`;
      return `<div class="${cls}"><b>${date.getDate()}</b><span class="cal-dots">${dots}</span>${d.double ? '<span class="cal-x2">x2</span>' : ''}</div>`;
    }).join('');
    const fmtDay = (t: number) => new Date(t).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
    const ev = s.nextTrialEvent(now);
    const evLine = ev.start <= now ? `<b>Now:</b> x${TRIAL_EVENT_MEDAL_MULT} Trial crests until ${fmtDay(ev.end - 1)}` : `<b>Next x${TRIAL_EVENT_MEDAL_MULT} Trial crests:</b> ${fmtDay(ev.start)} to ${fmtDay(ev.end - 1)}`;
    const deals: string[] = [];
    for (let w = 0; w < 4; w++) {
      const t = monday.getTime() + w * 7 * 86_400_000;
      const d = s.dealState(t);
      deals.push(`<li>${fmtDay(t)} to ${fmtDay(t + 6 * 86_400_000)}: ${d.kind === 'crate' ? `Ticket Crate (${TICKET_CRATE.tickets} tickets)` : 'Hero Voucher'}, ${d.gems} Gems</li>`);
    }
    const legend = TRIAL_ROTATION.map((e) => `<li><i style="background:${hex(ELEMENT_COLORS[e])}"></i>${cap(e)}</li>`).join('');
    this.showModal(
      'Events',
      `<p>${evLine}. Every other weekend, Trials pay x${TRIAL_EVENT_MEDAL_MULT} crests.</p>
      <div class="cal-grid">${head}${cells}</div>
      <ul class="cal-legend">${legend}<li><span class="cal-x2">x2</span> double crests</li></ul>
      <p>Dots show which Trials are open. On Light and Dark days every Trial is open.</p>
      <h3>Limited deals</h3><ul class="cal-list">${deals.join('')}</ul>`,
      'Close',
    );
  }

  /** The Gem Shop rows: what each costs, what it gives and whether it can be bought now. */
  private renderGemShop(now: number) {
    const s = this.state;
    const left = s.hourglassesLeft(now);
    $('gs-hourglass-note').textContent = `${HOURGLASS_MINUTES / 60} hours of gold now (about ${fmt(s.goldFor(HOURGLASS_MINUTES))}). ${left}/${HOURGLASS_PER_DAY} left today.`;
    const hg = $<HTMLButtonElement>('gs-hourglass');
    hg.disabled = left <= 0 || s.gems < HOURGLASS_GEMS;
    setHtml(hg, `${HOURGLASS_GEMS} <span class="gem"></span>`);
    const running = s.goldBoostUntil - now;
    $('gs-boost-note').textContent = `x${GOLD_BOOST_MULT} gold from enemies and chests for ${GOLD_BOOST_MINUTES} min, stacks up to ${GOLD_BOOST_MAX_MINUTES / 60} h.${running > 0 ? ` Running: ${Math.ceil(running / 60_000)} min left.` : ''}`;
    const gb = $<HTMLButtonElement>('gs-boost');
    gb.disabled = !s.goldBoostReady(now);
    setHtml(gb, `${GOLD_BOOST_GEMS} <span class="gem"></span>`);
    const can = s.ticketsBuyable(now);
    $('gs-tickets-note').textContent = `${TICKET_GEMS} Gems each into your bought stash (up to ${BOUGHT_TICKET_CAP}), kept apart from the ${TICKET_CAP} free ones. ${s.ticketBuysLeft(now)}/${TICKETS_PER_DAY} left today. Stash: ${s.boughtTickets}.`;
    for (const n of [1, 5]) {
      const b = $<HTMLButtonElement>(`gs-ticket${n}`);
      b.disabled = can < n;
      setHtml(b, `x${n} · ${n * TICKET_GEMS} <span class="gem"></span>`);
    }
  }

  /** When the offline reach was last worked out (it runs the boss checks, so not every frame). */
  private offlineAt = 0;

  /** The home panel: offline reach, Objective, daily challenges, login, Fortune Wheel and Crest Bundle. */
  private renderHome() {
    const s = this.state;
    const now = Date.now();
    if (now - this.offlineAt > 3000) {
      this.offlineAt = now;
      $('home-offline').textContent = s.maxOfflineStage().toLocaleString();
      $('home-offline-note').textContent = s.autoAdvance ? `In ${OFFLINE_CAP_HOURS} h away, from stage ${s.stage.toLocaleString()}` : 'Auto-advance is off';
    }

    // Run stats sit at the bottom of the home panel.
    const nextBoss = Math.ceil((s.stage + (isBossStage(s.stage) ? 0 : 1)) / BOSS_EVERY) * BOSS_EVERY;
    $('bt-stage').textContent = s.stage.toLocaleString();
    $('bt-boss').textContent = `Stage ${nextBoss.toLocaleString()}`;
    $('bt-best').textContent = s.bestStage.toLocaleString();
    $('bt-run').textContent = s.runBestStage.toLocaleString();
    $('bt-gps').textContent = fmt(new Decimal(s.goldPerSec));
    $('bt-pace').textContent = `${Math.round(s.secondsPerStage)}s`;
    $('bt-rk').textContent = String(s.rekindles);

    const login = s.loginState(now);
    // Claimed today with the cycle just finished: show every day as collected.
    const doneDays = !login.ready && login.day === 0 && s.login.count > 0 ? LOGIN_CYCLE.length : login.day;
    setHtml(
      $('login-days'),
      LOGIN_CYCLE.map((r, i) => {
        const cls = i < doneDays ? 'done' : i === login.day && login.ready ? 'today' : '';
        return `<div class="${cls}${r.gems ? ' big' : ''}${(i + 1) % 7 === 0 || i >= LOGIN_CYCLE.length - 2 ? ' week' : ''}"><small>Day ${i + 1}</small><b>${i < doneDays ? '✓' : sliceLabel(r)}</b></div>`;
      }).join(''),
    );
    $<HTMLButtonElement>('login-claim').disabled = !login.ready;
    $('login-claim').textContent = login.ready ? `Claim day ${login.day + 1}` : 'Come back tomorrow';

    const spinReady = s.spinReady(now) && !this.spinning;
    $<HTMLButtonElement>('spin-btn').disabled = !spinReady;
    $('spin-btn').textContent = this.spinning ? 'Spinning...' : spinReady ? 'Free spin' : 'Next spin tomorrow';

    const daily = s.dailies(now);
    const dailyList = $('daily-list');
    for (const r of daily) {
      this.rewardRow(dailyList, `daily:${r.def.stat}`, r.def.text, r.progress, r.def.goal, `${r.progress}/${r.def.goal} · ${DAILY_GEMS} Gems`, r.claimed ? 'done' : r.progress >= r.def.goal ? 'claim' : 'wait');
    }
    const earned = daily.filter((r) => r.claimed).length * DAILY_GEMS;
    $('daily-note').textContent = `${earned}/${DAILIES.length * DAILY_GEMS} Gems today`;

    const bundle = s.medalBundleState(now);
    setHtml(
      $('bundle-heroes'),
      bundle.drops
        .map(({ heroId, crests }) => {
          const def = HEROES.find((h) => h.id === heroId)!;
          return `<div class="bundle-hero${bundle.claimed ? ' done' : ''}"><span class="face art" style="${faceStyle(def)}">${def.name[0]}</span><b>${def.name}</b><small>+${crests} Crests</small></div>`;
        })
        .join(''),
    );
    $('bundle-note').textContent = bundle.claimed ? 'Claimed' : `${Math.min(bundle.done, bundle.need)}/${bundle.need} challenges`;
    $<HTMLButtonElement>('bundle-claim').disabled = !bundle.ready;
    $('bundle-claim').textContent = bundle.claimed ? 'New bundle tomorrow' : bundle.ready ? 'Claim free' : `Finish ${bundle.need} daily challenges`;

    // Stage Milestones: the next few on a small track, so the next reward is always in sight.
    const ready = s.milestonesReady();
    const reached = s.milestoneReached();
    const first = s.milestone + MILESTONE_STEP;
    const nodes: string[] = [];
    for (let i = 0; i < 5; i++) {
      const stage = first + i * MILESTONE_STEP;
      const r = milestoneReward(stage);
      const cls = stage <= reached ? 'ready' : stage === reached + MILESTONE_STEP ? 'next' : '';
      const tag = r.chests > 1 ? `${r.chests} Chests` : r.chests ? 'Chest' : 'Stone';
      nodes.push(`<li class="${cls}${r.chests > 1 ? ' big' : ''}"><b>${stage.toLocaleString()}</b><small>${tag}</small></li>`);
    }
    setHtml($('ms-track'), nodes.join(''));
    const next = reached + MILESTONE_STEP;
    $('ms-goal').textContent = `Beat stage ${next.toLocaleString()}`;
    $('ms-next').textContent = `Reward: ${milestoneText(milestoneReward(next))}. Every 50th-stage boss pays once.`;
    $('ms-note').textContent = s.milestone ? `${(s.milestone / MILESTONE_STEP).toLocaleString()} claimed` : '';
    $<HTMLButtonElement>('ms-claim').disabled = ready <= 0;
    $('ms-claim').textContent = ready > 1 ? `Claim ${ready} milestones` : ready === 1 ? 'Claim' : `Best stage ${s.bestStage.toLocaleString()}`;

  }

  private renderRewards() {
    const s = this.state;
    const now = Date.now();
    this.renderGemShop(now);
    this.renderHeroShop(now);
    const short = (v: number) => (v >= 1e4 ? fmt(v) : v.toLocaleString());
    const bootList = $('boot-list');
    let bootLeft = 0;
    for (const b of BOOTCAMP) {
      const claimed = s.bootcamp.includes(b.id);
      if (!claimed) bootLeft++;
      const done = s.bootcampDone(b);
      // Only the next few goals show, plus any ready to claim, so the list stays short.
      const shown = !claimed && (done || bootLeft <= 4);
      this.rewardRow(bootList, `boot:${b.id}`, b.text, done ? 1 : 0, 1, `${b.gems} Gems`, !shown ? 'hide' : done ? 'claim' : 'wait');
    }
    $('boot-note').textContent = bootLeft ? `${BOOTCAMP.length - bootLeft}/${BOOTCAMP.length} done` : 'All done!';

    const achList = $('ach-list');
    for (const a of s.achievements()) {
      const goal = a.next ? a.next[0] : a.def.tiers[a.def.tiers.length - 1][0];
      const text = a.def.text(goal);
      const meta = a.next ? `${short(Math.min(a.value, goal))}/${short(goal)} · ${a.next[1]} Gems · tier ${a.tier + 1}/${a.def.tiers.length}` : 'Every tier claimed';
      this.rewardRow(achList, `ach:${a.def.id}`, text, Math.min(a.value, goal), goal, meta, !a.next ? 'done' : a.ready ? 'claim' : 'wait');
    }
  }

  showRekindled(r: RekindleResult) {
    const counts = new Map<string, number>();
    for (const line of r.wheel) counts.set(line, (counts.get(line) ?? 0) + 1);
    const wheel = r.wheel.length
      ? `<br>The Rekindle Wheel spun ${r.wheel.length} time${r.wheel.length === 1 ? '' : 's'}: ${[...counts].map(([line, n]) => (n > 1 ? `${line} x${n}` : line)).join(', ')}.`
      : '';
    const gift = r.levelsGained > 0 ? `<br>Player level up! Your gift: <b>${r.stones} Enhance Stones</b>.` : '';
    this.showModal(
      'Rekindled!',
      `You earned <b class="ember-text">${fmt(r.embers)} Embers</b>.${wheel}${gift}<br>Tap any hero to spend Embers on Ember levels. Those levels stay through every Rekindle, so each run starts stronger.`,
      r.start > 1 ? `Start at stage ${r.start.toLocaleString()}` : 'Start the new run',
    );
  }

  private buyEmber(def: HeroDef) {
    if (this.state.buyEmbers(def.id, this.state.buyAmount) <= 0) return;
    this.scene()?.syncHeroes();
    this.render();
  }

  private buy(def: HeroDef) {
    const level = this.state.levels[def.id] ?? 0;
    if (level === 0) {
      if (this.state.unlockHero(def.id)) {
        play('unlock');
        this.scene()?.syncHeroes();
        this.render();
      }
      return;
    }
    const { levels, cost } = bulkCost(def, level, this.state.buyAmount, this.state.gold, this.state.levelCostMult());
    if (levels === 0 || cost.gt(this.state.gold)) return;
    this.state.gold = this.state.gold.minus(cost);
    this.state.levels[def.id] = level + levels;
    play('levelup');
    this.state.track('levels', levels);
    this.scene()?.syncHeroes();
    this.render();
  }

  showOffline(report: OfflineReport) {
    const stages = report.stages > 0 ? `<br>Your heroes pushed <b>${report.stages}</b> stage${report.stages === 1 ? '' : 's'}${report.bosses > 0 ? ` and beat <b>${report.bosses}</b> boss${report.bosses === 1 ? '' : 'es'}` : ''}.` : '';
    const market = report.market.gt(0) ? `<br>Market Row made <b>${fmt(report.market)}</b> of that.` : '';
    this.showModal('Welcome back!', `You were away for ${fmtDuration(report.seconds)}.<br>You earned <b>${fmt(report.gold)}</b> gold.${market}${stages}`, 'Collect');
  }

  render() {
    this.renderPvpMeter();
    // The Rekindle page stays live: the run keeps going behind it.
    if (!$('rk').hidden) this.renderRekindle();
    if (!$('coll').hidden) this.renderCollection();
    const s = this.state;
    $('gold').textContent = fmt(s.gold);
    $('gps').textContent = `${fmt(new Decimal(s.goldPerSec))}/s`;
    $('gems').textContent = fmt(s.gems);
    const summon = $<HTMLButtonElement>('summon');
    summon.disabled = s.gems < CHEST_COST;
    setHtml(summon, `Open · ${CHEST_COST} <span class="gem"></span>`);
    $<HTMLButtonElement>('chest-btn').disabled = s.gems < CHEST_COST;
    $('embers-stat').hidden = s.embers === 0 && s.rekindles === 0;
    $('embers').textContent = fmt(s.embers);
    const rk = $<HTMLButtonElement>('rekindle');
    rk.hidden = s.runBestStage < 100 && s.rekindles === 0;
    rk.disabled = !s.canRekindle();
    rk.textContent = s.canRekindle() ? `Rekindle +${fmt(s.pendingEmbers())}` : `Rekindle at stage ${s.rekindleStage()}`;
    const speedUnlocked = s.bestStage >= SPEED_UNLOCK_STAGE;
    const speed = $<HTMLButtonElement>('speed');
    speed.disabled = !speedUnlocked;
    speed.textContent = speedUnlocked ? '2x' : `2x at stage ${SPEED_UNLOCK_STAGE}`;
    speed.classList.toggle('on', speedUnlocked && s.speed2x);
    $('mute').classList.toggle('on', !s.muted);
    $('mute').textContent = s.muted ? 'Sound off' : 'Sound on';
    $('vol-sfx-n').textContent = `${Math.round(s.sfxVolume * 100)}%`;
    $('vol-music-n').textContent = `${Math.round(s.musicVolume * 100)}%`;
    for (const row of document.querySelectorAll<HTMLElement>('.vol-row')) row.classList.toggle('off', s.muted);
    $('autoult').classList.toggle('on', s.autoUlt);
    const evolvable = s.evolvable().length;
    $<HTMLButtonElement>('evolve-all').disabled = evolvable === 0;
    $('evolve-all').textContent = evolvable ? `Evolve all (${evolvable})` : 'Evolve all';
    $<HTMLButtonElement>('levelall').disabled = !HEROES.some((h) => (s.levels[h.id] ?? 0) > 0 && s.inLineup(h.id) && upgradeCost(h, s.levels[h.id], s.levelCostMult()).lte(s.gold));
    $('buyamt').textContent = `Buy ${s.buyAmount === 'max' ? 'max' : `x${s.buyAmount}`}`;
    const bossBtn = $('boss');
    bossBtn.hidden = s.autoAdvance;
    const retryIn = s.bossRetryIn();
    bossBtn.textContent = `${isBossStage(s.stage + 1) || isBossStage(s.stage) ? 'Fight boss' : 'Resume'}${retryIn === null ? '' : retryIn > 0 ? ` · ${fmtSecs(retryIn)}` : ' · next clear'}`;
    $('autoboss').hidden = s.autoAdvance;
    $('autoboss').classList.toggle('on', s.autoBoss);

    let heroesBadge = false;
    let teamReady = false;
    for (const r of this.rows) {
      const level = s.levels[r.def.id] ?? 0;
      const emberLevel = s.emberLevels[r.def.id] ?? 0;
      const eff = s.heroLevel(r.def.id);
      const locked = level === 0;
      // The Heroes tab lists only the current team; Manage Team handles everyone else.
      r.root.hidden = !s.inLineup(r.def.id);
      if (s.canUnlock(r.def)) teamReady = true;
      if (r.root.hidden) continue;
      r.root.classList.toggle('locked', locked);
      // The Heroes tab is the gold upgrade screen, so its level is gold levels only; Ember levels show as the +N badge.
      r.level.textContent = locked ? '' : `Lv ${level}`;
      r.emberBadge.textContent = emberLevel ? `+${emberLevel}` : '';
      r.emberBadge.title = emberLevel ? `${emberLevel} Ember levels` : '';
      const starCount = s.stars[r.def.id] ?? 0;
      const pinkCount = s.awaken[r.def.id] ?? 0;
      setHtml(r.stars, locked ? '' : `${'★'.repeat(starCount + 1)}${pinkCount ? `<span class="pink-mini">★${pinkCount}</span>` : ''}`);
      const evolveCost = s.evolveCost(r.def.id);
      const canEvolve = !locked && evolveCost !== null && s.medalsFor(r.def.id) >= evolveCost;
      const benched = !locked && !s.inLineup(r.def.id);
      r.root.classList.toggle('benched', benched);
      r.ember.textContent = benched ? '· Benched' : canEvolve ? '· Ready to evolve!' : s.embers >= emberCost(emberLevel) ? '· Embers ready' : '';
      if (!benched && (canEvolve || (s.embers > 0 && s.embers >= emberCost(emberLevel)))) heroesBadge = true;
      const { levels, cost } = bulkCost(r.def, level, s.buyAmount, s.gold, s.levelCostMult());
      const shown = levels > 0 ? { levels, cost } : bulkCost(r.def, level, 1, s.gold, s.levelCostMult());
      if (locked) {
        const p1 = s.heroPower(r.def, 1);
        setHtml(r.stats, `<span class="st atk">${SWORD}${fmt(p1.atk)}</span><span class="st hp">${HEART}${fmt(p1.hp)}</span>`);
        r.label.textContent = 'Unlock';
      } else {
        const next = eff + shown.levels;
        const now = s.heroPower(r.def, eff);
        setHtml(r.stats, `<span class="st atk">${SWORD}${fmt(now.atk)} <span class="next">→ ${fmt(s.heroPower(r.def, next).atk)}</span></span><span class="st hp">${HEART}${fmt(now.hp)}</span><span class="st cp" title="Combat Power">CP ${fmt(s.heroCombatPower(r.def))}</span>`);
        r.label.textContent = shown.levels === 1 ? 'Level Up' : `Level +${shown.levels}`;
      }
      if (locked) {
        const need = s.unlockCrests(r.def);
        r.cost.textContent = medalCount(r.def, Math.min(s.medalsFor(r.def.id), need), need);
        r.button.disabled = !s.canUnlock(r.def);
        if (s.canUnlock(r.def)) heroesBadge = true;
      } else {
        r.cost.textContent = fmt(shown.cost);
        r.button.disabled = shown.cost.gt(s.gold);
      }
    }

    this.badge('market', this.renderMarket());
    this.badge('relics', this.renderRelics());
    this.badge('battle', s.rekindles > 0 && s.tickets >= TICKET_CAP);
    this.badge('heroes', heroesBadge || teamReady);
    $('collection-btn').classList.toggle('ready', teamReady);
    this.badge('shop', s.gems >= CHEST_COST || s.rewardsWaiting());
    $<HTMLElement>('home-btn').querySelector<HTMLElement>('.badge')!.hidden = !s.homeWaiting();
    if (this.tab === 'home') this.renderHome();
    if (this.tab === 'shop') this.renderRewards();
    if (this.tab === 'battle') this.renderBattle();
    this.renderSheet();

    const scene = this.scene();
    // Only heroes holding an Ultimate slot get a button, in slot order.
    const slotted = this.state.ultHeroes();
    for (const u of this.ults) {
      const fights = slotted.includes(u.def.id);
      u.button.hidden = !fights;
      u.button.style.order = String(slotted.indexOf(u.def.id));
      if (!scene || !fights) continue;
      const st = scene.getUltState(u.def.id);
      const ready = st.unlocked && st.alive && st.remaining <= 0;
      u.button.disabled = !ready;
      u.button.classList.toggle('ready', ready);
      // A fallen hero's button counts down to their revive, even before the Ultimate unlocks.
      u.cd.textContent = !st.alive ? `${Math.ceil(st.reviveIn)}s` : !st.unlocked ? `Lv${ULT_UNLOCK_LEVEL}` : st.remaining > 0 ? `${Math.ceil(st.remaining)}` : '';
      u.cd.style.display = ready ? 'none' : 'flex';
      // Cooldown shade drains from the top as the ultimate recharges.
      u.button.style.setProperty('--cd', !st.unlocked || !st.alive ? '1' : String(Math.min(1, st.remaining / st.total)));
    }
  }
}

/** Hero Chest drops as cards, one per hero (repeat drops for a hero are added together). */
export function dropCards(drops: SummonDrop[]): string {
  if (!drops.length) return '';
  const merged = new Map<string, SummonDrop>();
  for (const d of drops) {
    const m = merged.get(d.heroId);
    merged.set(d.heroId, m ? { heroId: d.heroId, crests: m.crests + d.crests, isNew: m.isNew || d.isNew } : { ...d });
  }
  const cards = [...merged.values()]
    .map((d) => {
      const def = HEROES.find((h) => h.id === d.heroId)!;
      return `<div class="drop"><div class="face art" style="${faceStyle(def)}">${def.name[0]}</div><b>${def.name}</b>${d.isNew ? '<span class="new">READY TO UNLOCK</span>' : ''}<span class="crest">+${d.crests} Crests</span></div>`;
    })
    .join('');
  return `<div class="summon-grid">${cards}</div>`;
}

/** Short label for a Fortune Wheel slice. */
function sliceLabel(r: Reward): string {
  if (r.chests && r.gems) return `${r.chests === 1 ? 'Chest' : `${r.chests} Chests`} + ${r.gems} Gems`;
  if (r.chests && r.stones) return `${r.chests} Chests + ${r.stones} Stones`;
  if (r.gems) return `${r.gems} Gems`;
  if (r.stones) return `${r.stones} Stones`;
  if (r.tickets) return `${r.tickets} Tickets`;
  if (r.goldMinutes) return r.goldMinutes >= 60 ? `${r.goldMinutes / 60}h gold` : `${r.goldMinutes}m gold`;
  return r.chests === 1 ? 'Chest' : `${r.chests} Chests`;
}

function stallIncomePreview(def: StallDef) {
  return new Decimal(def.baseIncome);
}

function cap(s: string) {
  return s[0].toUpperCase() + s.slice(1);
}

/** Bold, color-coded rarity label shown under a hero's name. */
/** How Legendary heroes are earned, shown in the Collection and on their hero page. */
const LEGENDARY_HOW = `Legendary heroes never drop. An 8★ hero turns every ${LEGENDARY_MEDAL_RATE} extra crests into 1 Legendary crest; spend them on any Legendary hero: ${LEGENDARY_UNLOCK_MEDALS} to unlock, then more for each star.`;

/** "12/30 Crests", or Legendary crests for Legendary heroes. */
function medalCount(def: HeroDef, have: number, need: number) {
  return `${have}/${need} ${def.rarity === 'legendary' ? 'Legendary' : 'Crests'}`;
}

function rarityTag(def: HeroDef) {
  return `<b class="rarity r-${def.rarity}">${cap(def.rarity)}</b>`;
}

/** "Water Samurai": element and Type. */
function heroTitle(def: HeroDef) {
  return `${cap(def.element)} ${def.type}`;
}

/** A Stall cycle length: whole seconds, or one decimal under 10s. */
function fmtSecs(sec: number): string {
  return sec >= 10 ? `${Math.round(sec)}s` : `${Math.round(sec * 10) / 10}s`;
}

/** The hero page's three stat pages: value, (base) and the bonus in green. Stats that do nothing for this hero are greyed. */
function statPages(st: HeroStats, level: string, page: number, top: string, cp = ''): string {
  const pct = (n: number, sign = false) => {
    const v = Math.round(n * 1000) / 10;
    return `${sign && v >= 0 ? '+' : ''}${v.toLocaleString()}%`;
  };
  const gain = (value: number, base: number) => (base > 0 && Math.abs(value - base) > 1e-9 ? pct(value / base - 1, true) : '');
  const big = (b: BigStat) => {
    const bonus = b.base.gt(0) ? b.value.div(b.base).toNumber() - 1 : 0;
    return [fmt(b.value), `(${fmt(b.base)})`, Math.abs(bonus) > 1e-9 ? pct(bonus, true) : ''];
  };
  const pair = (p: StatPair, show: (n: number) => string) => [show(p.value), Math.abs(p.value - p.base) > 1e-9 ? `(${show(p.base)})` : '', gain(p.value, p.base)];
  type Row = [label: string, cells: string[], off?: boolean];
  const num = (n: number) => (Math.round(n * 100) / 100).toLocaleString();
  const pages: Row[][] = [
    [
      ['Atk', big(st.atk)],
      ['HP', big(st.hp)],
      ['Def', big(st.def)],
      ['Critical Rate', [pct(st.critRate), '', '']],
      ['Critical Damage', [pct(st.critDmg, true), '', '']],
      ['Atk per sec', pair(st.attacksPerSec, num)],
      ['Atk Range', pair(st.range, num)],
      ['Move Speed', pair(st.moveSpeed, num)],
      ['Effect Resistance', pair(st.effectRes, (n) => pct(n))],
    ],
    [
      ['Frenzy Chance', pair(st.frenzy, (n) => pct(n))],
      ['Dodge Rate', pair(st.dodge, (n) => pct(n)), st.dodge.value <= 0],
      ['Stun Chance', [pct(st.stunChance), '', ''], st.stunChance <= 0],
      ['Stun Time', [pct(st.stunTime, true), '', ''], st.stunChance <= 0],
      ['AoE Radius', [pct(st.aoeRadius, true), '', ''], !st.hasAoe],
      ['AoE Dmg', [pct(st.aoeDmg, true), '', ''], !st.hasAoe],
      ['Ultimate Atk', [pct(st.ultAtk, true), '', '']],
      ['Knight Shield HP', [pct(st.knightShield, true), '', ''], !st.isKnight],
      ['Bonus Gold', [pct(st.bonusGold, true), '', '']],
    ],
    [
      ['Freeze Chance', [pct(st.freezeChance), '', ''], st.freezeChance <= 0],
      ['Freeze Time', [pct(st.freezeTime, true), '', ''], st.freezeChance <= 0],
      ['Freeze Explosion Dmg', [pct(st.freezeBlast, true), '', ''], st.freezeChance <= 0],
      ['Burn Chance', [pct(st.burnChance), '', ''], st.burnChance <= 0],
      ['Burn Time', [pct(st.burnTime, true), '', ''], st.burnChance <= 0],
      ['Burn Dmg', [pct(st.burnDmg, true), '', ''], st.burnChance <= 0],
      ['Poison Chance', [pct(st.poisonChance), '', ''], st.poisonChance <= 0],
      ['Poison Time', [pct(st.poisonTime, true), '', ''], st.poisonChance <= 0],
      ['Poison Dmg', [pct(st.poisonDmg, true), '', ''], st.poisonChance <= 0],
    ],
  ];
  const rows = pages[page]
    .map(([label, [v, base, bonus], off]) => `<div class="sr${off ? ' off' : ''}"><span>${label}</span><b>${v}${base ? ` <i>${base}</i>` : ''}</b><em>${bonus}</em></div>`)
    .join('');
  return `<div class="stat-top"><span>Level <b>${level}</b>${cp ? `<br>CP <b>${cp}</b>` : ''}</span><div class="stat-spec">${top}</div></div><div class="stat-page">${rows}</div>
    <div class="stat-pager"><button data-statpage="-1" aria-label="Previous stats">‹</button><span>${page + 1}/3</span><button data-statpage="1" aria-label="More stats">›</button></div>`;
}
