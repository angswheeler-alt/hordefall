import { VS, ULT, HEAL_BASIC } from './heroText';
import { ROSTER_HEROES } from './heroes';

export type Element = 'water' | 'fire' | 'earth' | 'light' | 'dark';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
const RARITY_RANK: Record<Rarity, number> = { common: 0, rare: 1, epic: 2, legendary: 3 };

/** Heroes ordered Common, Rare, Epic, Legendary; heroes of the same rarity keep their order. */
export function byRarity<T extends { rarity: Rarity }>(heroes: readonly T[]): T[] {
  return [...heroes].sort((a, b) => RARITY_RANK[a.rarity] - RARITY_RANK[b.rarity]);
}
/**
 * The hero standard (design/base-heroes.md): every hero has one of ten Types, the combat archetype
 * that sets how it attacks, where it stands and its stat shape (many heroes share a Type), plus a
 * Signature passive of their own (on from 1★) and an Ultimate that does something only they do, with a
 * 5★ twist. Heroes not yet rebuilt to the standard leave the Signature and Ultimate effect out.
 */
export type HeroType =
  | 'Ranger' | 'Gunner' | 'Magician' | 'Knight' | 'Barbarian'
  | 'Rogue' | 'Lancer' | 'Samurai' | 'Brawler' | 'Support';
export const HERO_TYPES: Record<HeroType, string> = {
  Ranger: 'Ranged damage: shoots arrows from behind the front line.',
  Gunner: 'Ranged damage: firearms with heavy, piercing or explosive shots.',
  Magician: 'Magic damage: spells that splash a small area.',
  Knight: 'Defensive melee: armoured front line that starts each life with a shield.',
  Barbarian: 'Heavy melee: brute force, big hits and Frenzy.',
  Rogue: 'Agile damage: fast, evasive, lots of crits.',
  Lancer: 'Reach melee: a spear that strikes from a step further back.',
  Samurai: 'Precision melee: focused single-target strikes and huge crits.',
  Brawler: 'Close combat: tough fists, combos and stuns.',
  Support: 'Team utility: heals the team and rallies it (whole team deals 15% more damage).',
};
/** Every Support in the lineup gives the whole team this, from 1★, so a healer is worth a lineup slot. */
export const SUPPORT_RALLY: Effect = { kind: 'atk', value: 1.15, team: true };

/** Signature passives. Numbers are fractions or multipliers. */
export type Signature =
  /** Each hit in a row on the same enemy adds perHit damage, up to max. */
  | { kind: 'combo'; perHit: number; max: number }
  /** Hits set enemies Burning for `share` of the hit's damage per second, for `seconds`. */
  | { kind: 'burn'; share: number; seconds: number }
  /** Reflects this share of damage taken (adds to reflect star skills). */
  | { kind: 'reflect'; value: number }
  /** Healing past full HP becomes a shield, up to `cap` of the ally's max HP. */
  | { kind: 'overheal'; cap: number }
  /** `mult` damage to enemies below `below` of their max HP. */
  | { kind: 'execute'; below: number; mult: number }
  /** Hits have `chance` to slow the enemy (moves and attacks at `mult` speed) for `seconds`. */
  | { kind: 'slow'; chance: number; mult: number; seconds: number }
  /** Hits on an enemy at full HP always crit. */
  | { kind: 'sureCrit' }
  /** Hits on flying enemies always crit. */
  | { kind: 'skyCrit' }
  /** Hits push regular enemies `push` px back. */
  | { kind: 'knockback'; push: number }
  /** When this hero falls, the enemy that did it is frozen for `seconds` and takes `mult` damage meanwhile. */
  | { kind: 'curse'; seconds: number; mult: number }
  // Ascendant heroes' own Signatures (src/heroes/ascendant.ts); the 6★ twist is the plus field.
  /** Once per life, when HP drops below `below`: heals `heal` of max HP and attacks at `haste` cooldown for `seconds` (6★: plusSeconds). */
  | { kind: 'mask'; below: number; heal: number; haste: number; seconds: number; plusSeconds: number }
  /** Every `every`th attack is `hits` quick blows of `mult` damage each (6★: plusHits blows). */
  | { kind: 'barrage'; every: number; hits: number; plusHits: number; mult: number }
  /** Each attack in a row adds `perStack` attack speed, up to `max` stacks (6★: plusMax); from `waveAt` stacks attacks also hit enemies within `wave` px. */
  | { kind: 'zeal'; perStack: number; max: number; plusMax: number; waveAt: number; wave: number }
  /** Below `below` of max HP (6★: plusBelow): deals `dmg` damage and takes `guard` damage. */
  | { kind: 'torrent'; below: number; plusBelow: number; dmg: number; guard: number }
  /** Every `every`th attack the hero's spirit also hits `targets` other enemies in reach for `mult` damage (6★: plusTargets). */
  | { kind: 'spirit'; every: number; targets: number; plusTargets: number; mult: number };

/** What a standard hero's Ultimate does on top of the big hit (or full heal), and its 5★ twist. */
export type UltEffect =
  /** Washes regular enemies `push` px back. 5★: team attacks faster (cooldown x haste) for hasteSeconds. */
  | { kind: 'washback'; push: number; haste: number; hasteSeconds: number }
  /** Leaves burning ground for `seconds` (groundDps x ATK per second). 5★: a second meteor for `second` of the damage. */
  | { kind: 'meteor'; seconds: number; groundDps: number; second: number }
  /** Roots enemies (bosses for bossSeconds). 5★: shields every hero for `shield` of max HP. */
  | { kind: 'root'; seconds: number; bossSeconds: number; shield: number }
  /** Brings back one fallen hero; 5★ brings back all of them. */
  | { kind: 'revive' }
  /** Marked enemies take `mult` damage for `seconds`. 5★: plusMult for plusSeconds. */
  | { kind: 'mark'; mult: number; seconds: number; plusMult: number; plusSeconds: number }
  /** One blow on the toughest enemy in reach for `mult` x the Ultimate hit (no area). 5★: plusMult. */
  | { kind: 'strike'; mult: number; plusMult: number }
  /** After the hit, every non-Fire hero deals Earth damage for `seconds` (5★: plusSeconds). */
  | { kind: 'earthen'; seconds: number; plusSeconds: number }
  /** Healers: on top of the full heal, shields every living hero for `share` of the caster's max HP (5★: plusShare). */
  | { kind: 'teamShield'; share: number; plusShare: number }
  /** Enemies hit deal `mult` damage for `seconds` (5★: plusSeconds). */
  | { kind: 'weaken'; mult: number; seconds: number; plusSeconds: number }
  // Ascendant heroes' own Ultimates.
  /** A wave down the whole lane: every enemy ahead takes the hit, bosses `mult` x it (5★: plusMult). */
  | { kind: 'crescent'; mult: number; plusMult: number }
  /** Stuns every enemy hit for `seconds` (bosses half as long; 5★: plusSeconds). */
  | { kind: 'bounce'; seconds: number; plusSeconds: number }
  /** The most injured hero takes no damage for `seconds` (5★: the whole team, plusSeconds). */
  | { kind: 'sanctuary'; seconds: number; plusSeconds: number }
  /** Pushes regular enemies `push` px back and soaks every enemy hit: `slow` speed for `seconds` (5★: plusSeconds). */
  | { kind: 'hydro'; push: number; slow: number; seconds: number; plusSeconds: number }
  /** Pulls regular enemies hit together at the middle of the blast and holds them for `seconds` (5★: plusSeconds). */
  | { kind: 'tempest'; seconds: number; plusSeconds: number };

export interface HeroDef {
  id: string;
  name: string;
  element: Element;
  rarity: Rarity;
  /** Combat archetype: sets the stat shape and the Knight shield (see HERO_TYPES). */
  type: HeroType;
  /** The Signature's mechanics; its name and text are `trait`. */
  signature?: Signature;
  /** The Ultimate's own effect and the 5★ twist's text. */
  ult?: UltEffect;
  ultPlus?: string;
  /** The 6★ Signature+ twist's text (mechanics in BattleScene, by Signature kind). */
  sigPlus?: string;
  /** Boss blows never stun this hero. */
  steadfast?: boolean;
  /** Flies (wings, or a ghost drifting on mist): moves in the sky above the walking heroes. Looks only; combat is the same. */
  flying?: boolean;
  /** A squad: this many small fighters share the slot, each with 1/squad of the ATK and HP. */
  squad?: number;
  /** Attack and HP at gold level 1. */
  baseAtk: number;
  baseHp: number;
  /** Defense at level 1; defaults to a small share of baseHp (DEF_PER_HP). */
  baseDef?: number;
  /** Attack reach in pixels. */
  range: number;
  /** Seconds between attacks. */
  attackCooldown: number;
  /** Pixels per second. */
  moveSpeed: number;
  /** Gold to recruit the hero (0 = starts unlocked). */
  unlockCost: number;
  /** Gold cost of level 1 -> 2. */
  upgradeBaseCost: number;
  /** Gold multiplier on kills (Rogues earn 2x). */
  goldMult: number;
  /** Ranged attacks splash enemies within this radius. */
  splash?: number;
  heals?: boolean;
  /** Hero page copy. */
  bio: string;
  basic: Ability;
  ultimate: Ability;
  trait: Ability;
  /** Unlocked by evolving with Hero Crests: SP1 at 2★, SP2 at 3★, the Aura at 4★. */
  sp1: Ability;
  sp2: Ability;
  aura: Ability;
}

export interface Ability {
  name: string;
  text: string;
  /** What a star skill does in battle (SP1, SP2 and Aura). See skills.ts. */
  effect?: Effect;
}

/**
 * Star-skill effects. Chances and fractions add up (crit, dodge, doubleStrike, reflect, regen, lifesteal,
 * pierce); multipliers multiply (atk, hp, damageTaken, attackSpeed = cooldown, splash, bossDamage, gold,
 * healPower, respawn = respawn time, vsBurning = damage to Burning enemies, beacon = ATK of the ally a
 * healer heals, for 4 s). everyNth multiplies every `every`th attack by `value`. burnBurst: a Burning
 * enemy that dies explodes for `value` x the burner's ATK.
 * team: true applies to the whole lineup; otherwise only the hero who owns it.
 */
export type EffectKind =
  | 'atk' | 'hp' | 'crit' | 'dodge' | 'doubleStrike' | 'reflect' | 'regen' | 'lifesteal' | 'pierce'
  | 'damageTaken' | 'attackSpeed' | 'splash' | 'bossDamage' | 'gold' | 'healPower' | 'respawn' | 'everyNth'
  | 'vsBurning' | 'burnBurst' | 'beacon'
  // def multiplies Defense; critDmg adds to crit damage (0.2 = +20%); slam: every `every`th attack also hits enemies near the target, x value.
  | 'def' | 'critDmg' | 'slam'
  // ward: every `every`th heal or attack shields a random ally for value x own max HP. snowball: every `every`th shot
  // also hits enemies just behind the target and they take value x damage for 4 s. assassinate: every `every`th attack
  // blinks to the farthest enemy in reach for value x damage. enemyHaste: multiplies how fast enemies attack.
  | 'ward' | 'snowball' | 'assassinate' | 'enemyHaste'
  // charm: every `every`th attack turns a regular enemy against its own side for value seconds. blind: every
  // `every`th attack blinds enemies near the target (they miss value of their attacks for 3 s).
  // enemyVuln: multiplies damage enemies take. moveSpeed: multiplies how fast heroes walk.
  | 'charm' | 'blind' | 'enemyVuln' | 'moveSpeed'
  // Hero-sheet stats (for the hero stat page; chances are 0.05 = 5%).
  | 'frenzy' | 'effectRes' | 'stunChance' | 'freezeChance' | 'burnChance' | 'poisonChance' | 'ultAtk' | 'aoeDmg';

export interface Effect {
  kind: EffectKind;
  value: number;
  team?: boolean;
  every?: number;
  /** A team effect that reaches only heroes of this element (e.g. "Fire heroes +40% ATK"). */
  element?: Element;
}

export const ELEMENT_COLORS: Record<Element, number> = {
  water: 0x3fa9f5,
  fire: 0xf5603f,
  earth: 0x6cbf3a,
  light: 0xf5d63f,
  dark: 0x9b59d0,
};

// The first 20 heroes: four per element, Rare or Epic (Rook stays Common). Brine is the free starter.
// Brine, Ember, Thicket (id thorn), Lumen and Rook are built to the hero standard (Signature, unique Ultimate);
// Thorn and Blaze were renamed Thicket and Flare (names only; ids stay).
// Type baselines (each hero varies a little): Knight high-HP front line, Magician ranged splash,
// Ranger and Gunner long-range single target, Support healer, the other melee types quick and hard-hitting.
export const HEROES: HeroDef[] = [
  // ---- Fire: passion and destruction ----
  { id: 'blaze', rarity: 'rare', name: 'Flare', element: 'fire', type: 'Barbarian', baseAtk: 7.5, baseHp: 70, range: 30, attackCooldown: 1.3, moveSpeed: 105, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1, steadfast: true,
    bio: 'A hulking red wolf-beast with a flaming war axe he swings like it weighs nothing. Nothing pushes him back.',
    basic: { name: 'Axe Chop', text: 'Slow, crushing swings at the nearest enemy ahead.' },
    ultimate: { name: 'Inferno Axe', text: ULT('A giant axe of fire crashes down on') },
    trait: { name: 'Unmovable', text: `Boss blows never stun him. ${VS.fire}` },
    sp1: { name: 'Flurry of Blows', text: 'Every 4th attack is three quick blows (3x damage).', effect: { kind: 'everyNth', value: 3, every: 4 } },
    sp2: { name: 'Heavy Frame', text: '+20% HP.', effect: { kind: 'hp', value: 1.2 } },
    aura: { name: 'Forge Guard', text: 'Fire heroes get +40% Defense.', effect: { kind: 'def', value: 1.4, team: true, element: 'fire' } } },
  { id: 'ember', rarity: 'rare', name: 'Ember', element: 'fire', type: 'Magician', baseAtk: 8, baseHp: 40, range: 150, attackCooldown: 1.4, moveSpeed: 105, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1, splash: 40,
    bio: 'An energetic arcanist with flame-shaped hair ornaments and a fire orb she never puts down.',
    basic: { name: 'Fire Orb', text: 'Ranged fireballs that splash every enemy near the target.' },
    ultimate: { name: 'Meteor', text: `${ULT('A meteor crashes into')} Leaves burning ground for 5 seconds that burns anything walking through it.` },
    ult: { kind: 'meteor', seconds: 5, groundDps: 2, second: 0.5 },
    ultPlus: 'A second meteor lands a moment later for half damage.',
    sigPlus: 'Burning stacks: a second burn adds on top of the first, for up to double damage.',
    trait: { name: 'Kindling', text: `Her hits set enemies Burning: 20% of the hit's damage every second for 3 seconds. ${VS.fire}` },
    signature: { kind: 'burn', share: 0.2, seconds: 3 },
    sp1: { name: 'Wildfire', text: 'A Burning enemy that dies explodes for 2x ATK on enemies around it.', effect: { kind: 'burnBurst', value: 2 } },
    sp2: { name: 'Stoke the Flames', text: '+40% damage to Burning enemies.', effect: { kind: 'vsBurning', value: 1.4 } },
    aura: { name: 'Heat Shimmer', text: 'Team critical hit chance +5%.', effect: { kind: 'crit', value: 0.05, team: true } } },
  { id: 'flint', rarity: 'rare', name: 'Flint', element: 'fire', type: 'Rogue', baseAtk: 6, baseHp: 50, range: 24, attackCooldown: 0.6, moveSpeed: 170, unlockCost: 50, upgradeBaseCost: 15, goldMult: 2,
    ult: { kind: 'strike', mult: 3, plusMult: 4 },
    ultPlus: 'The strike hits for 160x ATK.',
    bio: 'A quick salamander in a red scarf, with twin daggers and a tail that never stops burning.',
    basic: { name: 'Twin Daggers', text: 'Very fast slashes at the closest enemy.' },
    ultimate: { name: 'Heat Strike', text: 'One blinding strike on the toughest enemy in reach for 120x ATK, with element bonuses.' },
    trait: { name: 'Flame Runner', text: `Dodges 10% of attacks and earns 2x gold from every kill. ${VS.fire}` },
    sp1: { name: 'Twin Tail Strike', text: '30% chance for each attack to strike twice.', effect: { kind: 'doubleStrike', value: 0.3 } },
    sp2: { name: 'Ember Edge', text: '+10% critical hit chance.', effect: { kind: 'crit', value: 0.1 } },
    aura: { name: 'Hot Blood', text: 'Fire heroes deal +20% critical damage.', effect: { kind: 'critDmg', value: 0.2, team: true, element: 'fire' } } },
  { id: 'cinder', rarity: 'rare', name: 'Cinder', element: 'fire', type: 'Brawler', baseAtk: 5.5, baseHp: 80, range: 26, attackCooldown: 1.0, moveSpeed: 120, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1, steadfast: true,
    signature: { kind: 'combo', perHit: 0.05, max: 0.3 },
    bio: 'A rust-red steam golem with a smoking stack and piston fists. It hits harder with every punch and never takes a step back.',
    basic: { name: 'Piston Punch', text: 'Heavy punches at the nearest enemy ahead.' },
    ultimate: { name: 'Magma Missiles', text: ULT('A rain of magma missiles hits') },
    trait: { name: 'Stoked Fists', text: `Each hit in a row on the same enemy deals +5% damage, up to +30%; the streak ends when it switches target. Boss blows never stun it. ${VS.fire}` },
    sp1: { name: 'Piston Slam', text: 'Every 4th attack slams the ground for 2x damage to every enemy near the target.', effect: { kind: 'slam', value: 2, every: 4 } },
    sp2: { name: 'Furnace Core', text: 'Takes 20% less damage.', effect: { kind: 'damageTaken', value: 0.8 } },
    aura: { name: 'Iron Works', text: 'Fire heroes get +40% Defense.', effect: { kind: 'def', value: 1.4, team: true, element: 'fire' } } },

  // ---- Earth (Grass): life and growth ----
  { id: 'briar', rarity: 'rare', name: 'Briar', element: 'earth', type: 'Ranger', baseAtk: 5.5, baseHp: 45, range: 185, attackCooldown: 0.9, moveSpeed: 115, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1,
    signature: { kind: 'sureCrit' },
    bio: 'A hooded fox archer in forest green who can put an arrow through a falling acorn.',
    basic: { name: 'Leaf Arrow', text: 'Long-range arrows at the nearest enemy.' },
    ultimate: { name: 'Arrow Storm', text: ULT('A storm of leaf arrows hits') },
    trait: { name: 'Hawkeye', text: `Shots at an enemy at full HP always crit. ${VS.earth}` },
    sp1: { name: 'Multi Shot', text: 'Each shot also hits the next 2 enemies just behind the target.', effect: { kind: 'pierce', value: 2 } },
    sp2: { name: 'Quickdraw', text: 'Attacks 20% faster.', effect: { kind: 'attackSpeed', value: 0.8 } },
    aura: { name: "Hunter's Eye", text: 'Earth heroes deal +20% critical damage.', effect: { kind: 'critDmg', value: 0.2, team: true, element: 'earth' } } },
  { id: 'fern', rarity: 'epic', name: 'Fern', element: 'earth', type: 'Support', flying: true, baseAtk: 3, baseHp: 55, range: 130, attackCooldown: 1.2, moveSpeed: 105, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1, heals: true,
    ult: { kind: 'teamShield', share: 1, plusShare: 1.5 },
    ultPlus: 'Shields are worth 150% of her max HP.',
    bio: 'A tiny forest faery in a leaf cap and leaf dress, whose sprouting wand mends wounds.',
    basic: { name: 'Sap Mend', text: HEAL_BASIC },
    ultimate: { name: 'Faery Ward', text: "Fully heals every living hero and shields each one for 100% of Fern's max HP." },
    trait: { name: 'Sylvan Healer', text: `Keeps the team standing. ${VS.earth}` },
    sp1: { name: 'Faery Shield', text: 'Every 3rd heal or attack also shields a random ally for 40% of her max HP.', effect: { kind: 'ward', value: 0.4, every: 3 } },
    sp2: { name: 'Green Touch', text: 'Heals are 50% stronger.', effect: { kind: 'healPower', value: 1.5 } },
    aura: { name: 'Wild Vigor', text: 'Whole team +15% HP.', effect: { kind: 'hp', value: 1.15, team: true } } },
  { id: 'thorn', rarity: 'epic', name: 'Thicket', element: 'earth', type: 'Knight', baseAtk: 3.5, baseHp: 150, range: 34, attackCooldown: 1.0, moveSpeed: 100, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1,
    bio: 'A sturdy thorn sentinel in bark armor. His thorn spear gives him a little more reach than other knights.',
    basic: { name: 'Thorn Thrust', text: 'Heavy spear thrusts with a little extra reach that shove enemies back.' },
    ultimate: { name: 'Bramble Wall', text: `${ULT('Thorns burst from the ground under')} Roots them in place for 3 seconds (bosses for 1).` },
    ult: { kind: 'root', seconds: 3, bossSeconds: 1, shield: 0.2 },
    ultPlus: 'The wall also shields every hero for 20% of their max HP.',
    sigPlus: 'Each reflected hit has a 10% chance to stun the attacker for 1 second.',
    trait: { name: 'Bramble Hide', text: `High HP and a longer reach. Reflects 20% of damage taken back at the attacker. ${VS.earth}` },
    signature: { kind: 'reflect', value: 0.2 },
    sp1: { name: 'Taproot', text: 'Regenerates 2% of max HP every second.', effect: { kind: 'regen', value: 0.02 } },
    sp2: { name: 'Thornmail', text: 'Bramble Hide reflects 50% instead of 20%.', effect: { kind: 'reflect', value: 0.3 } },
    aura: { name: 'Old Growth', text: 'Team max HP +20%.', effect: { kind: 'hp', value: 1.2, team: true } } },
  { id: 'moss', rarity: 'rare', name: 'Moss', element: 'earth', type: 'Magician', baseAtk: 7, baseHp: 55, range: 140, attackCooldown: 1.5, moveSpeed: 100, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1, splash: 48,
    signature: { kind: 'slow', chance: 0.3, mult: 0.6, seconds: 2 },
    ult: { kind: 'earthen', seconds: 8, plusSeconds: 15 },
    ultPlus: 'Earth damage lasts 15 s.',
    bio: 'An old mushroom spirit draped in moss, whose staff is crowned with a seed that glows when something nearby is growing.',
    basic: { name: 'Spore Burst', text: 'Ranged spore clouds that splash every enemy near the target.' },
    ultimate: { name: 'Rootcall', text: 'Giant roots hit every enemy ahead for 40x ATK. Then for 8 s every hero except Fire heroes deals Earth damage.' },
    trait: { name: 'Sticky Spores', text: `Hits have a 30% chance to slow enemies to 60% speed for 2 s. ${VS.earth}` },
    sp1: { name: 'Spore Cloud', text: 'Every 4th attack is a bee swarm: 2x damage, and it slows every enemy it hits.', effect: { kind: 'everyNth', value: 2, every: 4 } },
    sp2: { name: 'Deep Roots', text: 'Deals 30% more damage to bosses.', effect: { kind: 'bossDamage', value: 1.3 } },
    aura: { name: 'Forest Might', text: 'Earth heroes get +40% ATK.', effect: { kind: 'atk', value: 1.4, team: true, element: 'earth' } } },

  // ---- Water: adaptability and wisdom ----
  { id: 'brine', rarity: 'rare', name: 'Brine', element: 'water', type: 'Samurai', baseAtk: 5, baseHp: 65, range: 28, attackCooldown: 0.8, moveSpeed: 120, unlockCost: 0, upgradeBaseCost: 5, goldMult: 1,
    bio: 'A young tidecoast sailor with a cutlass and a sea-blue scarf, sworn to bring the Lantern Queen home. The reason every early boss goes down.',
    basic: { name: 'Cutlass Slash', text: 'Fast cutlass slashes at the nearest enemy ahead.' },
    ultimate: { name: 'Rogue Wave', text: `${ULT('A crashing wave hits')} Washes regular enemies far back.` },
    ult: { kind: 'washback', push: 160, haste: 0.7, hasteSeconds: 5 },
    ultPlus: 'The wave leaves the team attacking 30% faster for 5 seconds.',
    sigPlus: 'After a kill, half the combo carries over to the next enemy.',
    trait: { name: 'Riptide Combo', text: `Each hit in a row on the same enemy deals 10% more, up to +50%. ${VS.water} Every boss before stage 600 is Fire, so Brine carries boss fights.` },
    signature: { kind: 'combo', perHit: 0.1, max: 0.5 },
    sp1: { name: 'Undertow', text: '20% chance for each attack to strike twice.', effect: { kind: 'doubleStrike', value: 0.2 } },
    sp2: { name: 'Salt Spray', text: '+15% critical hit chance.', effect: { kind: 'crit', value: 0.15 } },
    aura: { name: 'Fair Winds', text: 'Whole team attacks 10% faster.', effect: { kind: 'attackSpeed', value: 0.9, team: true } } },
  { id: 'brook', rarity: 'rare', name: 'Brook', element: 'water', type: 'Support', baseAtk: 2.8, baseHp: 60, range: 140, attackCooldown: 1.2, moveSpeed: 105, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1, heals: true,
    signature: { kind: 'knockback', push: 30 },
    ult: { kind: 'teamShield', share: 1, plusShare: 1.5 },
    ultPlus: 'Shields are worth 150% of her max HP.',
    bio: 'A calm water spirit in a white dress who heals with orbs of living water.',
    basic: { name: 'Clear Spring', text: HEAL_BASIC },
    ultimate: { name: 'Tidal Ward', text: "Fully heals every living hero and shields each one for 100% of Brook's max HP." },
    trait: { name: 'Wave Cleric', text: `Keeps the team standing; her water bolts push enemies back. ${VS.water}` },
    sp1: { name: 'Little Wave', text: 'Every 4th attack is a small wave: 2x damage to every enemy near the target, pushing them back.', effect: { kind: 'slam', value: 2, every: 4 } },
    sp2: { name: 'Still Waters', text: 'Takes 25% less damage.', effect: { kind: 'damageTaken', value: 0.75 } },
    aura: { name: 'Spring Blessing', text: 'Water heroes +15% HP.', effect: { kind: 'hp', value: 1.15, team: true, element: 'water' } } },
  { id: 'ripple', rarity: 'rare', name: 'Ripple', element: 'water', type: 'Ranger', baseAtk: 6, baseHp: 44, range: 175, attackCooldown: 1.0, moveSpeed: 115, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1,
    signature: { kind: 'curse', seconds: 4, mult: 1.5 },
    ult: { kind: 'weaken', mult: 0.5, seconds: 6, plusSeconds: 10 },
    ultPlus: 'Enemies stay weakened for 10 s.',
    bio: 'A cheerful snowman archer in a knit cap and scarf. Nobody knows who built it, or why it can shoot.',
    basic: { name: 'Icicle Arrow', text: 'Long-range arrows at the nearest enemy.' },
    ultimate: { name: 'Snowdrift', text: 'Snow crashes on every enemy ahead for 40x ATK, and for 6 s they deal half damage.' },
    trait: { name: 'Frost Curse', text: `When Ripple melts, the enemy that felled it freezes for 4 s and takes 50% more damage. ${VS.water}` },
    sp1: { name: 'Rolling Snowball', text: 'Every 4th shot rolls a snowball through the enemies just behind the target; everyone hit takes 25% more damage for 4 s.', effect: { kind: 'snowball', value: 1.25, every: 4 } },
    sp2: { name: 'Cold Aim', text: '+20% critical hit chance.', effect: { kind: 'crit', value: 0.2 } },
    aura: { name: 'Snow Fury', text: 'Water heroes +40% ATK.', effect: { kind: 'atk', value: 1.4, team: true, element: 'water' } } },
  { id: 'marina', rarity: 'rare', name: 'Marina', element: 'water', type: 'Magician', baseAtk: 8.5, baseHp: 45, range: 160, attackCooldown: 1.5, moveSpeed: 100, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1, splash: 36,
    bio: 'An octopus sea witch hung with pearls, who carries the sea in a single orb.',
    basic: { name: 'Water Orb', text: 'Ranged bursts of seawater that splash every enemy near the target.' },
    ultimate: { name: 'Ink Tide', text: ULT('A crushing downpour hits') },
    trait: { name: 'Sea Witch', text: `Area damage from far back. ${VS.water}` },
    sp1: { name: 'Eight-Arm Cast', text: '25% chance for each attack to cast twice.', effect: { kind: 'doubleStrike', value: 0.25 } },
    sp2: { name: 'Whirlpool', text: 'Splash radius +30%.', effect: { kind: 'splash', value: 1.3 } },
    aura: { name: "Ocean's Embrace", text: 'Water heroes +15% HP.', effect: { kind: 'hp', value: 1.15, team: true, element: 'water' } } },

  // ---- Dark: mystery and forbidden power ----
  { id: 'shade', rarity: 'epic', name: 'Shade', element: 'dark', type: 'Rogue', baseAtk: 6.5, baseHp: 46, range: 24, attackCooldown: 0.55, moveSpeed: 170, unlockCost: 50, upgradeBaseCost: 15, goldMult: 2,
    bio: 'A black cat ninja in a violet mask with twin daggers, in it for the loot and not pretending otherwise.',
    basic: { name: 'Twin Daggers', text: 'Very fast stabs at the closest enemy.' },
    ultimate: { name: 'Nine Lives', text: ULT('A storm of shadow shuriken hits') },
    trait: { name: 'Shadow Blade', text: `Dodges 10% of attacks and earns 2x gold from every kill. ${VS.dark}` },
    sp1: { name: 'Shadow Pounce', text: 'Every 5th attack blinks to the farthest enemy in reach (a boss first) and backstabs it for 3x damage.', effect: { kind: 'assassinate', value: 3, every: 5 } },
    sp2: { name: 'Backstab', text: '+10% critical hit chance.', effect: { kind: 'crit', value: 0.1 } },
    aura: { name: 'Dread Veil', text: 'Enemies attack 10% slower.', effect: { kind: 'enemyHaste', value: 0.9, team: true } } },
  { id: 'vex', rarity: 'rare', name: 'Vex', element: 'dark', type: 'Magician', baseAtk: 9, baseHp: 40, range: 150, attackCooldown: 1.5, moveSpeed: 100, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1, splash: 40,
    ult: { kind: 'weaken', mult: 0.5, seconds: 5, plusSeconds: 8 },
    ultPlus: 'Enemies stay weakened for 8 s.',
    bio: 'A hooded skeleton sorcerer channelling a violet orb that hums when nobody is looking at it.',
    basic: { name: 'Void Bolt', text: 'Ranged void blasts that splash every enemy near the target.' },
    ultimate: { name: 'Hex Potion', text: 'A cursed potion bursts on every enemy ahead for 40x ATK, and for 5 s they deal half damage.' },
    trait: { name: 'Void Sorcerer', text: `Hard-hitting magic from the back line. ${VS.dark}` },
    sp1: { name: 'Puppet Bind', text: 'Every 6th attack takes over a regular enemy for 4 s: it fights the other enemies.', effect: { kind: 'charm', value: 4, every: 6 } },
    sp2: { name: 'Unravel', text: 'Deals 30% more damage to bosses.', effect: { kind: 'bossDamage', value: 1.3 } },
    aura: { name: 'Night Pact', text: 'Dark heroes +15% HP.', effect: { kind: 'hp', value: 1.15, team: true, element: 'dark' } } },
  { id: 'rook', rarity: 'common', name: 'Rook', element: 'dark', type: 'Ranger', baseAtk: 6.5, baseHp: 46, range: 170, attackCooldown: 1.1, moveSpeed: 110, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1,
    bio: 'A masked night stalker in dark leather with a hooked bow. Nobody has seen his face.',
    basic: { name: 'Hooked Arrow', text: 'Long-range arrows at the nearest enemy.' },
    ultimate: { name: 'Nightfall Volley', text: `${ULT('Arrows out of the dark hit')} Marks them: they take 25% more damage from the whole team for 6 seconds.` },
    ult: { kind: 'mark', mult: 1.25, seconds: 6, plusMult: 1.4, plusSeconds: 12 },
    ultPlus: 'The Mark lasts 12 seconds and adds 40% instead of 25%.',
    sigPlus: 'Executes from 40% HP instead of 30%, and each kill takes 2 seconds off the Ultimate cooldown.',
    trait: { name: 'Executioner', text: `Long-range single-target damage. Double damage to enemies below 30% HP. ${VS.dark}` },
    signature: { kind: 'execute', below: 0.3, mult: 2 },
    sp1: { name: 'Barbed Shot', text: 'Arrows pierce 1 more enemy.', effect: { kind: 'pierce', value: 1 } },
    sp2: { name: 'Night Eyes', text: '+20% critical hit chance.', effect: { kind: 'crit', value: 0.2 } },
    aura: { name: "Hunter's Mark", text: 'Whole team deals 10% more damage to bosses.', effect: { kind: 'bossDamage', value: 1.1, team: true } } },
  { id: 'dread', rarity: 'rare', name: 'Dread', element: 'dark', type: 'Knight', baseAtk: 4, baseHp: 145, range: 26, attackCooldown: 1.0, moveSpeed: 110, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1,
    signature: { kind: 'knockback', push: 25 },
    bio: 'A suit of black armor with nobody inside, only violet ghost-fire behind a massive shield. It feeds on the fight.',
    basic: { name: 'Abyss Blade', text: 'Heavy sword blows that shove enemies back a step.' },
    ultimate: { name: 'Hollow Wave', text: ULT('A wave of dark energy tears through') },
    trait: { name: 'Abyss Guardian', text: `Its blows push regular enemies back. ${VS.dark}` },
    sp1: { name: 'Black Flurry', text: 'Every 4th attack is three quick blows (3x damage).', effect: { kind: 'everyNth', value: 3, every: 4 } },
    sp2: { name: 'Abyssal Hunger', text: 'Heals for 25% of the damage it deals.', effect: { kind: 'lifesteal', value: 0.25 } },
    aura: { name: 'Shatter Armor', text: 'Enemies take 15% more damage.', effect: { kind: 'enemyVuln', value: 1.15, team: true } } },
  // Rare heroes beyond the first 20: their own kits, built from existing effects.
  { id: 'wraith', rarity: 'rare', name: 'Wraith', element: 'dark', type: 'Ranger', flying: true, baseAtk: 7, baseHp: 46, range: 180, attackCooldown: 1.05, moveSpeed: 115, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1,
    ult: { kind: 'weaken', mult: 0.7, seconds: 5, plusSeconds: 8 },
    ultPlus: 'Enemies stay weakened for 8 s.',
    bio: 'A hooded ghost archer drifting on violet mist. Its arrows are made of the same stuff.',
    basic: { name: 'Spectral Arrow', text: 'Long-range ghost arrows at the nearest enemy.' },
    ultimate: { name: 'Phantom Volley', text: `${ULT('A volley of phantom arrows hits')} For 5 s they deal 30% less damage.` },
    trait: { name: 'Restless Dead', text: `Hard to pin down: dodges 15% of attacks. ${VS.dark}` },
    sp1: { name: 'Soul Pierce', text: 'Arrows pierce 2 more enemies.', effect: { kind: 'pierce', value: 2 } },
    sp2: { name: 'Haunting', text: 'Every 5th arrow hits for 3x damage.', effect: { kind: 'everyNth', value: 3, every: 5 } },
    aura: { name: 'Grave Chill', text: 'Dark heroes +10% critical hit chance.', effect: { kind: 'crit', value: 0.1, team: true, element: 'dark' } } },
  { id: 'nyx', rarity: 'epic', name: 'Nyx', element: 'dark', type: 'Support', flying: true, baseAtk: 3.3, baseHp: 58, range: 135, attackCooldown: 1.1, moveSpeed: 110, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1, heals: true,
    ult: { kind: 'teamShield', share: 0.8, plusShare: 1.2 },
    ultPlus: "Shields are worth 120% of Nyx's max HP.",
    bio: 'A little bat mage in a violet robe whose crystal staff mends wounds with moonlight.',
    basic: { name: 'Moon Mend', text: HEAL_BASIC },
    ultimate: { name: 'Night Lullaby', text: "Fully heals every living hero and shields each one for 80% of Nyx's max HP." },
    trait: { name: 'Night Wings', text: `The Dark element's healer, quick on the wing: dodges 12% of attacks. ${VS.dark}` },
    sp1: { name: 'Moon Ward', text: "Every 4th heal or attack also shields a random ally for 35% of Nyx's max HP.", effect: { kind: 'ward', value: 0.35, every: 4 } },
    sp2: { name: 'Starlight', text: 'Heals are 40% stronger.', effect: { kind: 'healPower', value: 1.4 } },
    aura: { name: 'Blood Moon', text: 'Dark heroes heal for 5% of the damage they deal.', effect: { kind: 'lifesteal', value: 0.05, team: true, element: 'dark' } } },

  // More Rares: Shellby, Celeste, Ruin, Brasha and Tusk.
  { id: 'shellby', rarity: 'rare', name: 'Shellby', element: 'water', type: 'Brawler', baseAtk: 5, baseHp: 85, range: 26, attackCooldown: 1.0, moveSpeed: 105, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1,
    signature: { kind: 'combo', perHit: 0.06, max: 0.3 },
    bio: 'A snapping turtle in barnacled shell armor who boxes like a sailor and never backs down from a brawl.',
    basic: { name: 'Shell Punch', text: 'Heavy punches at the nearest enemy ahead.' },
    ultimate: { name: 'Shell Wave', text: ULT('A great wave of seawater rolls over') },
    trait: { name: 'Snapping Combo', text: `Each hit in a row on the same enemy deals +6% damage, up to +30%; the streak ends when he switches target. ${VS.water}` },
    sp1: { name: 'Water Bomb', text: 'Every 3rd attack bursts a ball of water for 1.8x damage to every enemy near the target.', effect: { kind: 'slam', value: 1.8, every: 3 } },
    sp2: { name: 'Hard Shell', text: '+50% Defense.', effect: { kind: 'def', value: 1.5 } },
    aura: { name: 'Tidal Rhythm', text: 'Water heroes attack 10% faster.', effect: { kind: 'attackSpeed', value: 0.9, team: true, element: 'water' } } },
  { id: 'celeste', rarity: 'rare', name: 'Celeste', element: 'light', type: 'Ranger', baseAtk: 6, baseHp: 42, range: 190, attackCooldown: 1.0, moveSpeed: 115, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1,
    signature: { kind: 'skyCrit' },
    bio: 'A star-speckled owl archer who hunts by night and never misses a wing.',
    basic: { name: 'Star Arrow', text: 'Long-range arrows of starlight at the nearest enemy.' },
    ultimate: { name: 'Starlight Volley', text: ULT('A shower of starlight arrows falls on') },
    trait: { name: 'Owl Eyes', text: `Shots at flying enemies always crit. ${VS.light}` },
    sp1: { name: 'Twin Stars', text: 'Arrows pierce 2 more enemies.', effect: { kind: 'pierce', value: 2 } },
    sp2: { name: 'Clear Night', text: '+10% critical hit chance.', effect: { kind: 'crit', value: 0.1 } },
    aura: { name: 'Star Focus', text: 'Light heroes deal +20% critical damage.', effect: { kind: 'critDmg', value: 0.2, team: true, element: 'light' } } },
  { id: 'ruin', rarity: 'rare', name: 'Ruin', element: 'dark', type: 'Barbarian', baseAtk: 8, baseHp: 62, range: 30, attackCooldown: 1.5, moveSpeed: 100, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1, steadfast: true,
    bio: 'A horned demon with a cleaver-axe as big as a door. Slow to swing, and nothing is standing after.',
    basic: { name: 'Door Cleaver', text: 'Slow, crushing swings at the nearest enemy ahead.' },
    ultimate: { name: 'Chaos Smash', text: ULT('A giant axe of darkness smashes into') },
    trait: { name: 'Unshaken', text: `Boss blows never stun him. ${VS.dark}` },
    sp1: { name: 'Chaos Flurry', text: 'Every 3rd attack is a quick double swing (2.5x damage).', effect: { kind: 'everyNth', value: 2.5, every: 3 } },
    sp2: { name: 'Demon Hide', text: 'Takes 15% less damage.', effect: { kind: 'damageTaken', value: 0.85 } },
    aura: { name: 'Abyss Plate', text: 'Dark heroes get +40% Defense.', effect: { kind: 'def', value: 1.4, team: true, element: 'dark' } } },
  { id: 'brasha', rarity: 'rare', name: 'Brasha', element: 'fire', type: 'Knight', baseAtk: 3.8, baseHp: 145, range: 26, attackCooldown: 1.0, moveSpeed: 115, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1,
    bio: 'A rhino knight in soot-black iron plate. Fire does not bother her and neither does anything else.',
    basic: { name: 'Iron Sword', text: 'Steady sword blows at the nearest enemy ahead.' },
    ultimate: { name: 'Soot Storm', text: ULT('A wave of burning blades hits') },
    trait: { name: 'Fireproof Hide', text: `85% Effect Resistance, so boss blows almost never stun her. ${VS.fire}` },
    sp1: { name: 'Horn Rush', text: 'Every 5th attack is a rush of blows (3x damage).', effect: { kind: 'everyNth', value: 3, every: 5 } },
    sp2: { name: 'Spiked Plate', text: 'Reflects 15% of the damage she takes.', effect: { kind: 'reflect', value: 0.15 } },
    aura: { name: 'Battle Heat', text: 'Fire heroes +3% Frenzy chance.', effect: { kind: 'frenzy', value: 0.03, team: true, element: 'fire' } } },
  { id: 'tusk', rarity: 'rare', name: 'Tusk', element: 'earth', type: 'Barbarian', baseAtk: 6.5, baseHp: 75, range: 30, attackCooldown: 1.4, moveSpeed: 100, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1, steadfast: true,
    ult: { kind: 'strike', mult: 2.5, plusMult: 3.5 },
    ultPlus: 'The strike hits for 140x ATK.',
    bio: 'A scarred boar gladiator with a short sword and a crowd that still chants his name.',
    basic: { name: 'Arena Blade', text: 'Heavy sword swings at the nearest enemy ahead.' },
    ultimate: { name: 'Crowd Pleaser', text: 'One mighty blow on the toughest enemy in reach for 100x ATK, with element bonuses.' },
    trait: { name: 'Arena Born', text: `Boss blows never stun him. ${VS.earth}` },
    sp1: { name: 'Tusk Quake', text: 'Every 3rd attack stomps the ground for 1.5x damage to every enemy near the target.', effect: { kind: 'slam', value: 1.5, every: 3 } },
    sp2: { name: 'Second Wind', text: 'Regenerates 2% of max HP every second.', effect: { kind: 'regen', value: 0.02 } },
    aura: { name: "Gladiator's Vigor", text: 'Earth heroes +15% HP.', effect: { kind: 'hp', value: 1.15, team: true, element: 'earth' } } },

  // ---- Light: hope and protection ----
  { id: 'dawn', rarity: 'rare', name: 'Dawn', element: 'light', type: 'Lancer', baseAtk: 5, baseHp: 65, range: 36, attackCooldown: 0.85, moveSpeed: 120, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1,
    bio: 'A white-and-gold lancer with a radiant spear, first into every fight and last to complain.',
    basic: { name: 'Radiant Thrust', text: 'Quick spear thrusts at the nearest enemy ahead.' },
    ultimate: { name: 'Dawnbreak', text: ULT('A wave of shining spears hits') },
    trait: { name: 'Dawn Lancer', text: `Her thrusts often stun (20%). ${VS.light}` },
    sp1: { name: 'Piercing Thrust', text: 'Each thrust also hits the next 3 enemies just behind the target.', effect: { kind: 'pierce', value: 3 } },
    sp2: { name: 'Radiant Edge', text: 'Deals 25% more damage to bosses.', effect: { kind: 'bossDamage', value: 1.25 } },
    aura: { name: 'Holy Bastion', text: 'Light heroes get +40% Defense.', effect: { kind: 'def', value: 1.4, team: true, element: 'light' } } },
  { id: 'lumen', rarity: 'rare', name: 'Lumen', element: 'light', type: 'Support', baseAtk: 3, baseHp: 55, range: 130, attackCooldown: 1.15, moveSpeed: 105, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1, heals: true,
    bio: 'A radiant cleric from the Lantern Queen\'s chapel, carrying a staff shaped like the sun.',
    basic: { name: 'Sunlight Mend', text: HEAL_BASIC },
    ultimate: { name: 'Dawn Chorus', text: 'Fully heals every living hero and brings back one fallen hero at half HP.' },
    ult: { kind: 'revive' },
    ultPlus: 'Brings back every fallen hero (at half HP).',
    sigPlus: 'Overhealing shields up to 40% of max HP instead of 20%.',
    trait: { name: 'Guiding Light', text: `Healing past full HP becomes a shield, up to 20% of the ally's max HP. ${VS.light}` },
    signature: { kind: 'overheal', cap: 0.2 },
    sp1: { name: 'Halo', text: 'Heals are 50% stronger.', effect: { kind: 'healPower', value: 1.5 } },
    sp2: { name: 'Beacon', text: 'The ally she heals deals 20% more damage for 4 seconds.', effect: { kind: 'beacon', value: 1.2 } },
    aura: { name: 'Sunlit', text: 'Whole team regenerates 1% of max HP every second.', effect: { kind: 'regen', value: 0.01, team: true } } },
  { id: 'sol', rarity: 'rare', name: 'Sol', element: 'light', type: 'Gunner', baseAtk: 6, baseHp: 48, range: 170, attackCooldown: 1.0, moveSpeed: 115, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1, splash: 28,
    bio: 'A small bunny in golden armor hauling a sun cannon twice her size. Every shot leaves a streak of light in the air.',
    basic: { name: 'Sun Shell', text: 'Long-range explosive shots that splash enemies near the target.' },
    ultimate: { name: 'Shell Rain', text: ULT('A rain of sun shells hits') },
    trait: { name: 'Sun Gunner', text: `Explosive shots splash enemies near the target. ${VS.light}` },
    sp1: { name: 'Flash Shell', text: 'Every 4th shot blinds the enemies it hits: they miss half their attacks for 3 s.', effect: { kind: 'blind', value: 0.5, every: 4 } },
    sp2: { name: 'Hop Reload', text: 'Attacks 20% faster.', effect: { kind: 'attackSpeed', value: 0.8 } },
    aura: { name: 'High Noon', text: 'Light heroes +40% ATK.', effect: { kind: 'atk', value: 1.4, team: true, element: 'light' } } },
  { id: 'aegis', rarity: 'rare', name: 'Aegis', element: 'light', type: 'Knight', baseAtk: 3.2, baseHp: 160, range: 26, attackCooldown: 1.0, moveSpeed: 110, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1,
    bio: 'A lion paladin in white-and-gold armor with a sun-emblem shield. Nothing gets past him that he does not allow.',
    basic: { name: 'Gold Blade', text: 'Steady sword blows at the nearest enemy ahead.' },
    ultimate: { name: 'Pride\'s Roar', text: ULT('A wave of golden thunder hits') },
    trait: { name: 'Gold Guardian', text: `The toughest hero; his blows can stun (10%). ${VS.light}` },
    sp1: { name: 'Gold Flurry', text: 'Every 4th attack is three quick blows (3x damage).', effect: { kind: 'everyNth', value: 3, every: 4 } },
    sp2: { name: 'Golden Mend', text: 'Regenerates 3% of max HP every second.', effect: { kind: 'regen', value: 0.03 } },
    aura: { name: 'Swift Light', text: 'Light heroes move 25% faster.', effect: { kind: 'moveSpeed', value: 1.25, team: true, element: 'light' } } },
  { id: 'seraph', rarity: 'rare', name: 'Paloma', element: 'light', type: 'Magician', flying: true, baseAtk: 8.5, baseHp: 50, range: 150, attackCooldown: 1.45, moveSpeed: 100, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1, splash: 40,
    ult: { kind: 'root', seconds: 3, bossSeconds: 1, shield: 0.15 },
    ultPlus: 'The light also shields every hero for 15% of their max HP.',
    bio: 'A dove priest in white-and-gold robes whose sunburst staff calls down holy light.',
    basic: { name: 'Holy Flash', text: 'Ranged bursts of light that splash every enemy near the target.' },
    ultimate: { name: 'Judgement', text: `${ULT('A pillar of holy light hits')} Holds them in place for 3 seconds (bosses for 1).` },
    trait: { name: 'Sacred Light', text: `Bright spells that can stun (8%). ${VS.light}` },
    sp1: { name: 'Blinding Light', text: 'Every 5th spell blinds the enemies it hits: they miss 40% of their attacks for 3 s.', effect: { kind: 'blind', value: 0.4, every: 5 } },
    sp2: { name: 'Purify', text: 'Deals 25% more damage to bosses.', effect: { kind: 'bossDamage', value: 1.25 } },
    aura: { name: 'Blessing', text: 'Light heroes +15% HP.', effect: { kind: 'hp', value: 1.15, team: true, element: 'light' } } },
  ...ROSTER_HEROES,
];

/** Old hero ids from saves before the 20-hero roster, and who replaced them. */
/**
 * Heroes players can get: only these drop from chests, Trials, medal bundles and the guild, and only these (plus
 * any a save already owns) show in Collection. A new hero stays off this list until it's coded and balanced;
 * heroes without art yet use placeholder art (2026-10-15).
 */
export const RELEASED_HEROES: readonly string[] = [
  'blaze', 'ember', 'flint', 'cinder', 'briar', 'fern', 'thorn', 'moss', 'brine', 'brook', 'ripple', 'marina',
  'shade', 'vex', 'rook', 'dread', 'wraith', 'nyx', 'dawn', 'lumen', 'sol', 'aegis', 'seraph',
  // Samuel (2026-10-15): release new heroes as soon as they're balanced; they use placeholder art until theirs lands.
  'shellby', 'celeste', 'ruin', 'brasha', 'tusk', ...ROSTER_HEROES.map((h) => h.id),
];
export const PLAYABLE_HEROES: HeroDef[] = HEROES.filter((h) => RELEASED_HEROES.includes(h.id));

export const RENAMED_HEROES: Record<string, string> = { marin: 'brine', tide: 'brine', bramble: 'thorn', pyra: 'ember', nox: 'shade', solenne: 'lumen' };

/**
 * Type chart: Water > Fire > Earth > Water deal 4x,
 * and Light and Dark deal 2x to each other. Each element also deals 0.5x to one
 * element (the reverse of the triangle, and Light/Dark to their own element)
 * and 1x to the rest.
 */
export const STRONG_VS: Record<Element, Element> = { water: 'fire', fire: 'earth', earth: 'water', light: 'dark', dark: 'light' };
export const WEAK_VS: Record<Element, Element> = { water: 'earth', fire: 'water', earth: 'fire', light: 'light', dark: 'dark' };

export function elementMultiplier(attacker: Element, defender: Element): number {
  if (STRONG_VS[attacker] === defender) return attacker === 'light' || attacker === 'dark' ? 2 : 4;
  if (WEAK_VS[attacker] === defender) return 0.5;
  return 1;
}

const ENEMY_ELEMENTS: Element[] = ['earth', 'fire', 'water', 'light', 'dark'];

/** Regular enemies rotate element by stage. */
export function enemyElement(stage: number): Element {
  return ENEMY_ELEMENTS[(stage - 1) % ENEMY_ELEMENTS.length];
}

const WEAKNESS_ROTATION: Element[] = ['water', 'earth', 'fire', 'light', 'dark'];
/**
 * Bosses before this stage fight without an element: no hero hits them extra hard or soft, and their blows
 * land the same on everyone. From here every boss fights as the element it looks like (stageBoss).
 */
export const BOSS_ROTATION_START = 600;

/** Whether this stage's boss fights with its element (from stage 600). */
export function bossHasElement(stage: number): boolean {
  return stage >= BOSS_ROTATION_START;
}

/** The element a boss looks like and, from stage 600, fights as. */
export function bossElement(stage: number): Element {
  return stageBoss(stage).art;
}

/** The element that hits this stage's boss hardest (4x, or 2x for Light/Dark), or null before stage 600. */
export function bossWeakness(stage: number): Element | null {
  if (!bossHasElement(stage)) return null;
  const element = bossElement(stage);
  return (Object.keys(STRONG_VS) as Element[]).find((e) => STRONG_VS[e] === element)!;
}

/**
 * The named element bosses (every 100th stage from 600) can only be hurt by their weakness (user, 2026-10-16,
 * narrowed to the 100s on 2026-10-20): hits, ultimates, burns and poison from any other element do nothing.
 * `attacker` is the element the hit counts as; null (no hero behind it) never hurts. Other bosses take any hit.
 */
export function bossImmuneTo(stage: number, attacker: Element | null): boolean {
  if (!isElementBossStage(stage)) return false;
  const weak = bossWeakness(stage);
  return weak !== null && attacker !== weak;
}

/** The five named element bosses (user, 2026-10-15). Each 100th-stage boss from 600 is the one of its element. */
export const ELEMENT_BOSSES: Record<Element, { name: string; title: string }> = {
  light: { name: 'Aureth', title: 'the Dawn Sovereign' },
  earth: { name: 'Tharos', title: 'the Worldroot Colossus' },
  dark: { name: 'Nyxara', title: 'the Hollow Moon' },
  fire: { name: 'Ignivar', title: 'the Ashen Colossus' },
  water: { name: 'Nerath', title: 'the Tide Sovereign' },
};

/** True for the element-weak bosses: every 100th stage from 600. */
export function isElementBossStage(stage: number): boolean {
  return stage >= BOSS_ROTATION_START && stage % 100 === 0;
}

/**
 * The named element boss on this stage, or null for an ordinary boss or stage. Their weaknesses rotate:
 * Water (600), Earth (700), Fire (800), Light (900), Dark (1000), Water (1100)...
 */
export function elementBoss(stage: number): { name: string; title: string; element: Element } | null {
  if (!isElementBossStage(stage)) return null;
  const element = STRONG_VS[WEAKNESS_ROTATION[(stage / 100 - BOSS_ROTATION_START / 100) % WEAKNESS_ROTATION.length]];
  return { ...ELEMENT_BOSSES[element], element };
}

export const BOSS_EVERY = 50;
export const BOSS_TIME_LIMIT = 30;
/** Auto boss: after a boss loss, farm this long, then try the boss again on the next clear. */
export const AUTO_BOSS_SECONDS = 60;
/** Offline, a boss falls only if the team's estimate kills it inside this share of the time limit (walk-up, misses). */
export const OFFLINE_BOSS_TIME_SHARE = 0.8;
/** Seconds between a boss's hits (matches the battle). */
export const OFFLINE_BOSS_COOLDOWN = 1.6;
/** Seconds a fallen hero waits at the crystal before getting back up (Rattle Back shortens it). */
export const RESPAWN_SECONDS = 6;
export const ULT_UNLOCK_LEVEL = 30;
export const ULT_COOLDOWN = 30;
export const ULT_MULTIPLIER = 40;
export const OFFLINE_CAP_HOURS = 12;
/** 2x battle speed unlocks once the player first reaches this stage. */
export const SPEED_UNLOCK_STAGE = 25;
/** Rekindle unlocks after first clearing this stage. */
export const REKINDLE_STAGE = 125;

/**
 * Rekindle head start: once the lifetime best stage reaches HEAD_START_FROM, a Rekindle can start the next run
 * just after a boss instead of at stage 1. The start is the lower of HEAD_START_SHARE of the best stage and
 * HEAD_START_POWER of the team's average level right after the Rekindle (Ember levels, since gold levels reset;
 * a stage N boss wants about level N), rounded down to just after a 50-stage boss. Wheel slots only count
 * stages cleared this run, and a Rekindle needs HEAD_START_MIN_PUSH stages past the start.
 */
export const HEAD_START_FROM = 300;
export const HEAD_START_SHARE = 0.4;
export const HEAD_START_POWER = 0.8;
export const HEAD_START_MIN_PUSH = 50;

/** Gems for a 2x or 3x Ember payout on the Rekindle page. */
export const REKINDLE_BOOSTS: Array<{ mult: number; gems: number }> = [
  { mult: 2, gems: 80 },
  { mult: 3, gems: 160 },
];
/**
 * Rekindle Wheel: 16 slots that unlock as this
 * run's best stage passes 150, 200, 250... Each unlocked slot is one spin of
 * the wheel when you Rekindle. Prizes are never Gems (those come from rewards.ts)
 * and never medals (Samuel: Rekindling shouldn't pay Hero Crests).
 */
export const ROAD_START = 150;
export const ROAD_STEP = 50;
export const ROAD_LENGTH = 16;
export type WheelPrize = { kind: 'tickets'; amount: number } | { kind: 'essence'; amount: number } | { kind: 'stones'; amount: number } | { kind: 'embers'; share: number };
export const WHEEL_PRIZES: Array<{ prize: WheelPrize; weight: number }> = [
  { prize: { kind: 'tickets', amount: 3 }, weight: 35 },
  { prize: { kind: 'essence', amount: 40 }, weight: 30 },
  { prize: { kind: 'stones', amount: 2 }, weight: 15 },
  { prize: { kind: 'embers', share: 0.05 }, weight: 20 },
];
/** Each player level adds this much to every Ember payout. */
export const KEEPER_BONUS_PER_LEVEL = 0.1;
/** Enhance Stones gifted for each new player level (Samuel: no medals from Rekindling). 3, down from 10 (2026-10-21): player level passes 100 and Stones were piling up unused. */
export const LEVEL_GIFT_STONES = 3;
/**
 * Hero Crests (medals) for each evolution, from Samuel's table: a hero unlocks
 * at 1★ and evolves up to 8★ (1★→2★ costs 10, ... 7★→8★ costs 5,000).
 * `stars` in the save counts evolutions, so 0 means 1★. Each evolution multiplies
 * stats by STAR_STAT_MULT; 2★ and 3★ unlock SP1 and SP2, 4★ the hero's team Aura,
 * 5★ a stronger Ultimate, 6★ Signature+, 7★ Type Mastery, 8★ Ascended (shorter
 * Ultimate cooldown). At 8★ further medals turn into Legendary medals.
 */
export const STAR_CRESTS = [10, 50, 250, 600, 1500, 2500, 5000];
export const MAX_STARS = STAR_CRESTS.length;
/**
 * Hero Crests (medals) a hero needs to unlock, by rarity (Samuel's table).
 * Unlocking spends them. Legendary heroes never unlock from their own Crests:
 * they take Legendary medals (LEGENDARY_UNLOCK_MEDALS), and nothing drops or
 * sells them. The free starter (unlockCost 0) needs none.
 */
export const UNLOCK_CRESTS: Record<Exclude<Rarity, 'legendary'>, number> = { common: 10, rare: 30, epic: 80 };
/**
 * Heroes whose rarity went up in the rarity mix (2026-10-21): our first 20 were Common, Nyx was Rare.
 * Saves from before then unlock a locked one that already held enough medals under its old cost.
 */
export const RAISED_RARITY_OLD_COST: Record<string, number> = {
  ...Object.fromEntries(['blaze', 'ember', 'flint', 'cinder', 'briar', 'fern', 'thorn', 'moss', 'brine', 'brook', 'ripple', 'marina', 'shade', 'vex', 'dread', 'dawn', 'lumen', 'sol', 'aegis'].map((id) => [id, UNLOCK_CRESTS.common])),
  nyx: UNLOCK_CRESTS.rare,
};
/** Evolutions needed for each star unlock (0 = 1★): the team Aura at 4★, the stronger Ultimate at 5★. */
export const AURA_EVOLUTIONS = 3;
export const ULT_PLUS_EVOLUTIONS = 4;
/** From 5★ the Ultimate hits harder (the prototype unlocks the Ultimate itself at Lv 30). */
export const ULT_STAR_BONUS = 1.5;
/**
 * Each star multiplies ATK, HP and Defense by this, so 8★ is x17 a 1★ hero.
 * Samuel picked x1.5 (2026-10-14) so the late stars unlock mechanics instead (design/star-progression-draft.md).
 */
export const STAR_STAT_MULT = 1.5;
/**
 * Pink awakening stars, a second star row bought with Starmotes (PvP currency, from the Colosseum).
 * Samuel (2026-10-21): x1.5 all stats per pink star like yellow stars, paced so the first stars take days of
 * focused play, the middle ones weeks and the last ones months. At ~600 Starmotes a week: 1st ~1 day, 2nd ~3 more
 * days, 3rd ~6 days, 4th ~1.5 weeks, 5th ~2.5 weeks, 6th ~4 weeks, 7th ~7 weeks, 8th ~10 weeks (about 6 months per hero).
 * A hero's pink stars never pass its yellow stars.
 */
export const AWAKEN_STARMOTES = [100, 200, 500, 900, 1500, 2500, 4000, 6000];
export const MAX_AWAKEN = AWAKEN_STARMOTES.length;
export const AWAKEN_STAT_MULT = 1.5;
/** Player (Keeper) level that opens awakening. */
export const AWAKEN_UNLOCK_LEVEL = 15;
/** 6★: the hero's Signature gets its Signature+ twist (heroes built to the standard). */
export const SIG_PLUS_EVOLUTIONS = 5;
/** 7★: the hero's Type Mastery. */
export const MASTERY_EVOLUTIONS = 6;
/** 8★: Ascended, the Ultimate recharges in ASCENDED_ULT_COOLDOWN seconds instead of ULT_COOLDOWN. */
export const ASCENDED_EVOLUTIONS = 7;
export const ASCENDED_ULT_COOLDOWN = 20;
/**
 * 7★ Type Mastery: one bonus per Type. Masteries with an `effect` work through the star-skill effects;
 * the rest (Barbarian, Rogue, Samurai, Brawler, Support's cleanse) are coded in BattleScene.
 */
export const TYPE_MASTERY: Record<HeroType, { name: string; text: string; effect?: Effect }> = {
  Ranger: { name: 'Eagle Eye', text: '+10% critical hit chance.', effect: { kind: 'crit', value: 0.1 } },
  Gunner: { name: 'Heavy Round', text: 'Every 5th shot deals 3x damage.', effect: { kind: 'everyNth', value: 3, every: 5 } },
  Magician: { name: 'Wide Casting', text: 'Splash radius +25%.', effect: { kind: 'splash', value: 1.25 } },
  Knight: { name: 'Bulwark', text: 'Takes 15% less damage.', effect: { kind: 'damageTaken', value: 0.85 } },
  Barbarian: { name: 'Bloodrage', text: '+1% damage for every 2% of HP missing (up to +50%).' },
  Rogue: { name: 'Riposte', text: 'After dodging a hit, the next attack is always a critical hit.' },
  Lancer: { name: 'Long Reach', text: 'Attacks also hit the enemy just behind the target.', effect: { kind: 'pierce', value: 1 } },
  Samurai: { name: 'Focus', text: 'Critical hits take 0.5 s off the Ultimate cooldown.' },
  Brawler: { name: 'Haymaker', text: 'Every 4th hit in a row on the same enemy stuns it for 0.5 s.' },
  Support: { name: 'Purify', text: 'Heals 20% more and clear stuns from the healed ally.', effect: { kind: 'healPower', value: 1.2 } },
};
/**
 * Legendary heroes come only from late-game progression (Samuel, 2026-10-21: no event, no chests, shops or Trials).
 * An 8★ hero turns every LEGENDARY_MEDAL_RATE extra medals into one Legendary medal. All Legendary medals share
 * one pool, and the player spends it on whichever Legendary hero they want: LEGENDARY_UNLOCK_MEDALS to unlock,
 * then LEGENDARY_STAR_MEDALS[n] for each star (1★→2★ first): the same numbers as a normal hero (Samuel picked "Hard",
 * 2026-10-21), but each Legendary medal is 10 medals, so a Legendary 8★ takes ~100,000 extra medals. Sim (2026-10-21,
 * 3 h/day): ~5,000 medals a day spread over the roster and no 8★ hero in the first 40 days, so Legendaries are a months-in goal.
 */
export const LEGENDARY_MEDAL_RATE = 10;
export const LEGENDARY_UNLOCK_MEDALS = 80;
export const LEGENDARY_STAR_MEDALS = STAR_CRESTS;

// Gems (premium currency) and the Hero Chest summon.
export const START_GEMS = 60;
// Free Gems come from rewards.ts (dailies, login calendar, Lucky Spin, achievements, Bootcamp) and gold chests.
export const CHEST_COST = 30;
/** The bulk button on the Hero Chest pop-up opens this many at once. */
export const CHEST_BULK = 10;
export const CHEST_DROPS = 3;
/**
 * Hero Chest odds. Each drop first picks a rarity by weight (Legendary never
 * drops), then a random hero of that rarity, then a medal amount for that
 * rarity. Rarer heroes drop less often and in smaller stacks, so a first Rare
 * unlock (30) takes about 10 chests and a first Epic (80) about 100.
 * Rarities with no heroes yet are skipped and the rest re-weighted.
 */
export const CHEST_RARITY_WEIGHTS: Record<Exclude<Rarity, 'legendary'>, number> = { common: 70, rare: 22, epic: 8 };
/** Medals per drop and their weights, by rarity. */
export const CREST_ROLLS: Record<Exclude<Rarity, 'legendary'>, Array<[number, number]>> = {
  common: [[5, 60], [10, 30], [20, 10]],
  rare: [[3, 60], [6, 30], [12, 10]],
  epic: [[2, 60], [4, 30], [8, 10]],
};

/** The order the five bosses take turns on ordinary boss stages (50, 100, 150...). */
const BOSS_TURNS: Element[] = ['fire', 'water', 'earth', 'dark', 'light'];

/**
 * Which of the five bosses guards a boss stage, by their look (`art`, an ELEMENT_BOSSES key): the element boss
 * on every 100th stage from 600, otherwise they take turns. Before 600 the look is all it is (bossHasElement).
 */
export function stageBoss(stage: number): { name: string; title: string; art: Element } {
  const named = elementBoss(stage);
  const art = named ? named.element : BOSS_TURNS[(Math.round(stage / BOSS_EVERY) - 1 + BOSS_TURNS.length) % BOSS_TURNS.length];
  return { ...ELEMENT_BOSSES[art], art };
}

/** The name shown over a boss on the lane. */
export function bossLabel(stage: number): string {
  const b = stageBoss(stage);
  return `${b.name}, ${b.title}`;
}

/** Market Row Stalls (GDD section 6). Each costs gold to open and makes gold on a timer. */
export interface StallDef {
  id: string;
  name: string;
  blurb: string;
  color: number;
  unlockCost: number;
  /** Seconds per cycle. */
  cycle: number;
  /** Gold per cycle at level 1. */
  baseIncome: number;
}

export const STALLS: StallDef[] = [
  { id: 'bakery', name: 'Bakery', blurb: 'Warm bread for hungry heroes.', color: 0xe0a23a, unlockCost: 50, cycle: 3, baseIncome: 2 },
  { id: 'fruit', name: 'Fruit Cart', blurb: 'Fresh from the hills.', color: 0x6abf3b, unlockCost: 1500, cycle: 6, baseIncome: 40 },
  { id: 'smithy', name: 'Smithy', blurb: 'Blades sharpened while you wait.', color: 0x9aa4b0, unlockCost: 4e4, cycle: 12, baseIncome: 900 },
  { id: 'tailor', name: 'Tailor', blurb: 'Capes that never tear.', color: 0xc05bd8, unlockCost: 1.2e6, cycle: 24, baseIncome: 2.5e4 },
  { id: 'jeweler', name: 'Jeweler', blurb: 'Gems polished to a shine.', color: 0x3fb8e6, unlockCost: 4e7, cycle: 45, baseIncome: 8e5 },
  { id: 'alchemist', name: 'Alchemist', blurb: 'Potions that bubble with gold.', color: 0xe04a7a, unlockCost: 1.5e9, cycle: 90, baseIncome: 3e7 },
  { id: 'scribe', name: 'Scribe', blurb: 'Maps of lands not yet crushed.', color: 0xd8c27a, unlockCost: 6e10, cycle: 150, baseIncome: 1.1e9 },
  { id: 'tavern', name: 'Tavern', blurb: 'Every hero needs a drink after a boss.', color: 0xa0522d, unlockCost: 2.5e12, cycle: 240, baseIncome: 4e10 },
  { id: 'menagerie', name: 'Menagerie', blurb: 'Pets for heroes, fees for you.', color: 0x2fae8a, unlockCost: 1e14, cycle: 360, baseIncome: 1.5e12 },
  { id: 'bazaar', name: 'Star Bazaar', blurb: 'Starlight sold by the jar.', color: 0x5b6bd8, unlockCost: 4e15, cycle: 540, baseIncome: 5.5e13 },
  { id: 'clockworks', name: 'Clockworks', blurb: 'Gears that tick out coins.', color: 0xb08d57, unlockCost: 1.6e17, cycle: 600, baseIncome: 1.5e15 },
  { id: 'spice', name: 'Spice Caravan', blurb: 'Saffron worth its weight in gold.', color: 0xd9622b, unlockCost: 6.4e18, cycle: 660, baseIncome: 4e16 },
  { id: 'glass', name: 'Glassblower', blurb: 'Bottled sunsets, two for one.', color: 0x7fd6d0, unlockCost: 2.6e20, cycle: 720, baseIncome: 1e18 },
  { id: 'runes', name: 'Rune Carver', blurb: 'Lucky runes, fresh from the stone.', color: 0x8a7bd8, unlockCost: 1e22, cycle: 780, baseIncome: 2.6e19 },
  { id: 'mint', name: 'Royal Mint', blurb: 'Why earn coins when you can make them?', color: 0xf2c94c, unlockCost: 4e23, cycle: 840, baseIncome: 6.7e20 },
  { id: 'dock', name: 'Airship Dock', blurb: 'Freight from beyond the clouds.', color: 0x6aa6e8, unlockCost: 2.4e25, cycle: 900, baseIncome: 2.6e22 },
  { id: 'stable', name: 'Dragon Stable', blurb: 'Saddled dragons, rented by the hour.', color: 0xc23b3b, unlockCost: 1.4e27, cycle: 900, baseIncome: 9.4e23 },
  { id: 'moon', name: 'Moon Market', blurb: 'Only opens when the moon is full.', color: 0xb9c4e8, unlockCost: 8.4e28, cycle: 900, baseIncome: 3.4e25 },
  { id: 'dreams', name: 'Dream Weaver', blurb: 'Sweet dreams, sold by the yard.', color: 0xd88ad0, unlockCost: 5e30, cycle: 900, baseIncome: 1.2e27 },
  { id: 'foundry', name: 'Crystal Foundry', blurb: 'Crystals cast in molten light.', color: 0x4fd1c5, unlockCost: 3e32, cycle: 900, baseIncome: 4.3e28 },
  { id: 'phoenix', name: 'Phoenix Roost', blurb: 'Feathers that relight themselves.', color: 0xff7a2f, unlockCost: 3e34, cycle: 900, baseIncome: 2.6e30 },
  { id: 'harbor', name: 'Sky Harbor', blurb: 'Every flying fleet docks here.', color: 0x3f8fd8, unlockCost: 3e36, cycle: 900, baseIncome: 1.6e32 },
  { id: 'titan', name: 'Titan Forge', blurb: 'Anvils the size of hills.', color: 0x8c6b4f, unlockCost: 3e38, cycle: 900, baseIncome: 9.6e33 },
  { id: 'storm', name: 'Storm Vault', blurb: 'Lightning kept in jars.', color: 0xe6e04a, unlockCost: 3e40, cycle: 900, baseIncome: 5.8e35 },
  { id: 'temple', name: 'Sun Temple', blurb: 'Pilgrims pay in gold.', color: 0xffb84d, unlockCost: 3e42, cycle: 900, baseIncome: 3.5e37 },
  { id: 'void', name: 'Void Emporium', blurb: 'Nothing for sale, at any price.', color: 0x6b3fa0, unlockCost: 6e44, cycle: 900, baseIncome: 4.2e39 },
  { id: 'oracle', name: 'Oracle Tower', blurb: "Next week's prices, sold today.", color: 0x9ad84f, unlockCost: 1.2e47, cycle: 900, baseIncome: 5e41 },
  { id: 'bank', name: 'Celestial Bank', blurb: 'Interest paid in starlight.', color: 0x58c3f0, unlockCost: 2.4e49, cycle: 900, baseIncome: 6e43 },
  { id: 'time', name: 'Time Merchant', blurb: 'Sells the hours you lost.', color: 0xc8b07a, unlockCost: 4.8e51, cycle: 900, baseIncome: 7.2e45 },
  { id: 'exchange', name: 'Hordefall Exchange', blurb: 'Where the whole horde trades its loot.', color: 0xe8434f, unlockCost: 9.6e53, cycle: 900, baseIncome: 8.6e47 },
];
/** Stalls collect themselves from this level. */
export const STALL_AUTO_LEVEL = 50;
/** Revenue x3 (+200%) every 50 Stall levels. */
export const STALL_MILESTONE = 50;
/** Each Rekindle: +25% Market Row revenue and +5 Stall levels (up to 600) for auto-collect Stalls. */
export const STALL_REKINDLE_REVENUE = 0.25;
export const STALL_REKINDLE_LEVELS = 5;
export const STALL_REKINDLE_LEVELS_CAP = 600;

/**
 * Team slots: how many heroes can fight at once. A new player starts with TEAM_SLOTS_START and buys the rest
 * with Gems, up to TEAM_SLOTS_MAX (Samuel, 2026-10-21). Saves from before
 * slots existed had 5 heroes fighting, so they keep OLD_SAVE_TEAM_SLOTS.
 */
export const TEAM_SLOTS_START = 3;
export const TEAM_SLOTS_MAX = 10;
/** Gems for slots 4, 5, ... 10. */
export const TEAM_SLOT_COSTS = [50, 100, 300, 600, 1000, 1500, 2500];
export const OLD_SAVE_TEAM_SLOTS = 5;
/**
 * Ultimate slots: how many team heroes can use their Ultimate. 3 to start, 2 more for Gems (Samuel, 2026-10-21).
 * The player picks which heroes get them; open slots go to the team in order. Older saves keep 5.
 */
export const ULT_SLOTS_START = 3;
export const ULT_SLOT_COSTS = [300, 600];
export const ULT_SLOTS_MAX = ULT_SLOTS_START + ULT_SLOT_COSTS.length;

// ---------- Gem Shop (Samuel, 2026-10-21: more ways to spend Gems) ----------

/** Hourglass: this many minutes of your current gold income at once, a few times a day. */
export const HOURGLASS_GEMS = 40;
export const HOURGLASS_MINUTES = 120;
export const HOURGLASS_PER_DAY = 5;
/** Gold Boost: x GOLD_BOOST_MULT gold from enemies and floating chests for GOLD_BOOST_MINUTES, stacking up to a cap. */
export const GOLD_BOOST_GEMS = 50;
export const GOLD_BOOST_MINUTES = 30;
export const GOLD_BOOST_MAX_MINUTES = 240;
export const GOLD_BOOST_MULT = 2;

/**
 * Hero Shop (Gems). Test prices, tune freely.
 * Medal pack: MEDAL_PACK.medals for any non-Legendary hero the player picks, priced by rarity.
 * Rotating offers: HERO_SHOP_OFFERS random heroes, each bought once, new ones free every
 * HERO_SHOP_REFRESH_MINUTES or early for HERO_SHOP_REFRESH_GEMS.
 * Featured hero: one hero a week (every hero comes round in turn) with a cheaper bundle once a
 * week, and a big bundle every FEATURED_BIG_EVERY weeks.
 * Trial tickets: TICKET_GEMS each, TICKETS_PER_DAY a day. Bought tickets go to their own stash
 * (BOUGHT_TICKET_CAP), apart from the TICKET_CAP that refills over time, so they can be saved up.
 */
export const MEDAL_PACK = { medals: 100, gems: { common: 300, rare: 500, epic: 1000 } } as const;
export const HERO_SHOP_OFFERS = 4;
export const HERO_SHOP_DEALS = { common: { medals: 20, gems: 40 }, rare: { medals: 15, gems: 60 }, epic: { medals: 10, gems: 80 } } as const;
export const HERO_SHOP_REFRESH_MINUTES = 480;
export const HERO_SHOP_REFRESH_GEMS = 20;
export const FEATURED_BUNDLE = { medals: 50, gems: 150 } as const;
export const FEATURED_BIG_BUNDLE = { medals: 250, gems: 600 } as const;
export const FEATURED_BIG_EVERY = 4;
export const TICKET_GEMS = 10;
export const TICKETS_PER_DAY = 10;
export const BOUGHT_TICKET_CAP = 100;

/**
 * Events (Samuel, 2026-10-21): every TRIAL_EVENT_EVERY weeks, Saturday and Sunday pay double Trial
 * medals. Limited Gem deals alternate weeks: the Ticket Crate in the week of a double-medal weekend
 * (tickets to save for it), the Hero Voucher in the other week (medals for a hero picked when it is
 * used, fewer for rarer heroes). Each deal can be bought once while it's up. Test prices.
 */
export const TRIAL_EVENT_EVERY = 2;
/** weekIndex() % TRIAL_EVENT_EVERY on an event week (the week of 19 Oct 2026 is one). */
export const TRIAL_EVENT_PHASE = 1;
export const TRIAL_EVENT_DAYS = [6, 0];
export const TRIAL_EVENT_MEDAL_MULT = 2;
export const TICKET_CRATE = { tickets: 30, gems: 200 } as const;
export const HERO_VOUCHER = { gems: 500, medals: { common: 200, rare: 100, epic: 60 } } as const;

/** Elemental Trials (GDD 11.1): each element's dungeon opens on set days (Samuel's schedule). */
export const TRIAL_ROTATION: Element[] = ['water', 'earth', 'fire', 'light', 'dark'];
/** Days each Trial is open, as Date.getDay() numbers (0 = Sunday), in the player's local time. */
export const TRIAL_SCHEDULE: Record<Element, number[]> = {
  dark: [1, 5, 0],
  light: [2, 4, 6],
  earth: [2, 4, 0],
  water: [3, 5, 0],
  fire: [1, 3, 6],
};
/** Samuel (2026-10-21): on a day the Light or Dark Trial is open, every element's Trial is open. */
export const ALL_TRIALS_WITH: Element[] = ['light', 'dark'];
export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/**
 * Trial levels from Samuel's table (original dungeon chart). Essence is the
 * resource reward, difficulty sets the boss strength (roughly the Ember level
 * the team needs) and `req` is [heroes, Ember level] needed to enter.
 */
export interface TrialLevel { essence: number; difficulty: number; req: [number, number] | null }
const TRIAL_DIFFICULTY = [1, 10, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500, 600, 700, 800, 950, 1100, 1300, 1500, 1700, 2000, 2300, 2600, 2900, 3200, 3600];
const TRIAL_REQS: ([number, number] | null)[] = [
  null, null, null, null, null, null, null, null, null,
  [2, 100], [2, 200], [2, 300], [2, 400], [2, 500], [3, 600], [3, 750], [3, 850], [3, 1050], [3, 1250],
  [4, 1450], [4, 1700], [4, 2000], [4, 2300], [4, 2600], [5, 2850], [5, 4000],
];
export const TRIAL_LEVELS: TrialLevel[] = TRIAL_DIFFICULTY.map((difficulty, i) => ({
  essence: 20 * 2 ** i,
  difficulty,
  req: TRIAL_REQS[i],
}));
/**
 * Trial medals (Samuel, 2026-10-21): a win at any level gives TRIAL_MEDALS medals. Each one goes to a
 * random hero of the Trial's element, rarer heroes less likely (TRIAL_RARITY_WEIGHTS), so both
 * can land on the same hero. The win screen shows pictures of the heroes they went to.
 */
export const TRIAL_MEDALS = 2;
export const TRIAL_RARITY_WEIGHTS: Record<Exclude<Rarity, 'legendary'>, number> = { common: 80, rare: 17, epic: 3 };
export const TRIAL_TIERS = TRIAL_LEVELS.length;
export const TRIAL_TIME = 30;
/** A Trial level won in this many seconds or less (half the timer) can be Quick Battled: skip the fight, same ticket and reward. */
export const TRIAL_QUICK_TIME = TRIAL_TIME / 2;
/** Trials open once the stage 50 boss is beaten, so the 20 starting tickets don't flood a brand-new player with medals. */
export const TRIAL_UNLOCK_STAGE = 51;
/** The live Trial boss: seconds between hits; every Nth hit is a slam that hits every hero for TRIAL_SLAM_SHARE of a hit. Hits vary by ±TRIAL_HIT_SPREAD. */
export const TRIAL_BOSS_COOLDOWN = 1.6;
export const TRIAL_SLAM_EVERY = 5;
export const TRIAL_SLAM_SHARE = 0.4;
export const TRIAL_HIT_SPREAD = 0.2;
export const TICKET_MINUTES = 30;
export const TICKET_CAP = 20;
export const TRIAL_BOSS_NAMES: Record<Element, string> = {
  water: 'Tide Warden',
  earth: 'Stone Colossus',
  fire: 'Cinder Drake',
  light: 'Dawn Seraph',
  dark: 'Night Hollow',
};
/** Each Trial boss's own art (a BOSS_ANIMS key); the element's stage boss stands in for one without any. */
export const TRIAL_BOSS_ART: Record<Element, string> = {
  water: 'trial_water',
  earth: 'trial_earth',
  fire: 'trial_fire',
  light: 'trial_light',
  dark: 'trial_dark',
};
export const ESSENCE_NAMES: Record<Element, string> = {
  water: 'Tide Essence',
  earth: 'Stone Essence',
  fire: 'Cinder Essence',
  light: 'Dawn Essence',
  dark: 'Dusk Essence',
};

/**
 * Relics: seven normal relics (1★-4★) and three-piece sets from 4★ to 8★.
 * Each piece has one or two effects. Effect numbers are percentages
 * reached at level 20, and grow evenly from level 1.
 * Pieces marked `guessed` follow the rest of their set.
 *
 * 1★ relics are open from the start; each higher star opens once a relic of
 * the star below reaches level 20. At full level, Enhance Stones raise the cap
 * by 5. Set pieces (4★ to 8★) also take Enhance Stones to craft. A set's bonus turns on once every piece is crafted.
 */
export type ElementHp = `${Element}Hp`;
export type ElementDef = `${Element}Def`;
export type RelicEffect =
  | 'atk' | 'hp' | 'def' | 'speed' | 'crit' | 'critDmg' | 'dodge'
  | 'gold' | 'stall' | 'stallCost' | 'stallTime' | 'cost' | 'embers'
  | 'stunTime' | 'freezeTime' | 'burnTime' | 'poisonTime' | 'knightShield'
  | Element | ElementHp | ElementDef;
export interface RelicDef {
  id: string;
  name: string;
  stars: number;
  /** Effects as [effect, percent at level 20]. Crit and dodge are chance points (15 = +15%). */
  fx: Array<[RelicEffect, number]>;
  essences: [Element, Element];
  /** Essence of each kind to craft; each level after doubles every 2 levels. */
  craft: number;
  /** Enhance Stones to craft (set pieces). */
  stones?: number;
  set?: string;
  /** True for pieces whose effects follow the rest of the set. */
  guessed?: boolean;
  blurb: string;
}
// 4★ and up cost 10x what they first did (Samuel, 2026-10-21): by the time 4★ relics open, Trials have
// piled up millions of Essence, and at the old prices every 4★ set was bought within about a day.
// 6★-8★ moved up with them so each star still costs more than the one below.
const T4 = 3_000_000;
const T5 = 20_000_000;
const T6 = 150_000_000;
const T7 = 1_200_000_000;
const T8 = 10_000_000_000;
export const RELICS: RelicDef[] = [
  // Normal relics
  { id: 'warbanner', name: 'Warbanner', stars: 1, fx: [['atk', 46]], essences: ['fire', 'dark'], craft: 10, blurb: 'A torn battle flag that still makes everyone swing harder.' },
  { id: 'oakheart', name: 'Oakheart Coat', stars: 1, fx: [['hp', 46]], essences: ['earth', 'water'], craft: 10, blurb: 'Bark-padded armor for the whole team.' },
  { id: 'pouch', name: 'Penny Pouch', stars: 1, fx: [['stallCost', 3]], essences: ['light', 'earth'], craft: 10, blurb: 'Stall upgrades cost less.' },
  { id: 'sundial', name: 'Pocket Sundial', stars: 1, fx: [['stallTime', 3]], essences: ['water', 'light'], craft: 10, blurb: 'Stalls finish their cycles sooner.' },
  { id: 'sawtooth', name: 'Sawtooth Sword', stars: 2, fx: [['atk', 140]], essences: ['fire', 'earth'], craft: 300, blurb: 'Bites through anything.' },
  { id: 'jackal', name: 'Jackal Idol', stars: 3, fx: [['stallCost', 48]], essences: ['fire', 'light'], craft: 5_000, blurb: 'Merchants bow to it. Stall upgrades cost much less.' },
  { id: 'ironbark', name: 'Ironbark Buckler', stars: 2, fx: [['def', 140]], essences: ['earth', 'dark'], craft: 300, blurb: 'A round shield of bark as hard as iron.' },
  { id: 'luckycoin', name: 'Lucky Coin', stars: 2, fx: [['gold', 60]], essences: ['light', 'fire'], craft: 300, blurb: 'Always lands heads. More gold from enemies and chests.' },
  { id: 'quickstep', name: 'Quickstep Boots', stars: 2, fx: [['speed', 6]], essences: ['water', 'fire'], craft: 300, blurb: 'Light boots that make the whole team attack a little faster.' },
  { id: 'heartstone', name: 'Heartstone Amulet', stars: 3, fx: [['hp', 415]], essences: ['earth', 'light'], craft: 5_000, blurb: 'A warm red stone that beats like a heart.' },
  { id: 'warhorn', name: 'Warhorn', stars: 3, fx: [['atk', 415], ['critDmg', 30]], essences: ['fire', 'water'], craft: 5_000, blurb: 'One blast and every hero hits harder.' },
  { id: 'emberlamp', name: 'Ember Lantern', stars: 3, fx: [['embers', 10]], essences: ['dark', 'light'], craft: 5_000, blurb: 'Catches stray Embers when you Rekindle.' },
  { id: 'shadowcloak', name: 'Shadow Cloak', stars: 3, fx: [['dodge', 5]], essences: ['dark', 'water'], craft: 5_000, blurb: 'Blows hit the shadow instead of the hero.' },
  { id: 'starfall', name: 'Starfall Blade', stars: 4, fx: [['atk', 1240], ['hp', 1240]], essences: ['light', 'water'], craft: 400_000, blurb: 'Hammered from a fallen star.' },
  // 4★ sets
  { id: 'tide_trident', name: 'Drowned Admiral\'s Trident', stars: 4, set: 'tide', fx: [['water', 4970], ['def', 1865]], essences: ['water', 'dark'], craft: 1_000_000, stones: 2, blurb: 'Commands the sea.' },
  { id: 'tide_crown', name: 'Drowned Admiral\'s Crown', stars: 4, set: 'tide', fx: [['waterDef', 2485], ['stall', 1280]], essences: ['water', 'light'], craft: 1_000_000, stones: 2, blurb: 'Pulled up from a sunken flagship.' },
  { id: 'tide_armor', name: 'Drowned Admiral\'s Armor', stars: 4, set: 'tide', fx: [['waterHp', 4970], ['knightShield', 320]], essences: ['water', 'earth'], craft: 1_000_000, stones: 2, blurb: 'Scales of a sea giant.' },
  { id: 'gold_charm', name: 'Baron\'s Charm', stars: 4, set: 'goldhand', fx: [['def', 1240], ['stallTime', 162]], essences: ['dark', 'fire'], craft: T4, stones: 2, blurb: 'Everything it touches works faster.' },
  { id: 'gold_scepter', name: 'Baron\'s Scepter', stars: 4, set: 'goldhand', fx: [['atk', 2485], ['stallCost', 768]], essences: ['light', 'dark'], craft: T4, stones: 2, blurb: 'A rod of solid gold.' },
  { id: 'gold_crown', name: 'Baron\'s Crown', stars: 4, set: 'goldhand', fx: [['hp', 2485], ['stallCost', 1280]], essences: ['earth', 'light'], craft: T4, stones: 2, blurb: 'Heavy is the head.' },
  { id: 'djinn_hammer', name: 'Kiln Hammer', stars: 4, set: 'djinn', fx: [['fire', 4970], ['critDmg', 160]], essences: ['fire', 'water'], craft: T4, stones: 2, blurb: 'Rings like a bell of flame.' },
  { id: 'djinn_armor', name: 'Kiln Armor', stars: 4, set: 'djinn', fx: [['fireHp', 4970], ['stall', 1280]], essences: ['fire', 'dark'], craft: T4, stones: 2, blurb: 'Fired in a golem\'s kiln.' },
  { id: 'djinn_shield', name: 'Kiln Shield', stars: 4, set: 'djinn', fx: [['fireDef', 3725], ['knightShield', 320]], essences: ['fire', 'light'], craft: T4, stones: 2, blurb: 'Smoke that turns blades.' },
  { id: 'storm_shield', name: 'Keeper\'s Shield', stars: 4, set: 'storm', fx: [['lightDef', 3725], ['stall', 1280]], essences: ['light', 'water'], craft: T4, stones: 2, blurb: 'Polished like a lighthouse lens.' },
  { id: 'storm_armor', name: 'Keeper\'s Armor', stars: 4, set: 'storm', fx: [['lightHp', 4970], ['lightDef', 3725]], essences: ['light', 'water'], craft: T4, stones: 2, blurb: 'Light heroes get much tougher.' },
  { id: 'storm_bolt', name: 'Keeper\'s Bolt', stars: 4, set: 'storm', fx: [['light', 4970], ['lightDef', 3725]], essences: ['light', 'fire'], craft: T4, stones: 2, blurb: 'A bottled storm that lights the way home.' },
  { id: 'earth_rod', name: 'Mossback Rod', stars: 4, set: 'earthmother', fx: [['earth', 4970], ['earthDef', 3725]], essences: ['earth', 'light'], craft: T4, stones: 2, blurb: 'Roots follow where it points.' },
  { id: 'earth_armor', name: 'Mossback Armor', stars: 4, set: 'earthmother', fx: [['earthHp', 4970]], essences: ['earth', 'water'], craft: T4, stones: 2, guessed: true, blurb: 'Woven bark and stone.' },
  { id: 'earth_helm', name: 'Mossback Helm', stars: 4, set: 'earthmother', fx: [['earthDef', 3725], ['cost', 768]], essences: ['earth', 'water'], craft: T4, stones: 2, blurb: 'Hero levels cost less gold.' },
  { id: 'under_pendant', name: 'Warden\'s Pendant', stars: 4, set: 'underlord', fx: [['darkHp', 4970], ['cost', 768]], essences: ['dark', 'fire'], craft: T4, stones: 2, blurb: 'Hero levels cost less gold.' },
  { id: 'under_scythe', name: 'Warden\'s Scythe', stars: 4, set: 'underlord', fx: [['dark', 4970]], essences: ['dark', 'water'], craft: T4, stones: 2, blurb: 'Clears a path through any graveyard.' },
  { id: 'under_gauntlet', name: 'Warden\'s Gauntlet', stars: 4, set: 'underlord', fx: [['darkDef', 3725]], essences: ['dark', 'earth'], craft: T4, stones: 2, guessed: true, blurb: 'Cold iron from below.' },
  // 5★ sets
  { id: 'griffin_mask', name: 'Hoard Mask', stars: 5, set: 'griffin', fx: [['def', 2485], ['gold', 324]], essences: ['dark', 'fire'], craft: T5, stones: 3, blurb: 'More gold from enemies and chests.' },
  { id: 'griffin_claw', name: 'Hoard Claw', stars: 5, set: 'griffin', fx: [['atk', 4970], ['stallCost', 3072]], essences: ['light', 'dark'], craft: T5, stones: 3, blurb: 'Talons of beaten gold.' },
  { id: 'griffin_cape', name: 'Hoard Cape', stars: 5, set: 'griffin', fx: [['hp', 4970], ['stallTime', 324]], essences: ['earth', 'light'], craft: T5, stones: 3, blurb: 'Lined with a dragon\'s stolen gold.' },
  { id: 'firebird_halberd', name: 'Emberwing Halberd', stars: 5, set: 'firebird', fx: [['fireHp', 9935], ['stall', 5120]], essences: ['fire', 'dark'], craft: T5, stones: 3, blurb: 'Reborn every dawn.' },
  { id: 'firebird_armor', name: 'Emberwing Armor', stars: 5, set: 'firebird', fx: [['fire', 9935], ['critDmg', 320]], essences: ['fire', 'water'], craft: T5, stones: 3, blurb: 'Burns hotter with every hit.' },
  { id: 'firebird_crest', name: 'Emberwing Crest', stars: 5, set: 'firebird', fx: [['fire', 4970], ['fireDef', 7450]], essences: ['fire', 'earth'], craft: T5, stones: 3, guessed: true, blurb: 'A feather that never cools.' },
  { id: 'wyrm_armor', name: 'Abyss Wyrm Armor', stars: 5, set: 'wyrm', fx: [['darkHp', 9935], ['cost', 3072]], essences: ['dark', 'fire'], craft: T5, stones: 3, blurb: 'Hero levels cost far less gold.' },
  { id: 'wyrm_fang', name: 'Abyss Wyrm Fang', stars: 5, set: 'wyrm', fx: [['dark', 9935], ['darkDef', 7450]], essences: ['dark', 'water'], craft: T5, stones: 3, guessed: true, blurb: 'Drips shadow.' },
  { id: 'wyrm_scale', name: 'Abyss Wyrm Scale', stars: 5, set: 'wyrm', fx: [['darkDef', 7450], ['stall', 5120]], essences: ['dark', 'light'], craft: T5, stones: 3, guessed: true, blurb: 'Harder than the deep.' },
  { id: 'titan_mask', name: 'Stone Titan Mask', stars: 5, set: 'titan', fx: [['earthHp', 9935], ['stall', 5120]], essences: ['earth', 'fire'], craft: T5, stones: 3, blurb: 'Older than the mountains.' },
  { id: 'titan_fist', name: 'Stone Titan Fist', stars: 5, set: 'titan', fx: [['earth', 9935], ['earthDef', 7450]], essences: ['earth', 'light'], craft: T5, stones: 3, blurb: 'Hits like a landslide.' },
  { id: 'titan_heart', name: 'Stone Titan Heart', stars: 5, set: 'titan', fx: [['earthDef', 7450], ['hp', 735]], essences: ['earth', 'dark'], craft: T5, stones: 3, guessed: true, blurb: 'Still beating, slowly.' },
  { id: 'siren_dagger', name: 'Siren Dagger', stars: 5, set: 'siren', fx: [['water', 9935], ['waterDef', 7450]], essences: ['water', 'dark'], craft: T5, stones: 3, blurb: 'Sings as it strikes.' },
  { id: 'siren_tiara', name: 'Siren Tiara', stars: 5, set: 'siren', fx: [['waterHp', 9935], ['knightShield', 640]], essences: ['water', 'earth'], craft: T5, stones: 3, blurb: 'Coral and moonlight.' },
  { id: 'siren_shield', name: 'Siren Shield', stars: 5, set: 'siren', fx: [['waterDef', 7450], ['stall', 5120]], essences: ['water', 'light'], craft: T5, stones: 3, blurb: 'A shell that turns the tide.' },
  // 6★ sets
  { id: 'lev_fin', name: 'Leviathan Fin Blade', stars: 6, set: 'leviathan', fx: [['water', 17280], ['waterDef', 12960]], essences: ['water', 'fire'], craft: T6, stones: 4, blurb: 'Cut from the fin of the great sea serpent.' },
  { id: 'lev_scale', name: 'Leviathan Scale Mail', stars: 6, set: 'leviathan', fx: [['waterHp', 17280], ['stall', 10240]], essences: ['water', 'earth'], craft: T6, stones: 4, blurb: 'Every scale is the size of a shield.' },
  { id: 'lev_pearl', name: 'Leviathan Pearl', stars: 6, set: 'leviathan', fx: [['def', 4320], ['speed', 15]], essences: ['water', 'dark'], craft: T6, stones: 4, blurb: 'Glows with the light of the deep.' },
  { id: 'hawk_talon', name: 'Thunderhawk Talon', stars: 6, set: 'thunderhawk', fx: [['light', 17280], ['crit', 10]], essences: ['light', 'fire'], craft: T6, stones: 4, blurb: 'Crackles every time it strikes.' },
  { id: 'hawk_wing', name: 'Thunderhawk Wing Cloak', stars: 6, set: 'thunderhawk', fx: [['lightHp', 17280], ['stallTime', 648]], essences: ['light', 'water'], craft: T6, stones: 4, blurb: 'Feathers charged with storm.' },
  { id: 'hawk_eye', name: 'Thunderhawk Eye', stars: 6, set: 'thunderhawk', fx: [['lightDef', 12960], ['gold', 648]], essences: ['light', 'earth'], craft: T6, stones: 4, blurb: 'Sees gold from a mile away.' },
  // 7★ set
  { id: 'dread_crown', name: 'Dreadmoon Crown', stars: 7, set: 'dreadmoon', fx: [['dark', 34560], ['cost', 6144]], essences: ['dark', 'light'], craft: T7, stones: 5, blurb: 'Worn by the king of the night. Hero levels cost far less.' },
  { id: 'dread_blade', name: 'Dreadmoon Blade', stars: 7, set: 'dreadmoon', fx: [['atk', 8640], ['critDmg', 640]], essences: ['dark', 'fire'], craft: T7, stones: 5, blurb: 'A crescent of black steel.' },
  { id: 'dread_armor', name: 'Dreadmoon Armor', stars: 7, set: 'dreadmoon', fx: [['darkHp', 34560], ['darkDef', 25920]], essences: ['dark', 'earth'], craft: T7, stones: 5, blurb: 'Moonlight slides right off it.' },
  // 8★ set
  { id: 'hallow_medal', name: 'Hallowed Medallion', stars: 8, set: 'hallowed', fx: [['atk', 19640], ['stallCost', 12848]], essences: ['light', 'dark'], craft: T8, stones: 6, blurb: 'A winged medallion blessed by every god at once.' },
  { id: 'hallow_mask', name: 'Hallowed Mask', stars: 8, set: 'hallowed', fx: [['def', 17380], ['gold', 723]], essences: ['dark', 'fire'], craft: T8, stones: 6, blurb: 'A golden face that never stops watching.' },
  { id: 'hallow_chalice', name: 'Hallowed Chalice', stars: 8, set: 'hallowed', fx: [['hp', 19640], ['stallTime', 678]], essences: ['earth', 'light'], craft: T8, stones: 6, blurb: 'Whoever drinks from it fights all day.' },
];
export interface RelicSetDef {
  id: string;
  name: string;
  /** Colour for the set header: an element, or gold for whole-team sets. */
  element: Element | null;
  /** Bonuses ([effect, percent]) once every piece is crafted. */
  bonus: Array<[RelicEffect, number]>;
  text: string;
}
export const RELIC_SETS: RelicSetDef[] = [
  { id: 'tide', name: 'Drowned Admiral', element: 'water', bonus: [['speed', 10], ['freezeTime', 15]], text: 'Team attacks 10% faster, freeze lasts 15% longer' },
  { id: 'goldhand', name: 'Market Baron', element: null, bonus: [['embers', 30], ['stallTime', 100]], text: '+30% Embers from Rekindle, Stalls twice as fast' },
  { id: 'djinn', name: 'Kiln Golem', element: 'fire', bonus: [['crit', 10], ['cost', 500]], text: '+10% crit chance, hero levels cost much less' },
  { id: 'storm', name: 'Lighthouse Keeper', element: 'light', bonus: [['hp', 1150], ['speed', 10]], text: 'Team +1,150% HP, attacks 10% faster' },
  { id: 'earthmother', name: 'Mossback', element: 'earth', bonus: [['dodge', 10], ['def', 1150]], text: 'Team dodges 10% of attacks, +1,150% Defense' },
  { id: 'underlord', name: 'Gravewarden', element: 'dark', bonus: [['stunTime', 15], ['atk', 1150]], text: 'Stuns last 15% longer, team +1,150% ATK' },
  { id: 'griffin', name: 'Dragon Hoard', element: null, bonus: [['embers', 50], ['hp', 4600]], text: '+50% Embers from Rekindle, team +4,600% HP' },
  { id: 'firebird', name: 'Emberwing', element: 'fire', bonus: [['burnTime', 25], ['crit', 15], ['atk', 4600]], text: 'Burns last 25% longer, +15% crit chance, team +4,600% ATK' },
  { id: 'wyrm', name: 'Abyss Wyrm', element: 'dark', bonus: [['stunTime', 25], ['cost', 750], ['atk', 4600]], text: 'Stuns last 25% longer, hero levels cost far less, team +4,600% ATK' },
  { id: 'titan', name: 'Stone Titan', element: 'earth', bonus: [['poisonTime', 25], ['dodge', 15], ['def', 4600]], text: 'Poison lasts 25% longer, team dodges 15% of attacks, +4,600% Defense' },
  { id: 'siren', name: 'Siren', element: 'water', bonus: [['freezeTime', 25], ['speed', 15], ['def', 4600]], text: 'Freeze lasts 25% longer, team attacks 15% faster, +4,600% Defense' },
  { id: 'leviathan', name: 'Leviathan', element: 'water', bonus: [['speed', 20], ['def', 8000]], text: 'Team attacks 20% faster, +8,000% Defense' },
  { id: 'thunderhawk', name: 'Thunderhawk', element: 'light', bonus: [['crit', 20], ['hp', 8000]], text: '+20% crit chance, team +8,000% HP' },
  { id: 'dreadmoon', name: 'Dreadmoon', element: 'dark', bonus: [['stunTime', 35], ['cost', 1150], ['atk', 16000]], text: 'Stuns last 35% longer, hero levels cost far less, team +16,000% ATK' },
  { id: 'hallowed', name: 'Hallowed', element: null, bonus: [['embers', 75], ['atk', 32000], ['hp', 32000]], text: '+75% Embers from Rekindle, team +32,000% ATK and HP' },
];
/** Levels a relic reaches before Enhance Stones; reaching it on an N★ relic opens (N+1)★ relics. */
export const RELIC_BASE_MAX = 20;
/** Each Enhance raises the cap by this many levels, up to RELIC_ENHANCE_COSTS.length times. */
export const RELIC_ENHANCE_LEVELS = 5;
export const RELIC_ENHANCE_COSTS = [5, 10, 20, 40];
export const RELIC_MAX_STARS = Math.max(...RELICS.map((r) => r.stars));
/** Relic slots: 2 free, then up to 20 more bought with Gems once your best stage reaches each gate (22 in all). */
export const RELIC_START_SLOTS = 2;
/** About 10,700 Gems for all 20 (was ~39,000, over two years of free Gems); the stage gates still pace them. */
export const RELIC_SLOT_COSTS = [50, 75, 100, 125, 150, 200, 250, 300, 350, 400, 450, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1500];
export const RELIC_SLOT_STAGES = [25, 50, 100, 150, 200, 250, 300, 400, 500, 600, 700, 800, 900, 1000, 1200, 1400, 1600, 1800, 2000, 2500];

/** Relics on show in the Relic Shop at once; each is bought with its Essence, never Gems. */
export const RELIC_SHOP_SIZE = 3;
/** Wait after a New relics refresh before the next one. */
export const RELIC_SHOP_REFRESH_MINUTES = 40;

// ---------- guilds (server rules live in supabase/guilds.sql) ----------

export const GUILD_MAX_MEMBERS = 30;
/** Guild requests are for Common heroes only, and ask for this many medals. */
export const GUILD_REQUEST_GOAL = 10;
/** Hours between a player's guild requests, and how long a request stays open: at most 10 medals per 4 hours. */
export const GUILD_REQUEST_HOURS = 4;
export const GUILD_REQUEST_OPEN_HOURS = 4;
/** Most medals one guildmate can give to one request. */
export const GUILD_DONATE_MAX = 5;
/** Guild Coins a donor earns per medal given, by the hero's rarity. */
export const GUILD_CREDITS_PER_MEDAL: Record<Exclude<Rarity, 'legendary'>, number> = { common: 3, rare: 6, epic: 12 };
export type GuildShopId = 'chest' | 'stone' | 'tickets' | 'embers' | 'banner' | 'horn';
/** Always in stock. Embers are limited per day; the two boosts last GUILD_BOOST_MINUTES and stack up to GUILD_BOOST_MAX_MINUTES. */
export const GUILD_SHOP: Array<{ id: GuildShopId; name: string; text: string; cost: number }> = [
  { id: 'chest', name: 'Hero Chest', text: '3 drops of Hero Crests, like the Gem chest.', cost: 60 },
  { id: 'stone', name: 'Enhance Stone', text: 'Raises a relic\'s level cap or crafts set pieces.', cost: 40 },
  { id: 'tickets', name: '5 Trial tickets', text: 'Up to the usual cap of 20.', cost: 30 },
  { id: 'embers', name: 'Ember pouch', text: '1% of your lifetime Embers (at least 10). 3 a day.', cost: 80 },
  { id: 'banner', name: 'Gold Banner', text: '+50% gold from enemies for 30 minutes.', cost: 50 },
  { id: 'horn', name: 'War Horn', text: '+25% hero damage for 30 minutes.', cost: 50 },
];
export const GUILD_EMBER_POUCHES_PER_DAY = 3;
export const GUILD_BOOST_MINUTES = 30;
export const GUILD_BOOST_MAX_MINUTES = 120;
export const GUILD_BOOSTS = { banner: 0.5, horn: 0.25 } as const;
/** Daily hero offers in the guild shop: how many, medals per offer and their price, by rarity. */
export const GUILD_SHOP_OFFERS = 4;
export const GUILD_OFFER_MEDALS = { common: 10, rare: 6, epic: 3 } as const;
export const GUILD_OFFER_COST = { common: 50, rare: 80, epic: 120 } as const;
/** Wild Medals: one medal for any non-Legendary hero the player picks, priced by rarity, up to a weekly cap. */
export const GUILD_WILD_COST = { common: 8, rare: 15, epic: 30 } as const;
export const GUILD_WILD_PER_WEEK = 20;

/**
 * Guild Boss (a weekly guild event). Members fight as often as they like, one fight every GUILD_BOSS_FIGHT_GAP_SECONDS;
 * the first GUILD_BOSS_ATTEMPTS fights a player makes each UTC day pay attempt rewards and research. After each kill the
 * boss rests GUILD_BOSS_REST_MINUTES, then comes back one level higher (Samuel, 2026-10-21). supabase/guilds.sql
 * (hit_guild_boss) enforces all three.
 */
export const GUILD_BOSS_ATTEMPTS = 3;
export const GUILD_BOSS_FIGHT_GAP_SECONDS = 120;
export const GUILD_BOSS_REST_MINUTES = 30;
export const GUILD_BOSS_SECONDS = 30;
/** Rough number of solid attempts a boss is built to take; one such attempt earns the full damage bonus. */
export const GUILD_BOSS_PAR_ATTEMPTS = 15;
/** Gold per attempt, in minutes of income. */
export const GUILD_BOSS_GOLD_MINUTES = 30;
/** Every level beaten pays each member who hit the boss that week: Guild Coins per level (x (10 + level)) and a share of lifetime Embers. */
export const GUILD_BOSS_KILL_COINS = 3;
export const GUILD_BOSS_KILL_EMBERS = 0.0025;
export const GUILD_BOSS_KILL_MIN_EMBERS = 5;
/** Weekly reward by the highest level beaten: Guild Coins (x (10 + level)) and a Hero Chest per few levels, up to a cap. */
export const GUILD_BOSS_WEEK_COINS = 10;
export const GUILD_BOSS_LEVELS_PER_CHEST = 3;
export const GUILD_BOSS_WEEK_MAX_CHESTS = 10;
/**
 * Ascendant Chest (Samuel, 2026-10-21): Gems only, sold each week (Monday 00:00 UTC, with the Guild Boss) for the Ascendant
 * hero whose element beats that week's Guild Boss. Each buy gives that hero's crests plus a Hero Chest's drops for other
 * heroes; each buy costs more and gives more Ascendant crests, and the price resets every week. Test values until the
 * balance pass. Hidden while no Ascendant hero is released.
 */
export const ASCENDANT_CHEST: ReadonlyArray<{ gems: number; crests: number }> = [
  { gems: 100, crests: 10 }, { gems: 150, crests: 12 }, { gems: 200, crests: 15 }, { gems: 300, crests: 18 }, { gems: 400, crests: 22 },
  { gems: 500, crests: 26 }, { gems: 650, crests: 30 }, { gems: 800, crests: 35 }, { gems: 1000, crests: 40 }, { gems: 1250, crests: 50 },
];
/** Boss for each week's element (guildBossElement / the server pick the element). */
export const GUILD_BOSS_NAMES: Record<Element, string> = {
  water: 'Leviathan of the Deep',
  fire: 'Cinder Tyrant',
  earth: 'Mountain Behemoth',
  light: 'Radiant Seraph',
  dark: 'Night Devourer',
};

/** Guild Research: shared bonuses for every member. Points come from Guild Coins members put in and from Guild Boss attempts (10 + boss level to the focus branch). */
export type ResearchBranch = 'prosperity' | 'combat' | 'exploration' | 'elemental';
export const GUILD_RESEARCH: { id: ResearchBranch; name: string; perRank: number; what: string }[] = [
  { id: 'combat', name: 'Combat', perRank: 0.02, what: 'hero damage' },
  { id: 'prosperity', name: 'Prosperity', perRank: 0.05, what: 'gold from enemies' },
  { id: 'exploration', name: 'Exploration', perRank: 0.05, what: 'Trial Essence and Enhance Stones' },
  { id: 'elemental', name: 'Elemental Studies', perRank: 0.03, what: 'damage in Trials and against the Guild Boss' },
];
export const GUILD_RESEARCH_MAX_RANK = 10;
/** Points for rank r alone are 300 x r^2, so all 10 ranks take 115,500 (matches guilds.sql). */
export const GUILD_RESEARCH_RANK_COST = 300;
/** Points one Guild Boss attempt adds to the focus branch (matches guilds.sql). */
export const guildResearchPerAttempt = (level: number) => 10 + level;

/** Guild Quests: weekly shared goals (per member, times max(5, members)); half of perMember earns the personal reward. Matches guild_quest_goal in guilds.sql. */
export type GuildQuestKind = 'kills' | 'stages' | 'trials' | 'boss';
export const GUILD_QUESTS: { kind: GuildQuestKind; name: string; perMember: number }[] = [
  { kind: 'kills', name: 'Defeat enemies', perMember: 2000 },
  { kind: 'stages', name: 'Clear stages', perMember: 150 },
  { kind: 'trials', name: 'Win Trials', perMember: 10 },
  { kind: 'boss', name: 'Guild Boss attempts', perMember: 12 },
];
/** Shared weekly track at 25/50/75/100% of the guild's average quest completion. */
export const GUILD_QUEST_TRACK: { coins: number; chest: boolean }[] = [
  { coins: 40, chest: false },
  { coins: 60, chest: false },
  { coins: 80, chest: false },
  { coins: 120, chest: true },
];
export const GUILD_QUEST_PERSONAL_COINS = 15;
