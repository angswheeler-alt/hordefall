import { RESPAWN_SECONDS } from './data';

/** What revive timing needs to know about a hero on the lane. */
export interface Downed {
  alive: boolean;
  respawnAt: number;
}

/** Game-clock time a hero who falls at `clock` gets back up (`mult` < 1 shortens it, e.g. Rattle Back). */
export function respawnTime(clock: number, mult = 1) {
  return clock + RESPAWN_SECONDS * mult;
}

/** Seconds left before a fallen hero revives (0 when standing or ready). */
export function reviveIn(h: Downed, clock: number) {
  return h.alive ? 0 : Math.max(0, h.respawnAt - clock);
}

/**
 * Who stands up when a new stage starts. A fallen hero sits out their timer even across a stage clear;
 * only a lost stage (or a lineup with nobody left standing) brings the whole team back at once.
 */
export function stageStartRevives<T extends Downed>(team: T[], clock: number, lost: boolean): T[] {
  const up = team.filter((h) => h.alive || reviveIn(h, clock) <= 0);
  return lost || up.length === 0 ? team : up;
}
