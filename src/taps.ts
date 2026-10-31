/**
 * Keeps taps from getting lost while the page re-renders under the player's finger.
 *
 * The UI re-renders 5 times a second. If a button (or the text inside it) is rebuilt between the
 * press and the release, the browser never sees a press and release on the same element and the
 * click is dropped. So while a finger or mouse button is down, the part of the page it is on is
 * left alone; the newest content for it is put in as soon as the tap ends.
 */

type Listen = Pick<EventTarget, 'addEventListener'>;

/** Release fallback when no click follows (a drag, or a press on something that isn't clickable). */
export const RELEASE_MS = 400;

let held: Node | null = null;
let releaseTimer: ReturnType<typeof setTimeout> | undefined;
const pending = new Map<HTMLElement, string>();

/** Is a finger or mouse button down on this element or something inside it? */
export function isHeld(el: Node) {
  return held !== null && el.contains(held);
}

/**
 * Set innerHTML only when it changed, so frequent renders don't rebuild nodes, and never while the
 * player is pressing inside it (that waits until the tap ends).
 */
export function setHtml(el: HTMLElement, html: string) {
  if (isHeld(el)) {
    pending.set(el, html);
    return;
  }
  pending.delete(el);
  if (el.dataset.html === html) return;
  el.dataset.html = html;
  el.innerHTML = html;
}

function letGo() {
  clearTimeout(releaseTimer);
  held = null;
  for (const [el, html] of [...pending]) setHtml(el, html);
}

/** Start watching presses. Call once with the window. */
export function watchTaps(target: Listen) {
  target.addEventListener('pointerdown', (e) => {
    clearTimeout(releaseTimer);
    held = e.target as Node | null;
  }, true);
  target.addEventListener('pointerup', () => {
    clearTimeout(releaseTimer);
    releaseTimer = setTimeout(letGo, RELEASE_MS);
  }, true);
  // A scroll took the touch over: no tap is coming.
  target.addEventListener('pointercancel', letGo, true);
  // The click has its target now. Let go before its handlers run, so what they render shows at once.
  target.addEventListener('click', () => {
    clearTimeout(releaseTimer);
    held = null;
    releaseTimer = setTimeout(letGo, 0);
  }, true);
}
