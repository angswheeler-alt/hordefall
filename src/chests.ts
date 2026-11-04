/** Which fight is playing in the battle lane. */
export type LaneMode = 'stage' | 'trial' | 'pvp';

export function laneMode(fight: { trial: unknown; pvp: unknown }): LaneMode {
  return fight.pvp ? 'pvp' : fight.trial ? 'trial' : 'stage';
}

/** Floating chests only fly over the normal stage run, never over Trials or Colosseum fights. */
export function chestsAllowed(mode: LaneMode): boolean {
  return mode === 'stage';
}

/** Floating chest art is 31x15 px, drawn at x1.5 (about 46x22 game px, under 45x20 on a phone screen). */
export const CHEST_SCALE = 1.5;
/** Extra touch room around the chest art on each side, in art pixels (x CHEST_SCALE on screen). */
export const CHEST_TAP_PAD = { x: 14, y: 16 };

/**
 * The tappable box of a floating chest, in the art's own pixels (Phaser scales it with the image).
 * Much bigger than the art, so a quick thumb tap on a small moving, bobbing chest still lands.
 */
export function chestTapArea(artW: number, artH: number): { x: number; y: number; w: number; h: number } {
  return { x: -CHEST_TAP_PAD.x, y: -CHEST_TAP_PAD.y, w: artW + CHEST_TAP_PAD.x * 2, h: artH + CHEST_TAP_PAD.y * 2 };
}

/**
 * Height band (game px, lane is 300 tall) where chests fly. Kept below the Fight boss button
 * (top 48-78) and the Settings button (top right, to about 74), which sit over the canvas and
 * swallowed taps on chests flying behind them.
 */
export const CHEST_Y_MIN = 98;
export const CHEST_Y_MAX = 140;
