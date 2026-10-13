export type Element = 'water' | 'fire' | 'earth' | 'light' | 'dark';
export type Job = 'Blademaster' | 'Mage' | 'Knight' | 'Rogue' | 'Support';

export interface HeroDef {
  id: string;
  name: string;
  element: Element;
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
  /** Unlocked by evolving with Hero Crests: SP1 at 1★, SP2 at 2★, the Aura at 4★. */
  sp1: Ability;
  sp2: Ability;
  aura: Ability;
}

export interface Ability {
  name: string;
  text: string;
}

export const ELEMENT_COLORS: Record<Element, number> = {
  water: 0x3fa9f5,
  fire: 0xf5603f,
  earth: 0x6cbf3a,
  light: 0xf5d63f,
  dark: 0x9b59d0,
};

// Starter cast from GDD section 17. The prototype runs a team of five, one per element.
export const HEROES: HeroDef[] = [
  { id: 'marin', name: 'Marin', element: 'water', job: 'Blademaster', baseAtk: 5, baseHp: 60, range: 28, attackCooldown: 0.8, moveSpeed: 120, unlockCost: 0, upgradeBaseCost: 5, goldMult: 1, bio: 'A tidecoast swordsman who signed on to bring the Lantern Queen home. Steady, quick, and the reason every early boss goes down.',
    basic: { name: 'Tide Cutter', text: 'Fast sword slashes at the nearest enemy ahead.' },
    ultimate: { name: 'Riptide', text: 'A crashing wave hits every enemy ahead for 40x ATK, with element bonuses.' },
    trait: { name: 'Water Blade', text: 'Water deals 4x to Fire. Every boss before stage 600 is Fire, so Marin carries boss fights.' },
    sp1: { name: 'Undertow', text: '20% chance for each attack to strike twice.' },
    sp2: { name: 'Spray Guard', text: 'Takes 25% less damage.' },
    aura: { name: 'Tidal Calm', text: 'Team max HP +20%.' } },
  { id: 'bramble', name: 'Bramble', element: 'earth', job: 'Knight', baseAtk: 3, baseHp: 150, range: 26, attackCooldown: 1.0, moveSpeed: 105, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1, bio: 'An old hedge knight with bark for armor. He walks slowly and refuses to fall over.',
    basic: { name: 'Shield Bash', text: 'Slow, heavy blows that shove enemies back a step.' },
    ultimate: { name: 'Rootwall Crash', text: 'Slams the ground, hitting every enemy ahead for 40x ATK.' },
    trait: { name: 'Front Line', text: 'The highest HP on the team. Stands in front so the rest of the squad survives.' },
    sp1: { name: 'Thornhide', text: 'Reflects 30% of damage taken back at the attacker.' },
    sp2: { name: 'Taproot', text: 'Regenerates 3% of max HP every second.' },
    aura: { name: 'Old Growth', text: 'Whole team takes 10% less damage.' } },
  { id: 'pyra', name: 'Pyra', element: 'fire', job: 'Mage', baseAtk: 8, baseHp: 40, range: 150, attackCooldown: 1.4, moveSpeed: 105, unlockCost: 300, upgradeBaseCost: 40, goldMult: 1, splash: 40, bio: 'A hot-tempered fire mage from the Ember Wastes who treats every fight as a demolition job.',
    basic: { name: 'Fireball', text: 'Ranged fireballs that splash every enemy near the target.' },
    ultimate: { name: 'Meteor Shower', text: 'Rains fire on every enemy ahead for 40x ATK.' },
    trait: { name: 'Splash', text: 'Long range and area damage. Best against packed camps and Earth enemies (4x).' },
    sp1: { name: 'Kindle', text: 'Fireball splash radius +50%.' },
    sp2: { name: 'Firewall', text: 'Every 4th attack deals 3x damage.' },
    aura: { name: 'Heatwave', text: 'Team ATK +15%.' } },
  { id: 'nox', name: 'Nox', element: 'dark', job: 'Rogue', baseAtk: 6, baseHp: 50, range: 24, attackCooldown: 0.6, moveSpeed: 145, unlockCost: 1500, upgradeBaseCost: 120, goldMult: 2, bio: 'A shadow rogue who is in it for the loot and does not pretend otherwise.',
    basic: { name: 'Twin Daggers', text: 'Very fast stabs at the closest enemy.' },
    ultimate: { name: 'Shadow Flurry', text: 'Blinks through every enemy ahead for 40x ATK.' },
    trait: { name: 'Pickpocket', text: 'Runs fastest and earns 2x gold from every kill. Dark deals 2x to Light.' },
    sp1: { name: 'Smoke Step', text: 'Dodges 25% of incoming attacks.' },
    sp2: { name: 'Backstab', text: '+20% critical hit chance.' },
    aura: { name: 'Nightfall', text: 'Team earns 25% more gold from kills.' } },
  { id: 'solenne', name: 'Solenne', element: 'light', job: 'Support', baseAtk: 3, baseHp: 55, range: 130, attackCooldown: 1.2, moveSpeed: 105, unlockCost: 8000, upgradeBaseCost: 400, goldMult: 1, heals: true, bio: 'A lantern-keeper from the Queen\'s own chapel. She keeps everyone standing.',
    basic: { name: 'Sunlight Mend', text: 'Heals the most injured nearby ally for 3x ATK. Attacks when nobody needs healing.' },
    ultimate: { name: 'Dawn Chorus', text: 'Fully heals every living hero.' },
    trait: { name: 'Support', text: 'The team\'s only healer. Light deals 2x to Dark.' },
    sp1: { name: 'Halo', text: 'Heals are 50% stronger.' },
    sp2: { name: 'Sanctuary', text: 'Fallen heroes respawn twice as fast.' },
    aura: { name: 'Lanternlight', text: 'Whole team regenerates 1% of max HP every second.' } },
];

/**
 * Element advantage from GDD section 4: Fire > Earth > Water > Fire at 4x,
 * Light and Dark beat each other at 2x.
 */
export function elementMultiplier(attacker: Element, defender: Element): number {
  const beats: Partial<Record<Element, Element>> = { fire: 'earth', earth: 'water', water: 'fire' };
  if (beats[attacker] === defender) return 4;
  if ((attacker === 'light' && defender === 'dark') || (attacker === 'dark' && defender === 'light')) return 2;
  return 1;
}

const ENEMY_ELEMENTS: Element[] = ['earth', 'fire', 'water', 'light', 'dark'];

/** Regular enemies rotate element by stage. */
export function enemyElement(stage: number): Element {
  return ENEMY_ELEMENTS[(stage - 1) % ENEMY_ELEMENTS.length];
}

const LOCK_ROTATION: Element[] = ['water', 'earth', 'fire', 'light', 'dark'];
export const ELEMENT_LOCK_START = 600;

/**
 * From stage 600, every 100th-stage boss is immune to every element but one,
 * rotating Water (600), Earth (700), Fire (800), Light (900), Dark (1000), Water (1100)...
 */
export function bossLock(stage: number): Element | null {
  if (stage < ELEMENT_LOCK_START || stage % 100 !== 0) return null;
  return LOCK_ROTATION[(stage / 100 - ELEMENT_LOCK_START / 100) % LOCK_ROTATION.length];
}

/** Unlocked bosses are Fire, so the Water starter hits them for 4x. Locked bosses take their lock element. */
export function bossElement(stage: number): Element {
  return bossLock(stage) ?? 'fire';
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
export const CRIT_CHANCE = 0.12;
export const CRIT_MULTIPLIER = 2.5;

/**
 * Hero Crests needed for each evolution star, 1-7 (GDD section 5.3). Each star
 * doubles stats; 1, 2, 3 and 4 stars unlock SP1, SP2, the Ultimate and the Aura.
 * Crests come from the Hero Chest.
 */
export const STAR_CRESTS = [10, 20, 50, 200, 500, 1000, 2000];
export const MAX_STARS = STAR_CRESTS.length;
/** From 3★ the Ultimate hits harder (the full game unlocks it at 3★; the prototype keeps Lv 30). */
export const ULT_STAR_BONUS = 1.5;

// Gems (premium currency) and the Hero Chest summon.
export const START_GEMS = 60;
export const BOSS_GEMS = 20;
/** Paid the first time you reach each multiple of 10 stages. */
export const MILESTONE_GEMS = 5;
export const CHEST_COST = 30;
export const CHEST_DROPS = 3;
/** Crests per drop and their weights. */
export const CREST_ROLLS: Array<[number, number]> = [
  [5, 60],
  [10, 30],
  [25, 10],
];

export const BOSS_NAMES = ['Grubjaw the Glutton', 'Sir Rattlecan', 'Mother Mireling', 'Cogsworth Crusher', 'The Molten Abbot'];
