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
/**
 * Kairo (src/heroes/kairo.ts), the second one-of-a-kind hero (Samuel 2026-11-15): sold next to Pasta with the same
 * price and weekly limit, and his own rare drops at Pasta's odds (a separate roll, so Pasta's stay the same).
 * Glory is NOT raised: players choose which of the two to focus. Released 2026-11-15 with his art (shown in game as Gogu).
 */
export const KAIRO_RELEASED = true;
export const KAIRO_ID = 'kairo';
/**
 * Yeren (src/heroes/yeren.ts), the third one (Samuel 2026-11-16, the Earth titan shifter): same deal as Gogu, his own
 * rare drops and 5 crests for 100 Glory, 7 a week. Glory is not raised: the uniques compete for the same Glory.
 * Off until his art is in (then flip this and move 'yeren' from HIDDEN_HEROES to RELEASED_HEROES in data.ts).
 */
export const YEREN_RELEASED = false;
export const YEREN_ID = 'yeren';
/** The one-of-a-kind heroes: crests only from their own rare drops and the Arena Shop, PASTA_UNLOCK crests to unlock. */
export const UNIQUE_HEROES = [PASTA_ID, KAIRO_ID, YEREN_ID];
export function isUnique(id: string): boolean {
  return UNIQUE_HEROES.includes(id);
}
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
  { id: 'kairo', kind: 'crests', hero: KAIRO_ID, amount: 5, price: 100, perWeek: 7 },
  { id: 'yeren', kind: 'crests', hero: YEREN_ID, amount: 5, price: 100, perWeek: 7 },
  { id: 'h:corvin', kind: 'crests', hero: 'corvin', amount: 10, price: 100, perWeek: 5 },
  { id: 'h:skiff', kind: 'crests', hero: 'skiff', amount: 10, price: 100, perWeek: 5 },
  { id: 'h:valorian', kind: 'crests', hero: 'valorian', amount: 5, price: 100, perWeek: 5 },
  { id: 'h:kestra', kind: 'crests', hero: 'kestra', amount: 5, price: 100, perWeek: 5 },
  { id: 'coreE', kind: 'coreE', amount: 1, price: 300, perWeek: 1 },
  { id: 'wild', kind: 'wild', amount: 5, price: 100, perWeek: 3 },
  { id: 'stones', kind: 'stones', amount: 2, price: 100, perWeek: 3 },
  { id: 'glyph', kind: 'glyphChest', amount: 1, price: 150, perWeek: 2 },
];

/** Items on sale now (each unique hero's crests only once that hero is released). */
export function arenaItems(pastaReleased = PASTA_RELEASED, kairoReleased = KAIRO_RELEASED, yerenReleased = YEREN_RELEASED): ArenaItem[] {
  const out = new Set(releasedUniques(pastaReleased, kairoReleased, yerenReleased));
  return ARENA_ITEMS.filter((i) => !i.hero || !isUnique(i.hero) || out.has(i.hero));
}

/** The one-of-a-kind heroes that are out now (each rolls its own rare drops). */
export function releasedUniques(pastaReleased = PASTA_RELEASED, kairoReleased = KAIRO_RELEASED, yerenReleased = YEREN_RELEASED): string[] {
  return [...(pastaReleased ? [PASTA_ID] : []), ...(kairoReleased ? [KAIRO_ID] : []), ...(yerenReleased ? [YEREN_ID] : [])];
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
