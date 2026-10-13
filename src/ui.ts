import Decimal from 'break_infinity.js';
import { HEROES, ELEMENT_COLORS, ULT_UNLOCK_LEVEL, SPEED_UNLOCK_STAGE, REKINDLE_STAGE, BOSS_EVERY, REKINDLE_BOOSTS, ROAD_START, ROAD_STEP, ROAD_LENGTH, ROAD_GEMS, KEEPER_BONUS_PER_LEVEL, STAR_CRESTS, CHEST_COST, ULT_STAR_BONUS, ULT_MULTIPLIER, type HeroDef } from './data';
import { play } from './sfx';
import { setMuted } from './sfx';
import { bulkCost, isBossStage, emberCost, emberStageBonus, keeperThreshold, fmt, fmtDuration } from './formulas';
import type { GameState, OfflineReport, SummonDrop } from './state';
import type { BattleScene } from './BattleScene';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
const SWORD = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 2l2 2-11 11 2 2-2 2-2-2-3 3-2-2 3-3-2-2 2-2 2 2z"/></svg>';
const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21C5 15 2 12 2 8a5 5 0 0 1 10-1 5 5 0 0 1 10 1c0 4-3 7-10 13z"/></svg>';
const TABS = ['heroes', 'market', 'relics', 'battle', 'shop', 'guild'] as const;
type Tab = (typeof TABS)[number];
const TAB_KEY = 'hordefall-tab';

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

interface UltButton {
  def: HeroDef;
  button: HTMLButtonElement;
  cd: HTMLElement;
}

/** HTML overlay for everything that isn't the lane: gold, hero upgrades, toggles. */
export class UI {
  private rows: HeroRow[] = [];
  private ults: UltButton[] = [];

  constructor(
    private state: GameState,
    private scene: () => BattleScene | undefined,
    private hooks: { simulateAway: () => void; wipe: () => void; rekindle: (mult: number) => void },
  ) {
    this.buildHeroes();
    this.buildUlts();
    this.bindControls();
    setInterval(() => this.render(), 200);
    this.render();
  }

  private buildHeroes() {
    const host = $('heroes');
    for (const def of HEROES) {
      const root = document.createElement('div');
      root.className = 'hero';
      root.innerHTML = `
        <div class="face" role="button" tabindex="0" aria-label="Open ${def.name}" style="background:${hex(ELEMENT_COLORS[def.element])}">${def.name[0]}<span class="pember"></span><span class="plv"></span></div>
        <div class="who" role="button" tabindex="0" aria-label="Open ${def.name}">
          <div class="banner" style="--el:${hex(ELEMENT_COLORS[def.element])}"><span class="name">${def.name}</span><span class="stars-mini"></span></div>
          <div class="stats"></div>
          <div class="meta">${cap(def.element)} ${def.job} <span class="ember-chip"></span></div>
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

  private buildUlts() {
    const host = $('ults');
    for (const def of HEROES) {
      const button = document.createElement('button');
      button.className = 'ult';
      button.style.background = hex(ELEMENT_COLORS[def.element]);
      button.innerHTML = `${def.name}<span class="cd"></span>`;
      button.title = `${def.name} ultimate (unlocks at Lv ${ULT_UNLOCK_LEVEL})`;
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
    $('mute').addEventListener('click', () => {
      this.state.muted = !this.state.muted;
      setMuted(this.state.muted);
      this.render();
    });
    $('autoult').addEventListener('click', () => {
      this.state.autoUlt = !this.state.autoUlt;
      this.render();
    });
    $('boss').addEventListener('click', () => this.scene()?.challengeBoss());
    $('buyamt').addEventListener('click', () => {
      const order: Array<1 | 10 | 'max'> = [1, 10, 'max'];
      this.state.buyAmount = order[(order.indexOf(this.state.buyAmount) + 1) % order.length];
      this.render();
    });
    $('sim').addEventListener('click', () => this.hooks.simulateAway());
    // Two taps to reset: confirm() dialogs are blocked in some embedded viewers.
    let armed = 0;
    const wipe = $('wipe');
    wipe.addEventListener('click', () => {
      if (Date.now() - armed < 3000) return this.hooks.wipe();
      armed = Date.now();
      wipe.textContent = 'Tap again to erase';
      setTimeout(() => (wipe.textContent = 'Reset save'), 3000);
    });
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

    $('summon').addEventListener('click', () => this.summon());
    $('chest-btn').addEventListener('click', () => this.summon());
    $('collection-btn').addEventListener('click', () => this.openSheet(HEROES[0].id));
    $('team-btn').addEventListener('click', () =>
      this.showModal('Manage Team', 'Team lineups are coming soon. For now every recruited hero fights. Moving a hero out of the lineup will return their Embers.', 'Okay'),
    );
    for (const btn of $('tabbar').querySelectorAll<HTMLButtonElement>('button')) {
      btn.addEventListener('click', () => this.setTab(btn.dataset.tab as Tab));
    }
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(TAB_KEY);
    } catch {
      // Storage blocked: start on Heroes.
    }
    this.setTab(TABS.includes(saved as Tab) ? (saved as Tab) : 'heroes');
    $('freegems').addEventListener('click', () => {
      this.state.gems += 100;
      this.render();
    });
    $('sheet-evolve').addEventListener('click', () => {
      if (this.sheetHero && this.state.evolve(this.sheetHero)) {
        play('unlock');
        this.scene()?.syncHeroes();
        this.render();
      }
    });
    // Two taps: Embers come back so they can move to another hero.
    let backArmed = 0;
    const back = $<HTMLButtonElement>('sheet-ember-back');
    back.addEventListener('click', () => {
      if (!this.sheetHero) return;
      if (Date.now() - backArmed > 3000) {
        backArmed = Date.now();
        back.dataset.armed = '1';
        setTimeout(() => delete back.dataset.armed, 3000);
        this.renderSheet();
        return;
      }
      backArmed = 0;
      delete back.dataset.armed;
      this.state.refundEmbers(this.sheetHero);
      this.scene()?.syncHeroes();
      this.render();
    });
    $('sheet-close').addEventListener('click', () => this.closeSheet());
    $('sheet').addEventListener('click', (e) => {
      if (e.target === $('sheet')) this.closeSheet();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!$('rk').hidden) this.closeRekindle();
      else if (this.sheetHero) this.closeSheet();
    });
    const step = (dir: number) => {
      const i = HEROES.findIndex((h) => h.id === this.sheetHero);
      this.openSheet(HEROES[(i + dir + HEROES.length) % HEROES.length].id);
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
    const cards = drops
      .map((d) => {
        const def = HEROES.find((h) => h.id === d.heroId)!;
        return `<div class="drop"><div class="face" style="background:${hex(ELEMENT_COLORS[def.element])}">${def.name[0]}</div><b>${def.name}</b>${d.isNew ? '<span class="new">NEW HERO</span>' : ''}<span class="crest">+${d.crests} Crests</span></div>`;
      })
      .join('');
    const canAgain = this.state.gems >= CHEST_COST;
    this.showModal(
      'Hero Chest',
      `<div class="summon-grid">${cards}</div>Tap a hero to evolve them when their Crest bar is full.`,
      canAgain ? `Open another (${CHEST_COST} Gems)` : 'Done',
      canAgain ? () => this.summon() : null,
      canAgain,
    );
    if (canAgain) $('modal-cancel').textContent = 'Done';
  }

  // ---------- hero page ----------

  private sheetHero: string | null = null;

  openSheet(id: string) {
    this.sheetHero = id;
    delete $('sheet-ember-back').dataset.armed;
    const def = HEROES.find((h) => h.id === id)!;
    const face = $('sheet-face');
    face.textContent = def.name[0];
    face.style.background = hex(ELEMENT_COLORS[def.element]);
    $('sheet-name').textContent = def.name;
    $('sheet-sub').textContent = `${cap(def.element)} ${def.job}`;
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
    const crests = s.crests[id] ?? 0;

    $('sheet-stars').innerHTML = STAR_CRESTS.map((_, i) => `<span class="${i < stars ? 'on' : ''}">★</span>`).join('');
    const shownLevel = gold > 0 ? eff : 1 + ember;
    const power = s.heroPower(def, shownLevel);
    const stat = (label: string, value: string) => `<div><small>${label}</small><b>${value}</b></div>`;
    $('sheet-stats').innerHTML = [
      stat('Level', gold > 0 ? String(eff) : 'Not recruited'),
      stat('ATK', fmt(power.atk)),
      stat('HP', fmt(power.hp)),
      stat('Attacks / sec', (1 / def.attackCooldown).toFixed(2)),
      stat('Range', def.range > 60 ? `Ranged (${def.range})` : 'Melee'),
      stat('Gold per kill', `${def.goldMult}x`),
    ].join('');

    $('sheet-gold-lvl').textContent = gold > 0 ? String(gold) : '(not recruited)';
    const { levels, cost } = bulkCost(def, gold, s.buyAmount, s.gold);
    const shown = levels > 0 ? { levels, cost } : bulkCost(def, gold, 1, s.gold);
    const goldBtn = $<HTMLButtonElement>('sheet-gold-up');
    (goldBtn.querySelector('.label') as HTMLElement).textContent = gold === 0 ? 'Recruit' : `Level +${shown.levels}`;
    (goldBtn.querySelector('.cost') as HTMLElement).textContent = fmt(shown.cost);
    goldBtn.disabled = shown.cost.gt(s.gold);

    $('sheet-ember-lvl').textContent = `+${ember}`;
    $('sheet-embers').textContent = String(s.embers);
    const ec = emberCost(ember);
    const emberBtn = $<HTMLButtonElement>('sheet-ember-up');
    (emberBtn.querySelector('.cost') as HTMLElement).textContent = `${ec} Ember${ec === 1 ? '' : 's'}`;
    emberBtn.disabled = ec > s.embers;
    const back = $<HTMLButtonElement>('sheet-ember-back');
    const spent = s.embersSpent(id);
    back.disabled = spent === 0;
    back.textContent = back.dataset.armed ? `Tap again to take back ${spent} Embers` : `Take back ${spent} Embers`;
    emberBtn.title = s.rekindles === 0 ? `Earn Embers by Rekindling after stage ${REKINDLE_STAGE}` : '';

    const ultReady = eff >= ULT_UNLOCK_LEVEL;
    const ability = (kind: string, a: { name: string; text: string }, tag = '', ready = false) =>
      `<li><span class="kind">${kind}</span>${tag ? `<span class="tag${ready ? ' ready' : ''}">${tag}</span>` : ''}<div><b>${a.name}</b></div><p>${a.text}</p></li>`;
    const html = [
      ability('Basic attack', def.basic),
      ability('Ultimate', def.ultimate, ultReady ? 'Unlocked' : `Unlocks at Lv ${ULT_UNLOCK_LEVEL}`, ultReady),
      ability('Trait', def.trait),
    ].join('');
    // Only re-render lists when content changes, so taps and hover states aren't lost every frame.
    if ($('sheet-abilities').dataset.key !== `${id}:${ultReady}`) {
      $('sheet-abilities').innerHTML = html;
      $('sheet-abilities').dataset.key = `${id}:${ultReady}`;
    }

    const next = s.evolveCost(id);
    $('sheet-crests').textContent = next === null ? `${crests} (max stars)` : `${crests} / ${next} for ${stars + 1}★`;
    $('sheet-crest-fill').style.width = next === null ? '100%' : `${Math.min(100, (crests / next) * 100)}%`;
    const evolve = $<HTMLButtonElement>('sheet-evolve');
    evolve.hidden = next === null || crests < next || gold === 0;
    evolve.textContent = `Evolve to ${stars + 1}★ (${next} Crests)`;
    const unlocks: Array<[number, string, string]> = [
      [1, `${def.sp1.name}`, def.sp1.text],
      [2, `${def.sp2.name}`, def.sp2.text],
      [3, `${def.ultimate.name}+`, `Ultimate hits for ${ULT_MULTIPLIER * ULT_STAR_BONUS}x instead of ${ULT_MULTIPLIER}x.`],
      [4, `Aura: ${def.aura.name}`, def.aura.text],
      [5, '5★ to 7★', 'Each extra star doubles all stats again.'],
    ];
    if ($('sheet-unlocks').dataset.key !== `${id}:${stars}`) {
      $('sheet-unlocks').innerHTML = unlocks
        .map(([star, name, text]) => {
          const on = stars >= star;
          return `<li class="${on ? '' : 'locked'}"><span class="kind">${star}★</span><span class="tag${on ? ' ready' : ''}">${on ? 'Unlocked' : 'Locked'}</span><div><b>${name}</b></div><p>${text}</p></li>`;
        })
        .join('');
      $('sheet-unlocks').dataset.key = `${id}:${stars}`;
    }
  }

  private modalAction: (() => void) | null = null;

  private showModal(title: string, html: string, ok: string, action: (() => void) | null = null, cancel = false) {
    $('modal-title').textContent = title;
    $('modal-body').innerHTML = html;
    $('modal-ok').textContent = ok;
    $('modal-cancel').hidden = !cancel;
    $('modal-cancel').textContent = 'Not yet';
    this.modalAction = action;
    $('modal').hidden = false;
  }

  private tab: Tab = 'heroes';

  private setTab(tab: Tab) {
    this.tab = tab;
    for (const panel of $('panels').querySelectorAll<HTMLElement>('.panel')) panel.hidden = panel.dataset.tab !== tab;
    for (const btn of $('tabbar').querySelectorAll<HTMLButtonElement>('button')) {
      const on = btn.dataset.tab === tab;
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-current', on ? 'page' : 'false');
    }
    try {
      localStorage.setItem(TAB_KEY, tab);
    } catch {
      // Not remembered; harmless.
    }
    if (tab === 'battle') this.renderBattle();
  }

  private badge(tab: Tab, on: boolean) {
    const b = $('tabbar').querySelector<HTMLElement>(`button[data-tab="${tab}"] .badge`);
    if (b) b.hidden = !on;
  }

  private renderBattle() {
    const s = this.state;
    const nextBoss = Math.ceil((s.stage + (isBossStage(s.stage) ? 0 : 1)) / BOSS_EVERY) * BOSS_EVERY;
    $('bt-stage').textContent = s.stage.toLocaleString();
    $('bt-boss').textContent = `Stage ${nextBoss.toLocaleString()}`;
    $('bt-best').textContent = s.bestStage.toLocaleString();
    $('bt-run').textContent = s.runBestStage.toLocaleString();
    $('bt-gps').textContent = fmt(new Decimal(s.goldPerSec));
    $('bt-pace').textContent = `${Math.round(s.secondsPerStage)}s`;
    $('bt-rk').textContent = String(s.rekindles);
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

    const reached = s.roadReached();
    const roadGems = s.pendingRoadGems();
    $('rk-road-count').textContent = `${reached}/${ROAD_LENGTH}`;
    $('rk-dots').innerHTML = Array.from({ length: ROAD_LENGTH }, (_, i) => {
      const cls = i < s.roadClaimed ? 'on' : i < reached ? 'new' : i === reached ? 'next' : '';
      return `<i class="${cls}" title="Stage ${ROAD_START + i * ROAD_STEP}"></i>`;
    }).join('');
    $('rk-road-gems').textContent = roadGems > 0 ? `+${roadGems} Gems` : '';
    $('rk-road-next').textContent =
      reached < ROAD_LENGTH
        ? `Next slot unlocks at stage ${(ROAD_START + reached * ROAD_STEP).toLocaleString()} (best stage ever). Each slot pays ${ROAD_GEMS} Gems when you Rekindle.`
        : 'Every slot unlocked.';

    const level = s.keeperLevel();
    const from = level === 1 ? 0 : keeperThreshold(level - 1);
    const to = keeperThreshold(level);
    const pct = (v: number) => `${Math.max(0, Math.min(100, ((v - from) / (to - from)) * 100))}%`;
    $('rk-level').textContent = String(level);
    $('rk-nextlvl').textContent = `Lv ${level + 1}: Embers x${(s.keeperBonus() + KEEPER_BONUS_PER_LEVEL).toFixed(2)}`;
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
    $('rk-buttons').innerHTML = buttons.join('');
  }

  showRekindled(embers: number, gems: number) {
    const road = gems > 0 ? `<br>The Rekindle Wheel paid <b>${gems} Gems</b>.` : '';
    this.showModal(
      'Rekindled!',
      `You earned <b class="ember-text">${fmt(embers)} Embers</b>.${road}<br>Tap any hero to spend Embers on Ember levels. Those levels stay through every Rekindle, so each run starts stronger.`,
      'Start the new run',
    );
  }

  private buyEmber(def: HeroDef) {
    const level = this.state.emberLevels[def.id] ?? 0;
    const cost = emberCost(level);
    if (cost > this.state.embers) return;
    this.state.embers -= cost;
    this.state.emberLevels[def.id] = level + 1;
    this.scene()?.syncHeroes();
    this.render();
  }

  private buy(def: HeroDef) {
    const level = this.state.levels[def.id] ?? 0;
    const { levels, cost } = bulkCost(def, level, this.state.buyAmount, this.state.gold);
    if (levels === 0 || cost.gt(this.state.gold)) return;
    this.state.gold = this.state.gold.minus(cost);
    this.state.levels[def.id] = level + levels;
    this.scene()?.syncHeroes();
    this.render();
  }

  showOffline(report: OfflineReport) {
    const stages = report.stages > 0 ? `<br>Your heroes pushed <b>${report.stages}</b> stage${report.stages === 1 ? '' : 's'}.` : '';
    this.showModal('Welcome back!', `You were away for ${fmtDuration(report.seconds)}.<br>Your heroes earned <b>${fmt(report.gold)}</b> gold.${stages}`, 'Collect');
  }

  render() {
    const s = this.state;
    $('gold').textContent = fmt(s.gold);
    $('gps').textContent = `${fmt(new Decimal(s.goldPerSec))}/s`;
    $('best').textContent = String(s.bestStage);
    $('gems').textContent = String(s.gems);
    const summon = $<HTMLButtonElement>('summon');
    summon.disabled = s.gems < CHEST_COST;
    summon.innerHTML = `Open · ${CHEST_COST} <span class="gem"></span>`;
    $<HTMLButtonElement>('chest-btn').disabled = s.gems < CHEST_COST;
    $('embers-stat').hidden = s.embers === 0 && s.rekindles === 0;
    $('embers').textContent = String(s.embers);
    const rk = $<HTMLButtonElement>('rekindle');
    rk.hidden = s.runBestStage < 100 && s.rekindles === 0;
    rk.disabled = !s.canRekindle();
    rk.textContent = s.canRekindle() ? `Rekindle +${fmt(s.pendingEmbers())}` : `Rekindle after ${REKINDLE_STAGE}`;
    const speedUnlocked = s.bestStage >= SPEED_UNLOCK_STAGE;
    const speed = $<HTMLButtonElement>('speed');
    speed.disabled = !speedUnlocked;
    speed.textContent = speedUnlocked ? '2x' : `2x at stage ${SPEED_UNLOCK_STAGE}`;
    speed.classList.toggle('on', speedUnlocked && s.speed2x);
    $('mute').classList.toggle('on', !s.muted);
    $('mute').textContent = s.muted ? 'Sound off' : 'Sound on';
    $('autoult').classList.toggle('on', s.autoUlt);
    $('buyamt').textContent = `Buy ${s.buyAmount === 'max' ? 'max' : `x${s.buyAmount}`}`;
    const bossBtn = $('boss');
    bossBtn.hidden = s.autoAdvance;
    bossBtn.textContent = isBossStage(s.stage + 1) || isBossStage(s.stage) ? 'Fight boss' : 'Resume';

    let heroesBadge = false;
    for (const r of this.rows) {
      const level = s.levels[r.def.id] ?? 0;
      const emberLevel = s.emberLevels[r.def.id] ?? 0;
      const eff = s.heroLevel(r.def.id);
      const locked = level === 0;
      r.root.classList.toggle('locked', locked);
      r.level.textContent = locked ? '' : `Lv ${eff}`;
      r.emberBadge.textContent = emberLevel ? `+${emberLevel}` : '';
      r.emberBadge.title = emberLevel ? `${emberLevel} Ember levels` : '';
      const starCount = s.stars[r.def.id] ?? 0;
      r.stars.textContent = '★'.repeat(starCount);
      const evolveCost = s.evolveCost(r.def.id);
      const canEvolve = !locked && evolveCost !== null && (s.crests[r.def.id] ?? 0) >= evolveCost;
      r.ember.textContent = canEvolve ? '· Ready to evolve!' : s.embers >= emberCost(emberLevel) ? '· Embers ready' : '';
      if (canEvolve || (s.embers > 0 && s.embers >= emberCost(emberLevel))) heroesBadge = true;
      const { levels, cost } = bulkCost(r.def, level, s.buyAmount, s.gold);
      const shown = levels > 0 ? { levels, cost } : bulkCost(r.def, level, 1, s.gold);
      if (locked) {
        const p1 = s.heroPower(r.def, 1);
        r.stats.innerHTML = `<span class="st atk">${SWORD}${fmt(p1.atk)}</span><span class="st hp">${HEART}${fmt(p1.hp)}</span>`;
        r.label.textContent = 'Recruit';
      } else {
        const next = eff + shown.levels;
        const now = s.heroPower(r.def, eff);
        r.stats.innerHTML = `<span class="st atk">${SWORD}${fmt(now.atk)} <span class="next">→ ${fmt(s.heroPower(r.def, next).atk)}</span></span><span class="st hp">${HEART}${fmt(now.hp)}</span>`;
        r.label.textContent = shown.levels === 1 ? 'Level Up' : `Level +${shown.levels}`;
      }
      r.cost.textContent = fmt(shown.cost);
      r.button.disabled = shown.cost.gt(s.gold);
    }

    this.badge('heroes', heroesBadge);
    this.badge('shop', s.gems >= CHEST_COST);
    if (this.tab === 'battle') this.renderBattle();
    this.renderSheet();

    const scene = this.scene();
    for (const u of this.ults) {
      const level = s.heroLevel(u.def.id);
      u.button.hidden = level === 0;
      if (!scene || level === 0) continue;
      const st = scene.getUltState(u.def.id);
      const ready = st.unlocked && st.alive && st.remaining <= 0;
      u.button.disabled = !ready;
      u.button.classList.toggle('ready', ready);
      u.cd.textContent = !st.unlocked ? `Lv${ULT_UNLOCK_LEVEL}` : !st.alive ? 'down' : st.remaining > 0 ? `${Math.ceil(st.remaining)}` : '';
      u.cd.style.display = ready ? 'none' : 'flex';
    }
  }
}

function cap(s: string) {
  return s[0].toUpperCase() + s.slice(1);
}
