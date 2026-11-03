import { beforeEach, describe, expect, it } from 'vitest';
import { GameState } from '../src/state';
import { INTRO, TIPS, TIP_IDS, TUTORIAL_DONE, OLD_TUTORIAL_DONE, advanceIntro, pendingTip, type GuideView } from '../src/tutorialSteps';
import { CHEST_COST, CHEST_DROPS, HEROES } from '../src/data';

const view = (v: Partial<GuideView> = {}): GuideView => ({ tab: 'home', leveled: false, bossButton: false, ultReady: false, rekindleButton: false, bestStage: 1, firstChest: false, unlockReady: false, ...v });

beforeEach(() => localStorage.clear());

describe('First-time guide', () => {
  it('starts for a brand-new game', () => {
    expect(new GameState().tutorialStep).toBe(0);
    const s = new GameState();
    s.save();
    const back = new GameState();
    back.load();
    expect(back.tutorialStep).toBe(0);
    expect(back.tipsSeen).toEqual([]);
  });

  it('skips for saves from before the guide, tips included', () => {
    const old = new GameState().toJSON();
    delete old.tutorialStep;
    delete old.tipsSeen;
    GameState.writeLocal(old);
    const s = new GameState();
    s.load();
    expect(s.tutorialStep).toBe(TUTORIAL_DONE);
    expect(s.tipsSeen).toEqual(TIP_IDS);
    expect(pendingTip(s.tutorialStep, s.tipsSeen, view({ bossButton: true, bestStage: 500 }))).toBeNull();
  });

  it('keeps where the player is and the tips already seen', () => {
    const s = new GameState();
    s.tutorialStep = 3;
    s.tipsSeen = ['boss'];
    s.save();
    const back = new GameState();
    back.load();
    expect(back.tutorialStep).toBe(3);
    expect(back.tipsSeen).toEqual(['boss']);
  });

  it('waits on action steps until the player does the thing', () => {
    const heroes = INTRO.findIndex((st) => st.target.includes('data-tab="heroes"'));
    expect(advanceIntro(heroes, view())).toBe(heroes);
    expect(advanceIntro(heroes, view({ tab: 'heroes' }))).toBe(heroes + 1);
    expect(advanceIntro(heroes + 1, view({ tab: 'heroes', leveled: true }))).toBe(heroes + 2);
    // Steps with a button only move on from the button.
    expect(advanceIntro(0, view({ tab: 'heroes', leveled: true }))).toBe(0);
    expect(advanceIntro(TUTORIAL_DONE, view())).toBe(TUTORIAL_DONE);
  });

  it('every step can be finished: a button or an action', () => {
    for (const st of [...INTRO, ...TIPS]) expect(!!st.button || !!st.done).toBe(true);
  });

  it('shows no tips during the intro, then each tip once', () => {
    const v = view({ bossButton: true });
    expect(pendingTip(2, [], v)).toBeNull();
    expect(pendingTip(TUTORIAL_DONE, [], v)?.id).toBe('boss');
    expect(pendingTip(TUTORIAL_DONE, ['boss'], v)).toBeNull();
    expect(pendingTip(TUTORIAL_DONE, [], view({ bestStage: 51 }))?.id).toBe('trials');
    expect(pendingTip(TUTORIAL_DONE, [], view({ bestStage: 50 }))).toBeNull();
  });

  it('points a new player at the first Hero Chest, then at unlocking a hero', () => {
    expect(pendingTip(TUTORIAL_DONE, [], view({ firstChest: true }))).toBeNull();
    expect(pendingTip(TUTORIAL_DONE, [], view({ firstChest: true, tab: 'heroes' }))?.id).toBe('chest');
    expect(pendingTip(TUTORIAL_DONE, ['chest'], view({ firstChest: true, tab: 'heroes' }))).toBeNull();
    expect(pendingTip(TUTORIAL_DONE, ['chest'], view({ unlockReady: true, tab: 'heroes' }))?.id).toBe('unlock');
  });
});

describe('First Hero Chest brings a new hero', () => {
  it('has an intro step that waits for the first chest', () => {
    const at = INTRO.findIndex((st) => st.target === '#chest-btn');
    expect(at).toBeGreaterThan(0);
    expect(advanceIntro(at, view({ tab: 'heroes', firstChest: true }))).toBe(at);
    expect(advanceIntro(at, view({ tab: 'heroes', firstChest: false }))).toBe(at + 1);
  });

  it('unlocks a Common who joins the team, on top of the normal drops, only once', () => {
    const s = new GameState();
    s.gems = CHEST_COST * 2;
    const owned = () => Object.keys(s.levels).filter((id) => s.levels[id] > 0);
    const before = owned().length;
    const drops = s.summon()!;
    expect(drops).toHaveLength(CHEST_DROPS + 1);
    const gift = drops[0];
    expect(gift.joined).toBe(true);
    expect(gift.isNew).toBe(true);
    const def = HEROES.find((h) => h.id === gift.heroId)!;
    expect(def.rarity).toBe('common');
    expect(s.levels[gift.heroId]).toBe(1);
    expect(s.benched[gift.heroId]).toBeFalsy();
    expect(owned().length).toBeGreaterThanOrEqual(before + 1);
    const again = s.summon()!;
    expect(again).toHaveLength(CHEST_DROPS);
    expect(again.some((d) => d.joined)).toBe(false);
  });

  it('keeps an old finished guide finished after the intro grew', () => {
    const old = new GameState().toJSON();
    old.tutorialStep = OLD_TUTORIAL_DONE;
    delete old.tutorialLen;
    GameState.writeLocal(old);
    const s = new GameState();
    s.load();
    expect(s.tutorialStep).toBe(TUTORIAL_DONE);
  });

  it('shows no Shop dot for the Hero Shop on a brand-new game', () => {
    const s = new GameState();
    expect(s.shopWaiting()).toBe(false);
  });
});
