import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PRESSABLE, PRESS_CLASS, PRESS_MIN_MS, RELEASE_MS, busyWhile, setHtml, watchTaps } from '../src/taps';

/** Just enough of a DOM element for setHtml: a parent chain, a dataset and innerHTML. */
class FakeEl {
  dataset: Record<string, string> = {};
  innerHTML = '';
  builds = 0;
  constructor(public parent: FakeEl | null = null) {}
  contains(n: FakeEl | null) {
    for (let x = n; x; x = x.parent) if (x === this) return true;
    return false;
  }
}

const listeners = new Map<string, (e: { target: unknown }) => void>();
const page = { addEventListener: (type: string, fn: (e: { target: unknown }) => void) => void listeners.set(type, fn) } as unknown as EventTarget;
const fire = (type: string, target: unknown = null) => listeners.get(type)!({ target });
const set = (el: FakeEl, html: string) => {
  const before = el.innerHTML;
  setHtml(el as unknown as HTMLElement, html);
  if (el.innerHTML !== before) el.builds++;
};

describe('Taps are not lost to re-renders', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    listeners.clear();
    watchTaps(page);
  });
  afterEach(() => {
    fire('pointercancel');
    vi.useRealTimers();
  });

  it('only rebuilds when the content changed', () => {
    const box = new FakeEl();
    set(box, '<button>Buy 10</button>');
    set(box, '<button>Buy 10</button>');
    expect(box.builds).toBe(1);
  });

  it('leaves a list alone while a finger is on one of its buttons, then catches up after the click', () => {
    const list = new FakeEl();
    const button = new FakeEl(list);
    set(list, '<button>Fight 0:05</button>');
    fire('pointerdown', button);
    set(list, '<button>Fight 0:04</button>');
    set(list, '<button>Fight 0:03</button>');
    expect(list.innerHTML).toBe('<button>Fight 0:05</button>');
    fire('pointerup', button);
    fire('click', button);
    vi.runAllTimers();
    expect(list.innerHTML).toBe('<button>Fight 0:03</button>');
  });

  it('other parts of the page keep updating during a press', () => {
    const list = new FakeEl();
    const other = new FakeEl();
    fire('pointerdown', new FakeEl(list));
    set(other, 'Gold 5');
    expect(other.innerHTML).toBe('Gold 5');
    set(list, 'Changed');
    expect(list.innerHTML).toBe('');
  });

  it("a click's own handlers can re-render right away", () => {
    const list = new FakeEl();
    const button = new FakeEl(list);
    fire('pointerdown', button);
    fire('pointerup', button);
    fire('click', button);
    set(list, 'Bought!');
    expect(list.innerHTML).toBe('Bought!');
  });

  it('a press with no click (a drag) lets go after a moment', () => {
    const list = new FakeEl();
    fire('pointerdown', new FakeEl(list));
    fire('pointerup');
    set(list, 'New');
    expect(list.innerHTML).toBe('');
    vi.advanceTimersByTime(RELEASE_MS);
    expect(list.innerHTML).toBe('New');
  });

  it('a scroll that cancels the touch lets go at once', () => {
    const list = new FakeEl();
    fire('pointerdown', new FakeEl(list));
    set(list, 'New');
    fire('pointercancel');
    expect(list.innerHTML).toBe('New');
  });

  it('the touched button shows pressed at once and for at least a moment after a quick tap', () => {
    const classes = new Set<string>();
    const button = { disabled: false, classList: { add: (c: string) => classes.add(c), remove: (c: string) => classes.delete(c) } };
    const icon = { closest: () => button };
    fire('pointerdown', icon);
    expect(classes.has(PRESS_CLASS)).toBe(true);
    fire('pointerup', icon);
    fire('click', icon);
    expect(classes.has(PRESS_CLASS)).toBe(true);
    vi.advanceTimersByTime(PRESS_MIN_MS);
    expect(classes.has(PRESS_CLASS)).toBe(false);
  });

  it('a disabled button does not look pressed, and a scroll drops the pressed look', () => {
    const classes = new Set<string>();
    const make = (disabled: boolean) => ({ disabled, classList: { add: (c: string) => classes.add(c), remove: (c: string) => classes.delete(c) } });
    const off = make(true);
    fire('pointerdown', { closest: () => off });
    expect(classes.size).toBe(0);
    const on = make(false);
    fire('pointerdown', { closest: () => on });
    expect(classes.has(PRESS_CLASS)).toBe(true);
    fire('pointercancel');
    expect(classes.has(PRESS_CLASS)).toBe(false);
  });
});

describe('What shows a pressed look', () => {
  it('never a whole panel section: only buttons carry the data-tab match', () => {
    const parts = PRESSABLE.split(',').map((p) => p.trim());
    for (const p of parts) expect(p.startsWith('[data-')).toBe(false);
    expect(parts).toContain('button[data-tab]');
  });
});

describe('Buttons that wait on the server', () => {
  const fakeButton = () => {
    const classes = new Set<string>();
    const attrs = new Map<string, string>();
    const el = {
      classList: { add: (c: string) => classes.add(c), remove: (c: string) => classes.delete(c) },
      setAttribute: (k: string, v: string) => attrs.set(k, v),
      removeAttribute: (k: string) => attrs.delete(k),
    } as unknown as Element;
    return { el, classes, attrs };
  };

  it('show busy until the answer comes back', async () => {
    const { el, classes, attrs } = fakeButton();
    let finish!: (v: string) => void;
    const p = busyWhile(el, new Promise<string>((r) => (finish = r)));
    expect(classes.has('busy')).toBe(true);
    expect(attrs.get('aria-busy')).toBe('true');
    finish('ok');
    expect(await p).toBe('ok');
    expect(classes.has('busy')).toBe(false);
    expect(attrs.has('aria-busy')).toBe(false);
  });

  it('also clear busy when the call fails, and skip work that is already done', async () => {
    const { el, classes } = fakeButton();
    await expect(busyWhile(el, Promise.reject(new Error('offline')))).rejects.toThrow('offline');
    expect(classes.has('busy')).toBe(false);
    await busyWhile(el, undefined);
    expect(classes.size).toBe(0);
  });
});
