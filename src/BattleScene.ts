import Phaser from 'phaser';
import Decimal from 'break_infinity.js';
import {
  HEROES,
  ELEMENT_COLORS,
  BOSS_NAMES,
  BOSS_TIME_LIMIT,
  RESPAWN_SECONDS,
  ULT_COOLDOWN,
  ULT_MULTIPLIER,
  ULT_STAR_BONUS,
  BOSS_GEMS,
  ULT_UNLOCK_LEVEL,
  SPEED_UNLOCK_STAGE,
  CRIT_CHANCE,
  CRIT_MULTIPLIER,
  elementMultiplier,
  enemyElement,
  bossElement,
  bossWeakness,
  BOSS_ROTATION_START,
  type Element,
  type HeroDef,
} from './data';
import {
  isBossStage,
  enemyHp,
  enemyAtk,
  bossHp,
  bossAtk,
  crystalHp,
  goldPerKill,
  stageClearGold,
  fmt,
} from './formulas';
import type { GameState } from './state';
import { play } from './sfx';

/** Visible area. The lane itself is WORLD_WIDTH long and the camera follows the heroes. */
export const WIDTH = 480;
const WORLD_WIDTH = 1440;
export const HEIGHT = 300;
const PLAYER_CRYSTAL_X = 36;
const ENEMY_CRYSTAL_X = WORLD_WIDTH - 36;
/** Enemy camps along the lane, as fractions of its length. They wait until a hero gets close. */
const CAMPS = [0.3, 0.55, 0.8];
const CAMP_AGGRO = 170;
const LANE_TOP = 175;
const LANE_BOTTOM = 255;
const WAVE_INTERVAL = 7;
const MAX_ENEMIES = 14;

interface Unit {
  side: 'hero' | 'enemy';
  def?: HeroDef;
  x: number;
  y: number;
  hp: Decimal;
  maxHp: Decimal;
  atk: Decimal;
  range: number;
  cooldown: number;
  cooldownLeft: number;
  speed: number;
  element: Element;
  goldMult: number;
  isBoss: boolean;
  /** Attacks made, for every-Nth-attack skills. */
  attacks: number;
  /** Camp enemies hold position until a hero comes within CAMP_AGGRO. */
  waiting: boolean;
  alive: boolean;
  respawnAt: number;
  ultReadyAt: number;
  view: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Image;
  hpBar: Phaser.GameObjects.Graphics;
  barWidth: number;
}

interface ChestKind {
  key: string;
  weight: number;
  killsWorth: number;
}

const CHESTS: ChestKind[] = [
  { key: 'chest-wood', weight: 60, killsWorth: 5 },
  { key: 'chest-bronze', weight: 30, killsWorth: 15 },
  { key: 'chest-gold', weight: 10, killsWorth: 50 },
];

export interface UltState {
  unlocked: boolean;
  alive: boolean;
  remaining: number;
}

export class BattleScene extends Phaser.Scene {
  private state!: GameState;
  private heroes: Unit[] = [];
  private enemies: Unit[] = [];
  private crystal = { hp: new Decimal(1), maxHp: new Decimal(1) };
  private crystalView!: Phaser.GameObjects.Image;
  private crystalShield!: Phaser.GameObjects.Arc;
  private crystalBar!: Phaser.GameObjects.Graphics;
  /** Game-time clock in seconds; runs twice as fast at 2x speed. */
  private clock = 0;
  private stageTime = 0;
  private waveTimer = 0;
  private bossTimer = 0;
  private transitioning = false;
  private chestTimer = 20;
  private incomeWindow = new Decimal(0);
  private incomeWindowReal = 0;
  private bg!: Phaser.GameObjects.Graphics;
  private ground!: Phaser.GameObjects.Graphics;
  private stageText!: Phaser.GameObjects.Text;
  private infoText!: Phaser.GameObjects.Text;
  private bossBar!: Phaser.GameObjects.Graphics;
  private bannerText!: Phaser.GameObjects.Text;
  /** Real seconds left in a hit-stop freeze, which sells the weight of big hits. */
  private hitStop = 0;
  /** The boss timer only runs once a hero reaches the boss. */
  private bossEngaged = false;
  private hills!: Phaser.GameObjects.Graphics;
  private progressBar!: Phaser.GameObjects.Graphics;

  constructor() {
    super('battle');
  }

  init(data: { state: GameState }) {
    this.state = data.state;
  }

  create() {
    this.makeTextures();
    this.bg = this.add.graphics().setScrollFactor(0);
    this.hills = this.add.graphics().setScrollFactor(0.4);
    this.ground = this.add.graphics();
    this.progressBar = this.add.graphics().setScrollFactor(0).setDepth(1000);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, HEIGHT);
    this.add.image(PLAYER_CRYSTAL_X, LANE_TOP + 30, 'crystal-player').setDepth(LANE_TOP);
    this.crystalView = this.add.image(ENEMY_CRYSTAL_X, LANE_TOP + 30, 'crystal-enemy').setDepth(LANE_TOP);
    this.crystalShield = this.add.circle(ENEMY_CRYSTAL_X, LANE_TOP + 26, 30, 0xff3355, 0.18).setStrokeStyle(2, 0xff6680, 0.8).setDepth(LANE_TOP + 1);
    this.crystalBar = this.add.graphics().setDepth(1000);

    this.stageText = this.add.text(10, 8, '', { fontFamily: 'monospace', fontSize: '18px', color: '#ffffff', stroke: '#000', strokeThickness: 4 }).setDepth(1000).setScrollFactor(0);
    this.infoText = this.add.text(10, 32, '', { fontFamily: 'monospace', fontSize: '12px', color: '#ffe9a8', stroke: '#000', strokeThickness: 3 }).setDepth(1000).setScrollFactor(0);
    this.bossBar = this.add.graphics().setDepth(1000).setScrollFactor(0);
    this.bannerText = this.add
      .text(WIDTH / 2, 110, '', { fontFamily: 'monospace', fontSize: '28px', color: '#ffffff', stroke: '#000', strokeThickness: 6 })
      .setOrigin(0.5)
      .setDepth(1001)
      .setScrollFactor(0)
      .setAlpha(0);

    this.syncHeroes();
    this.startStage();
  }

  // ---------- placeholder art ----------

  private makeTextures() {
    const g = this.make.graphics({}, false);
    const box = (key: string, w: number, h: number, draw: () => void) => {
      if (this.textures.exists(key)) return;
      g.clear();
      draw();
      g.generateTexture(key, w, h);
    };

    for (const h of HEROES) {
      box(`hero-${h.id}`, 24, 30, () => {
        g.fillStyle(0x000000, 1).fillRoundedRect(0, 0, 24, 30, 5);
        g.fillStyle(ELEMENT_COLORS[h.element], 1).fillRoundedRect(2, 2, 20, 26, 4);
        g.fillStyle(0xffffff, 1).fillRect(13, 9, 4, 5).fillRect(18, 9, 3, 5);
        g.fillStyle(0x000000, 1).fillRect(15, 10, 2, 3).fillRect(19, 10, 2, 3);
      });
    }
    box('enemy', 22, 22, () => {
      g.fillStyle(0x000000, 1).fillCircle(11, 12, 10);
      g.fillStyle(0xffffff, 1).fillCircle(11, 12, 8);
      g.fillStyle(0xffffff, 1).fillRect(3, 7, 4, 4);
      g.fillStyle(0x000000, 1).fillRect(4, 8, 2, 2).fillRect(9, 8, 2, 2);
    });
    box('boss', 64, 64, () => {
      g.fillStyle(0x000000, 1).fillRoundedRect(0, 4, 64, 60, 12);
      g.fillStyle(0xffffff, 1).fillRoundedRect(3, 7, 58, 54, 10);
      g.fillStyle(0x000000, 1).fillTriangle(8, 8, 16, 0, 22, 10).fillTriangle(42, 10, 48, 0, 56, 8);
      g.fillStyle(0xffffff, 1).fillRect(8, 20, 12, 10).fillRect(26, 20, 12, 10);
      g.fillStyle(0x000000, 1).fillRect(9, 23, 5, 5).fillRect(27, 23, 5, 5).fillRect(8, 42, 30, 5);
    });
    box('crystal-player', 30, 50, () => {
      g.fillStyle(0x0b2a4a, 1).fillTriangle(15, 0, 30, 25, 0, 25).fillTriangle(0, 25, 30, 25, 15, 50);
      g.fillStyle(0x6fd3ff, 1).fillTriangle(15, 4, 26, 25, 4, 25).fillTriangle(4, 25, 26, 25, 15, 46);
    });
    box('crystal-enemy', 30, 50, () => {
      g.fillStyle(0x3a0b2a, 1).fillTriangle(15, 0, 30, 25, 0, 25).fillTriangle(0, 25, 30, 25, 15, 50);
      g.fillStyle(0xd04a8a, 1).fillTriangle(15, 4, 26, 25, 4, 25).fillTriangle(4, 25, 26, 25, 15, 46);
    });
    const chest = (key: string, color: number) =>
      box(key, 22, 16, () => {
        g.fillStyle(0x000000, 1).fillRect(0, 0, 22, 16);
        g.fillStyle(color, 1).fillRect(1, 1, 20, 14);
        g.fillStyle(0x000000, 1).fillRect(1, 6, 20, 2);
        g.fillStyle(0xfff3b0, 1).fillRect(9, 5, 4, 5);
      });
    chest('chest-wood', 0x9a6a3a);
    chest('chest-bronze', 0xcd7f32);
    chest('chest-gold', 0xffcc33);
    g.destroy();
  }

  private drawBackground() {
    // Each 50-stage block is a new region: shift the palette so progress is visible.
    const palettes = [
      [0x7ec8e3, 0x5fa35f, 0x4f7f3f],
      [0xf2c48d, 0xc28e4c, 0x8a5f2a],
      [0x5b5f97, 0x4a4a6a, 0x34344a],
      [0xff9e7a, 0x9c4a3a, 0x6a2a2a],
      [0x2a2a4a, 0x3a5a5a, 0x2a3a3a],
    ];
    const [sky, hill, ground] = palettes[Math.floor((this.state.stage - 1) / 50) % palettes.length];
    this.bg.clear();
    this.bg.fillStyle(sky, 1).fillRect(0, 0, WIDTH, HEIGHT);
    // Hills scroll slower than the lane for a little depth.
    const hillsWidth = WIDTH + (WORLD_WIDTH - WIDTH) * 0.4;
    this.hills.clear();
    this.hills.fillStyle(hill, 1);
    for (let x = 40, i = 0; x < hillsWidth + 100; x += 130, i++) this.hills.fillCircle(x, LANE_TOP + 10, 70 + (i % 2) * 25);
    const g = this.ground;
    g.clear();
    g.fillStyle(ground, 1).fillRect(0, LANE_TOP - 5, WORLD_WIDTH, HEIGHT - LANE_TOP + 5);
    g.fillStyle(0x000000, 0.12).fillRect(0, LANE_BOTTOM + 12, WORLD_WIDTH, HEIGHT - LANE_BOTTOM);
    // Grass tufts, rocks and distance posts so the walk reads as travel.
    const rng = new Phaser.Math.RandomDataGenerator([String(this.state.stage)]);
    for (let x = 20; x < WORLD_WIDTH; x += rng.between(30, 60)) {
      const y = rng.between(LANE_TOP, HEIGHT - 8);
      if (rng.frac() < 0.75) g.fillStyle(0x000000, 0.15).fillRect(x, y, 2, 4).fillRect(x + 3, y - 2, 2, 6).fillRect(x + 6, y, 2, 4);
      else g.fillStyle(0x000000, 0.22).fillEllipse(x, y, rng.between(8, 16), rng.between(5, 8));
    }
    for (let i = 1; i < 4; i++) {
      const x = (WORLD_WIDTH / 4) * i;
      g.fillStyle(0x5a3a1a, 1).fillRect(x - 2, LANE_TOP - 26, 4, 24);
      g.fillStyle(0xd8b47a, 1).fillRect(x - 12, LANE_TOP - 32, 24, 10);
      g.fillStyle(0x5a3a1a, 1).fillRect(x - 8, LANE_TOP - 28, 16, 2);
    }
  }

  // ---------- units ----------

  private makeUnit(opts: {
    side: 'hero' | 'enemy';
    def?: HeroDef;
    texture: string;
    x: number;
    hp: Decimal;
    atk: Decimal;
    range: number;
    cooldown: number;
    speed: number;
    element: Element;
    isBoss?: boolean;
    goldMult?: number;
    label?: string;
  }): Unit {
    const y = opts.isBoss ? LANE_TOP + 35 : Phaser.Math.Between(LANE_TOP + 5, LANE_BOTTOM);
    const body = this.add.image(0, 0, opts.texture);
    if (opts.side === 'enemy') body.setTint(ELEMENT_COLORS[opts.element]).setFlipX(true);
    const barWidth = opts.isBoss ? 60 : 24;
    const hpBar = this.add.graphics();
    const parts: Phaser.GameObjects.GameObject[] = [body, hpBar];
    if (opts.label) {
      parts.push(
        this.add
          .text(0, -body.height / 2 - 18, opts.label, { fontFamily: 'monospace', fontSize: opts.isBoss ? '11px' : '9px', color: '#fff', stroke: '#000', strokeThickness: 3 })
          .setOrigin(0.5),
      );
    }
    const view = this.add.container(opts.x, y, parts).setDepth(y);
    const unit: Unit = {
      side: opts.side,
      def: opts.def,
      x: opts.x,
      y,
      hp: opts.hp,
      maxHp: opts.hp,
      atk: opts.atk,
      range: opts.range,
      cooldown: opts.cooldown,
      cooldownLeft: Math.random() * opts.cooldown,
      speed: opts.speed,
      element: opts.element,
      goldMult: opts.goldMult ?? 1,
      isBoss: !!opts.isBoss,
      waiting: false,
      attacks: 0,
      alive: true,
      respawnAt: 0,
      ultReadyAt: 0,
      view,
      body,
      hpBar,
      barWidth,
    };
    this.drawHpBar(unit);
    return unit;
  }

  private drawHpBar(u: Unit) {
    const ratio = u.maxHp.gt(0) ? Math.max(0, Math.min(1, u.hp.div(u.maxHp).toNumber())) : 0;
    const w = u.barWidth;
    const top = -u.body.height / 2 - 7;
    u.hpBar.clear();
    u.hpBar.fillStyle(0x000000, 0.7).fillRect(-w / 2 - 1, top - 1, w + 2, 5);
    u.hpBar.fillStyle(u.side === 'hero' ? 0x4cff7a : 0xff4c4c, 1).fillRect(-w / 2, top, w * ratio, 3);
  }

  /** Create units for newly recruited heroes and refresh stats after upgrades. */
  syncHeroes() {
    // Heroes taken out of the lineup leave the lane.
    for (const h of this.heroes) if (h.def && !this.state.inLineup(h.def.id)) h.view.destroy();
    this.heroes = this.heroes.filter((h) => h.def && this.state.inLineup(h.def.id));
    for (const def of HEROES) {
      if (!this.state.inLineup(def.id)) continue;
      const level = this.state.heroLevel(def.id);
      if (level <= 0) continue;
      let u = this.heroes.find((h) => h.def?.id === def.id);
      const { atk, hp } = this.state.heroPower(def, level);
      if (!u) {
        u = this.makeUnit({
          side: 'hero',
          def,
          texture: `hero-${def.id}`,
          x: PLAYER_CRYSTAL_X + 20,
          hp,
          atk,
          range: def.range,
          cooldown: def.attackCooldown,
          speed: def.moveSpeed,
          element: def.element,
          goldMult: def.goldMult,
        });
        this.heroes.push(u);
        this.puff(u.x, u.y, ELEMENT_COLORS[def.element]);
      } else {
        const ratio = u.maxHp.gt(0) ? u.hp.div(u.maxHp) : new Decimal(1);
        u.maxHp = hp;
        u.atk = atk;
        if (u.alive) u.hp = hp.times(ratio);
        this.drawHpBar(u);
      }
    }
  }

  /** Whether a star skill is active: the hero is recruited and has at least `star` stars. */
  private has(heroId: string, star: number) {
    return this.state.hasStar(heroId, star);
  }

  private isHero(u: Unit, id: string) {
    return u.def?.id === id;
  }

  private spawnEnemy(boss = false, campX?: number) {
    const stage = this.state.stage;
    const element = boss ? bossElement(stage) : enemyElement(stage);
    const u = this.makeUnit({
      side: 'enemy',
      texture: boss ? 'boss' : 'enemy',
      x: campX !== undefined ? campX + Phaser.Math.Between(-20, 20) : ENEMY_CRYSTAL_X - (boss ? 50 : Phaser.Math.Between(15, 40)),
      hp: boss ? bossHp(stage) : enemyHp(stage),
      atk: boss ? bossAtk(stage) : enemyAtk(stage),
      range: boss ? 40 : 22,
      cooldown: boss ? 1.6 : 1.1,
      speed: boss ? 18 : Phaser.Math.Between(28, 40),
      element,
      isBoss: boss,
      label: boss ? BOSS_NAMES[(stage / 50 - 1) % BOSS_NAMES.length] : undefined,
    });
    u.waiting = campX !== undefined;
    this.enemies.push(u);
  }

  // ---------- stage flow ----------

  startStage() {
    for (const e of this.enemies) e.view.destroy();
    this.enemies = [];
    for (const h of this.heroes) this.reviveHero(h);
    const stage = this.state.stage;
    this.crystal.maxHp = crystalHp(stage);
    this.crystal.hp = this.crystal.maxHp;
    this.crystalView.setAlpha(1).setScale(1);
    this.stageTime = 0;
    this.waveTimer = 0;
    this.transitioning = false;
    this.bossEngaged = false;
    this.cameras.main.scrollX = 0;
    this.drawBackground();
    const boss = isBossStage(stage);
    this.bossTimer = boss ? BOSS_TIME_LIMIT : 0;
    if (boss) {
      this.spawnEnemy(true);
      const rotating = stage >= BOSS_ROTATION_START && stage % 100 === 0;
      this.banner(rotating ? `BOSS: WEAK TO ${bossWeakness(stage).toUpperCase()}` : 'BOSS STAGE', '#ff6680');
      this.cameras.main.shake(400, 0.01);
      play('boss');
    }
    for (const f of CAMPS) {
      // Camps start as single enemies and grow to three, so a lone starter hero can win early stages.
      const count = Math.min(3, 1 + Math.floor((stage - 1) / 8) + (Math.random() < 0.3 ? 1 : 0));
      for (let i = 0; i < count; i++) this.spawnEnemy(false, PLAYER_CRYSTAL_X + (ENEMY_CRYSTAL_X - PLAYER_CRYSTAL_X) * f);
    }
    this.spawnWave();
    this.state.emit();
  }

  private spawnWave() {
    const size = Math.min(3, 1 + Math.floor((this.state.stage - 1) / 15));
    const count = Math.min(size, MAX_ENEMIES - this.enemies.length);
    for (let i = 0; i < count; i++) this.spawnEnemy(false);
  }

  private reviveHero(h: Unit) {
    h.alive = true;
    h.hp = h.maxHp;
    h.x = PLAYER_CRYSTAL_X + 20 + Math.random() * 10;
    h.view.setPosition(h.x, h.y).setAlpha(1).setVisible(true);
    this.drawHpBar(h);
  }

  private bossAlive() {
    return this.enemies.some((e) => e.isBoss && e.alive);
  }

  private winStage() {
    if (this.transitioning) return;
    this.transitioning = true;
    const stage = this.state.stage;
    const reward = stageClearGold(stage);
    this.gainGold(reward, ENEMY_CRYSTAL_X, LANE_TOP);
    this.state.recordStageTime(this.stageTime);
    if (isBossStage(stage)) {
      this.state.autoAdvance = true;
      this.state.gems += BOSS_GEMS;
      this.time.delayedCall(1000, () => this.floatText(this.cameras.main.scrollX + WIDTH / 2, 150, `+${BOSS_GEMS} Gems`, '#7fe3ff', 18));
    }
    const prevBest = this.state.bestStage;
    if (this.state.autoAdvance) this.state.reachStage(this.state.stage + 1);
    if (prevBest < SPEED_UNLOCK_STAGE && this.state.bestStage >= SPEED_UNLOCK_STAGE) {
      this.time.delayedCall(1100, () => {
        this.banner('2x SPEED UNLOCKED!', '#7dff9a');
        play('unlock');
      });
    }
    this.tweens.add({ targets: this.crystalView, scale: 1.6, alpha: 0, duration: 400 });
    this.shatter(ENEMY_CRYSTAL_X, LANE_TOP + 26, 0xd04a8a);
    this.cameras.main.shake(250, 0.012);
    this.freeze(0.12);
    play('clear');
    this.banner(isBossStage(stage) ? 'BOSS DOWN!' : 'STAGE CLEAR', '#ffe066');
    this.state.save();
    this.time.delayedCall(900, () => this.startStage());
  }

  private loseStage(reason: string) {
    if (this.transitioning) return;
    this.transitioning = true;
    const stage = this.state.stage;
    if (isBossStage(stage)) {
      // Drop back and farm until the player is ready to challenge again.
      this.state.stage = Math.max(1, stage - 1);
      this.state.autoAdvance = false;
    }
    this.banner(reason, '#ff6b6b');
    play('defeat');
    this.state.save();
    this.time.delayedCall(1300, () => this.startStage());
  }

  /** Player tapped "Fight boss": resume advancing and jump to the boss now. */
  challengeBoss() {
    this.state.autoAdvance = true;
    if (!isBossStage(this.state.stage)) this.state.stage += 1;
    this.startStage();
  }

  /** Called after offline progress or a reset changes the stage. */
  restart() {
    for (const h of this.heroes) h.view.destroy();
    this.heroes = [];
    this.syncHeroes();
    this.startStage();
  }

  speedMultiplier() {
    return this.state.speed2x && this.state.bestStage >= SPEED_UNLOCK_STAGE ? 2 : 1;
  }

  private freeze(seconds: number) {
    this.hitStop = Math.max(this.hitStop, seconds);
  }

  // ---------- combat ----------

  update(_time: number, deltaMs: number) {
    const realDt = Math.min(deltaMs / 1000, 0.1);
    this.trackIncome(realDt);
    if (this.hitStop > 0) {
      this.hitStop -= realDt;
      return;
    }
    const dt = realDt * (this.speedMultiplier());
    this.clock += dt;
    this.updateChests(dt);
    this.drawHud();
    if (this.transitioning) return;

    this.stageTime += dt;
    if (!this.bossEngaged && this.bossAlive()) {
      const boss = this.enemies.find((e) => e.isBoss && e.alive)!;
      this.bossEngaged = this.heroes.some((h) => h.alive && boss.x - h.x < 220);
    }
    if (this.bossTimer > 0 && this.bossEngaged) {
      this.bossTimer -= dt;
      if (this.bossTimer <= 0 && this.bossAlive()) {
        this.loseStage('TIME UP');
        return;
      }
    }

    this.waveTimer += dt;
    if (this.waveTimer >= WAVE_INTERVAL) {
      this.waveTimer = 0;
      this.spawnWave();
    }

    for (const h of this.heroes) {
      if (!h.alive) {
        if (this.clock >= h.respawnAt) this.reviveHero(h);
        continue;
      }
      this.stepHero(h, dt);
    }
    for (const e of this.enemies) if (e.alive) this.stepEnemy(e, dt);

    // Remove dead enemies after their fade finishes.
    this.enemies = this.enemies.filter((e) => e.alive || e.view.active);
    this.followHeroes(realDt);

    if (this.heroes.length > 0 && this.heroes.every((h) => !h.alive)) {
      this.loseStage('DEFEATED');
      return;
    }
    this.regenerate(dt);
    if (this.state.autoUlt) for (const h of this.heroes) this.tryAutoUlt(h);
    const shielded = this.bossAlive();
    this.crystalShield.setVisible(shielded);
  }

  private stepHero(h: Unit, dt: number) {
    h.cooldownLeft -= dt;
    const def = h.def!;

    if (def.heals) {
      const hurt = this.heroes
        .filter((a) => a.alive && a.hp.lt(a.maxHp.times(0.75)) && Math.abs(a.x - h.x) <= h.range)
        .sort((a, b) => a.hp.div(a.maxHp).toNumber() - b.hp.div(b.maxHp).toNumber())[0];
      if (hurt && h.cooldownLeft <= 0) {
        h.cooldownLeft = h.cooldown;
        this.heal(hurt, h.atk.times(this.has('solenne', 1) ? 4.5 : 3));
        this.shot(h, hurt.x, hurt.y, 0xfff6a0);
        return;
      }
    }

    const target = this.nearest(h, this.enemies, 1);
    const dist = target ? target.x - h.x : Infinity;
    if (target && dist <= h.range) {
      if (h.cooldownLeft <= 0) {
        h.cooldownLeft = h.cooldown;
        this.heroAttack(h, target);
      }
      return;
    }
    const crystalDist = ENEMY_CRYSTAL_X - 14 - h.x;
    const canHitCrystal = !this.bossAlive();
    if (crystalDist <= h.range && (!target || dist > crystalDist)) {
      if (canHitCrystal && h.cooldownLeft <= 0) {
        h.cooldownLeft = h.cooldown;
        if (def.range > 60) this.shot(h, ENEMY_CRYSTAL_X, LANE_TOP + 26, ELEMENT_COLORS[def.element]);
        this.damageCrystal(h.atk);
      }
      if (!target) return;
    }
    const stopAt = ENEMY_CRYSTAL_X - 14 - Math.min(h.range, 30);
    h.x = Math.min(h.x + h.speed * dt, stopAt);
    h.view.x = h.x;
  }

  private stepEnemy(e: Unit, dt: number) {
    e.cooldownLeft -= dt;
    if (e.waiting) {
      if (!this.heroes.some((h) => h.alive && Math.abs(e.x - h.x) < CAMP_AGGRO)) return;
      e.waiting = false;
    }
    const target = this.nearest(e, this.heroes, -1);
    const dist = target ? e.x - target.x : Infinity;
    if (target && dist <= e.range) {
      if (e.cooldownLeft <= 0) {
        e.cooldownLeft = e.cooldown;
        this.lunge(e, -1);
        this.enemyHits(e, target);
      }
      return;
    }
    // Bosses guard the crystal; regular enemies march at the heroes.
    if (e.isBoss && e.x < ENEMY_CRYSTAL_X - 120) return;
    e.x = Math.max(e.x - e.speed * dt, PLAYER_CRYSTAL_X + 30);
    e.view.x = e.x;
  }

  /** Nearest living opponent in front of `u` (dir 1 = right, -1 = left), with a little slack behind. */
  private nearest(u: Unit, pool: Unit[], dir: 1 | -1): Unit | undefined {
    let best: Unit | undefined;
    let bestD = Infinity;
    for (const o of pool) {
      if (!o.alive) continue;
      const d = (o.x - u.x) * dir;
      if (d < -12) continue;
      if (d < bestD) {
        bestD = d;
        best = o;
      }
    }
    return best;
  }

  private enemyHits(e: Unit, target: Unit) {
    if (this.isHero(target, 'nox') && this.has('nox', 1) && Math.random() < 0.25) {
      this.floatText(target.x, target.y - 26, 'MISS', '#c9b8ff', 11);
      return;
    }
    let mult = elementMultiplier(e.element, target.element);
    if (this.isHero(target, 'marin') && this.has('marin', 2)) mult *= 0.75;
    if (this.has('bramble', 4)) mult *= 0.9;
    const dmg = e.atk.times(mult);
    this.damageUnit(target, dmg, null);
    if (this.isHero(target, 'bramble') && this.has('bramble', 1)) this.damageUnit(e, dmg.times(0.3), target);
  }

  private heroAttack(h: Unit, target: Unit) {
    const def = h.def!;
    if (def.range > 60) this.shot(h, target.x, target.y, ELEMENT_COLORS[def.element]);
    else this.lunge(h, 1);
    h.attacks++;
    const critChance = CRIT_CHANCE + (this.isHero(h, 'nox') && this.has('nox', 2) ? 0.2 : 0);
    const strikes = this.isHero(h, 'marin') && this.has('marin', 1) && Math.random() < 0.2 ? 2 : 1;
    for (let i = 0; i < strikes; i++) {
      const crit = Math.random() < critChance;
      let atk = crit ? h.atk.times(CRIT_MULTIPLIER) : h.atk;
      if (this.isHero(h, 'pyra') && this.has('pyra', 2) && h.attacks % 4 === 0) atk = atk.times(3);
      const splash = def.splash ? def.splash * (this.isHero(h, 'pyra') && this.has('pyra', 1) ? 1.5 : 1) : 0;
      const targets = splash ? this.enemies.filter((e) => e.alive && Math.abs(e.x - target.x) <= splash) : [target];
      for (const t of targets) this.damageUnit(t, atk.times(elementMultiplier(h.element, t.element)), h, crit);
    }
  }

  /** Bramble's Taproot and Solenne's Lanternlight. */
  private regenerate(dt: number) {
    const team = this.has('solenne', 4) ? 0.01 : 0;
    for (const h of this.heroes) {
      if (!h.alive) continue;
      const rate = team + (this.isHero(h, 'bramble') && this.has('bramble', 2) ? 0.03 : 0);
      if (rate <= 0 || h.hp.gte(h.maxHp)) continue;
      h.hp = Decimal.min(h.maxHp, h.hp.plus(h.maxHp.times(rate * dt)));
      this.drawHpBar(h);
    }
  }

  private damageUnit(target: Unit, amount: Decimal, source: Unit | null, crit = false) {
    if (!target.alive) return;
    target.hp = target.hp.minus(amount);
    this.drawHpBar(target);
    this.hitFeedback(target, amount, source, crit);
    target.body.setTintFill(0xffffff);
    this.time.delayedCall(60, () => {
      if (!target.body.active) return;
      if (target.side === 'enemy') target.body.setTint(ELEMENT_COLORS[target.element]);
      else target.body.clearTint();
    });
    if (target.hp.lte(0)) this.kill(target, source);
  }

  /** Squash, sparks, knockback, damage numbers, shake and sound for one hit. */
  private hitFeedback(target: Unit, amount: Decimal, source: Unit | null, crit: boolean) {
    this.tweens.add({ targets: target.body, scaleX: 1.25, scaleY: 0.8, duration: 50, yoyo: true, onComplete: () => target.body.setScale(1) });
    if (target.side === 'hero') {
      play('hurt');
      return;
    }
    const color = source ? ELEMENT_COLORS[source.element] : 0xffffff;
    this.sparks(target.x - 6, target.y - 4, color, crit ? 9 : 4);
    if (crit) {
      this.floatText(target.x, target.y - 34, `${fmt(amount)}!`, '#ffe14a', 18);
      this.cameras.main.shake(90, 0.006);
      this.freeze(0.05);
      play('crit');
    } else {
      this.floatText(target.x + Phaser.Math.Between(-6, 6), target.y - 26, fmt(amount), '#ffffff', 11);
      play('hit');
    }
    if (target.isBoss) this.cameras.main.shake(60, 0.003);
    // Melee hits shove regular enemies back a step.
    if (!target.isBoss && source?.def && source.def.range <= 60) {
      target.x = Math.min(target.x + (crit ? 16 : 6), ENEMY_CRYSTAL_X - 12);
      this.tweens.add({ targets: target.view, x: target.x, duration: 90, ease: 'Quad.out' });
    }
  }

  private heal(target: Unit, amount: Decimal) {
    play('heal');
    this.sparks(target.x, target.y, 0x7dff9a, 5);
    target.hp = Decimal.min(target.maxHp, target.hp.plus(amount));
    this.drawHpBar(target);
    this.floatText(target.x, target.y - 26, `+${fmt(amount)}`, '#7dff9a');
  }

  private kill(u: Unit, source: Unit | null) {
    u.alive = false;
    if (u.side === 'enemy') {
      const gold = goldPerKill(this.state.stage)
        .times(u.isBoss ? 10 : 1)
        .times(source?.goldMult ?? 1)
        .times(this.has('nox', 4) ? 1.25 : 1);
      this.gainGold(gold, u.x, u.y);
      this.tweens.add({ targets: u.view, alpha: 0, scale: 1.5, y: u.y - 8, duration: 220, onComplete: () => u.view.destroy() });
      this.shatter(u.x, u.y, ELEMENT_COLORS[u.element]);
      this.flyCoins(u.x, u.y, u.isBoss ? 12 : 2);
      play('kill');
      if (u.isBoss) {
        this.cameras.main.shake(500, 0.02);
        this.cameras.main.flash(150, 255, 255, 255);
        this.freeze(0.25);
      }
    } else {
      u.respawnAt = this.clock + RESPAWN_SECONDS * (this.has('solenne', 2) ? 0.5 : 1);
      this.puff(u.x, u.y, 0xffffff);
      u.view.setVisible(false);
    }
  }

  private damageCrystal(amount: Decimal) {
    this.crystal.hp = this.crystal.hp.minus(amount);
    this.sparks(ENEMY_CRYSTAL_X - 8, LANE_TOP + 26, 0xff8fc0, 3);
    play('hit');
    this.crystalView.setTintFill(0xffffff);
    this.time.delayedCall(60, () => this.crystalView.clearTint());
    if (this.crystal.hp.lte(0)) {
      this.crystal.hp = new Decimal(0);
      this.winStage();
    }
  }

  private gainGold(amount: Decimal, x: number, y: number) {
    this.state.addGold(amount);
    this.incomeWindow = this.incomeWindow.plus(amount);
    this.floatText(x, y - 14, `+${fmt(amount)}`, '#ffd84a');
  }

  private trackIncome(realDt: number) {
    this.incomeWindowReal += realDt;
    if (this.incomeWindowReal >= 2) {
      this.state.recordIncome(this.incomeWindow, this.incomeWindowReal);
      this.incomeWindow = new Decimal(0);
      this.incomeWindowReal = 0;
    }
  }

  // ---------- ultimates ----------

  getUltState(heroId: string): UltState {
    const h = this.heroes.find((u) => u.def?.id === heroId);
    const level = this.state.heroLevel(heroId);
    return {
      unlocked: level >= ULT_UNLOCK_LEVEL,
      alive: !!h?.alive,
      remaining: h ? Math.max(0, h.ultReadyAt - this.clock) : 0,
    };
  }

  triggerUlt(heroId: string): boolean {
    const h = this.heroes.find((u) => u.def?.id === heroId);
    if (!h || !h.alive || this.transitioning) return false;
    const s = this.getUltState(heroId);
    if (!s.unlocked || s.remaining > 0) return false;
    h.ultReadyAt = this.clock + ULT_COOLDOWN;
    const color = ELEMENT_COLORS[h.element];
    play('ult');
    this.freeze(0.08);
    if (h.def!.heals) {
      for (const a of this.heroes) if (a.alive) this.heal(a, a.maxHp);
      this.cameras.main.flash(200, 255, 245, 180);
      return true;
    }
    const radius = 170;
    const ring = this.add.circle(h.x + 60, h.y, 10, color, 0.45).setDepth(999);
    this.tweens.add({ targets: ring, radius, alpha: 0, duration: 380, onComplete: () => ring.destroy() });
    this.cameras.main.shake(300, 0.015);
    this.cameras.main.flash(120, 255, 255, 255);
    const dmg = h.atk.times(ULT_MULTIPLIER * (this.has(h.def!.id, 3) ? ULT_STAR_BONUS : 1));
    for (const e of this.enemies) {
      if (e.alive && e.x >= h.x - 30 && e.x <= h.x + radius + 60) this.damageUnit(e, dmg.times(elementMultiplier(h.element, e.element)), h);
    }
    if (!this.bossAlive() && ENEMY_CRYSTAL_X - h.x <= radius + 60) this.damageCrystal(dmg);
    return true;
  }

  private tryAutoUlt(h: Unit) {
    if (!h.alive || !h.def) return;
    const s = this.getUltState(h.def.id);
    if (!s.unlocked || s.remaining > 0) return;
    if (h.def.heals) {
      if (this.heroes.some((a) => a.alive && a.hp.lt(a.maxHp.times(0.4)))) this.triggerUlt(h.def.id);
      return;
    }
    const inReach = this.enemies.filter((e) => e.alive && e.x >= h.x - 30 && e.x <= h.x + 200);
    if (inReach.some((e) => e.isBoss) || inReach.length >= 3) this.triggerUlt(h.def.id);
  }

  // ---------- chests ----------

  private updateChests(dt: number) {
    this.chestTimer -= dt;
    if (this.chestTimer > 0) return;
    this.chestTimer = Phaser.Math.Between(25, 45);
    const total = CHESTS.reduce((s, c) => s + c.weight, 0);
    let roll = Math.random() * total;
    const kind = CHESTS.find((c) => (roll -= c.weight) < 0) ?? CHESTS[0];
    const y = Phaser.Math.Between(70, 130);
    const chest = this.add.image(WIDTH + 20, y, kind.key).setScale(1.6).setDepth(900).setScrollFactor(0).setInteractive({ useHandCursor: true });
    const drift = this.tweens.add({ targets: chest, x: -30, duration: 14000, onComplete: () => chest.destroy() });
    this.tweens.add({ targets: chest, y: y - 8, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    chest.once('pointerdown', () => {
      drift.stop();
      const gold = goldPerKill(this.state.stage).times(kind.killsWorth);
      const wx = chest.x + this.cameras.main.scrollX;
      this.gainGold(gold, wx, chest.y + 10);
      this.shatter(wx, chest.y, 0xffe066);
      this.flyCoins(wx, chest.y, kind.killsWorth >= 15 ? 10 : 5);
      play('chest');
      if (kind.key === 'chest-gold') {
        this.state.gems += 5;
        this.floatText(wx, chest.y - 12, '+5 Gems', '#7fe3ff', 14);
      }
      chest.destroy();
      this.state.emit();
    });
  }

  // ---------- effects and HUD ----------

  private lunge(u: Unit, dir: 1 | -1) {
    this.tweens.add({ targets: u.body, x: 5 * dir, duration: 70, yoyo: true });
  }

  private shot(from: Unit, x: number, y: number, color: number) {
    const dot = this.add.circle(from.x, from.y - 4, 4, color).setDepth(950).setStrokeStyle(1, 0x000000);
    this.tweens.add({ targets: dot, x, y, duration: 160, onComplete: () => dot.destroy() });
  }

  private puff(x: number, y: number, color: number) {
    for (let i = 0; i < 6; i++) {
      const p = this.add.rectangle(x, y, 4, 4, color).setDepth(950);
      this.tweens.add({
        targets: p,
        x: x + Phaser.Math.Between(-18, 18),
        y: y + Phaser.Math.Between(-20, 6),
        alpha: 0,
        duration: 350,
        onComplete: () => p.destroy(),
      });
    }
  }

  private floatText(x: number, y: number, text: string, color: string, size = 11) {
    const t = this.add
      .text(x, y, text, { fontFamily: 'monospace', fontSize: `${size}px`, fontStyle: 'bold', color, stroke: '#000', strokeThickness: size > 12 ? 4 : 3 })
      .setOrigin(0.5)
      .setDepth(990);
    if (size > 12) {
      t.setScale(0.4);
      this.tweens.add({ targets: t, scale: 1, duration: 140, ease: 'Back.out' });
    }
    this.tweens.add({ targets: t, y: y - 26, alpha: 0, delay: 250, duration: 650, onComplete: () => t.destroy() });
  }

  private sparks(x: number, y: number, color: number, count: number) {
    for (let i = 0; i < count; i++) {
      const p = this.add.rectangle(x, y, 3, 3, color).setDepth(960);
      const angle = Math.random() * Math.PI * 2;
      const dist = Phaser.Math.Between(8, 22);
      this.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: 0,
        duration: 200,
        onComplete: () => p.destroy(),
      });
    }
  }

  /** Chunky burst for deaths and crystal breaks. */
  private shatter(x: number, y: number, color: number) {
    for (let i = 0; i < 12; i++) {
      const p = this.add.rectangle(x, y, 5, 5, i % 3 === 0 ? 0xffffff : color).setDepth(960);
      this.tweens.add({
        targets: p,
        x: x + Phaser.Math.Between(-30, 30),
        y: y + Phaser.Math.Between(-34, 10),
        angle: Phaser.Math.Between(-180, 180),
        alpha: 0,
        duration: Phaser.Math.Between(300, 500),
        ease: 'Quad.out',
        onComplete: () => p.destroy(),
      });
    }
  }

  /** Coins pop up and fly to the top-left, toward the gold counter. */
  private flyCoins(x: number, y: number, count: number) {
    for (let i = 0; i < count; i++) {
      const c = this.add.circle(x, y, 3, 0xffd84a).setStrokeStyle(1, 0x8a6a00).setDepth(995);
      this.tweens.chain({
        targets: c,
        tweens: [
          { x: x + Phaser.Math.Between(-16, 16), y: y - Phaser.Math.Between(10, 26), duration: 180, ease: 'Quad.out' },
          { x: this.cameras.main.scrollX + 12, y: -6, duration: 420, delay: i * 25, ease: 'Quad.in', onComplete: () => { c.destroy(); play('coin'); } },
        ],
      });
    }
  }

  private banner(text: string, color: string) {
    this.bannerText.setText(text).setColor(color).setAlpha(1).setScale(0.6);
    this.tweens.add({ targets: this.bannerText, scale: 1, duration: 200, ease: 'Back.out' });
    this.tweens.add({ targets: this.bannerText, alpha: 0, delay: 800, duration: 300 });
  }

  /** Keep the front-most hero about 55% across the screen. */
  private followHeroes(realDt: number) {
    const cam = this.cameras.main;
    const alive = this.heroes.filter((h) => h.alive);
    const front = alive.length ? Math.max(...alive.map((h) => h.x)) : PLAYER_CRYSTAL_X;
    const target = Phaser.Math.Clamp(front - WIDTH * 0.55, 0, WORLD_WIDTH - WIDTH);
    cam.scrollX += (target - cam.scrollX) * Math.min(1, realDt * 4);
  }

  private drawHud() {
    const stage = this.state.stage;
    const boss = isBossStage(stage);
    this.stageText.setText(`Stage ${stage}${boss ? '  BOSS' : ''}`);
    const farming = !this.state.autoAdvance ? '  (farming)' : '';
    this.infoText.setText(boss ? `Boss is weak to ${bossWeakness(stage)}${farming}` : `Enemies: ${enemyElement(stage)}${farming}`);

    const ratio = this.crystal.maxHp.gt(0) ? Math.max(0, this.crystal.hp.div(this.crystal.maxHp).toNumber()) : 0;
    this.crystalBar.clear();
    this.crystalBar.fillStyle(0x000000, 0.7).fillRect(ENEMY_CRYSTAL_X - 22, LANE_TOP - 12, 44, 6);
    this.crystalBar.fillStyle(0xd04a8a, 1).fillRect(ENEMY_CRYSTAL_X - 21, LANE_TOP - 11, 42 * ratio, 4);

    // Lane progress: heroes as colored dots between the two crystals.
    const px = WIDTH - 150;
    const pw = 140;
    const toBar = (x: number) => px + (pw * (x - PLAYER_CRYSTAL_X)) / (ENEMY_CRYSTAL_X - PLAYER_CRYSTAL_X);
    const pb = this.progressBar;
    pb.clear();
    pb.fillStyle(0x000000, 0.55).fillRoundedRect(px - 6, 8, pw + 12, 14, 7);
    pb.fillStyle(0xffffff, 0.35).fillRect(px, 14, pw, 2);
    pb.fillStyle(0x6fd3ff, 1).fillRect(px - 2, 11, 4, 8);
    pb.fillStyle(0xd04a8a, 1).fillRect(px + pw - 2, 11, 4, 8);
    for (const e of this.enemies) if (e.alive) pb.fillStyle(0xff4c4c, 1).fillRect(toBar(e.x) - 1, 13, 2, 4);
    for (const h of this.heroes) if (h.alive) pb.fillStyle(ELEMENT_COLORS[h.element], 1).fillCircle(toBar(h.x), 15, 3);

    this.bossBar.clear();
    if (boss && this.bossTimer > 0) {
      const w = 150;
      const x = 10;
      this.bossBar.fillStyle(0x000000, 0.7).fillRect(x - 2, 52, w + 4, 10);
      this.bossBar.fillStyle(this.bossTimer < 10 ? 0xff4c4c : 0xffb84c, 1).fillRect(x, 54, w * (this.bossTimer / BOSS_TIME_LIMIT), 6);
    }
  }
}
