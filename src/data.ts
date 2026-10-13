export type Element = 'water' | 'fire' | 'earth' | 'light' | 'dark';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type Job = 'Blademaster' | 'Mage' | 'Knight' | 'Rogue' | 'Ranger' | 'Support';

export interface HeroDef {
  id: string;
  name: string;
  element: Element;
  rarity: Rarity;
  job: Job;
  /** Attack and HP at gold level 1. */
  baseAtk: number;
  baseHp: number;
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
 * healPower, respawn = respawn time). everyNth multiplies every `every`th attack by `value`.
 * team: true applies to the whole lineup; otherwise only the hero who owns it.
 */
export type EffectKind =
  | 'atk' | 'hp' | 'crit' | 'dodge' | 'doubleStrike' | 'reflect' | 'regen' | 'lifesteal' | 'pierce'
  | 'damageTaken' | 'attackSpeed' | 'splash' | 'bossDamage' | 'gold' | 'healPower' | 'respawn' | 'everyNth';

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
// Job baselines (each hero varies a little): Blademaster quick melee, Knight high-HP front line,
// Mage ranged splash, Rogue fast melee with 2x gold, Ranger long-range single target, Support healer.
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
  { id: 'blaze', rarity: 'common', name: 'Blaze', element: 'fire', job: 'Blademaster', baseAtk: 5.5, baseHp: 55, range: 28, attackCooldown: 0.75, moveSpeed: 125, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1,
    bio: 'A young red-haired swordsman whose blade catches fire when he gets excited, which is always.',
    basic: { name: 'Searing Slash', text: 'Quick flaming slashes at the nearest enemy ahead.' },
    ultimate: { name: 'Wildfire Arc', text: ULT('One huge burning sweep hits') },
    trait: { name: 'Blademaster', text: `Fast melee damage. ${VS.fire}` },
    sp1: { name: 'Flashfire', text: '20% chance for each attack to strike twice.', effect: { kind: 'doubleStrike', value: 0.2 } },
    sp2: { name: 'Burning Edge', text: 'Deals 25% more damage to bosses.', effect: { kind: 'bossDamage', value: 1.25 } },
    aura: { name: 'Kindled Spirit', text: 'Team ATK +15%.', effect: { kind: 'atk', value: 1.15, team: true } } },
  { id: 'ember', rarity: 'common', name: 'Ember', element: 'fire', job: 'Mage', baseAtk: 8, baseHp: 40, range: 150, attackCooldown: 1.4, moveSpeed: 105, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1, splash: 40,
    bio: 'An energetic arcanist with flame-shaped hair ornaments and a fire orb she never puts down.',
    basic: { name: 'Fire Orb', text: 'Ranged fireballs that splash every enemy near the target.' },
    ultimate: { name: 'Meteor Shower', text: ULT('Rains fire on') },
    trait: { name: 'Arcanist', text: `Long range and area damage. ${VS.fire}` },
    sp1: { name: 'Flare Burst', text: 'Fireball splash radius +50%.', effect: { kind: 'splash', value: 1.5 } },
    sp2: { name: 'Overheat', text: 'Every 4th attack deals 3x damage.', effect: { kind: 'everyNth', value: 3, every: 4 } },
    aura: { name: 'Heat Shimmer', text: 'Team critical hit chance +5%.', effect: { kind: 'crit', value: 0.05, team: true } } },
  { id: 'flint', rarity: 'common', name: 'Flint', element: 'fire', job: 'Rogue', baseAtk: 6, baseHp: 50, range: 24, attackCooldown: 0.6, moveSpeed: 145, unlockCost: 50, upgradeBaseCost: 15, goldMult: 2,
    bio: 'An agile flame striker with two daggers and armor that glows like banked coals.',
    basic: { name: 'Spark Daggers', text: 'Very fast stabs at the closest enemy.' },
    ultimate: { name: 'Cinder Storm', text: ULT('Dashes through') },
    trait: { name: 'Flame Striker', text: `Runs fast and earns 2x gold from every kill. ${VS.fire}` },
    sp1: { name: 'Spark Step', text: 'Dodges 25% of incoming attacks.', effect: { kind: 'dodge', value: 0.25 } },
    sp2: { name: 'Ember Edge', text: '+20% critical hit chance.', effect: { kind: 'crit', value: 0.2 } },
    aura: { name: 'Scorched Loot', text: 'Team earns 25% more gold from kills.', effect: { kind: 'gold', value: 1.25, team: true } } },
  { id: 'cinder', rarity: 'common', name: 'Cinder', element: 'fire', job: 'Knight', baseAtk: 3, baseHp: 160, range: 26, attackCooldown: 1.1, moveSpeed: 100, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1,
    bio: 'A bulky inferno guardian who carries a shield of cooling magma and stands in front of everyone.',
    basic: { name: 'Magma Bash', text: 'Slow, heavy shield blows that shove enemies back a step.' },
    ultimate: { name: 'Eruption', text: ULT('Slams the shield down, bursting magma under') },
    trait: { name: 'Inferno Guardian', text: `Very high HP. ${VS.fire}` },
    sp1: { name: 'Magma Skin', text: 'Reflects 30% of damage taken back at the attacker.', effect: { kind: 'reflect', value: 0.3 } },
    sp2: { name: 'Molten Core', text: 'Takes 25% less damage.', effect: { kind: 'damageTaken', value: 0.75 } },
    aura: { name: 'Forge Wall', text: 'Whole team takes 10% less damage.', effect: { kind: 'damageTaken', value: 0.9, team: true } } },

  // ---- Earth (Grass): life and growth ----
  { id: 'briar', rarity: 'common', name: 'Briar', element: 'earth', job: 'Ranger', baseAtk: 5.5, baseHp: 45, range: 165, attackCooldown: 0.9, moveSpeed: 115, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1,
    bio: 'A nimble leaf ranger in leaf-shaped armor who can put an arrow through a falling acorn.',
    basic: { name: 'Leaf Arrow', text: 'Long-range arrows at the nearest enemy.' },
    ultimate: { name: 'Thornrain', text: ULT('A volley of thorned arrows hits') },
    trait: { name: 'Leaf Ranger', text: `Long-range single-target damage. ${VS.earth}` },
    sp1: { name: 'Split Shot', text: 'Arrows pierce 1 more enemy.', effect: { kind: 'pierce', value: 1 } },
    sp2: { name: 'Quickdraw', text: 'Attacks 20% faster.', effect: { kind: 'attackSpeed', value: 0.8 } },
    aura: { name: 'Canopy Cover', text: 'Whole team dodges 5% of attacks.', effect: { kind: 'dodge', value: 0.05, team: true } } },
  { id: 'fern', rarity: 'common', name: 'Fern', element: 'earth', job: 'Support', baseAtk: 3, baseHp: 55, range: 130, attackCooldown: 1.2, moveSpeed: 105, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1, heals: true,
    bio: 'A gentle sylvan healer whose wooden staff is still alive and occasionally flowers.',
    basic: { name: 'Sap Mend', text: HEAL_BASIC },
    ultimate: { name: 'Spring Bloom', text: 'Fully heals every living hero.' },
    trait: { name: 'Sylvan Healer', text: `Keeps the team standing. ${VS.earth}` },
    sp1: { name: 'Green Touch', text: 'Heals are 50% stronger.', effect: { kind: 'healPower', value: 1.5 } },
    sp2: { name: 'Seedbed', text: 'Fallen heroes respawn twice as fast.', effect: { kind: 'respawn', value: 0.5, team: true } },
    aura: { name: 'Bloom', text: 'Whole team regenerates 1% of max HP every second.', effect: { kind: 'regen', value: 0.01, team: true } } },
  { id: 'thorn', rarity: 'common', name: 'Thorn', element: 'earth', job: 'Knight', baseAtk: 3.5, baseHp: 140, range: 34, attackCooldown: 1.0, moveSpeed: 105, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1,
    bio: 'A sturdy thorn sentinel in bark armor. His thorn spear gives him a little more reach than other knights.',
    basic: { name: 'Thorn Thrust', text: 'Heavy spear thrusts with a little extra reach that shove enemies back.' },
    ultimate: { name: 'Bramble Wall', text: ULT('Thorns burst from the ground under') },
    trait: { name: 'Thorn Sentinel', text: `High HP and a longer reach. ${VS.earth}` },
    sp1: { name: 'Thornmail', text: 'Reflects 30% of damage taken back at the attacker.', effect: { kind: 'reflect', value: 0.3 } },
    sp2: { name: 'Taproot', text: 'Regenerates 3% of max HP every second.', effect: { kind: 'regen', value: 0.03 } },
    aura: { name: 'Old Growth', text: 'Team max HP +20%.', effect: { kind: 'hp', value: 1.2, team: true } } },
  { id: 'moss', rarity: 'common', name: 'Moss', element: 'earth', job: 'Mage', baseAtk: 7, baseHp: 48, range: 140, attackCooldown: 1.5, moveSpeed: 100, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1, splash: 48,
    bio: 'A hooded root druid whose staff is crowned with a seed that glows when something nearby is growing.',
    basic: { name: 'Spore Burst', text: 'Ranged spore clouds that splash every enemy near the target.' },
    ultimate: { name: 'Root Eruption', text: ULT('Giant roots crash up beneath') },
    trait: { name: 'Root Druid', text: `Wide area damage. ${VS.earth}` },
    sp1: { name: 'Spore Cloud', text: 'Splash radius +50%.', effect: { kind: 'splash', value: 1.5 } },
    sp2: { name: 'Deep Roots', text: 'Deals 30% more damage to bosses.', effect: { kind: 'bossDamage', value: 1.3 } },
    aura: { name: 'Living Grove', text: 'Whole team attacks 10% faster.', effect: { kind: 'attackSpeed', value: 0.9, team: true } } },

  // ---- Water: adaptability and wisdom ----
  { id: 'brine', rarity: 'common', name: 'Brine', element: 'water', job: 'Blademaster', baseAtk: 5, baseHp: 60, range: 28, attackCooldown: 0.8, moveSpeed: 120, unlockCost: 0, upgradeBaseCost: 5, goldMult: 1,
    bio: 'A young tidecoast sailor with a cutlass and a sea-blue scarf, sworn to bring the Lantern Queen home. The reason every early boss goes down.',
    basic: { name: 'Cutlass Slash', text: 'Fast cutlass slashes at the nearest enemy ahead.' },
    ultimate: { name: 'Riptide', text: ULT('A crashing wave hits') },
    trait: { name: 'Tidecoast Sailor', text: `${VS.water} Every boss before stage 600 is Fire, so Brine carries boss fights.` },
    sp1: { name: 'Undertow', text: '20% chance for each attack to strike twice.', effect: { kind: 'doubleStrike', value: 0.2 } },
    sp2: { name: 'Sea Legs', text: 'Takes 25% less damage.', effect: { kind: 'damageTaken', value: 0.75 } },
    aura: { name: 'Tidal Calm', text: 'Team max HP +20%.', effect: { kind: 'hp', value: 1.2, team: true } } },
  { id: 'brook', rarity: 'common', name: 'Brook', element: 'water', job: 'Support', baseAtk: 2.8, baseHp: 60, range: 140, attackCooldown: 1.2, moveSpeed: 105, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1, heals: true,
    bio: 'A calm wave cleric in flowing robes who heals through a water crystal that never stops trickling.',
    basic: { name: 'Clear Spring', text: HEAL_BASIC },
    ultimate: { name: 'High Tide', text: 'Fully heals every living hero.' },
    trait: { name: 'Wave Cleric', text: `Keeps the team standing, from a little further back. ${VS.water}` },
    sp1: { name: 'Pure Water', text: 'Heals are 50% stronger.', effect: { kind: 'healPower', value: 1.5 } },
    sp2: { name: 'Still Waters', text: 'Takes 25% less damage.', effect: { kind: 'damageTaken', value: 0.75 } },
    aura: { name: 'Rain Song', text: 'Whole team takes 10% less damage.', effect: { kind: 'damageTaken', value: 0.9, team: true } } },
  { id: 'ripple', rarity: 'common', name: 'Ripple', element: 'water', job: 'Ranger', baseAtk: 6, baseHp: 44, range: 175, attackCooldown: 1.0, moveSpeed: 115, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1,
    bio: 'A fast aqua archer with a curved bow shaped like a breaking wave.',
    basic: { name: 'Wave Arrow', text: 'Long-range arrows at the nearest enemy.' },
    ultimate: { name: 'Tidal Volley', text: ULT('A wall of water arrows hits') },
    trait: { name: 'Aqua Archer', text: `The longest reach of any hero. ${VS.water}` },
    sp1: { name: 'Ricochet', text: 'Arrows pierce 1 more enemy.', effect: { kind: 'pierce', value: 1 } },
    sp2: { name: 'Crest Shot', text: '+20% critical hit chance.', effect: { kind: 'crit', value: 0.2 } },
    aura: { name: 'Flowing Aim', text: 'Whole team attacks 10% faster.', effect: { kind: 'attackSpeed', value: 0.9, team: true } } },
  { id: 'marina', rarity: 'common', name: 'Marina', element: 'water', job: 'Mage', baseAtk: 8.5, baseHp: 38, range: 160, attackCooldown: 1.5, moveSpeed: 100, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1, splash: 36,
    bio: 'A mysterious sea witch hung with shells and pearls, who carries the sea in a single orb.',
    basic: { name: 'Water Orb', text: 'Ranged bursts of seawater that splash every enemy near the target.' },
    ultimate: { name: 'Maelstrom', text: ULT('A whirlpool swallows') },
    trait: { name: 'Sea Witch', text: `Heavy area damage from far back. ${VS.water}` },
    sp1: { name: 'Whirlpool', text: 'Splash radius +50%.', effect: { kind: 'splash', value: 1.5 } },
    sp2: { name: 'Undercurrent', text: 'Every 4th attack deals 3x damage.', effect: { kind: 'everyNth', value: 3, every: 4 } },
    aura: { name: 'Deep Current', text: 'Team ATK +10%.', effect: { kind: 'atk', value: 1.1, team: true } } },

  // ---- Dark: mystery and forbidden power ----
  { id: 'shade', rarity: 'common', name: 'Shade', element: 'dark', job: 'Rogue', baseAtk: 6.5, baseHp: 46, range: 24, attackCooldown: 0.55, moveSpeed: 150, unlockCost: 50, upgradeBaseCost: 15, goldMult: 2,
    bio: 'An agile shadow blade with twin crescent daggers, in it for the loot and not pretending otherwise.',
    basic: { name: 'Crescent Cuts', text: 'Very fast stabs at the closest enemy.' },
    ultimate: { name: 'Shadow Flurry', text: ULT('Blinks through') },
    trait: { name: 'Shadow Blade', text: `Runs fastest and earns 2x gold from every kill. ${VS.dark}` },
    sp1: { name: 'Smoke Step', text: 'Dodges 25% of incoming attacks.', effect: { kind: 'dodge', value: 0.25 } },
    sp2: { name: 'Backstab', text: '+20% critical hit chance.', effect: { kind: 'crit', value: 0.2 } },
    aura: { name: 'Nightfall', text: 'Team earns 25% more gold from kills.', effect: { kind: 'gold', value: 1.25, team: true } } },
  { id: 'vex', rarity: 'common', name: 'Vex', element: 'dark', job: 'Mage', baseAtk: 9, baseHp: 36, range: 150, attackCooldown: 1.5, moveSpeed: 100, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1, splash: 40,
    bio: 'A pale-haired void sorcerer channelling a violet orb that hums when nobody is looking at it.',
    basic: { name: 'Void Bolt', text: 'Ranged void blasts that splash every enemy near the target.' },
    ultimate: { name: 'Collapse', text: ULT('A tear in the dark swallows') },
    trait: { name: 'Void Sorcerer', text: `The hardest-hitting mage, and the most fragile. ${VS.dark}` },
    sp1: { name: 'Void Rift', text: 'Splash radius +50%.', effect: { kind: 'splash', value: 1.5 } },
    sp2: { name: 'Unravel', text: 'Deals 30% more damage to bosses.', effect: { kind: 'bossDamage', value: 1.3 } },
    aura: { name: 'Forbidden Lore', text: 'Team critical hit chance +5%.', effect: { kind: 'crit', value: 0.05, team: true } } },
  { id: 'rook', rarity: 'common', name: 'Rook', element: 'dark', job: 'Ranger', baseAtk: 6.5, baseHp: 46, range: 170, attackCooldown: 1.1, moveSpeed: 110, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1,
    bio: 'A masked night stalker in dark leather with a hooked bow. Nobody has seen his face.',
    basic: { name: 'Hooked Arrow', text: 'Long-range arrows at the nearest enemy.' },
    ultimate: { name: 'Nightfall Volley', text: ULT('Arrows out of the dark hit') },
    trait: { name: 'Night Stalker', text: `Long-range single-target damage. ${VS.dark}` },
    sp1: { name: 'Barbed Shot', text: 'Arrows pierce 1 more enemy.', effect: { kind: 'pierce', value: 1 } },
    sp2: { name: 'Night Eyes', text: '+20% critical hit chance.', effect: { kind: 'crit', value: 0.2 } },
    aura: { name: "Hunter's Mark", text: 'Whole team deals 10% more damage to bosses.', effect: { kind: 'bossDamage', value: 1.1, team: true } } },
  { id: 'dread', rarity: 'common', name: 'Dread', element: 'dark', job: 'Knight', baseAtk: 3.2, baseHp: 150, range: 26, attackCooldown: 1.05, moveSpeed: 100, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1,
    bio: 'An imposing abyss guardian in corrupted armor behind a massive shield. He feeds on the fight.',
    basic: { name: 'Abyss Bash', text: 'Slow, heavy shield blows that shove enemies back a step.' },
    ultimate: { name: 'Black Tide', text: ULT('Darkness pours out over') },
    trait: { name: 'Abyss Guardian', text: `High HP that heals itself from damage dealt once evolved. ${VS.dark}` },
    sp1: { name: 'Corrupted Plate', text: 'Reflects 30% of damage taken back at the attacker.', effect: { kind: 'reflect', value: 0.3 } },
    sp2: { name: 'Abyssal Hunger', text: 'Heals for 25% of the damage he deals.', effect: { kind: 'lifesteal', value: 0.25 } },
    aura: { name: 'Dread Wall', text: 'Whole team takes 10% less damage.', effect: { kind: 'damageTaken', value: 0.9, team: true } } },

  // ---- Light: hope and protection ----
  { id: 'dawn', rarity: 'common', name: 'Dawn', element: 'light', job: 'Blademaster', baseAtk: 5, baseHp: 65, range: 28, attackCooldown: 0.85, moveSpeed: 120, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1,
    bio: 'A bright-haired swordsman with a radiant sword, first into every fight and last to complain.',
    basic: { name: 'Radiant Slash', text: 'Quick shining slashes at the nearest enemy ahead.' },
    ultimate: { name: 'Daybreak', text: ULT('A blinding arc of light hits') },
    trait: { name: 'Light Swordsman', text: `Fast melee damage, a little sturdier. ${VS.light}` },
    sp1: { name: 'First Light', text: '20% chance for each attack to strike twice.', effect: { kind: 'doubleStrike', value: 0.2 } },
    sp2: { name: 'Radiant Edge', text: 'Deals 25% more damage to bosses.', effect: { kind: 'bossDamage', value: 1.25 } },
    aura: { name: 'Morning Glory', text: 'Team ATK +15%.', effect: { kind: 'atk', value: 1.15, team: true } } },
  { id: 'lumen', rarity: 'common', name: 'Lumen', element: 'light', job: 'Support', baseAtk: 3.2, baseHp: 52, range: 130, attackCooldown: 1.15, moveSpeed: 105, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1, heals: true,
    bio: 'A radiant cleric from the Lantern Queen\'s chapel, carrying a staff shaped like the sun.',
    basic: { name: 'Sunlight Mend', text: HEAL_BASIC },
    ultimate: { name: 'Dawn Chorus', text: 'Fully heals every living hero.' },
    trait: { name: 'Radiant Cleric', text: `Keeps the team standing, and heals the fastest. ${VS.light}` },
    sp1: { name: 'Halo', text: 'Heals are 50% stronger.', effect: { kind: 'healPower', value: 1.5 } },
    sp2: { name: 'Sanctuary', text: 'Fallen heroes respawn twice as fast.', effect: { kind: 'respawn', value: 0.5, team: true } },
    aura: { name: 'Sunlit', text: 'Whole team regenerates 1% of max HP every second.', effect: { kind: 'regen', value: 0.01, team: true } } },
  { id: 'sol', rarity: 'common', name: 'Sol', element: 'light', job: 'Ranger', baseAtk: 6, baseHp: 48, range: 170, attackCooldown: 1.0, moveSpeed: 115, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1,
    bio: 'An agile sun archer with a golden bow. Her arrows leave a streak of light in the air.',
    basic: { name: 'Sun Arrow', text: 'Long-range arrows at the nearest enemy.' },
    ultimate: { name: 'Solar Flare', text: ULT('A rain of sunlit arrows hits') },
    trait: { name: 'Sun Archer', text: `Long-range single-target damage. ${VS.light}` },
    sp1: { name: 'Sunpierce', text: 'Arrows pierce 1 more enemy.', effect: { kind: 'pierce', value: 1 } },
    sp2: { name: 'Quickdraw', text: 'Attacks 20% faster.', effect: { kind: 'attackSpeed', value: 0.8 } },
    aura: { name: 'Clear Sky', text: 'Team critical hit chance +5%.', effect: { kind: 'crit', value: 0.05, team: true } } },
  { id: 'aegis', rarity: 'common', name: 'Aegis', element: 'light', job: 'Knight', baseAtk: 2.8, baseHp: 165, range: 26, attackCooldown: 1.0, moveSpeed: 100, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1,
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
export const CRIT_CHANCE = 0.12;
export const CRIT_MULTIPLIER = 2.5;
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
 * is how many random heroes of the element get a Hero Crest on a win.
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
  medals: i + 1 >= 16 ? 2 : 1,
}));
export const TRIAL_TIERS = TRIAL_LEVELS.length;
export const TRIAL_TIME = 30;
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
 * Relics, the original's artifacts: passive boosts crafted and levelled with
 * Trial Essence. Each relic has a fixed star rating from 1★ to 6★: more stars
 * means a bigger bonus per level and a higher price. The first 1★ relics are
 * open from the start; each higher star opens once a relic of the star below
 * reaches its full base level. At full level, Enhance Stones raise the cap by 5.
 *
 * Kinds: global (the whole team), element (heroes of one element) and economy
 * (gold, Market Row, hero level costs, Trial rewards, offline gold).
 * Pieces of a set give an extra bonus once every piece is crafted.
 */
export type RelicEffect =
  | 'atk' | 'hp' | 'power' | 'speed' | 'crit' | 'critDmg'
  | 'gold' | 'stall' | 'cost' | 'trial' | 'essence' | 'offline'
  | Element;
export type RelicKind = 'global' | 'element' | 'economy';
export interface RelicDef {
  id: string;
  name: string;
  stars: number;
  effect: RelicEffect;
  /** Bonus per level, in percent (crit: percentage points of crit chance). */
  perLevel: number;
  essences: [Element, Element];
  set?: string;
  blurb: string;
}
export const RELIC_KIND_NAMES: Record<RelicKind, string> = { global: 'Whole team', element: 'Element', economy: 'Economy' };
export function relicKind(effect: RelicEffect): RelicKind {
  if (effect === 'water' || effect === 'earth' || effect === 'fire' || effect === 'light' || effect === 'dark') return 'element';
  if (['gold', 'stall', 'cost', 'trial', 'essence', 'offline'].includes(effect)) return 'economy';
  return 'global';
}
export const RELICS: RelicDef[] = [
  // Global
  { id: 'warbanner', name: 'Warbanner', stars: 1, effect: 'atk', perLevel: 5, essences: ['fire', 'dark'], blurb: 'A torn battle flag that still makes everyone swing harder.' },
  { id: 'oakheart', name: 'Oakheart', stars: 1, effect: 'hp', perLevel: 5, essences: ['earth', 'water'], blurb: 'A living acorn that hardens skin like bark.' },
  { id: 'kingsblade', name: 'Kingsblade', stars: 3, effect: 'power', perLevel: 8, essences: ['light', 'fire'], blurb: 'Raises ATK and HP for the whole team.' },
  { id: 'wardrum', name: 'War Drum', stars: 4, effect: 'speed', perLevel: 1, essences: ['earth', 'fire'], blurb: 'Every beat makes the team attack faster.' },
  { id: 'titancrown', name: 'Titan Crown', stars: 5, effect: 'power', perLevel: 18, essences: ['earth', 'light'], blurb: 'Raises ATK and HP for the whole team.' },
  { id: 'starforge', name: 'Starforged Edge', stars: 6, effect: 'power', perLevel: 30, essences: ['dark', 'light'], blurb: 'Hammered from a fallen star. Huge ATK and HP for everyone.' },
  // Economy
  { id: 'luckycoin', name: 'Lucky Coin', stars: 1, effect: 'gold', perLevel: 5, essences: ['light', 'earth'], blurb: 'Always lands heads. Enemies drop more gold.' },
  { id: 'scale', name: "Merchant's Scale", stars: 1, effect: 'stall', perLevel: 5, essences: ['water', 'light'], blurb: 'Tips every deal your way on Market Row.' },
  { id: 'ledger', name: "Haggler's Ledger", stars: 2, effect: 'cost', perLevel: 3, essences: ['earth', 'dark'], blurb: 'Hero levels cost less gold. Works without a slot.' },
  { id: 'sigil', name: 'Trial Sigil', stars: 2, effect: 'trial', perLevel: 10, essences: ['dark', 'fire'], blurb: 'Glows near Trial bosses and finds their weak spots.' },
  { id: 'hourglass', name: 'Sleeping Hourglass', stars: 2, effect: 'offline', perLevel: 5, essences: ['water', 'dark'], blurb: 'More gold while you are away.' },
  { id: 'satchel', name: "Delver's Satchel", stars: 3, effect: 'essence', perLevel: 4, essences: ['fire', 'water'], blurb: 'More Essence from every Trial win.' },
  // Tidecaller set (Water)
  { id: 'pearl', name: 'Tide Pearl', stars: 2, effect: 'water', perLevel: 10, essences: ['water', 'light'], set: 'tide', blurb: 'Sea-song in a shell. Water heroes hit harder.' },
  { id: 'trident', name: 'Tidecaller Trident', stars: 3, effect: 'speed', perLevel: 1, essences: ['water', 'earth'], set: 'tide', blurb: 'The team attacks faster.' },
  { id: 'coral', name: 'Coral Crown', stars: 4, effect: 'water', perLevel: 25, essences: ['water', 'dark'], set: 'tide', blurb: 'Water heroes hit much harder.' },
  // Ashwing set (Fire)
  { id: 'fang', name: 'Cinder Fang', stars: 2, effect: 'fire', perLevel: 10, essences: ['fire', 'earth'], set: 'ash', blurb: 'Still warm. Fire heroes hit harder.' },
  { id: 'plume', name: 'Ashwing Plume', stars: 3, effect: 'crit', perLevel: 0.5, essences: ['fire', 'light'], set: 'ash', blurb: 'More critical hits for the team.' },
  { id: 'emberheart', name: 'Ember Heart', stars: 4, effect: 'fire', perLevel: 25, essences: ['fire', 'dark'], set: 'ash', blurb: 'Fire heroes hit much harder.' },
  // Mountain set (Earth)
  { id: 'idol', name: 'Stone Idol', stars: 2, effect: 'earth', perLevel: 10, essences: ['earth', 'dark'], set: 'mountain', blurb: 'A mossy idol that steadies Earth heroes.' },
  { id: 'gauntlet', name: 'Granite Gauntlet', stars: 3, effect: 'hp', perLevel: 8, essences: ['earth', 'fire'], set: 'mountain', blurb: 'The whole team gets tougher.' },
  { id: 'rootcrown', name: 'Root Crown', stars: 4, effect: 'earth', perLevel: 25, essences: ['earth', 'water'], set: 'mountain', blurb: 'Earth heroes hit much harder.' },
  // Sunspire set (Light)
  { id: 'feather', name: 'Dawn Feather', stars: 2, effect: 'light', perLevel: 10, essences: ['light', 'water'], set: 'sun', blurb: 'Drifts upward. Light heroes hit harder.' },
  { id: 'sundisc', name: 'Sun Disc', stars: 3, effect: 'gold', perLevel: 8, essences: ['light', 'fire'], set: 'sun', blurb: 'Enemies drop more gold.' },
  { id: 'halo', name: 'Halo of Dawn', stars: 4, effect: 'light', perLevel: 25, essences: ['light', 'earth'], set: 'sun', blurb: 'Light heroes hit much harder.' },
  // Nightveil set (Dark)
  { id: 'mask', name: 'Dusk Mask', stars: 2, effect: 'dark', perLevel: 10, essences: ['dark', 'fire'], set: 'night', blurb: 'Smiles in the dark. Dark heroes hit harder.' },
  { id: 'cloak', name: 'Shadow Cloak', stars: 3, effect: 'critDmg', perLevel: 3, essences: ['dark', 'water'], set: 'night', blurb: 'Critical hits deal more damage.' },
  { id: 'lantern', name: 'Void Lantern', stars: 4, effect: 'dark', perLevel: 25, essences: ['dark', 'light'], set: 'night', blurb: 'Dark heroes hit much harder.' },
];
export interface RelicSetDef {
  id: string;
  name: string;
  element: Element;
  /** Bonuses (same units as RelicDef.perLevel totals) once every piece is crafted. */
  bonus: Array<[RelicEffect, number]>;
  text: string;
}
export const RELIC_SETS: RelicSetDef[] = [
  { id: 'tide', name: 'Tidecaller', element: 'water', bonus: [['water', 50], ['speed', 10]], text: 'Water heroes +50% ATK, team attacks 10% faster' },
  { id: 'ash', name: 'Ashwing', element: 'fire', bonus: [['fire', 50], ['crit', 5]], text: 'Fire heroes +50% ATK, +5% crit chance' },
  { id: 'mountain', name: 'Mountain', element: 'earth', bonus: [['earth', 50], ['hp', 30]], text: 'Earth heroes +50% ATK, team +30% HP' },
  { id: 'sun', name: 'Sunspire', element: 'light', bonus: [['light', 50], ['gold', 30]], text: 'Light heroes +50% ATK, +30% gold' },
  { id: 'night', name: 'Nightveil', element: 'dark', bonus: [['dark', 50], ['critDmg', 50]], text: 'Dark heroes +50% ATK, crits deal +50% damage' },
];
/** Levels a relic reaches before Enhance Stones; reaching it on an N★ relic opens (N+1)★ relics. */
export const RELIC_BASE_MAX = 20;
/** Each Enhance raises the cap by this many levels, up to RELIC_ENHANCE_COSTS.length times. */
export const RELIC_ENHANCE_LEVELS = 5;
export const RELIC_ENHANCE_COSTS = [5, 10, 20, 40];
/** Essence price multiplier by star (index 0 = 1★). */
export const RELIC_STAR_COST = [1, 2, 4, 8, 16, 32];
export const RELIC_MAX_STARS = 6;
/** Hero level cost reduction from relics never goes past this. */
export const RELIC_COST_CAP = 0.75;
/** Relic slots: 2 free, then bought with Gems once your best stage reaches the gate. */
export const RELIC_START_SLOTS = 2;
export const RELIC_SLOT_COSTS = [150, 300, 600, 1200];
export const RELIC_SLOT_STAGES = [25, 100, 250, 500];
