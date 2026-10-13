import type Decimal from 'break_infinity.js';
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

/** Knights (and Vanguards built to the hero standard) get the Knight shield. */
export function isKnight(def: HeroDef): boolean {
  return def.job === 'Knight' || def.role === 'Vanguard';
}
