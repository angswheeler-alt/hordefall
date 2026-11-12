/**
 * Glory and the Arena Shop (Samuel, 2026-11-11).
 *
 * Glory is the Colosseum's own shop currency: every fight pays some (win or lose) and so does each day's rank reward.
 * Starmotes no longer pay per fight or per day: they are banked through the week and paid in one go at the end of the
 * Arena season (Monday), together with the weekly rank reward, so pink stars keep the same pace.
 *
 * The Arena Shop sells Pasta's crests (always, once he is released), four permanent heroes (2 Rare, 2 Epic), Epic Forge
 * Cores and a few extras, each with a weekly limit that resets with the season. Balance bench 2026-11-11: a regular
 * player fights ~11 times a day and earns ~900-1,000 Glory a week.
 */

/** Glory for a won or lost Colosseum fight. */
export const GLORY_WIN = 10;
export const GLORY_LOSS = 3;
/** Glory each day for the sub-rank held (same steps as the old daily Starmotes), by sub-rank index. */
export const GLORY_DAILY = [10, 12, 14, 16, 18, 20, 24, 27, 30, 34, 38, 42, 46, 50, 55, 60];

/** Pasta (src/heroes/pasta.ts) joins the drops and the shop once his art is in. */
export const PASTA_RELEASED = true;
export const PASTA_ID = 'pasta';
/** Crests to unlock Pasta (Epics take 80; he is one of a kind). */
export const PASTA_UNLOCK = 100;
/** Rare Pasta crest drops: chance per Hero Chest (gives PASTA_CHEST_CRESTS), per Trial crest, per other reward. */
export const PASTA_CHEST_CHANCE = 0.005;
export const PASTA_CHEST_CRESTS = 4;
export const PASTA_TRIAL_CHANCE = 1 / 2000;
export const PASTA_REWARD_CHANCE = 0.01;

export type ArenaItemKind = 'crests' | 'coreE' | 'wild' | 'stones' | 'glyphChest';
export interface ArenaItem {
  id: string;
  kind: ArenaItemKind;
  /** Hero for crest items. */
  hero?: string;
  amount: number;
  price: number;
  /** Buys a week (resets each Monday with the season). */
  perWeek: number;
}

/** The four permanent Arena heroes (Samuel: 2 Rare + 2 Epic, never rotating). */
export const ARENA_HEROES = ['corvin', 'skiff', 'valorian', 'kestra'];

export const ARENA_ITEMS: ArenaItem[] = [
  { id: 'pasta', kind: 'crests', hero: PASTA_ID, amount: 5, price: 100, perWeek: 7 },
  { id: 'h:corvin', kind: 'crests', hero: 'corvin', amount: 10, price: 100, perWeek: 5 },
  { id: 'h:skiff', kind: 'crests', hero: 'skiff', amount: 10, price: 100, perWeek: 5 },
  { id: 'h:valorian', kind: 'crests', hero: 'valorian', amount: 5, price: 100, perWeek: 5 },
  { id: 'h:kestra', kind: 'crests', hero: 'kestra', amount: 5, price: 100, perWeek: 5 },
  { id: 'coreE', kind: 'coreE', amount: 1, price: 300, perWeek: 1 },
  { id: 'wild', kind: 'wild', amount: 5, price: 100, perWeek: 3 },
  { id: 'stones', kind: 'stones', amount: 2, price: 100, perWeek: 3 },
  { id: 'glyph', kind: 'glyphChest', amount: 1, price: 150, perWeek: 2 },
];

/** Items on sale now (Pasta's only once he is released). */
export function arenaItems(pastaReleased = PASTA_RELEASED): ArenaItem[] {
  return ARENA_ITEMS.filter((i) => i.hero !== PASTA_ID || pastaReleased);
}

/** Glory for one finished fight. */
export function fightGlory(won: boolean): number {
  return won ? GLORY_WIN : GLORY_LOSS;
}

/**
 * Pasta crests from one roll of a rare drop: `chance` per roll, `crests` each. `rnd` is the game's random source.
 */
export function pastaDrop(rnd: () => number, chance: number, crests = 1, released = PASTA_RELEASED): number {
  return released && rnd() < chance ? crests : 0;
}

/** Random source for the rare Pasta drops (tests swap it so results never depend on luck). */
export const pastaLuck = { roll: (): number => Math.random() };

/** Shop labels for the non-hero items. */
export const ARENA_NAME: Record<ArenaItemKind, (n: number) => string> = {
  crests: (n) => `${n} crests`,
  coreE: (n) => `${n} Epic Forge Core${n === 1 ? '' : 's'}`,
  wild: (n) => `${n} Wild Crests`,
  stones: (n) => `${n} Enhance Stones`,
  glyphChest: (n) => (n === 1 ? 'Glyph Chest' : `${n} Glyph Chests`),
};
export const ARENA_ICON: Record<ArenaItemKind, string> = { crests: '🛡️', coreE: '🔥', wild: '🃏', stones: '💎', glyphChest: '🎁' };
