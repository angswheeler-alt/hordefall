/**
 * Ultimate effect art (2026-11-01). Every hero's Ultimate can have its own picture: src/assets/ultfx/<heroId>.png,
 * drawn by the user in Grok on a pure black background and played with additive blending, so black turns
 * see-through. A picture can also be a row of N same-sized frames named <heroId>-f<N>.png.
 * The battle moves the picture by the Ultimate's style (ultFxStyle) and keeps the old rings and flashes as well.
 * Heroes without a picture keep only the old effects.
 */
import type { HeroDef } from './data';

/**
 * How the picture moves:
 * drop   one big thing falls from above onto the middle of the area and bursts (axe, meteor, bomb)
 * rain   many small copies fall across the area (arrows, missiles, blades)
 * sweep  rolls along the lane from the hero to the end of the area (waves, charges, rays)
 * rise   bursts up out of the ground under the enemies (thorns, roots, ice pillars)
 * beam   a tall column comes down from the sky on the area (pillars of light, lasers from above)
 * strike one burst on the single target (one-target Ultimates)
 * dash   a fast streak along the lane (the hero cuts through)
 * vortex spins in the middle of the area (whirlpools, whirlwinds)
 * aura   rises over every living hero (heals and shields)
 */
export type UltFxStyle = 'drop' | 'rain' | 'sweep' | 'rise' | 'beam' | 'strike' | 'dash' | 'vortex' | 'aura';
export const ULT_FX_STYLES: UltFxStyle[] = ['drop', 'rain', 'sweep', 'rise', 'beam', 'strike', 'dash', 'vortex', 'aura'];

/** Height in game px the picture is drawn at for each style (rain: each copy; beam: the column). */
export const ULT_FX_HEIGHT: Record<UltFxStyle, number> = { drop: 96, rain: 34, sweep: 80, rise: 60, beam: 190, strike: 96, dash: 56, vortex: 110, aura: 56 };

/** Hand-picked styles where the words of the Ultimate would pick a worse one. */
const OVERRIDE: Record<string, UltFxStyle> = {
  ripple: 'rain',
  undine: 'sweep',
  halden: 'beam',
  malgrave: 'sweep',
  glacius: 'rise',
  sunjo: 'sweep',
};

type FxDef = Pick<HeroDef, 'id' | 'heals' | 'ult' | 'ultimate'>;

/** The style an Ultimate's picture moves in, from its kind and its words. */
export function ultFxStyle(def: FxDef): UltFxStyle {
  if (OVERRIDE[def.id]) return OVERRIDE[def.id];
  if (def.heals) return 'aura';
  const kind = def.ult?.kind;
  if (kind === 'strike' || kind === 'skyfall') return 'strike';
  if (kind === 'verdict') return 'dash';
  if (kind === 'crescent') return 'sweep';
  if (kind === 'maelstrom' || kind === 'tempest') return 'vortex';
  const words = `${def.ultimate?.name ?? ''} ${def.ultimate?.text ?? ''}`.toLowerCase();
  if (/whirl/.test(words)) return 'vortex';
  if (/pillar of|from the sky|from above|bolts of/.test(words)) return 'beam';
  if (/burst up|from the ground|roots|grave bursts|pillars/.test(words)) return 'rise';
  if (/rain|shower|storm of|volley|barrage|downpour|swarm|flurry|squall/.test(words)) return 'rain';
  if (/wave|sweep|tears through|rips through|charg|stampede|river|trident|tide|rolls|blizzard|ray of/.test(words)) return 'sweep';
  return 'drop';
}

export interface UltFxArt {
  url: string;
  /** Frames in a row (1 for a single picture). */
  frames: number;
}

/** Parse an asset file name: "<id>.png" or "<id>-f<N>.png". */
export function parseUltFxFile(path: string): { id: string; frames: number } | null {
  const m = /\/([a-z0-9_]+?)(?:-f(\d+))?\.png$/.exec(path);
  if (!m) return null;
  return { id: m[1], frames: Math.max(1, Number(m[2] ?? 1)) };
}

const files = import.meta.glob('./assets/ultfx/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
export const ULT_FX_ART: Record<string, UltFxArt> = {};
for (const [path, url] of Object.entries(files)) {
  const f = parseUltFxFile(path);
  if (f) ULT_FX_ART[f.id] = { url, frames: f.frames };
}
