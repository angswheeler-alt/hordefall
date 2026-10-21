import type { SaveData } from './state';

/** How far a save has got: lifetime best stage and Rekindles, which only ever go up in normal play. */
export interface Progress {
  best: number;
  rekindles: number;
}

export const progressOf = (d: SaveData): Progress => ({
  best: Math.max(1, Number(d.bestStage ?? d.stage ?? 1) || 1),
  rekindles: Math.max(0, Number(d.rekindles ?? 0) || 0),
});

/** A save that has done nothing yet (stage 1, never rekindled). */
export const isFresh = (d: SaveData) => {
  const p = progressOf(d);
  return p.best <= 1 && p.rekindles === 0;
};

/** True when `a` has lost progress that `b` has: a lower best stage or fewer Rekindles. */
export const isBehind = (a: Progress, b: Progress) => a.best < b.best || a.rekindles < b.rekindles;

/** A cloud save the game can load: an object with a stage. */
export const isReadable = (d: unknown): d is SaveData =>
  !!d && typeof d === 'object' && !Array.isArray(d) && Number.isFinite(Number((d as SaveData).stage ?? (d as SaveData).bestStage));

export type SyncMode = 'start' | 'signin' | 'conflict';

/**
 * What to do with this device's save and the account's cloud save.
 * - `pause`: the cloud couldn't be reached; try again later, write nothing.
 * - `missing`: the cloud save is gone or unreadable although this device
 *   synced before (or it can't be read at all); write nothing until the player says so.
 * - `create`: the account has no cloud save yet; upload this device's.
 * - `upload`: this device is current; keep saving over the cloud.
 * - `take-cloud`: load the cloud save on this device.
 * - `keep-device`: this device was played last; save it over the cloud (keeping a copy of the cloud save).
 * - `ask`: the player picks.
 */
export type SyncAction = 'pause' | 'missing' | 'create' | 'upload' | 'take-cloud' | 'keep-device' | 'ask';

/** True when `a` has clearly less than `b`: under half its best stage. A save that played on wouldn't drop that far. */
export const isFarBehind = (a: Progress, b: Progress) => a.best * 2 < b.best;

export interface SyncInput {
  mode: SyncMode;
  /** The cloud save; null when the account has none, undefined when the request failed. */
  cloud: unknown;
  local: SaveData;
  /** Cloud revision this device last synced (null: never). */
  knownRev: number | null;
  /** lastSeen of the save this page loaded, before this session's play moved it. */
  loadedLastSeen: number;
}

/**
 * The sync rules. A failed request is never read as "no save"; a save with
 * real progress is never replaced by a stage 1 save without asking; a fresh
 * device always takes the account's save; and a device that hasn't played
 * since another one saved quietly loads the newer cloud save. When both
 * sides played, the game opens on whichever was played last, unless that
 * save has clearly less progress than the other (then it asks).
 */
export function decideSync({ mode, cloud, local, knownRev, loadedLastSeen }: SyncInput): SyncAction {
  if (cloud === undefined) return 'pause';
  if (cloud === null) return knownRev === null ? 'create' : 'missing';
  if (!isReadable(cloud)) return 'missing';
  const cloudRev = Number(cloud.rev ?? 0);
  const localP = progressOf(local);
  const cloudP = progressOf(cloud);
  if (isFresh(local) && !isFresh(cloud)) return 'take-cloud';
  if (knownRev === cloudRev) {
    // Nobody else saved since this device last synced, so this device should be at least as far.
    // If it isn't, its save was lost or reset: don't push that over the cloud.
    return isBehind(localP, cloudP) ? 'ask' : 'upload';
  }
  // Another device saved since (or this device never synced).
  if (isFresh(cloud) && !isFresh(local)) return 'ask';
  if (mode !== 'start') return 'ask';
  if ((cloud.lastSeen ?? 0) >= loadedLastSeen) return isFarBehind(cloudP, localP) ? 'ask' : 'take-cloud';
  return isFarBehind(localP, cloudP) ? 'ask' : 'keep-device';
}
