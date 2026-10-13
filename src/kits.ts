import Decimal from 'break_infinity.js';
import type { Signature } from './data';

/**
 * Pure numbers behind the hero-standard Signatures, kept out of BattleScene so they can be tested.
 */

/** Riptide Combo: damage multiplier for the `streak`th hit in a row on one enemy (the first hit is streak 0). */
export function comboMult(sig: Signature | undefined, streak: number): number {
  if (sig?.kind !== 'combo') return 1;
  return 1 + Math.min(sig.max, sig.perHit * streak);
}

/** Executioner: damage multiplier against an enemy at `hpRatio` of its max HP. */
export function executeMult(sig: Signature | undefined, hpRatio: number): number {
  if (sig?.kind !== 'execute') return 1;
  return hpRatio < sig.below ? sig.mult : 1;
}

/** Reflect share from a Signature (adds to reflect star skills). */
export function signatureReflect(sig: Signature | undefined): number {
  return sig?.kind === 'reflect' ? sig.value : 0;
}

/**
 * Guiding Light: split a heal into HP gained and the ally's new shield. `missing` is how much HP the ally
 * lacks, `shield` their current shield. With no overheal Signature the extra healing is wasted.
 */
export function splitHeal(sig: Signature | undefined, amount: Decimal, missing: Decimal, shield: Decimal, maxHp: Decimal): { hp: Decimal; shield: Decimal } {
  const hp = Decimal.max(0, Decimal.min(amount, missing));
  if (sig?.kind !== 'overheal') return { hp, shield };
  const cap = maxHp.times(sig.cap);
  return { hp, shield: Decimal.max(shield, Decimal.min(cap, shield.plus(amount.minus(hp)))) };
}
