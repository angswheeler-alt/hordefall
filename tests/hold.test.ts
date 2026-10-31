import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HOLD_DELAY_MS, HOLD_FIRST_GAP_MS, HOLD_MIN_GAP_MS, holdToRepeat } from '../src/hold';

/** A button that only keeps its listeners, so the test can press it. */
class FakeButton {
  disabled = false;
  private on = new Map<string, Array<(e: object) => void>>();
  addEventListener(type: string, fn: (e: object) => void) {
    this.on.set(type, [...(this.on.get(type) ?? []), fn]);
  }
  fire(type: string, e: object = {}) {
    for (const fn of this.on.get(type) ?? []) fn({ button: 0, pointerId: 1, ...e });
  }
}

const wire = (action: () => boolean | void) => {
  const button = new FakeButton();
  holdToRepeat(button as unknown as HTMLButtonElement, action);
  return button;
};

describe('Hold to level up', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('a quick tap buys once', () => {
    let buys = 0;
    const b = wire(() => void buys++);
    b.fire('pointerdown');
    vi.advanceTimersByTime(100);
    b.fire('pointerup');
    b.fire('click');
    vi.advanceTimersByTime(5000);
    expect(buys).toBe(1);
  });

  it('holding keeps buying, faster and faster, and the release click adds nothing', () => {
    let buys = 0;
    const b = wire(() => void buys++);
    b.fire('pointerdown');
    vi.advanceTimersByTime(HOLD_DELAY_MS);
    expect(buys).toBe(1);
    vi.advanceTimersByTime(HOLD_FIRST_GAP_MS);
    expect(buys).toBe(2);
    vi.advanceTimersByTime(1000);
    const firstSecond = buys;
    vi.advanceTimersByTime(1000);
    // Fully sped up it buys every HOLD_MIN_GAP_MS.
    expect(buys - firstSecond).toBe(1000 / HOLD_MIN_GAP_MS);
    expect(buys - firstSecond).toBeGreaterThan(firstSecond);
    const held = buys;
    b.fire('pointerup');
    b.fire('click');
    vi.advanceTimersByTime(5000);
    expect(buys).toBe(held);
  });

  it('stops when a buy fails (out of gold)', () => {
    let gold = 3;
    const b = wire(() => gold-- > 0);
    b.fire('pointerdown');
    vi.advanceTimersByTime(10_000);
    expect(gold).toBe(-1);
  });

  it('stops when the touch turns into a scroll or the button turns grey', () => {
    let buys = 0;
    const b = wire(() => void buys++);
    b.fire('pointerdown');
    b.fire('pointercancel');
    vi.advanceTimersByTime(5000);
    expect(buys).toBe(0);

    b.fire('pointerdown');
    vi.advanceTimersByTime(HOLD_DELAY_MS);
    b.disabled = true;
    vi.advanceTimersByTime(5000);
    expect(buys).toBe(1);
  });

  it('ignores a second finger lifting and right clicks', () => {
    let buys = 0;
    const b = wire(() => void buys++);
    b.fire('pointerdown', { button: 2 });
    vi.advanceTimersByTime(5000);
    expect(buys).toBe(0);
    b.fire('pointerdown', { pointerId: 1 });
    b.fire('pointerup', { pointerId: 2 });
    vi.advanceTimersByTime(HOLD_DELAY_MS + HOLD_FIRST_GAP_MS);
    expect(buys).toBe(2);
    b.fire('pointerup', { pointerId: 1 });
  });

  it('a keyboard press after a hold with no release click still buys', () => {
    let buys = 0;
    const b = wire(() => void buys++);
    b.fire('pointerdown');
    vi.advanceTimersByTime(HOLD_DELAY_MS);
    b.fire('pointerup');
    vi.advanceTimersByTime(1000);
    b.fire('click');
    expect(buys).toBe(2);
  });
});
