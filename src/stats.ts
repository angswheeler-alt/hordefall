import Decimal from 'break_infinity.js';
import type { HeroDef } from './data';

/**
 * The hero stat sheet, following the original's three stat pages. GameState.heroStats works these
 * out from level, stars, star skills, Signatures and relics; battle and the hero page both read them.
 */

/** Base numbers for effects (each hero's chances, crit, dodge and resistance come from its profile, src/profiles.ts). Times are seconds; damage is a share of the hero's ATK. */
export const STAT_BASE = {
  /** Frenzy: attacks twice as fast for this long. */
  frenzySeconds: 3,
  frenzyHaste: 0.5,
  stunSeconds: 1,
  freezeSeconds: 1.5,
  /** When a freeze ends the ice bursts for this x ATK on the target and enemies within FREEZE_BLAST_RADIUS. */
  freezeBlast: 1,
  burnSeconds: 3,
  /** Burning: this x ATK per second. */
  burnDps: 0.2,
  poisonSeconds: 4,
  /** Poison: this x ATK per second for each stack. */
  poisonDps: 0.1,
  poisonStacks: 5,
  /** Knights start each stage and each life with a shield of this share of their max HP. */
  knightShield: 0.2,
};
export const FREEZE_BLAST_RADIUS = 40;
/** Bosses' hits have this chance to stun a hero for a second, unless the hero resists (Effect Resistance). */
export const BOSS_STUN_CHANCE = 0.15;
export const BOSS_STUN_SECONDS = 1;

/** A number with its base (before star skills, relics and the like). */
export interface StatPair {
  value: number;
  base: number;
}
export interface BigStat {
  value: Decimal;
  base: Decimal;
}

export interface HeroStats {
  atk: BigStat;
  hp: BigStat;
  def: BigStat;
  /** Chance, 0.12 = 12%. */
  critRate: number;
  /** Extra damage on a crit, 1.5 = +150% (a crit hits for 2.5x). */
  critDmg: number;
  attacksPerSec: StatPair;
  range: StatPair;
  moveSpeed: StatPair;
  effectRes: StatPair;
  frenzy: StatPair;
  dodge: StatPair;
  stunChance: number;
  /** Bonus to effect length, 0.25 = +25%. */
  stunTime: number;
  /** Bonus to splash radius and splash damage (splash heroes only). */
  aoeRadius: number;
  aoeDmg: number;
  ultAtk: number;
  knightShield: number;
  /** Extra gold from this hero's kills, 1 = +100%. */
  bonusGold: number;
  freezeChance: number;
  freezeTime: number;
  freezeBlast: number;
  burnChance: number;
  burnTime: number;
  burnDmg: number;
  poisonChance: number;
  poisonTime: number;
  poisonDmg: number;
  /** Whether the hero can use AoE and Knight shield stats at all (the sheet greys them out otherwise). */
  hasAoe: boolean;
  isKnight: boolean;
}

/** Knights get the Knight shield. */
export function isKnight(def: HeroDef): boolean {
  return def.type === 'Knight';
}

/**
 * Combat Power: one number for how strong a hero is, from every combat stat on
 * their stat pages. Damage per second (Atk x attack speed, raised by crits,
 * Frenzy, Ultimate Atk, splash and status effects) and toughness (HP and
 * Defense, raised by dodge, Effect Resistance and the Knight shield) are
 * combined as a geometric mean, so a hero needs both to score high; range and
 * move speed add a little. Bonus Gold doesn't count (it isn't combat).
 */
export function combatPower(st: HeroStats): Decimal {
  const chance = (n: number) => Math.max(0, Math.min(1, n));
  const offense =
    (1 + chance(st.critRate) * Math.max(0, st.critDmg)) *
    (1 + chance(st.frenzy.value) * STAT_BASE.frenzyHaste) *
    (1 + Math.max(0, st.ultAtk) * 0.25) *
    (st.hasAoe ? 1.25 * (1 + Math.max(0, st.aoeRadius)) * (1 + Math.max(0, st.aoeDmg)) : 1) *
    (1 + 0.15 * chance(st.stunChance) * (1 + st.stunTime)) *
    (1 + 0.15 * chance(st.freezeChance) * (1 + st.freezeTime) * (1 + st.freezeBlast)) *
    (1 + STAT_BASE.burnDps * STAT_BASE.burnSeconds * chance(st.burnChance) * (1 + st.burnTime) * (1 + st.burnDmg)) *
    (1 + STAT_BASE.poisonDps * STAT_BASE.poisonSeconds * chance(st.poisonChance) * (1 + st.poisonTime) * (1 + st.poisonDmg)) *
    (1 + Math.max(0, st.range.value) / 400);
  const toughness =
    (1 / (1 - Math.min(0.75, chance(st.dodge.value)))) *
    (1 + 0.25 * chance(st.effectRes.value)) *
    (1 + Math.max(0, st.knightShield)) *
    (1 + Math.max(0, st.moveSpeed.value) / 1000);
  const dps = st.atk.value.times(Math.max(0, st.attacksPerSec.value) * offense);
  const ehp = st.hp.value.plus(st.def.value.times(20)).times(toughness);
  return dps.times(ehp).sqrt().times(10).floor();
}
