// Free Gem sources: daily challenges, a login
// calendar, a daily Lucky Spin, achievements and Bootcamp. (Gold chests in
// battle also give a few Gems; guild events come with guilds.)

/** Counters kept for daily challenges and achievements. */
export type StatKey = 'kills' | 'stages' | 'levels' | 'chests' | 'minutes' | 'summons' | 'trials';
export const STAT_KEYS: StatKey[] = ['kills', 'stages', 'levels', 'chests', 'minutes', 'summons', 'trials'];

/** What a claim pays: Gems, gold worth some minutes of income, and free Hero Chests. */
export interface Reward {
  gems?: number;
  goldMinutes?: number;
  chests?: number;
  /** Enhance Stones (relics). */
  stones?: number;
  /** Trial tickets (they still stop at the ticket cap). */
  tickets?: number;
  /** Wild Crests (turn into crests for any non-Legendary, non-Ascendant hero). */
  wild?: number;
}

export function rewardText(r: Reward): string {
  const parts: string[] = [];
  if (r.gems) parts.push(`${r.gems} Gems`);
  if (r.goldMinutes) parts.push(r.goldMinutes >= 60 ? `${r.goldMinutes / 60}h of gold` : `${r.goldMinutes}m of gold`);
  if (r.chests) parts.push(r.chests === 1 ? 'Hero Chest' : `${r.chests} Hero Chests`);
  if (r.stones) parts.push(r.stones === 1 ? 'Enhance Stone' : `${r.stones} Enhance Stones`);
  if (r.tickets) parts.push(r.tickets === 1 ? 'Trial ticket' : `${r.tickets} Trial tickets`);
  if (r.wild) parts.push(r.wild === 1 ? 'Wild Crest' : `${r.wild} Wild Crests`);
  return parts.join(' + ');
}

// ---------- daily challenges: 5 Gems each, up to 25 a day ----------

export interface DailyDef {
  stat: StatKey;
  text: string;
  goal: number;
}
export const DAILY_GEMS = 5;
export const DAILIES: DailyDef[] = [
  { stat: 'kills', text: 'Defeat 300 enemies', goal: 300 },
  { stat: 'stages', text: 'Clear 20 stages', goal: 20 },
  { stat: 'levels', text: 'Buy 50 hero levels', goal: 50 },
  { stat: 'chests', text: 'Tap 3 floating chests', goal: 3 },
  { stat: 'minutes', text: 'Battle for 15 minutes', goal: 15 },
];

// ---------- Daily Medal Bundle: free medals for finishing daily challenges ----------

/** Heroes in each day's bundle, all different. */
export const MEDAL_BUNDLE_HEROES = 3;
/** Daily challenges to finish before the bundle can be claimed. */
export const MEDAL_BUNDLE_DAILIES = 3;

// ---------- login calendar: 30 days, one claim a day ----------
// Days count claims, not a streak, so a missed day never loses progress. Each
// week runs Wild Crests, Enhance Stones, a Hero Chest, Trial tickets, Gems, more
// Wild Crests, then a bigger day 7; every week pays a bit more than the last,
// and days 29 and 30 are the big finish. A full month: 350 Gems, 15 Hero
// Chests, 19 Enhance Stones, 17 Trial tickets and 70 Wild Crests. No gold: a
// few minutes of income is worthless once the Market Row is running (the user
// asked for it gone, as with Stage Milestones). 70 Wild a month is ~12% on top
// of the daily Gilded Scouting (20 a day). Then it starts again at day 1.

const LOGIN_WEEK = (wild: number, stones: number, tickets: number, gems: number, wild2: number, chests7: number, gems7: number): Reward[] => [
  { wild },
  { stones },
  { chests: 1 },
  { tickets },
  { gems },
  { wild: wild2 },
  { chests: chests7, gems: gems7 },
];

export const LOGIN_CYCLE: Reward[] = [
  ...LOGIN_WEEK(5, 2, 3, 20, 5, 1, 30),
  ...LOGIN_WEEK(5, 3, 4, 25, 10, 1, 40),
  ...LOGIN_WEEK(10, 4, 5, 30, 10, 2, 40),
  ...LOGIN_WEEK(10, 5, 5, 35, 15, 2, 50),
  { chests: 2, stones: 5 },
  { chests: 3, gems: 80 },
];

// ---------- Lucky Spin: one free spin a day ----------

export interface SpinSlice {
  reward: Reward;
  weight: number;
  color: string;
}
export const SPIN_SLICES: SpinSlice[] = [
  { reward: { gems: 10 }, weight: 22, color: '#1d6f99' },
  { reward: { goldMinutes: 15 }, weight: 20, color: '#b8862a' },
  { reward: { gems: 15 }, weight: 14, color: '#2a86b8' },
  { reward: { chests: 1 }, weight: 14, color: '#7a3fb0' },
  { reward: { goldMinutes: 60 }, weight: 10, color: '#d9a43a' },
  { reward: { gems: 25 }, weight: 10, color: '#1d6f99' },
  { reward: { chests: 2 }, weight: 6, color: '#9a52d6' },
  { reward: { gems: 50 }, weight: 4, color: '#3fb8e6' },
];

// ---------- achievements: tiers of a lifetime goal, Gems per tier ----------

export type AchievementValue = 'bestStage' | 'rekindles' | 'heroes' | 'stars' | StatKey;
export interface AchievementDef {
  id: string;
  /** Text for a goal, e.g. "Reach stage 100". */
  text: (goal: number) => string;
  value: AchievementValue;
  tiers: Array<[goal: number, gems: number]>;
}
export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'stage', text: (g) => `Reach stage ${g.toLocaleString()}`, value: 'bestStage', tiers: [[50, 10], [100, 20], [200, 30], [300, 40], [500, 50], [750, 75], [1000, 100]] },
  { id: 'rekindle', text: (g) => `Rekindle ${g} time${g === 1 ? '' : 's'}`, value: 'rekindles', tiers: [[1, 20], [5, 30], [10, 40], [25, 50], [50, 75]] },
  { id: 'heroes', text: (g) => `Recruit ${g} heroes`, value: 'heroes', tiers: [[3, 10], [5, 20], [10, 30], [15, 40], [20, 50]] },
  { id: 'stars', text: (g) => `Earn ${g} hero stars`, value: 'stars', tiers: [[5, 10], [15, 20], [30, 30], [60, 50], [100, 75]] },
  { id: 'kills', text: (g) => `Defeat ${g.toLocaleString()} enemies`, value: 'kills', tiers: [[1000, 10], [10000, 20], [100000, 40], [1000000, 80]] },
  { id: 'trials', text: (g) => `Win ${g} Elemental Trials`, value: 'trials', tiers: [[5, 10], [25, 20], [100, 40], [500, 80]] },
  { id: 'summons', text: (g) => `Open ${g} Hero Chests`, value: 'summons', tiers: [[5, 10], [25, 20], [100, 40]] },
];

// ---------- Bootcamp: one-time beginner goals ----------
// The first eight pay more (200 Gems in all) so a new player can open a few Hero Chests in their first hour.

export type BootcampCheck =
  | { kind: 'heroLevel'; level: number }
  | { kind: 'stage'; stage: number }
  | { kind: 'stat'; stat: StatKey; count: number }
  | { kind: 'team'; size: number }
  | { kind: 'star'; stars: number }
  | { kind: 'rekindle' }
  | { kind: 'relic' };
export interface BootcampDef {
  id: string;
  text: string;
  gems: number;
  check: BootcampCheck;
}
export const BOOTCAMP: BootcampDef[] = [
  { id: 'lv10', text: 'Raise a hero to level 10', gems: 20, check: { kind: 'heroLevel', level: 10 } },
  { id: 'st10', text: 'Reach stage 10', gems: 20, check: { kind: 'stage', stage: 10 } },
  { id: 'chest', text: 'Tap a floating chest', gems: 20, check: { kind: 'stat', stat: 'chests', count: 1 } },
  { id: 'summon', text: 'Open a Hero Chest', gems: 20, check: { kind: 'stat', stat: 'summons', count: 1 } },
  { id: 'team2', text: 'Have 2 heroes fighting', gems: 30, check: { kind: 'team', size: 2 } },
  { id: 'st51', text: 'Beat the stage 50 boss', gems: 30, check: { kind: 'stage', stage: 51 } },
  { id: 'star2', text: 'Evolve a hero to 2★', gems: 30, check: { kind: 'star', stars: 2 } },
  { id: 'team3', text: 'Have 3 heroes fighting', gems: 30, check: { kind: 'team', size: 3 } },
  { id: 'st101', text: 'Beat the stage 100 boss', gems: 25, check: { kind: 'stage', stage: 101 } },
  { id: 'rekindle', text: 'Rekindle for the first time', gems: 30, check: { kind: 'rekindle' } },
  { id: 'trial', text: 'Win an Elemental Trial', gems: 20, check: { kind: 'stat', stat: 'trials', count: 1 } },
  { id: 'relic', text: 'Equip a relic', gems: 20, check: { kind: 'relic' } },
];

/** The local calendar day, e.g. "2026-10-13". Dailies, the login calendar and the spin reset when it changes. */
export function dayKey(now = Date.now()): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ---------- Stage Milestones: a one-time reward for every 50th-stage boss ----------
// Paid once on the best stage ever reached, so Rekindle runs can't farm them.
// No gold (a few minutes of income is worth nothing; Samuel 2026-11-07). Chests,
// Enhance Stones, Trial tickets and weapon forge materials help along without
// skipping a wall: by stage 3,000 the forge part adds up to about one Lv 9 weapon.
// Every 100th also pays a few Gems and Wild Crests (Samuel 2026-11-07): to stage
// 3,000 that is 1,080 Gems (about a week of free Gem income) and 420 Wild Crests
// (about three weeks of Gilded Scouting), once per lifetime.

export const MILESTONE_STEP = 50;

export interface MilestoneReward {
  chests: number;
  stones: number;
  tickets: number;
  gems: number;
  /** Wild Crests (any non-Legendary, non-Ascendant hero). */
  wild: number;
  /** Ancient Ore and Raw Crystal (the same amount of each). */
  ore: number;
  coreC: number;
  coreR: number;
  coreE: number;
}

/** What beating the boss of `stage` (a multiple of MILESTONE_STEP) pays. Every 100th pays a Hero Chest, every 500th a big one. */
export function milestoneReward(stage: number): MilestoneReward {
  if (stage % 500 === 0) return { chests: 3, stones: 5, tickets: 5, gems: 100, wild: 30, ore: 1000, coreC: 20, coreR: 5, coreE: 1 };
  if (stage % 100 === 0) return { chests: 1, stones: 1, tickets: 3, gems: 20, wild: 10, ore: 200, coreC: 5, coreR: 1, coreE: 0 };
  return { chests: 0, stones: 1, tickets: 0, gems: 0, wild: 0, ore: 100, coreC: 3, coreR: 0, coreE: 0 };
}

export function milestoneText(r: MilestoneReward): string {
  const parts: string[] = [];
  if (r.gems) parts.push(`${r.gems} Gems`);
  if (r.chests) parts.push(r.chests === 1 ? 'Hero Chest' : `${r.chests} Hero Chests`);
  if (r.wild) parts.push(`${r.wild} Wild Crests`);
  if (r.stones) parts.push(r.stones === 1 ? 'Enhance Stone' : `${r.stones} Enhance Stones`);
  if (r.tickets) parts.push(`${r.tickets} Trial tickets`);
  if (r.ore) parts.push(`${r.ore.toLocaleString()} Ore + Crystal`);
  if (r.coreC) parts.push(`${r.coreC} Common Core${r.coreC === 1 ? '' : 's'}`);
  if (r.coreR) parts.push(`${r.coreR} Rare Core${r.coreR === 1 ? '' : 's'}`);
  if (r.coreE) parts.push(`${r.coreE} Epic Core${r.coreE === 1 ? '' : 's'}`);
  return parts.join(' + ');
}
