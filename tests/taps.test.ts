import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RELEASE_MS, setHtml, watchTaps } from '../src/taps';

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
});
