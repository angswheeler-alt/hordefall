import { describe, expect, it } from 'vitest';
import { HERO_ANIMS } from '../src/heroAnims';
import { BOSS_ANIMS, BOSS_ANIM_FRAMES } from '../src/bossAnims';
import { HERO_BOUNDS, BOSS_BOUNDS, type ArtBounds } from '../src/portraitBounds';
import { portraitFit, wholeFit, type FitCss } from '../src/portrait';

/** Where sprite pixel (x, y) lands in a box 1 wide and boxH tall, undoing the CSS percentages. */
function place(b: ArtBounds, css: FitCss, x: number, y: number, boxH = 1, frames = 1) {
  const w = parseFloat(css.backgroundSize) / 100;
  const scale = w / (b[0] * frames);
  const h = b[1] * scale;
  const [px, py] = css.backgroundPosition.split(' ').map((v) => parseFloat(v) / 100);
  return { x: px * (1 - w) + x * scale, y: py * (boxH - h) + y * scale };
}

describe('centred portraits', () => {
  it('every hero and boss picture has measured bounds (run node art/portraits.js after new art)', () => {
    for (const id of Object.keys(HERO_ANIMS)) expect(HERO_BOUNDS[id], id).toBeDefined();
    for (const id of Object.keys(BOSS_ANIMS)) expect(BOSS_BOUNDS[id], id).toBeDefined();
  });

  it('puts every hero head in the middle of the face, near the top', () => {
    for (const [id, b] of Object.entries(HERO_BOUNDS)) {
      const p = place(b, portraitFit(b), b[6], b[3]);
      expect(Math.abs(p.x - 0.5), id).toBeLessThan(0.01);
      expect(Math.abs(p.y - 0.05), id).toBeLessThan(0.01);
    }
  });

  it('centres each whole hero in a Collection tile, feet on the bottom', () => {
    const boxH = 82 / 92;
    for (const [id, b] of Object.entries(HERO_BOUNDS)) {
      const css = wholeFit(b, boxH);
      const left = place(b, css, b[2], b[5], boxH);
      const right = place(b, css, b[4], b[5], boxH);
      expect(Math.abs((left.x + right.x) / 2 - 0.5), id).toBeLessThan(0.01);
      expect(Math.abs(left.y - boxH), id).toBeLessThan(0.01);
      expect(left.x, id).toBeGreaterThan(-0.01);
      expect(right.x, id).toBeLessThan(1.01);
    }
  });

  it('centres each boss on its own figure, not its canvas', () => {
    const n = BOSS_ANIM_FRAMES.idle;
    for (const [id, b] of Object.entries(BOSS_BOUNDS)) {
      const css = portraitFit(b, n);
      const wide = b[4] - b[2] > (b[5] - b[3]) * 1.1;
      const mid = wide ? (b[2] + b[4]) / 2 : b[6];
      expect(Math.abs(place(b, css, mid, b[3], 1, n).x - 0.5), id).toBeLessThan(0.01);
    }
  });
});
