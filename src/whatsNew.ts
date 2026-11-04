// "What's new" (Samuel, 2026-11-03): after an update that adds something, players see a short list of
// what changed, once, in the pop-up that opens with the game.
//
// HOW TO ADD AN ENTRY (every feature PR does this):
//   Put one new object at the TOP of WHATS_NEW:
//     { id: 'short-kebab-name', date: 'YYYY-MM-DD', text: '<b>Feature name</b>: one short sentence.' }
//   - id: unique and never changed or reused (it is how a save remembers what it has seen).
//   - text: general, player-facing, at most WHATS_NEW_MAX_CHARS characters. <b> is allowed, nothing else.
//   - Skip pure fixes nobody would notice, balance tweaks and internal changes.
// tests/whats-new.test.ts checks the rules above.

export interface WhatsNewEntry {
  id: string;
  /** Day the change shipped, YYYY-MM-DD. */
  date: string;
  /** One short line for players (safe HTML, only <b>). */
  text: string;
}

/** Heading of the section in the pop-up that opens with the game. */
export const WHATS_NEW_TITLE = "What's new";

/** Longest line allowed, so the pop-up stays short. */
export const WHATS_NEW_MAX_CHARS = 140;
/** Most lines shown at once; anyone further behind gets "and N more". */
export const WHATS_NEW_SHOWN = 8;

/** Newest first. */
export const WHATS_NEW: WhatsNewEntry[] = [
  { id: 'levels-by-mode', date: '2026-11-04', text: '<b>Levels by mode</b>: Guild Boss, Colosseum and Rush ignore gold and Ember levels; stars, relics, weapons and Glyphs decide.' },
  { id: 'hero-compare', date: '2026-11-04', text: '<b>Easier hero compare</b>: Manage Team shows power bars, and each hero shows how much stronger or weaker they are (+45%, x8.3).' },
  { id: 'special-mobs', date: '2026-11-04', text: '<b>New enemies</b> deeper in: Shieldbearers, Bombers, Summoners and Burrowers, each with its own trick and Journal pages.' },
  { id: 'pvp-no-ults', date: '2026-11-04', text: '<b>Fair fights</b>: Ultimates are now off in the Colosseum and Rush, so PvP battles come down to your heroes.' },
  { id: 'ascendant-names', date: '2026-11-03', text: '<b>New names</b>: the Ascendant heroes are now Grimward, Ruffy, Juno, Hayle and Rivelle.' },
  { id: 'victory-run', date: '2026-11-03', text: '<b>Victory run</b>: after a stage clear your heroes keep running off the screen into the next fight.' },
  {
    id: 'mutation-mobs',
    date: '2026-11-03',
    text: '<b>Mutation mobs</b> after stage 500: Armored, Swift, Splitting, Enraged or Mending. Tougher, but 1.5x gold, with Journal pages.',
  },
  {
    id: 'hunting-journal',
    date: '2026-11-03',
    text: '<b>Hunting Journal</b> on Home: fill pages by defeating mobs and bosses for bonus damage, and watch for rare shiny mobs.',
  },
  {
    id: 'leaderboard-big-teams',
    date: '2026-11-03',
    text: '<b>Leaderboards</b> now show your real stage when your team has more than 5 heroes.',
  },
  {
    id: 'single-troop-heroes',
    date: '2026-11-03',
    text: '<b>Troop heroes</b> like Shrimp Archer now fight as one strong unit instead of a squad of three.',
  },
];

/** Every id in the list: what a brand-new player counts as already seen. */
export const allWhatsNewIds = (): string[] => WHATS_NEW.map((e) => e.id);

/** Entries the player hasn't seen yet, newest first. */
export function unseenWhatsNew(seen: readonly string[]): WhatsNewEntry[] {
  const known = new Set(seen);
  return WHATS_NEW.filter((e) => !known.has(e.id));
}

/** Lines for the pop-up: at most WHATS_NEW_SHOWN, then "and N more". Empty when nothing is new. */
export function whatsNewLines(seen: readonly string[]): string[] {
  const unseen = unseenWhatsNew(seen);
  const lines = unseen.slice(0, WHATS_NEW_SHOWN).map((e) => `• ${e.text}`);
  const more = unseen.length - lines.length;
  if (more > 0) lines.push(`…and ${more} more update${more === 1 ? '' : 's'}.`);
  return lines;
}
