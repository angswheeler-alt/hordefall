import Decimal from 'break_infinity.js';
import { HEROES, ELEMENT_COLORS, ULT_UNLOCK_LEVEL, SPEED_UNLOCK_STAGE, REKINDLE_STAGE, type HeroDef } from './data';
import { setMuted } from './sfx';
import { bulkCost, heroAtk, heroHp, isBossStage, emberCost, fmt, fmtDuration } from './formulas';
import type { GameState, OfflineReport } from './state';
import type { BattleScene } from './BattleScene';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

interface HeroRow {
  def: HeroDef;
  root: HTMLElement;
  level: HTMLElement;
  stats: HTMLElement;
  button: HTMLButtonElement;
  label: HTMLElement;
  cost: HTMLElement;
  emberButton: HTMLButtonElement;
  emberCost: HTMLElement;
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
    private hooks: { simulateAway: () => void; wipe: () => void; rekindle: () => void },
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
        <div class="face" style="background:${hex(ELEMENT_COLORS[def.element])}">${def.name[0]}</div>
        <div>
          <div class="name">${def.name} <span class="meta lvl"></span></div>
          <div class="meta">${cap(def.element)} ${def.job}${def.goldMult > 1 ? ' · 2x gold' : ''}${def.heals ? ' · heals' : ''}${def.splash ? ' · splash' : ''}</div>
          <div class="stats"></div>
        </div>
        <div class="btns">
          <button class="gold-up"><span class="label"></span><span class="cost"></span></button>
          <button class="ember-up" hidden title="Permanent level, kept through Rekindle"><span>Ember +1</span><span class="cost"></span></button>
        </div>`;
      host.appendChild(root);
      const button = root.querySelector('.gold-up') as HTMLButtonElement;
      button.addEventListener('click', () => this.buy(def));
      const emberButton = root.querySelector('.ember-up') as HTMLButtonElement;
      emberButton.addEventListener('click', () => this.buyEmber(def));
      this.rows.push({
        def,
        root,
        level: root.querySelector('.lvl') as HTMLElement,
        stats: root.querySelector('.stats') as HTMLElement,
        button,
        label: root.querySelector('.label') as HTMLElement,
        cost: root.querySelector('.gold-up .cost') as HTMLElement,
        emberButton,
        emberCost: root.querySelector('.ember-up .cost') as HTMLElement,
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
    $('rekindle').addEventListener('click', () => this.confirmRekindle());
  }

  private modalAction: (() => void) | null = null;

  private showModal(title: string, html: string, ok: string, action: (() => void) | null = null, cancel = false) {
    $('modal-title').textContent = title;
    $('modal-body').innerHTML = html;
    $('modal-ok').textContent = ok;
    $('modal-cancel').hidden = !cancel;
    this.modalAction = action;
    $('modal').hidden = false;
  }

  private confirmRekindle() {
    const s = this.state;
    if (!s.canRekindle()) return;
    this.showModal(
      'Rekindle?',
      `You go back to stage 1, your gold is spent and every hero drops to gold level 1.<br>You keep recruited heroes and earn <b class="ember-text">${s.pendingEmbers()} Embers</b> for permanent Ember levels.`,
      `Rekindle for ${s.pendingEmbers()} Embers`,
      () => this.hooks.rekindle(),
      true,
    );
  }

  showRekindled(gained: number) {
    this.showModal(
      'Rekindled!',
      `You earned <b class="ember-text">${gained} Embers</b>. Spend them on Ember levels below. They stay through every Rekindle, so each run starts stronger.`,
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
    $('embers-stat').hidden = s.embers === 0 && s.rekindles === 0;
    $('embers').textContent = String(s.embers);
    const rk = $<HTMLButtonElement>('rekindle');
    rk.hidden = s.runBestStage < 100 && s.rekindles === 0;
    rk.disabled = !s.canRekindle();
    rk.textContent = s.canRekindle() ? `Rekindle +${s.pendingEmbers()}` : `Rekindle after ${REKINDLE_STAGE}`;
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

    for (const r of this.rows) {
      const level = s.levels[r.def.id] ?? 0;
      const emberLevel = s.emberLevels[r.def.id] ?? 0;
      const eff = s.heroLevel(r.def.id);
      const locked = level === 0;
      r.root.classList.toggle('locked', locked);
      r.level.innerHTML = locked ? (emberLevel ? `<span class="ember-lvl">+${emberLevel}</span>` : '') : `Lv ${eff}${emberLevel ? ` <span class="ember-lvl">(+${emberLevel})</span>` : ''}`;
      const ec = emberCost(emberLevel);
      r.emberButton.hidden = s.embers === 0 && emberLevel === 0;
      r.emberButton.disabled = ec > s.embers;
      r.emberCost.textContent = `${ec} Ember${ec === 1 ? '' : 's'}`;
      const { levels, cost } = bulkCost(r.def, level, s.buyAmount, s.gold);
      const shown = levels > 0 ? { levels, cost } : bulkCost(r.def, level, 1, s.gold);
      if (locked) {
        r.stats.textContent = `ATK ${fmt(heroAtk(r.def, 1))} · HP ${fmt(heroHp(r.def, 1))}`;
        r.label.textContent = 'Recruit';
      } else {
        const next = eff + shown.levels;
        r.stats.innerHTML = `ATK ${fmt(heroAtk(r.def, eff))} <span class="next">→ ${fmt(heroAtk(r.def, next))}</span> · HP ${fmt(heroHp(r.def, eff))}`;
        r.label.textContent = `Level +${shown.levels}`;
      }
      r.cost.textContent = fmt(shown.cost);
      r.button.disabled = shown.cost.gt(s.gold);
    }

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
