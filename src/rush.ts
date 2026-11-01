/**
 * Rush (design doc 12.2, built 2026-11-01): a 4-day event, Thursday to Sunday (local days), on the weeks without
 * the double-crest Trial weekend, so one of the two runs every weekend.
 *
 * - One hero against one hero. Three brackets by the hero's yellow stars: 1-3★, 3-5★, 5-7★ (a 3★ or 5★ hero
 *   fits two). Each bracket offers three opponents; nothing says which are real players and which are made up.
 * - A fight costs RUSH_FIGHT_TICKETS tickets, or one of the hero's free attacks: every hero starts the event with
 *   one, and gets one more every RUSH_FREE_HOURS hours, holding up to RUSH_FREE_MAX.
 * - Tickets: RUSH_START_TICKETS at the start, RUSH_DAILY_TICKETS more each new day of the event.
 * - Wins pay points; RUSH_STREAK_UP wins in a row raise the Rush level (its multiplier stays for the event).
 *   The nine featured heroes earn RUSH_FEATURED_BONUS more. Points pass reward tiers (paid at once).
 * - Every fight pays Rush Coins for the Rush Shop; coins stay between events, shop limits reset each event.
 */
import type { GlyphChestKind } from './glyphs';

export const RUSH_UNLOCK_LEVEL = 15;
/** Local days the event runs (Date.getDay numbers): Thursday to Sunday. */
export const RUSH_DAYS = [4, 5, 6, 0];
export const RUSH_START_TICKETS = 100;
export const RUSH_DAILY_TICKETS = 40;
export const RUSH_FIGHT_TICKETS = 5;
export const RUSH_FREE_HOURS = 6;
export const RUSH_FREE_MAX = 2;
export const RUSH_FEATURED = 9;
export const RUSH_FEATURED_BONUS = 0.2;
export const RUSH_STREAK_UP = 4;
export const RUSH_MAX_LEVEL = 10;
/** Point multiplier added per Rush level above 1. */
export const RUSH_LEVEL_STEP = 0.25;

/** Brackets by yellow stars (0-based: 0 = 1★). */
export const RUSH_BRACKETS = [
  { name: 'Bracket 1', min: 0, max: 2, points: 10, coins: 10 },
  { name: 'Bracket 2', min: 2, max: 4, points: 20, coins: 15 },
  { name: 'Bracket 3', min: 4, max: 6, points: 35, coins: 20 },
] as const;
export const RUSH_LOSS_COINS = 3;

/** The three opponents of a bracket: a share of the player's best hero CP there, and what a win is worth. */
export const RUSH_FOES = [
  { name: 'Easy', min: 0.7, max: 0.85, points: 0.75 },
  { name: 'Even', min: 0.9, max: 1.1, points: 1 },
  { name: 'Hard', min: 1.15, max: 1.35, points: 1.4 },
] as const;

export interface RushReward {
  glyph?: number;
  grand?: number;
  dust?: number;
  gems?: number;
  unbinder?: number;
}

/** Reward tiers by points, paid once each event. About 150 Gems in all. */
export const RUSH_TIERS: Array<{ points: number; reward: RushReward }> = [
  { points: 50, reward: { glyph: 1 } },
  { points: 150, reward: { dust: 300 } },
  { points: 300, reward: { glyph: 2, gems: 20 } },
  { points: 600, reward: { grand: 1 } },
  { points: 1000, reward: { gems: 30, dust: 500 } },
  { points: 1600, reward: { grand: 2 } },
  { points: 2500, reward: { gems: 40, unbinder: 1 } },
  { points: 4000, reward: { grand: 3, gems: 60 } },
];

export type RushShopId = 'glyph' | 'grand' | 'dust' | 'coreR' | 'unbinder';
export const RUSH_SHOP: Record<RushShopId, { name: string; coins: number; limit: number; text: string }> = {
  glyph: { name: 'Glyph Chest', coins: 150, limit: 5, text: 'One 1★ to 4★ Glyph' },
  grand: { name: 'Grand Glyph Chest', coins: 600, limit: 2, text: 'One 3★ to 6★ Glyph' },
  dust: { name: 'Glyph Dust x200', coins: 100, limit: 10, text: 'Levels up Glyphs' },
  coreR: { name: 'Rare Forge Core', coins: 120, limit: 5, text: 'For weapon levels 4 and up' },
  unbinder: { name: 'Unbinder', coins: 200, limit: 3, text: 'Takes a bound Glyph out safely' },
};
/** Crests for a featured hero in the Rush Shop: crests per buy, coins by rarity, buys per hero each event. */
export const RUSH_CREST_PACK = 5;
export const RUSH_CREST_COINS = { common: 100, rare: 200, epic: 400 } as const;
export const RUSH_CREST_LIMIT = 2;

export const chestKinds = (r: RushReward): Array<[GlyphChestKind, number]> => [
  ['glyph', r.glyph ?? 0],
  ['grand', r.grand ?? 0],
];

/** Point multiplier of a Rush level. */
export function rushLevelMult(level: number): number {
  return 1 + RUSH_LEVEL_STEP * (Math.max(1, Math.min(RUSH_MAX_LEVEL, level)) - 1);
}

/** Points a win pays. */
export function rushWinPoints(bracket: number, foe: number, level: number, featured: boolean): number {
  const b = RUSH_BRACKETS[bracket] ?? RUSH_BRACKETS[0];
  const f = RUSH_FOES[foe] ?? RUSH_FOES[1];
  return Math.round(b.points * f.points * rushLevelMult(level) * (featured ? 1 + RUSH_FEATURED_BONUS : 1));
}

/** Whether a hero with these (0-based) stars may fight in a bracket. Heroes above 7★ count as 7★. */
export function inBracket(stars: number, bracket: number): boolean {
  const b = RUSH_BRACKETS[bracket];
  const s = Math.min(6, stars);
  return !!b && s >= b.min && s <= b.max;
}

/** One opponent in a bracket: a made-up player's single hero (see GameState.rushFoe). */
export interface RushFoe {
  name: string;
  hero: string;
  stars: number;
  ember: number;
  power: number;
  cp: string;
}

/** A hero's free attacks: `n` held as of free-attack period `p` (periods count from the event start). */
export interface RushFree {
  n: number;
  p: number;
}

export interface RushState {
  /** The event this is for: the Monday key of its week ('' before the first one). */
  id: string;
  tickets: number;
  /** Day the daily tickets were last added. */
  ticketDay: string;
  points: number;
  level: number;
  streak: number;
  wins: number;
  losses: number;
  /** Reward tiers paid so far. */
  tiers: number;
  free: Record<string, RushFree>;
  /** Opponents per bracket, and how many lists were made (seeds new ones). */
  foes: RushFoe[][];
  rolls: number;
  /** Rush Shop buys this event, by item (and `crest:<hero>`). */
  bought: Record<string, number>;
  /** The fight running now: bracket, opponent index and hero (spent already). */
  active?: { bracket: number; foe: number; hero: string; free: boolean };
}

export function newRush(id = ''): RushState {
  return { id, tickets: id ? RUSH_START_TICKETS : 0, ticketDay: '', points: 0, level: 1, streak: 0, wins: 0, losses: 0, tiers: 0, free: {}, foes: [[], [], []], rolls: 0, bought: {} };
}

/** Free attacks a hero holds in period `period` (1 at the start, +1 per period, up to RUSH_FREE_MAX). */
export function freeAttacks(f: RushFree | undefined, period: number): number {
  const cur = f ?? { n: 1, p: 0 };
  return Math.min(RUSH_FREE_MAX, cur.n + Math.max(0, period - cur.p));
}

/** Clean a saved Rush. */
export function cleanRush(raw: unknown, heroIds: Set<string>): RushState {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<RushState>;
  const s = newRush(typeof r.id === 'string' ? r.id : '');
  const int = (v: unknown, lo = 0) => Math.max(lo, Math.floor(Number(v) || 0));
  s.tickets = int(r.tickets ?? s.tickets);
  s.ticketDay = typeof r.ticketDay === 'string' ? r.ticketDay : '';
  s.points = int(r.points);
  s.level = Math.min(RUSH_MAX_LEVEL, int(r.level, 1));
  s.streak = Math.min(RUSH_STREAK_UP - 1, int(r.streak));
  s.wins = int(r.wins);
  s.losses = int(r.losses);
  s.tiers = Math.min(RUSH_TIERS.length, int(r.tiers));
  s.rolls = int(r.rolls);
  for (const [id, f] of Object.entries(r.free ?? {})) if (heroIds.has(id) && f && typeof f === 'object') s.free[id] = { n: Math.min(RUSH_FREE_MAX, int(f.n)), p: int(f.p) };
  for (const [k, v] of Object.entries(r.bought ?? {})) s.bought[k] = int(v);
  if (Array.isArray(r.foes)) {
    s.foes = [0, 1, 2].map((b) =>
      (Array.isArray(r.foes![b]) ? r.foes![b] : [])
        .filter((f): f is RushFoe => !!f && typeof f === 'object' && typeof f.name === 'string' && heroIds.has(f.hero))
        .map((f) => ({ name: f.name, hero: f.hero, stars: int(f.stars), ember: int(f.ember, 1), power: Number(f.power) > 0 ? Number(f.power) : 1, cp: typeof f.cp === 'string' ? f.cp : '0' }))
        .slice(0, RUSH_FOES.length),
    );
  }
  // A fight that was running when the game closed counts as a loss (its ticket is already spent).
  if (r.active && typeof r.active === 'object') {
    s.losses++;
    s.streak = 0;
  }
  return s;
}
