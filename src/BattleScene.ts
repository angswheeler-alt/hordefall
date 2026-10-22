import Phaser from 'phaser';
import Decimal from 'break_infinity.js';
import {
  HEROES,
  ELEMENT_COLORS,
  bossLabel,
  BOSS_TIME_LIMIT,
  ULT_COOLDOWN,
  ULT_MULTIPLIER,
  ULT_STAR_BONUS,
  ULT_PLUS_EVOLUTIONS,
  SIG_PLUS_EVOLUTIONS,
  MASTERY_EVOLUTIONS,
  ASCENDED_EVOLUTIONS,
  ASCENDED_ULT_COOLDOWN,
  type HeroType,
  ULT_UNLOCK_LEVEL,
  SPEED_UNLOCK_STAGE,
  elementMultiplier,
  enemyElement,
  bossElement,
  bossWeakness,
  bossImmuneTo,
  isElementBossStage,
  bossHasElement,
  stageBoss,
  TRIAL_LEVELS,
  TRIAL_TIME,
  TRIAL_BOSS_NAMES,
  TRIAL_BOSS_ART,
  TRIAL_BOSS_COOLDOWN,
  TRIAL_SLAM_EVERY,
  TRIAL_SLAM_SHARE,
  TRIAL_HIT_SPREAD,
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
  defended,
  trialHp,
  trialDps,
} from './formulas';
import type { GameState } from './state';
import { play } from './sfx';
import coinSmallUrl from './assets/ui/coin-small.png';
import crystalPlayerUrl from './assets/ui/crystal-player.png';
import crystalEnemyUrl from './assets/ui/crystal-enemy.png';
import chestWoodUrl from './assets/ui/chest-wood.png';
import chestBronzeUrl from './assets/ui/chest-bronze.png';
import chestGoldUrl from './assets/ui/chest-gold.png';
import { sumEffect, mulEffect, everyNth, procEffect, procs } from './skills';
import { marchCap, marchStep } from './movement';
import { respawnTime, reviveIn, stageStartRevives } from './respawn';
import { chestsAllowed, laneMode } from './chests';
import { PVP_RESPAWN_MULT } from './colosseum';
import { HERO_ANIMS } from './heroAnims';
import { ASCENDANT_HEROES, ascendantDef } from './heroes/ascendant';
import { formArtKey, chargeOf, chargeStep, chargeDamageMult, CHARGE_AREA, CHARGE_LINE, CHARGE_HASTE_SECONDS, type Charge } from './ascendant';
import { MOB_ANIMS } from './mobAnims';
import { MOB_ELEMENTS, MOB_KINDS, pickMob, type MobId } from './mobs';
import { BOSS_ANIMS, BOSS_ANIM_FRAMES, type BossAnim } from './bossAnims';
import type { EffectKind } from './data';
import { comboMult, executeMult, signatureReflect, splitHeal, controlEnd, SIG_PLUS, maskTriggers, barrageHits, zealState, torrentMults, spiritTargets } from './kits';
import { STAT_BASE, FREEZE_BLAST_RADIUS, BOSS_STUN_CHANCE, BOSS_STUN_SECONDS, type HeroStats } from './stats';
import { heroProfile } from './profiles';
import { canReach, pickVictim } from './reach';

/** Visible area. The lane itself is WORLD_WIDTH long and the camera follows the heroes. */
export const WIDTH = 480;
const WORLD_WIDTH = 1440;
export const HEIGHT = 300;
const PLAYER_CRYSTAL_X = 36;
const ENEMY_CRYSTAL_X = WORLD_WIDTH - 36;
/** Enemy camps along the lane, as fractions of its length. They wait until a hero gets close. */
/** Stage-start groups (one per old camp) march in one behind another from past the right edge. */
const START_GROUPS = 3;
const GROUP_GAP = 400;
/** Enemies spawn just past the world's right edge (the camera never shows it) and walk in. */
const ENEMY_SPAWN_X = WORLD_WIDTH + 12;
const LANE_TOP = 175;
const LANE_BOTTOM = 255;
/** Flyers move in the sky band above the ground line (GROUND_Y), clear of the walkers' heads, with a shadow on the lane. */
const SKY_TOP = 112;
const SKY_BOTTOM = 136;
/** Flyers draw over everything on the lane (lane depths are their y, up to LANE_BOTTOM) but under effects and text. */
const SKY_DEPTH = 400;
/** From this stage, this share of regular enemies are flyers. */
const FLYER_STAGE = 3;
const FLYER_CHANCE = 0.25;
/** Background art per 50-stage region, in order; files are public/bg/<region>_{sky,far,ground}.png. */
const REGIONS = ['tidecoast', 'dunes', 'stormcrag', 'emberwastes', 'hollowmoon'];
/** The far layer is 180 px tall with its bottom edge on the ground line (y 170). */
const FAR_Y = -10;
const GROUND_Y = 170;
/** Centre of the floating stage crystals (48x72 sprites floating over a shadow). */
const CRYSTAL_Y = LANE_TOP + 10;
const WAVE_INTERVAL = 7;
/** Burning deals its damage in ticks this many seconds apart. */
const BURN_TICK = 0.5;
/** Slam attacks (Piston Slam, Spring Slam) hit hit enemies this close to the target. */
const SLAM_RADIUS = 50;
/** Rolling Snowball rolls through enemies this far behind the target, who take more damage for SNOWBALL_SECONDS. */
const SNOWBALL_REACH = 120;
const SNOWBALL_SECONDS = 4;
/** Shadow Pounce reaches enemies this far ahead. */
const ASSASSIN_REACH = 220;
/** Yolky Eggs blind for this long. */
const BLIND_SECONDS = 3;
const WILDFIRE_RADIUS = 40;
const BEACON_SECONDS = 4;
/** Lumen brings fallen heroes back this far behind her, with this share of their HP. */
const REVIVE_BEHIND = 14;
const REVIVE_HP = 0.5;
const MAX_ENEMIES = 14;
/** Melee feet sit this far below a unit's y (the old 30 px placeholders were centred on it). */
const FOOT_Y = 15;
/** Where an animated boss's head ends up (container y), drawn at BOSS_SCALE from its feet. */
const bossHeadY = (b: BossAnim) => FOOT_Y - (b.feet[1] - b.headTop) * BOSS_SCALE;

// Frame-animated heroes come from src/heroAnims.ts, generated by art/heroes/animate.js.
const RUN_FPS = 12;
const ATTACK_FPS = 16;
type AnimState = 'idle' | 'run' | 'attack';
// Regular enemies come from src/mobAnims.ts, generated by art/mobs/animate.js.
const MOB_WALK_FPS = 10;
const MOB_ATTACK_FPS = 14;
/** How high a walking mob bobs on each step, px, so its stride reads even when the legs are small. */
const MOB_BOB = 1.5;
type BossAnimName = keyof typeof BOSS_ANIM_FRAMES;
const BOSS_FPS: Record<BossAnimName, number> = { idle: 6, attack: 10, hurt: 10, death: 8 };
/** An animated boss flinches (its hurt animation) at most this often, so steady damage doesn't freeze it in place. */
const BOSS_FLINCH_SECONDS = 4;
/** Boss art is drawn this many times its pixel size (whole-ish steps keep the pixels sharp), so bosses tower
 *  about three heroes tall. Looks only: combat stays x-based. */
export const BOSS_SCALE = 1.5;

interface Unit {
  side: 'hero' | 'enemy';
  def?: HeroDef;
  x: number;
  y: number;
  hp: Decimal;
  maxHp: Decimal;
  /** Moves in the sky band (winged mobs and flying heroes). */
  flying?: boolean;
  atk: Decimal;
  /** Defense (heroes only; enemies have none). */
  defense: Decimal;
  range: number;
  cooldown: number;
  cooldownLeft: number;
  /** Move Speed in px/s, separate from attack speed. */
  speed: number;
  /** Heroes: fighting this frame (stopped with an enemy or the crystal in range) rather than marching. */
  engaged?: boolean;
  element: Element;
  goldMult: number;
  isBoss: boolean;
  /** Attacks made, for every-Nth-attack skills. */
  attacks: number;
  alive: boolean;
  respawnAt: number;
  /** Fallen heroes: the countdown over their ghost at the crystal. */
  reviveText?: Phaser.GameObjects.Text;
  ultReadyAt: number;
  /** Rogue Mastery: the next attack crits after a dodge. */
  riposte?: boolean;
  view: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Sprite;
  /** Flyers: their shadow on the lane below them (follows the view each frame). */
  shadow?: Phaser.GameObjects.Ellipse;
  /** Set for frame-animated heroes: which animation is showing. */
  anim?: { id: string; state: AnimState };
  /** A frame-animated regular enemy (MOB_ANIMS key). */
  mob?: { id: MobId; key: string; state: 'idle' | 'walk' | 'attack' };
  /** Set for frame-animated element bosses: whose art (BOSS_ANIMS key) and when it may flinch next. */
  bossArt?: { id: string; flinchAt: number };
  /** Fights without an element (bosses before stage 600): no element bonus either way on its hits or on hits it takes. */
  noElement?: boolean;
  /** Bosses from stage 600: the stage whose element lock applies (only their weakness can hurt them). */
  lockStage?: number;
  /** When IMMUNE last floated over this unit, so it doesn't flood the screen. */
  immuneShownAt?: number;
  hpBar: Phaser.GameObjects.Graphics;
  barWidth: number;
  /** Riptide Combo: the enemy this hero is hitting and how many hits in a row. */
  streakTarget?: Unit;
  streak: number;
  /** Ascendant heroes: attacks in a row toward the next charged Signature (src/ascendant.ts). */
  chargeStacks: number;
  /** Hollow-style mask (Signature 'mask'): already worn this life. */
  maskUsed?: boolean;
  /** Zeal (Signature 'zeal'): attacks in a row. */
  zeal: number;
  /** Sanctuary: takes no damage until this time. */
  guardUntil: number;
  /** Burning (Kindling, Meteor ground): damage per second until burnUntil, from burnBy. */
  burnUntil: number;
  burnDps: Decimal;
  burnTick: number;
  burnBy?: Unit;
  /** Bramble Wall: no moving or attacking until this time. */
  rootedUntil: number;
  /** Bosses: crowd control has no effect until this time (BOSS_CC in kits.ts). */
  ccImmuneUntil: number;
  /** Nightfall Volley: takes markMult damage until markUntil. */
  markUntil: number;
  markMult: number;
  /** Guiding Light and Bramble Wall+: soaks damage before HP. */
  shield: Decimal;
  /** Beacon: ATK x beaconMult until beaconUntil. */
  beaconUntil: number;
  beaconMult: number;
  /** Rogue Wave+ and Frenzy: attack cooldown x hasteMult until hasteUntil. */
  hasteUntil: number;
  hasteMult: number;
  /** Heroes: their stat sheet, refreshed with syncHeroes. */
  stats?: HeroStats;
  /** Frozen enemies stand still until frozenUntil, then the ice bursts for frozenBlast. */
  frozenUntil: number;
  frozenBlast: Decimal;
  frozenBy?: Unit;
  /** Slowed (Sticky Spores): moves and attacks at slowMult speed until slowUntil. */
  slowUntil: number;
  slowMult: number;
  /** Puppet Bind: fights the other enemies until charmUntil. */
  charmUntil: number;
  /** Yolky Eggs: misses blindMiss of its attacks until blindUntil. */
  blindUntil: number;
  blindMiss: number;
  /** Snowdrift: deals weakMult damage until weakUntil. */
  weakUntil: number;
  weakMult: number;
  /** Poison: poisonDps per stack until poisonUntil. */
  poisonUntil: number;
  poisonStacks: number;
  poisonDps: Decimal;
  poisonTick: number;
  poisonBy?: Unit;
}

/** Meteor's burning ground. */
interface Zone {
  x0: number;
  x1: number;
  until: number;
  dps: Decimal;
  by: Unit;
  view: Phaser.GameObjects.Rectangle;
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

/** Each Trial's arena: the background set for its element. */
const TRIAL_ARENAS: Record<Element, string> = { water: 'tidecoast', fire: 'emberwastes', earth: 'dunes', light: 'stormcrag', dark: 'hollowmoon' };
/** The Trial boss waits at the far end of the lane where the red crystal would be, so the heroes run across to it. */
const TRIAL_BOSS_X = ENEMY_CRYSTAL_X - 50;
const TRIAL_BOSS_RANGE = 260;

/** A live Elemental Trial: heroes at their Trial levels against one element boss, no respawns. */
interface TrialFight {
  element: Element;
  tier: number;
  /** Seconds left once the heroes reach the boss. */
  timeLeft: number;
  /** Seconds of fighting so far (the clear time). */
  fought: number;
  hits: number;
  done: boolean;
  onEnd: (won: boolean, seconds: number) => void;
  /** Damage dealt, taken and healed by each hero (by hero id), for the battle meter. */
  meter: Map<string, PvpMeterRow>;
  /** The same totals for the boss. */
  foeMeter: PvpMeterRow;
}

/** One opponent hero in a Colosseum battle, with its stats worked out by GameState. */
export interface PvpFoe {
  def: HeroDef;
  stats: HeroStats;
}

/** A live Colosseum battle: both teams start at their own crystal; the first crystal destroyed loses. */
interface PvpLive {
  ids: Set<string>;
  bonus: number;
  mine: { hp: Decimal; max: Decimal };
  theirs: { hp: Decimal; max: Decimal };
  timeLeft: number;
  done: boolean;
  onEnd: (won: boolean) => void;
  /** Damage dealt, taken and healed by each of the player's fighters (by hero id), for the battle meter. */
  meter: Map<string, PvpMeterRow>;
  /** The same totals for the whole opposing team. */
  foeMeter: PvpMeterRow;
}

/** One line of the Colosseum battle meter. */
export interface PvpMeterRow {
  id: string;
  dealt: Decimal;
  taken: Decimal;
  healed: Decimal;
}

const meterRow = (id: string): PvpMeterRow => ({ id, dealt: new Decimal(0), taken: new Decimal(0), healed: new Decimal(0) });

/** Each crystal holds this many times its team's total HP. */
const PVP_CRYSTAL_HP = 1.5;
/** Seconds a Colosseum battle may run; then the crystal with more HP left (as a share) wins, ties to the defender. */
const PVP_LIVE_TIME = 90;

export interface UltState {
  unlocked: boolean;
  alive: boolean;
  remaining: number;
  /** Seconds until a fallen hero gets back up (0 while standing). */
  reviveIn: number;
  /** Full cooldown in seconds (shorter for Ascended 8★ heroes). */
  total: number;
  /** Whether the hero holds one of the player's Ultimate slots; without one the Ultimate never fires. */
  slotted: boolean;
}

export class BattleScene extends Phaser.Scene {
  private state!: GameState;
  private heroes: Unit[] = [];
  private enemies: Unit[] = [];
  private zones: Zone[] = [];
  /** Rootcall: until then, every non-Fire hero deals Earth damage. */
  private earthenUntil = 0;
  private crystal = { hp: new Decimal(1), maxHp: new Decimal(1) };
  private crystalView!: Phaser.GameObjects.Image;
  private crystalShield!: Phaser.GameObjects.Arc;
  private crystalBar!: Phaser.GameObjects.Graphics;
  /** Game-time clock in seconds; runs twice as fast at 2x speed. */
  private clock = 0;
  private stageTime = 0;
  /** Real seconds spent on this stage, for offline pace (stageTime is game time, doubled at 2x). */
  private stageRealTime = 0;
  /** The queued move to the next stage after a win or loss; cancelled if the stage restarts sooner. */
  private nextStageTimer?: Phaser.Time.TimerEvent;
  private waveTimer = 0;
  private bossTimer = 0;
  private transitioning = false;
  /** The stage just ended in a loss, so the next one starts with the whole team up. */
  private lostStage = false;
  private chestTimer = 20;
  /** Floating chests on screen, so a Trial or Colosseum fight can clear them away. */
  private chests: Phaser.GameObjects.Image[] = [];
  private incomeWindow = new Decimal(0);
  private incomeWindowReal = 0;
  private sky!: Phaser.GameObjects.Image;
  private far!: Phaser.GameObjects.TileSprite;
  private groundTiles!: Phaser.GameObjects.TileSprite;
  private ground!: Phaser.GameObjects.Graphics;
  private stageText!: Phaser.GameObjects.Text;
  private bossBar!: Phaser.GameObjects.Graphics;
  private bannerText!: Phaser.GameObjects.Text;
  /** Real seconds left in a hit-stop freeze, which sells the weight of big hits. */
  private hitStop = 0;
  /** The boss timer only runs once a hero reaches the boss. */
  private bossEngaged = false;
  private progressBar!: Phaser.GameObjects.Graphics;
  /** The red crystal with its shadow, shield and HP bar, hidden during a Trial (the boss stands there instead). */
  private crystalParts: Phaser.GameObjects.GameObject[] = [];
  private trial: TrialFight | null = null;
  private pvp: PvpLive | null = null;
  private playerCrystalView!: Phaser.GameObjects.Image;

  constructor() {
    super('battle');
  }

  init(data: { state: GameState }) {
    this.state = data.state;
  }

  preload() {
    this.load.image('coin', coinSmallUrl);
    this.load.image('crystal-player', crystalPlayerUrl);
    this.load.image('crystal-enemy', crystalEnemyUrl);
    this.load.image('chest-wood', chestWoodUrl);
    this.load.image('chest-bronze', chestBronzeUrl);
    this.load.image('chest-gold', chestGoldUrl);
    for (const r of [...REGIONS, 'colosseum']) for (const layer of ['sky', 'far', 'ground']) this.load.image(`bg-${r}-${layer}`, `bg/${r}_${layer}.png`);
    // Hero sprites (32x32, feet on row 30). A hero without a file falls back to its placeholder block.
    for (const h of HEROES) if (HERO_ANIMS[h.id]) this.load.image(`hero-${h.id}`, `heroes/${h.id}.png`);
    // Ascendant heroes' later forms (src/ascendant.ts) need no standing file: create() cuts it from the attack strip.
    for (const [id, a] of Object.entries(HERO_ANIMS)) {
      const size = { frameWidth: a.frame[0], frameHeight: a.frame[1] };
      this.load.spritesheet(`hero-${id}-run`, `heroes/${id}_run.png`, size);
      this.load.spritesheet(`hero-${id}-attack`, `heroes/${id}_attack.png`, size);
    }
    // Each mob comes repainted in every element's colours (art/mobs/animate.js).
    for (const [id, a] of Object.entries(MOB_ANIMS)) {
      const size = { frameWidth: a.frame[0], frameHeight: a.frame[1] };
      for (const el of MOB_ELEMENTS) {
        this.load.image(`mob-${id}-${el}`, `mobs/${id}_${el}.png`);
        this.load.spritesheet(`mob-${id}-${el}-walk`, `mobs/${id}_${el}_walk.png`, size);
        this.load.spritesheet(`mob-${id}-${el}-attack`, `mobs/${id}_${el}_attack.png`, size);
      }
    }
    for (const [id, a] of Object.entries(BOSS_ANIMS)) {
      for (const anim of Object.keys(BOSS_ANIM_FRAMES)) this.load.spritesheet(`boss-${id}-${anim}`, `bosses/${id}_${anim}.png`, { frameWidth: a.frame[0], frameHeight: a.frame[1] });
    }
  }

  create() {
    this.makeTextures();
    // A later form's standing pose is the first attack frame, as animate.js draws it (fewer files to ship).
    for (const a of ASCENDANT_HEROES) for (const f of a.forms) {
      const anim = f.art && HERO_ANIMS[f.art];
      if (!anim || this.textures.exists(`hero-${f.art}`) || !this.textures.exists(`hero-${f.art}-attack`)) continue;
      const [w, h] = anim.frame;
      const tex = this.textures.createCanvas(`hero-${f.art}`, w, h)!;
      tex.context.drawImage(this.textures.get(`hero-${f.art}-attack`).getSourceImage() as CanvasImageSource, 0, 0, w, h, 0, 0, w, h);
      tex.refresh();
    }
    for (const [id, a] of Object.entries(HERO_ANIMS)) {
      if (!this.anims.exists(`${id}-run`)) {
        this.anims.create({ key: `${id}-run`, frames: this.anims.generateFrameNumbers(`hero-${id}-run`, { start: 0, end: a.run - 1 }), frameRate: RUN_FPS, repeat: -1 });
        this.anims.create({ key: `${id}-attack`, frames: this.anims.generateFrameNumbers(`hero-${id}-attack`, { start: 0, end: a.attack - 1 }), frameRate: ATTACK_FPS, repeat: 0 });
      }
    }
    for (const [id, a] of Object.entries(MOB_ANIMS)) {
      for (const el of MOB_ELEMENTS) {
        const key = `mob-${id}-${el}`;
        if (this.anims.exists(`${key}-walk`)) continue;
        this.anims.create({ key: `${key}-walk`, frames: this.anims.generateFrameNumbers(`${key}-walk`, { start: 0, end: a.walk - 1 }), frameRate: MOB_WALK_FPS, repeat: -1 });
        this.anims.create({ key: `${key}-attack`, frames: this.anims.generateFrameNumbers(`${key}-attack`, { start: 0, end: a.attack - 1 }), frameRate: MOB_ATTACK_FPS, repeat: 0 });
      }
    }
    for (const id of Object.keys(BOSS_ANIMS)) {
      for (const [anim, n] of Object.entries(BOSS_ANIM_FRAMES) as Array<[BossAnimName, number]>) {
        const key = `boss-${id}-${anim}`;
        if (!this.anims.exists(key)) this.anims.create({ key, frames: this.anims.generateFrameNumbers(key, { start: 0, end: n - 1 }), frameRate: BOSS_FPS[anim], repeat: anim === 'idle' ? -1 : 0 });
      }
    }
    // Sky is fixed to the screen; the far layer scrolls at 40% for depth; the ground repeats along the lane.
    this.sky = this.add.image(0, 0, `bg-${REGIONS[0]}-sky`).setOrigin(0).setScrollFactor(0);
    const farWidth = WIDTH + (WORLD_WIDTH - WIDTH) * 0.4;
    this.far = this.add.tileSprite(0, FAR_Y, farWidth, 180, `bg-${REGIONS[0]}-far`).setOrigin(0).setScrollFactor(0.4);
    this.groundTiles = this.add.tileSprite(0, GROUND_Y, WORLD_WIDTH, HEIGHT - GROUND_Y, `bg-${REGIONS[0]}-ground`).setOrigin(0);
    this.ground = this.add.graphics();
    this.progressBar = this.add.graphics().setScrollFactor(0).setDepth(1000);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, HEIGHT);
    // Each crystal floats above the ground, bobbing gently; its shadow shrinks and fades as it rises.
    const crystalAt = (x: number, key: string) => {
      const shadow = this.add.ellipse(x, CRYSTAL_Y + 50, 40, 9, 0x000000, 0.35).setDepth(LANE_TOP - 1);
      this.tweens.add({ targets: shadow, alpha: 0.2, scaleX: 0.75, scaleY: 0.75, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      const view = this.add.image(x, CRYSTAL_Y, key).setDepth(LANE_TOP);
      this.tweens.add({ targets: view, y: CRYSTAL_Y - 4, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      return [shadow, view] as const;
    };
    this.playerCrystalView = crystalAt(PLAYER_CRYSTAL_X, 'crystal-player')[1];
    const enemyCrystal = crystalAt(ENEMY_CRYSTAL_X, 'crystal-enemy');
    this.crystalView = enemyCrystal[1];
    this.crystalParts.push(...enemyCrystal);
    this.crystalShield = this.add.circle(ENEMY_CRYSTAL_X, CRYSTAL_Y, 44, 0xff3355, 0.18).setStrokeStyle(2, 0xff6680, 0.8).setDepth(LANE_TOP + 1);
    this.crystalBar = this.add.graphics().setDepth(1000);
    this.crystalParts.push(this.crystalShield, this.crystalBar);

    this.stageText = this.add.text(10, 8, '', { fontFamily: 'monospace', fontSize: '18px', color: '#ffffff', stroke: '#000', strokeThickness: 4 }).setDepth(1000).setScrollFactor(0);
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
    // A winged mob for flyers (tinted by element like the walking one).
    box('enemy-flyer', 30, 22, () => {
      g.fillStyle(0x000000, 1).fillTriangle(0, 4, 11, 10, 9, 18).fillTriangle(30, 4, 19, 10, 21, 18);
      g.fillStyle(0xffffff, 1).fillTriangle(2, 6, 11, 11, 9, 16).fillTriangle(28, 6, 19, 11, 21, 16);
      g.fillStyle(0x000000, 1).fillCircle(15, 12, 8);
      g.fillStyle(0xffffff, 1).fillCircle(15, 12, 6);
      g.fillStyle(0x000000, 1).fillRect(10, 9, 2, 2).fillRect(14, 9, 2, 2);
    });
    box('boss', 64, 64, () => {
      g.fillStyle(0x000000, 1).fillRoundedRect(0, 4, 64, 60, 12);
      g.fillStyle(0xffffff, 1).fillRoundedRect(3, 7, 58, 54, 10);
      g.fillStyle(0x000000, 1).fillTriangle(8, 8, 16, 0, 22, 10).fillTriangle(42, 10, 48, 0, 56, 8);
      g.fillStyle(0xffffff, 1).fillRect(8, 20, 12, 10).fillRect(26, 20, 12, 10);
      g.fillStyle(0x000000, 1).fillRect(9, 23, 5, 5).fillRect(27, 23, 5, 5).fillRect(8, 42, 30, 5);
    });
    g.destroy();
  }

  private drawBackground() {
    // Each 50-stage block is a new region, cycling through the five background sets.
    // Nyxara guards the Hollow Moon Ruins, so her fights always happen there.
    const stage = this.state.stage;
    const region = this.pvp
      ? 'colosseum'
      : this.trial
      ? TRIAL_ARENAS[this.trial.element]
      : isBossStage(stage) && stageBoss(stage).art === 'dark' ? 'hollowmoon' : REGIONS[Math.floor((stage - 1) / 50) % REGIONS.length];
    this.sky.setTexture(`bg-${region}-sky`);
    this.far.setTexture(`bg-${region}-far`);
    this.groundTiles.setTexture(`bg-${region}-ground`);
    // Distance posts so the walk reads as travel.
    const g = this.ground;
    g.clear();
    for (let i = 1; i < 4 && !this.trial && !this.pvp; i++) {
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
    /** HERO_ANIMS key to draw a hero with (an Ascendant hero's form art); defaults to the hero's id. */
    art?: string;
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
    /** An element boss with its own animations (BOSS_ANIMS key). */
    bossArt?: string;
    /** Moves in the sky above the lane instead of walking on it. */
    flying?: boolean;
    /** A regular enemy with its own animations (MOB_ANIMS key). */
    mob?: MobId;
  }): Unit {
    const laneY = opts.isBoss ? LANE_TOP + 35 : Phaser.Math.Between(LANE_TOP + 5, LANE_BOTTOM);
    const y = opts.flying ? Phaser.Math.Between(SKY_TOP, SKY_BOTTOM) : laneY;
    const body = this.add.sprite(0, 0, opts.texture);
    // Enemies face left and wear their element's tint; an animated boss keeps its own colours.
    if (opts.side === 'enemy') body.setFlipX(true);
    // Mob art is already painted in its element's colours, so only placeholders take a tint.
    const mobKey = opts.mob ? `mob-${opts.mob}-${opts.element}` : '';
    const mobDef = opts.mob && this.anims.exists(`${mobKey}-walk`) ? MOB_ANIMS[opts.mob] : undefined;
    if (opts.side === 'enemy' && !opts.bossArt && !mobDef) body.setTint(ELEMENT_COLORS[opts.element]);
    const bossDef = opts.bossArt ? BOSS_ANIMS[opts.bossArt] : undefined;
    if (bossDef) body.setOrigin(1 - bossDef.feet[0] / bossDef.frame[0], bossDef.feet[1] / bossDef.frame[1]).setY(FOOT_Y).setScale(BOSS_SCALE).play(`boss-${opts.bossArt}-idle`);
    // Frame-animated heroes stand on their feet point, on the same foot line as everyone else.
    const artId = opts.art ?? opts.def?.id;
    const animDef = artId ? HERO_ANIMS[artId] : undefined;
    const anim = animDef && this.anims.exists(`${artId}-run`) ? { id: artId!, state: 'idle' as AnimState } : undefined;
    // A Colosseum foe is a hero facing left, so its feet point mirrors.
    if (anim && animDef) body.setOrigin(opts.side === 'enemy' ? 1 - animDef.feet[0] / animDef.frame[0] : animDef.feet[0] / animDef.frame[0], animDef.feet[1] / animDef.frame[1]).setY(FOOT_Y);
    // Mob art faces right like the heroes and is flipped above, so its feet point mirrors too.
    if (mobDef) body.setOrigin(1 - mobDef.feet[0] / mobDef.frame[0], mobDef.feet[1] / mobDef.frame[1]).setY(FOOT_Y).play(`${mobKey}-walk`);
    const barWidth = opts.isBoss ? 80 : 24;
    const hpBar = this.add.graphics();
    const parts: Phaser.GameObjects.GameObject[] = [body, hpBar];
    const view = this.add.container(opts.x, y, parts).setDepth(opts.flying ? SKY_DEPTH + y : y);
    // A towering boss's head reaches the top of the screen, so its name sits under the boss timer instead.
    if (opts.label) {
      const name = this.add
        .text(10, 66, opts.label, { fontFamily: 'monospace', fontSize: '11px', color: '#fff', stroke: '#000', strokeThickness: 3 })
        .setDepth(1000)
        .setScrollFactor(0);
      view.once(Phaser.GameObjects.Events.DESTROY, () => name.destroy());
    }
    let shadow: Phaser.GameObjects.Ellipse | undefined;
    if (opts.flying) {
      shadow = this.add.ellipse(opts.x, laneY + FOOT_Y, 20, 5, 0x000000, 0.3).setDepth(laneY - 1);
      view.once(Phaser.GameObjects.Events.DESTROY, () => shadow!.destroy());
      // A gentle hover; combat only uses x, so this is looks only.
      this.tweens.add({ targets: body, y: body.y - 3, duration: 600 + Math.random() * 200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }
    const unit: Unit = {
      side: opts.side,
      def: opts.def,
      x: opts.x,
      y,
      hp: opts.hp,
      maxHp: opts.hp,
      flying: opts.flying,
      defense: new Decimal(0),
      atk: opts.atk,
      range: opts.range,
      cooldown: opts.cooldown,
      cooldownLeft: Math.random() * opts.cooldown,
      speed: opts.speed,
      element: opts.element,
      goldMult: opts.goldMult ?? 1,
      isBoss: !!opts.isBoss,
      attacks: 0,
      alive: true,
      respawnAt: 0,
      ultReadyAt: 0,
      view,
      body,
      shadow,
      anim,
      mob: mobDef ? { id: opts.mob!, key: mobKey, state: 'walk' } : undefined,
      bossArt: opts.bossArt ? { id: opts.bossArt, flinchAt: 0 } : undefined,
      hpBar,
      barWidth,
      streak: 0,
      chargeStacks: 0,
      zeal: 0,
      guardUntil: 0,
      burnUntil: 0,
      burnDps: new Decimal(0),
      burnTick: 0,
      rootedUntil: 0,
      ccImmuneUntil: 0,
      markUntil: 0,
      markMult: 1,
      shield: new Decimal(0),
      beaconUntil: 0,
      beaconMult: 1,
      hasteUntil: 0,
      hasteMult: 1,
      frozenUntil: 0,
      frozenBlast: new Decimal(0),
      slowUntil: 0,
      slowMult: 1,
      charmUntil: 0,
      blindUntil: 0,
      blindMiss: 0,
      weakUntil: 0,
      weakMult: 1,
      poisonUntil: 0,
      poisonStacks: 0,
      poisonDps: new Decimal(0),
      poisonTick: 0,
    };
    this.drawHpBar(unit);
    return unit;
  }

  /** Switch a frame-animated hero between standing, running and attacking. An attack always restarts. */
  private setAnim(u: Unit, state: AnimState) {
    const a = u.anim;
    if (!a || (a.state === state && state !== 'attack')) return;
    a.state = state;
    if (state === 'run') u.body.play(`${a.id}-run`);
    else if (state === 'idle') u.body.stop().setTexture(`hero-${a.id}`);
    else {
      u.body.play(`${a.id}-attack`);
      u.body.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        if (a.state === 'attack' && u.body.active) this.setAnim(u, 'idle');
      });
      // Melee heroes get a slash streak on the frame that reaches furthest (frames run at ATTACK_FPS, scaled
      // by battle speed); ranged heroes already fire a projectile.
      if (u.def && u.side === 'hero' && u.def.range <= 60) this.time.delayedCall((HERO_ANIMS[a.id].hitFrame / ATTACK_FPS) * 1000 / this.speedMultiplier(), () => this.slashStreak(u));
    }
  }

  /** A short arc in front of the hero where the blade passed, in the hero's element colour. */
  private slashStreak(u: Unit) {
    if (!u.alive) return;
    const cx = u.view.x + 4, cy = u.view.y + FOOT_Y - 28;
    const g = this.add.graphics().setDepth(u.view.depth + 1);
    const draw = (alpha: number) => {
      g.clear();
      g.lineStyle(4, 0xffffff, alpha).beginPath().arc(cx, cy, 21, Phaser.Math.DegToRad(-80), Phaser.Math.DegToRad(30)).strokePath();
      g.lineStyle(2, ELEMENT_COLORS[u.element], alpha).beginPath().arc(cx, cy, 24, Phaser.Math.DegToRad(-70), Phaser.Math.DegToRad(25)).strokePath();
    };
    draw(0.9);
    this.tweens.addCounter({ from: 0.9, to: 0, duration: 160, onUpdate: (t) => draw(t.getValue() ?? 0), onComplete: () => g.destroy() });
  }

  /** Play one of an animated boss's animations; attack and hurt return to idle, death stays on its last frame. */
  private bossAnim(u: Unit, anim: BossAnimName) {
    const art = u.bossArt;
    if (!art || !u.body.active) return;
    u.body.play(`boss-${art.id}-${anim}`);
    if (anim === 'attack' || anim === 'hurt') {
      u.body.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        if (u.alive && u.body.active) u.body.play(`boss-${art.id}-idle`);
      });
    }
  }

  /** Switch an animated mob between standing, walking and attacking. An attack always restarts. */
  private mobAnim(u: Unit, state: 'idle' | 'walk' | 'attack') {
    const m = u.mob;
    if (!m || !u.body.active || (m.state === state && state !== 'attack')) return;
    m.state = state;
    if (state === 'walk') u.body.play(`${m.key}-walk`);
    else if (state === 'idle') u.body.stop().setTexture(m.key);
    else {
      u.body.play(`${m.key}-attack`);
      u.body.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        if (m.state === 'attack' && u.alive && u.body.active) this.mobAnim(u, 'idle');
      });
    }
  }

  /** The tint an enemy rests at: ice blue while frozen, else its element (animated bosses and mobs keep their art). */
  private restTint(e: Unit) {
    if (e.frozenUntil > this.clock) e.body.setTint(0x9fdcff);
    else if (e.bossArt || e.mob) e.body.clearTint();
    else e.body.setTint(ELEMENT_COLORS[e.element]);
  }

  private drawHpBar(u: Unit) {
    const ratio = u.maxHp.gt(0) ? Math.max(0, Math.min(1, u.hp.div(u.maxHp).toNumber())) : 0;
    const w = u.barWidth;
    const top = u.anim
      ? FOOT_Y - HERO_ANIMS[u.anim.id].feet[1] + HERO_ANIMS[u.anim.id].headTop - 5
      : u.bossArt
        ? bossHeadY(BOSS_ANIMS[u.bossArt.id]) - 5
        : u.mob
          ? FOOT_Y - MOB_ANIMS[u.mob.id].feet[1] + MOB_ANIMS[u.mob.id].headTop - 5
          : -u.body.height / 2 - 7;
    u.hpBar.clear();
    u.hpBar.fillStyle(0x000000, 0.7).fillRect(-w / 2 - 1, top - 1, w + 2, 5);
    u.hpBar.fillStyle(u.side === 'hero' ? 0x4cff7a : 0xff4c4c, 1).fillRect(-w / 2, top, w * ratio, 3);
    // Shields show as a pale bar over the top of the HP bar.
    if (u.shield.gt(0) && u.maxHp.gt(0)) u.hpBar.fillStyle(0xbfe8ff, 1).fillRect(-w / 2, top - 2, w * Math.min(1, u.shield.div(u.maxHp).toNumber() * 5), 2);
  }

  /** Create units for newly recruited heroes and refresh stats after upgrades. */
  syncHeroes() {
    // Heroes taken out of the lineup leave the lane.
    for (const h of this.heroes) if (h.def && !this.fights(h.def.id)) h.view.destroy();
    this.heroes = this.heroes.filter((h) => h.def && this.fights(h.def.id));
    for (const base of HEROES) {
      if (!this.fights(base.id)) continue;
      // An Ascendant hero fights in its current form.
      const def = this.state.formDef(base);
      const level = this.levelOf(def.id);
      if (level <= 0) continue;
      const stats = this.state.heroStats(def, level);
      // A squad splits the hero's ATK and HP between its small fighters (the first one owns the Ultimate).
      const size = def.squad ?? 1;
      // A Colosseum win streak hits harder.
      const atk = stats.atk.value.div(size).times(1 + (this.pvp?.bonus ?? 0)), hp = stats.hp.value.div(size), defense = stats.def.value;
      const squad = this.heroes.filter((h) => h.def?.id === def.id);
      for (const u of squad) {
        const ratio = u.maxHp.gt(0) ? u.hp.div(u.maxHp) : new Decimal(1);
        u.maxHp = hp;
        u.atk = atk;
        u.def = def;
        // Ascending can change reach.
        u.range = def.range;
        u.defense = defense;
        u.stats = stats;
        u.speed = stats.moveSpeed.value;
        if (u.alive) u.hp = hp.times(ratio);
        this.drawHpBar(u);
      }
      for (let i = squad.length; i < size; i++) {
        const u = this.makeUnit({
          side: 'hero',
          def,
          art: this.heroArt(def),
          texture: `hero-${this.heroArt(def)}`,
          x: PLAYER_CRYSTAL_X + 20 - i * 12,
          hp,
          atk,
          range: def.range,
          cooldown: def.attackCooldown,
          speed: stats.moveSpeed.value,
          element: def.element,
          goldMult: def.goldMult * (1 + heroProfile(def).goldBonus),
          flying: def.flying,
        });
        if (size > 1) u.view.setScale(0.7);
        u.defense = defense;
        u.stats = stats;
        this.giveKnightShield(u);
        this.heroes.push(u);
        this.puff(u.x, u.y, ELEMENT_COLORS[def.element]);
      }
    }
  }

  /** The art a hero is drawn with: an Ascendant hero's form art when it has landed, else the hero's own. */
  private heroArt(def: HeroDef): string {
    const a = ascendantDef(def.id);
    return a ? formArtKey(a, this.state.formOf(def.id), (key) => !!HERO_ANIMS[key]) : def.id;
  }

  /** Whether a hero is on the field: the lineup, or the attack team in a Colosseum battle. */
  private fights(heroId: string) {
    return this.pvp ? this.pvp.ids.has(heroId) && (this.state.levels[heroId] ?? 0) > 0 : this.state.inLineup(heroId);
  }

  /** A hero's fighting level: gold plus Ember levels, or in a Trial or the Colosseum only Ember levels (at least 1). */
  private levelOf(heroId: string) {
    if (!this.trial && !this.pvp) return this.state.heroLevel(heroId);
    return this.state.permanentLevel(heroId);
  }

  /** Whether a star skill is active: the hero is recruited and has at least `star` stars. */
  private has(heroId: string, star: number) {
    return this.state.hasStar(heroId, star);
  }

  /** Whether a hero has its 7★ Type Mastery and is of this Type. */
  private mastery(h: Unit, type: HeroType) {
    return h.def?.type === type && this.has(h.def.id, MASTERY_EVOLUTIONS);
  }

  /** Whether a hero has its 6★ Signature+. */
  private sigPlus(h: Unit | undefined | null) {
    return !!h?.def?.signature && this.has(h.def.id, SIG_PLUS_EVOLUTIONS);
  }

  /**
   * Stun, freeze or root an enemy for `seconds` (bosses: `bossSeconds`, half by default, and not again until
   * 2 s after it ends; see controlEnd). Returns when the control ends, or 0 if the boss shrugged it off.
   */
  private control(e: Unit, seconds: number, bossSeconds?: number): number {
    const end = controlEnd(e.isBoss, this.clock, e.rootedUntil, e.ccImmuneUntil, seconds, bossSeconds);
    if (!end) {
      this.floatText(e.x, e.y - 30, 'IMMUNE', '#c9b8ff', 9);
      return 0;
    }
    e.rootedUntil = end.until;
    e.ccImmuneUntil = end.immuneUntil;
    return end.until;
  }

  private ultCooldown(heroId: string) {
    return this.has(heroId, ASCENDED_EVOLUTIONS) ? ASCENDED_ULT_COOLDOWN : ULT_COOLDOWN;
  }

  /** Additive total of a star-skill effect reaching this unit (team-wide plus its own). null = team-wide only. */
  private sum(kind: EffectKind, u: Unit | null) {
    return sumEffect(this.state.effects(), kind, u?.def?.id ?? null);
  }

  /** Element bonus on a hit from `from` (an element, or a unit) on `to`; 1 when either side has no element. */
  private elem(from: Element | Unit, to: Unit) {
    if (to.noElement || (typeof from !== 'string' && from.noElement)) return 1;
    return elementMultiplier(typeof from === 'string' ? from : from.element, to.element);
  }

  /** Multiplicative total of a star-skill effect reaching this unit; 1 when none apply. */
  private mul(kind: EffectKind, u: Unit | null) {
    return mulEffect(this.state.effects(), kind, u?.def?.id ?? null);
  }

  /** `behind` pushes a regular enemy further past the right edge so groups arrive one after another. */
  private spawnEnemy(boss = false, behind = 0) {
    const stage = this.state.stage;
    const element = boss ? bossElement(stage) : enemyElement(stage);
    const look = boss ? stageBoss(stage).art : null;
    const bossArt = look && BOSS_ANIMS[look] ? look : undefined;
    const flying = !boss && stage >= FLYER_STAGE && Math.random() < FLYER_CHANCE;
    const kind = boss ? undefined : flying ? MOB_KINDS.flyer : pickMob(stage, Math.random());
    const u = this.makeUnit({
      side: 'enemy',
      texture: bossArt ? `boss-${bossArt}-idle` : kind && this.textures.exists(`mob-${kind.id}-${element}`) ? `mob-${kind.id}-${element}` : boss ? 'boss' : flying ? 'enemy-flyer' : 'enemy',
      bossArt,
      flying,
      mob: kind?.id,
      x: boss ? ENEMY_CRYSTAL_X - 50 : ENEMY_SPAWN_X + behind + Phaser.Math.Between(0, 30),
      hp: boss ? bossHp(stage) : enemyHp(stage).times(kind!.hp),
      atk: boss ? bossAtk(stage) : enemyAtk(stage).times(kind!.atk),
      range: boss ? 40 : kind!.range,
      cooldown: boss ? 1.6 : 1.1,
      // Fast enough that the two sides meet around the middle of the lane (grunts; brutes are slower).
      speed: boss ? 18 : Phaser.Math.Between(kind!.speed[0], kind!.speed[1]),
      element,
      isBoss: boss,
      label: boss ? bossLabel(stage) : undefined,
    });
    if (boss && !bossHasElement(stage)) u.noElement = true;
    if (boss && isElementBossStage(stage)) u.lockStage = stage;
    this.enemies.push(u);
  }

  // ---------- stage flow ----------

  startStage() {
    this.nextStageTimer?.remove();
    this.nextStageTimer = undefined;
    for (const e of this.enemies) e.view.destroy();
    this.enemies = [];
    for (const z of this.zones) z.view.destroy();
    this.zones = [];
    // Fallen heroes sit out their revive timer across a stage clear; a lost stage brings everyone back.
    const lost = this.lostStage;
    this.lostStage = false;
    const up = new Set(stageStartRevives(this.heroes, this.clock, lost));
    for (const h of this.heroes) {
      h.shield = new Decimal(0);
      h.streakTarget = undefined;
      if (up.has(h)) this.reviveHero(h);
    }
    const stage = this.state.stage;
    this.crystal.maxHp = crystalHp(stage);
    this.crystal.hp = this.crystal.maxHp;
    this.crystalView.setAlpha(1).setScale(1);
    this.stageTime = 0;
    this.stageRealTime = 0;
    this.waveTimer = 0;
    this.transitioning = false;
    this.bossEngaged = false;
    this.cameras.main.scrollX = 0;
    this.drawBackground();
    const boss = isBossStage(stage);
    this.bossTimer = boss ? BOSS_TIME_LIMIT : 0;
    if (boss) {
      this.spawnEnemy(true);
      const weak = bossWeakness(stage);
      this.banner(`${stageBoss(stage).name.toUpperCase()}${weak ? (isElementBossStage(stage) ? `\nONLY ${weak.toUpperCase()} CAN HURT IT` : `\nWEAK TO ${weak.toUpperCase()}`) : ''}`, '#ff6680');
      this.cameras.main.shake(400, 0.01);
      play('boss');
    }
    for (let g = 0; g < START_GROUPS; g++) {
      // Groups start as single enemies and grow to three, so a lone starter hero can win early stages.
      const count = Math.min(3, 1 + Math.floor((stage - 1) / 8) + (Math.random() < 0.3 ? 1 : 0));
      for (let i = 0; i < count; i++) this.spawnEnemy(false, g * GROUP_GAP);
    }
    // The opening wave queues up behind the groups instead of piling onto the first one.
    this.spawnWave(START_GROUPS * GROUP_GAP);
    this.state.emit();
  }

  private spawnWave(behind = 0) {
    const size = Math.min(3, 1 + Math.floor((this.state.stage - 1) / 15));
    const count = Math.min(size, MAX_ENEMIES - this.enemies.length);
    for (let i = 0; i < count; i++) this.spawnEnemy(false, behind);
  }

  /** Knights start each stage and each life with a shield (Knight Shield HP raises it). */
  private giveKnightShield(h: Unit) {
    if (!h.stats?.isKnight) return;
    h.shield = Decimal.max(h.shield, h.maxHp.times(STAT_BASE.knightShield * (1 + h.stats.knightShield)));
  }

  /** Flyers' shadows stay on the lane under them and vanish with them. */
  private syncShadows() {
    for (const list of [this.heroes, this.enemies]) {
      for (const u of list) {
        if (!u.shadow?.active) continue;
        u.shadow.x = u.view.x;
        u.shadow.setVisible(u.view.visible).setAlpha(0.3 * u.view.alpha);
      }
    }
  }

  private reviveHero(h: Unit, x = PLAYER_CRYSTAL_X + 20 + Math.random() * 10, hpShare = 1) {
    h.alive = true;
    h.reviveText?.destroy();
    h.reviveText = undefined;
    h.body.setAlpha(1);
    h.hp = h.maxHp.times(hpShare);
    h.rootedUntil = 0;
    this.giveKnightShield(h);
    h.x = x;
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
    this.state.recordStageTime(this.stageRealTime);
    if (isBossStage(stage)) {
      this.state.autoAdvance = true;
    } else {
      this.state.retryBossIfDue();
    }
    this.state.track('stages');
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
    this.nextStageTimer = this.time.delayedCall(900, () => this.startStage());
  }

  private loseStage(reason: string) {
    if (this.transitioning) return;
    this.transitioning = true;
    const stage = this.state.stage;
    if (isBossStage(stage)) {
      // Drop back and farm until the player is ready to challenge again.
      this.state.stage = Math.max(1, stage - 1);
      this.state.autoAdvance = false;
      this.state.startBossRetry();
    }
    this.banner(reason, '#ff6b6b');
    if (isBossStage(stage) && !this.state.autoBoss) this.time.delayedCall(1400, () => this.banner('Tap FIGHT BOSS to retry', '#ffd27a'));
    play('defeat');
    this.state.save();
    this.lostStage = true;
    this.nextStageTimer = this.time.delayedCall(1300, () => this.startStage());
  }

  /** Player tapped "Fight boss": resume advancing and jump to the boss now. */
  challengeBoss() {
    this.state.autoAdvance = true;
    this.state.bossRetryAt = 0;
    if (!isBossStage(this.state.stage)) this.state.stage += 1;
    this.startStage();
  }

  /** Called after offline progress or a reset changes the stage. */
  restart() {
    // A Trial or Colosseum battle in progress keeps going; the run restarts when it ends.
    if (this.trial || this.pvp) return;
    // Rebuilt heroes keep their ultimate cooldowns (clock keeps running across restarts).
    const ults = new Map(this.heroes.map((h) => [h.def?.id, h.ultReadyAt]));
    for (const h of this.heroes) h.view.destroy();
    this.heroes = [];
    this.syncHeroes();
    for (const h of this.heroes) h.ultReadyAt = ults.get(h.def?.id) ?? 0;
    this.startStage();
  }

  // ---------- Elemental Trials ----------

  /** Whether a live Trial fight is on. */
  inTrial() {
    return !!this.trial;
  }

  /** Boss music for a boss fight, a Trial or the Colosseum; field music otherwise. */
  musicMood(): 'field' | 'boss' {
    return this.trial || this.pvp || this.bossAlive() ? 'boss' : 'field';
  }

  /** Whether a live Colosseum battle is on. */
  inPvp() {
    return !!this.pvp;
  }

  /** The battle meter of the current (or just finished) Colosseum battle or Trial: the player's fighters, then the foes' totals. */
  battleMeter(): { mine: PvpMeterRow[]; foes: PvpMeterRow; trial: boolean } | null {
    const p = this.pvp ?? this.trial;
    return p ? { mine: [...p.meter.values()], foes: p.foeMeter, trial: !!this.trial } : null;
  }

  /** Count damage or healing on the Colosseum or Trial meter: `unit` is who did (or took) it. */
  private meter(unit: Unit | null | undefined, kind: 'dealt' | 'taken' | 'healed', amount: Decimal) {
    const p = this.pvp ?? this.trial;
    if (!p || p.done || !unit || amount.lte(0)) return;
    const row = unit.side === 'hero' ? (unit.def ? p.meter.get(unit.def.id) : undefined) : p.foeMeter;
    if (row) row[kind] = row[kind].plus(amount);
  }

  /**
   * Start a Colosseum battle: the run pauses, the attack team (`ids`, Ember levels only) starts at the
   * blue crystal and the opponent's team at the red one. Fallen fighters on both sides get back up after
   * the usual wait; the first crystal destroyed loses. `onEnd` gets the outcome once.
   */
  startPvp(ids: string[], foes: PvpFoe[], bonus: number, onEnd: (won: boolean) => void) {
    if (this.trial || this.pvp) return;
    this.nextStageTimer?.remove();
    this.nextStageTimer = undefined;
    this.clearChests();
    this.pvp = { ids: new Set(ids), bonus, mine: { hp: new Decimal(1), max: new Decimal(1) }, theirs: { hp: new Decimal(1), max: new Decimal(1) }, timeLeft: PVP_LIVE_TIME, done: false, onEnd, meter: new Map(ids.map((id) => [id, meterRow(id)])), foeMeter: meterRow('foes') };
    const ults = new Map(this.heroes.map((h) => [h.def?.id, h.ultReadyAt]));
    for (const h of this.heroes) h.view.destroy();
    this.heroes = [];
    this.syncHeroes();
    for (const h of this.heroes) h.ultReadyAt = ults.get(h.def?.id) ?? 0;
    for (const e of this.enemies) e.view.destroy();
    this.enemies = [];
    for (const z of this.zones) z.view.destroy();
    this.zones = [];
    for (const h of this.heroes) {
      h.shield = new Decimal(0);
      h.streakTarget = undefined;
      this.reviveHero(h);
    }
    for (const [i, f] of foes.entries()) {
      const size = f.def.squad ?? 1;
      for (let k = 0; k < size; k++) {
        const e = this.makeUnit({
          side: 'enemy',
          def: f.def,
          texture: `hero-${f.def.id}`,
          x: ENEMY_CRYSTAL_X - 20 - i * 6 - k * 12,
          hp: f.stats.hp.value.div(size),
          // Foes have no crit rolls of their own: their hits carry the average crit.
          atk: f.stats.atk.value.div(size).times(1 + f.stats.critRate * f.stats.critDmg),
          range: f.def.range,
          cooldown: 1 / Math.max(0.05, f.stats.attacksPerSec.value),
          speed: f.stats.moveSpeed.value,
          element: f.def.element,
          flying: f.def.flying,
        });
        if (size > 1) e.view.setScale(0.7);
        e.defense = f.stats.def.value;
        e.stats = f.stats;
        this.enemies.push(e);
      }
    }
    const teamHp = (units: Unit[]) => units.reduce((t, u) => t.plus(u.maxHp), new Decimal(0)).times(PVP_CRYSTAL_HP);
    const mine = teamHp(this.heroes);
    const theirs = teamHp(this.enemies);
    this.pvp.mine = { hp: mine, max: mine };
    this.pvp.theirs = { hp: theirs, max: theirs };
    this.crystalShield.setVisible(false);
    this.transitioning = false;
    this.bossEngaged = false;
    this.cameras.main.scrollX = 0;
    this.drawBackground();
    this.banner('COLOSSEUM\nFIGHT!', '#ffd84a');
    play('boss');
    this.state.emit();
  }

  /** Give up the battle in progress: it counts as a loss. */
  leavePvp() {
    this.endPvp(false);
  }

  /** Back from a finished battle to the run, which restarts its current stage. */
  closePvp() {
    if (!this.pvp) return;
    this.pvp = null;
    this.bannerText.setAlpha(0);
    this.restart();
  }

  private endPvp(won: boolean) {
    const p = this.pvp;
    if (!p || p.done) return;
    p.done = true;
    this.transitioning = true;
    this.banner(won ? 'VICTORY!' : 'DEFEAT', won ? '#ffe066' : '#ff6b6b');
    play(won ? 'clear' : 'defeat');
    if (won) {
      this.cameras.main.shake(250, 0.012);
      this.freeze(0.12);
    }
    p.onEnd(won);
  }

  /** One frame of a Colosseum battle: both sides fight and push for the other's crystal; fallen fighters come back. */
  private updatePvp(dt: number, realDt: number) {
    const p = this.pvp!;
    p.timeLeft -= dt;
    for (const h of this.heroes) {
      if (!h.alive) {
        if (this.clock >= h.respawnAt) this.reviveHero(h);
        else h.reviveText?.setText(`${Math.ceil(reviveIn(h, this.clock))}`);
        continue;
      }
      this.stepHero(h, dt);
    }
    for (const e of this.enemies) {
      if (!e.alive) {
        if (this.clock >= e.respawnAt) this.reviveFoe(e);
        continue;
      }
      this.stepEnemy(e, dt);
    }
    this.tickBurns(dt);
    this.tickStatus(dt);
    this.followHeroes(realDt);
    if (p.done) return;
    if (p.theirs.hp.lte(0)) return this.endPvp(true);
    if (p.mine.hp.lte(0)) return this.endPvp(false);
    if (p.timeLeft <= 0) {
      p.timeLeft = 0;
      const share = (c: { hp: Decimal; max: Decimal }) => c.hp.div(c.max).toNumber();
      return this.endPvp(share(p.mine) > share(p.theirs));
    }
    this.regenerate(dt);
    if (this.state.autoUlt) for (const h of this.heroes) this.tryAutoUlt(h);
  }

  /** A fallen Colosseum foe gets back up at the red crystal. */
  private reviveFoe(e: Unit) {
    e.alive = true;
    e.hp = e.maxHp;
    e.rootedUntil = 0;
    e.burnUntil = 0;
    e.poisonUntil = 0;
    e.x = ENEMY_CRYSTAL_X - 20;
    this.tweens.killTweensOf(e.view);
    e.view.setPosition(e.x, e.y).setAlpha(1).setScale(e.def?.squad ? 0.7 : 1).setVisible(true);
    e.body.setAlpha(1);
    this.drawHpBar(e);
  }

  /** A Colosseum foe hits the blue crystal. */
  private damagePlayerCrystal(amount: Decimal, by: Unit) {
    const p = this.pvp!;
    this.meter(by, 'dealt', Decimal.min(amount, p.mine.hp));
    p.mine.hp = Decimal.max(0, p.mine.hp.minus(amount));
    this.sparks(PLAYER_CRYSTAL_X + 8, LANE_TOP + 26, 0x8fd0ff, 3);
    play('hurt');
    this.playerCrystalView.setTintFill(0xffffff);
    this.time.delayedCall(60, () => this.playerCrystalView.clearTint());
  }

  /**
   * Start a live Elemental Trial: the run pauses, the heroes come back at their Trial levels (Ember levels only)
   * at the blue crystal and run across the lane to one element boss that hits back. There is no red crystal:
   * killing the boss wins. No respawns, so the team can lose. `onEnd` gets the outcome once.
   */
  startTrial(element: Element, tier: number, onEnd: (won: boolean, seconds: number) => void) {
    if (this.trial) return;
    this.nextStageTimer?.remove();
    this.nextStageTimer = undefined;
    this.clearChests();
    const trial: TrialFight = { element, tier, timeLeft: TRIAL_TIME, fought: 0, hits: 0, done: false, onEnd, meter: new Map(), foeMeter: meterRow('boss') };
    this.trial = trial;
    for (const p of this.crystalParts) (p as unknown as Phaser.GameObjects.Components.Visible).setVisible(false);
    // Rebuild the heroes at their Trial levels; they keep their Ultimate cooldowns.
    const ults = new Map(this.heroes.map((h) => [h.def?.id, h.ultReadyAt]));
    for (const h of this.heroes) h.view.destroy();
    this.heroes = [];
    this.syncHeroes();
    for (const h of this.heroes) h.ultReadyAt = ults.get(h.def?.id) ?? 0;
    for (const h of this.heroes) if (h.def) trial.meter.set(h.def.id, meterRow(h.def.id));
    for (const e of this.enemies) e.view.destroy();
    this.enemies = [];
    for (const z of this.zones) z.view.destroy();
    this.zones = [];
    for (const h of this.heroes) {
      h.shield = new Decimal(0);
      h.streakTarget = undefined;
      h.respawnAt = Infinity;
      this.reviveHero(h);
    }
    this.transitioning = false;
    this.bossEngaged = false;
    this.cameras.main.scrollX = 0;
    this.drawBackground();
    const level = TRIAL_LEVELS[tier - 1];
    const art = BOSS_ANIMS[TRIAL_BOSS_ART[element]] ? TRIAL_BOSS_ART[element] : BOSS_ANIMS[element] ? element : undefined;
    const boss = this.makeUnit({
      side: 'enemy',
      texture: art ? `boss-${art}-idle` : 'boss',
      bossArt: art,
      x: TRIAL_BOSS_X,
      // Research's Elemental branch makes Trial bosses take more damage, as in the Trials panel's estimate.
      hp: trialHp(level).div(1 + this.state.researchBonus('elemental')),
      atk: trialDps(level).times(TRIAL_BOSS_COOLDOWN),
      // Its blasts reach the back row too, so ranged heroes and healers are never safe.
      range: TRIAL_BOSS_RANGE,
      cooldown: TRIAL_BOSS_COOLDOWN,
      speed: 0,
      element,
      isBoss: true,
      label: TRIAL_BOSS_NAMES[element],
    });
    // A short wind-up before the first hit.
    boss.cooldownLeft = TRIAL_BOSS_COOLDOWN;
    this.enemies.push(boss);
    this.banner(`${TRIAL_BOSS_NAMES[element].toUpperCase()}\nTRIAL LEVEL ${tier}`, '#ff6680');
    this.cameras.main.shake(400, 0.01);
    play('boss');
    this.state.emit();
  }

  /** Give up the Trial in progress: it counts as a loss (no ticket spent). */
  leaveTrial() {
    this.endTrialFight(false);
  }

  /** Back from a finished Trial to the run, which restarts its current stage. */
  closeTrial() {
    if (!this.trial) return;
    this.trial = null;
    for (const p of this.crystalParts) (p as unknown as Phaser.GameObjects.Components.Visible).setVisible(true);
    this.crystalShield.setVisible(false);
    this.bannerText.setAlpha(0);
    this.restart();
  }

  private endTrialFight(won: boolean) {
    const t = this.trial;
    if (!t || t.done) return;
    t.done = true;
    this.transitioning = true;
    this.banner(won ? 'TRIAL CLEARED!' : t.timeLeft <= 0 ? 'TIME UP' : 'DEFEATED', won ? '#ffe066' : '#ff6b6b');
    play(won ? 'clear' : 'defeat');
    if (won) {
      this.cameras.main.shake(250, 0.012);
      this.freeze(0.12);
    }
    t.onEnd(won, Math.round(t.fought * 10) / 10);
  }

  /** The Trial boss's attack: one hard hit on the nearest hero, and every few hits a slam on the whole team. */
  private trialBossHits(e: Unit, target: Unit) {
    const t = this.trial!;
    t.hits++;
    const atk = e.atk;
    e.atk = atk.times(1 + (Math.random() * 2 - 1) * TRIAL_HIT_SPREAD);
    if (t.hits % TRIAL_SLAM_EVERY === 0) {
      const full = e.atk;
      e.atk = full.times(TRIAL_SLAM_SHARE);
      this.floatText(e.x, e.y - 60, 'SLAM!', '#ff9a6b', 16);
      this.cameras.main.shake(200, 0.01);
      this.shatter(target.x, target.y, ELEMENT_COLORS[e.element]);
      for (const h of this.heroes) if (h.alive && h !== target) this.enemyHits(e, h);
      e.atk = full;
    }
    this.enemyHits(e, target);
    e.atk = atk;
  }

  speedMultiplier() {
    return this.state.speed2x && this.state.bestStage >= SPEED_UNLOCK_STAGE ? 2 : 1;
  }

  private freeze(seconds: number) {
    // Shorter at 2x so hit-stop doesn't eat the speed-up (it pauses the whole fight in real time).
    this.hitStop = Math.max(this.hitStop, seconds / this.speedMultiplier());
  }

  // ---------- combat ----------

  private playSeconds = 0;

  update(_time: number, deltaMs: number) {
    const realDt = Math.min(deltaMs / 1000, 0.1);
    this.trackIncome(realDt);
    if (!this.transitioning) this.stageRealTime += realDt;
    // Battle time for the daily challenge, in whole minutes.
    this.playSeconds += realDt;
    if (this.playSeconds >= 60) {
      this.playSeconds -= 60;
      this.state.track('minutes');
    }
    if (this.hitStop > 0) {
      this.hitStop -= realDt;
      return;
    }
    const dt = realDt * (this.speedMultiplier());
    this.anims.globalTimeScale = this.speedMultiplier();
    this.clock += dt;
    if (chestsAllowed(laneMode({ trial: this.trial, pvp: this.pvp }))) this.updateChests(dt);
    this.drawHud();
    this.syncShadows();
    if (this.transitioning) return;
    if (this.trial) {
      this.updateTrial(dt, realDt);
      return;
    }
    if (this.pvp) {
      this.updatePvp(dt, realDt);
      return;
    }

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
        else h.reviveText?.setText(`${Math.ceil(reviveIn(h, this.clock))}`);
        continue;
      }
      this.stepHero(h, dt);
    }
    for (const e of this.enemies) if (e.alive) this.stepEnemy(e, dt);
    this.tickBurns(dt);
    this.tickStatus(dt);

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

  /** One frame of a Trial: no waves and no respawns; the timer runs once the heroes reach the boss. */
  private updateTrial(dt: number, realDt: number) {
    const t = this.trial!;
    const boss = this.enemies.find((e) => e.isBoss);
    if (!this.bossEngaged && boss?.alive) this.bossEngaged = this.heroes.some((h) => h.alive && boss.x - h.x < 220);
    if (this.bossEngaged) {
      t.timeLeft -= dt;
      t.fought += dt;
    }
    for (const h of this.heroes) if (h.alive) this.stepHero(h, dt);
    for (const e of this.enemies) if (e.alive) this.stepEnemy(e, dt);
    this.tickBurns(dt);
    this.tickStatus(dt);
    this.followHeroes(realDt);
    if (!boss || !boss.alive) {
      this.endTrialFight(true);
      return;
    }
    if (this.heroes.every((h) => !h.alive) || t.timeLeft <= 0) {
      t.timeLeft = Math.max(0, t.timeLeft);
      this.endTrialFight(false);
      return;
    }
    this.regenerate(dt);
    if (this.state.autoUlt) for (const h of this.heroes) this.tryAutoUlt(h);
  }

  /** Move or attack, then show running while the hero moved this frame and standing otherwise. */
  private stepHero(h: Unit, dt: number) {
    const x0 = h.x;
    this.stepHeroAction(h, dt);
    if (h.anim && h.anim.state !== 'attack') this.setAnim(h, h.x !== x0 ? 'run' : 'idle');
  }

  private stepHeroAction(h: Unit, dt: number) {
    h.cooldownLeft -= dt;
    h.engaged = false;
    // Stunned by a boss.
    if (h.rootedUntil > this.clock) return;
    const def = h.def!;

    if (def.heals) {
      const hurt = this.heroes
        .filter((a) => a.alive && a.hp.lt(a.maxHp.times(0.75)) && Math.abs(a.x - h.x) <= h.range)
        .sort((a, b) => a.hp.div(a.maxHp).toNumber() - b.hp.div(b.maxHp).toNumber())[0];
      if (hurt && h.cooldownLeft <= 0) {
        h.cooldownLeft = this.cooldownFor(h);
        this.heal(hurt, h.atk.times(3 * this.mul('healPower', h)), h);
        this.shot(h, hurt.x, hurt.y, 0xfff6a0);
        h.attacks++;
        this.ward(h);
        h.engaged = true;
        return;
      }
    }

    // Melee heroes can't reach flying foes (src/reach.ts); with nothing else in reach they head for the crystal.
    const foes = this.foes().filter((e) => this.reaches(h, e));
    let target = this.nearest(h, foes, 1);
    // A foe that slipped behind (a mob waiting under a flying hero) still gets hit when it's in reach.
    if (!target || target.x - h.x > h.range) target = this.behind(h, foes) ?? target;
    const dist = target ? Math.abs(target.x - h.x) : Infinity;
    // Combat comes first: an enemy in range stops the hero, however fast it walks.
    if (target && dist <= h.range) {
      h.engaged = true;
      if (h.cooldownLeft <= 0) {
        h.cooldownLeft = this.cooldownFor(h);
        this.heroAttack(h, target);
      }
      return;
    }
    const crystalDist = ENEMY_CRYSTAL_X - 14 - h.x;
    const canHitCrystal = !this.bossAlive();
    if (crystalDist <= h.range && (!target || dist > crystalDist)) {
      h.engaged = true;
      if (canHitCrystal && h.cooldownLeft <= 0) {
        h.cooldownLeft = this.cooldownFor(h);
        if (def.range > 60) this.shot(h, ENEMY_CRYSTAL_X, LANE_TOP + 26, ELEMENT_COLORS[def.element]);
        else this.lunge(h, 1);
        if (h.anim) this.setAnim(h, 'attack');
        this.damageCrystal(h.atk, h);
      }
      if (!target) return;
    }
    // Walking breaks a Zeal streak.
    h.zeal = 0;
    // Walk at this hero's own Move Speed, held to its Type's place in the team (src/movement.ts).
    const stopAt = ENEMY_CRYSTAL_X - 14 - Math.min(h.range, 30);
    const team = this.heroes.map((u) => ({ x: u.x, type: u.def!.type, alive: u.alive, engaged: !!u.engaged }));
    const self = team[this.heroes.indexOf(h)];
    h.x = marchStep(h.x, h.speed * this.mul('moveSpeed', h), dt, marchCap(self, team), stopAt);
    h.view.x = h.x;
  }

  /** Seconds until a hero's next attack: Atk per sec from the stat sheet, sped up by Rogue Wave+ and Frenzy. */
  private cooldownFor(h: Unit) {
    const base = h.stats ? 1 / h.stats.attacksPerSec.value : h.cooldown;
    return base * (h.hasteUntil > this.clock ? h.hasteMult : 1) * zealState(h.def?.signature, h.zeal, this.sigPlus(h)).cooldown;
  }

  /** Enemies the heroes fight: everyone but those under Puppet Bind for now. */
  private foes(): Unit[] {
    return this.enemies.filter((e) => !(e.charmUntil > this.clock));
  }

  private stepEnemy(e: Unit, dt: number) {
    const slow = e.slowUntil > this.clock ? e.slowMult : 1;
    e.cooldownLeft -= dt * slow * this.mul('enemyHaste', null);
    if (e.rootedUntil > this.clock) {
      if (e.mob?.state === 'walk') this.mobAnim(e, 'idle');
      this.mobBob(e, false);
      return;
    }
    // Under Puppet Bind: hits the closest other enemy in reach instead of the heroes.
    if (e.charmUntil > this.clock) {
      const victim = this.enemies.filter((o) => o.alive && o !== e && !(o.charmUntil > this.clock) && Math.abs(o.x - e.x) <= e.range + 20).sort((a, b) => Math.abs(a.x - e.x) - Math.abs(b.x - e.x))[0];
      if (victim && e.cooldownLeft <= 0) {
        e.cooldownLeft = e.cooldown;
        this.lunge(e, victim.x > e.x ? 1 : -1);
        this.damageUnit(victim, e.atk.times(this.elem(e, victim)), null);
      }
      return;
    }
    // Melee enemies can't reach flying heroes (src/reach.ts); with only flyers left they wait under one.
    const pick = pickVictim(e, this.heroes.map((u) => ({ x: u.x, alive: u.alive, flying: u.flying, u })));
    const target = pick.target?.u;
    const dist = target ? Math.abs(e.x - target.x) : Infinity;
    if (target && dist <= e.range) {
      if (e.cooldownLeft <= 0) {
        e.cooldownLeft = e.cooldown;
        this.lunge(e, target.x > e.x ? 1 : -1);
        this.bossAnim(e, 'attack');
        this.mobAnim(e, 'attack');
        // A caster throws its magic across the gap.
        if (e.range > 60) this.shot(e, target.x, target.y, ELEMENT_COLORS[e.element]);
        if (e.anim) this.setAnim(e, 'attack');
        if (this.trial && e.isBoss) this.trialBossHits(e, target);
        else this.enemyHits(e, target);
      } else if (e.mob?.state === 'walk') this.mobAnim(e, 'idle');
      else if (e.anim && e.anim.state === 'run') this.setAnim(e, 'idle');
      this.mobBob(e, false);
      return;
    }
    // Colosseum foes with no hero in reach hit the blue crystal once they get to it.
    if (this.pvp && e.x - (PLAYER_CRYSTAL_X + 14) <= e.range) {
      if (e.cooldownLeft <= 0) {
        e.cooldownLeft = e.cooldown;
        if (e.range > 60) this.shot(e, PLAYER_CRYSTAL_X, LANE_TOP + 26, ELEMENT_COLORS[e.element]);
        else this.lunge(e, -1);
        if (e.anim) this.setAnim(e, 'attack');
        this.damagePlayerCrystal(e.atk, e);
      }
      return;
    }
    // Bosses guard the crystal; regular enemies march at the heroes.
    if (e.isBoss && e.x < ENEMY_CRYSTAL_X - 120) return;
    const x0 = e.x;
    const step = e.speed * slow * dt;
    // Out in the Colosseum a foe with nobody to hit heads for the crystal; on the lane it waits under a flyer.
    const goal = target && target.x > e.x ? target.x - e.range * 0.8 : !this.pvp && pick.holdX !== undefined ? pick.holdX : -Infinity;
    if (goal > e.x) e.x = Math.min(e.x + step, goal);
    else e.x = Math.max(e.x - step, goal, PLAYER_CRYSTAL_X + 30);
    e.view.x = e.x;
    const walking = e.x !== x0;
    if (e.mob && e.mob.state !== 'attack') this.mobAnim(e, walking ? 'walk' : 'idle');
    if (e.anim && e.anim.state !== 'attack') this.setAnim(e, walking ? 'run' : 'idle');
    this.mobBob(e, walking);
  }

  /** A walking mob rises a little on each step of its walk cycle; flyers hover instead. */
  private mobBob(e: Unit, walking: boolean) {
    if (!e.mob || e.shadow) return;
    const frame = walking ? e.body.anims.currentFrame?.index ?? 0 : 0;
    e.body.y = FOOT_Y - (walking && frame % 2 === 0 ? MOB_BOB : 0);
  }

  /** Whether `a` can hit `t` with a single-target attack (ground melee can't hit flyers). */
  private reaches(a: Unit, t: Unit) {
    return canReach(a, t);
  }

  /** Nearest living foe behind hero `h` (further than the usual slack) that is still in its reach. */
  private behind(h: Unit, pool: Unit[]): Unit | undefined {
    return pool.filter((o) => o.alive && h.x - o.x > 12 && h.x - o.x <= h.range).sort((a, b) => b.x - a.x)[0];
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
    if (e.blindUntil > this.clock && Math.random() < e.blindMiss) {
      this.floatText(target.x, target.y - 26, 'MISS', '#fff6a0', 11);
      return;
    }
    if (Math.random() < (target.stats ? target.stats.dodge.value : this.sum('dodge', target))) {
      this.floatText(target.x, target.y - 26, 'MISS', '#c9b8ff', 11);
      if (this.mastery(target, 'Rogue')) target.riposte = true;
      return;
    }
    const torrent = torrentMults(target.def?.signature, this.hpRatio(target), this.sigPlus(target)).taken;
    const mult = this.elem(e, target) * this.mul('damageTaken', target) * (e.weakUntil > this.clock ? e.weakMult : 1) * torrent;
    let dmg = defended(e.atk.times(mult), target.defense);
    // Wraith Mask: once a life, a hit that would take the hero under the line (even a killing blow) leaves him
    // standing; then the mask heals him and he fights faster for a while.
    const mask = target.def?.signature;
    const left = target.maxHp.gt(0) ? target.hp.plus(target.shield).minus(dmg).div(target.maxHp).toNumber() : 1;
    const masked = target.alive && mask?.kind === 'mask' && maskTriggers(mask, left, !!target.maskUsed);
    if (masked) dmg = Decimal.min(dmg, Decimal.max(0, target.hp.plus(target.shield).minus(target.maxHp.times(0.01))));
    if (target.alive) this.meter(e, 'dealt', Decimal.min(dmg, target.hp.plus(target.shield)));
    this.damageUnit(target, dmg, null);
    if (masked && target.alive && mask?.kind === 'mask') {
      target.maskUsed = true;
      this.heal(target, target.maxHp.times(mask.heal), target);
      target.hasteMult = mask.haste;
      target.hasteUntil = this.clock + (this.sigPlus(target) ? mask.plusSeconds : mask.seconds);
      this.floatText(target.x, target.y - 34, 'MASK ON', '#e0c8ff', 11);
      this.puff(target.x, target.y, 0x2b1640);
    }
    // Frost Curse: the enemy that fells this hero freezes and takes more damage.
    const curse = target.def?.signature;
    if (!target.alive && curse?.kind === 'curse' && e.alive) {
      const until = this.control(e, curse.seconds);
      if (until) {
        e.markMult = Math.max(e.markUntil > this.clock ? e.markMult : 1, curse.mult);
        e.markUntil = Math.max(e.markUntil, until);
        this.floatText(e.x, e.y - 30, 'CURSED', '#9fdcff', 10);
      }
    }
    // Boss hits can stun a hero; Effect Resistance is the chance to shrug it off.
    if (e.isBoss && target.alive && !target.def?.steadfast && Math.random() < BOSS_STUN_CHANCE) {
      if (Math.random() < (target.stats?.effectRes.value ?? 0)) this.floatText(target.x, target.y - 26, 'RESIST', '#9effa8', 9);
      else {
        target.rootedUntil = this.clock + BOSS_STUN_SECONDS;
        this.floatText(target.x, target.y - 26, 'STUNNED', '#ffd84a', 9);
      }
    }
    const reflect = this.sum('reflect', target) + signatureReflect(target.def?.signature);
    if (reflect > 0) {
      this.damageUnit(e, dmg.times(reflect), target);
      // Bramble Hide+ (6★): reflected hits can stun the attacker.
      if (e.alive && target.def?.signature?.kind === 'reflect' && this.sigPlus(target) && Math.random() < SIG_PLUS.reflectStun) {
        if (this.control(e, SIG_PLUS.reflectStunSeconds)) this.floatText(e.x, e.y - 30, 'STUN', '#ffd84a', 9);
      }
    }
  }

  /** The element a hero deals damage as: Earth for non-Fire heroes during Rootcall. */
  private dealsAs(h: Unit): Element {
    return this.earthenUntil > this.clock && h.element !== 'fire' ? 'earth' : h.element;
  }

  /** Faery Shield: every Nth heal or attack shields a random living ally. */
  private ward(h: Unit) {
    const w = procEffect(this.state.effects(), 'ward', h.def!.id);
    if (!procs(w, h.attacks)) return;
    const living = this.heroes.filter((a) => a.alive);
    const a = living[Math.floor(Math.random() * living.length)];
    if (!a) return;
    a.shield = Decimal.max(a.shield, h.maxHp.times(w!.value));
    this.drawHpBar(a);
    this.puff(a.x, a.y, 0x9be07a);
  }

  private heroAttack(h: Unit, target: Unit) {
    const def = h.def!;
    if (def.range > 60) this.shot(h, target.x, target.y, ELEMENT_COLORS[def.element]);
    else this.lunge(h, 1);
    if (h.anim) this.setAnim(h, 'attack');
    h.attacks++;
    this.ward(h);
    const st = h.stats!;
    const critChance = st.critRate;
    const critMult = 1 + st.critDmg;
    // Frenzy: attack twice as fast for a few seconds.
    if (Math.random() < st.frenzy.value && !(h.hasteUntil > this.clock && h.hasteMult <= STAT_BASE.frenzyHaste)) {
      h.hasteUntil = this.clock + STAT_BASE.frenzySeconds;
      h.hasteMult = STAT_BASE.frenzyHaste;
      this.floatText(h.x, h.y - 30, 'FRENZY', '#ff7ad9', 9);
    }
    // Barrage: every Nth attack is a flurry of quick blows instead of the double-strike roll.
    const barrage = barrageHits(def.signature, h.attacks, this.sigPlus(h));
    const strikes = barrage > 1 ? barrage : Math.random() < this.sum('doubleStrike', h) ? 2 : 1;
    if (barrage > 1) this.floatText(h.x, h.y - 34, 'BARRAGE!', '#ffb36b', 10);
    // Zeal: each attack in a row speeds up the next ones (cooldownFor), and a full streak sends out light waves.
    if (def.signature?.kind === 'zeal') h.zeal++;
    const zealWave = zealState(def.signature, h.zeal, this.sigPlus(h)).wave;
    const nth = everyNth(this.state.effects(), def.id);
    const fx = this.state.effects();
    const slam = procEffect(fx, 'slam', def.id);
    const snowball = procEffect(fx, 'snowball', def.id);
    const assassin = procEffect(fx, 'assassinate', def.id);
    // Puppet Bind: every Nth attack turns a regular enemy near the target against its own side.
    const charm = procEffect(fx, 'charm', def.id);
    if (procs(charm, h.attacks) && !target.isBoss && target.alive) {
      target.charmUntil = this.clock + charm!.value;
      this.floatText(target.x, target.y - 34, 'POSSESSED', '#c9b8ff', 10);
      const next = this.nearest(h, this.foes().filter((e) => this.reaches(h, e)), 1);
      if (!next) return;
      target = next;
    }
    const blind = procEffect(fx, 'blind', def.id);
    const blinded = procs(blind, h.attacks);
    const element = this.dealsAs(h);
    // Charge (Ascendant heroes): every Nth attack in a row fires the charged Signature.
    const charge = chargeOf(def);
    let charged: Charge | undefined;
    if (charge) {
      const step = chargeStep(h.chargeStacks, charge);
      h.chargeStacks = step.stacks;
      if (step.fired) {
        charged = charge;
        this.floatText(h.x, h.y - 34, 'CHARGE!', '#fff1a8', 10);
        this.puff(target.x, target.y, ELEMENT_COLORS[def.element]);
        if (charge.boost === 'attackSpeed' && !(h.hasteUntil > this.clock && h.hasteMult <= 1 / (1 + charge.value))) {
          h.hasteUntil = this.clock + CHARGE_HASTE_SECONDS;
          h.hasteMult = 1 / (1 + charge.value);
        }
      }
    }
    // Shadow Pounce: every Nth attack blinks to the farthest enemy in reach, or to a boss in reach.
    if (procs(assassin, h.attacks)) {
      const inReach = this.enemies.filter((e) => e.alive && e.x >= h.x && e.x - h.x <= ASSASSIN_REACH && this.reaches(h, e));
      const far = inReach.find((e) => e.isBoss) ?? inReach.sort((a, b) => b.x - a.x)[0];
      if (far && far !== target) {
        this.puff(h.x, h.y, 0x9b59d0);
        h.x = Math.max(h.x, far.x - 16);
        h.view.x = h.x;
        target = far;
      }
    }
    const bossMult = this.mul('bossDamage', h);
    const lifesteal = this.sum('lifesteal', h);
    const sig = def.signature;
    const vsBurning = this.mul('vsBurning', h);
    if (h.streakTarget === target) h.streak++;
    else {
      // Riptide Combo+ (6★): after a kill, half the streak carries over.
      const carry = sig?.kind === 'combo' && this.sigPlus(h) && h.streakTarget && !h.streakTarget.alive ? Math.floor(h.streak * SIG_PLUS.comboCarry) : 0;
      h.streakTarget = target;
      h.streak = carry;
    }
    // Barbarian Mastery: +1% damage per 2% HP missing, up to +50%.
    const rage = this.mastery(h, 'Barbarian') ? 1 + Math.min(0.5, (1 - h.hp.div(h.maxHp).toNumber()) / 2) : 1;
    // Brawler Mastery: every 4th hit in a row on one enemy stuns it.
    if (this.mastery(h, 'Brawler') && (h.streak + 1) % 4 === 0) {
      if (this.control(target, 0.5)) this.floatText(target.x, target.y - 30, 'STUN', '#ffd84a', 9);
    }
    const beacon = h.beaconUntil > this.clock ? h.beaconMult : 1;
    const torrentDmg = torrentMults(sig, this.hpRatio(h), this.sigPlus(h)).dmg;
    let dealt = new Decimal(0);
    for (let i = 0; i < strikes; i++) {
      // Hawkeye: shots at an enemy at full HP always crit. Owl Eyes: shots at flyers always crit.
      const crit = !!h.riposte || (sig?.kind === 'sureCrit' && target.hp.gte(target.maxHp)) || (sig?.kind === 'skyCrit' && !!target.flying) || Math.random() < critChance;
      h.riposte = false;
      // Samurai Mastery: crits take time off the Ultimate cooldown.
      if (crit && this.mastery(h, 'Samurai')) h.ultReadyAt -= 0.5;
      let atk = (crit ? h.atk.times(critMult) : h.atk).times(beacon * rage * this.state.boostMult('horn'));
      const procced = !!(nth && nth.every && h.attacks % nth.every === 0);
      if (procced) atk = atk.times(nth!.value);
      // Slam: every Nth attack slams every enemy near the target.
      const slammed = procs(slam, h.attacks);
      if (slammed) atk = atk.times(slam!.value);
      if (procs(assassin, h.attacks)) atk = atk.times(assassin!.value);
      if (barrage > 1 && sig?.kind === 'barrage') atk = atk.times(sig.mult);
      const rolled = procs(snowball, h.attacks);
      const splash = def.splash ? Math.max(def.splash * (1 + st.aoeRadius), zealWave) : slammed ? SLAM_RADIUS : zealWave;
      let targets: Unit[];
      if (charged?.boost === 'area') targets = this.enemies.filter((e) => e.alive && Math.abs(e.x - target.x) <= Math.max(splash, CHARGE_AREA));
      else if (charged?.boost === 'pierce') targets = [target, ...this.enemies.filter((e) => e.alive && e !== target && e.x > target.x && e.x - target.x <= CHARGE_LINE)];
      else if (splash) targets = this.enemies.filter((e) => e.alive && Math.abs(e.x - target.x) <= splash);
      else {
        // Piercing shots also hit the next enemies just behind the target.
        const pierce = Math.round(this.sum('pierce', h));
        const behind = pierce > 0 ? this.enemies.filter((e) => e.alive && e !== target && e.x > target.x && e.x - target.x <= 60).sort((a, b) => a.x - b.x).slice(0, pierce) : [];
        targets = [target, ...behind];
        // Rolling Snowball: every Nth shot rolls through the enemies just behind the target.
        if (rolled) targets = [target, ...this.enemies.filter((e) => e.alive && e !== target && e.x > target.x && e.x - target.x <= SNOWBALL_REACH)];
      }
      for (const t of targets) {
        const mult =
          this.elem(element, t) *
          (t.isBoss ? bossMult : 1) *
          (t === target ? comboMult(sig, h.streak) : 1) *
          executeMult(sig, t.maxHp.gt(0) ? t.hp.div(t.maxHp).toNumber() : 1, this.sigPlus(h)) *
          (t.burnUntil > this.clock ? vsBurning : 1) *
          (splash ? 1 + st.aoeDmg : 1) *
          (charged ? chargeDamageMult(charged, t.isBoss) : 1) *
          torrentDmg;
        const amount = atk.times(mult);
        // Lifesteal only counts hits that land (element-locked bosses shrug off the rest).
        if (t.lockStage === undefined || !bossImmuneTo(t.lockStage, this.dealsAs(h))) dealt = dealt.plus(amount);
        this.damageUnit(t, amount, h, crit);
        if (t.alive) this.applyEffects(h, t, amount, procced);
        if (t.alive && blinded) {
          t.blindUntil = this.clock + BLIND_SECONDS;
          t.blindMiss = blind!.value;
        }
        if (t.alive && rolled) {
          t.markMult = Math.max(t.markUntil > this.clock ? t.markMult : 1, snowball!.value);
          t.markUntil = Math.max(t.markUntil, this.clock + SNOWBALL_SECONDS);
        }
      }
    }
    // Spirit: every Nth attack the hero's spirit also hits other enemies in reach.
    const spirits = spiritTargets(sig, h.attacks, this.sigPlus(h));
    if (spirits > 0 && sig?.kind === 'spirit') {
      const others = this.foes().filter((e) => e.alive && e !== target && Math.abs(e.x - h.x) <= h.range && this.reaches(h, e)).slice(0, spirits);
      for (const o of others) {
        this.shot(h, o.x, o.y, ELEMENT_COLORS[def.element]);
        const amount = h.atk.times(sig.mult * this.elem(element, o) * (o.isBoss ? bossMult : 1));
        dealt = dealt.plus(amount);
        this.damageUnit(o, amount, h);
      }
    }
    if (lifesteal > 0 && h.alive && h.hp.lt(h.maxHp)) {
      const stolen = Decimal.min(h.maxHp.minus(h.hp), dealt.times(lifesteal));
      this.meter(h, 'healed', stolen);
      h.hp = h.hp.plus(stolen);
      this.drawHpBar(h);
    }
  }

  /** Roll the hero's stun, freeze, burn and poison chances on an enemy it just hit for `amount`. */
  private applyEffects(h: Unit, t: Unit, amount: Decimal, procced = false) {
    const st = h.stats!;
    const sig = h.def?.signature;
    // Knock-back: hits push regular enemies back.
    if (sig?.kind === 'knockback' && !t.isBoss) {
      t.x = Math.min(t.x + sig.push, ENEMY_CRYSTAL_X - 12);
      this.tweens.add({ targets: t.view, x: t.x, duration: 160, ease: 'Quad.out' });
    }
    // Sticky Spores: a chance to slow (Spore Cloud attacks always slow).
    if (sig?.kind === 'slow' && (procced || Math.random() < sig.chance) && !(t.isBoss && t.ccImmuneUntil > this.clock)) {
      if (t.slowUntil <= this.clock) this.floatText(t.x, t.y - 30, 'SLOW', '#b5e48c', 9);
      t.slowMult = sig.mult;
      t.slowUntil = this.clock + sig.seconds;
    }
    if (st.stunChance > 0 && Math.random() < st.stunChance) {
      if (this.control(t, STAT_BASE.stunSeconds * (1 + st.stunTime))) this.floatText(t.x, t.y - 30, 'STUN', '#ffd84a', 9);
    }
    if (st.freezeChance > 0 && t.frozenUntil <= this.clock && Math.random() < st.freezeChance) {
      const until = this.control(t, STAT_BASE.freezeSeconds * (1 + st.freezeTime));
      if (until) {
        t.frozenUntil = until;
        t.frozenBlast = h.atk.times(STAT_BASE.freezeBlast * (1 + st.freezeBlast));
        t.frozenBy = h;
        t.body.setTint(0x9fdcff);
        this.floatText(t.x, t.y - 30, 'FROZEN', '#9fdcff', 9);
      }
    }
    const burnTime = 1 + st.burnTime;
    if (sig?.kind === 'burn') this.ignite(t, amount.times(sig.share * (1 + st.burnDmg)), sig.seconds * burnTime, h);
    else if (st.burnChance > 0 && Math.random() < st.burnChance) this.ignite(t, h.atk.times(STAT_BASE.burnDps * (1 + st.burnDmg)), STAT_BASE.burnSeconds * burnTime, h);
    if (st.poisonChance > 0 && Math.random() < st.poisonChance) {
      t.poisonStacks = t.poisonUntil > this.clock ? Math.min(STAT_BASE.poisonStacks, t.poisonStacks + 1) : 1;
      t.poisonDps = Decimal.max(t.poisonUntil > this.clock ? t.poisonDps : new Decimal(0), h.atk.times(STAT_BASE.poisonDps * (1 + st.poisonDmg)));
      t.poisonUntil = this.clock + STAT_BASE.poisonSeconds * (1 + st.poisonTime);
      t.poisonBy = h;
    }
  }

  /** Frozen enemies whose ice ran out burst, hurting them and enemies close by; poisoned enemies take their ticks. */
  private tickStatus(dt: number) {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e.frozenUntil > 0 && e.frozenUntil <= this.clock) {
        e.frozenUntil = 0;
        this.restTint(e);
        const by = e.frozenBy;
        this.shatter(e.x, e.y, 0x9fdcff);
        for (const o of this.enemies) {
          if (o.alive && Math.abs(o.x - e.x) <= FREEZE_BLAST_RADIUS) this.damageUnit(o, e.frozenBlast.times(by ? this.elem(by.element, o) : 1), by ?? null);
        }
      }
      if (!e.alive || e.poisonUntil <= this.clock) continue;
      e.poisonTick += dt;
      if (e.poisonTick < BURN_TICK) continue;
      e.poisonTick -= BURN_TICK;
      const dmg = e.poisonDps.times(e.poisonStacks * BURN_TICK);
      if (this.immune(e, e.poisonBy ?? null)) continue;
      this.floatText(e.x + Phaser.Math.Between(-6, 6), e.y - 22, fmt(dmg), '#8dff6a', 9);
      this.meter(e.poisonBy, 'dealt', Decimal.min(dmg, e.hp));
      this.meter(e, 'taken', Decimal.min(dmg, e.hp));
      e.hp = e.hp.minus(dmg);
      this.drawHpBar(e);
      if (e.hp.lte(0)) this.kill(e, e.poisonBy ?? null);
    }
  }

  /** Set an enemy Burning, keeping the stronger burn if it already burns. */
  private ignite(e: Unit, dps: Decimal, seconds: number, by: Unit) {
    // Kindling+ (6★): a burn from the same hero adds on top, up to SIG_PLUS.burnStacks burns' worth.
    if (e.burnUntil > this.clock && e.burnBy === by && by.def?.signature?.kind === 'burn' && this.sigPlus(by)) {
      e.burnDps = Decimal.max(e.burnDps, Decimal.min(e.burnDps.plus(dps), dps.times(SIG_PLUS.burnStacks)));
    } else if (e.burnUntil <= this.clock || dps.gte(e.burnDps)) {
      e.burnDps = dps;
      e.burnBy = by;
    }
    e.burnUntil = Math.max(e.burnUntil, this.clock + seconds);
  }

  /** Burning enemies take damage every BURN_TICK; Meteor ground keeps setting walkers alight. */
  private tickBurns(dt: number) {
    for (const z of this.zones) {
      if (z.until <= this.clock) continue;
      for (const e of this.enemies) if (e.alive && e.x >= z.x0 && e.x <= z.x1) this.ignite(e, z.dps.times(this.elem(z.by.element, e)), 1, z.by);
    }
    for (const z of this.zones) if (z.until <= this.clock) z.view.destroy();
    this.zones = this.zones.filter((z) => z.until > this.clock);
    for (const e of this.enemies) {
      if (!e.alive || e.burnUntil <= this.clock) continue;
      e.burnTick += dt;
      if (e.burnTick < BURN_TICK) continue;
      e.burnTick -= BURN_TICK;
      const dmg = e.burnDps.times(BURN_TICK);
      if (this.immune(e, e.burnBy ?? null)) continue;
      this.sparks(e.x, e.y - 6, 0xff8a3a, 2);
      this.floatText(e.x + Phaser.Math.Between(-6, 6), e.y - 22, fmt(dmg), '#ffa55a', 9);
      const burnt = Decimal.min(e.markUntil > this.clock ? dmg.times(e.markMult) : dmg, e.hp);
      this.meter(e.burnBy, 'dealt', burnt);
      this.meter(e, 'taken', burnt);
      if (e.markUntil > this.clock) e.hp = e.hp.minus(dmg.times(e.markMult - 1));
      e.hp = e.hp.minus(dmg);
      this.drawHpBar(e);
      if (e.hp.lte(0)) this.kill(e, e.burnBy ?? null);
    }
  }

  /** Regeneration star skills (a hero's own, plus team-wide auras). */
  private regenerate(dt: number) {
    for (const h of this.heroes) {
      if (!h.alive) continue;
      const rate = this.sum('regen', h);
      if (rate <= 0 || h.hp.gte(h.maxHp)) continue;
      const regen = Decimal.min(h.maxHp.minus(h.hp), h.maxHp.times(rate * dt));
      this.meter(h, 'healed', regen);
      h.hp = h.hp.plus(regen);
      this.drawHpBar(h);
    }
  }

  /** Element-locked bosses shrug off anything not dealt as their weakness, and say so. */
  private immune(target: Unit, source: Unit | null): boolean {
    if (target.lockStage === undefined) return false;
    const as = source && source.side === 'hero' ? this.dealsAs(source) : null;
    if (!bossImmuneTo(target.lockStage, as)) return false;
    if (this.clock - (target.immuneShownAt ?? -Infinity) >= 0.6) {
      target.immuneShownAt = this.clock;
      this.floatText(target.x + Phaser.Math.Between(-8, 8), target.y - 30, 'IMMUNE', '#b8c0cc', 11);
    }
    return true;
  }

  private damageUnit(target: Unit, amount: Decimal, source: Unit | null, crit = false) {
    if (!target.alive) return;
    if (this.immune(target, source)) return;
    // Sanctuary: no damage at all for a while.
    if (target.side === 'hero' && target.guardUntil > this.clock) return;
    if (target.side === 'enemy' && target.markUntil > this.clock) amount = amount.times(target.markMult);
    if (target.side === 'enemy') amount = amount.times(this.mul('enemyVuln', null));
    let toHp = amount;
    if (target.shield.gt(0)) {
      const soaked = Decimal.min(target.shield, amount);
      target.shield = target.shield.minus(soaked);
      toHp = amount.minus(soaked);
    }
    const landed = Decimal.min(amount, target.hp.plus(amount.minus(toHp)));
    this.meter(source, 'dealt', landed);
    this.meter(target, 'taken', landed);
    target.hp = target.hp.minus(toHp);
    this.drawHpBar(target);
    this.hitFeedback(target, amount, source, crit);
    target.body.setTintFill(0xffffff);
    this.time.delayedCall(60, () => {
      if (!target.body.active) return;
      if (target.side === 'enemy') this.restTint(target);
      else target.body.clearTint();
    });
    if (target.hp.lte(0)) this.kill(target, source);
    else if (target.bossArt && this.clock >= target.bossArt.flinchAt && target.body.anims.currentAnim?.key.endsWith('-idle')) {
      target.bossArt.flinchAt = this.clock + BOSS_FLINCH_SECONDS;
      this.bossAnim(target, 'hurt');
    }
  }

  /** Squash, sparks, knockback, damage numbers, shake and sound for one hit. */
  private hitFeedback(target: Unit, amount: Decimal, source: Unit | null, crit: boolean) {
    const scale = target.bossArt ? BOSS_SCALE : 1;
    this.tweens.add({ targets: target.body, scaleX: 1.25 * scale, scaleY: 0.8 * scale, duration: 50, yoyo: true, onComplete: () => target.body.setScale(scale) });
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

  private heal(target: Unit, amount: Decimal, healer?: Unit) {
    play('heal');
    this.sparks(target.x, target.y, 0x7dff9a, 5);
    const split = splitHeal(healer?.def?.signature, amount, target.maxHp.minus(target.hp), target.shield, target.maxHp, this.sigPlus(healer));
    // Support Mastery: healing clears stuns.
    if (healer && this.mastery(healer, 'Support')) target.rootedUntil = Math.min(target.rootedUntil, this.clock);
    // Healing counts what it restores, shields included.
    this.meter(healer ?? target, 'healed', Decimal.min(split.hp, target.maxHp.minus(target.hp)).plus(Decimal.max(0, split.shield.minus(target.shield))));
    target.hp = Decimal.min(target.maxHp, target.hp.plus(split.hp));
    target.shield = split.shield;
    const beacon = healer ? this.mul('beacon', healer) : 1;
    if (beacon > 1) {
      target.beaconMult = beacon;
      target.beaconUntil = this.clock + BEACON_SECONDS;
    }
    this.drawHpBar(target);
    this.floatText(target.x, target.y - 26, `+${fmt(amount)}`, '#7dff9a');
  }

  private kill(u: Unit, source: Unit | null) {
    u.alive = false;
    // Executioner+ (6★): kills take time off the Ultimate cooldown.
    if (u.side === 'enemy' && source?.def?.signature?.kind === 'execute' && this.sigPlus(source)) source.ultReadyAt -= SIG_PLUS.killUltRefund;
    if (u.side === 'enemy' && u.burnUntil > this.clock && u.burnBy?.alive) {
      // Wildfire: a Burning enemy that dies explodes.
      const by = u.burnBy;
      const burst = this.sum('burnBurst', by);
      if (burst > 0) {
        this.shatter(u.x, u.y, 0xff8a3a);
        for (const e of this.enemies) {
          if (e.alive && Math.abs(e.x - u.x) <= WILDFIRE_RADIUS) this.damageUnit(e, by.atk.times(burst * this.elem(by.element, e)), by);
        }
      }
    }
    if (u.side === 'enemy' && this.pvp) {
      // A Colosseum foe pays nothing; it fades and comes back at its crystal after the usual wait.
      u.respawnAt = respawnTime(this.clock, PVP_RESPAWN_MULT);
      u.hpBar.clear();
      this.tweens.add({ targets: u.view, alpha: 0, duration: 300, onComplete: () => u.view.setVisible(false) });
      this.shatter(u.x, u.y, ELEMENT_COLORS[u.element]);
      play('kill');
    } else if (u.side === 'enemy' && this.trial) {
      // A Trial pays in Essence and medals when it ends, not in gold.
      u.hpBar.clear();
      if (u.bossArt) this.bossAnim(u, 'death');
      else this.tweens.add({ targets: u.view, alpha: 0, scale: 1.5, duration: 400, onComplete: () => u.view.destroy() });
      this.shatter(u.x, u.y, ELEMENT_COLORS[u.element]);
      play('kill');
      this.cameras.main.flash(150, 255, 255, 255);
    } else if (u.side === 'enemy') {
      this.state.track('kills');
      const gold = goldPerKill(this.state.stage)
        .times(u.isBoss ? 10 : 1)
        .times(source?.goldMult ?? 1)
        .times(this.mul('gold', null))
        .times(1 + this.state.relicBonus('gold'))
        .times(1 + this.state.researchBonus('prosperity'))
        .times(this.state.goldBoostMult());
      this.gainGold(gold, u.x, u.y);
      if (u.bossArt) {
        // An animated boss plays its death, then fades.
        u.hpBar.clear();
        this.bossAnim(u, 'death');
        u.body.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
          if (u.view.active) this.tweens.add({ targets: u.view, alpha: 0, duration: 400, onComplete: () => u.view.destroy() });
        });
      } else {
        this.tweens.add({ targets: u.view, alpha: 0, scale: 1.5, y: u.y - 8, duration: 220, onComplete: () => u.view.destroy() });
      }
      this.shatter(u.x, u.y, ELEMENT_COLORS[u.element]);
      this.flyCoins(u.x, u.y, u.isBoss ? 12 : 2);
      play('kill');
      if (u.isBoss) {
        this.cameras.main.shake(500, 0.02);
        this.cameras.main.flash(150, 255, 255, 255);
        this.freeze(0.25);
      }
    } else {
      u.respawnAt = respawnTime(this.clock, this.mul('respawn', null) * (this.pvp ? PVP_RESPAWN_MULT : 1));
      u.chargeStacks = 0;
      u.zeal = 0;
      u.maskUsed = false;
      this.puff(u.x, u.y, 0xffffff);
      if (this.trial) u.view.setVisible(false);
      else this.ghostHero(u);
    }
  }

  /** A fallen hero waits as a faded ghost at the player's crystal, with seconds to go above it. */
  private ghostHero(h: Unit) {
    this.tweens.killTweensOf(h.view);
    h.hpBar.clear();
    h.x = PLAYER_CRYSTAL_X + 20;
    h.view.setPosition(h.x, h.y).setAlpha(1).setVisible(true);
    h.body.setAlpha(0.3);
    if (h.reviveText?.active) return;
    const text = this.add
      .text(0, -40, '', { fontFamily: 'monospace', fontSize: '12px', color: '#ffffff', stroke: '#000', strokeThickness: 3 })
      .setOrigin(0.5);
    // Inside the view so it moves with the ghost, at full strength over the faded body.
    h.view.add(text);
    h.view.once(Phaser.GameObjects.Events.DESTROY, () => text.destroy());
    h.reviveText = text;
    text.setText(`${Math.ceil(reviveIn(h, this.clock))}`);
  }

  private damageCrystal(amount: Decimal, by?: Unit) {
    if (this.pvp) {
      this.meter(by, 'dealt', Decimal.min(amount, this.pvp.theirs.hp));
      this.pvp.theirs.hp = Decimal.max(0, this.pvp.theirs.hp.minus(amount));
      this.sparks(ENEMY_CRYSTAL_X - 8, LANE_TOP + 26, 0xff8fc0, 3);
      play('hit');
      this.crystalView.setTintFill(0xffffff);
      this.time.delayedCall(60, () => this.crystalView.clearTint());
      return;
    }
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
    const level = this.levelOf(heroId);
    return {
      unlocked: level >= ULT_UNLOCK_LEVEL,
      alive: !!h?.alive,
      remaining: h ? Math.max(0, h.ultReadyAt - this.clock) : 0,
      reviveIn: h ? reviveIn(h, this.clock) : 0,
      total: this.ultCooldown(heroId),
      slotted: this.state.hasUltSlot(heroId),
    };
  }

  triggerUlt(heroId: string): boolean {
    const h = this.heroes.find((u) => u.def?.id === heroId);
    if (!h || !h.alive || this.transitioning) return false;
    const s = this.getUltState(heroId);
    if (!s.slotted || !s.unlocked || s.remaining > 0) return false;
    h.ultReadyAt = this.clock + this.ultCooldown(heroId);
    const color = ELEMENT_COLORS[h.element];
    play('ult');
    this.freeze(0.08);
    const def = h.def!;
    const plus = this.has(def.id, ULT_PLUS_EVOLUTIONS);
    if (def.heals) {
      for (const a of this.heroes) if (a.alive) this.heal(a, a.maxHp, h);
      // Faery Ward / Tidal Ward: every living hero also gets a shield worth part of the caster's HP.
      if (def.ult?.kind === 'teamShield') {
        const shield = h.maxHp.times(plus ? def.ult.plusShare : def.ult.share);
        for (const a of this.heroes) {
          if (!a.alive) continue;
          a.shield = Decimal.max(a.shield, shield);
          this.drawHpBar(a);
        }
      }
      if (def.ult?.kind === 'revive') {
        const fallen = this.heroes.filter((a) => !a.alive);
        for (const a of plus ? fallen : fallen.slice(0, 1)) {
          this.reviveHero(a, Math.max(PLAYER_CRYSTAL_X + 20, h.x - REVIVE_BEHIND), REVIVE_HP);
          this.puff(a.x, a.y, 0xfff6a0);
        }
      }
      this.cameras.main.flash(200, 255, 245, 180);
      return true;
    }
    const ult = def.ult;
    const dmg = h.atk.times(ULT_MULTIPLIER * (plus && !ult ? ULT_STAR_BONUS : 1) * (1 + (h.stats?.ultAtk ?? 0)) * this.state.boostMult('horn'));
    if (ult?.kind === 'strike') {
      // Heat Strike: one blow on the toughest enemy in reach, no area.
      const target = this.enemies.filter((e) => e.alive && e.x >= h.x - 30 && e.x <= h.x + 260).sort((a, b) => b.hp.cmp(a.hp))[0];
      if (target) {
        h.x = Math.max(h.x, target.x - 20);
        h.view.x = h.x;
        this.sparks(target.x, target.y - 6, color, 10);
        this.cameras.main.shake(200, 0.012);
        this.damageUnit(target, dmg.times((plus ? ult.plusMult : ult.mult) * this.elem(this.dealsAs(h), target)), h, true);
      }
      return true;
    }
    if (ult?.kind === 'crescent') {
      // A crescent wave down the whole lane: everything ahead takes `lane` of the hit, bosses `mult` of it.
      const wave = this.add.rectangle(h.x + 20, h.y, 14, 60, color, 0.6).setDepth(999);
      this.tweens.add({ targets: wave, x: ENEMY_CRYSTAL_X, alpha: 0.15, duration: 420, onComplete: () => wave.destroy() });
      this.cameras.main.shake(300, 0.015);
      for (const e of this.enemies.filter((e) => e.alive && e.x >= h.x - 30)) {
        this.damageUnit(e, dmg.times(this.elem(this.dealsAs(h), e) * (e.isBoss ? (plus ? ult.plusMult : ult.mult) : ult.lane)), h, e.isBoss);
      }
      if (!this.bossAlive()) this.damageCrystal(dmg, h);
      return true;
    }
    const radius = 170;
    const ring = this.add.circle(h.x + 60, h.y, 10, color, 0.45).setDepth(999);
    this.tweens.add({ targets: ring, radius, alpha: 0, duration: 380, onComplete: () => ring.destroy() });
    this.cameras.main.shake(300, 0.015);
    this.cameras.main.flash(120, 255, 255, 255);
    // Heroes built to the hero standard get their own 5★ twist instead of the bigger hit.
    const x0 = h.x - 30, x1 = h.x + radius + 60;
    const hit = this.enemies.filter((e) => e.alive && e.x >= x0 && e.x <= x1);
    // Marks land before the hit so the Volley itself benefits.
    if (ult?.kind === 'mark') {
      for (const e of hit) {
        e.markMult = plus ? ult.plusMult : ult.mult;
        e.markUntil = this.clock + (plus ? ult.plusSeconds : ult.seconds);
        this.floatText(e.x, e.y - 40, 'MARKED', '#c9b8ff', 9);
      }
    }
    for (const e of hit) this.damageUnit(e, dmg.times(this.elem(this.dealsAs(h), e)), h);
    if (!this.bossAlive() && ENEMY_CRYSTAL_X - h.x <= radius + 60) this.damageCrystal(dmg, h);
    if (ult) this.ultExtras(h, ult, hit, plus, x0, x1, dmg);
    return true;
  }

  /** What a hero-standard Ultimate does after the hit. */
  private ultExtras(h: Unit, ult: NonNullable<HeroDef['ult']>, hit: Unit[], plus: boolean, x0: number, x1: number, dmg: Decimal) {
    const living = hit.filter((e) => e.alive);
    switch (ult.kind) {
      case 'washback':
        for (const e of living) {
          if (e.isBoss) continue;
          e.x = Math.min(e.x + ult.push, ENEMY_CRYSTAL_X - 12);
          this.tweens.add({ targets: e.view, x: e.x, duration: 260, ease: 'Quad.out' });
        }
        if (plus) {
          for (const a of this.heroes) {
            a.hasteMult = ult.haste;
            a.hasteUntil = this.clock + ult.hasteSeconds;
          }
        }
        break;
      case 'meteor': {
        const view = this.add.rectangle((x0 + x1) / 2, LANE_BOTTOM - 20, x1 - x0, LANE_BOTTOM - LANE_TOP + 20, 0xff6a2a, 0.28).setDepth(1);
        this.zones.push({ x0, x1, until: this.clock + ult.seconds, dps: h.atk.times(ult.groundDps), by: h, view });
        if (plus) {
          this.time.delayedCall(600 / this.speedMultiplier(), () => {
            if (this.transitioning) return;
            this.cameras.main.shake(200, 0.01);
            for (const e of this.enemies) if (e.alive && e.x >= x0 && e.x <= x1) this.damageUnit(e, dmg.times(ult.second * this.elem(h.element, e)), h);
          });
        }
        break;
      }
      case 'weaken':
        for (const e of living) {
          e.weakMult = ult.mult;
          e.weakUntil = this.clock + (plus ? ult.plusSeconds : ult.seconds);
          this.floatText(e.x, e.y - 40, 'WEAKENED', '#9fdcff', 9);
        }
        break;
      case 'earthen':
        this.earthenUntil = this.clock + (plus ? ult.plusSeconds : ult.seconds);
        this.banner('FOREST STRENGTH', '#9be07a');
        break;
      case 'root':
        for (const e of living) {
          if (this.control(e, ult.seconds, ult.bossSeconds)) this.floatText(e.x, e.y - 40, 'ROOTED', '#9be07a', 9);
        }
        if (plus) {
          for (const a of this.heroes) {
            if (!a.alive) continue;
            a.shield = Decimal.max(a.shield, a.maxHp.times(ult.shield));
            this.drawHpBar(a);
          }
        }
        break;
      case 'bounce':
        for (const e of living) {
          if (this.control(e, plus ? ult.plusSeconds : ult.seconds)) this.floatText(e.x, e.y - 40, 'STUN', '#ffd84a', 9);
        }
        break;
      case 'sanctuary': {
        const alive = this.heroes.filter((a) => a.alive);
        const safe = plus ? alive : alive.sort((a, b) => this.hpRatio(a) - this.hpRatio(b)).slice(0, 1);
        for (const a of safe) {
          a.guardUntil = this.clock + (plus ? ult.plusSeconds : ult.seconds);
          this.floatText(a.x, a.y - 34, 'SANCTUARY', '#fff1a8', 10);
          this.puff(a.x, a.y, 0xfff6a0);
        }
        break;
      }
      case 'hydro':
        for (const e of living) {
          if (!e.isBoss) {
            e.x = Math.min(e.x + ult.push, ENEMY_CRYSTAL_X - 12);
            this.tweens.add({ targets: e.view, x: e.x, duration: 260, ease: 'Quad.out' });
          }
          e.slowMult = ult.slow;
          e.slowUntil = this.clock + (plus ? ult.plusSeconds : ult.seconds);
          this.floatText(e.x, e.y - 40, 'SOAKED', '#9fdcff', 9);
        }
        break;
      case 'tempest': {
        const pulled = living.filter((e) => !e.isBoss);
        if (!pulled.length) break;
        const mid = pulled.reduce((sum, e) => sum + e.x, 0) / pulled.length;
        for (const e of pulled) {
          e.x = mid + (e.x - mid) * 0.2;
          this.tweens.add({ targets: e.view, x: e.x, duration: 300, ease: 'Quad.in' });
          if (this.control(e, plus ? ult.plusSeconds : ult.seconds)) this.floatText(e.x, e.y - 40, 'CAUGHT', '#b5e48c', 9);
        }
        break;
      }
      default:
        break;
    }
  }

  /** Share of max HP a unit has left. */
  private hpRatio(u: Unit): number {
    return u.maxHp.gt(0) ? u.hp.div(u.maxHp).toNumber() : 0;
  }

  private tryAutoUlt(h: Unit) {
    if (!h.alive || !h.def) return;
    const s = this.getUltState(h.def.id);
    if (!s.slotted || !s.unlocked || s.remaining > 0) return;
    if (h.def.heals) {
      const revives = h.def.ult?.kind === 'revive' && this.heroes.some((a) => !a.alive);
      if (revives || this.heroes.some((a) => a.alive && a.hp.lt(a.maxHp.times(0.4)))) this.triggerUlt(h.def.id);
      return;
    }
    const inReach = this.enemies.filter((e) => e.alive && e.x >= h.x - 30 && e.x <= h.x + 200);
    if (inReach.some((e) => e.isBoss) || inReach.length >= 3) this.triggerUlt(h.def.id);
  }

  // ---------- chests ----------

  /** Remove every floating chest, unclaimed, when a Trial or Colosseum fight takes over the lane. */
  private clearChests() {
    for (const c of this.chests) {
      this.tweens.killTweensOf(c);
      c.destroy();
    }
    this.chests = [];
  }

  private updateChests(dt: number) {
    this.chestTimer -= dt;
    if (this.chestTimer > 0) return;
    this.chestTimer = Phaser.Math.Between(25, 45);
    const total = CHESTS.reduce((s, c) => s + c.weight, 0);
    let roll = Math.random() * total;
    const kind = CHESTS.find((c) => (roll -= c.weight) < 0) ?? CHESTS[0];
    const y = Phaser.Math.Between(70, 130);
    const chest = this.add.image(WIDTH + 20, y, kind.key).setScale(1.5).setDepth(900).setScrollFactor(0).setInteractive({ useHandCursor: true });
    // Destroying an object doesn't stop its tweens, and the bob loops forever, so both are killed with the chest.
    const remove = () => {
      this.tweens.killTweensOf(chest);
      chest.destroy();
      this.chests = this.chests.filter((c) => c !== chest);
    };
    this.chests.push(chest);
    this.tweens.add({ targets: chest, x: -30, duration: 11000, onComplete: remove });
    this.tweens.add({ targets: chest, y: y - 8, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    chest.once('pointerdown', () => {
      if (!chestsAllowed(laneMode({ trial: this.trial, pvp: this.pvp }))) return remove();
      const gold = goldPerKill(this.state.stage).times(kind.killsWorth).times(1 + this.state.relicBonus('gold')).times(1 + this.state.researchBonus('prosperity')).times(this.state.goldBoostMult());
      const wx = chest.x + this.cameras.main.scrollX;
      this.gainGold(gold, wx, chest.y + 10);
      this.shatter(wx, chest.y, 0xffe066);
      this.flyCoins(wx, chest.y, kind.killsWorth >= 15 ? 10 : 5);
      play('chest');
      this.state.track('chests');
      if (kind.key === 'chest-gold') {
        this.state.gems += 5;
        this.floatText(wx, chest.y - 12, '+5 Gems', '#7fe3ff', 14);
      }
      remove();
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

  /** Damage and gold numbers are reused: each Phaser Text owns a canvas texture, so making one per hit stutters phones. */
  private textPool: Phaser.GameObjects.Text[] = [];
  private textsShown = 0;

  private floatText(x: number, y: number, text: string, color: string, size = 11) {
    // In a big splash fight, small numbers past this many on screen are just noise.
    if (size <= 12 && this.textsShown >= 40) return;
    const style = { fontFamily: 'monospace', fontSize: `${size}px`, fontStyle: 'bold', color, stroke: '#000', strokeThickness: size > 12 ? 4 : 3 };
    const t = this.textPool.pop()?.setStyle(style).setText(text).setPosition(x, y).setAlpha(1).setScale(1).setVisible(true) ?? this.add.text(x, y, text, style).setOrigin(0.5).setDepth(990);
    this.textsShown++;
    if (size > 12) {
      t.setScale(0.4);
      this.tweens.add({ targets: t, scale: 1, duration: 140, ease: 'Back.out' });
    }
    this.tweens.add({
      targets: t,
      y: y - 26,
      alpha: 0,
      delay: 250,
      duration: 650,
      onComplete: () => {
        t.setVisible(false);
        this.textsShown--;
        this.textPool.push(t);
      },
    });
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
      const c = this.add.image(x, y, 'coin').setDepth(995);
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
    // A previous banner's fade would otherwise keep running and hide this one.
    this.tweens.killTweensOf(this.bannerText);
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
    if (this.trial) {
      this.drawTrialHud(this.trial);
      return;
    }
    if (this.pvp) {
      this.drawPvpHud(this.pvp);
      return;
    }
    const stage = this.state.stage;
    const boss = isBossStage(stage);
    this.stageText.setText(`Stage ${stage}${boss ? ' · BOSS' : this.state.autoAdvance ? '' : ' · Farming'}`);

    const ratio = this.crystal.maxHp.gt(0) ? Math.max(0, this.crystal.hp.div(this.crystal.maxHp).toNumber()) : 0;
    this.crystalBar.clear();
    this.crystalBar.fillStyle(0x000000, 0.7).fillRect(ENEMY_CRYSTAL_X - 22, CRYSTAL_Y - 48, 44, 6);
    this.crystalBar.fillStyle(0xd04a8a, 1).fillRect(ENEMY_CRYSTAL_X - 21, CRYSTAL_Y - 47, 42 * ratio, 4);

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

  /** Trial HUD: the boss and level at the top left, with the time left under it. */
  private drawTrialHud(t: TrialFight) {
    this.stageText.setText(`Trial Lv ${t.tier} · ${Math.ceil(Math.max(0, t.timeLeft))}s`);
    this.crystalBar.clear();
    // Lane progress from the blue crystal to the boss at the far end.
    const px = WIDTH - 150;
    const pw = 140;
    const toBar = (ux: number) => px + (pw * (ux - PLAYER_CRYSTAL_X)) / (TRIAL_BOSS_X - PLAYER_CRYSTAL_X);
    const pb = this.progressBar;
    pb.clear();
    pb.fillStyle(0x000000, 0.55).fillRoundedRect(px - 6, 8, pw + 12, 14, 7);
    pb.fillStyle(0xffffff, 0.35).fillRect(px, 14, pw, 2);
    pb.fillStyle(0x6fd3ff, 1).fillRect(px - 2, 11, 4, 8);
    pb.fillStyle(ELEMENT_COLORS[t.element], 1).fillCircle(px + pw, 15, 5);
    for (const h of this.heroes) if (h.alive) pb.fillStyle(ELEMENT_COLORS[h.element], 1).fillCircle(toBar(h.x), 15, 3);
    const w = 150;
    const x = 10;
    this.bossBar.clear();
    this.bossBar.fillStyle(0x000000, 0.7).fillRect(x - 2, 52, w + 4, 10);
    this.bossBar.fillStyle(t.timeLeft < 10 ? 0xff4c4c : 0xffb84c, 1).fillRect(x, 54, w * Math.max(0, t.timeLeft / TRIAL_TIME), 6);
  }

  /** Colosseum HUD: time left at the top left and an HP bar over each crystal. */
  private drawPvpHud(p: PvpLive) {
    this.stageText.setText(`Colosseum · ${Math.ceil(Math.max(0, p.timeLeft))}s`);
    this.progressBar.clear();
    this.bossBar.clear();
    const bar = (x: number, c: { hp: Decimal; max: Decimal }, color: number) => {
      const ratio = c.max.gt(0) ? Math.max(0, c.hp.div(c.max).toNumber()) : 0;
      this.crystalBar.fillStyle(0x000000, 0.7).fillRect(x - 22, CRYSTAL_Y - 48, 44, 6);
      this.crystalBar.fillStyle(color, 1).fillRect(x - 21, CRYSTAL_Y - 47, 42 * ratio, 4);
    };
    this.crystalBar.clear();
    bar(PLAYER_CRYSTAL_X, p.mine, 0x4cb8ff);
    bar(ENEMY_CRYSTAL_X, p.theirs, 0xd04a8a);
    // Both crystals' HP side by side under the timer, so the race reads at a glance.
    const w = 150;
    const x = 10;
    const share = (c: { hp: Decimal; max: Decimal }) => (c.max.gt(0) ? Math.max(0, c.hp.div(c.max).toNumber()) : 0);
    this.bossBar.fillStyle(0x000000, 0.7).fillRect(x - 2, 34, w + 4, 22);
    this.bossBar.fillStyle(0x4cb8ff, 1).fillRect(x, 36, w * share(p.mine), 8);
    this.bossBar.fillStyle(0xd04a8a, 1).fillRect(x, 46, w * share(p.theirs), 8);
  }
}
