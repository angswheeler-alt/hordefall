// Centre hero and boss pictures on the figure itself, not on the padded canvas (src/portraitBounds.ts).
// Everything is worked out in fractions of the box width, then written as CSS percentages, so the same
// style fits any box size (a 30 px chip, a 64 px sheet face, a Collection tile).
import { BOSS_BOUNDS, HERO_BOUNDS, type ArtBounds } from './portraitBounds';

export interface FitCss {
  backgroundSize: string;
  backgroundPosition: string;
}

const pct = (v: number) => `${Math.round(v * 100) / 100}%`;

/**
 * Background size and position that put sprite pixel (x, y) * scale + (ox, oy) in a box `boxH` tall for
 * every 1 wide. `frames` is how many frames the strip holds (only the first is shown).
 */
function toCss(b: ArtBounds, scale: number, ox: number, oy: number, boxH: number, frames: number): FitCss {
  const w = b[0] * frames * scale;
  const h = b[1] * scale;
  // background-position % aligns that point of the picture with the same point of the box: offset = p * (box - pic).
  const px = Math.abs(1 - w) < 1e-6 ? 50 : (ox / (1 - w)) * 100;
  const py = Math.abs(boxH - h) < 1e-6 ? 50 : (oy / (boxH - h)) * 100;
  return { backgroundSize: `${pct(w * 100)} auto`, backgroundPosition: `${pct(px)} ${pct(py)}` };
}

/**
 * Head-and-shoulders portrait in a square box: zoomed so the top of the figure fills the box (less for wide
 * creatures, never so far that more than the whole figure shows), centred on the part that shows.
 */
export function portraitFit(b: ArtBounds, frames = 1): FitCss {
  const [, , x0, y0, x1, y1, headX] = b;
  const w = x1 - x0;
  const h = y1 - y0;
  const s = Math.max(Math.min(1 / (h * 0.62), 1 / (w * 0.95)), 1 / (h * 1.05));
  return toCss(b, s, 0.5 - headX * s, 0.05 - y0 * s, 1, frames);
}

/** The whole figure, feet on the bottom edge and centred left to right, in a box `boxH` tall per 1 wide. */
export function wholeFit(b: ArtBounds, boxH: number): FitCss {
  const [, , x0, y0, x1, y1] = b;
  const s = Math.min(0.96 / (x1 - x0), boxH / (y1 - y0));
  return toCss(b, s, 0.5 - ((x0 + x1) / 2) * s, boxH - y1 * s, boxH, 1);
}

const inline = (c: FitCss | null) => (c ? `;background-size:${c.backgroundSize};background-position:${c.backgroundPosition}` : '');

/** Inline CSS (leading ';') for a hero face centred on that art's figure; '' when the art is unknown. */
export const heroFaceCss = (art: string) => inline(HERO_BOUNDS[art] ? portraitFit(HERO_BOUNDS[art]) : null);
/** Inline CSS for a hero's whole figure in a box `boxH` tall per 1 wide (the Collection tiles). */
export const heroWholeCss = (art: string, boxH: number) => inline(HERO_BOUNDS[art] ? wholeFit(HERO_BOUNDS[art], boxH) : null);
/**
 * Box (fractions of a square) for a boss's first idle frame: the whole boss, centred both ways, a little margin.
 * The picture is drawn on its own element sized to one frame, so the strip's next frame never shows beside it.
 */
export function bossBox(b: ArtBounds): { left: number; top: number; width: number; height: number } {
  const [fw, fh, x0, y0, x1, y1] = b;
  const s = 0.9 / Math.max(x1 - x0, y1 - y0);
  return { left: 0.5 - ((x0 + x1) / 2) * s, top: 0.5 - ((y0 + y1) / 2) * s, width: fw * s, height: fh * s };
}

/**
 * A boss portrait to put inside a box with `position: relative; overflow: hidden` (class .boss-pic in
 * style.css); '' when the boss has no measured art. `frames` is how many frames the idle strip holds.
 */
export function bossPicHtml(id: string, frames: number): string {
  const b = BOSS_BOUNDS[id];
  if (!b) return '';
  const r = bossBox(b);
  return `<i class="boss-pic" aria-hidden="true" style="background-image:url(bosses/${id}_idle.png);background-size:${frames * 100}% 100%;left:${pct(r.left * 100)};top:${pct(r.top * 100)};width:${pct(r.width * 100)};height:${pct(r.height * 100)}"></i>`;
}
