/**
 * Hold the Walls page (Battle hub > Hold the Walls), full screen like the Colosseum and the Element Towers: this
 * week's raiders, the week's best with its Glyph Chest marks, the three walls (raider element, the heroes on it
 * and how many waves it should hold) and a bar at the bottom with today's defense. Rules live in src/walls.ts
 * and GameState.
 */
import { ELEMENT_COLORS, ESSENCE_NAMES, HEROES, type Element } from './data';
import { fmt } from './formulas';
import { dayKey } from './rewards';
import type { GameState, WallsResult } from './state';
import { WALL_COUNT, WALL_NAMES, WALL_SIZE, WALL_WAVES, WALL_WEEK_TIERS, wallFit, wallReward } from './walls';
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
  openWallTeam(wall: number): void;
  defendWalls(): void;
  watchWall(wall: number): void;
}

/** Time until the next local midnight, as "5h 12m". */
function untilTomorrow(now: number): string {
  const d = new Date(now);
  d.setHours(24, 0, 0, 0);
  const m = Math.max(1, Math.ceil((d.getTime() - now) / 60_000));
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}

export class WallsUI {
  private sig = '';
  private forecast: number[] = [0, 0, 0];

  constructor(private state: GameState, private ui: UiHooks) {
    $('walls').addEventListener('click', (e) => this.onClick(e));
  }

  help() {
    this.ui.showModal(
      'Hold the Walls',
      `<p>Raiders hit your three walls every week, a different element on each wall. Put up to ${WALL_SIZE} heroes on each wall. A hero can only stand on one wall, so a full defense takes ${WALL_SIZE * WALL_COUNT} heroes.</p>
      <p>Any element can stand on any wall. Heroes whose element beats the raiders are marked Strong, and they hold far longer.</p>
      <p>Each wall faces up to ${WALL_WAVES} waves, every wave stronger than the last. You can defend once a day. The page shows how many waves each wall should hold before you defend.</p>
      <p>Waves held pay Enhance Stones, Essence of the raiders' element, and crests for heroes who stood on the walls. Your best total each week pays a Glyph Chest at ${WALL_WEEK_TIERS.map((t) => t.waves).join(', ')} waves, the last one Rare.</p>
      <p>Heroes fight at the fixed level, like the Colosseum: stars, relics, weapons and Glyphs count, gold and Ember levels don't.</p>`,
      'Okay',
    );
  }

  renderHub(now = Date.now()) {
    const s = this.state;
    $('hub-wl-count').textContent = s.wallsOpen() ? `${s.wallsWeekBest(now)}` : '-';
    const held = s.walls.day === dayKey(now);
    $('hub-wl-note').textContent = !s.wallsOpen() ? 'Opens after your first Rekindle' : held ? 'Held today' : `Raiders: ${s.wallRaids(now).map(cap).join(', ')}`;
    $('hub-wl-alert').hidden = !s.wallsOpen() || held;
  }

  render(now = Date.now()) {
    const s = this.state;
    if (!s.wallsOpen()) {
      setHtml($('walls'), '<p class="market-note">Hold the Walls opens after your first Rekindle.</p>');
      return;
    }
    const raids = s.wallRaids(now);
    const teams = s.wallTeams();
    // The forecast runs a fight per wave tried: only work it out again when the walls or the heroes change.
    const heroSig = teams.flat().map((h) => `${h.id}${s.stars[h.id] ?? 0}`).join(',');
    const sig = [raids.join(), teams.map((t) => t.map((h) => h.id).join('.')).join('|'), heroSig, JSON.stringify(s.walls), new Date(now).toDateString(), Math.floor(now / 60_000)].join('#');
    if (sig === this.sig && $('walls').childElementCount) return;
    const teamsChanged = this.sig.split('#').slice(0, 3).join('#') !== sig.split('#').slice(0, 3).join('#');
    this.sig = sig;
    if (teamsChanged || !$('walls').childElementCount) this.forecast = s.wallsForecast(now);
    const block = s.wallsBlock(now);
    const held = s.walls.day === dayKey(now) && s.walls.last.length === WALL_COUNT;
    const shown = held ? s.walls.last : this.forecast;
    const best = s.wallsWeekBest(now);
    const paid = s.wallsPaid(now);
    const total = shown.reduce((a, b) => a + b, 0);
    const pay = wallReward(shown);

    const raiders = raids.map((el) => `<span class="wl-raider" style="--el:${hex(ELEMENT_COLORS[el])}"><i class="mode-orb ${el}"></i>${cap(el)}</span>`).join('');
    const tiers = WALL_WEEK_TIERS.map((t, i) => {
      const done = paid.includes(i);
      return `<span class="wl-tier${done ? ' done' : ''}" title="${t.chest === 'grand' ? 'Rare Glyph Chest' : 'Glyph Chest'} at ${t.waves} waves">${matIcon(t.chest)}<span>${t.waves}</span>${done ? '<b class="wl-ok">✓</b>' : ''}</span>`;
    }).join('');
    const pct = Math.min(100, (best / WALL_WEEK_TIERS[WALL_WEEK_TIERS.length - 1].waves) * 100);

    const walls = raids
      .map((el, w) => {
        const team = teams[w];
        const n = shown[w];
        const slots = Array.from({ length: WALL_SIZE }, (_, i) => {
          const h = team[i];
          if (!h) return '<span class="wl-slot empty"><span class="face"></span></span>';
          const fit = wallFit(h.element, el);
          const tag = fit > 1 ? '<i class="wl-edge strong">Strong</i>' : fit < 1 ? '<i class="wl-edge weak">Weak</i>' : '';
          return `<span class="wl-slot" style="--hel:${hex(ELEMENT_COLORS[h.element])}" title="${h.name}"><span class="face art" style="${faceStyle(h)}"></span>${tag}</span>`;
        }).join('');
        const segs = Array.from({ length: 10 }, (_, i) => `<i class="${n >= (i + 1) * (WALL_WAVES / 10) ? 'on' : n > i * (WALL_WAVES / 10) ? 'part' : ''}"></i>`).join('');
        return `<div class="wl-wall" style="--el:${hex(ELEMENT_COLORS[el])}">
          <div class="wl-wall-head">
            <span class="wl-crenel" aria-hidden="true"></span>
            <b>${WALL_NAMES[w]}</b>
            <span class="wl-vs">Raiders <i class="mode-orb ${el}"></i>${cap(el)}</span>
          </div>
          <div class="wl-slots">${slots}</div>
          <div class="wl-hold"><span class="wl-segs" aria-hidden="true">${segs}</span><span class="wl-waves"><b>${n}</b>/${WALL_WAVES} waves</span></div>
          <div class="wl-wall-foot"><small>${team.length ? `${held ? 'Held' : 'Should hold'} ${n} wave${n === 1 ? '' : 's'}` : 'No heroes on this wall'}</small><span class="wl-foot-btns">${team.length ? `<button type="button" class="wood-btn small" data-wl-watch="${w}">Watch wave ${Math.min(WALL_WAVES, n + 1)}</button>` : ''}<button type="button" class="wood-btn small" data-wl-edit="${w}">Edit</button></span></div>
        </div>`;
      })
      .join('');

    const essence = raids.map((el, w) => ({ el, n: s.wallEssence(el, shown[w]) })).filter((x) => x.n);
    const chips = [
      `<span class="mat-chip" title="Enhance Stones"><i class="stone"></i>${pay.stones}</span>`,
      `<span class="mat-chip" title="Crests for heroes on the walls"><i class="medal"></i>${pay.crests}</span>`,
      ...essence.map((x) => `<span class="mat-chip" title="${ESSENCE_NAMES[x.el]}"><i class="ess-${x.el}"></i>${fmt(x.n)}</span>`),
    ].join('');
    const bar = held
      ? `<p class="wl-sum">Today's defense held <b>${total}</b> waves.</p><p class="tw-block wl-next">Next defense in ${untilTomorrow(now)}.</p><button type="button" class="wood-btn levelall tw-fight" disabled>Held today</button>`
      : `<div class="wl-sumrow"><p class="wl-sum">Should hold <b>${total}</b> waves</p><div class="tw-rew wl-pay">${chips}</div></div>${block ? `<p class="tw-block">${block}.</p>` : ''}<div class="wl-btns"><button type="button" class="wood-btn small" data-wl-auto>Auto-set walls</button><button type="button" class="wood-btn levelall tw-fight" data-wl-defend ${block ? 'disabled' : ''}>Defend</button></div>`;

    setHtml(
      $('walls'),
      `<div class="wl-banner">
        <b class="wl-title">This week's raiders</b>
        <div class="wl-raiders">${raiders}</div>
        <div class="wl-week"><span>Week best <b>${best}</b> waves</span><span class="wl-track"><i style="width:${pct}%"></i></span><span class="wl-tiers">${tiers}</span></div>
      </div>
      <div class="wl-walls">${walls}</div>
      <div class="tw-bar wl-bar">${bar}</div>`,
    );
  }

  private onClick(e: Event) {
    const t = e.target as HTMLElement;
    const edit = t.closest<HTMLElement>('[data-wl-edit]');
    if (edit) {
      this.ui.openWallTeam(Number(edit.dataset.wlEdit));
      return;
    }
    const watch = t.closest<HTMLElement>('[data-wl-watch]');
    if (watch) {
      this.ui.watchWall(Number(watch.dataset.wlWatch));
      return;
    }
    if (t.closest('[data-wl-auto]')) {
      const s = this.state;
      if (s.setWallTeams(s.wallsAutoTeams())) play('unlock');
      this.render();
      return;
    }
    const d = t.closest<HTMLButtonElement>('[data-wl-defend]');
    if (d && !d.disabled) this.ui.defendWalls();
  }
}

/** The result box after a defense: waves held on each wall, what it paid, and the heroes who got crests. */
export function wallsResultHtml(r: WallsResult, raids: Element[]): string {
  const rows = r.waves
    .map((n, w) => `<div class="wl-res-row" style="--el:${hex(ELEMENT_COLORS[raids[w]])}"><i class="mode-orb ${raids[w]}"></i><span>${WALL_NAMES[w]}</span><b>${n}/${WALL_WAVES}</b></div>`)
    .join('');
  const got = new Map<string, number>();
  for (const id of r.crests) got.set(id, (got.get(id) ?? 0) + 1);
  const crests = [...got].map(([id, n]) => `<span class="tw-crest"><span class="face art" style="${faceStyle(hero(id))}"></span><small>${hero(id).name} x${n}</small></span>`).join('');
  const chips = [
    `<span class="mat-chip" title="Enhance Stones"><i class="stone"></i>${r.stones}</span>`,
    ...(Object.entries(r.essence) as Array<[Element, number]>).map(([el, n]) => `<span class="mat-chip" title="${ESSENCE_NAMES[el]}"><i class="ess-${el}"></i>${fmt(n)}</span>`),
    ...r.chests.map((c) => `<span class="mat-chip hot" title="${c === 'grand' ? 'Rare Glyph Chest' : 'Glyph Chest'}">${matIcon(c)}1</span>`),
  ].join('');
  return `<p class="tf-result win">The walls held ${r.total} waves!</p><div class="wl-res">${rows}</div><div class="tw-rew tw-rew-big">${chips}</div>${crests ? `<div class="tw-crests">${crests}</div>` : ''}`;
}
