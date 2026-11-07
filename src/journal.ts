/**
 * The Hunting Journal (Samuel, 2026-11-03): every enemy has a page that counts how many the player has beaten.
 * Each page has three tiers; reaching one gives a small permanent damage bonus against that enemy only.
 * Pages: each of the 9 mob kinds in each of the 5 element colours (45; the 4 special kinds from src/mobs.ts
 * first show up on stages 100, 300, 600 and 1,000), each of the 5 mutation traits on each of the 9 mob kinds (45, from
 * stage 501, src/mutations.ts; Samuel 2026-11-07: a page for each mutant of each mob), the 5 stage bosses (who are
 * also the every-100th element bosses from stage 600), the 5 Trial bosses and the 5 Guild Bosses: 105 pages.
 *
 * Shinies: about 1 in SHINY_ODDS regular mobs (balance check 2026-11-03: a normal run kills ~3,000 an hour, so 1 in 500 with 10 a day added ~35% to free Gems) in a normal run is a shiny, a recoloured one with a sparkle. Beating
 * one pays a small treasure (Gems, sometimes a Hero Chest) and puts a gold stamp on its page for an extra bonus.
 * Shinies are capped per day (SHINY_PER_DAY) so the treasure can't flood the Gem economy.
 */
import { ELEMENT_BOSSES, GUILD_BOSS_NAMES, TRIAL_BOSS_NAMES, type Element } from './data';
import { MOB_ELEMENTS, type MobId } from './mobs';
import { MUTATIONS, MUTATION_IDS, type MutationId } from './mutations';

export type JournalGroup = 'mob' | 'mutant' | 'boss' | 'trial' | 'guild';

export interface JournalPage {
  id: string;
  group: JournalGroup;
  name: string;
  element: Element;
  /** Mob pages: which kind. */
  mob?: MobId;
  /** Mutant pages: which trait (on the page's mob kind, any colour). */
  mutation?: MutationId;
  /** Kills (Guild Boss: fights) for each tier. */
  tiers: readonly number[];
}

/** Mob kinds in the order the Journal lists them (the order they first show up). */
export const JOURNAL_MOBS: MobId[] = ['grunt', 'flyer', 'brute', 'scuttler', 'caster', 'shieldbearer', 'bomber', 'summoner', 'burrower'];

export const MOB_NAMES: Record<MobId, string> = {
  grunt: 'Grunt',
  flyer: 'Flyer',
  brute: 'Brute',
  scuttler: 'Scuttler',
  caster: 'Caster',
  shieldbearer: 'Shieldbearer',
  bomber: 'Bomber',
  summoner: 'Summoner',
  burrower: 'Burrower',
};

/** Regular mobs die by the thousand, bosses far less often, so each group has its own tiers. */
export const JOURNAL_TIERS: Record<JournalGroup, readonly number[]> = {
  mob: [100, 1_000, 10_000],
  // A mob page counts one colour of a kind (1 in 5); a mutant page one trait of a kind (5-15% of it, then 1 in 5).
  // So a mutant page fills about a tenth as fast as a mob page, and its tiers are a tenth as big.
  mutant: [10, 100, 1_000],
  boss: [10, 100, 1_000],
  trial: [10, 100, 1_000],
  // The Guild Boss counts every fight (a level only falls to the whole guild), with up to ~48 fights a day.
  guild: [10, 50, 250],
};

/** Extra damage against the page's enemy at each tier (the total, not added up). */
export const TIER_BONUS = [0.03, 0.06, 0.1];
/** Extra damage on top for a page with a gold stamp (a shiny of it beaten). */
export const STAMP_BONUS = 0.02;

export const SHINY_ODDS = 2000;
export const SHINY_PER_DAY = 5;
export const SHINY_GEMS = 5;
/** Share of shiny treasures that are a Hero Chest instead of Gems. */
export const SHINY_CHEST_CHANCE = 0.15;

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export const mobPageId = (mob: MobId, element: Element) => `mob_${mob}_${element}`;
export const bossPageId = (art: Element) => `boss_${art}`;
export const trialPageId = (element: Element) => `trial_${element}`;
export const guildPageId = (element: Element) => `guild_${element}`;
export const mutantPageId = (id: MutationId, mob: MobId) => `mutant_${id}_${mob}`;

/**
 * Saves from before 2026-11-07 had one page per trait (`mutant_<trait>`). Their kills are spread over the mob kinds
 * that can mutate on any mutant stage, by roughly how often each shows up (flyers 25%, grunts most of the rest).
 */
export const OLD_MUTANT_SHARES: Array<[MobId, number]> = [['grunt', 0.4], ['flyer', 0.25], ['brute', 0.12], ['scuttler', 0.12], ['caster', 0.11]];

/** Element whose colour and mob art a mutant page borrows. */
const MUTANT_LOOK: Record<MutationId, Element> = { armored: 'earth', swift: 'water', splitting: 'dark', enraged: 'fire', mending: 'light' };

function buildPages(): JournalPage[] {
  const pages: JournalPage[] = [];
  for (const mob of JOURNAL_MOBS) {
    for (const element of MOB_ELEMENTS) {
      pages.push({ id: mobPageId(mob, element), group: 'mob', name: `${cap(element)} ${MOB_NAMES[mob]}`, element, mob, tiers: JOURNAL_TIERS.mob });
    }
  }
  for (const mob of JOURNAL_MOBS) {
    for (const id of MUTATION_IDS) {
      pages.push({ id: mutantPageId(id, mob), group: 'mutant', name: `${MUTATIONS[id].name} ${MOB_NAMES[mob]}`, element: MUTANT_LOOK[id], mob, mutation: id, tiers: JOURNAL_TIERS.mutant });
    }
  }
  for (const element of MOB_ELEMENTS) pages.push({ id: bossPageId(element), group: 'boss', name: ELEMENT_BOSSES[element].name, element, tiers: JOURNAL_TIERS.boss });
  for (const element of MOB_ELEMENTS) pages.push({ id: trialPageId(element), group: 'trial', name: TRIAL_BOSS_NAMES[element], element, tiers: JOURNAL_TIERS.trial });
  for (const element of MOB_ELEMENTS) pages.push({ id: guildPageId(element), group: 'guild', name: GUILD_BOSS_NAMES[element], element, tiers: JOURNAL_TIERS.guild });
  return pages;
}

export const JOURNAL_PAGES: JournalPage[] = buildPages();
const BY_ID = new Map(JOURNAL_PAGES.map((p) => [p.id, p]));

export function journalPage(id: string): JournalPage | undefined {
  return BY_ID.get(id);
}

/** Tiers reached (0 to 3) with `kills`. */
export function journalTier(page: JournalPage, kills: number): number {
  return page.tiers.filter((t) => kills >= t).length;
}

/** The kill count for the next tier, or null at the top. */
export function nextTierAt(page: JournalPage, kills: number): number | null {
  return page.tiers.find((t) => kills < t) ?? null;
}

/** Extra damage (a share) against this page's enemy. */
export function journalBonus(page: JournalPage, kills: number, stamped: boolean): number {
  const tier = journalTier(page, kills);
  return (tier ? TIER_BONUS[tier - 1] : 0) + (stamped ? STAMP_BONUS : 0);
}

/** Whether a regular mob spawning now is a shiny: `roll` in [0, 1), `caughtToday` shinies beaten today. */
export function isShinyRoll(roll: number, caughtToday: number): boolean {
  return caughtToday < SHINY_PER_DAY && roll < 1 / SHINY_ODDS;
}

/** What a beaten shiny drops, from `roll` in [0, 1). */
export function shinyTreasure(roll: number): 'chest' | 'gems' {
  return roll < SHINY_CHEST_CHANCE ? 'chest' : 'gems';
}

/** Kill counts from a save, kept to known pages and whole numbers. */
export function cleanJournal(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!v || typeof v !== 'object') return out;
  for (const [id, n] of Object.entries(v as Record<string, unknown>)) {
    const kills = Math.floor(Number(n) || 0);
    if (kills <= 0) continue;
    if (BY_ID.has(id)) out[id] = (out[id] ?? 0) + kills;
    else if ((MUTATION_IDS as string[]).includes(id.replace(/^mutant_/, '')) && id.startsWith('mutant_')) {
      // An old one-page-per-trait count: spread it over the mob kinds (OLD_MUTANT_SHARES), the rest to grunts.
      const trait = id.slice('mutant_'.length) as MutationId;
      let left = kills;
      for (const [mob, share] of OLD_MUTANT_SHARES) {
        const part = mob === 'grunt' ? 0 : Math.floor(kills * share);
        if (part > 0) out[mutantPageId(trait, mob)] = (out[mutantPageId(trait, mob)] ?? 0) + part;
        left -= part;
      }
      out[mutantPageId(trait, 'grunt')] = (out[mutantPageId(trait, 'grunt')] ?? 0) + left;
    }
  }
  return out;
}

/** Gold stamps from a save: known mob pages only, no repeats. */
export function cleanStamps(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((id): id is string => typeof id === 'string' && BY_ID.get(id)?.group === 'mob'))];
}
