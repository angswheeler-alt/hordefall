import { beforeEach, describe, expect, it } from 'vitest';
import { GameState } from '../src/state';
import { INTRO, TIPS, TIP_IDS, TUTORIAL_DONE, advanceIntro, pendingTip, type GuideView } from '../src/tutorialSteps';

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
