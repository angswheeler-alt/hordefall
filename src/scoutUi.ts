/**
 * Screens for Scouting (Battle hub > Scouting) and weapons (hero page > Weapon tab). Rules live in
 * src/scouting.ts, src/weapons.ts and GameState; this file only draws them.
 */
import { HEROES, type HeroDef } from './data';
import { fmtDuration } from './formulas';
import type { GameState } from './state';
import { SCOUT_BONUS_COMMONS, SCOUT_KINDS, SCOUT_MATCH_MULT, SCOUT_UNLOCK_LEVEL, WILD_CREST_COST, fullReward, missionEndsAt, scoutReward, type ScoutReward } from './scouting';
import { FORGE_MATS, FORGE_MAT_NAMES, WEAPON_GLYPHS, WEAPON_LOOK_NAMES, WEAPON_MAX_LEVEL, WEAPON_STAT_STEP, weaponLook, weaponMult, type ForgeMat } from './weapons';
import { faceStyle, dropCards } from './ui';
import { play } from './sfx';
import { setHtml } from './taps';
import { glyphDrops } from './glyphUi';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (text: string) => String(text).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const hero = (id: string) => HEROES.find((h) => h.id === id)!;

const MAT_CLASS: Record<ForgeMat | 'wild' | 'unbinder' | 'glyph' | 'grand', string> = { ore: 'ore', crystal: 'crystal', coreC: 'core-c', coreR: 'core-r', coreE: 'core-e', wild: 'wild', unbinder: 'unbinder', glyph: 'glyph-chest', grand: 'glyph-grand' };
const MAT_SHORT: Record<ForgeMat | 'wild' | 'unbinder' | 'glyph' | 'grand', string> = { ore: 'Ore', crystal: 'Crystal', coreC: 'Common Core', coreR: 'Rare Core', coreE: 'Epic Core', wild: 'Wild Crests', unbinder: 'Unbinders', glyph: 'Glyph Chest (1-3★)', grand: 'Rare Glyph Chest (3-6★)' };
export const matIcon = (m: ForgeMat | 'wild' | 'unbinder' | 'glyph' | 'grand') => `<i class="mat-ico ${MAT_CLASS[m]}" aria-hidden="true"></i>`;

/** "120 Ore · 4 Common Cores" style list with icons. */
export function rewardChips(r: ScoutReward): string {
  return (Object.entries(r) as Array<[ForgeMat | 'wild' | 'unbinder' | 'glyph' | 'grand', number]>)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `<span class="mat-chip" title="${MAT_SHORT[k]}">${matIcon(k)}${n.toLocaleString()}</span>`)
    .join('');
}

interface UiHooks {
  showModal(title: string, html: string, ok: string, action?: (() => void) | null, cancel?: boolean, cancelLabel?: string): void;
  render(): void;
}

export class ScoutUI {
  /** Heroes picked in the open team picker. */
  private picks: string[] = [];
  private pickSlot = '';

  constructor(private state: GameState, private ui: UiHooks) {
    $('sc-board').addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-sc]');
      if (!btn || btn.disabled) return;
      const slot = btn.dataset.slot!;
      if (btn.dataset.sc === 'send') this.openPicker(slot);
      else if (btn.dataset.sc === 'claim') this.claim(slot);
      else if (btn.dataset.sc === 'recall') this.ui.showModal('Call back?', '<p>The heroes come home now and this mission pays nothing.</p>', 'Call back', () => {
        this.state.recallScout(slot);
        this.ui.render();
      }, true, 'Keep going');
    });
    $('sc-mats').addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('[data-sc-wild]')) this.pickWildHero();
    });
    $('sc-help').addEventListener('click', () => this.help());
  }

  /** The Scouting card on the Battle hub. */
  renderHub() {
    const s = this.state;
    const open = s.scoutOpen();
    const ready = s.scoutReadyCount();
    const running = s.scout.slots.filter((x) => x.mission?.startedAt).length;
    $('hub-sc-count').textContent = open ? s.forge.ore.toLocaleString() : '-';
    $('hub-sc-note').textContent = !open ? `Opens at player level ${SCOUT_UNLOCK_LEVEL}` : ready ? `${ready} mission${ready > 1 ? 's' : ''} back!` : running ? `${running} mission${running > 1 ? 's' : ''} out` : 'Send heroes out for weapon materials';
    $('hub-sc-alert').hidden = !ready;
  }

  /** The Scouting page: materials and the mission board. */
  renderBoard(now = Date.now()) {
    const s = this.state;
    const mats = $('sc-mats');
    const board = $('sc-board');
    if (!s.scoutOpen()) {
      setHtml(mats, '');
      setHtml(board, `<div class="trial-card"><p>Send heroes on timed missions for Ancient Ore, Raw Crystal and Forge Cores, used to upgrade weapons.</p><small>Opens at player level ${SCOUT_UNLOCK_LEVEL}. You are level ${s.keeperLevel()}.</small></div>`);
      return;
    }
    const slots = s.scoutBoard(now);
    setHtml(
      mats,
      FORGE_MATS.map((m) => `<span class="mat-chip" title="${FORGE_MAT_NAMES[m]}">${matIcon(m)}${s.forge[m].toLocaleString()}</span>`).join('') +
        `<button type="button" class="mat-chip wild-btn" data-sc-wild ${s.wildCrests > 0 ? '' : 'disabled'} title="Wild Crests: tap to use">${matIcon('wild')}${s.wildCrests}</button>` +
        `<span class="mat-chip" title="Unbinders">${matIcon('unbinder')}${s.unbinders}</span>`,
    );
    const cards = slots.map((sl) => {
      const k = SCOUT_KINDS[sl.kind];
      const m = sl.mission;
      if (!m) {
        return `<div class="sc-card ${sl.kind} empty"><div class="sc-head"><b>${k.name} mission</b></div><small>New mission in <span data-sc-end="${sl.readyAt}"></span></small></div>`;
      }
      const head = `<div class="sc-head"><span class="sc-kind">${k.name}</span><b>${m.hours} h · ${m.size} heroes</b><span class="sc-rec"><span class="el-pip ${m.element}"></span>${cap(m.element)} · ${m.type}</span></div>`;
      if (!m.startedAt) {
        return `<div class="sc-card ${sl.kind}">${head}<div class="sc-reward">${rewardChips(fullReward(m))}</div><button type="button" class="hot sc-go" data-sc="send" data-slot="${sl.slot}">Send heroes</button></div>`;
      }
      const faces = m.heroes.map((id) => `<span class="face art sc-face" style="${faceStyle(hero(id))}">${hero(id).name[0]}</span>`).join('');
      const { share } = s.scoutScore(sl.slot, m.heroes);
      const done = now >= missionEndsAt(m);
      const reward = rewardChips(scoutReward(m, share));
      return `<div class="sc-card ${sl.kind} ${done ? 'done' : 'running'}">${head}<div class="sc-team">${faces}<small>${Math.round(share * 100)}% score</small></div><div class="sc-reward">${reward}</div>${
        done
          ? `<button type="button" class="hot sc-go" data-sc="claim" data-slot="${sl.slot}">Collect</button>`
          : `<div class="sc-run"><span class="sc-timer"><span data-sc-end="${missionEndsAt(m)}"></span> left</span><button type="button" class="wood-btn small" data-sc="recall" data-slot="${sl.slot}">Call back</button></div>`
      }</div>`;
    });
    const toBonus = SCOUT_BONUS_COMMONS - s.scout.commons;
    const note = s.scout.slots.some((x) => x.slot === 'rb') ? '' : `<p class="sc-note">${toBonus} more Common mission${toBonus === 1 ? '' : 's'} for a bonus Rare mission.</p>`;
    setHtml(board, cards.join('') + note);
    // Countdowns tick in place, so the cards (and their buttons) are only rebuilt when something changes.
    for (const el of board.querySelectorAll<HTMLElement>('[data-sc-end]')) {
      const text = fmtDuration(Math.max(0, Math.ceil((Number(el.dataset.scEnd) - now) / 1000)));
      if (el.textContent !== text) el.textContent = text;
    }
  }

  private claim(slot: string) {
    const r = this.state.claimScout(slot);
    if (!r) return;
    play('chest');
    this.ui.showModal('Mission complete', `<div class="sc-reward big">${rewardChips(r) || 'Nothing this time.'}</div>${r.wild ? '<p>Wild Crests go to any hero you pick: tap them at the top of the Scouting page.</p>' : ''}${r.unbinder ? '<p>Unbinders take a bound Glyph out of a weapon safely.</p>' : ''}${glyphDrops(this.state.lastScoutGlyphs)}`, 'Collect');
    this.ui.render();
  }

  private openPicker(slot: string) {
    const s = this.state;
    const m = s.scout.slots.find((x) => x.slot === slot)?.mission;
    if (!m || m.startedAt) return;
    this.pickSlot = slot;
    this.picks = s.scoutAutoPick(slot);
    this.ui.showModal(`${SCOUT_KINDS[m.kind].name} mission`, '', 'Send', () => {
      if (s.startScout(slot, this.picks)) play('unlock');
      this.ui.render();
    }, true, 'Cancel');
    $('modal-body').onclick = (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-scpick]');
      if (!btn || this.pickSlot !== slot) return;
      const id = btn.dataset.scpick!;
      if (id === '__auto') this.picks = s.scoutAutoPick(slot);
      else if (id === '__clear') this.picks = [];
      else if (this.picks.includes(id)) this.picks = this.picks.filter((x) => x !== id);
      else if (this.picks.length < m.size) this.picks.push(id);
      this.drawPicker();
    };
    this.drawPicker();
  }

  private drawPicker() {
    const s = this.state;
    const slot = this.pickSlot;
    const m = s.scout.slots.find((x) => x.slot === slot)?.mission;
    if (!m) return;
    const { score, target, share } = s.scoutScore(slot, this.picks);
    const tile = (h: HeroDef, picked: boolean) => {
      const def = s.formDef(h);
      const tags = `${def.type === m.type ? '<i class="sc-match">Type</i>' : ''}${def.element === m.element ? '<i class="sc-match el">Element</i>' : ''}`;
      return `<button type="button" class="g-pick sc-pick${picked ? ' on' : ''}" data-scpick="${h.id}"><span class="face art" style="${faceStyle(h)}">${h.name[0]}</span><b>${esc(def.name)}</b><small>${s.scoutHeroScore(slot, h.id)} pts</small><span class="sc-tags">${tags}</span></button>`;
    };
    const free = s.scoutCandidates(slot).filter((h) => !this.picks.includes(h.id));
    const team = this.picks.map((id) => tile(hero(id), true)).join('') || '<small class="meta">Tap heroes below to add them.</small>';
    $('modal-body').innerHTML = `
      <p class="sc-want">Wants: <b>${m.type}</b> and <span class="el-pip ${m.element}"></span><b>${cap(m.element)}</b> heroes (x${SCOUT_MATCH_MULT} score each). ${m.hours} hours, up to ${m.size} heroes.</p>
      <div class="sc-score"><div class="crest-bar"><div style="width:${Math.min(100, (score / target) * 100)}%"></div></div><span>Team Score ${score} / ${target} · pays ${Math.round(share * 100)}%</span></div>
      <div class="sc-reward">${rewardChips(scoutReward(m, share))}</div>
      <h4>Team (${this.picks.length}/${m.size}) <button type="button" class="wood-btn small" data-scpick="__auto">Best team</button> <button type="button" class="wood-btn small" data-scpick="__clear">Clear</button></h4>
      <div class="g-picks sc-team-picks">${team}</div>
      <h4>Free heroes</h4>
      <div class="g-picks">${free.map((h) => tile(h, false)).join('') || '<small class="meta">Every hero is out scouting.</small>'}</div>`;
    $<HTMLButtonElement>('modal-ok').disabled = this.picks.length === 0;
  }

  private help() {
    this.ui.showModal(
      'Scouting',
      `<p>Send teams of heroes on missions. They come back after the mission's hours with weapon materials. Heroes still fight while they're away, but each hero goes on one mission at a time.</p>
       <p><b>Team Score:</b> each hero gives 10 per yellow star, 5 per pink star and 5 per weapon level above 1. A hero of the wanted Type scores x${SCOUT_MATCH_MULT}, and again x${SCOUT_MATCH_MULT} for the wanted element. The score against the mission's target sets how much of the reward you get.</p>
       <p><b>Board:</b> 3 Common missions (1-4 h) and 1 Rare (4-6 h, the main source of Rare and Epic Forge Cores, plus an Unbinder and a Glyph Chest). A collected mission's slot gets a new one at the next full hour. Every ${SCOUT_BONUS_COMMONS} Commons add a bonus Rare.</p>
       <p><b>Gilded mission:</b> one a day. It pays a Rare Glyph Chest, 2 Unbinders and Wild Crests, which turn into crests for any hero you pick (Common ${WILD_CREST_COST.common}, Rare ${WILD_CREST_COST.rare}, Epic ${WILD_CREST_COST.epic} per crest). Legendary and Ascendant heroes are left out.</p>`,
      'Got it',
    );
  }

  /** Pick a hero for Wild Crests. */
  pickWildHero(only?: string) {
    const s = this.state;
    const pool = HEROES.filter((h) => s.wildCrestCost(h.id) !== null && (!only || h.id === only));
    if (only && pool.length) return this.wildAmount(pool[0]);
    const faces = pool
      .sort((a, b) => Number((s.levels[b.id] ?? 0) > 0) - Number((s.levels[a.id] ?? 0) > 0) || a.name.localeCompare(b.name))
      .map((h) => {
        const cost = s.wildCrestCost(h.id)!;
        return `<button type="button" class="g-pick" data-wild="${h.id}" ${s.wildCrests < cost ? 'disabled' : ''}><span class="face art" style="${faceStyle(h)}">${h.name[0]}</span><b>${esc(h.name)}</b><small>${(s.levels[h.id] ?? 0) > 0 ? '' : 'Locked · '}${cost} each</small></button>`;
      })
      .join('');
    this.ui.showModal('Wild Crests', `<p>Pick the hero these crests go to. You have ${s.wildCrests} Wild Crests.</p><div class="g-picks">${faces}</div>`, 'Cancel');
    $('modal-body').onclick = (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-wild]');
      if (btn && !btn.disabled) this.wildAmount(hero(btn.dataset.wild!));
    };
  }

  private wildAmount(h: HeroDef) {
    const s = this.state;
    const cost = s.wildCrestCost(h.id);
    if (cost === null) return;
    const most = Math.floor(s.wildCrests / cost);
    const amounts = [...new Set([1, 5, 10, most].filter((n) => n >= 1 && n <= most))].sort((a, b) => a - b);
    this.ui.showModal(
      `Crests for ${esc(h.name)}`,
      `<p>${cost} Wild Crest${cost > 1 ? 's' : ''} per crest. You have ${s.wildCrests}.</p><div class="g-wild-amounts">${amounts.map((n) => `<button type="button" class="gem-btn" data-wn="${n}">${n === most && n > 10 ? 'Max ' : ''}x${n}<small>${n * cost} Wild</small></button>`).join('') || 'Not enough Wild Crests.'}</div>`,
      'Cancel',
    );
    $('modal-body').onclick = (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-wn]');
      if (!btn) return;
      const drops = s.useWildCrests(h.id, Number(btn.dataset.wn));
      if (!drops) return;
      play('chest');
      this.ui.showModal('Wild Crests', `${dropCards(drops)}`, 'Collect');
      this.ui.render();
    };
  }

  /** The hero page's Weapon tab. */
  renderWeapon(id: string) {
    const s = this.state;
    const lv = s.weaponLevel(id);
    const look = weaponLook(lv);
    const cost = s.weaponCost(id);
    const block = s.weaponBlock(id);
    const pct = (x: number) => `+${Math.round((x - 1) * 100)}%`;
    const costRows = cost
      ? FORGE_MATS.filter((m) => cost[m])
          .map((m) => {
            const need = cost[m]!;
            const have = s.forge[m];
            return `<li class="${have >= need ? 'met' : ''}">${matIcon(m)}<span>${FORGE_MAT_NAMES[m]}</span><b>${have.toLocaleString()} / ${need.toLocaleString()}</b></li>`;
          })
          .join('')
      : '';
    const html = `
      <h3>Weapon</h3>
      <div class="wp-top"><i class="wp-ico look-${look}" aria-hidden="true"></i><div><b>Level ${lv} / ${WEAPON_MAX_LEVEL}</b><small>${WEAPON_LOOK_NAMES[look]} weapon · ATK and HP ${pct(weaponMult(lv))}</small></div></div>
      ${cost ? `<p class="meta">Next level: ATK and HP ${pct(weaponMult(lv + 1))}, ${WEAPON_GLYPHS[lv + 1].slots} Glyph slots${WEAPON_GLYPHS[lv + 1].maxStar > WEAPON_GLYPHS[lv].maxStar ? ` holding up to ${WEAPON_GLYPHS[lv + 1].maxStar}★` : ''}${weaponLook(lv + 1) !== look ? `, and the weapon turns ${WEAPON_LOOK_NAMES[weaponLook(lv + 1)]}` : ''}.</p><ul class="wp-cost">${costRows}</ul>
      <button type="button" class="hot evolve" id="sheet-weapon-up" ${block ? 'disabled' : ''}>${block && block !== 'Not enough materials' ? block : `Upgrade to level ${lv + 1}`}</button>` : '<p class="meta">This weapon is at max level.</p>'}
      <p class="meta">Each weapon level gives ${Math.round((WEAPON_STAT_STEP - 1) * 100)}% more ATK and HP (compounding) and opens a Glyph slot. Materials come from Scouting on the Battle tab${s.scoutOpen() ? '' : `, which opens at player level ${SCOUT_UNLOCK_LEVEL}`}.</p>`;
    const host = $('sheet-weapon');
    const key = `${id}:${lv}:${FORGE_MATS.map((m) => s.forge[m]).join(',')}:${s.scoutOpen()}:${block}`;
    if (host.dataset.key === key) return;
    host.dataset.key = key;
    host.innerHTML = html;
    $('sheet-weapon-up')?.addEventListener('click', () => {
      if (s.upgradeWeapon(id)) {
        play('unlock');
        this.ui.render();
      }
    });
  }
}
