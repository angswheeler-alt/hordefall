/**
 * The Hunting Journal screen (rules in src/journal.ts, counts in GameState): a home card and an overlay with a
 * picture per page, its kills, tier pips and gold stamp, and a detail box for the page last tapped.
 */
import { ELEMENT_COLORS, ELEMENT_BOSSES, TRIAL_BOSS_ART, type Element } from './data';
import { BOSS_ANIMS, BOSS_ANIM_FRAMES } from './bossAnims';
import { bossPicHtml } from './portrait';
import { MOB_ANIMS } from './mobAnims';
import { mobArtUrl } from './mobArt';
import type { GameState, SummonDrop } from './state';
import {
  JOURNAL_MOBS,
  JOURNAL_PAGES,
  MOB_NAMES,
  SHINY_CHEST_CHANCE,
  SHINY_GEMS,
  SHINY_ODDS,
  SHINY_PER_DAY,
  STAMP_BONUS,
  TIER_BONUS,
  journalBonus,
  journalPage,
  journalTier,
  nextTierAt,
  type JournalGroup,
  type JournalPage,
} from './journal';
import { MOB_ELEMENTS, MOB_KINDS, MOB_TRICK_TEXT } from './mobs';
import { placeholderUrl } from './mobPlaceholders';
import { MUTATIONS, MUTATION_STAGE, MUTATION_MAX_CHANCE, MUTANT_GOLD, mutationChance } from './mutations';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

interface UiHooks {
  showModal(title: string, html: string, ok: string, action?: (() => void) | null, cancel?: boolean, cancelLabel?: string): void;
  render(): void;
}

/** The boss art a page shows (the same art the lane uses for that fight). */
function pageBossArt(page: JournalPage): string | undefined {
  const el = page.element;
  if (page.group === 'trial') return BOSS_ANIMS[TRIAL_BOSS_ART[el]] ? TRIAL_BOSS_ART[el] : BOSS_ANIMS[el] ? el : undefined;
  return BOSS_ANIMS[el] ? el : BOSS_ANIMS[TRIAL_BOSS_ART[el]] ? TRIAL_BOSS_ART[el] : undefined;
}

const PIC = 44;

/** Set innerHTML only when it changed, so a tap isn't lost to a rebuild mid-press. */
const shown = new WeakMap<HTMLElement, string>();
function setHtml(el: HTMLElement, html: string) {
  if (shown.get(el) === html) return;
  shown.set(el, html);
  el.innerHTML = html;
}

/** Inline style for a page's picture: a mob's first walk frame (facing left, as on the lane) or a boss portrait. */
function picStyle(page: JournalPage): string {
  if (page.mob) {
    const a = MOB_ANIMS[page.mob];
    // A special kind whose art hasn't arrived yet: its placeholder in the element's colour.
    if (!a) return `background-image:url('${placeholderUrl(page.mob, hex(ELEMENT_COLORS[page.element]))}');background-size:${PIC}px ${PIC}px;background-position:0 0`;
    const scale = Math.min(PIC / a.frame[0], PIC / a.frame[1]);
    const w = Math.round(a.frame[0] * scale);
    const h = Math.round(a.frame[1] * scale);
    return `background-image:url(${mobArtUrl(`${page.mob}_${page.element}_walk.png`)});background-size:${w * a.walk}px ${h}px;background-position:${(PIC - w) / 2}px ${PIC - h}px`;
  }
  return '';
}

/** A boss page's picture, drawn inside the .jr-pic box (src/portrait.ts). */
const picInner = (page: JournalPage) => {
  const art = page.mob ? undefined : pageBossArt(page);
  return art ? bossPicHtml(art, BOSS_ANIM_FRAMES.idle) : '';
};

const GROUP_TITLES: Record<Exclude<JournalGroup, 'mob' | 'mutant'>, string> = {
  boss: 'Stage bosses',
  trial: 'Trial bosses',
  guild: 'Guild Bosses',
};

/** What a page counts, in words. */
const unit = (page: JournalPage, n: number) => (page.group === 'guild' ? (n === 1 ? 'fight' : 'fights') : n === 1 ? 'kill' : 'kills');

type Tab = 'mobs' | 'mutants' | 'bosses';

/** Which tab lists a page. */
const tabOf = (p: JournalPage): Tab => (p.group === 'mob' ? 'mobs' : p.group === 'mutant' ? 'mutants' : 'bosses');

export class JournalUI {
  private tab: Tab = 'mobs';
  private picked = JOURNAL_PAGES[0].id;

  constructor(
    private state: GameState,
    private ui: UiHooks,
  ) {}

  bind() {
    $('home-journal').addEventListener('click', () => this.open());
    $('jr-close').addEventListener('click', () => this.close());
    $('jr').addEventListener('click', (e) => {
      if (e.target === $('jr')) this.close();
    });
    $('jr-tabs').addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-tab]');
      if (!b) return;
      this.tab = b.dataset.tab as Tab;
      const first = JOURNAL_PAGES.find((p) => tabOf(p) === this.tab);
      if (first) this.picked = first.id;
      this.render();
    });
    $('jr-list').addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-page]');
      if (!b) return;
      this.picked = b.dataset.page!;
      this.render();
    });
  }

  isOpen() {
    return !$('jr').hidden;
  }

  open() {
    this.render();
    $('jr').hidden = false;
  }

  close() {
    $('jr').hidden = true;
  }

  /** The home card: tiers reached and the page closest to its next tier. */
  renderHome() {
    const s = this.state;
    let tiers = 0;
    let best: { page: JournalPage; left: number; at: number } | null = null;
    for (const page of JOURNAL_PAGES) {
      const kills = s.journalKills(page.id);
      tiers += journalTier(page, kills);
      const at = nextTierAt(page, kills);
      if (at === null || kills === 0) continue;
      const share = kills / at;
      if (!best || share > best.left) best = { page, left: share, at };
    }
    $('home-journal-tiers').textContent = `${tiers}/${JOURNAL_PAGES.length * 3}`;
    $('home-journal-note').textContent = best
      ? `Next: ${best.page.name} ${s.journalKills(best.page.id).toLocaleString()}/${best.at.toLocaleString()}`
      : 'Beat enemies for lasting damage bonuses';
  }

  /** A shiny's Hero Chest, once nothing else is on screen. */
  showShinyDrops(dropCards: (d: SummonDrop[]) => string) {
    const drops = this.state.shinyDrops;
    if (!drops || !$('modal').hidden) return;
    this.state.shinyDrops = null;
    this.ui.showModal('Shiny treasure!', `<p>A shiny dropped a Hero Chest.</p>${dropCards(drops)}`, 'Nice');
  }

  render() {
    const s = this.state;
    let tiers = 0;
    for (const p of JOURNAL_PAGES) tiers += journalTier(p, s.journalKills(p.id));
    const stamps = s.journalStamps.length;
    setHtml($('jr-sum'),
      `<span><b>${tiers}</b>/${JOURNAL_PAGES.length * 3} tiers</span>` +
      `<span><i class="jr-stamp-ico"></i><b>${stamps}</b>/${JOURNAL_PAGES.filter((p) => p.group === 'mob').length} stamps</span>` +
      `<span>Shinies today <b>${s.shiniesToday()}</b>/${SHINY_PER_DAY}</span>`);
    for (const b of $('jr-tabs').querySelectorAll<HTMLButtonElement>('button[data-tab]')) b.classList.toggle('on', b.dataset.tab === this.tab);

    const cell = (page: JournalPage) => {
      const kills = s.journalKills(page.id);
      const tier = journalTier(page, kills);
      const stamped = s.journalStamps.includes(page.id);
      const pips = page.tiers.map((_, i) => `<i class="${i < tier ? 'on' : ''}"></i>`).join('');
      const mut = page.mutation ? `;--mut:${hex(MUTATIONS[page.mutation].color)}` : '';
      return (
        `<button class="jr-cell${page.id === this.picked ? ' picked' : ''}${kills ? '' : ' unseen'}${mut ? ' mutant' : ''}" data-page="${page.id}" style="--el:${hex(ELEMENT_COLORS[page.element])}${mut}" title="${page.name}">` +
        `<span class="jr-pic${page.mob ? ' mob' : ''}" style="${picStyle(page)}">${picInner(page)}</span>` +
        (stamped ? '<i class="jr-stamp" aria-label="Gold stamp"></i>' : '') +
        `<span class="jr-kills">${kills.toLocaleString()}</span><span class="jr-pips">${pips}</span></button>`
      );
    };

    let html = '';
    if (this.tab === 'mobs') {
      html += `<div class="jr-row jr-head"><span></span>${MOB_ELEMENTS.map((e) => `<span style="color:${hex(ELEMENT_COLORS[e])}">${cap(e)}</span>`).join('')}</div>`;
      for (const mob of JOURNAL_MOBS) {
        const from = MOB_KINDS[mob].fromStage;
        const locked = MOB_TRICK_TEXT[mob] && s.bestStage < from ? `<small>from ${from.toLocaleString()}</small>` : '';
        html += `<div class="jr-row"><span class="jr-label">${MOB_NAMES[mob].replace('Shieldbearer', 'Shield&shy;bearer')}${locked}</span>${MOB_ELEMENTS.map((el) => cell(journalPage(`mob_${mob}_${el}`)!)).join('')}</div>`;
      }
    } else if (this.tab === 'mutants') {
      const pages = JOURNAL_PAGES.filter((p) => p.group === 'mutant');
      html += s.bestStage >= MUTATION_STAGE
        ? `<p class="jr-mut-note">Mutants: ${pct(mutationChance(Math.max(MUTATION_STAGE, s.stage)))} of mobs on this stage (up to ${pct(MUTATION_MAX_CHANCE)} from stage 1,500), ${MUTANT_GOLD}x gold.</p>`
        : `<p class="jr-mut-note">Locked: mutants start showing up after stage ${(MUTATION_STAGE - 1).toLocaleString()}.</p>`;
      html += `<div class="jr-row jr-bosses">${pages.map(cell).join('')}</div>`;
    } else {
      for (const group of ['boss', 'trial', 'guild'] as const) {
        html += `<h4 class="jr-group">${GROUP_TITLES[group]}</h4><div class="jr-row jr-bosses">${JOURNAL_PAGES.filter((p) => p.group === group).map(cell).join('')}</div>`;
      }
    }
    setHtml($('jr-list'), html);
    this.renderDetail();
  }

  private renderDetail() {
    const s = this.state;
    const page = journalPage(this.picked) ?? JOURNAL_PAGES[0];
    const kills = s.journalKills(page.id);
    const tier = journalTier(page, kills);
    const stamped = s.journalStamps.includes(page.id);
    const bonus = journalBonus(page, kills, stamped);
    const where =
      page.mutation
        ? `${MUTATIONS[page.mutation].text}. Any mob after stage ${(MUTATION_STAGE - 1).toLocaleString()} can be one`
        : page.group === 'mob' && page.mob && MOB_TRICK_TEXT[page.mob]
        ? `${MOB_TRICK_TEXT[page.mob]}. ${cap(page.element)} stages from stage ${MOB_KINDS[page.mob].fromStage.toLocaleString()}`
        : page.group === 'mob'
        ? `${cap(page.element)} stages`
        : page.group === 'boss'
          ? `${ELEMENT_BOSSES[page.element as Element].title}: a stage boss every 250 stages, and the element boss from 600`
          : page.group === 'trial'
            ? `${cap(page.element)} Trial (each win counts, Quick wins too)`
            : `Guild Boss on ${cap(page.element)} weeks (every fight counts)`;
    const rows = page.tiers
      .map((t, i) => `<li class="${i < tier ? 'done' : ''}"><span>${t.toLocaleString()} ${unit(page, t)}</span><b>+${pct(TIER_BONUS[i])} damage</b></li>`)
      .join('');
    const stampRow =
      page.group === 'mob'
        ? `<li class="${stamped ? 'done gold' : ''}"><span>Gold stamp: beat a shiny one</span><b>+${pct(STAMP_BONUS)} more</b></li>`
        : '';
    setHtml($('jr-detail'),
      `<div class="jr-dhead${page.mutation ? ' mutant' : ''}" style="--el:${hex(ELEMENT_COLORS[page.element])}${page.mutation ? `;--mut:${hex(MUTATIONS[page.mutation].color)}` : ''}"><span class="jr-pic${page.mob ? ' mob' : ''}" style="${picStyle(page)}">${picInner(page)}</span>` +
      `<div><b>${page.name}</b><small>${where}</small><small>${kills.toLocaleString()} ${unit(page, kills)} · now <b class="jr-bonus">+${pct(bonus)} damage</b> against it</small></div></div>` +
      `<ul class="jr-tiers">${rows}${stampRow}</ul>`);
  }
}

/** The Journal's rules, in words, for the overlay's footer. */
export function journalRulesText(): string {
  return `Each page's tiers give your heroes more damage against that enemy only. About 1 in ${SHINY_ODDS} mobs is a shiny: beat it for ${SHINY_GEMS} Gems (${Math.round(SHINY_CHEST_CHANCE * 100)}% of the time a Hero Chest) and a gold stamp. Up to ${SHINY_PER_DAY} shinies a day. After stage ${(MUTATION_STAGE - 1).toLocaleString()} some mobs are mutants: tougher, but they pay ${MUTANT_GOLD}x gold and fill their own pages.`;
}
