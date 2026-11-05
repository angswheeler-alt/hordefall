/**
 * Drag to reorder the team row in Manage Team (user 2026-11-05: "drag and drop so I can organize the order
 * for easier leveling"). Works with a finger and a mouse:
 * - finger: hold a hero for a moment, then drag (a quick swipe still scrolls the row);
 * - mouse: press and move.
 * The slots never leave the page while dragging: the held one follows the pointer and the others slide
 * aside with CSS transforms, so taps and pointer tracking stay intact. On release `onDrop` gets the new order.
 */

/** Move the item at `from` to `to` (both indexes in the list), keeping everyone else in order. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const out = [...list];
  if (from < 0 || from >= out.length) return out;
  const [x] = out.splice(from, 1);
  out.splice(Math.max(0, Math.min(out.length, to)), 0, x);
  return out;
}

/** Where a held item lands: the number of other items whose centre is left of `x`. */
export function dropIndex(centers: readonly number[], from: number, x: number): number {
  let n = 0;
  centers.forEach((c, i) => {
    if (i !== from && c < x) n++;
  });
  return n;
}

/** How long a finger holds still before the drag starts, and how far it may wander meanwhile. */
export const HOLD_MS = 220;
const SLOP = 8;

export function attachTeamDrag(host: HTMLElement, onDrop: (ids: string[]) => void) {
  type Drag = { slots: HTMLElement[]; ids: string[]; from: number; to: number; centers: number[]; step: number; strip: HTMLElement; startX: number; held: HTMLElement };
  let pending: { slot: HTMLElement; pointerId: number; x: number; y: number; timer: number; mouse: boolean } | null = null;
  let drag: Drag | null = null;
  let lastX = 0;
  let scrollTimer = 0;
  let swallowClick = false;

  const contentX = (strip: HTMLElement, clientX: number) => clientX - strip.getBoundingClientRect().left + strip.scrollLeft;

  const begin = () => {
    if (!pending) return;
    const { slot } = pending;
    const strip = slot.parentElement as HTMLElement | null;
    pending = null;
    if (!strip || !slot.isConnected) return;
    const slots = [...strip.querySelectorAll<HTMLElement>('.tm-slot[data-drag]')];
    const from = slots.indexOf(slot);
    if (from < 0 || slots.length < 2) return;
    const sr = strip.getBoundingClientRect();
    const centers = slots.map((el) => {
      const r = el.getBoundingClientRect();
      return r.left + r.width / 2 - sr.left + strip.scrollLeft;
    });
    const step = slots.length > 1 ? centers[1] - centers[0] : slot.offsetWidth;
    drag = { slots, ids: slots.map((el) => el.dataset.drag!), from, to: from, centers, step, strip, startX: contentX(strip, lastX), held: slot };
    strip.classList.add('drag-on');
    slot.classList.add('dragging');
    navigator.vibrate?.(10);
    scrollTimer = window.setInterval(edgeScroll, 16);
  };

  const layout = () => {
    if (!drag) return;
    const { slots, from, centers, strip, startX, step } = drag;
    const x = contentX(strip, lastX);
    const to = dropIndex(centers, from, x);
    drag.to = to;
    slots.forEach((el, i) => {
      if (i === from) {
        el.style.transform = `translateX(${Math.round(x - startX)}px) scale(1.08)`;
        return;
      }
      // Slots between the old and new spot slide over by one to make room.
      const shift = from < to && i > from && i <= to ? -step : from > to && i >= to && i < from ? step : 0;
      el.style.transform = shift ? `translateX(${shift}px)` : '';
    });
  };

  /** Near either end of the row, keep scrolling so far slots can be reached. */
  const edgeScroll = () => {
    if (!drag) return;
    const r = drag.strip.getBoundingClientRect();
    const d = lastX < r.left + 28 ? -6 : lastX > r.right - 28 ? 6 : 0;
    if (!d) return;
    const before = drag.strip.scrollLeft;
    drag.strip.scrollLeft += d;
    if (drag.strip.scrollLeft !== before) layout();
  };

  const finish = (drop: boolean) => {
    if (pending) {
      clearTimeout(pending.timer);
      pending = null;
    }
    if (!drag) return;
    const d = drag;
    drag = null;
    clearInterval(scrollTimer);
    d.strip.classList.remove('drag-on');
    d.held.classList.remove('dragging');
    for (const el of d.slots) el.style.transform = '';
    swallowClick = true;
    setTimeout(() => (swallowClick = false), 400);
    if (drop && d.to !== d.from) onDrop(moveItem(d.ids, d.from, d.to));
  };

  host.addEventListener('pointerdown', (e) => {
    const slot = (e.target as HTMLElement).closest<HTMLElement>('.tm-slot[data-drag]');
    if (!slot || e.button > 0 || drag) return;
    finish(false);
    lastX = e.clientX;
    const mouse = e.pointerType === 'mouse';
    pending = { slot, pointerId: e.pointerId, x: e.clientX, y: e.clientY, mouse, timer: mouse ? 0 : window.setTimeout(begin, HOLD_MS) };
  });
  window.addEventListener('pointermove', (e) => {
    if (pending && e.pointerId === pending.pointerId) {
      lastX = e.clientX;
      const far = Math.hypot(e.clientX - pending.x, e.clientY - pending.y) > SLOP;
      // A mouse drags as soon as it moves; a finger that moves before the hold is scrolling instead.
      if (far) pending.mouse ? begin() : finish(false);
      if (drag) layout();
      return;
    }
    if (drag) {
      lastX = e.clientX;
      layout();
    }
  });
  window.addEventListener('pointerup', () => finish(true));
  window.addEventListener('pointercancel', () => finish(false));
  // Once a drag is on, the finger moves the hero, not the page.
  host.addEventListener(
    'touchmove',
    (e) => {
      if (drag) e.preventDefault();
    },
    { passive: false },
  );
  // The press that ends a drag isn't a tap on the hero.
  host.addEventListener(
    'click',
    (e) => {
      if (!swallowClick || !(e.target as HTMLElement).closest('.tm-slots')) return;
      swallowClick = false;
      e.stopPropagation();
      e.preventDefault();
    },
    true,
  );
  host.addEventListener('contextmenu', (e) => {
    if (drag || pending) e.preventDefault();
  });
}
