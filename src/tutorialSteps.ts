/**
 * The first-time guide: a short intro for a new game, then one-off tips the first time
 * something new shows up. Pure data and rules here; src/tutorial.ts draws it.
 */
import { BOSS_EVERY, TRIAL_UNLOCK_STAGE, REKINDLE_STAGE } from './data';

/** What the guide can see of the game right now. */
export interface GuideView {
  /** The open tab ('home' when nothing is open). */
  tab: string;
  /** A hero gained a gold level since this step started. */
  leveled: boolean;
  bossButton: boolean;
  ultReady: boolean;
  rekindleButton: boolean;
  bestStage: number;
  /** Enough Gems for a Hero Chest, and none opened yet. */
  firstChest: boolean;
  /** A hero has enough crests to unlock. */
  unlockReady: boolean;
}

export interface GuideStep {
  /** CSS selector of the thing to point at. */
  target: string;
  title: string;
  text: string;
  /** Button that moves on; steps without one move on when `done` says so. */
  button?: string;
  done?: (v: GuideView) => boolean;
}

export const INTRO: GuideStep[] = [
  {
    target: '#game',
    title: 'Welcome to Hordefall!',
    text: 'Your heroes fight on their own, even while you are away. Every enemy they beat drops gold.',
    button: 'Next',
  },
  {
    target: '.gold-pill',
    title: 'Gold',
    text: 'Gold keeps coming in. Spend it to make your heroes stronger.',
    button: 'Next',
  },
  {
    target: '#tabbar button[data-tab="heroes"]',
    title: 'Your team',
    text: 'Tap Heroes to see your team.',
    done: (v) => v.tab === 'heroes',
  },
  {
    target: '#heroes .hero:not([hidden]) button',
    title: 'Level up',
    text: 'Tap Level Up when you have the gold. Stronger heroes clear stages faster.',
    button: 'Got it',
    done: (v) => v.leveled,
  },
  {
    target: '#home-btn',
    title: 'Back home',
    text: 'Tap the arrow (or the open tab again) to close it and go back home.',
    done: (v) => v.tab === 'home',
  },
  {
    target: '.objective',
    title: 'Bosses',
    text: `A boss waits every ${BOSS_EVERY} stages. Beat them to claim the rewards here. Good luck!`,
    button: "Let's go!",
  },
];

/** The intro step a finished (or skipped) guide sits on. */
export const TUTORIAL_DONE = INTRO.length;

export interface GuideTip extends GuideStep {
  id: string;
  when: (v: GuideView) => boolean;
}

export const TIPS: GuideTip[] = [
  {
    id: 'boss',
    target: '#boss',
    title: 'Boss too strong?',
    text: 'Your team keeps farming this stage for gold. Level up your heroes. With Auto boss on, they try the boss again every minute, or tap Fight boss to try now.',
    button: 'Got it',
    when: (v) => v.bossButton,
  },
  {
    id: 'ult',
    target: '#ults .ult.ready',
    title: 'Ultimate ready!',
    text: 'Tap it to unleash it, or switch on Auto ult to fire them for you.',
    button: 'Got it',
    when: (v) => v.ultReady,
  },
  {
    id: 'chest',
    target: '#chest-btn',
    title: 'Open a Hero Chest',
    text: 'You have Gems for a Hero Chest. Its crests unlock new heroes, and a bigger team clears stages much faster.',
    button: 'Got it',
    when: (v) => v.firstChest && v.tab === 'heroes',
  },
  {
    id: 'unlock',
    target: '#team-btn',
    title: 'New hero ready!',
    text: 'You have the crests to unlock a hero. Tap Manage Team to unlock it and add it to your team.',
    button: 'Got it',
    when: (v) => v.unlockReady && v.tab === 'heroes',
  },
  {
    id: 'trials',
    target: '#tabbar button[data-tab="battle"]',
    title: 'Daily Trials are open',
    text: 'Fight element bosses in Battle to earn hero crests. Crests unlock new heroes and add stars.',
    button: 'Got it',
    when: (v) => v.bestStage >= TRIAL_UNLOCK_STAGE,
  },
  {
    id: 'rekindle',
    target: '#rekindle',
    title: 'Rekindle',
    text: `From stage ${REKINDLE_STAGE} you can start a new run for Embers. Embers level heroes for good, so every run goes further.`,
    button: 'Got it',
    when: (v) => v.rekindleButton,
  },
];

export const TIP_IDS = TIPS.map((t) => t.id);

/** The intro step after `step`, given what the player just did (or `step` itself while it waits). */
export function advanceIntro(step: number, view: GuideView): number {
  const cur = INTRO[step];
  if (!cur) return TUTORIAL_DONE;
  return cur.done?.(view) ? step + 1 : step;
}

/** The first tip that applies now and hasn't been shown; none while the intro runs. */
export function pendingTip(step: number, seen: readonly string[], view: GuideView): GuideTip | null {
  if (step < TUTORIAL_DONE) return null;
  return TIPS.find((t) => !seen.includes(t.id) && t.when(view)) ?? null;
}
