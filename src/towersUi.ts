/**
 * Element Towers page (Battle hub > Element Towers): element tabs with the floor reached, the tower's open days,
 * Normal/Hard, a stack of floors (foe leader on the left, reward on the right, the next floor glowing, every 5th
 * and 10th framed), and the tower team with Edit and Fight. Rules live in src/towers.ts and GameState.
 */
import Decimal from 'break_infinity.js';
import { DAY_NAMES, ELEMENT_COLORS, ESSENCE_NAMES, HEROES, type Element } from './data';
import { fmt } from './formulas';
import type { GameState } from './state';
import { TOWER_ELEMENTS, TOWER_FLOORS, TOWER_FOE, TOWER_NAMES, towerDays, towerMilestone, towerReward, type TowerMode, type TowerReward } from './towers';
import { faceStyle } from './ui';
import { matIcon } from './scoutUi';
import { play } from './sfx';
import { setHtml } from './taps';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const hero = (id: string) => HEROES.find((h) => h.id === id)!;

interface UiHooks {
  showModal(title: string, html: string, ok: string, action?: (() => void) | null, cancel?: boolean, cancelLabel?: string): void;
  render(): void;
  fightTower(el: Element, mode: TowerMode): void;
  openTowerTeam(el: Element): void;
}

/** A floor's reward as chips (Essence shown as the amount it pays now). */
export function towerRewardChips(r: TowerReward, el: Element, essence: number): string {
  const out: string[] = [];
  if (r.gems) out.push(`<span class="mat-chip" title="Gems"><span class="gem"></span>${r.gems}</span>`);
  if (r.chest) out.push(`<span class="mat-chip" title="${r.chest === 'grand' ? 'Rare Glyph Chest' : 'Glyph Chest'}">${matIcon(r.chest)}1</span>`);
  if (r.stones) out.push(`<span class="mat-chip" title="Enhance Stones"><i class="stone"></i>${r.stones}</span>`);
  out.push(`<span class="mat-chip" title="Wild Crests">${matIcon('wild')}${r.wild}</span>`);
  out.push(`<span class="mat-chip tw-ess" title="${ESSENCE_NAMES[el]}"><i class="ess-${el}"></i>${fmt(essence)}</span>`);
  return out.join('');
}

export class TowersUI {
  el: Element = 'water';
  mode: TowerMode = 'normal';
  private sig = '';

  constructor(private state: GameState, private ui: UiHooks) {
    $('towers').addEventListener('click', (e) => this.onClick(e));
  }

  help() {
    this.ui.showModal(
      'Element Towers',
      `<p>Five towers, one for each element. A tower only lets in heroes of its element, and every floor is a team of the element it beats: Water fights Fire, Fire fights Earth, Earth fights Water, Light fights Dark and Dark fights Light.</p>
      <p>Each tower opens on two weekdays, and all five are open on Saturday and Sunday. Fights are free, so a lost floor can be tried again right away.</p>
      <p>Floors give rewards only: Wild Crests and Essence on every floor, Enhance Stones on every 5th, Gems on every 10th and a Glyph Chest on every 25th. Clear all ${TOWER_FLOORS} floors to open Hard, which pays double.</p>
      <p>Heroes fight at the fixed level, like the Colosseum: stars, relics, weapons and Glyphs count, gold and Ember levels don't.</p>`,
      'Okay',
    );
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
    if (this.mode === 'hard' && !s.towerHardOpen(this.el)) this.mode = 'normal';
    // The page re-renders with the game every 200 ms: only work it out again when something it shows can have changed.
    const sig = [this.el, this.mode, new Date(now).getDay(), Math.floor(now / 10_000), s.teamSlots, JSON.stringify(s.towers), ...HEROES.filter((h) => h.element === this.el).map((h) => `${s.levels[h.id] ? 1 : 0}${s.stars[h.id] ?? 0}`)].join('|');
    if (sig === this.sig && $('towers').childElementCount) return;
    this.sig = sig;
    const el = this.el;
    const mode = this.mode;
    const foeEl = TOWER_FOE[el];
    const today = new Date(now).getDay();
    const tabs = TOWER_ELEMENTS.map((e) => {
      const shut = !s.towerOpenToday(e, now);
      const best = s.towerCleared(e, 'hard') ? `H${s.towerCleared(e, 'hard')}` : `${s.towerCleared(e, 'normal')}`;
      return `<button type="button" class="tw-tab${e === el ? ' on' : ''}${shut ? ' shut' : ''}" data-tw-el="${e}" style="--el:${hex(ELEMENT_COLORS[e])}"><i class="mode-orb ${e}"></i><b>${cap(e)}</b><small>${shut ? 'Closed' : `Floor ${best}`}</small></button>`;
    }).join('');
    const days = [1, 2, 3, 4, 5, 6, 0].map((d) => `<i class="${towerDays(el).includes(d) ? 'on' : ''}${d === today ? ' today' : ''}">${DAY_NAMES[d][0]}</i>`).join('');
    const hardOpen = s.towerHardOpen(el);
    const modes = `<div class="tw-modes"><button type="button" data-tw-mode="normal" class="${mode === 'normal' ? 'on' : ''}">Normal</button><button type="button" data-tw-mode="hard" class="${mode === 'hard' ? 'on' : ''}" ${hardOpen ? '' : 'disabled'} title="${hardOpen ? 'Hard floors pay double' : `Clear all ${TOWER_FLOORS} Normal floors to open Hard`}">${hardOpen ? 'Hard' : '🔒 Hard'}</button></div>`;
    const cleared = s.towerCleared(el, mode);
    const next = s.towerNext(el, mode);
    const top = Math.min(TOWER_FLOORS, (next ?? TOWER_FLOORS) + 3);
    const bottom = Math.max(1, top - 6);
    const rows: string[] = [];
    for (let f = top; f >= bottom; f--) {
      const foe = s.towerFoe(el, f, mode);
      const lead = hero(foe.heroes[0].id);
      const reward = towerReward(f, mode);
      const ms = towerMilestone(f);
      const state = f <= cleared ? 'done' : f === next ? 'now' : 'ahead';
      const stars = '★'.repeat(foe.heroes[0].stars + 1);
      rows.push(`<div class="tw-floor ${state}${ms ? ` ms${ms}` : ''}">
        <span class="tw-num"><small>Floor</small>${f}</span>
        <span class="face art" style="${faceStyle(lead)}"></span>
        <span class="tw-foe"><b>${lead.name}</b><small><span class="tw-stars">${stars}</span> + ${foe.heroes.length - 1} ${cap(foeEl)}</small><small>CP ${fmt(new Decimal(foe.cp))}</small></span>
        <span class="tw-rew">${state === 'done' ? '<b class="tw-check">✓ Cleared</b>' : towerRewardChips(reward, el, s.towerEssence(el, reward))}</span>
      </div>`);
    }
    const team = s.towerTeam(el);
    const block = s.towerBlock(el, mode, now);
    const foeNow = next ? s.towerFoe(el, next, mode) : null;
    const fc = foeNow && team.length ? s.towerForecast(el, mode) : null;
    const teamCp = s.fixedTeamCp(team);
    const look = !fc ? '' : fc.won ? '<b class="tw-look win">Looks like a win</b>' : '<b class="tw-look lose">Looks too strong for now</b>';
    const faces = team.map((h) => `<span class="face art" style="${faceStyle(h)}" title="${h.name}"></span>`).join('') || `<small>You have no ${cap(el)} heroes yet.</small>`;
    setHtml(
      $('towers'),
      `<div class="tw-tabs">${tabs}</div>
      <div class="tw-card" style="--el:${hex(ELEMENT_COLORS[el])};--foe:${hex(ELEMENT_COLORS[foeEl])}">
        <div class="tw-title"><div><b>${TOWER_NAMES[el]}</b><small>${cap(el)} heroes vs ${cap(foeEl)} heroes</small></div><span class="tw-best">Best <b>${mode === 'hard' ? 'Hard ' : ''}${cleared}</b>/${TOWER_FLOORS}</span></div>
        <div class="tw-days">${days}<span>${s.towerOpenToday(el, now) ? 'Open today' : 'Closed today'}</span></div>
        ${modes}
      </div>
      <div class="tw-stack">${rows.join('')}</div>
      <div class="tw-team">
        <div class="tw-team-head"><b>${cap(el)} team <small>CP ${fmt(teamCp)}</small></b><button type="button" class="wood-btn small" data-tw-team>Edit team</button></div>
        <div class="faces">${faces}</div>
        ${foeNow ? `<p class="tw-vs">Floor ${next}: ${cap(foeEl)} team, CP ${fmt(new Decimal(foeNow.cp))}. ${look}</p>` : ''}
        ${block ? `<p class="tw-block">${block}.</p>` : ''}
        <button type="button" class="wood-btn levelall tw-fight" data-tw-fight ${block ? 'disabled' : ''}>${next ? `Fight floor ${next}` : 'All cleared'}</button>
        <small class="tw-note">Only ${cap(el)} heroes can climb this tower. Fights are free; stars, relics, weapons and Glyphs count, gold and Ember levels don't.</small>
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
    const mode = t.closest<HTMLButtonElement>('[data-tw-mode]');
    if (mode && !mode.disabled) {
      this.mode = mode.dataset.twMode as TowerMode;
      play('tap');
      this.render();
      return;
    }
    if (t.closest('[data-tw-team]')) {
      this.ui.openTowerTeam(this.el);
      return;
    }
    const fight = t.closest<HTMLButtonElement>('[data-tw-fight]');
    if (fight && !fight.disabled) this.ui.fightTower(this.el, this.mode);
  }
}

/** The result box after a tower fight. */
export function towerResultHtml(r: { won: boolean; el: Element; floor: number; mode: TowerMode; reward: TowerReward | null; essence: number }): string {
  if (!r.won || !r.reward) return `<p class="tf-result lose">Floor ${r.floor} held. Star up more ${cap(r.el)} heroes, or try a different team. Fights are free.</p>`;
  return `<p class="tf-result win">Floor ${r.floor}${r.mode === 'hard' ? ' (Hard)' : ''} cleared!</p><div class="tw-rew tw-rew-big">${towerRewardChips(r.reward, r.el, r.essence)}</div>`;
}
