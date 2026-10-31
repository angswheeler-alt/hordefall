// Regular enemy kinds. Each stage's mobs are a mix of these, painted in the stage's element colours (art in
// src/mobAnims.ts, one set per element in MOB_ELEMENTS). The mix averages out close to a plain grunt, so stage
// difficulty barely moves.
import type { Element } from './data';

export const MOB_ELEMENTS: Element[] = ['water', 'fire', 'earth', 'light', 'dark'];

export type MobId = 'grunt' | 'brute' | 'caster' | 'scuttler' | 'flyer';

export interface MobKind {
  id: MobId;
  /** First stage this kind can show up on. */
  fromStage: number;
  /** Relative chance among the walking kinds unlocked so far. */
  weight: number;
  hp: number;
  atk: number;
  /** Walk speed range, px/s. */
  speed: [number, number];
  /** Attack reach, px; a caster throws magic from further back. */
  range: number;
}

export const MOB_KINDS: Record<MobId, MobKind> = {
  grunt: { id: 'grunt', fromStage: 1, weight: 55, hp: 1, atk: 1, speed: [60, 75], range: 22 },
  brute: { id: 'brute', fromStage: 6, weight: 15, hp: 2, atk: 1.3, speed: [40, 50], range: 26 },
  scuttler: { id: 'scuttler', fromStage: 10, weight: 15, hp: 0.6, atk: 0.8, speed: [95, 110], range: 20 },
  caster: { id: 'caster', fromStage: 15, weight: 15, hp: 0.7, atk: 0.9, speed: [55, 65], range: 100 },
  // Flyers aren't drawn here: the stage picks them separately (they fly above the lane).
  flyer: { id: 'flyer', fromStage: 3, weight: 0, hp: 1, atk: 1, speed: [60, 75], range: 22 },
};

/** A walking mob kind for `stage`; `roll` is a number in [0, 1). */
export function pickMob(stage: number, roll: number): MobKind {
  const open = Object.values(MOB_KINDS).filter((k) => k.weight > 0 && stage >= k.fromStage);
  const total = open.reduce((t, k) => t + k.weight, 0);
  let r = roll * total;
  for (const k of open) {
    r -= k.weight;
    if (r < 0) return k;
  }
  return open[open.length - 1];
}
