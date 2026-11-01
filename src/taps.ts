/**
 * Keeps taps from getting lost while the page re-renders under the player's finger.
 *
 * The UI re-renders 5 times a second. If a button (or the text inside it) is rebuilt between the
 * press and the release, the browser never sees a press and release on the same element and the
 * click is dropped. So while a finger or mouse button is down, the part of the page it is on is
 * left alone; the newest content for it is put in as soon as the tap ends.
 */

type Listen = Pick<EventTarget, 'addEventListener'>;

/** Class put on the button under a finger the moment it touches, so every tap shows at once. */
export const PRESS_CLASS = 'pressing';
/** A quick tap still shows its pressed look for at least this long. */
export const PRESS_MIN_MS = 90;
/**
 * What counts as a button for the pressed look. Tab buttons only: the panel sections also carry
 * data-tab, and matching them made the whole lower panel shrink on any tap inside it.
 */
export const PRESSABLE = 'button, [role="button"], a[href], label, summary, button[data-g], button[data-pvp], button[data-tab]';

type Pressable = { classList: Pick<DOMTokenList, 'add' | 'remove'> };
let pressed: Pressable | null = null;
let pressedAt = 0;
let unpressTimer: ReturnType<typeof setTimeout> | undefined;

function pressableOf(target: unknown): Pressable | null {
  const el = target as { closest?: (sel: string) => Pressable | null } | null;
  const hit = el && typeof el.closest === 'function' ? el.closest(PRESSABLE) : null;
  return hit && !(hit as unknown as { disabled?: boolean }).disabled ? hit : null;
}

function press(target: unknown) {
  unpress(true);
  pressed = pressableOf(target);
  pressedAt = Date.now();
  pressed?.classList.add(PRESS_CLASS);
}

/** Drop the pressed look, keeping it up for PRESS_MIN_MS so even a very quick tap flashes. */
function unpress(now = false) {
  clearTimeout(unpressTimer);
  const el = pressed;
  if (!el) return;
  const left = PRESS_MIN_MS - (Date.now() - pressedAt);
  if (now || left <= 0) {
    el.classList.remove(PRESS_CLASS);
    if (pressed === el) pressed = null;
    return;
  }
  unpressTimer = setTimeout(() => unpress(true), left);
}

/**
 * Mark a button as working while a server call runs (guild, friends, Colosseum), so a tap that
 * waits on the network shows straight away that it was taken. Returns the same promise.
 */
export function busyWhile<T>(el: Element | null | undefined, work: Promise<T> | T): Promise<T> {
  const p = Promise.resolve(work);
  if (!el || !(work instanceof Promise)) return p;
  el.classList.add('busy');
  el.setAttribute('aria-busy', 'true');
  const done = () => {
    el.classList.remove('busy');
    el.removeAttribute('aria-busy');
  };
  p.then(done, done);
  return p;
}

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
    press(e.target);
  }, true);
  target.addEventListener('pointerup', () => {
    unpress();
    clearTimeout(releaseTimer);
    releaseTimer = setTimeout(letGo, RELEASE_MS);
  }, true);
  // A scroll took the touch over: no tap is coming.
  target.addEventListener('pointercancel', () => {
    unpress(true);
    letGo();
  }, true);
  // The click has its target now. Let go before its handlers run, so what they render shows at once.
  target.addEventListener('click', () => {
    clearTimeout(releaseTimer);
    held = null;
    releaseTimer = setTimeout(letGo, 0);
  }, true);
}
