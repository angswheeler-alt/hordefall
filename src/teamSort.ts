import type { HeroDef, Rarity } from './data';
import type { GameState } from './state';

/** How Manage Team lists heroes. */
export type TeamSort = 'cp' | 'level' | 'stars' | 'rarity';

export const TEAM_SORTS: readonly TeamSort[] = ['cp', 'level', 'stars', 'rarity'];
export const TEAM_SORT_LABELS: Record<TeamSort, string> = { cp: 'Power', level: 'Level', stars: 'Stars', rarity: 'Rarity' };

const RARITY_RANK: Record<Rarity, number> = { common: 0, rare: 1, epic: 2, legendary: 3 };

/**
 * Heroes best first by the chosen sort; ties fall back to Combat Power, then name. `fixed` is for the Colosseum and
 * Guild Boss teams, which fight without gold or Ember levels: Power is Combat Power at the fixed level and Level sorts by Power.
 */
export function sortHeroes(heroes: readonly HeroDef[], by: TeamSort, s: GameState, fixed = false): HeroDef[] {
  const key = (h: HeroDef): number => {
    if (by === 'level') return fixed ? 0 : s.heroLevel(h.id);
    if (by === 'stars') return (s.stars[h.id] ?? 0) * 10 + (s.awaken[h.id] ?? 0);
    if (by === 'rarity') return RARITY_RANK[h.rarity];
    return 0;
  };
  return heroes
    .map((h) => ({ h, k: key(h), cp: fixed ? s.fixedCombatPower(h) : s.heroCombatPower(h) }))
    .sort((a, b) => b.k - a.k || b.cp.cmp(a.cp) || a.h.name.localeCompare(b.h.name))
    .map((x) => x.h);
}

/** The next sort when the Sort button is tapped. */
export function nextTeamSort(by: TeamSort): TeamSort {
  return TEAM_SORTS[(TEAM_SORTS.indexOf(by) + 1) % TEAM_SORTS.length];
}
