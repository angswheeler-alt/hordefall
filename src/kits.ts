import Decimal from 'break_infinity.js';
import type { Signature } from './data';

/**
 * Pure numbers behind the hero-standard Signatures, kept out of BattleScene so they can be tested.
 */

/** 6★ Signature+ numbers (texts are each hero's `sigPlus`). */
export const SIG_PLUS = {
  /** Riptide Combo: share of the streak kept when the target dies. */
  comboCarry: 0.5,
  /** Kindling: Burning stacks up to this many burns' worth. */
  burnStacks: 2,
  /** Bramble Hide: chance for a reflected hit to stun the attacker, and for how long. */
  reflectStun: 0.1,
  reflectStunSeconds: 1,
  /** Guiding Light: overheal shield cap. */
  overhealCap: 0.4,
  /** Executioner: HP share it works below, and Ultimate cooldown refunded per kill. */
  executeBelow: 0.4,
  killUltRefund: 2,
};

/**
 * Boss crowd-control resistance: stuns, freezes and roots last `BOSS_CC.scale` as long on a boss, and once one
 * ends the boss can't be controlled again for `immune` seconds. Returns the new end of the control and of the
 * boss's immunity, or null when the boss is still immune.
 */
export const BOSS_CC = { scale: 0.5, immune: 2 };
export function controlEnd(
  isBoss: boolean, clock: number, rootedUntil: number, immuneUntil: number, seconds: number, bossSeconds = seconds * BOSS_CC.scale,
): { until: number; immuneUntil: number } | null {
  if (isBoss && clock < immuneUntil) return null;
  const until = Math.max(rootedUntil, clock + (isBoss ? bossSeconds : seconds));
  return { until, immuneUntil: isBoss ? until + BOSS_CC.immune : immuneUntil };
}

/** Riptide Combo: damage multiplier for the `streak`th hit in a row on one enemy (the first hit is streak 0). */
export function comboMult(sig: Signature | undefined, streak: number): number {
  if (sig?.kind !== 'combo') return 1;
  return 1 + Math.min(sig.max, sig.perHit * streak);
}

/** Executioner: damage multiplier against an enemy at `hpRatio` of its max HP. */
export function executeMult(sig: Signature | undefined, hpRatio: number, plus = false): number {
  if (sig?.kind !== 'execute') return 1;
  return hpRatio < (plus ? SIG_PLUS.executeBelow : sig.below) ? sig.mult : 1;
}

/** Reflect share from a Signature (adds to reflect star skills). */
export function signatureReflect(sig: Signature | undefined): number {
  return sig?.kind === 'reflect' ? sig.value : 0;
}

/**
 * Guiding Light: split a heal into HP gained and the ally's new shield. `missing` is how much HP the ally
 * lacks, `shield` their current shield. With no overheal Signature the extra healing is wasted.
 */
export function splitHeal(sig: Signature | undefined, amount: Decimal, missing: Decimal, shield: Decimal, maxHp: Decimal, plus = false): { hp: Decimal; shield: Decimal } {
  const hp = Decimal.max(0, Decimal.min(amount, missing));
  if (sig?.kind !== 'overheal') return { hp, shield };
  const cap = maxHp.times(plus ? SIG_PLUS.overhealCap : sig.cap);
  return { hp, shield: Decimal.max(shield, Decimal.min(cap, shield.plus(amount.minus(hp)))) };
}

/** Wraith Mask (Ascendant Dark): whether a hit leaving `hpRatio` of max HP (0 or less = a killing blow) puts the mask on, if not used this life. */
export function maskTriggers(sig: Signature | undefined, hpRatio: number, used: boolean): boolean {
  return sig?.kind === 'mask' && !used && hpRatio < sig.below;
}

/** Barrage: how many blows this attack is (1 unless it is the every-Nth one). */
export function barrageHits(sig: Signature | undefined, attacks: number, plus = false): number {
  if (sig?.kind !== 'barrage' || attacks % sig.every !== 0) return 1;
  return plus ? sig.plusHits : sig.hits;
}

/** Zeal: attack cooldown multiplier and splash radius at `stacks` attacks in a row. */
export function zealState(sig: Signature | undefined, stacks: number, plus = false): { stacks: number; cooldown: number; wave: number } {
  if (sig?.kind !== 'zeal') return { stacks: 0, cooldown: 1, wave: 0 };
  const n = Math.min(stacks, plus ? sig.plusMax : sig.max);
  return { stacks: n, cooldown: 1 / (1 + n * sig.perStack), wave: n >= sig.waveAt ? sig.wave : 0 };
}

/** Torrent: damage dealt and damage taken multipliers at `hpRatio` of max HP. */
export function torrentMults(sig: Signature | undefined, hpRatio: number, plus = false): { dmg: number; taken: number } {
  if (sig?.kind !== 'torrent' || hpRatio >= (plus ? sig.plusBelow : sig.below)) return { dmg: 1, taken: 1 };
  return { dmg: sig.dmg, taken: sig.guard };
}

/** Spirit: how many extra enemies the spirit hits on this attack. */
export function spiritTargets(sig: Signature | undefined, attacks: number, plus = false): number {
  if (sig?.kind !== 'spirit' || attacks % sig.every !== 0) return 0;
  return plus ? sig.plusTargets : sig.targets;
}
