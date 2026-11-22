/**
 * "New:" cards: when a feature opens for a player, one short card says what it is, with a Take me there button.
 * Each shows once (its id goes in the save's tipsSeen). Features that were already open when this arrived are
 * marked as seen straight away, so existing players aren't flooded. Pure rules here; src/main.ts shows them.
 */

/** Where Take me there goes. */
export type IntroGo = 'market' | 'relics' | 'arena' | 'scout' | 'rush' | 'towers' | 'observatory' | 'journal' | 'alchemy' | 'rekindle';

export interface IntroView {
  bestStage: number;
  gold: number;
  hasEssence: boolean;
  pvpOpen: boolean;
  scoutOpen: boolean;
  rushOpen: boolean;
  observatoryOpen: boolean;
  towersOpen: boolean;
  alchemyOpen: boolean;
  ashfallReady: boolean;
  mutantsOpen: boolean;
}

export interface FeatureIntro {
  id: string;
  title: string;
  text: string;
  go: IntroGo;
  open: (v: IntroView) => boolean;
}

/** Saves that got the intros: anything already open by then counts as seen. */
export const INTROS_MARK = 'intros-v1';

export const FEATURE_INTROS: FeatureIntro[] = [
  { id: 'intro-market', title: 'New: Market Row', text: 'Open Stalls on the Market tab. They earn gold on their own, even while you are away.', go: 'market', open: (v) => v.bestStage >= 8 && v.gold >= 50 },
  { id: 'intro-relics', title: 'New: Relics', text: 'You have Trial Essence. Buy Relics with it on the Relics tab: they make your whole team stronger.', go: 'relics', open: (v) => v.hasEssence },
  { id: 'intro-colosseum', title: 'New: Colosseum', text: "Fight other players' teams on the Battle tab, climb the ranks and earn Starmotes for pink stars.", go: 'arena', open: (v) => v.pvpOpen },
  { id: 'intro-scouting', title: 'New: Scouting', text: 'Send heroes on timed missions on the Battle tab. They bring back materials to upgrade weapons.', go: 'scout', open: (v) => v.scoutOpen },
  { id: 'intro-rush', title: 'New: Rush', text: 'A weekend event of one-on-one hero fights on the Battle tab, for Glyphs and Gems.', go: 'rush', open: (v) => v.rushOpen },
  { id: 'intro-observatory', title: 'New: Observatory', text: 'Every Rekindle earns Sigils. Spend them on lasting boosts in the Observatory on Home.', go: 'observatory', open: (v) => v.observatoryOpen },
  { id: 'intro-towers', title: 'New: Element Towers', text: 'Five towers on the Battle tab, one per element. Climb floors with heroes of one element for Wild Crests, Stones and Gems.', go: 'towers', open: (v) => v.towersOpen },
  { id: 'intro-mutants', title: 'New: Mutants', text: 'From here on some enemies are mutants with a special trait. They pay extra gold; track them in the Hunting Journal.', go: 'journal', open: (v) => v.mutantsOpen },
  { id: 'intro-alchemist', title: "New: Alchemist's Table", text: 'Trade spare Essence, Stones, Ore and Crystal each week, on the Relics tab.', go: 'alchemy', open: (v) => v.alchemyOpen },
  { id: 'intro-ashfall', title: 'New: Ashfall', text: 'A bigger reset is ready on the Rekindle page: it trades your Ember levels for a lasting boost to every Rekindle.', go: 'rekindle', open: (v) => v.ashfallReady },
];

/** The first intro to show now, or null. */
export function dueIntro(v: IntroView, seen: readonly string[]): FeatureIntro | null {
  return FEATURE_INTROS.find((i) => !seen.includes(i.id) && i.open(v)) ?? null;
}

/** For a save that hasn't had intros yet: the ids of features already open (to mark as seen), plus the mark. */
export function introsAlreadyOpen(v: IntroView, seen: readonly string[]): string[] {
  if (seen.includes(INTROS_MARK)) return [];
  return [...FEATURE_INTROS.filter((i) => !seen.includes(i.id) && i.open(v)).map((i) => i.id), INTROS_MARK];
}
