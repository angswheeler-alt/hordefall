/**
 * Draws the first-time guide (src/tutorialSteps.ts): a spotlight on what to tap and a
 * speech bubble. It never blocks the game; taps go through to whatever is underneath.
 */
import type { GameState } from './state';
import { INTRO, TUTORIAL_DONE, advanceIntro, pendingTip, type GuideStep, type GuideTip, type GuideView } from './tutorialSteps';

/** Full-screen pages and dialogs; the guide waits while one is open. */
const COVERS = ['#modal', '#sheet', '#rk', '#coll', '#settings', '#social', '#acct-dialog', '#trial-hud'];

export class Tutorial {
  private root = document.createElement('div');
  private hole = document.createElement('div');
  private bubble = document.createElement('div');
  /** What is on screen now, so the bubble is only rebuilt when it changes. */
  private shown: GuideStep | null = null;
  private tip: GuideTip | null = null;
  private levelMark = 0;
  private stepMark = -1;

  constructor(private state: GameState) {
    this.root.id = 'coach';
    this.root.hidden = true;
    this.hole.className = 'coach-hole';
    this.bubble.className = 'coach-tip';
    this.bubble.setAttribute('role', 'dialog');
    this.root.append(this.hole, this.bubble);
    document.body.appendChild(this.root);
    // Tapping the thing a tip points at counts as reading it.
    document.addEventListener(
      'click',
      (e) => {
        if (!this.tip) return;
        const el = document.querySelector(this.tip.target);
        if (el && e.target instanceof Node && el.contains(e.target)) this.closeTip();
      },
      true,
    );
    window.addEventListener('resize', () => this.place());
    setInterval(() => this.tick(), 250);
    this.tick();
  }

  /** Start the intro again (Settings > Tutorial). */
  replay() {
    this.state.tutorialStep = 0;
    this.stepMark = -1;
    this.tip = null;
    this.tick();
  }

  private levelSum() {
    return Object.values(this.state.levels).reduce((a, b) => a + b, 0);
  }

  private view(): GuideView {
    const open = document.querySelector<HTMLElement>('#panels .panel:not([hidden])');
    return {
      tab: open?.dataset.tab ?? 'home',
      leveled: this.levelSum() > this.levelMark,
      bossButton: !document.getElementById('boss')?.hidden,
      ultReady: !!document.querySelector('#ults .ult.ready'),
      rekindleButton: !document.getElementById('rekindle')?.hidden,
      bestStage: this.state.bestStage,
    };
  }

  private tick() {
    if (document.hidden) return;
    const s = this.state;
    if (COVERS.some((sel) => document.querySelector<HTMLElement>(sel)?.hidden === false)) return this.show(null);
    if (s.tutorialStep < TUTORIAL_DONE) {
      if (this.stepMark !== s.tutorialStep) {
        this.stepMark = s.tutorialStep;
        this.levelMark = this.levelSum();
      }
      s.tutorialStep = advanceIntro(s.tutorialStep, this.view());
      return this.show(INTRO[s.tutorialStep] ?? null);
    }
    const view = this.view();
    // A tip whose reason is gone (the boss was beaten, the ult was fired) has done its job.
    if (this.tip && !this.tip.when(view)) this.closeTip();
    if (!this.tip) this.tip = pendingTip(s.tutorialStep, s.tipsSeen, view);
    this.show(this.tip);
  }

  private closeTip() {
    if (this.tip && !this.state.tipsSeen.includes(this.tip.id)) this.state.tipsSeen.push(this.tip.id);
    this.tip = null;
    this.show(null);
  }

  private next() {
    if (this.tip) return this.closeTip();
    this.state.tutorialStep = Math.min(TUTORIAL_DONE, this.state.tutorialStep + 1);
    this.tick();
  }

  private skip() {
    this.state.tutorialStep = TUTORIAL_DONE;
    this.show(null);
  }

  private show(step: GuideStep | null) {
    if (step !== this.shown) {
      this.shown = step;
      this.root.hidden = !step;
      if (step) this.build(step);
    }
    this.place();
  }

  private build(step: GuideStep) {
    const intro = !this.tip;
    this.root.classList.toggle('intro', intro);
    const at = INTRO.indexOf(step);
    this.bubble.innerHTML = '';
    const h = document.createElement('b');
    h.textContent = step.title;
    const p = document.createElement('p');
    p.textContent = step.text;
    const row = document.createElement('div');
    row.className = 'coach-row';
    if (intro) {
      const skip = document.createElement('button');
      skip.className = 'coach-skip';
      skip.textContent = 'Skip tutorial';
      skip.addEventListener('click', () => this.skip());
      const count = document.createElement('small');
      count.textContent = `${at + 1}/${INTRO.length}`;
      row.append(skip, count);
    }
    if (step.button) {
      const go = document.createElement('button');
      go.className = 'hot coach-go';
      go.textContent = step.button;
      go.addEventListener('click', () => this.next());
      row.append(go);
    }
    this.bubble.append(h, p, row);
  }

  /** Put the spotlight on the target and the bubble next to it (below it, or above when it sits low). */
  private place() {
    const step = this.shown;
    if (!step) return;
    const el = document.querySelector<HTMLElement>(step.target);
    const r = el && el.offsetParent !== null ? el.getBoundingClientRect() : null;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    this.hole.hidden = !r;
    const bw = Math.min(320, vw - 24);
    this.bubble.style.width = `${bw}px`;
    if (!r) {
      this.bubble.style.left = `${(vw - bw) / 2}px`;
      this.bubble.style.top = `${vh * 0.35}px`;
      return;
    }
    const pad = 6;
    Object.assign(this.hole.style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
    const bh = this.bubble.offsetHeight;
    const below = r.top + r.height / 2 < vh / 2;
    let top = below ? r.bottom + pad + 10 : r.top - pad - 10 - bh;
    // A target bigger than half the screen (the battle lane) gets the bubble inside its lower part.
    if (below && top + bh > vh - 8) top = Math.max(8, Math.min(r.bottom, vh) - bh - 16);
    top = Math.max(8, Math.min(vh - bh - 8, top));
    const left = Math.max(12, Math.min(vw - bw - 12, r.left + r.width / 2 - bw / 2));
    this.bubble.style.left = `${left}px`;
    this.bubble.style.top = `${top}px`;
  }
}
