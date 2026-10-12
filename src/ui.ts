import Decimal from 'break_infinity.js';
import { HEROES, ELEMENT_COLORS, ULT_UNLOCK_LEVEL, type HeroDef } from './data';
import { bulkCost, heroAtk, heroHp, isBossStage, fmt, fmtDuration } from './formulas';
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
    private hooks: { simulateAway: () => void; wipe: () => void },
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
        <button><span class="label"></span><span class="cost"></span></button>`;
      host.appendChild(root);
      const button = root.querySelector('button') as HTMLButtonElement;
      button.addEventListener('click', () => this.buy(def));
      this.rows.push({
        def,
        root,
        level: root.querySelector('.lvl') as HTMLElement,
        stats: root.querySelector('.stats') as HTMLElement,
        button,
        label: root.querySelector('.label') as HTMLElement,
        cost: root.querySelector('.cost') as HTMLElement,
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
    $('modal-ok').addEventListener('click', () => ($('modal').hidden = true));
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
    $('modal-body').innerHTML = `You were away for ${fmtDuration(report.seconds)}.<br>Your heroes earned <b>${fmt(report.gold)}</b> gold.${stages}`;
    $('modal').hidden = false;
  }

  render() {
    const s = this.state;
    $('gold').textContent = fmt(s.gold);
    $('gps').textContent = `${fmt(new Decimal(s.goldPerSec))}/s`;
    $('best').textContent = String(s.bestStage);
    $('speed').classList.toggle('on', s.speed2x);
    $('autoult').classList.toggle('on', s.autoUlt);
    $('buyamt').textContent = `Buy ${s.buyAmount === 'max' ? 'max' : `x${s.buyAmount}`}`;
    const bossBtn = $('boss');
    bossBtn.hidden = s.autoAdvance;
    bossBtn.textContent = isBossStage(s.stage + 1) || isBossStage(s.stage) ? 'Fight boss' : 'Resume';

    for (const r of this.rows) {
      const level = s.levels[r.def.id] ?? 0;
      const locked = level === 0;
      r.root.classList.toggle('locked', locked);
      r.level.textContent = locked ? '' : `Lv ${level}`;
      const { levels, cost } = bulkCost(r.def, level, s.buyAmount, s.gold);
      const shown = levels > 0 ? { levels, cost } : bulkCost(r.def, level, 1, s.gold);
      if (locked) {
        r.stats.textContent = `ATK ${fmt(heroAtk(r.def, 1))} · HP ${fmt(heroHp(r.def, 1))}`;
        r.label.textContent = 'Recruit';
      } else {
        const next = level + shown.levels;
        r.stats.innerHTML = `ATK ${fmt(heroAtk(r.def, level))} <span class="next">→ ${fmt(heroAtk(r.def, next))}</span> · HP ${fmt(heroHp(r.def, level))}`;
        r.label.textContent = `Level +${shown.levels}`;
      }
      r.cost.textContent = fmt(shown.cost);
      r.button.disabled = shown.cost.gt(s.gold);
    }

    const scene = this.scene();
    for (const u of this.ults) {
      const level = s.levels[u.def.id] ?? 0;
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
