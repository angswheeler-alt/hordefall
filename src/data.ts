export type Element = 'water' | 'fire' | 'earth' | 'light' | 'dark';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
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
  Support: 'Team utility: heals and protects the team.',
};

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
  | { kind: 'execute'; below: number; mult: number };

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
  | { kind: 'mark'; mult: number; seconds: number; plusMult: number; plusSeconds: number };

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
  // Hero-sheet stats (added for the Crush-style stat page; chances are 0.05 = 5%).
  | 'frenzy' | 'effectRes' | 'stunChance' | 'freezeChance' | 'burnChance' | 'poisonChance' | 'ultAtk' | 'aoeDmg';

export interface Effect {
  kind: EffectKind;
  value: number;
  team?: boolean;
  every?: number;
}

export const ELEMENT_COLORS: Record<Element, number> = {
  water: 0x3fa9f5,
  fire: 0xf5603f,
  earth: 0x6cbf3a,
  light: 0xf5d63f,
  dark: 0x9b59d0,
};

// The first 20 heroes: four per element. All Common. Brine is the free starter.
// Brine, Ember, Thicket (id thorn), Lumen and Rook are built to the hero standard (Signature, unique Ultimate);
// the rest keep their older kits until they are rebuilt. Thorn and Blaze were renamed Thicket and Flare
// (names only; ids stay) because Crush Them All already has heroes with those names.
// Type baselines (each hero varies a little): Knight high-HP front line, Magician ranged splash,
// Ranger and Gunner long-range single target, Support healer, the other melee types quick and hard-hitting.
const VS: Record<Element, string> = {
  fire: 'Fire deals 4x to Earth and 0.5x to Water.',
  earth: 'Earth deals 4x to Water and 0.5x to Fire.',
  water: 'Water deals 4x to Fire and 0.5x to Earth.',
  dark: 'Dark deals 2x to Light and 0.5x to Dark.',
  light: 'Light deals 2x to Dark and 0.5x to Light.',
};
const ULT = (what: string) => `${what} every enemy ahead for 40x ATK, with element bonuses.`;
const HEAL_BASIC = 'Heals the most injured nearby ally for 3x ATK. Attacks when nobody needs healing.';

export const HEROES: HeroDef[] = [
  // ---- Fire: passion and destruction ----
  { id: 'blaze', rarity: 'common', name: 'Flare', element: 'fire', type: 'Barbarian', baseAtk: 5.5, baseHp: 55, range: 28, attackCooldown: 0.75, moveSpeed: 125, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1,
    bio: 'A young red-haired swordsman whose blade catches fire when he gets excited, which is always.',
    basic: { name: 'Searing Slash', text: 'Quick flaming slashes at the nearest enemy ahead.' },
    ultimate: { name: 'Wildfire Arc', text: ULT('One huge burning sweep hits') },
    trait: { name: 'Blazing Fury', text: `Heavy, fast melee damage. ${VS.fire}` },
    sp1: { name: 'Flashfire', text: '20% chance for each attack to strike twice.', effect: { kind: 'doubleStrike', value: 0.2 } },
    sp2: { name: 'Burning Edge', text: 'Deals 25% more damage to bosses.', effect: { kind: 'bossDamage', value: 1.25 } },
    aura: { name: 'Kindled Spirit', text: 'Team ATK +15%.', effect: { kind: 'atk', value: 1.15, team: true } } },
  { id: 'ember', rarity: 'common', name: 'Ember', element: 'fire', type: 'Magician', baseAtk: 8, baseHp: 40, range: 150, attackCooldown: 1.4, moveSpeed: 105, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1, splash: 40,
    bio: 'An energetic arcanist with flame-shaped hair ornaments and a fire orb she never puts down.',
    basic: { name: 'Fire Orb', text: 'Ranged fireballs that splash every enemy near the target.' },
    ultimate: { name: 'Meteor', text: `${ULT('A meteor crashes into')} Leaves burning ground for 5 seconds that burns anything walking through it.` },
    ult: { kind: 'meteor', seconds: 5, groundDps: 2, second: 0.5 },
    ultPlus: 'A second meteor lands a moment later for half damage.',
    trait: { name: 'Kindling', text: `Her hits set enemies Burning: 20% of the hit's damage every second for 3 seconds. ${VS.fire}` },
    signature: { kind: 'burn', share: 0.2, seconds: 3 },
    sp1: { name: 'Wildfire', text: 'A Burning enemy that dies explodes for 2x ATK on enemies around it.', effect: { kind: 'burnBurst', value: 2 } },
    sp2: { name: 'Stoke the Flames', text: '+40% damage to Burning enemies.', effect: { kind: 'vsBurning', value: 1.4 } },
    aura: { name: 'Heat Shimmer', text: 'Team critical hit chance +5%.', effect: { kind: 'crit', value: 0.05, team: true } } },
  { id: 'flint', rarity: 'common', name: 'Flint', element: 'fire', type: 'Rogue', baseAtk: 6, baseHp: 50, range: 24, attackCooldown: 0.6, moveSpeed: 145, unlockCost: 50, upgradeBaseCost: 15, goldMult: 2,
    bio: 'An agile flame striker with two daggers and armor that glows like banked coals.',
    basic: { name: 'Spark Daggers', text: 'Very fast stabs at the closest enemy.' },
    ultimate: { name: 'Cinder Storm', text: ULT('Dashes through') },
    trait: { name: 'Flame Runner', text: `Runs fast and earns 2x gold from every kill. ${VS.fire}` },
    sp1: { name: 'Spark Step', text: 'Dodges 25% of incoming attacks.', effect: { kind: 'dodge', value: 0.25 } },
    sp2: { name: 'Ember Edge', text: '+20% critical hit chance.', effect: { kind: 'crit', value: 0.2 } },
    aura: { name: 'Scorched Loot', text: 'Team earns 25% more gold from kills.', effect: { kind: 'gold', value: 1.25, team: true } } },
  { id: 'cinder', rarity: 'common', name: 'Cinder', element: 'fire', type: 'Brawler', baseAtk: 3, baseHp: 160, range: 26, attackCooldown: 1.1, moveSpeed: 100, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1,
    bio: 'A bulky inferno guardian who carries a shield of cooling magma and stands in front of everyone.',
    basic: { name: 'Magma Bash', text: 'Slow, heavy shield blows that shove enemies back a step.' },
    ultimate: { name: 'Eruption', text: ULT('Slams the shield down, bursting magma under') },
    trait: { name: 'Inferno Guardian', text: `Very high HP. ${VS.fire}` },
    sp1: { name: 'Magma Skin', text: 'Reflects 30% of damage taken back at the attacker.', effect: { kind: 'reflect', value: 0.3 } },
    sp2: { name: 'Molten Core', text: 'Takes 25% less damage.', effect: { kind: 'damageTaken', value: 0.75 } },
    aura: { name: 'Forge Wall', text: 'Whole team takes 10% less damage.', effect: { kind: 'damageTaken', value: 0.9, team: true } } },

  // ---- Earth (Grass): life and growth ----
  { id: 'briar', rarity: 'common', name: 'Briar', element: 'earth', type: 'Ranger', baseAtk: 5.5, baseHp: 45, range: 165, attackCooldown: 0.9, moveSpeed: 115, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1,
    bio: 'A nimble leaf ranger in leaf-shaped armor who can put an arrow through a falling acorn.',
    basic: { name: 'Leaf Arrow', text: 'Long-range arrows at the nearest enemy.' },
    ultimate: { name: 'Thornrain', text: ULT('A volley of thorned arrows hits') },
    trait: { name: 'Leaf Ranger', text: `Long-range single-target damage. ${VS.earth}` },
    sp1: { name: 'Split Shot', text: 'Arrows pierce 1 more enemy.', effect: { kind: 'pierce', value: 1 } },
    sp2: { name: 'Quickdraw', text: 'Attacks 20% faster.', effect: { kind: 'attackSpeed', value: 0.8 } },
    aura: { name: 'Canopy Cover', text: 'Whole team dodges 5% of attacks.', effect: { kind: 'dodge', value: 0.05, team: true } } },
  { id: 'fern', rarity: 'common', name: 'Fern', element: 'earth', type: 'Support', baseAtk: 3, baseHp: 55, range: 130, attackCooldown: 1.2, moveSpeed: 105, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1, heals: true,
    bio: 'A gentle sylvan healer whose wooden staff is still alive and occasionally flowers.',
    basic: { name: 'Sap Mend', text: HEAL_BASIC },
    ultimate: { name: 'Spring Bloom', text: 'Fully heals every living hero.' },
    trait: { name: 'Sylvan Healer', text: `Keeps the team standing. ${VS.earth}` },
    sp1: { name: 'Green Touch', text: 'Heals are 50% stronger.', effect: { kind: 'healPower', value: 1.5 } },
    sp2: { name: 'Seedbed', text: 'Fallen heroes respawn twice as fast.', effect: { kind: 'respawn', value: 0.5, team: true } },
    aura: { name: 'Bloom', text: 'Whole team regenerates 1% of max HP every second.', effect: { kind: 'regen', value: 0.01, team: true } } },
  { id: 'thorn', rarity: 'common', name: 'Thicket', element: 'earth', type: 'Knight', baseAtk: 3.5, baseHp: 150, range: 34, attackCooldown: 1.0, moveSpeed: 105, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1,
    bio: 'A sturdy thorn sentinel in bark armor. His thorn spear gives him a little more reach than other knights.',
    basic: { name: 'Thorn Thrust', text: 'Heavy spear thrusts with a little extra reach that shove enemies back.' },
    ultimate: { name: 'Bramble Wall', text: `${ULT('Thorns burst from the ground under')} Roots them in place for 3 seconds (bosses for 1).` },
    ult: { kind: 'root', seconds: 3, bossSeconds: 1, shield: 0.2 },
    ultPlus: 'The wall also shields every hero for 20% of their max HP.',
    trait: { name: 'Bramble Hide', text: `High HP and a longer reach. Reflects 20% of damage taken back at the attacker. ${VS.earth}` },
    signature: { kind: 'reflect', value: 0.2 },
    sp1: { name: 'Taproot', text: 'Regenerates 2% of max HP every second.', effect: { kind: 'regen', value: 0.02 } },
    sp2: { name: 'Thornmail', text: 'Bramble Hide reflects 50% instead of 20%.', effect: { kind: 'reflect', value: 0.3 } },
    aura: { name: 'Old Growth', text: 'Team max HP +20%.', effect: { kind: 'hp', value: 1.2, team: true } } },
  { id: 'moss', rarity: 'common', name: 'Moss', element: 'earth', type: 'Magician', baseAtk: 7, baseHp: 48, range: 140, attackCooldown: 1.5, moveSpeed: 100, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1, splash: 48,
    bio: 'A hooded root druid whose staff is crowned with a seed that glows when something nearby is growing.',
    basic: { name: 'Spore Burst', text: 'Ranged spore clouds that splash every enemy near the target.' },
    ultimate: { name: 'Root Eruption', text: ULT('Giant roots crash up beneath') },
    trait: { name: 'Root Druid', text: `Wide area damage. ${VS.earth}` },
    sp1: { name: 'Spore Cloud', text: 'Splash radius +50%.', effect: { kind: 'splash', value: 1.5 } },
    sp2: { name: 'Deep Roots', text: 'Deals 30% more damage to bosses.', effect: { kind: 'bossDamage', value: 1.3 } },
    aura: { name: 'Living Grove', text: 'Whole team attacks 10% faster.', effect: { kind: 'attackSpeed', value: 0.9, team: true } } },

  // ---- Water: adaptability and wisdom ----
  { id: 'brine', rarity: 'common', name: 'Brine', element: 'water', type: 'Samurai', baseAtk: 5, baseHp: 65, range: 28, attackCooldown: 0.8, moveSpeed: 120, unlockCost: 0, upgradeBaseCost: 5, goldMult: 1,
    bio: 'A young tidecoast sailor with a cutlass and a sea-blue scarf, sworn to bring the Lantern Queen home. The reason every early boss goes down.',
    basic: { name: 'Cutlass Slash', text: 'Fast cutlass slashes at the nearest enemy ahead.' },
    ultimate: { name: 'Rogue Wave', text: `${ULT('A crashing wave hits')} Washes regular enemies far back.` },
    ult: { kind: 'washback', push: 160, haste: 0.7, hasteSeconds: 5 },
    ultPlus: 'The wave leaves the team attacking 30% faster for 5 seconds.',
    trait: { name: 'Riptide Combo', text: `Each hit in a row on the same enemy deals 10% more, up to +50%. ${VS.water} Every boss before stage 600 is Fire, so Brine carries boss fights.` },
    signature: { kind: 'combo', perHit: 0.1, max: 0.5 },
    sp1: { name: 'Undertow', text: '20% chance for each attack to strike twice.', effect: { kind: 'doubleStrike', value: 0.2 } },
    sp2: { name: 'Salt Spray', text: '+15% critical hit chance.', effect: { kind: 'crit', value: 0.15 } },
    aura: { name: 'Fair Winds', text: 'Whole team attacks 10% faster.', effect: { kind: 'attackSpeed', value: 0.9, team: true } } },
  { id: 'brook', rarity: 'common', name: 'Brook', element: 'water', type: 'Support', baseAtk: 2.8, baseHp: 60, range: 140, attackCooldown: 1.2, moveSpeed: 105, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1, heals: true,
    bio: 'A calm wave cleric in flowing robes who heals through a water crystal that never stops trickling.',
    basic: { name: 'Clear Spring', text: HEAL_BASIC },
    ultimate: { name: 'High Tide', text: 'Fully heals every living hero.' },
    trait: { name: 'Wave Cleric', text: `Keeps the team standing, from a little further back. ${VS.water}` },
    sp1: { name: 'Pure Water', text: 'Heals are 50% stronger.', effect: { kind: 'healPower', value: 1.5 } },
    sp2: { name: 'Still Waters', text: 'Takes 25% less damage.', effect: { kind: 'damageTaken', value: 0.75 } },
    aura: { name: 'Rain Song', text: 'Whole team takes 10% less damage.', effect: { kind: 'damageTaken', value: 0.9, team: true } } },
  { id: 'ripple', rarity: 'common', name: 'Ripple', element: 'water', type: 'Ranger', baseAtk: 6, baseHp: 44, range: 175, attackCooldown: 1.0, moveSpeed: 115, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1,
    bio: 'A fast aqua archer with a curved bow shaped like a breaking wave.',
    basic: { name: 'Wave Arrow', text: 'Long-range arrows at the nearest enemy.' },
    ultimate: { name: 'Tidal Volley', text: ULT('A wall of water arrows hits') },
    trait: { name: 'Aqua Archer', text: `The longest reach of any hero. ${VS.water}` },
    sp1: { name: 'Ricochet', text: 'Arrows pierce 1 more enemy.', effect: { kind: 'pierce', value: 1 } },
    sp2: { name: 'Crest Shot', text: '+20% critical hit chance.', effect: { kind: 'crit', value: 0.2 } },
    aura: { name: 'Flowing Aim', text: 'Whole team attacks 10% faster.', effect: { kind: 'attackSpeed', value: 0.9, team: true } } },
  { id: 'marina', rarity: 'common', name: 'Marina', element: 'water', type: 'Magician', baseAtk: 8.5, baseHp: 38, range: 160, attackCooldown: 1.5, moveSpeed: 100, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1, splash: 36,
    bio: 'A mysterious sea witch hung with shells and pearls, who carries the sea in a single orb.',
    basic: { name: 'Water Orb', text: 'Ranged bursts of seawater that splash every enemy near the target.' },
    ultimate: { name: 'Maelstrom', text: ULT('A whirlpool swallows') },
    trait: { name: 'Sea Witch', text: `Heavy area damage from far back. ${VS.water}` },
    sp1: { name: 'Whirlpool', text: 'Splash radius +50%.', effect: { kind: 'splash', value: 1.5 } },
    sp2: { name: 'Undercurrent', text: 'Every 4th attack deals 3x damage.', effect: { kind: 'everyNth', value: 3, every: 4 } },
    aura: { name: 'Deep Current', text: 'Team ATK +10%.', effect: { kind: 'atk', value: 1.1, team: true } } },

  // ---- Dark: mystery and forbidden power ----
  { id: 'shade', rarity: 'common', name: 'Shade', element: 'dark', type: 'Rogue', baseAtk: 6.5, baseHp: 46, range: 24, attackCooldown: 0.55, moveSpeed: 150, unlockCost: 50, upgradeBaseCost: 15, goldMult: 2,
    bio: 'An agile shadow blade with twin crescent daggers, in it for the loot and not pretending otherwise.',
    basic: { name: 'Crescent Cuts', text: 'Very fast stabs at the closest enemy.' },
    ultimate: { name: 'Shadow Flurry', text: ULT('Blinks through') },
    trait: { name: 'Shadow Blade', text: `Runs fastest and earns 2x gold from every kill. ${VS.dark}` },
    sp1: { name: 'Smoke Step', text: 'Dodges 25% of incoming attacks.', effect: { kind: 'dodge', value: 0.25 } },
    sp2: { name: 'Backstab', text: '+20% critical hit chance.', effect: { kind: 'crit', value: 0.2 } },
    aura: { name: 'Nightfall', text: 'Team earns 25% more gold from kills.', effect: { kind: 'gold', value: 1.25, team: true } } },
  { id: 'vex', rarity: 'common', name: 'Vex', element: 'dark', type: 'Magician', baseAtk: 9, baseHp: 36, range: 150, attackCooldown: 1.5, moveSpeed: 100, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1, splash: 40,
    bio: 'A pale-haired void sorcerer channelling a violet orb that hums when nobody is looking at it.',
    basic: { name: 'Void Bolt', text: 'Ranged void blasts that splash every enemy near the target.' },
    ultimate: { name: 'Collapse', text: ULT('A tear in the dark swallows') },
    trait: { name: 'Void Sorcerer', text: `The hardest-hitting mage, and the most fragile. ${VS.dark}` },
    sp1: { name: 'Void Rift', text: 'Splash radius +50%.', effect: { kind: 'splash', value: 1.5 } },
    sp2: { name: 'Unravel', text: 'Deals 30% more damage to bosses.', effect: { kind: 'bossDamage', value: 1.3 } },
    aura: { name: 'Forbidden Lore', text: 'Team critical hit chance +5%.', effect: { kind: 'crit', value: 0.05, team: true } } },
  { id: 'rook', rarity: 'common', name: 'Rook', element: 'dark', type: 'Ranger', baseAtk: 6.5, baseHp: 46, range: 170, attackCooldown: 1.1, moveSpeed: 110, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1,
    bio: 'A masked night stalker in dark leather with a hooked bow. Nobody has seen his face.',
    basic: { name: 'Hooked Arrow', text: 'Long-range arrows at the nearest enemy.' },
    ultimate: { name: 'Nightfall Volley', text: `${ULT('Arrows out of the dark hit')} Marks them: they take 25% more damage from the whole team for 6 seconds.` },
    ult: { kind: 'mark', mult: 1.25, seconds: 6, plusMult: 1.4, plusSeconds: 12 },
    ultPlus: 'The Mark lasts 12 seconds and adds 40% instead of 25%.',
    trait: { name: 'Executioner', text: `Long-range single-target damage. Double damage to enemies below 30% HP. ${VS.dark}` },
    signature: { kind: 'execute', below: 0.3, mult: 2 },
    sp1: { name: 'Barbed Shot', text: 'Arrows pierce 1 more enemy.', effect: { kind: 'pierce', value: 1 } },
    sp2: { name: 'Night Eyes', text: '+20% critical hit chance.', effect: { kind: 'crit', value: 0.2 } },
    aura: { name: "Hunter's Mark", text: 'Whole team deals 10% more damage to bosses.', effect: { kind: 'bossDamage', value: 1.1, team: true } } },
  { id: 'dread', rarity: 'common', name: 'Dread', element: 'dark', type: 'Knight', baseAtk: 3.2, baseHp: 150, range: 26, attackCooldown: 1.05, moveSpeed: 100, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1,
    bio: 'An imposing abyss guardian in corrupted armor behind a massive shield. He feeds on the fight.',
    basic: { name: 'Abyss Bash', text: 'Slow, heavy shield blows that shove enemies back a step.' },
    ultimate: { name: 'Black Tide', text: ULT('Darkness pours out over') },
    trait: { name: 'Abyss Guardian', text: `High HP that heals itself from damage dealt once evolved. ${VS.dark}` },
    sp1: { name: 'Corrupted Plate', text: 'Reflects 30% of damage taken back at the attacker.', effect: { kind: 'reflect', value: 0.3 } },
    sp2: { name: 'Abyssal Hunger', text: 'Heals for 25% of the damage he deals.', effect: { kind: 'lifesteal', value: 0.25 } },
    aura: { name: 'Dread Wall', text: 'Whole team takes 10% less damage.', effect: { kind: 'damageTaken', value: 0.9, team: true } } },

  // ---- Light: hope and protection ----
  { id: 'dawn', rarity: 'common', name: 'Dawn', element: 'light', type: 'Lancer', baseAtk: 5, baseHp: 65, range: 36, attackCooldown: 0.85, moveSpeed: 120, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1,
    bio: 'A bright-haired swordsman with a radiant sword, first into every fight and last to complain.',
    basic: { name: 'Radiant Slash', text: 'Quick shining slashes at the nearest enemy ahead.' },
    ultimate: { name: 'Daybreak', text: ULT('A blinding arc of light hits') },
    trait: { name: 'Light Swordsman', text: `Fast melee damage, a little sturdier. ${VS.light}` },
    sp1: { name: 'First Light', text: '20% chance for each attack to strike twice.', effect: { kind: 'doubleStrike', value: 0.2 } },
    sp2: { name: 'Radiant Edge', text: 'Deals 25% more damage to bosses.', effect: { kind: 'bossDamage', value: 1.25 } },
    aura: { name: 'Morning Glory', text: 'Team ATK +15%.', effect: { kind: 'atk', value: 1.15, team: true } } },
  { id: 'lumen', rarity: 'common', name: 'Lumen', element: 'light', type: 'Support', baseAtk: 3, baseHp: 55, range: 130, attackCooldown: 1.15, moveSpeed: 105, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1, heals: true,
    bio: 'A radiant cleric from the Lantern Queen\'s chapel, carrying a staff shaped like the sun.',
    basic: { name: 'Sunlight Mend', text: HEAL_BASIC },
    ultimate: { name: 'Dawn Chorus', text: 'Fully heals every living hero and brings back one fallen hero.' },
    ult: { kind: 'revive' },
    ultPlus: 'Brings back every fallen hero.',
    trait: { name: 'Guiding Light', text: `Healing past full HP becomes a shield, up to 20% of the ally's max HP. ${VS.light}` },
    signature: { kind: 'overheal', cap: 0.2 },
    sp1: { name: 'Halo', text: 'Heals are 50% stronger.', effect: { kind: 'healPower', value: 1.5 } },
    sp2: { name: 'Beacon', text: 'The ally she heals deals 20% more damage for 4 seconds.', effect: { kind: 'beacon', value: 1.2 } },
    aura: { name: 'Sunlit', text: 'Whole team regenerates 1% of max HP every second.', effect: { kind: 'regen', value: 0.01, team: true } } },
  { id: 'sol', rarity: 'common', name: 'Sol', element: 'light', type: 'Gunner', baseAtk: 6, baseHp: 48, range: 170, attackCooldown: 1.0, moveSpeed: 115, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1,
    bio: 'An agile sun archer with a golden bow. Her arrows leave a streak of light in the air.',
    basic: { name: 'Sun Arrow', text: 'Long-range arrows at the nearest enemy.' },
    ultimate: { name: 'Solar Flare', text: ULT('A rain of sunlit arrows hits') },
    trait: { name: 'Sun Archer', text: `Long-range single-target damage. ${VS.light}` },
    sp1: { name: 'Sunpierce', text: 'Arrows pierce 1 more enemy.', effect: { kind: 'pierce', value: 1 } },
    sp2: { name: 'Quickdraw', text: 'Attacks 20% faster.', effect: { kind: 'attackSpeed', value: 0.8 } },
    aura: { name: 'Clear Sky', text: 'Team critical hit chance +5%.', effect: { kind: 'crit', value: 0.05, team: true } } },
  { id: 'aegis', rarity: 'common', name: 'Aegis', element: 'light', type: 'Knight', baseAtk: 2.8, baseHp: 165, range: 26, attackCooldown: 1.0, moveSpeed: 100, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1,
    bio: 'A heavily armored paladin guardian with a sun-emblem shield. Nothing gets past him that he does not allow.',
    basic: { name: 'Sun Shield', text: 'Slow, heavy shield blows that shove enemies back a step.' },
    ultimate: { name: 'Judgement', text: ULT('A pillar of light falls on') },
    trait: { name: 'Paladin Guardian', text: `The highest HP of any hero. ${VS.light}` },
    sp1: { name: 'Sun Ward', text: 'Takes 25% less damage.', effect: { kind: 'damageTaken', value: 0.75 } },
    sp2: { name: 'Rally', text: 'Regenerates 3% of max HP every second.', effect: { kind: 'regen', value: 0.03 } },
    aura: { name: 'Bulwark of Dawn', text: 'Team max HP +20%.', effect: { kind: 'hp', value: 1.2, team: true } } },
];

/** Old hero ids from saves before the 20-hero roster, and who replaced them. */
export const RENAMED_HEROES: Record<string, string> = { marin: 'brine', tide: 'brine', bramble: 'thorn', pyra: 'ember', nox: 'shade', solenne: 'lumen' };

/**
 * Type chart, matching the original game: Water > Fire > Earth > Water deal 4x,
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
export const BOSS_ROTATION_START = 600;

/**
 * The element that hits a boss hardest (4x, or 2x for Light/Dark). Before stage 600 every boss is weak to
 * Water (the starter's element). From 600, each 100th-stage boss rotates:
 * Water (600), Earth (700), Fire (800), Light (900), Dark (1000), Water (1100)...
 */
export function bossWeakness(stage: number): Element {
  if (stage < BOSS_ROTATION_START || stage % 100 !== 0) return 'water';
  return WEAKNESS_ROTATION[(stage / 100 - BOSS_ROTATION_START / 100) % WEAKNESS_ROTATION.length];
}

/** The boss takes the element its weakness beats. */
export function bossElement(stage: number): Element {
  return STRONG_VS[bossWeakness(stage)];
}

export const BOSS_EVERY = 50;
export const BOSS_TIME_LIMIT = 30;
export const RESPAWN_SECONDS = 5;
export const ULT_UNLOCK_LEVEL = 30;
export const ULT_COOLDOWN = 30;
export const ULT_MULTIPLIER = 40;
export const OFFLINE_CAP_HOURS = 12;
/** 2x battle speed unlocks once the player first reaches this stage. */
export const SPEED_UNLOCK_STAGE = 25;
/** Rekindle unlocks after first clearing this stage. */
export const REKINDLE_STAGE = 125;

/** Gems for a 2x or 3x Ember payout on the Rekindle page. */
export const REKINDLE_BOOSTS: Array<{ mult: number; gems: number }> = [
  { mult: 2, gems: 80 },
  { mult: 3, gems: 160 },
];
/**
 * Rekindle Wheel (the original's Ascension Wheel): 16 slots that unlock as this
 * run's best stage passes 150, 200, 250... Each unlocked slot is one spin of
 * the wheel when you Rekindle. Prizes are never Gems (those come from rewards.ts).
 */
export const ROAD_START = 150;
export const ROAD_STEP = 50;
export const ROAD_LENGTH = 16;
export type WheelPrize = { kind: 'chest' } | { kind: 'tickets'; amount: number } | { kind: 'essence'; amount: number } | { kind: 'stones'; amount: number } | { kind: 'embers'; share: number };
export const WHEEL_PRIZES: Array<{ prize: WheelPrize; weight: number }> = [
  { prize: { kind: 'chest' }, weight: 30 },
  { prize: { kind: 'tickets', amount: 3 }, weight: 25 },
  { prize: { kind: 'essence', amount: 40 }, weight: 25 },
  { prize: { kind: 'stones', amount: 2 }, weight: 15 },
  { prize: { kind: 'embers', share: 0.05 }, weight: 20 },
];
/** Each player level adds this much to every Ember payout. */
export const KEEPER_BONUS_PER_LEVEL = 0.1;
/**
 * Hero Crests (medals) for each evolution, from Samuel's table: a hero unlocks
 * at 1★ and evolves up to 8★ (1★→2★ costs 10, ... 7★→8★ costs 5,000).
 * `stars` in the save counts evolutions, so 0 means 1★. Each evolution doubles
 * stats; 2★ and 3★ unlock SP1 and SP2, 4★ the hero's team Aura, 5★ a stronger
 * Ultimate. At 8★ further medals turn into Legendary medals.
 */
export const STAR_CRESTS = [10, 50, 250, 600, 1500, 2500, 5000];
export const MAX_STARS = STAR_CRESTS.length;
/**
 * Hero Crests (medals) a hero needs to unlock, by rarity (Samuel's table).
 * Unlocking spends them. Legendary heroes never unlock from Crests: Samuel
 * says they only come through special means (events and the like), and the
 * Hero Chest never drops them. The free starter (unlockCost 0) needs none.
 */
export const UNLOCK_CRESTS: Record<Exclude<Rarity, 'legendary'>, number> = { common: 10, rare: 30, epic: 80 };
/** Evolutions needed for each star unlock (0 = 1★): the team Aura at 4★ like the original, the stronger Ultimate at 5★. */
export const AURA_EVOLUTIONS = 3;
export const ULT_PLUS_EVOLUTIONS = 4;
/** From 5★ the Ultimate hits harder (the prototype unlocks the Ultimate itself at Lv 30). */
export const ULT_STAR_BONUS = 1.5;
/** An 8★ hero turns every this many new medals into one Legendary medal (for Legendary heroes later). */
export const LEGENDARY_MEDAL_RATE = 10;

// Gems (premium currency) and the Hero Chest summon.
export const START_GEMS = 60;
// Free Gems come from rewards.ts (dailies, login calendar, Lucky Spin, achievements, Bootcamp) and gold chests.
export const CHEST_COST = 30;
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
/** Trial medals: rarity weights for which hero of the element gets each medal. */
export const TRIAL_RARITY_WEIGHTS: Record<Exclude<Rarity, 'legendary'>, number> = { common: 80, rare: 17, epic: 3 };

export const BOSS_NAMES = ['Grubjaw the Glutton', 'Sir Rattlecan', 'Mother Mireling', 'Cogsworth Crusher', 'The Molten Abbot'];

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
];
/** Stalls collect themselves from this level. */
export const STALL_AUTO_LEVEL = 50;
/** Revenue x3 (+200%) every 50 Stall levels. */
export const STALL_MILESTONE = 50;
/** Each Rekindle: +25% Market Row revenue and +5 Stall levels (up to 600) for auto-collect Stalls. */
export const STALL_REKINDLE_REVENUE = 0.25;
export const STALL_REKINDLE_LEVELS = 5;
export const STALL_REKINDLE_LEVELS_CAP = 600;

/** Heroes that can fight at once. Matches the roster for now; matters once more heroes arrive. */
export const LINEUP_SIZE = 5;

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
export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/**
 * Trial levels from Samuel's table (original dungeon chart). Essence is the
 * resource reward, difficulty sets the boss strength (roughly the Ember level
 * the team needs), `req` is [heroes, Ember level] needed to enter, and medals
 * is how many Hero Crests random heroes of the element get on a win: one per
 * level number (level 20 pays 20), so high Trials are the main way to raise
 * stars, which push past the Rekindle wall.
 */
export interface TrialLevel { essence: number; difficulty: number; req: [number, number] | null; medals: number }
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
  medals: i + 1,
}));
export const TRIAL_TIERS = TRIAL_LEVELS.length;
export const TRIAL_TIME = 30;
/** Trials open once the stage 50 boss is beaten, so the 20 starting tickets don't flood a brand-new player with medals. */
export const TRIAL_UNLOCK_STAGE = 51;
export const TICKET_MINUTES = 30;
export const TICKET_CAP = 20;
export const TRIAL_BOSS_NAMES: Record<Element, string> = {
  water: 'Tide Warden',
  earth: 'Stone Colossus',
  fire: 'Cinder Drake',
  light: 'Dawn Seraph',
  dark: 'Night Hollow',
};
export const ESSENCE_NAMES: Record<Element, string> = {
  water: 'Tide Essence',
  earth: 'Stone Essence',
  fire: 'Cinder Essence',
  light: 'Dawn Essence',
  dark: 'Dusk Essence',
};

/**
 * Relics, the original's artifacts, following the Crush Them All wiki's list:
 * seven normal relics (1★-4★), six 4★ sets and five 5★ sets of three pieces.
 * Each piece has one or two effects. Effect numbers are the wiki's percentages,
 * reached at level 20, and grow evenly from level 1. "Village" effects work on
 * Market Row, and Prisms are Embers. Respawn time and the Griffin set's
 * Princess dream are left out.
 * Pieces the wiki leaves blank are marked `guessed` and follow their set.
 *
 * 1★ relics are open from the start; each higher star opens once a relic of
 * the star below reaches level 20. At full level, Enhance Stones raise the cap
 * by 5. 4★ and 5★ set pieces also take Enhance Stones to craft (the original's
 * Art Stones). A set's bonus turns on once every piece is crafted.
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
  /** True for pieces the wiki leaves blank; their effects follow the rest of the set. */
  guessed?: boolean;
  blurb: string;
}
const T4 = 300_000;
const T5 = 2_000_000;
export const RELICS: RelicDef[] = [
  // Normal relics
  { id: 'warbanner', name: 'Warbanner', stars: 1, fx: [['atk', 40]], essences: ['fire', 'dark'], craft: 10, blurb: 'A torn battle flag that still makes everyone swing harder.' },
  { id: 'oakheart', name: 'Oakheart Coat', stars: 1, fx: [['hp', 40]], essences: ['earth', 'water'], craft: 10, blurb: 'Bark-padded armor for the whole team.' },
  { id: 'pouch', name: 'Penny Pouch', stars: 1, fx: [['stallCost', 3]], essences: ['light', 'earth'], craft: 10, blurb: 'Stall upgrades cost less.' },
  { id: 'sundial', name: 'Pocket Sundial', stars: 1, fx: [['stallTime', 3]], essences: ['water', 'light'], craft: 10, blurb: 'Stalls finish their cycles sooner.' },
  { id: 'sawtooth', name: 'Sawtooth Sword', stars: 2, fx: [['atk', 120]], essences: ['fire', 'earth'], craft: 300, blurb: 'Bites through anything.' },
  { id: 'jackal', name: 'Jackal Idol', stars: 3, fx: [['stallCost', 48]], essences: ['fire', 'light'], craft: 5_000, blurb: 'Merchants bow to it. Stall upgrades cost much less.' },
  { id: 'starfall', name: 'Starfall Blade', stars: 4, fx: [['atk', 1080], ['hp', 1080]], essences: ['light', 'water'], craft: 40_000, blurb: 'Hammered from a fallen star.' },
  // 4★ sets
  { id: 'tide_trident', name: 'Tidelord Trident', stars: 4, set: 'tide', fx: [['water', 4320], ['def', 1620]], essences: ['water', 'dark'], craft: 100_000, stones: 2, blurb: 'Commands the sea.' },
  { id: 'tide_crown', name: 'Tidelord Crown', stars: 4, set: 'tide', fx: [['waterDef', 2160], ['stall', 1280]], essences: ['water', 'light'], craft: 100_000, stones: 2, blurb: 'Pearls from every ocean.' },
  { id: 'tide_armor', name: 'Tidelord Armor', stars: 4, set: 'tide', fx: [['waterHp', 4320], ['knightShield', 320]], essences: ['water', 'earth'], craft: 100_000, stones: 2, blurb: 'Scales of a sea giant.' },
  { id: 'gold_charm', name: 'Goldhand Charm', stars: 4, set: 'goldhand', fx: [['def', 1080], ['stallTime', 162]], essences: ['dark', 'fire'], craft: T4, stones: 2, blurb: 'Everything it touches works faster.' },
  { id: 'gold_scepter', name: 'Goldhand Scepter', stars: 4, set: 'goldhand', fx: [['atk', 2160], ['stallCost', 768]], essences: ['light', 'dark'], craft: T4, stones: 2, blurb: 'A rod of solid gold.' },
  { id: 'gold_crown', name: 'Goldhand Crown', stars: 4, set: 'goldhand', fx: [['hp', 2160], ['stallCost', 1280]], essences: ['earth', 'light'], craft: T4, stones: 2, blurb: 'Heavy is the head.' },
  { id: 'djinn_hammer', name: 'Djinn Hammer', stars: 4, set: 'djinn', fx: [['fire', 4320], ['critDmg', 160]], essences: ['fire', 'water'], craft: T4, stones: 2, blurb: 'Rings like a bell of flame.' },
  { id: 'djinn_armor', name: 'Djinn Armor', stars: 4, set: 'djinn', fx: [['fireHp', 4320], ['stall', 1280]], essences: ['fire', 'dark'], craft: T4, stones: 2, blurb: 'Forged in a lamp.' },
  { id: 'djinn_shield', name: 'Djinn Shield', stars: 4, set: 'djinn', fx: [['fireDef', 3240], ['knightShield', 320]], essences: ['fire', 'light'], craft: T4, stones: 2, blurb: 'Smoke that turns blades.' },
  { id: 'storm_shield', name: 'Stormking Shield', stars: 4, set: 'storm', fx: [['lightDef', 3240], ['stall', 1280]], essences: ['light', 'water'], craft: T4, stones: 2, blurb: 'Crackles when struck.' },
  { id: 'storm_armor', name: 'Stormking Armor', stars: 4, set: 'storm', fx: [['lightHp', 4320], ['lightDef', 3240]], essences: ['light', 'water'], craft: T4, stones: 2, blurb: 'Light heroes get much tougher.' },
  { id: 'storm_bolt', name: 'Stormking Bolt', stars: 4, set: 'storm', fx: [['light', 4320], ['lightDef', 3240]], essences: ['light', 'fire'], craft: T4, stones: 2, blurb: 'A thunderbolt in a jar.' },
  { id: 'earth_rod', name: 'Earthmother Rod', stars: 4, set: 'earthmother', fx: [['earth', 4320], ['earthDef', 3240]], essences: ['earth', 'light'], craft: T4, stones: 2, blurb: 'Roots follow where it points.' },
  { id: 'earth_armor', name: 'Earthmother Armor', stars: 4, set: 'earthmother', fx: [['earthHp', 4320]], essences: ['earth', 'water'], craft: T4, stones: 2, guessed: true, blurb: 'Woven bark and stone.' },
  { id: 'earth_helm', name: 'Earthmother Helm', stars: 4, set: 'earthmother', fx: [['earthDef', 3240], ['cost', 768]], essences: ['earth', 'water'], craft: T4, stones: 2, blurb: 'Hero levels cost less gold.' },
  { id: 'under_pendant', name: 'Underlord Pendant', stars: 4, set: 'underlord', fx: [['darkHp', 4320], ['cost', 768]], essences: ['dark', 'fire'], craft: T4, stones: 2, blurb: 'Hero levels cost less gold.' },
  { id: 'under_scythe', name: 'Underlord Scythe', stars: 4, set: 'underlord', fx: [['dark', 4320]], essences: ['dark', 'water'], craft: T4, stones: 2, blurb: 'Reaps the battlefield.' },
  { id: 'under_gauntlet', name: 'Underlord Gauntlet', stars: 4, set: 'underlord', fx: [['darkDef', 3240]], essences: ['dark', 'earth'], craft: T4, stones: 2, guessed: true, blurb: 'Cold iron from below.' },
  // 5★ sets
  { id: 'griffin_mask', name: 'Gilded Griffin Mask', stars: 5, set: 'griffin', fx: [['def', 2160], ['gold', 324]], essences: ['dark', 'fire'], craft: T5, stones: 3, blurb: 'More gold from enemies and chests.' },
  { id: 'griffin_claw', name: 'Gilded Griffin Claw', stars: 5, set: 'griffin', fx: [['atk', 4320], ['stallCost', 3072]], essences: ['light', 'dark'], craft: T5, stones: 3, blurb: 'Talons of beaten gold.' },
  { id: 'griffin_cape', name: 'Gilded Griffin Cape', stars: 5, set: 'griffin', fx: [['hp', 4320], ['stallTime', 324]], essences: ['earth', 'light'], craft: T5, stones: 3, blurb: 'Feathers that never fall.' },
  { id: 'firebird_halberd', name: 'Firebird Halberd', stars: 5, set: 'firebird', fx: [['fireHp', 8640], ['stall', 5120]], essences: ['fire', 'dark'], craft: T5, stones: 3, blurb: 'Reborn every dawn.' },
  { id: 'firebird_armor', name: 'Firebird Armor', stars: 5, set: 'firebird', fx: [['fire', 8640], ['critDmg', 320]], essences: ['fire', 'water'], craft: T5, stones: 3, blurb: 'Burns hotter with every hit.' },
  { id: 'firebird_crest', name: 'Firebird Crest', stars: 5, set: 'firebird', fx: [['fire', 4320], ['fireDef', 6480]], essences: ['fire', 'earth'], craft: T5, stones: 3, guessed: true, blurb: 'A feather that never cools.' },
  { id: 'wyrm_armor', name: 'Abyss Wyrm Armor', stars: 5, set: 'wyrm', fx: [['darkHp', 8640], ['cost', 3072]], essences: ['dark', 'fire'], craft: T5, stones: 3, blurb: 'Hero levels cost far less gold.' },
  { id: 'wyrm_fang', name: 'Abyss Wyrm Fang', stars: 5, set: 'wyrm', fx: [['dark', 8640], ['darkDef', 6480]], essences: ['dark', 'water'], craft: T5, stones: 3, guessed: true, blurb: 'Drips shadow.' },
  { id: 'wyrm_scale', name: 'Abyss Wyrm Scale', stars: 5, set: 'wyrm', fx: [['darkDef', 6480], ['stall', 5120]], essences: ['dark', 'light'], craft: T5, stones: 3, guessed: true, blurb: 'Harder than the deep.' },
  { id: 'titan_mask', name: 'Stone Titan Mask', stars: 5, set: 'titan', fx: [['earthHp', 8640], ['stall', 5120]], essences: ['earth', 'fire'], craft: T5, stones: 3, blurb: 'Older than the mountains.' },
  { id: 'titan_fist', name: 'Stone Titan Fist', stars: 5, set: 'titan', fx: [['earth', 8640], ['earthDef', 6480]], essences: ['earth', 'light'], craft: T5, stones: 3, blurb: 'Hits like a landslide.' },
  { id: 'titan_heart', name: 'Stone Titan Heart', stars: 5, set: 'titan', fx: [['earthDef', 6480], ['hp', 640]], essences: ['earth', 'dark'], craft: T5, stones: 3, guessed: true, blurb: 'Still beating, slowly.' },
  { id: 'siren_dagger', name: 'Siren Dagger', stars: 5, set: 'siren', fx: [['water', 8640], ['waterDef', 6480]], essences: ['water', 'dark'], craft: T5, stones: 3, blurb: 'Sings as it strikes.' },
  { id: 'siren_tiara', name: 'Siren Tiara', stars: 5, set: 'siren', fx: [['waterHp', 8640], ['knightShield', 640]], essences: ['water', 'earth'], craft: T5, stones: 3, blurb: 'Coral and moonlight.' },
  { id: 'siren_shield', name: 'Siren Shield', stars: 5, set: 'siren', fx: [['waterDef', 6480], ['stall', 5120]], essences: ['water', 'light'], craft: T5, stones: 3, blurb: 'A shell that turns the tide.' },
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
  { id: 'tide', name: 'Tidelord', element: 'water', bonus: [['speed', 10], ['freezeTime', 15]], text: 'Team attacks 10% faster, freeze lasts 15% longer' },
  { id: 'goldhand', name: 'Goldhand', element: null, bonus: [['embers', 30], ['stallTime', 100]], text: '+30% Embers from Rekindle, Stalls twice as fast' },
  { id: 'djinn', name: 'Djinn', element: 'fire', bonus: [['crit', 10], ['cost', 500]], text: '+10% crit chance, hero levels cost much less' },
  { id: 'storm', name: 'Stormking', element: 'light', bonus: [['hp', 1000], ['speed', 10]], text: 'Team +1,000% HP, attacks 10% faster' },
  { id: 'earthmother', name: 'Earthmother', element: 'earth', bonus: [['dodge', 10], ['def', 1000]], text: 'Team dodges 10% of attacks, +1,000% Defense' },
  { id: 'underlord', name: 'Underlord', element: 'dark', bonus: [['stunTime', 15], ['atk', 1000]], text: 'Stuns last 15% longer, team +1,000% ATK' },
  { id: 'griffin', name: 'Gilded Griffin', element: null, bonus: [['embers', 50], ['hp', 4000]], text: '+50% Embers from Rekindle, team +4,000% HP' },
  { id: 'firebird', name: 'Firebird', element: 'fire', bonus: [['burnTime', 25], ['crit', 15], ['atk', 4000]], text: 'Burns last 25% longer, +15% crit chance, team +4,000% ATK' },
  { id: 'wyrm', name: 'Abyss Wyrm', element: 'dark', bonus: [['stunTime', 25], ['cost', 750], ['atk', 4000]], text: 'Stuns last 25% longer, hero levels cost far less, team +4,000% ATK' },
  { id: 'titan', name: 'Stone Titan', element: 'earth', bonus: [['poisonTime', 25], ['dodge', 15], ['def', 4000]], text: 'Poison lasts 25% longer, team dodges 15% of attacks, +4,000% Defense' },
  { id: 'siren', name: 'Siren', element: 'water', bonus: [['freezeTime', 25], ['speed', 15], ['def', 4000]], text: 'Freeze lasts 25% longer, team attacks 15% faster, +4,000% Defense' },
];
/** Levels a relic reaches before Enhance Stones; reaching it on an N★ relic opens (N+1)★ relics. */
export const RELIC_BASE_MAX = 20;
/** Each Enhance raises the cap by this many levels, up to RELIC_ENHANCE_COSTS.length times. */
export const RELIC_ENHANCE_LEVELS = 5;
export const RELIC_ENHANCE_COSTS = [5, 10, 20, 40];
export const RELIC_MAX_STARS = Math.max(...RELICS.map((r) => r.stars));
/** Relic slots: 2 free, then up to 20 more bought with Gems once your best stage reaches each gate (22 in all, like the original). */
export const RELIC_START_SLOTS = 2;
/** About 10,700 Gems for all 20 (was ~39,000, over two years of free Gems); the stage gates still pace them. */
export const RELIC_SLOT_COSTS = [50, 75, 100, 125, 150, 200, 250, 300, 350, 400, 450, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1500];
export const RELIC_SLOT_STAGES = [25, 50, 100, 150, 200, 250, 300, 400, 500, 600, 700, 800, 900, 1000, 1200, 1400, 1600, 1800, 2000, 2500];

// ---------- guilds (server rules live in supabase/guilds.sql) ----------

export const GUILD_MAX_MEMBERS = 30;
/** Medals a guild request asks for, by the hero's rarity. Rarer heroes ask for fewer. Legendary heroes can't be requested. */
export const GUILD_REQUEST_GOALS: Record<Exclude<Rarity, 'legendary'>, number> = { common: 20, rare: 10, epic: 5 };
/** Hours between a player's guild requests, and how long a request stays open. */
export const GUILD_REQUEST_HOURS = 8;
export const GUILD_REQUEST_OPEN_HOURS = 24;
/** Most medals one guildmate can give to one request. */
export const GUILD_DONATE_MAX = 5;
/** Guild Coins a donor earns per medal given, by the hero's rarity. */
export const GUILD_CREDITS_PER_MEDAL: Record<Exclude<Rarity, 'legendary'>, number> = { common: 3, rare: 6, epic: 12 };
export type GuildShopId = 'chest' | 'stone' | 'tickets';
/** What Guild Coins buy. */
export const GUILD_SHOP: Array<{ id: GuildShopId; name: string; text: string; cost: number }> = [
  { id: 'chest', name: 'Hero Chest', text: '3 drops of Hero Crests, like the Gem chest.', cost: 60 },
  { id: 'stone', name: 'Enhance Stone', text: 'Raises a relic\'s level cap or crafts set pieces.', cost: 40 },
  { id: 'tickets', name: '5 Trial tickets', text: 'Up to the usual cap of 20.', cost: 30 },
];

/** Guild Boss: attempts per player per day (UTC), and how long each attempt lasts. */
export const GUILD_BOSS_ATTEMPTS = 3;
export const GUILD_BOSS_SECONDS = 30;
/** Rough number of solid attempts a boss is built to take; one such attempt earns the full damage bonus. */
export const GUILD_BOSS_PAR_ATTEMPTS = 15;
/** Gold per attempt, in minutes of income. */
export const GUILD_BOSS_GOLD_MINUTES = 30;
/** Boss for each day's element (the server picks the element). */
export const GUILD_BOSS_NAMES: Record<Element, string> = {
  water: 'Leviathan of the Deep',
  fire: 'Cinder Tyrant',
  earth: 'Mountain Behemoth',
  light: 'Radiant Seraph',
  dark: 'Night Devourer',
};
