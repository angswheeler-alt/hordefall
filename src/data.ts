export type Element = 'water' | 'fire' | 'earth' | 'light' | 'dark';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type Job = 'Blademaster' | 'Mage' | 'Knight' | 'Rogue' | 'Support';

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
  { id: 'marin', rarity: 'common', name: 'Marin', element: 'water', job: 'Blademaster', baseAtk: 5, baseHp: 60, range: 28, attackCooldown: 0.8, moveSpeed: 120, unlockCost: 0, upgradeBaseCost: 5, goldMult: 1, bio: 'A tidecoast swordsman who signed on to bring the Lantern Queen home. Steady, quick, and the reason every early boss goes down.',
    basic: { name: 'Tide Cutter', text: 'Fast sword slashes at the nearest enemy ahead.' },
    ultimate: { name: 'Riptide', text: 'A crashing wave hits every enemy ahead for 40x ATK, with element bonuses.' },
    trait: { name: 'Water Blade', text: 'Water deals 4x to Fire and 0.5x to Earth. Every boss before stage 600 is Fire, so Marin carries boss fights.' },
    sp1: { name: 'Undertow', text: '20% chance for each attack to strike twice.' },
    sp2: { name: 'Spray Guard', text: 'Takes 25% less damage.' },
    aura: { name: 'Tidal Calm', text: 'Team max HP +20%.' } },
  { id: 'bramble', rarity: 'common', name: 'Bramble', element: 'earth', job: 'Knight', baseAtk: 3, baseHp: 150, range: 26, attackCooldown: 1.0, moveSpeed: 105, unlockCost: 50, upgradeBaseCost: 15, goldMult: 1, bio: 'An old hedge knight with bark for armor. He walks slowly and refuses to fall over.',
    basic: { name: 'Shield Bash', text: 'Slow, heavy blows that shove enemies back a step.' },
    ultimate: { name: 'Rootwall Crash', text: 'Slams the ground, hitting every enemy ahead for 40x ATK.' },
    trait: { name: 'Front Line', text: 'The highest HP on the team. Earth deals 4x to Water and 0.5x to Fire.' },
    sp1: { name: 'Thornhide', text: 'Reflects 30% of damage taken back at the attacker.' },
    sp2: { name: 'Taproot', text: 'Regenerates 3% of max HP every second.' },
    aura: { name: 'Old Growth', text: 'Whole team takes 10% less damage.' } },
  { id: 'pyra', rarity: 'common', name: 'Pyra', element: 'fire', job: 'Mage', baseAtk: 8, baseHp: 40, range: 150, attackCooldown: 1.4, moveSpeed: 105, unlockCost: 300, upgradeBaseCost: 40, goldMult: 1, splash: 40, bio: 'A hot-tempered fire mage from the Ember Wastes who treats every fight as a demolition job.',
    basic: { name: 'Fireball', text: 'Ranged fireballs that splash every enemy near the target.' },
    ultimate: { name: 'Meteor Shower', text: 'Rains fire on every enemy ahead for 40x ATK.' },
    trait: { name: 'Splash', text: 'Long range and area damage. Fire deals 4x to Earth and 0.5x to Water.' },
    sp1: { name: 'Kindle', text: 'Fireball splash radius +50%.' },
    sp2: { name: 'Firewall', text: 'Every 4th attack deals 3x damage.' },
    aura: { name: 'Heatwave', text: 'Team ATK +15%.' } },
  { id: 'nox', rarity: 'common', name: 'Nox', element: 'dark', job: 'Rogue', baseAtk: 6, baseHp: 50, range: 24, attackCooldown: 0.6, moveSpeed: 145, unlockCost: 1500, upgradeBaseCost: 120, goldMult: 2, bio: 'A shadow rogue who is in it for the loot and does not pretend otherwise.',
    basic: { name: 'Twin Daggers', text: 'Very fast stabs at the closest enemy.' },
    ultimate: { name: 'Shadow Flurry', text: 'Blinks through every enemy ahead for 40x ATK.' },
    trait: { name: 'Pickpocket', text: 'Runs fastest and earns 2x gold from every kill. Dark deals 2x to Light and 0.5x to Dark.' },
    sp1: { name: 'Smoke Step', text: 'Dodges 25% of incoming attacks.' },
    sp2: { name: 'Backstab', text: '+20% critical hit chance.' },
    aura: { name: 'Nightfall', text: 'Team earns 25% more gold from kills.' } },
  { id: 'solenne', rarity: 'common', name: 'Solenne', element: 'light', job: 'Support', baseAtk: 3, baseHp: 55, range: 130, attackCooldown: 1.2, moveSpeed: 105, unlockCost: 8000, upgradeBaseCost: 400, goldMult: 1, heals: true, bio: 'A lantern-keeper from the Queen\'s own chapel. She keeps everyone standing.',
    basic: { name: 'Sunlight Mend', text: 'Heals the most injured nearby ally for 3x ATK. Attacks when nobody needs healing.' },
    ultimate: { name: 'Dawn Chorus', text: 'Fully heals every living hero.' },
    trait: { name: 'Support', text: 'The team\'s only healer. Light deals 2x to Dark and 0.5x to Light.' },
    sp1: { name: 'Halo', text: 'Heals are 50% stronger.' },
    sp2: { name: 'Sanctuary', text: 'Fallen heroes respawn twice as fast.' },
    aura: { name: 'Lanternlight', text: 'Whole team regenerates 1% of max HP every second.' } },
];

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
/** Rekindle Wheel: 16 slots on the Rekindle page, one unlocking every 50 best stages from 150 (GDD section 7). */
export const ROAD_START = 150;
export const ROAD_STEP = 50;
export const ROAD_LENGTH = 16;
export const ROAD_GEMS = 50;
/** Each player level adds this much to every Ember payout. */
export const KEEPER_BONUS_PER_LEVEL = 0.1;
export const CRIT_CHANCE = 0.12;
export const CRIT_MULTIPLIER = 2.5;

/**
 * Hero Crests needed for each evolution star, 1-7 (GDD section 5.3). Each star
 * doubles stats; 1, 2, 3 and 4 stars unlock SP1, SP2, the Ultimate and the Aura.
 * Crests come from the Hero Chest.
 */
export const STAR_CRESTS = [10, 20, 50, 200, 500, 1000, 2000];
export const MAX_STARS = STAR_CRESTS.length;
/**
 * Hero Crests (medals) a hero needs to unlock, by rarity (Samuel's table).
 * Unlocking spends them. Legendary heroes never unlock from Crests: Samuel
 * says they only come through special means (events and the like), and the
 * Hero Chest never drops them. The free starter (unlockCost 0) needs none.
 */
export const UNLOCK_CRESTS: Record<Exclude<Rarity, 'legendary'>, number> = { common: 10, rare: 30, epic: 80 };
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
 * Relics (GDD section 9): passive boosts for the whole team, crafted and
 * upgraded with Trial Essence. Each relic takes two Essences. Levels run 1-10
 * inside a tier, tiers I-V; the effect grows with every level across tiers.
 */
export type RelicEffect = 'atk' | 'hp' | 'gold' | 'stall' | 'trial' | Element;
export interface RelicDef {
  id: string;
  name: string;
  effect: RelicEffect;
  /** Percent bonus per level. */
  perLevel: number;
  essences: [Element, Element];
  blurb: string;
}
export const RELICS: RelicDef[] = [
  { id: 'warbanner', name: 'Warbanner', effect: 'atk', perLevel: 5, essences: ['fire', 'dark'], blurb: 'A torn battle flag that still makes everyone swing harder.' },
  { id: 'oakheart', name: 'Oakheart', effect: 'hp', perLevel: 5, essences: ['earth', 'water'], blurb: 'A living acorn that hardens skin like bark.' },
  { id: 'luckycoin', name: 'Lucky Coin', effect: 'gold', perLevel: 5, essences: ['light', 'earth'], blurb: 'Always lands heads. Enemies drop more gold.' },
  { id: 'scale', name: "Merchant's Scale", effect: 'stall', perLevel: 5, essences: ['water', 'light'], blurb: 'Tips every deal your way on Market Row.' },
  { id: 'sigil', name: 'Trial Sigil', effect: 'trial', perLevel: 10, essences: ['dark', 'fire'], blurb: 'Glows near Trial bosses and finds their weak spots.' },
  { id: 'pearl', name: 'Tide Pearl', effect: 'water', perLevel: 10, essences: ['water', 'light'], blurb: 'Sea-song in a shell. Water heroes hit harder.' },
  { id: 'idol', name: 'Stone Idol', effect: 'earth', perLevel: 10, essences: ['earth', 'dark'], blurb: 'A mossy idol that steadies Earth heroes.' },
  { id: 'fang', name: 'Cinder Fang', effect: 'fire', perLevel: 10, essences: ['fire', 'earth'], blurb: 'Still warm. Fire heroes hit harder.' },
  { id: 'feather', name: 'Dawn Feather', effect: 'light', perLevel: 10, essences: ['light', 'water'], blurb: 'Drifts upward. Light heroes hit harder.' },
  { id: 'mask', name: 'Dusk Mask', effect: 'dark', perLevel: 10, essences: ['dark', 'fire'], blurb: 'Smiles in the dark. Dark heroes hit harder.' },
];
export const RELIC_LEVELS_PER_TIER = 10;
export const RELIC_TIERS = 5;
/** Relic slots: 2 free, then bought with Gems at these prices. */
export const RELIC_START_SLOTS = 2;
export const RELIC_SLOT_COSTS = [150, 300, 600, 1200];
