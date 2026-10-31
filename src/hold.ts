/**
 * Hold to level up: a tap does one buy, and keeping a finger (or the mouse) on the button keeps
 * buying, faster the longer it is held, until it is let go or a buy fails (out of gold, maxed).
 */

/** How long a press must last before it starts repeating. */
export const HOLD_DELAY_MS = 400;
/** Gap between the first repeats, then each gap shrinks to HOLD_SPEEDUP of the last. */
export const HOLD_FIRST_GAP_MS = 200;
export const HOLD_SPEEDUP = 0.85;
/** Fastest repeat: 20 buys a second. */
export const HOLD_MIN_GAP_MS = 50;

/** How long after letting go a click still counts as part of the hold. */
export const CLICK_GRACE_MS = 300;

type HoldTarget = Pick<HTMLButtonElement, 'addEventListener' | 'disabled'>;
type Press = { button?: number; pointerId?: number; preventDefault?: () => void };

/**
 * Wire a button so a tap runs `action` once and a hold runs it again and again.
 * `action` returns false when it could not buy, which ends the hold; returning nothing counts as bought.
 */
export function holdToRepeat(el: HoldTarget, action: () => boolean | void) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pointer: number | undefined;
  // A hold already did the buying, so the click that comes with letting go must not buy once more.
  let repeated = false;

  const stop = () => {
    clearTimeout(timer);
    timer = undefined;
    pointer = undefined;
  };
  const step = (gap: number) => {
    if (el.disabled || action() === false) return stop();
    repeated = true;
    timer = setTimeout(() => step(Math.max(HOLD_MIN_GAP_MS, gap * HOLD_SPEEDUP)), gap);
  };

  el.addEventListener('pointerdown', (e: Press) => {
    if ((e.button ?? 0) !== 0 || el.disabled) return;
    stop();
    repeated = false;
    pointer = e.pointerId;
    timer = setTimeout(() => step(HOLD_FIRST_GAP_MS), HOLD_DELAY_MS);
  });
  const end = (e: Press) => {
    if (pointer !== undefined && e.pointerId !== undefined && e.pointerId !== pointer) return;
    stop();
    // Some phones send no click after a long press; don't let that swallow the next keyboard tap.
    if (repeated) setTimeout(() => (repeated = false), CLICK_GRACE_MS);
  };
  // pointercancel: the touch turned into a scroll. pointerleave: the mouse slid off the button.
  for (const type of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(type, end as EventListener);
  // A long press on a phone would otherwise open the copy / share menu.
  el.addEventListener('contextmenu', (e: Press) => e.preventDefault?.());
  el.addEventListener('click', () => {
    if (repeated) {
      repeated = false;
      return;
    }
    action();
  });
}
