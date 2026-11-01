/**
 * A smooth amount picker (Samuel, 2026-11-01: "a smooth slider for using things rather than
 * choosing 1x 5x or whatever"). A slider from 1 to the most you can afford, − / + buttons for
 * fine steps and a Max button, so any amount is one drag away and Max is one tap.
 */

/** The amount a slider value stands for: a whole number from 1 to `max` (at least 1). */
export function clampAmount(n: number, max: number): number {
  const top = Math.max(1, Math.floor(max));
  if (!Number.isFinite(n)) return 1;
  return Math.min(top, Math.max(1, Math.round(n)));
}

/** Level buy amounts: 1 to this many levels, and one more stop past it for "max". */
export const BUY_AMOUNT_LIMIT = 100;
export type BuyAmount = number | 'max';

/** A saved buy amount, made safe: old saves hold 1 / 10 / 'max', anything odd becomes 1. */
export function normalizeBuyAmount(v: unknown): BuyAmount {
  if (v === 'max') return 'max';
  if (typeof v !== 'number' || !Number.isFinite(v)) return 1;
  return clampAmount(v, BUY_AMOUNT_LIMIT);
}

/** Button text for a buy amount. */
export function buyAmountLabel(v: BuyAmount): string {
  return v === 'max' ? 'Buy max' : `Buy x${v}`;
}

/** Slider position for a buy amount; the stop past the limit means max. */
export function buyAmountToSlider(v: BuyAmount): number {
  return v === 'max' ? BUY_AMOUNT_LIMIT + 1 : clampAmount(v, BUY_AMOUNT_LIMIT);
}

export function sliderToBuyAmount(n: number): BuyAmount {
  const v = clampAmount(n, BUY_AMOUNT_LIMIT + 1);
  return v > BUY_AMOUNT_LIMIT ? 'max' : v;
}

/** The picker's HTML. `max` is the top stop, `value` where it starts. */
export function amountSliderHtml(max: number, value: number, label = 'Amount', topLabel?: string): string {
  const top = Math.max(1, Math.floor(max));
  const v = clampAmount(value, top);
  return `<div class="amt">
    <div class="amt-top">
      <button type="button" class="amt-step" data-step="-1" aria-label="One less">−</button>
      <output class="amt-n"></output>
      <button type="button" class="amt-step" data-step="1" aria-label="One more">+</button>
      <button type="button" class="amt-max">Max</button>
    </div>
    <input class="amt-range" type="range" min="1" max="${top}" step="1" value="${v}" aria-label="${label}" ${top <= 1 ? 'disabled' : ''} />
    <div class="amt-ends"><small>1</small><small>${topLabel ?? top.toLocaleString()}</small></div>
    <p class="amt-cost"></p>
  </div>`;
}

/**
 * Wires a picker made by amountSliderHtml inside `root`. `onChange` runs at once and on every move
 * with the amount and the cost line element; `label` names an amount (defaults to "x5").
 * Returns a function that reads the current amount.
 */
export function bindAmountSlider(
  root: ParentNode,
  onChange: (n: number, cost: HTMLElement) => void,
  label: (n: number) => string = (n) => `x${n}`,
): () => number {
  const range = root.querySelector<HTMLInputElement>('.amt-range')!;
  const out = root.querySelector<HTMLElement>('.amt-n')!;
  const cost = root.querySelector<HTMLElement>('.amt-cost')!;
  const top = Number(range.max);
  const read = () => clampAmount(Number(range.value), top);
  const update = () => {
    const n = read();
    out.textContent = label(n);
    onChange(n, cost);
  };
  const set = (n: number) => {
    range.value = String(clampAmount(n, top));
    update();
  };
  range.addEventListener('input', update);
  root.querySelectorAll<HTMLButtonElement>('.amt-step').forEach((b) => b.addEventListener('click', () => set(read() + Number(b.dataset.step))));
  root.querySelector('.amt-max')?.addEventListener('click', () => set(top));
  update();
  return read;
}
