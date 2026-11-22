import { describe, expect, it } from 'vitest';
import { FEATURE_INTROS, INTROS_MARK, dueIntro, introsAlreadyOpen, type IntroView } from '../src/featureIntros';

const none = (): IntroView => ({
  bestStage: 1,
  gold: 0,
  hasEssence: false,
  pvpOpen: false,
  scoutOpen: false,
  rushOpen: false,
  observatoryOpen: false,
  towersOpen: false,
  alchemyOpen: false,
  ashfallReady: false,
  mutantsOpen: false,
});

describe('"New:" feature cards', () => {
  it('a brand-new save gets only the mark, so every card shows later', () => {
    expect(introsAlreadyOpen(none(), [])).toEqual([INTROS_MARK]);
    expect(dueIntro(none(), [INTROS_MARK])).toBeNull();
  });
  it('an existing player has what is already open marked as seen', () => {
    const v = { ...none(), bestStage: 900, gold: 1e9, hasEssence: true, pvpOpen: true, scoutOpen: true, observatoryOpen: true, mutantsOpen: true };
    const seen = introsAlreadyOpen(v, []);
    expect(seen).toEqual(['intro-market', 'intro-relics', 'intro-colosseum', 'intro-scouting', 'intro-observatory', 'intro-mutants', INTROS_MARK]);
    expect(dueIntro(v, seen)).toBeNull();
    // Rush opens later: that one still shows.
    expect(dueIntro({ ...v, rushOpen: true }, seen)?.id).toBe('intro-rush');
    expect(introsAlreadyOpen({ ...v, rushOpen: true }, seen)).toEqual([]);
  });
  it('shows one card at a time, each once', () => {
    const v = { ...none(), bestStage: 60, gold: 80, hasEssence: true };
    expect(dueIntro(v, [INTROS_MARK])?.id).toBe('intro-market');
    expect(dueIntro(v, [INTROS_MARK, 'intro-market'])?.id).toBe('intro-relics');
    expect(dueIntro(v, [INTROS_MARK, 'intro-market', 'intro-relics'])).toBeNull();
  });
  it('every card is one short sentence or two', () => {
    for (const i of FEATURE_INTROS) {
      expect(i.title.startsWith('New: ')).toBe(true);
      expect(i.text.length).toBeLessThanOrEqual(140);
    }
  });
});
