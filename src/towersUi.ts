/**
 * Element Towers page (Battle hub > Element Towers), full screen like the Colosseum: element tabs with the floor
 * reached, a header for the tower (name, who fights whom, open days), the tower itself as a stack of storeys
 * (foe leader in the window, reward on the right, the next floor glowing, every 5th/10th/25th framed), and a
 * bar at the bottom with the tower team, the forecast and Fight. Rules live in src/towers.ts and GameState.
 */
import Decimal from 'break_infinity.js';
import { DAY_NAMES, ELEMENT_COLORS, ESSENCE_NAMES, HEROES, type Element } from './data';
import { fmt } from './formulas';
import type { GameState, TowerResult } from './state';
import { TOWER_ELEMENTS, TOWER_FOE, TOWER_NAMES, towerDays, towerMilestone, towerAllows, towerReward, type TowerReward } from './towers';
import { faceStyle } from './ui';
import { matIcon } from './scoutUi';
import { play } from './sfx';
import { setHtml } from './taps';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const hero = (id: string) => HEROES.find((h) => h.id === id)!;
/** Floors shown above and below the next one. */
const ABOVE = 4;
const BELOW = 2;

interface UiHooks {
  showModal(title: string, html: string, ok: string, action?: (() => void) | null, cancel?: boolean, cancelLabel?: string): void;
  render(): void;
  fightTower(el: Element): void;
  openTowerTeam(el: Element): void;
}

/** A floor's reward as chips (Essence shown as the amount it pays now). */
export function towerRewardChips(r: TowerReward, el: Element, essence: number): string {
  const out: string[] = [];
  if (r.epicCrests) out.push(`<span class="mat-chip hot epic" title="Element Chest: ${r.epicCrests} crests for a ${cap(el)} Epic hero"><i class="medal"></i>Epic ${r.epicCrests}</span>`);
  if (r.chest) out.push(`<span class="mat-chip hot" title="${r.chest === 'grand' ? 'Rare Glyph Chest' : 'Glyph Chest'}">${matIcon(r.chest)}1</span>`);
  out.push(`<span class="mat-chip" title="Gems"><span class="gem"></span>${r.gems}</span>`);
  if (r.stones) out.push(`<span class="mat-chip" title="Enhance Stones"><i class="stone"></i>${r.stones}</span>`);
  out.push(`<span class="mat-chip" title="${cap(el)} hero crests"><i class="medal"></i>${r.crests}</span>`);
  out.push(`<span class="mat-chip" title="${ESSENCE_NAMES[el]}"><i class="ess-${el}"></i>${fmt(essence)}</span>`);
  return out.join('');
}

export class TowersUI {
  el: Element = 'water';
  private sig = '';

  constructor(private state: GameState, private ui: UiHooks) {
    $('towers').addEventListener('click', (e) => this.onClick(e));
  }

  help() {
    this.ui.showModal(
      'Element Towers',
      `<p>Five towers, one for each element. A tower only lets in heroes of its element (heroes with no element, like Pasta, fit every tower), and every floor is a team of the element it beats: Water fights Fire, Fire fights Earth, Earth fights Water, Light fights Dark and Dark fights Light.</p>
      <p>Each tower opens on two weekdays, and all five are open on Saturday and Sunday. Fights are free, so a lost floor can be tried again right away.</p>
      <p>The towers never end: every floor is a little stronger than the one below. Floors give rewards only: Gems, crests for heroes of that element and Essence on every floor, Enhance Stones on every 5th, an Element Chest with Epic crests on every 10th and a Glyph Chest on every 25th.</p>
      <p>Heroes fight at the fixed level, like the Colosseum: stars, relics, weapons and Glyphs count, gold and Ember levels don't.</p>`,
      'Okay',
    );
  }

  /** The backdrop behind the page: a battle scene that suits the tower's element. */
  private art(): string {
    const scene: Record<Element, string> = { water: 'tidecoast', fire: 'emberwastes', earth: 'dunes', light: 'stormcrag', dark: 'hollowmoon' };
    const bg = (f: string) => `url("${new URL(`bg/${f}`, document.baseURI).href}")`;
    return `${bg(`${scene[this.el]}_far.png`)} center 40% / cover, ${bg(`${scene[this.el]}_sky.png`)} center / cover`;
  }

  renderHub(now = Date.now()) {
    const s = this.state;
    const open = s.towersOpen();
    const today = TOWER_ELEMENTS.filter((el) => s.towerOpenToday(el, now));
    $('hub-tw-count').textContent = open ? `${s.towerFloorsTotal()}` : '-';
    $('hub-tw-note').textContent = !open ? 'Opens after your first Rekindle' : today.length === TOWER_ELEMENTS.length ? 'All towers open today' : `Open today: ${today.map(cap).join(', ')}`;
  }

  render(now = Date.now()) {
    const s = this.state;
    if (!s.towersOpen()) {
      setHtml($('towers'), '<p class="market-note">Element Towers open after your first Rekindle.</p>');
      return;
    }
    // The page re-renders with the game every 200 ms: only work it out again when something it shows can have changed.
    const sig = [this.el, new Date(now).getDay(), Math.floor(now / 10_000), s.teamSlots, JSON.stringify(s.towers), Math.round(Number(s.trialBest[this.el] ?? 0)), ...HEROES.filter((h) => towerAllows(h, this.el)).map((h) => `${s.levels[h.id] ? 1 : 0}${s.stars[h.id] ?? 0}`)].join('|');
    if (sig === this.sig && $('towers').childElementCount) return;
    this.sig = sig;
    const el = this.el;
    const page = document.querySelector<HTMLElement>('.tw-full');
    page?.style.setProperty('--art', this.art());
    const foeEl = TOWER_FOE[el];
    page?.style.setProperty('--el', hex(ELEMENT_COLORS[el]));
    page?.style.setProperty('--foe', hex(ELEMENT_COLORS[foeEl]));
    const today = new Date(now).getDay();
    const tabs = TOWER_ELEMENTS.map((e) => {
      const shut = !s.towerOpenToday(e, now);
      return `<button type="button" class="tw-tab${e === el ? ' on' : ''}${shut ? ' shut' : ''}" data-tw-el="${e}" style="--el:${hex(ELEMENT_COLORS[e])}"><i class="mode-orb ${e}"></i><b>${cap(e)}</b><small>${shut ? 'Closed' : `Floor ${s.towerCleared(e)}`}</small></button>`;
    }).join('');
    const days = [1, 2, 3, 4, 5, 6, 0].map((d) => `<i class="${towerDays(el).includes(d) ? 'on' : ''}${d === today ? ' today' : ''}">${DAY_NAMES[d][0]}</i>`).join('');
    const openNow = s.towerOpenToday(el, now);
    const cleared = s.towerCleared(el);
    const next = s.towerNext(el);
    const bottom = Math.max(1, next - BELOW);
    const top = bottom + ABOVE + BELOW;
    const rows: string[] = [];
    for (let f = top; f >= bottom; f--) {
      const foe = s.towerFoe(el, f);
      const lead = hero(foe.heroes[0].id);
      const reward = towerReward(f);
      const ms = towerMilestone(f) || (reward.chest ? 25 : 0);
      const state = f <= cleared ? 'done' : f === next ? 'now' : 'ahead';
      const stars = '★'.repeat(foe.heroes[0].stars + 1);
      rows.push(`<div class="tw-floor ${state}${ms ? ` ms${ms}` : ''}">
        <span class="tw-num">${f}</span>
        <span class="tw-window"><span class="face art" style="${faceStyle(lead)}"></span></span>
        <span class="tw-foe"><b>${lead.name}</b><small><span class="tw-stars">${stars}</span> + ${foe.heroes.length - 1} ${cap(foeEl)}</small><small class="tw-cp">CP ${fmt(new Decimal(foe.cp))}</small></span>
        <span class="tw-rew">${state === 'done' ? '<b class="tw-check">✓</b>' : towerRewardChips(reward, el, s.towerEssence(el, reward))}</span>
        ${state === 'now' ? '<i class="tw-here">Next</i>' : ''}
      </div>`);
    }
    const team = s.towerTeam(el);
    const block = s.towerBlock(el, now);
    const foeNow = s.towerFoe(el, next);
    const fc = team.length ? s.towerForecast(el) : null;
    const look = !fc ? '' : fc.won ? '<b class="tw-look win">Looks like a win</b>' : '<b class="tw-look lose">Looks too strong for now</b>';
    const faces = team.map((h) => `<span class="face art" style="${faceStyle(h)}" title="${h.name}"></span>`).join('') || `<small>You have no ${cap(el)} heroes yet.</small>`;
    setHtml(
      $('towers'),
      `<div class="tw-tabs">${tabs}</div>
      <div class="tw-banner">
        <b class="tw-name">${TOWER_NAMES[el]}</b>
        <span class="tw-matchup"><i class="mode-orb ${el}"></i>${cap(el)} heroes <em>vs</em> ${cap(foeEl)} heroes<i class="mode-orb ${foeEl}"></i></span>
        <div class="tw-meta"><span class="tw-days">${days}</span><span class="tw-open ${openNow ? 'yes' : 'no'}">${openNow ? 'Open today' : 'Closed today'}</span></div>
        <span class="tw-best">Highest floor <b>${cleared}</b></span>
      </div>
      <div class="tw-tower">
        <div class="tw-cap" aria-hidden="true"></div>
        <div class="tw-up">▲ The tower never ends</div>
        ${rows.join('')}
        <div class="tw-base">${bottom > 1 ? `▼ ${bottom - 1} floors cleared below` : '<span class="tw-gate" aria-hidden="true"></span>Ground floor'}</div>
      </div>
      <div class="tw-bar">
        <div class="tw-team-head"><b>${cap(el)} team <small>CP ${fmt(s.fixedTeamCp(team))}</small></b><button type="button" class="wood-btn small" data-tw-team>Edit team</button></div>
        <div class="faces">${faces}</div>
        <p class="tw-vs">Floor ${next} foes: CP ${fmt(new Decimal(foeNow.cp))}. ${look}</p>
        ${block ? `<p class="tw-block">${block}.</p>` : ''}
        <button type="button" class="wood-btn levelall tw-fight" data-tw-fight ${block ? 'disabled' : ''}>Fight floor ${next}</button>
      </div>`,
    );
  }

  private onClick(e: Event) {
    const t = e.target as HTMLElement;
    const tab = t.closest<HTMLElement>('[data-tw-el]');
    if (tab) {
      this.el = tab.dataset.twEl as Element;
      play('tap');
      this.render();
      return;
    }
    if (t.closest('[data-tw-team]')) {
      this.ui.openTowerTeam(this.el);
      return;
    }
    const fight = t.closest<HTMLButtonElement>('[data-tw-fight]');
    if (fight && !fight.disabled) this.ui.fightTower(this.el);
  }
}

/** The result box after a tower fight, with the heroes who got crests. */
export function towerResultHtml(r: TowerResult): string {
  if (!r.won || !r.reward) return `<p class="tf-result lose">Floor ${r.floor} held. Star up more ${cap(r.el)} heroes, or try a different team. Fights are free.</p>`;
  const got = new Map<string, number>();
  for (const id of r.crests) got.set(id, (got.get(id) ?? 0) + 1);
  if (r.epic) got.set(r.epic.id, (got.get(r.epic.id) ?? 0) + r.epic.amount);
  const crests = [...got].map(([id, n]) => `<span class="tw-crest"><span class="face art" style="${faceStyle(hero(id))}"></span><small>${hero(id).name} x${n}</small></span>`).join('');
  return `<p class="tf-result win">Floor ${r.floor} cleared!</p><div class="tw-rew tw-rew-big">${towerRewardChips(r.reward, r.el, r.essence)}</div><div class="tw-crests">${crests}</div>`;
}
