import Decimal from 'break_infinity.js';
import { HEROES, ELEMENT_COLORS, ULT_UNLOCK_LEVEL, SPEED_UNLOCK_STAGE, REKINDLE_STAGE, BOSS_EVERY, REKINDLE_BOOSTS, ROAD_START, ROAD_STEP, ROAD_LENGTH, ROAD_GEMS, KEEPER_BONUS_PER_LEVEL, STAR_CRESTS, CHEST_COST, CHEST_DROPS, CREST_ROLLS, CHEST_RARITY_WEIGHTS, ULT_STAR_BONUS, AURA_EVOLUTIONS, ULT_PLUS_EVOLUTIONS, LEGENDARY_MEDAL_RATE, MAX_STARS, ULT_MULTIPLIER, ULT_COOLDOWN, LINEUP_SIZE, RELICS, RELIC_LEVELS_PER_TIER, TRIAL_ROTATION, TRIAL_SCHEDULE, DAY_NAMES, TRIAL_TIERS, TRIAL_LEVELS, TRIAL_TIME, TRIAL_BOSS_NAMES, ESSENCE_NAMES, TICKET_CAP, STALLS, STALL_AUTO_LEVEL, STALL_MILESTONE, STALL_REKINDLE_REVENUE, STALL_REKINDLE_LEVELS, STALL_REKINDLE_LEVELS_CAP, type HeroDef, type StallDef, type Element, type RelicDef } from './data';
import { play } from './sfx';
import { setMuted } from './sfx';
import { bulkCost, upgradeCost, stallUpgradeCost, stallBulkCost, trialHp, isBossStage, emberCost, emberStageBonus, keeperThreshold, fmt, fmtDuration } from './formulas';
import type { GameState, OfflineReport, SummonDrop } from './state';
import type { BattleScene } from './BattleScene';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
const SWORD = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 2l2 2-11 11 2 2-2 2-2-2-3 3-2-2 3-3-2-2 2-2 2 2z"/></svg>';
const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21C5 15 2 12 2 8a5 5 0 0 1 10-1 5 5 0 0 1 10 1c0 4-3 7-10 13z"/></svg>';
const ULT_ICONS: Record<string, string> = {
  water: '<svg viewBox="0 0 24 24"><path d="M12 2c4 6 7 9 7 13a7 7 0 0 1-14 0c0-4 3-7 7-13z"/></svg>',
  earth: '<svg viewBox="0 0 24 24"><path d="M5 19C5 9 11 4 21 3c-1 10-6 16-16 16zm0 0l8-8"/></svg>',
  fire: '<svg viewBox="0 0 24 24"><path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-7 0 2 1 3 2 3 0-3-1-5 1-8z"/></svg>',
  dark: '<svg viewBox="0 0 24 24"><path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11z"/></svg>',
  light: '<svg viewBox="0 0 24 24"><path d="M12 2l2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z"/></svg>',
};
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

interface StallRow {
  def: StallDef;
  root: HTMLElement;
  level: HTMLElement;
  fill: HTMLElement;
  amount: HTMLElement;
  meta: HTMLElement;
  button: HTMLButtonElement;
  cost: HTMLElement;
  label: HTMLElement;
  collect: HTMLButtonElement;
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
    this.buildMarket();
    this.buildRelics();
    let last = performance.now();
    setInterval(() => {
      const now = performance.now();
      this.state.tickMarket(Math.min(5, (now - last) / 1000));
      last = now;
      this.render();
    }, 200);
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

  /** Manage Team: pick which recruited heroes fight. */
  private openTeam(note = '') {
    const s = this.state;
    const count = s.lineupCount();
    const rows = HEROES.map((h) => {
      const recruited = (s.levels[h.id] ?? 0) > 0;
      const on = s.inLineup(h.id);
      const spent = s.goldSpent(h.id);
      const label = !recruited ? 'Locked' : on ? (spent.gt(0) ? `Remove (+${fmt(spent)} gold)` : 'Remove') : 'Add';
      const disabled = !recruited || (on && count <= 1) || (!on && count >= LINEUP_SIZE);
      return `<li class="team-row${on ? ' on' : ''}${recruited ? '' : ' locked'}">
        <span class="face" style="background:${hex(ELEMENT_COLORS[h.element])}">${h.name[0]}</span>
        <span class="team-who"><b>${h.name}</b><small>${recruited ? `Lv ${s.heroLevel(h.id)} · ${on ? 'In team' : 'Benched'}` : `${cap(h.element)} ${h.job}`}</small></span>
        <button data-lineup="${h.id}" class="${on ? '' : 'hot'}" ${disabled ? 'disabled' : ''}>${label}</button>
      </li>`;
    }).join('');
    this.showModal(
      `Team ${count}/${LINEUP_SIZE}`,
      `${note ? `<p class="team-note">${note}</p>` : ''}<ul class="team-list">${rows}</ul><p class="team-help">Only heroes in the team fight. Taking a hero out drops them to gold level 1 and gives that gold back. Their Ember levels stay, since Embers also count in Trials and PvP.</p>`,
      'Done',
    );
  }

  private stallRows: StallRow[] = [];

  private relicRows: { def: RelicDef; root: HTMLElement; eff: HTMLElement; tier: HTMLElement; cost: HTMLElement; up: HTMLButtonElement; equip: HTMLButtonElement }[] = [];

  private buildRelics() {
    const host = $('relics');
    for (const def of RELICS) {
      const root = document.createElement('div');
      root.className = 'relic';
      const [a, b] = def.essences;
      root.innerHTML = `
        <div class="relic-art" style="--a:${hex(ELEMENT_COLORS[a])};--b:${hex(ELEMENT_COLORS[b])}" aria-hidden="true">${def.name[0]}</div>
        <div class="relic-info"><b>${def.name} <small class="tier" style="display:inline"></small></b><span class="eff"></span><small>${def.blurb}</small><div class="relic-cost"></div></div>
        <div class="relic-btns"><button class="wood-btn small up"></button><button class="wood-btn small equip"></button></div>`;
      host.appendChild(root);
      const up = root.querySelector('.up') as HTMLButtonElement;
      const equip = root.querySelector('.equip') as HTMLButtonElement;
      up.addEventListener('click', () => {
        if (this.state.upgradeRelic(def.id)) {
          play('unlock');
          this.scene()?.syncHeroes();
          this.render();
        }
      });
      equip.addEventListener('click', () => {
        if (this.state.toggleRelic(def.id)) {
          this.scene()?.syncHeroes();
          this.render();
        }
      });
      this.relicRows.push({ def, root, eff: root.querySelector('.eff') as HTMLElement, tier: root.querySelector('.tier') as HTMLElement, cost: root.querySelector('.relic-cost') as HTMLElement, up, equip });
    }
    $('relic-buyslot').addEventListener('click', () => {
      if (this.state.buyRelicSlot()) {
        play('unlock');
        this.render();
      }
    });
  }

  /** Returns true when something on the Relics tab is worth a look (an upgrade for an equipped relic, or a free slot). */
  private renderRelics(): boolean {
    const s = this.state;
    let worthALook = false;
    const effectText = (def: RelicDef, level: number) => {
      const pct = def.perLevel * level;
      const what = { atk: 'All heroes ATK', hp: 'All heroes HP', gold: 'Gold from enemies', stall: 'Stall income', trial: 'Damage in Trials' }[def.effect as string] ?? `${cap(def.effect)} heroes ATK`;
      return `${what} +${pct}%`;
    };
    $('relic-slots').textContent = `Equipped ${s.equipped.length}/${s.relicSlots}`;
    $('relic-ess').innerHTML = TRIAL_ROTATION.map((e) => `<span style="--el:${hex(ELEMENT_COLORS[e])}" title="${ESSENCE_NAMES[e]}"><i></i>${fmt(s.essences[e] ?? 0)}</span>`).join('');
    const slotCost = s.nextSlotCost();
    const slotBtn = $<HTMLButtonElement>('relic-buyslot');
    slotBtn.hidden = slotCost === null;
    slotBtn.textContent = `+1 slot · ${slotCost} Gems`;
    slotBtn.disabled = slotCost === null || s.gems < slotCost;
    const freeSlot = s.equipped.length < s.relicSlots;
    for (const r of this.relicRows) {
      const level = s.relics[r.def.id] ?? 0;
      const on = s.equipped.includes(r.def.id);
      const cost = s.relicNextCost(r.def);
      const can = s.canUpgradeRelic(r.def);
      r.root.classList.toggle('on', on);
      r.root.classList.toggle('uncrafted', level === 0);
      const tier = Math.ceil(level / RELIC_LEVELS_PER_TIER);
      const inTier = level - (tier - 1) * RELIC_LEVELS_PER_TIER;
      r.tier.textContent = level ? `· Tier ${['I', 'II', 'III', 'IV', 'V'][tier - 1]} Lv ${inTier}` : '';
      r.eff.textContent = level ? effectText(r.def, level) : `Crafts to: ${effectText(r.def, 1)}`;
      r.cost.innerHTML =
        cost === null
          ? '<span>Max level</span>'
          : r.def.essences.map((e) => `<span class="${(s.essences[e] ?? 0) < cost ? 'short' : ''}" title="${ESSENCE_NAMES[e]}"><i style="--el:${hex(ELEMENT_COLORS[e])}"></i>${fmt(cost)}</span>`).join('');
      const nextTier = level > 0 && level % RELIC_LEVELS_PER_TIER === 0;
      r.up.textContent = level === 0 ? 'Craft' : cost === null ? 'Maxed' : nextTier ? 'Next tier' : 'Upgrade';
      r.up.disabled = !can;
      r.equip.hidden = level === 0;
      r.equip.textContent = on ? 'Take off' : 'Equip';
      r.equip.disabled = !on && !freeSlot;
      if ((on && can) || (level > 0 && !on && freeSlot)) worthALook = true;
    }
    return worthALook;
  }

  private buildMarket() {
    const host = $('stalls');
    for (const def of STALLS) {
      const root = document.createElement('div');
      root.className = 'stall';
      root.innerHTML = `
        <div class="stall-art" style="--c:${hex(def.color)}" aria-hidden="true"><span class="awning"></span><span class="stall-lv"></span></div>
        <div class="stall-info">
          <div class="banner" style="--el:${hex(def.color)}"><span class="name">${def.name}</span></div>
          <button class="stall-bar" aria-label="Collect ${def.name}"><i></i><span class="stall-amt"></span></button>
          <div class="meta"></div>
        </div>
        <button class="gold-up"><span class="cost"></span><span class="label"></span></button>`;
      host.appendChild(root);
      const button = root.querySelector('.gold-up') as HTMLButtonElement;
      button.addEventListener('click', () => {
        const before = this.state.stalls[def.id].level;
        if (this.state.buyStall(def.id)) {
          const after = this.state.stalls[def.id].level;
          if (before === 0 || (before < STALL_AUTO_LEVEL && after >= STALL_AUTO_LEVEL)) play('unlock');
          this.render();
        }
      });
      const collect = root.querySelector('.stall-bar') as HTMLButtonElement;
      collect.addEventListener('click', () => {
        if (this.state.collectStall(def.id)) {
          play('coin');
          this.render();
        }
      });
      this.stallRows.push({
        def,
        root,
        level: root.querySelector('.stall-lv') as HTMLElement,
        fill: root.querySelector('.stall-bar i') as HTMLElement,
        amount: root.querySelector('.stall-amt') as HTMLElement,
        meta: root.querySelector('.stall-info .meta') as HTMLElement,
        button,
        cost: root.querySelector('.gold-up .cost') as HTMLElement,
        label: root.querySelector('.gold-up .label') as HTMLElement,
        collect,
      });
    }
  }

  private renderMarket(): boolean {
    const s = this.state;
    let anyReady = false;
    const bonus = s.stallBonusLevels();
    $('market-note').textContent =
      s.rekindles > 0
        ? `Rekindle bonus: Stall income x${s.marketRevenueMult().toFixed(2)}, +${bonus} levels on auto-collect Stalls.`
        : `Tap a full bar to collect. Stalls collect themselves from level ${STALL_AUTO_LEVEL}.`;
    let prevOpen = true;
    for (const r of this.stallRows) {
      const st = s.stalls[r.def.id];
      const open = st.level > 0;
      const auto = s.stallAuto(r.def.id);
      const ready = s.stallReady(r.def.id);
      anyReady ||= ready;
      r.root.classList.toggle('locked', !open);
      r.root.classList.toggle('ready', ready);
      r.root.hidden = !open && !prevOpen;
      prevOpen = open;
      const eff = s.stallEffectiveLevel(r.def.id);
      r.level.textContent = open ? `Lv ${eff}` : '';
      const income = s.stallIncome(r.def);
      r.fill.style.width = open ? `${Math.min(100, (st.progress / r.def.cycle) * 100)}%` : '0%';
      r.amount.textContent = !open ? 'Closed' : ready ? `Collect ${fmt(income)}` : `${fmt(income)}`;
      r.collect.disabled = !ready;
      const toMilestone = STALL_MILESTONE - (st.level % STALL_MILESTONE);
      r.meta.textContent = !open
        ? `${r.def.blurb} ${fmt(stallIncomePreview(r.def))} gold every ${r.def.cycle}s.`
        : `${fmt(income)} every ${r.def.cycle}s · ${auto ? 'Auto-collect' : `Auto at Lv ${STALL_AUTO_LEVEL}`} · x3 in ${toMilestone} Lv`;
      const bulk = stallBulkCost(r.def, st.level, s.stallBuyAmount, s.gold);
      const shown = bulk.levels > 0 ? bulk : stallBulkCost(r.def, st.level, 1, s.gold);
      r.cost.textContent = fmt(shown.cost);
      r.label.textContent = open ? `Level +${shown.levels}` : 'Open';
      r.button.disabled = shown.cost.gt(s.gold);
    }
    $<HTMLButtonElement>('stall-levelall').disabled = !STALLS.some((d) => s.stalls[d.id].level > 0 && stallUpgradeCost(d, s.stalls[d.id].level).lte(s.gold));
    $('stall-buyamt').textContent = `Buy ${s.stallBuyAmount === 'max' ? 'max' : `x${s.stallBuyAmount}`}`;
    return anyReady;
  }

  private buildUlts() {
    const host = $('ults');
    for (const def of HEROES) {
      const button = document.createElement('button');
      button.className = 'ult';
      button.style.setProperty('--el', hex(ELEMENT_COLORS[def.element]));
      button.innerHTML = `${ULT_ICONS[def.element]}<span class="cd"></span>`;
      button.setAttribute('aria-label', `${def.name} ultimate: ${def.ultimate.name}`);
      button.title = `${def.name}: ${def.ultimate.name} (unlocks at Lv ${ULT_UNLOCK_LEVEL})`;
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
    $('settings-btn').addEventListener('click', () => ($('settings').hidden = false));
    $('settings-close').addEventListener('click', () => ($('settings').hidden = true));
    $('settings').addEventListener('click', (e) => {
      if (e.target === $('settings')) $('settings').hidden = true;
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
    $('tr-down').addEventListener('click', () => this.stepTier(-1));
    $('tr-up').addEventListener('click', () => this.stepTier(1));
    $('tr-fight').addEventListener('click', () => this.fightTrial());
    $('tr-days').addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-el]');
      if (!btn || btn.disabled) return;
      this.trialPick = btn.dataset.el as Element;
      this.trialTier = 0;
      this.renderTrials();
    });
    $('levelall').addEventListener('click', () => {
      if (this.state.levelAll() > 0) {
        play('unlock');
        this.scene()?.syncHeroes();
        this.render();
      }
    });
    $('buyamt').addEventListener('click', () => {
      const order: Array<1 | 10 | 'max'> = [1, 10, 'max'];
      this.state.buyAmount = order[(order.indexOf(this.state.buyAmount) + 1) % order.length];
      this.render();
    });
    $('stall-levelall').addEventListener('click', () => {
      if (this.state.levelAllStalls() > 0) {
        play('unlock');
        this.render();
      }
    });
    $('stall-buyamt').addEventListener('click', () => {
      const order: Array<1 | 10 | 'max'> = [1, 10, 'max'];
      this.state.stallBuyAmount = order[(order.indexOf(this.state.stallBuyAmount) + 1) % order.length];
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

    $('summon').addEventListener('click', () => this.confirmChest());
    $('chest-btn').addEventListener('click', () => this.confirmChest());
    $('collection-btn').addEventListener('click', () => this.openSheet(HEROES[0].id));
    $('team-btn').addEventListener('click', () =>
      this.openTeam(),
    );
    $('modal-body').addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-lineup]');
      if (!btn || btn.disabled) return;
      const id = btn.dataset.lineup!;
      const refund = this.state.setInLineup(id, !this.state.inLineup(id));
      if (refund === null) return;
      play(refund.gt(0) ? 'coin' : 'unlock');
      this.scene()?.syncHeroes();
      this.render();
      const name = HEROES.find((h) => h.id === id)!.name;
      this.openTeam(this.state.inLineup(id) ? '' : `${name} left the team. ${fmt(refund)} gold came back; their Embers stay.`);
    });
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

  /** Hero Chest pop-up: shows what's inside and asks before spending Gems. */
  private confirmChest() {
    const s = this.state;
    const odds = (Object.keys(CHEST_RARITY_WEIGHTS) as Array<keyof typeof CHEST_RARITY_WEIGHTS>)
      .map((r) => `<li><b>${cap(r)}</b><span>${CHEST_RARITY_WEIGHTS[r]}% · ${CREST_ROLLS[r].map(([c]) => c).join('/')} medals</span></li>`)
      .join('');
    const faces = HEROES.map((h) => `<span class="face" title="${h.name}" style="background:${hex(ELEMENT_COLORS[h.element])}">${h.name[0]}</span>`).join('');
    const afford = s.gems >= CHEST_COST;
    this.showModal(
      'Hero Chest',
      `<div class="chest-pop"><div class="chest-art" aria-hidden="true"></div>
        <p>${CHEST_DROPS} drops of Hero Crests (medals). Collect enough to unlock a hero, then keep collecting to evolve them. Legendary heroes never drop.</p>
        <div class="chest-heroes">${faces}</div>
        <ul class="chest-odds">${odds}</ul>
        <p class="chest-wallet">You have <b>${s.gems}</b> Gems${afford ? '' : `. You need ${CHEST_COST - s.gems} more.`}</p></div>`,
      afford ? `Buy · ${CHEST_COST} Gems` : 'Okay',
      afford ? () => this.summon() : null,
      afford,
      'Cancel',
    );
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
        return `<div class="drop"><div class="face" style="background:${hex(ELEMENT_COLORS[def.element])}">${def.name[0]}</div><b>${def.name}</b>${d.isNew ? '<span class="new">READY TO UNLOCK</span>' : ''}<span class="crest">+${d.crests} Crests</span></div>`;
      })
      .join('');
    const canAgain = this.state.gems >= CHEST_COST;
    this.showModal(
      'Hero Chest',
      `<div class="summon-grid">${cards}</div>Tap a hero to evolve them when their Crest bar is full.`,
      canAgain ? `Open another (${CHEST_COST} Gems)` : 'Done',
      canAgain ? () => this.summon() : null,
      canAgain,
      'Done',
    );
  }

  // ---------- hero page ----------

  private sheetHero: string | null = null;

  openSheet(id: string) {
    this.sheetHero = id;
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

    // A hero is 1★ when unlocked; each evolution adds a star, up to 8★.
    $('sheet-stars').innerHTML = [0, ...STAR_CRESTS].map((_, i) => `<span class="${gold > 0 && i <= stars ? 'on' : ''}">★</span>`).join('');
    const shownLevel = gold > 0 ? eff : 1 + ember;
    const power = s.heroPower(def, shownLevel);
    const stat = (label: string, value: string) => `<div><small>${label}</small><b>${value}</b></div>`;
    $('sheet-stats').innerHTML = [
      stat('Level', gold > 0 ? String(eff) : 'Locked'),
      stat('ATK', fmt(power.atk)),
      stat('HP', fmt(power.hp)),
      stat('Attacks / sec', (1 / def.attackCooldown).toFixed(2)),
      stat('Range', def.range > 60 ? `Ranged (${def.range})` : 'Melee'),
      stat('Gold per kill', `${def.goldMult}x`),
    ].join('');

    $('sheet-gold-lvl').textContent = gold > 0 ? String(gold) : '(locked)';
    const { levels, cost } = bulkCost(def, gold, s.buyAmount, s.gold);
    const shown = levels > 0 ? { levels, cost } : bulkCost(def, gold, 1, s.gold);
    const goldBtn = $<HTMLButtonElement>('sheet-gold-up');
    if (gold === 0) {
      const need = s.unlockCrests(def);
      (goldBtn.querySelector('.label') as HTMLElement).textContent = 'Unlock';
      (goldBtn.querySelector('.cost') as HTMLElement).textContent = need === null ? 'Special event' : `${Math.min(s.crests[def.id] ?? 0, need)}/${need} Crests`;
      goldBtn.disabled = !s.canUnlock(def);
    } else {
      (goldBtn.querySelector('.label') as HTMLElement).textContent = `Level +${shown.levels}`;
      (goldBtn.querySelector('.cost') as HTMLElement).textContent = fmt(shown.cost);
      goldBtn.disabled = shown.cost.gt(s.gold);
    }

    $('sheet-ember-lvl').textContent = `+${ember}`;
    $('sheet-embers').textContent = String(s.embers);
    const ec = emberCost(ember);
    const emberBtn = $<HTMLButtonElement>('sheet-ember-up');
    (emberBtn.querySelector('.cost') as HTMLElement).textContent = `${ec} Ember${ec === 1 ? '' : 's'}`;
    emberBtn.disabled = ec > s.embers;
    $('sheet-ember-note').textContent = 'Ember levels stay on this hero for good, even out of the team, and count in Trials and PvP.';
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
    $('sheet-crests').textContent = next === null ? `Max stars · ${s.legendaryMedals} Legendary medals` : `${crests} / ${next} for ${stars + 2}★`;
    $('sheet-crest-fill').style.width = next === null ? '100%' : `${Math.min(100, (crests / next) * 100)}%`;
    const evolve = $<HTMLButtonElement>('sheet-evolve');
    evolve.hidden = next === null || crests < next || gold === 0;
    evolve.textContent = `Evolve to ${stars + 2}★ (${next} Crests)`;
    const unlocks: Array<[number, string, string]> = [
      [1, `${def.sp1.name}`, def.sp1.text],
      [2, `${def.sp2.name}`, def.sp2.text],
      [AURA_EVOLUTIONS, `Aura: ${def.aura.name}`, def.aura.text],
      [ULT_PLUS_EVOLUTIONS, `${def.ultimate.name}+`, `Ultimate hits for ${ULT_MULTIPLIER * ULT_STAR_BONUS}x instead of ${ULT_MULTIPLIER}x.`],
      [5, '6★ to 7★', 'Each extra star doubles all stats again.'],
      [MAX_STARS, 'Legendary medals', `At 8★ every ${LEGENDARY_MEDAL_RATE} extra medals for this hero become a Legendary medal, used to get Legendary heroes.`],
    ];
    if ($('sheet-unlocks').dataset.key !== `${id}:${stars}`) {
      $('sheet-unlocks').innerHTML = unlocks
        .map(([star, name, text]) => {
          const on = stars >= star;
          return `<li class="${on ? '' : 'locked'}"><span class="kind">${star + 1}★</span><span class="tag${on ? ' ready' : ''}">${on ? 'Unlocked' : 'Locked'}</span><div><b>${name}</b></div><p>${text}</p></li>`;
        })
        .join('');
      $('sheet-unlocks').dataset.key = `${id}:${stars}`;
    }
  }

  private modalAction: (() => void) | null = null;

  private showModal(title: string, html: string, ok: string, action: (() => void) | null = null, cancel = false, cancelLabel = 'Not yet') {
    $('modal-title').textContent = title;
    $('modal-body').innerHTML = html;
    $('modal-ok').textContent = ok;
    $('modal-cancel').hidden = !cancel;
    $('modal-cancel').textContent = cancelLabel;
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

  private trialTier = 0;
  private trialPick: Element | null = null;

  /** The Trial being looked at: the player's pick if it's open today, else the first open one. */
  private trialEl(): Element {
    const open = this.state.openTrials();
    if (!this.trialPick || !open.includes(this.trialPick)) this.trialPick = open[0];
    return this.trialPick;
  }

  private stepTier(dir: number) {
    const max = this.state.trialUnlocked(this.trialEl());
    this.trialTier = Math.min(max, Math.max(1, this.currentTier() + dir));
    this.renderTrials();
  }

  private currentTier() {
    const max = this.state.trialUnlocked(this.trialEl());
    if (this.trialTier < 1 || this.trialTier > max) this.trialTier = max;
    return this.trialTier;
  }

  private renderTrials() {
    const s = this.state;
    const wait = s.refreshTickets();
    const el = this.trialEl();
    const tier = this.currentTier();
    const mm = Math.floor(wait / 60);
    const ss = String(wait % 60).padStart(2, '0');
    $('tr-tickets').textContent = `Tickets ${s.tickets}/${TICKET_CAP}${wait ? ` · next ${mm}:${ss}` : ''}`;
    const open = s.openTrials();
    const key = `${el}:${open.join(',')}`;
    if ($('tr-days').dataset.key !== key) {
      $('tr-days').dataset.key = key;
      $('tr-days').innerHTML = TRIAL_ROTATION.map((e) => {
        const isOpen = open.includes(e);
        const days = TRIAL_SCHEDULE[e].map((d) => DAY_NAMES[d]).join(' ');
        return `<button class="trial-day${isOpen ? ' open' : ''}${e === el ? ' today' : ''}" data-el="${e}" style="--el:${hex(ELEMENT_COLORS[e])}" ${isOpen ? '' : 'disabled'} title="${cap(e)}: ${days}"><b>${cap(e)}</b><small>${isOpen ? 'Open' : days}</small></button>`;
      }).join('');
      $('tr-face').style.background = hex(ELEMENT_COLORS[el]);
      $('tr-face').textContent = TRIAL_BOSS_NAMES[el][0];
      $('tr-name').textContent = `${TRIAL_BOSS_NAMES[el]} (${cap(el)})`;
    }
    const level = TRIAL_LEVELS[tier - 1];
    const medals = level.medals === 1 ? 'a Crest (medal) for a random' : `Crests (medals) for ${level.medals} random`;
    $('tr-info').textContent = `Uses Ember levels and stars, not gold levels. Drops ${ESSENCE_NAMES[el]} and ${medals} ${cap(el)} hero${level.medals === 1 ? '' : 'es'}.`;
    $('tr-tier').textContent = `Level ${tier} / ${TRIAL_TIERS}`;
    $<HTMLButtonElement>('tr-down').disabled = tier <= 1;
    $<HTMLButtonElement>('tr-up').disabled = tier >= s.trialUnlocked(el);
    const sim = s.simulateTrial(tier, el);
    const reqMet = s.trialReqMet(tier);
    const req = level.req
      ? `<span class="${reqMet ? 'win' : 'lose'}">Needs ${level.req[0]} heroes at Ember ${level.req[1]}+ (you have ${s.heroesAtEmber(level.req[1])})</span>`
      : 'No hero requirement';
    $('tr-odds').innerHTML = `Difficulty <b>${level.difficulty.toLocaleString()}</b> · reward <b>${fmt(level.essence)}</b> Essence · ${level.medals} medal${level.medals === 1 ? '' : 's'}<br>${req}<br>Boss HP <b>${fmt(trialHp(level))}</b> · team damage in ${TRIAL_TIME}s <b>${fmt(sim.dps.times(TRIAL_TIME))}</b> · <span class="${sim.won ? 'win' : 'lose'}">${sim.won ? 'You should win' : 'Too strong for now'}</span>`;
    const fight = $<HTMLButtonElement>('tr-fight');
    fight.disabled = s.tickets <= 0 || !reqMet;
    fight.textContent = !reqMet ? 'Locked' : s.tickets > 0 ? 'Fight · 1 ticket' : 'No tickets';
    $('tr-ess').innerHTML = TRIAL_ROTATION.map((e) => `<span style="--el:${hex(ELEMENT_COLORS[e])}" title="${ESSENCE_NAMES[e]}"><i></i>${s.essences[e] ?? 0}</span>`).join('');
  }

  /** Play a Trial: the fight is simulated, then shown as two draining HP bars. */
  private fightTrial() {
    const s = this.state;
    const tier = this.currentTier();
    const el = this.trialEl();
    const result = s.playTrial(el, tier);
    if (!result) return;
    const medalNames = result.medals.map((id) => HEROES.find((h) => h.id === id)!.name).join(', ');
    this.showModal(
      `${TRIAL_BOSS_NAMES[el]} · Level ${tier}`,
      `<div class="trial-fight">
        <div class="tf-row"><span>Boss</span><div class="tf-bar boss"><i id="tf-boss"></i></div></div>
        <div class="tf-row"><span>Team</span><div class="tf-bar team"><i id="tf-team"></i></div></div>
        <p id="tf-clock" class="tf-clock">0s</p>
        <p id="tf-result" class="tf-result" hidden></p>
      </div>`,
      'Fighting…',
    );
    const ok = $<HTMLButtonElement>('modal-ok');
    ok.disabled = true;
    play('boss');
    const start = performance.now();
    const length = 2500;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / length);
      const boss = 1 - t * (1 - result.bossLeft);
      const team = 1 - t * (1 - result.teamLeft);
      const bossBar = document.getElementById('tf-boss');
      const teamBar = document.getElementById('tf-team');
      if (!bossBar || !teamBar) return;
      bossBar.style.width = `${boss * 100}%`;
      teamBar.style.width = `${team * 100}%`;
      $('tf-clock').textContent = `${Math.round(t * result.seconds)}s`;
      if (t < 1) {
        requestAnimationFrame(step);
        return;
      }
      const res = $('tf-result');
      res.hidden = false;
      res.innerHTML = result.won
        ? `Victory! +${fmt(result.essence)} ${ESSENCE_NAMES[el]} · medal${result.medals.length === 1 ? '' : 's'}: ${medalNames}`
        : `Defeated. Your ticket was kept. Raise Ember levels or stars and try again.`;
      res.className = `tf-result ${result.won ? 'win' : 'lose'}`;
      play(result.won ? 'clear' : 'defeat');
      ok.disabled = false;
      ok.textContent = 'Okay';
      this.render();
    };
    requestAnimationFrame(step);
  }

  private renderBattle() {
    this.renderTrials();
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

    const plus = (r: number) => `+${Math.round(r * 100)}%`;
    $('rk-mr-rev').textContent = `${plus(STALL_REKINDLE_REVENUE * s.rekindles)} → ${plus(STALL_REKINDLE_REVENUE * (s.rekindles + 1))}`;
    $('rk-mr-lv').textContent = `+${s.stallBonusLevels()} → +${Math.min(STALL_REKINDLE_LEVELS_CAP, STALL_REKINDLE_LEVELS * (s.rekindles + 1))}`;
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
    if (level === 0) {
      if (this.state.unlockHero(def.id)) {
        play('unlock');
        this.scene()?.syncHeroes();
        this.render();
      }
      return;
    }
    const { levels, cost } = bulkCost(def, level, this.state.buyAmount, this.state.gold);
    if (levels === 0 || cost.gt(this.state.gold)) return;
    this.state.gold = this.state.gold.minus(cost);
    this.state.levels[def.id] = level + levels;
    this.scene()?.syncHeroes();
    this.render();
  }

  showOffline(report: OfflineReport) {
    const stages = report.stages > 0 ? `<br>Your heroes pushed <b>${report.stages}</b> stage${report.stages === 1 ? '' : 's'}.` : '';
    const market = report.market.gt(0) ? `<br>Market Row made <b>${fmt(report.market)}</b> of that.` : '';
    this.showModal('Welcome back!', `You were away for ${fmtDuration(report.seconds)}.<br>You earned <b>${fmt(report.gold)}</b> gold.${market}${stages}`, 'Collect');
  }

  render() {
    const s = this.state;
    $('gold').textContent = fmt(s.gold);
    $('gps').textContent = `${fmt(new Decimal(s.goldPerSec))}/s`;
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
    $<HTMLButtonElement>('levelall').disabled = !HEROES.some((h) => (s.levels[h.id] ?? 0) > 0 && upgradeCost(h, s.levels[h.id]).lte(s.gold));
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
      r.stars.textContent = locked ? '' : '★'.repeat(starCount + 1);
      const evolveCost = s.evolveCost(r.def.id);
      const canEvolve = !locked && evolveCost !== null && (s.crests[r.def.id] ?? 0) >= evolveCost;
      const benched = !locked && !s.inLineup(r.def.id);
      r.root.classList.toggle('benched', benched);
      r.ember.textContent = benched ? '· Benched' : canEvolve ? '· Ready to evolve!' : s.embers >= emberCost(emberLevel) ? '· Embers ready' : '';
      if (!benched && (canEvolve || (s.embers > 0 && s.embers >= emberCost(emberLevel)))) heroesBadge = true;
      const { levels, cost } = bulkCost(r.def, level, s.buyAmount, s.gold);
      const shown = levels > 0 ? { levels, cost } : bulkCost(r.def, level, 1, s.gold);
      if (locked) {
        const p1 = s.heroPower(r.def, 1);
        r.stats.innerHTML = `<span class="st atk">${SWORD}${fmt(p1.atk)}</span><span class="st hp">${HEART}${fmt(p1.hp)}</span>`;
        r.label.textContent = 'Unlock';
      } else {
        const next = eff + shown.levels;
        const now = s.heroPower(r.def, eff);
        r.stats.innerHTML = `<span class="st atk">${SWORD}${fmt(now.atk)} <span class="next">→ ${fmt(s.heroPower(r.def, next).atk)}</span></span><span class="st hp">${HEART}${fmt(now.hp)}</span>`;
        r.label.textContent = shown.levels === 1 ? 'Level Up' : `Level +${shown.levels}`;
      }
      if (locked) {
        const need = s.unlockCrests(r.def);
        r.cost.textContent = need === null ? 'Special event' : `${Math.min(s.crests[r.def.id] ?? 0, need)}/${need} Crests`;
        r.button.disabled = !s.canUnlock(r.def);
        if (s.canUnlock(r.def)) heroesBadge = true;
      } else {
        r.cost.textContent = fmt(shown.cost);
        r.button.disabled = shown.cost.gt(s.gold);
      }
    }

    this.badge('market', this.renderMarket());
    this.badge('relics', this.renderRelics());
    this.badge('battle', s.rekindles > 0 && s.tickets >= TICKET_CAP);
    this.badge('heroes', heroesBadge);
    this.badge('shop', s.gems >= CHEST_COST);
    if (this.tab === 'battle') this.renderBattle();
    this.renderSheet();

    const scene = this.scene();
    for (const u of this.ults) {
      const fights = this.state.inLineup(u.def.id);
      u.button.hidden = !fights;
      if (!scene || !fights) continue;
      const st = scene.getUltState(u.def.id);
      const ready = st.unlocked && st.alive && st.remaining <= 0;
      u.button.disabled = !ready;
      u.button.classList.toggle('ready', ready);
      u.cd.textContent = !st.unlocked ? `Lv${ULT_UNLOCK_LEVEL}` : !st.alive ? 'down' : st.remaining > 0 ? `${Math.ceil(st.remaining)}` : '';
      u.cd.style.display = ready ? 'none' : 'flex';
      // Cooldown shade drains from the top as the ultimate recharges.
      u.button.style.setProperty('--cd', !st.unlocked || !st.alive ? '1' : String(Math.min(1, st.remaining / ULT_COOLDOWN)));
    }
  }
}

function stallIncomePreview(def: StallDef) {
  return new Decimal(def.baseIncome);
}

function cap(s: string) {
  return s[0].toUpperCase() + s.slice(1);
}
