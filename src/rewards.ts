// Free Gem sources, following the original game: daily challenges, a login
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
}

export function rewardText(r: Reward): string {
  const parts: string[] = [];
  if (r.gems) parts.push(`${r.gems} Gems`);
  if (r.goldMinutes) parts.push(r.goldMinutes >= 60 ? `${r.goldMinutes / 60}h of gold` : `${r.goldMinutes}m of gold`);
  if (r.chests) parts.push(r.chests === 1 ? 'Hero Chest' : `${r.chests} Hero Chests`);
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

// ---------- login calendar: one claim a day, Gems every 5th day ----------

export const LOGIN_CYCLE: Reward[] = [{ goldMinutes: 10 }, { chests: 1 }, { goldMinutes: 30 }, { chests: 1 }, { gems: 50 }];

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
// No Gems (bosses and stage marks never pay Gems); chests, Enhance Stones,
// Trial tickets and a little gold help along without skipping a wall.

export const MILESTONE_STEP = 50;

export interface MilestoneReward {
  goldMinutes: number;
  chests: number;
  stones: number;
  tickets: number;
}

/** What beating the boss of `stage` (a multiple of MILESTONE_STEP) pays. Every 100th pays a Hero Chest, every 500th a big one. */
export function milestoneReward(stage: number): MilestoneReward {
  if (stage % 500 === 0) return { goldMinutes: 60, chests: 3, stones: 5, tickets: 5 };
  if (stage % 100 === 0) return { goldMinutes: 30, chests: 1, stones: 1, tickets: 3 };
  return { goldMinutes: 30, chests: 0, stones: 1, tickets: 0 };
}

export function milestoneText(r: MilestoneReward): string {
  const parts: string[] = [];
  if (r.chests) parts.push(r.chests === 1 ? 'Hero Chest' : `${r.chests} Hero Chests`);
  if (r.stones) parts.push(r.stones === 1 ? 'Enhance Stone' : `${r.stones} Enhance Stones`);
  if (r.tickets) parts.push(`${r.tickets} Trial tickets`);
  if (r.goldMinutes) parts.push(r.goldMinutes >= 60 ? `${r.goldMinutes / 60}h of gold` : `${r.goldMinutes}m of gold`);
  return parts.join(' + ');
}
