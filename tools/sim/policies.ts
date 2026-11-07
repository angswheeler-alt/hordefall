// Player profiles for the Hordefall economy simulator (tools/sim/engine.ts).
// These are assumptions about behaviour, not game rules: see README.md for why each number was picked.

export type Strategy = 'balanced' | 'concentrated' | 'element' | 'rarity' | 'collection';

export interface Policy {
  name: string;
  /** Hours of active (screen-on) play a day, split over sessionsPerDay sessions between 08:00 and 23:00. */
  hoursPerDay: number;
  sessionsPerDay: number;
  /** Day 1's first session lasts at least this long (new players play longer on day one). */
  firstSessionMinutes?: number;
  /** Chance a whole day is missed (no login, no play; offline still pays up to 12 h). */
  skipDayChance: number;
  /** Chance on a played day that daily challenges and the Daily Crest Bundle get claimed. */
  dailiesChance: number;
  /** Share of floating chests tapped. */
  chestTap: number;
  /** Share of manual Stall cycles collected (Stalls under level 50). */
  stallTapShare: number;
  stalls: boolean;
  /** Gem plan: 'optimal' targeted crest buys, 'sensible' shop offers then Hero Chests, 'chests' Hero Chests only, 'wasteful' boosts, refreshes, chests. */
  gems: 'optimal' | 'sensible' | 'chests' | 'wasteful';
  gemFloor: number;
  teamSlotGoal: number;
  ultSlots: boolean;
  monthlyPack: boolean;
  buyCrate: boolean;
  buyTickets: boolean;
  packs: boolean;
  /** Ascendant Chest buys per week (the cheapest ones first). */
  ascChestBuys: number;
  strategy: Strategy;
  relics: 'cheapest' | 'random';
  weapons: 'team' | 'spread';
  scouting: boolean;
  rush: boolean;
  pvp: boolean;
  /** Guild membership, modelled server side: members about as strong as the player (peerShare of its damage each). */
  guild: null | { members: number; peerShare: number; fightsPerSession: number; donationsPerSession: number; questTrack: boolean };
  /** Minutes of play without a new run best before Rekindling. */
  rekindleStuckMin: number;
  /** Hypothetical Gems bought with real money, per day (there is no real-money shop in the game yet). */
  paidGemsPerDay: number;
}

const ACTIVE_GUILD = { members: 20, peerShare: 0.8, fightsPerSession: 3, donationsPerSession: 1, questTrack: true };

const B: Policy = {
  name: 'B Active F2P',
  hoursPerDay: 1.5, sessionsPerDay: 4, firstSessionMinutes: 60, skipDayChance: 0.03, dailiesChance: 0.95, chestTap: 0.6, stallTapShare: 0.8, stalls: true,
  gems: 'sensible', gemFloor: 0, teamSlotGoal: 10, ultSlots: true, monthlyPack: true, buyCrate: false, buyTickets: false, packs: false, ascChestBuys: 0,
  strategy: 'balanced', relics: 'cheapest', weapons: 'team', scouting: true, rush: true, pvp: true, guild: ACTIVE_GUILD, rekindleStuckMin: 8, paidGemsPerDay: 0,
};

export const POLICIES: Record<string, Policy> = {
  A: {
    ...B, name: 'A Casual F2P', hoursPerDay: 0.4, sessionsPerDay: 2, firstSessionMinutes: 30, skipDayChance: 0.12, dailiesChance: 0.6, chestTap: 0.4, stallTapShare: 0.5,
    gems: 'sensible', teamSlotGoal: 6, ultSlots: false, monthlyPack: false, rush: false, guild: null,
  },
  B,
  C: {
    ...B, name: 'C Optimized F2P', hoursPerDay: 2.5, sessionsPerDay: 6, firstSessionMinutes: 90, skipDayChance: 0, dailiesChance: 1, chestTap: 0.8, stallTapShare: 1,
    gems: 'optimal', gemFloor: 0, packs: true, buyCrate: true, buyTickets: true, ascChestBuys: 3, rekindleStuckMin: 6,
    guild: { ...ACTIVE_GUILD, donationsPerSession: 1 },
  },
  D: {
    ...B, name: 'D Inefficient F2P', hoursPerDay: 1, sessionsPerDay: 3, firstSessionMinutes: 45, skipDayChance: 0.15, dailiesChance: 0.75, chestTap: 0.5, stallTapShare: 0.5,
    gems: 'wasteful', teamSlotGoal: 5, ultSlots: false, monthlyPack: false, strategy: 'collection', relics: 'random', weapons: 'spread', rush: false, rekindleStuckMin: 25,
    guild: { members: 10, peerShare: 0.5, fightsPerSession: 1, donationsPerSession: 0, questTrack: false },
  },
};
// Paying players: the optimized player's choices with B's play time, plus Gems bought.
// Hypothetical price: 100 Gems per US dollar (no real-money shop exists yet). Small $10/mo, moderate $50/mo, high $300/mo.
for (const [k, usdPerMonth] of [['E1', 10], ['E2', 50], ['E3', 300]] as const) {
  POLICIES[k] = { ...POLICIES.C, name: `E Paying $${usdPerMonth}/mo`, hoursPerDay: 1.5, sessionsPerDay: 4, firstSessionMinutes: 60, paidGemsPerDay: Math.round((usdPerMonth * 100 * 12) / 365), ascChestBuys: usdPerMonth >= 300 ? 10 : usdPerMonth >= 50 ? 5 : 3 };
}
