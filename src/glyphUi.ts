/**
 * Screens for Glyphs: the slots on the hero page's Weapon tab, the Glyph bag, a Glyph's own page and the picker.
 * Rules live in src/glyphs.ts and GameState; this file only draws them.
 */
import { HEROES } from './data';
import type { GameState } from './state';
import {
  GLYPH_BAG_CAP,
  GLYPH_BIND_STAR,
  GLYPH_FAMILIES,
  GLYPH_FAMILY_INFO,
  GLYPH_MAX_LEVEL,
  GLYPH_STAT_NAMES,
  glyphBound,
  glyphLevelCost,
  glyphMain,
  glyphPct,
  glyphSalvage,
  glyphSets,
  glyphTotals,
  type Glyph,
  type GlyphFamily,
  type GlyphStat,
} from './glyphs';
import { WEAPON_GLYPHS, WEAPON_MAX_LEVEL } from './weapons';
import { play } from './sfx';
import { TEST_MODE } from './config';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (text: string) => String(text).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

interface UiHooks {
  showModal(title: string, html: string, ok: string, action?: (() => void) | null, cancel?: boolean, cancelLabel?: string): void;
  render(): void;
}

export const glyphIco = (f: GlyphFamily) => `<i class="glyph-ico ${f}" aria-hidden="true"></i>`;
export const dustChip = (n: number) => `<span class="mat-chip" title="Glyph Dust"><i class="mat-ico dust" aria-hidden="true"></i>${n.toLocaleString()}</span>`;
export const unbinderChip = (n: number) => `<span class="mat-chip" title="Unbinders"><i class="mat-ico unbinder" aria-hidden="true"></i>${n.toLocaleString()}</span>`;

/** A Glyph as a small tile: family stone, stars and level. */
export function glyphTile(g: Glyph, attrs = '', extra = ''): string {
  const info = GLYPH_FAMILY_INFO[g.family];
  return `<button type="button" class="glyph-tile s${g.star}" style="--fam:${info.color}" ${attrs} title="${info.name} Glyph ${g.star}★ +${g.level}">${glyphIco(g.family)}<span class="gt-star">${g.star}★</span>${g.level ? `<span class="gt-lv">+${g.level}</span>` : ''}${glyphBound(g) && g.hero ? '<span class="gt-lock" aria-label="Bound">&#128274;</span>' : ''}${extra}</button>`;
}

/** "ATK +12% · Crit chance +2%" for a set of stat totals. */
function statLine(t: Record<GlyphStat, number>): string {
  const parts = (Object.keys(GLYPH_STAT_NAMES) as GlyphStat[]).filter((k) => t[k] > 0).map((k) => `${GLYPH_STAT_NAMES[k]} ${glyphPct(t[k])}`);
  return parts.join(' · ');
}

/** Results of opening Glyph Chests, as tiles. */
export function glyphDrops(list: Array<{ glyph?: Glyph; dust?: number }>): string {
  const tiles = list.map((x) => (x.glyph ? glyphTile(x.glyph, 'disabled') : '')).join('');
  const dust = list.reduce((t, x) => t + (x.dust ?? 0), 0);
  return `${tiles ? `<div class="glyph-grid">${tiles}</div>` : ''}${dust ? `<p>The bag was full: ${dust} Glyph Dust instead.</p>` : ''}`;
}

export class GlyphUI {
  private filterStar = 0;
  private filterFam: GlyphFamily | '' = '';

  constructor(private state: GameState, private ui: UiHooks) {}

  /** The Glyph section of the hero page's Weapon tab. */
  renderSlots(heroId: string) {
    const s = this.state;
    const host = $('sheet-glyphs');
    const lv = s.weaponLevel(heroId);
    const { slots, maxStar } = s.glyphSlots(heroId);
    const mine = s.heroGlyphs(heroId);
    const key = `${heroId}:${lv}:${s.glyphs.length}:${s.glyphDust}:${s.unbinders}:${mine.map((g) => `${g.id}.${g.level}.${g.slot}`).join(',')}`;
    if (host.dataset.key === key) return;
    host.dataset.key = key;
    const cells: string[] = [];
    for (let i = 0; i < WEAPON_MAX_LEVEL; i++) {
      const g = mine.find((x) => x.slot === i);
      if (i >= slots) {
        const need = Object.entries(WEAPON_GLYPHS).find(([, v]) => v.slots > i)?.[0];
        cells.push(`<span class="glyph-slot locked">Lv ${need}</span>`);
      } else if (g) cells.push(glyphTile(g, `data-gslot="${i}"`));
      else cells.push(`<button type="button" class="glyph-slot open" data-gslot="${i}" aria-label="Add a Glyph">+</button>`);
    }
    const t = glyphTotals(mine);
    const sets = glyphSets(mine);
    const counts: Partial<Record<GlyphFamily, number>> = {};
    for (const g of mine) counts[g.family] = (counts[g.family] ?? 0) + 1;
    const setRows = (Object.entries(counts) as Array<[GlyphFamily, number]>)
      .map(([f, n]) => `<li class="${sets[f] ? 'on' : ''}">${glyphIco(f)}<b>${GLYPH_FAMILY_INFO[f].name}</b> ${n}/${Math.max(3, (Math.floor(n / 3) + (n % 3 ? 1 : 0)) * 3)}<small>${sets[f] ? `Set x${sets[f]}: ` : '3 for a set: '}${GLYPH_FAMILY_INFO[f].setText}</small></li>`)
      .join('');
    host.innerHTML = `
      <h3>Glyphs <button type="button" class="wood-btn small" id="glyph-bag-btn">Bag (${s.bagGlyphs().length})</button></h3>
      <p class="meta">${slots} of ${WEAPON_MAX_LEVEL} slots open, up to ${maxStar}★. Weapon levels open more.</p>
      <div class="glyph-grid slots">${cells.join('')}</div>
      <p class="glyph-total">${statLine(t) || 'No Glyphs yet.'}</p>
      ${setRows ? `<ul class="glyph-sets">${setRows}</ul>` : ''}
      <div class="sc-reward">${dustChip(s.glyphDust)}${unbinderChip(s.unbinders)}</div>
      ${TEST_MODE ? '<button type="button" class="wood-btn small" id="glyph-test-give">Test: +10 Glyphs, +5,000 Dust, +5 Unbinders</button>' : ''}
      <p class="meta">Glyphs come from Rush on the Battle tab. Glyphs of ${GLYPH_BIND_STAR}★ and up are bound to the weapon: taking one out needs an Unbinder (from Scouting), or break it for Dust.</p>`;
    host.onclick = (e) => {
      const el = e.target as HTMLElement;
      if (el.closest('#glyph-bag-btn')) return this.openBag();
      if (TEST_MODE && el.closest('#glyph-test-give')) {
        s.openGlyphChests('glyph', 5);
        s.openGlyphChests('grand', 5);
        s.glyphDust += 5000;
        s.unbinders += 5;
        s.save();
        return this.ui.render();
      }
      const slot = el.closest<HTMLElement>('[data-gslot]');
      if (!slot) return;
      const i = Number(slot.dataset.gslot);
      const g = s.glyphAt(heroId, i);
      if (g) this.openGlyph(g.id);
      else this.openPicker(heroId, i);
    };
  }

  private filters(): string {
    const star = [0, 1, 2, 3, 4, 5, 6].map((n) => `<button type="button" class="chip${this.filterStar === n ? ' on' : ''}" data-gfs="${n}">${n ? `${n}★` : 'All'}</button>`).join('');
    const fam = [`<button type="button" class="chip${this.filterFam === '' ? ' on' : ''}" data-gff="">All</button>`, ...GLYPH_FAMILIES.map((f) => `<button type="button" class="chip${this.filterFam === f ? ' on' : ''}" data-gff="${f}" title="${GLYPH_FAMILY_INFO[f].name}">${glyphIco(f)}</button>`)].join('');
    return `<div class="glyph-filter">${star}</div><div class="glyph-filter">${fam}</div>`;
  }

  /** Apply a filter tap; true if it was one. */
  private onFilter(el: HTMLElement): boolean {
    const st = el.closest<HTMLElement>('[data-gfs]');
    if (st) this.filterStar = Number(st.dataset.gfs);
    const fm = el.closest<HTMLElement>('[data-gff]');
    if (fm) this.filterFam = (fm.dataset.gff ?? '') as GlyphFamily | '';
    return !!(st || fm);
  }

  private bagList(maxStar = 6): Glyph[] {
    return this.state
      .bagGlyphs()
      .filter((g) => g.star <= maxStar && (!this.filterStar || g.star === this.filterStar) && (!this.filterFam || g.family === this.filterFam))
      .sort((a, b) => b.star - a.star || b.level - a.level || a.family.localeCompare(b.family));
  }

  /** The Glyph bag: every Glyph not in a weapon. */
  openBag() {
    const s = this.state;
    const draw = () => {
      const list = this.bagList();
      const low = s.bagGlyphs().filter((g) => g.star <= 2);
      $('modal-body').innerHTML = `
        <div class="sc-reward">${dustChip(s.glyphDust)}${unbinderChip(s.unbinders)}<span class="meta">${s.bagGlyphs().length}/${GLYPH_BAG_CAP}</span></div>
        ${this.filters()}
        <div class="glyph-grid bag">${list.map((g) => glyphTile(g, `data-gid="${g.id}"`)).join('') || '<small class="meta">No Glyphs here. Rush pays Glyph Chests.</small>'}</div>
        ${low.length ? `<button type="button" class="wood-btn small" data-gsalv>Salvage all 1★-2★ (${low.length}) for ${low.reduce((t, g) => t + glyphSalvage(g), 0)} Dust</button>` : ''}`;
    };
    this.ui.showModal('Glyph bag', '', 'Close');
    draw();
    $('modal-body').onclick = (e) => {
      const el = e.target as HTMLElement;
      if (this.onFilter(el)) return draw();
      if (el.closest('[data-gsalv]')) {
        const dust = s.salvageGlyphs(s.bagGlyphs().filter((g) => g.star <= 2).map((g) => g.id));
        if (dust) play('chest');
        this.ui.render();
        return draw();
      }
      const t = el.closest<HTMLElement>('[data-gid]');
      if (t) this.openGlyph(t.dataset.gid!, () => this.openBag());
    };
  }

  /** Pick a bag Glyph for a hero's slot. */
  private openPicker(heroId: string, slot: number) {
    const s = this.state;
    const { maxStar } = s.glyphSlots(heroId);
    const draw = () => {
      const list = this.bagList(maxStar);
      $('modal-body').innerHTML = `<p>Up to ${maxStar}★ fits this weapon. Tap a Glyph to put it in.</p>${this.filters()}<div class="glyph-grid bag">${list.map((g) => glyphTile(g, `data-gpick="${g.id}"`, `<small class="gt-main">${GLYPH_STAT_NAMES[glyphMain(g).stat]}</small>`)).join('') || '<small class="meta">No Glyphs that fit. Rush pays Glyph Chests.</small>'}</div>`;
    };
    const hero = HEROES.find((h) => h.id === heroId)!;
    this.ui.showModal(`${esc(hero.name)}: slot ${slot + 1}`, '', 'Close');
    draw();
    $('modal-body').onclick = (e) => {
      const el = e.target as HTMLElement;
      if (this.onFilter(el)) return draw();
      const t = el.closest<HTMLElement>('[data-gpick]');
      if (t) this.socket(heroId, slot, t.dataset.gpick!);
    };
  }

  /** Put a Glyph in; a bound Glyph already there needs an Unbinder or breaking first. */
  private socket(heroId: string, slot: number, glyphId: string) {
    const s = this.state;
    const cur = s.glyphAt(heroId, slot);
    if (cur && glyphBound(cur)) return this.boundChoice(cur, (how) => s.socketGlyph(heroId, slot, glyphId, how));
    if (s.socketGlyph(heroId, slot, glyphId)) {
      play('unlock');
      $('modal').hidden = true;
      this.ui.render();
    }
  }

  /** Ask how to take out a bound Glyph: Unbinder or break. */
  private boundChoice(g: Glyph, then: (how: 'unbind' | 'break') => boolean) {
    const s = this.state;
    this.ui.showModal(
      'Bound Glyph',
      `<div class="glyph-grid">${glyphTile(g, 'disabled')}</div><p>This ${g.star}★ Glyph is bound to its weapon. Use an Unbinder to take it out safely (you have ${s.unbinders}), or break it for ${glyphSalvage(g)} Glyph Dust.</p>
       <div class="glyph-actions"><button type="button" class="hot" data-gb="unbind" ${s.unbinders > 0 ? '' : 'disabled'}>Use Unbinder</button><button type="button" class="wood-btn" data-gb="break">Break for Dust</button></div>`,
      'Cancel',
    );
    $('modal-body').onclick = (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-gb]');
      if (!b || b.disabled) return;
      if (then(b.dataset.gb as 'unbind' | 'break')) {
        play('unlock');
        $('modal').hidden = true;
        this.ui.render();
      }
    };
  }

  /** One Glyph's page: stats, Level up, take out, salvage. `back` reopens what came before. */
  openGlyph(id: string, back?: () => void) {
    const s = this.state;
    const draw = () => {
      const g = s.glyphs.find((x) => x.id === id);
      if (!g) return back ? back() : (($('modal').hidden = true), undefined);
      const info = GLYPH_FAMILY_INFO[g.family];
      const main = glyphMain(g);
      const next = g.level < GLYPH_MAX_LEVEL ? glyphMain({ ...g, level: g.level + 1 }) : null;
      const cost = glyphLevelCost(g.star, g.level);
      const owner = g.hero ? HEROES.find((h) => h.id === g.hero) : null;
      const subs = g.subs.map(([k, v]) => `<li>${GLYPH_STAT_NAMES[k]} <b>${glyphPct(v)}</b></li>`).join('');
      const out = g.hero
        ? glyphBound(g)
          ? `<button type="button" class="wood-btn" data-ga="out" ${s.unbinders > 0 ? '' : 'disabled'}>Take out (1 Unbinder, have ${s.unbinders})</button><button type="button" class="wood-btn" data-ga="break">Break for ${glyphSalvage(g)} Dust</button>`
          : '<button type="button" class="wood-btn" data-ga="out">Take out</button>'
        : `<button type="button" class="wood-btn" data-ga="salvage">Salvage for ${glyphSalvage(g)} Dust</button>`;
      $('modal-body').innerHTML = `
        <div class="glyph-head">${glyphTile(g, 'disabled')}<div><b style="color:${info.color}">${info.name} Glyph</b><small>${g.star}★ · +${g.level}/${GLYPH_MAX_LEVEL}${owner ? ` · in ${esc(owner.name)}'s weapon` : ' · in the bag'}${glyphBound(g) ? ' · binds to its weapon' : ''}</small></div></div>
        <p class="glyph-main">${GLYPH_STAT_NAMES[main.stat]} <b>${glyphPct(main.value)}</b>${next ? ` <small>next ${glyphPct(next.value)}</small>` : ''}</p>
        ${subs ? `<ul class="glyph-subs">${subs}</ul>` : ''}
        <p class="meta">Set (3 of a family on one hero): ${info.setText}.</p>
        <div class="sc-reward">${dustChip(s.glyphDust)}</div>
        <div class="glyph-actions">${cost !== null ? `<button type="button" class="hot" data-ga="up" ${s.glyphDust >= cost ? '' : 'disabled'}>Level up (${cost} Dust)</button>` : '<span class="meta">Max level</span>'}${out}</div>`;
    };
    this.ui.showModal('Glyph', '', back ? 'Back' : 'Close', back ?? null);
    draw();
    $('modal-body').onclick = (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-ga]');
      if (!b || b.disabled) return;
      const act = b.dataset.ga;
      const g = s.glyphs.find((x) => x.id === id);
      if (!g) return;
      let ok = false;
      if (act === 'up') ok = s.levelGlyph(id);
      else if (act === 'out') ok = s.takeOutGlyph(id, glyphBound(g) ? 'unbind' : undefined);
      else if (act === 'break') ok = s.breakGlyph(id) > 0;
      else if (act === 'salvage') ok = s.salvageGlyphs([id]) > 0;
      if (!ok) return;
      play(act === 'up' ? 'unlock' : 'chest');
      this.ui.render();
      if (act === 'up' || act === 'out') draw();
      else if (back) back();
      else $('modal').hidden = true;
    };
  }
}
