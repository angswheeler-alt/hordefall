/**
 * Screens for Expedition (Battle hub > Expedition): the start page (level, party, Auto-clear), the road map
 * of a run with its choices, and the results. Rules live in src/expedition.ts and GameState; the fights run
 * through UI.fightExpedition (the Colosseum lane, borrowed heroes on the player's side).
 */
import Decimal from 'break_infinity.js';
import { HEROES, type HeroDef } from './data';
import { fmt } from './formulas';
import type { ExpEnd, GameState } from './state';
import {
  EXP_AUTO_SHARE,
  EXP_CHARGE_CAP,
  EXP_ENABLED,
  EXP_HEARTS,
  EXP_HIRE_MAX,
  EXP_NODE_INFO,
  EXP_PARTY_MAX,
  EXP_UNLOCK_LEVEL,
  MYSTERY_OPTIONS,
  autoReward,
  boonById,
  fullReward,
  type ExpHire,
  type ExpLender,
  type ExpNodeKind,
  type ExpReward,
} from './expedition';
import { faceStyle } from './ui';
import { glyphDrops } from './glyphUi';
import { matIcon } from './scoutUi';
import { play } from './sfx';
import { setHtml } from './taps';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (text: string) => String(text).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const hero = (id: string) => HEROES.find((h) => h.id === id)!;
const face = (h: HeroDef, extra = '') => `<span class="face art${extra}" style="${faceStyle(h)}">${h.name[0]}</span>`;

const NODE_ICON: Record<ExpNodeKind, string> = { fight: '⚔️', elite: '💀', camp: '🔥', recruit: '🍺', mystery: '❓', boss: '👑' };
const SOURCE_NAME: Record<ExpHire['source'], string> = { friend: 'Friend', arena: 'Colosseum', traveler: 'Traveler' };

interface UiHooks {
  showModal(title: string, html: string, ok: string, action?: (() => void) | null, cancel?: boolean, cancelLabel?: string): void;
  render(): void;
  fightExpedition(): void;
  expeditionLenders(): Promise<ExpLender[]>;
}

/** What a reward gives, as chips. */
export function expRewardChips(r: ExpReward): string {
  const out: string[] = [];
  if (r.gems) out.push(`<span class="mat-chip" title="Gems"><span class="gem"></span>${r.gems}</span>`);
  if (r.wild) out.push(`<span class="mat-chip" title="Wild Crests">${matIcon('wild')}${r.wild}</span>`);
  if (r.stones) out.push(`<span class="mat-chip" title="Enhance Stones"><i class="stone"></i>${r.stones}</span>`);
  if (r.chest) out.push(`<span class="mat-chip" title="${r.chest === 'grand' ? 'Rare Glyph Chest' : 'Glyph Chest'}">${matIcon(r.chest)}1</span>`);
  return out.join('');
}

export function expEndHtml(e: ExpEnd): string {
  const head = e.auto
    ? `<p class="tf-result win">Auto-cleared level ${e.level}!</p>`
    : e.cleared
      ? `<p class="tf-result win">Expedition level ${e.level} cleared!${e.newBest ? ` Level ${e.level + 1} is open, and you can now Auto-clear level ${e.level}.` : ''}</p>`
      : `<p class="tf-result lose">The Expedition is over. You keep loot for the stops you cleared.</p>`;
  return `${head}<div class="sc-reward big">${expRewardChips(e.reward)}</div>${glyphDrops(e.glyphs)}`;
}

export class ExpeditionUI {
  /** Level and party picked on the start page. */
  private level = 0;
  private party: string[] | null = null;
  private starting = false;

  constructor(private state: GameState, private ui: UiHooks) {
    $('exp').addEventListener('click', (e) => void this.onClick(e));
  }

  /** The Expedition card on the Battle hub. */
  renderHub(now = Date.now()) {
    document.querySelector<HTMLElement>('.mode-card.exp')!.hidden = !EXP_ENABLED;
    if (!EXP_ENABLED) return;
    const s = this.state;
    const open = s.expOpen();
    if (open) s.expSync(now);
    const e = s.expedition;
    $('hub-exp-count').textContent = open ? `${e.charges}/${EXP_CHARGE_CAP}` : '-';
    $('hub-exp-note').textContent = !open ? `Opens at player level ${EXP_UNLOCK_LEVEL}` : e.run ? `Under way: level ${e.run.level}, stop ${e.run.row + 1}` : e.best ? `Best level ${e.best}` : 'A short adventure of choices';
  }

  private partyIds(): string[] {
    const s = this.state;
    if (!this.party) this.party = s.expDefaultParty();
    this.party = this.party.filter((id) => (s.levels[id] ?? 0) > 0);
    if (!this.party.length) this.party = s.expDefaultParty();
    return this.party;
  }

  render(now = Date.now()) {
    const s = this.state;
    const host = $('exp');
    if (!s.expOpen()) {
      setHtml(host, `<div class="trial-card"><p>A short adventure: pick your path, pick Boons and hire other players' heroes on the way to a boss.</p><small>Opens at player level ${EXP_UNLOCK_LEVEL}. You are level ${s.keeperLevel()}.</small></div>`);
      return;
    }
    s.expSync(now);
    const html = s.expedition.run ? this.runHtml() : this.startHtml(now);
    if (host.dataset.html !== html) {
      host.dataset.html = html;
      host.innerHTML = html;
    }
  }

  private chargesHtml(now: number): string {
    const e = this.state.expedition;
    const pips = Array.from({ length: EXP_CHARGE_CAP }, (_, i) => `<i class="${i < e.charges ? 'on' : ''}"></i>`).join('');
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const hrs = Math.max(1, Math.ceil((midnight.getTime() - now) / 3_600_000));
    return `<div class="exp-charges"><span class="exp-pips">${pips}</span><small>${e.charges}/${EXP_CHARGE_CAP} charges · ${e.charges >= EXP_CHARGE_CAP ? 'full' : `+1 in about ${hrs} h`}</small></div>`;
  }

  private startHtml(now: number): string {
    const s = this.state;
    const e = s.expedition;
    const max = s.expMaxLevel();
    if (this.level < 1 || this.level > max) this.level = max;
    const lv = this.level;
    const party = this.partyIds().map(hero);
    const block = s.expStartBlock(lv, this.partyIds());
    const canAuto = lv <= e.best && e.charges > 0;
    return `${this.chargesHtml(now)}
      <div class="trial-card exp-start">
        <div class="trial-row"><div class="trial-tier"><button type="button" class="wood-btn small" data-exp-lv="-1" ${lv <= 1 ? 'disabled' : ''} aria-label="Lower level">&#8249;</button><span>Level ${lv}</span><button type="button" class="wood-btn small" data-exp-lv="1" ${lv >= max ? 'disabled' : ''} aria-label="Higher level">&#8250;</button></div><small class="meta">${e.best ? `Best: level ${e.best}` : 'Clear level 1 to open level 2'}</small></div>
        <p class="meta">Full clear pays:</p><div class="sc-reward">${expRewardChips(fullReward(lv))}</div>
        <h4>Your party <small class="meta">up to ${EXP_PARTY_MAX}, plus ${EXP_HIRE_MAX} borrowed heroes on the road</small></h4>
        <div class="exp-party">${party.map((h) => face(h)).join('')}<button type="button" class="wood-btn small" data-exp-party>Change</button></div>
        <div class="glyph-actions"><button type="button" class="hot" data-exp-start ${block || this.starting ? 'disabled' : ''}>${this.starting ? 'Finding heroes…' : 'Start (1 charge)'}</button>${lv <= e.best ? `<button type="button" class="wood-btn" data-exp-auto ${canAuto ? '' : 'disabled'}>Auto-clear (${Math.round(EXP_AUTO_SHARE * 100)}%)</button>` : ''}</div>
        ${block && !block.startsWith('Clear') ? `<p class="meta">${esc(block)}</p>` : ''}
        ${lv <= e.best ? `<p class="meta">Auto-clear skips the run and pays:</p><div class="sc-reward">${expRewardChips(autoReward(lv))}</div>` : ''}
      </div>`;
  }

  private runHtml(): string {
    const s = this.state;
    const r = s.expedition.run!;
    const hearts = Array.from({ length: EXP_HEARTS }, (_, i) => `<i class="${i < r.hearts ? 'on' : ''}">❤</i>`).join('');
    const parts: string[] = [];
    parts.push(`<div class="rush-top">
      <div class="rush-stat"><small>Level</small><b>${r.level}</b></div>
      <div class="rush-stat"><small>Hearts</small><b class="exp-hearts">${hearts}</b></div>
      <div class="rush-stat"><small>Party power</small><b>${fmt(s.expPartyPower())}</b></div>
    </div>`);
    parts.push(this.offerHtml() || this.stopHtml());
    // The road: rows passed, the current one, and what lies ahead.
    const rows = r.map
      .map((row, i) => {
        const cells = row
          .map((k, j) => {
            const taken = i < r.row && r.path[i] === j;
            const here = i === r.row && r.at === j;
            const pick = i === r.row && r.at < 0 && !r.offer;
            const cls = `exp-node ${k}${taken ? ' taken' : ''}${here ? ' here' : ''}${i < r.row && !taken ? ' skipped' : ''}${i > r.row ? ' ahead' : ''}`;
            const inner = `<span class="exp-ico">${NODE_ICON[k]}</span><small>${EXP_NODE_INFO[k].name}</small>`;
            return pick ? `<button type="button" class="${cls} pick" data-exp-pick="${j}">${inner}</button>` : `<span class="${cls}">${inner}</span>`;
          })
          .join('');
        return `<div class="exp-row${i === r.row ? ' now' : ''}"><b class="exp-num">${i + 1}</b>${cells}</div>`;
      })
      .reverse()
      .join('');
    parts.push(`<div class="exp-map">${rows}</div>`);
    const own = r.party.map((id) => face(hero(id))).join('');
    const hired = r.hires.map((h) => `<span class="exp-hire" title="${esc(h.owner)}">${face(hero(h.id), ' borrowed')}<small>${esc(h.owner)}</small></span>`).join('');
    parts.push(`<h4>Party</h4><div class="exp-party">${own}${hired}</div>`);
    const boons = r.boons.map((id) => boonById(id)).filter((b) => !!b);
    parts.push(`<h4>Boons</h4>${boons.length ? `<div class="exp-boons">${boons.map((b) => `<span class="exp-boon small" title="${esc(b!.text)}"><b>${esc(b!.name)}</b><small>${esc(b!.text)}</small></span>`).join('')}</div>` : '<p class="meta">None yet. Win fights to pick some.</p>'}`);
    parts.push(`<p class="meta"><button type="button" class="wood-btn small" data-exp-quit>Give up</button> Giving up keeps the loot for stops cleared so far.</p>`);
    return parts.join('');
  }

  /** The current stop: choose a path, or the fight waiting there. */
  private stopHtml(): string {
    const s = this.state;
    const r = s.expedition.run!;
    if (r.at < 0) return `<p class="exp-say">${r.row === r.map.length - 1 ? 'The warlord waits ahead.' : 'The road forks. Tap where to go next.'}</p>`;
    const f = r.foe;
    if (!f) return '';
    const kind = s.expNode()!;
    const fc = s.expForecast();
    const line = fc ? (fc.won ? 'Forecast: a win.' : 'Forecast: tough. Boons and luck can still turn it.') : '';
    return `<div class="trial-card exp-foe ${kind}"><b>${NODE_ICON[kind]} ${esc(f.name)}</b><div class="exp-party">${f.heroes.map((x) => face(hero(x.id))).join('')}</div><small>Power ${fmt(new Decimal(f.cp))} · ${line}</small><div class="glyph-actions"><button type="button" class="hot" data-exp-fight>Fight</button></div><small class="meta">A loss costs a heart; you can try again.</small></div>`;
  }

  /** Choices waiting for the player. */
  private offerHtml(): string {
    const s = this.state;
    const r = s.expedition.run!;
    const o = r.offer;
    if (!o) return '';
    if (o.kind === 'boon' || o.kind === 'camp') {
      const cards = (o.boons ?? []).map((id) => {
        const b = boonById(id)!;
        return `<button type="button" class="exp-boon" data-exp-boon="${id}"><b>${esc(b.name)}</b><small>${esc(b.text)}</small></button>`;
      });
      if (o.kind === 'camp') cards.unshift(`<button type="button" class="exp-boon rest" data-exp-rest ${r.hearts >= EXP_HEARTS ? 'disabled' : ''}><b>Rest</b><small>Get a heart back${r.hearts >= EXP_HEARTS ? ' (hearts full)' : ''}</small></button>`);
      return `<p class="exp-say">${o.kind === 'camp' ? '🔥 A quiet camp. Rest, or train for a Boon:' : 'Victory! Pick a Boon:'}</p><div class="exp-boons">${cards.join('')}</div>`;
    }
    if (o.kind === 'hire') {
      const full = r.hires.length >= EXP_HIRE_MAX;
      const cards = (o.hires ?? []).map((h, i) => {
        const def = hero(h.id);
        return `<button type="button" class="exp-boon hire" data-exp-hire="${i}">${face(def)}<b>${esc(def.name)} ${h.stars + 1}★</b><small>${SOURCE_NAME[h.source]}: ${esc(h.owner)}</small><small>${def.element} · ${def.type} · Power ${fmt(new Decimal(h.cp))}</small></button>`;
      });
      return `<p class="exp-say">🍺 Heroes for hire, free of charge${full ? `. Your party already has ${EXP_HIRE_MAX} borrowed heroes, so a new one replaces one.` : ':'}</p><div class="exp-boons">${cards.join('')}</div><p><button type="button" class="wood-btn small" data-exp-hire="-1">No thanks, walk on</button></p>`;
    }
    const opts = (o.mystery ?? []).map((id) => {
      const m = MYSTERY_OPTIONS.find((x) => x.id === id)!;
      const ok = s.expMysteryOk(id);
      return `<button type="button" class="exp-boon" data-exp-myst="${id}" ${ok ? '' : 'disabled'}><b>${esc(m.label)}</b><small>${esc(m.text)}${ok ? '' : ' (needs 2 hearts)'}</small></button>`;
    });
    return `<p class="exp-say">❓ Something odd on the road…</p><div class="exp-boons">${opts.join('')}</div>`;
  }

  private async onClick(e: Event) {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!btn || btn.disabled) return;
    const s = this.state;
    const d = btn.dataset;
    if (d.expLv) {
      this.level += Number(d.expLv);
      return this.render();
    }
    if (d.expParty !== undefined) return this.pickParty();
    if (d.expAuto !== undefined) {
      const res = s.expAuto(this.level);
      if (!res) return;
      play('chest');
      this.ui.showModal('Expedition', expEndHtml(res), 'Collect');
      return this.ui.render();
    }
    if (d.expStart !== undefined) {
      if (this.starting) return;
      this.starting = true;
      this.render();
      const lenders = await this.ui.expeditionLenders().catch(() => []);
      this.starting = false;
      if (s.expStart(this.level, this.partyIds(), lenders)) play('unlock');
      return this.ui.render();
    }
    if (d.expPick) {
      s.expPick(Number(d.expPick));
      return this.ui.render();
    }
    if (d.expFight !== undefined) return this.ui.fightExpedition();
    if (d.expBoon) {
      if (s.expTakeBoon(d.expBoon)) play('unlock');
      return this.ui.render();
    }
    if (d.expRest !== undefined) {
      s.expRest();
      return this.ui.render();
    }
    if (d.expHire) return this.hire(Number(d.expHire));
    if (d.expMyst) {
      const text = s.expMystery(d.expMyst as (typeof MYSTERY_OPTIONS)[number]['id']);
      if (text) this.ui.showModal('Mystery', `<p>${esc(text)}</p>`, 'Okay');
      return this.ui.render();
    }
    if (d.expQuit !== undefined) {
      this.ui.showModal('Give up?', '<p>The run ends now. You keep the loot for the stops you cleared, and the charge is spent.</p>', 'Give up', () => {
        const res = s.expAbandon();
        if (res) this.ui.showModal('Expedition', expEndHtml(res), 'Collect');
        this.ui.render();
      }, true, 'Keep going');
    }
  }

  private hire(index: number) {
    const s = this.state;
    const r = s.expedition.run;
    if (!r) return;
    if (index < 0 || r.hires.length < EXP_HIRE_MAX) {
      s.expHire(index);
      if (index >= 0) play('unlock');
      return this.ui.render();
    }
    // Party full: pick who leaves.
    const rows = r.hires.map((h, i) => `<button type="button" class="exp-boon hire" data-exp-swap="${i}">${face(hero(h.id))}<b>${esc(hero(h.id).name)}</b><small>${esc(h.owner)}</small></button>`).join('');
    this.ui.showModal('Who leaves?', `<p>Your party has ${EXP_HIRE_MAX} borrowed heroes. Pick one to send home.</p><div class="exp-boons">${rows}</div>`, 'Cancel');
    $('modal-body').onclick = (ev) => {
      const b = (ev.target as HTMLElement).closest<HTMLElement>('[data-exp-swap]');
      if (!b) return;
      $('modal').hidden = true;
      if (s.expHire(index, Number(b.dataset.expSwap))) play('unlock');
      this.ui.render();
    };
  }

  /** Pick up to EXP_PARTY_MAX of the player's heroes. */
  private pickParty() {
    const s = this.state;
    const chosen = new Set(this.partyIds());
    const draw = () => {
      const tiles = s
        .expHeroes()
        .map((h) => `<button type="button" class="g-pick${chosen.has(h.id) ? ' on' : ''}" data-exp-ph="${h.id}">${face(h)}<b>${esc(s.formDef(h).name)}</b><small>${(s.stars[h.id] ?? 0) + 1}★ · CP ${fmt(s.heroCombatPower(h))}</small></button>`)
        .join('');
      setHtml($('modal-body'), `<p>Pick up to ${EXP_PARTY_MAX} heroes (${chosen.size} picked). Foes are matched to your party's power when the run starts.</p><div class="g-picks">${tiles}</div>`);
    };
    this.ui.showModal('Expedition party', '', 'Done', () => {
      if (chosen.size) this.party = [...chosen];
      this.render();
    });
    draw();
    $('modal-body').onclick = (ev) => {
      const b = (ev.target as HTMLElement).closest<HTMLElement>('[data-exp-ph]');
      if (!b) return;
      const id = b.dataset.expPh!;
      if (chosen.has(id)) chosen.delete(id);
      else if (chosen.size < EXP_PARTY_MAX) chosen.add(id);
      draw();
    };
  }

  help() {
    this.ui.showModal(
      'Expedition',
      `<p>A short adventure of choices, about ${8} stops long. Play it when you like: you get one charge a day, and charges stack up to ${EXP_CHARGE_CAP}.</p>
       <p><b>The road:</b> at each fork pick where to go: ⚔️ Fight, 💀 Elite (harder, more loot), 🔥 Camp, 🍺 Tavern or ❓ Mystery. The 👑 boss waits at the end.</p>
       <p><b>Boons:</b> after every won fight, pick one of three Boons, like more ATK for Fire heroes or for Knights. They last for the whole run.</p>
       <p><b>Borrowed heroes:</b> Taverns offer heroes from your friends, Colosseum players and travelers. Up to ${EXP_HIRE_MAX} join your party, matched to your own heroes' strength.</p>
       <p><b>Hearts:</b> you have ${EXP_HEARTS}. A lost fight costs one and you can try again. With none left the run ends, and you keep part of the loot.</p>
       <p><b>Levels:</b> foes match your party's power and get stronger each level. Clear a level by hand to open the next, and to Auto-clear it later for ${Math.round(EXP_AUTO_SHARE * 100)}% of the loot.</p>`,
      'Got it',
    );
  }
}
