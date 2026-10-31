/** Which fight is playing in the battle lane. */
export type LaneMode = 'stage' | 'trial' | 'pvp';

export function laneMode(fight: { trial: unknown; pvp: unknown }): LaneMode {
  return fight.pvp ? 'pvp' : fight.trial ? 'trial' : 'stage';
}

/** Floating chests only fly over the normal stage run, never over Trials or Colosseum fights. */
export function chestsAllowed(mode: LaneMode): boolean {
  return mode === 'stage';
}
