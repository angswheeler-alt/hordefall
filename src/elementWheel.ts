import { STRONG_VS, ELEMENT_COLORS, elementMultiplier, type Element } from './data';

// The element wheel: which element beats which, drawn from STRONG_VS so it always matches battle.

const SPOTS: Record<Element, [number, number]> = { water: [95, 38], fire: [160, 150], earth: [30, 150], light: [240, 38], dark: [240, 150] };
const R = 25;
const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** One arrow from attacker to the element it beats, with its damage multiplier. Light and Dark's pair is bent so both arrows show. */
function arrow(from: Element, to: Element): string {
  const [x1, y1] = SPOTS[from];
  const [x2, y2] = SPOTS[to];
  const len = Math.hypot(x2 - x1, y2 - y1);
  const ux = (x2 - x1) / len;
  const uy = (y2 - y1) / len;
  const pair = STRONG_VS[to] === from; // Light and Dark beat each other
  const off = pair ? 14 : 0;
  const nx = -uy * off;
  const ny = ux * off;
  const sx = x1 + ux * (R + 3) + nx;
  const sy = y1 + uy * (R + 3) + ny;
  const ex = x2 - ux * (R + 7) + nx;
  const ey = y2 - uy * (R + 7) + ny;
  const mx = (sx + ex) / 2 + nx * 1.6;
  const my = (sy + ey) / 2 + ny * 1.6;
  return `<g class="ew-arrow" data-from="${from}" data-to="${to}"><line x1="${sx.toFixed(1)}" y1="${sy.toFixed(1)}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" stroke="${hex(ELEMENT_COLORS[from])}" stroke-width="3" marker-end="url(#ew-head-${from})"/><text x="${mx.toFixed(1)}" y="${(my + 4).toFixed(1)}" text-anchor="middle">x${elementMultiplier(from, to)}</text></g>`;
}

export function elementWheelSvg(): string {
  const els = Object.keys(SPOTS) as Element[];
  const heads = els
    .map((e) => `<marker id="ew-head-${e}" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${hex(ELEMENT_COLORS[e])}"/></marker>`)
    .join('');
  const arrows = els.map((e) => arrow(e, STRONG_VS[e])).join('');
  const nodes = els
    .map((e) => {
      const [x, y] = SPOTS[e];
      return `<g class="ew-node"><circle cx="${x}" cy="${y}" r="${R}" fill="${hex(ELEMENT_COLORS[e])}"/><text x="${x}" y="${y + 4}" text-anchor="middle">${cap(e)}</text></g>`;
    })
    .join('');
  return `<svg class="element-wheel" viewBox="0 0 300 190" role="img" aria-label="Element wheel: Water beats Fire, Fire beats Earth, Earth beats Water (x4); Light and Dark beat each other (x2)"><defs>${heads}</defs>${arrows}${nodes}</svg>`;
}

export const ELEMENT_WHEEL_NOTE =
  'An arrow points at the element it beats. Water, Fire and Earth hit the one they beat for x4 damage; Light and Dark hit each other for x2. Hitting the element that beats you (or Light on Light, Dark on Dark) does half damage. Everything else is x1. From stage 600, the named element bosses only take damage from the element that beats them.';
