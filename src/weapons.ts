/**
 * Weapons (design doc 5.5, built 2026-10-31): every hero carries a weapon from level 1 to WEAPON_MAX_LEVEL,
 * upgraded with Scouting materials (src/scouting.ts). Each weapon level gives the hero WEAPON_STAT_STEP more ATK
 * and HP, compounding, and opens Glyph slots (WEAPON_GLYPHS) for Glyphs up to a star (src/glyphs.ts).
 */

import type { HeroType } from './data';

export type ForgeMat = 'ore' | 'crystal' | 'coreC' | 'coreR' | 'coreE';
export const FORGE_MATS: ForgeMat[] = ['ore', 'crystal', 'coreC', 'coreR', 'coreE'];
export const FORGE_MAT_NAMES: Record<ForgeMat, string> = {
  ore: 'Ancient Ore',
  crystal: 'Raw Crystal',
  coreC: 'Common Forge Core',
  coreR: 'Rare Forge Core',
  coreE: 'Epic Forge Core',
};
export type ForgeCost = Partial<Record<ForgeMat, number>>;

export const WEAPON_MAX_LEVEL = 9;
/** ATK and HP multiplier per weapon level above 1 (compounding). */
export const WEAPON_STAT_STEP = 1.15;

/** Cost to reach each weapon level (index = target level). Ore and Crystal are the same amount. */
export const WEAPON_COSTS: Record<number, ForgeCost> = {
  2: { ore: 10, crystal: 10, coreC: 2 },
  3: { ore: 50, crystal: 50, coreC: 4 },
  4: { ore: 200, crystal: 200, coreC: 8, coreR: 1 },
  5: { ore: 600, crystal: 600, coreC: 16, coreR: 2 },
  6: { ore: 1500, crystal: 1500, coreC: 32, coreR: 4, coreE: 1 },
  7: { ore: 2500, crystal: 2500, coreC: 64, coreR: 8, coreE: 3 },
  8: { ore: 3500, crystal: 3500, coreC: 128, coreR: 16, coreE: 4 },
  9: { ore: 5000, crystal: 5000, coreC: 256, coreR: 32, coreE: 8 },
};

/** Glyph slots and the highest Glyph star each weapon level holds (src/glyphs.ts). */
export const WEAPON_GLYPHS: Record<number, { slots: number; maxStar: number }> = {
  1: { slots: 1, maxStar: 2 }, 2: { slots: 2, maxStar: 2 }, 3: { slots: 3, maxStar: 3 },
  4: { slots: 4, maxStar: 3 }, 5: { slots: 5, maxStar: 4 }, 6: { slots: 6, maxStar: 4 },
  7: { slots: 7, maxStar: 5 }, 8: { slots: 8, maxStar: 5 }, 9: { slots: 9, maxStar: 6 },
};

export function clampWeaponLevel(level: unknown): number {
  const n = typeof level === 'number' && Number.isFinite(level) ? Math.floor(level) : 1;
  return Math.max(1, Math.min(WEAPON_MAX_LEVEL, n));
}

/** ATK and HP multiplier of a weapon level: x1 at level 1, x WEAPON_STAT_STEP per level after. */
export function weaponMult(level: number): number {
  return Math.pow(WEAPON_STAT_STEP, clampWeaponLevel(level) - 1);
}

/**
 * Every hero has its own weapon, and its look changes every three levels (Samuel 2026-11-01):
 * 1 Forged (Lv 1-3), 2 Runed (Lv 4-6), 3 Mythic (Lv 7-9).
 */
export type WeaponLook = 1 | 2 | 3;
export const WEAPON_LOOKS: WeaponLook[] = [1, 2, 3];
export function weaponLook(level: number): WeaponLook {
  const l = clampWeaponLevel(level);
  return l >= 7 ? 3 : l >= 4 ? 2 : 1;
}
export const WEAPON_LOOK_NAMES: Record<WeaponLook, string> = { 1: 'Forged', 2: 'Runed', 3: 'Mythic' };
/** The first weapon level of each look. */
export const WEAPON_LOOK_LEVEL: Record<WeaponLook, number> = { 1: 1, 2: 4, 3: 7 };
/** Colour of each look, for the battle slash. */
export const WEAPON_LOOK_COLORS: Record<WeaponLook, number> = { 1: 0xffffff, 2: 0x8fdcff, 3: 0xffd447 };

/** The kind of weapon each Type carries, for names and the placeholder pictures until a hero's own art lands (src/weaponArt.ts). */
export const WEAPON_KIND: Record<HeroType, string> = {
  Ranger: 'Longbow',
  Gunner: 'Hand Cannon',
  Magician: 'Staff',
  Knight: 'Sword',
  Barbarian: 'Great Axe',
  Rogue: 'Twin Daggers',
  Lancer: 'Spear',
  Samurai: 'Katana',
  Brawler: 'Gauntlets',
  Support: 'Charm Rod',
};
/** "Gold Katana": the look's name and the weapon kind of a Type. */
export function weaponName(type: string, level: number): string {
  return `${WEAPON_LOOK_NAMES[weaponLook(level)]} ${WEAPON_KIND[type as HeroType] ?? 'Weapon'}`;
}

/** Cost to go from `level` to `level + 1`, or null at max. */
export function weaponUpgradeCost(level: number): ForgeCost | null {
  const l = clampWeaponLevel(level);
  return l >= WEAPON_MAX_LEVEL ? null : WEAPON_COSTS[l + 1];
}

/**
 * Weapon Mastery (2026-11-07, economy audit): once a weapon is at WEAPON_MAX_LEVEL, endless Mastery ranks give
 * MASTERY_STEP more ATK and HP each (compounding). Costs grow MASTERY_COST_GROWTH a rank, so Ore, Crystal and Cores
 * always have a use; by day 365 the simulator had every team weapon maxed and ~366,000 Ore and Crystal unspent.
 */
export const MASTERY_STEP = 1.05;
export const MASTERY_COST_GROWTH = 1.15;
export const MASTERY_MAX_RANK = 999;

export function clampMastery(rank: unknown): number {
  const n = typeof rank === 'number' && Number.isFinite(rank) ? Math.floor(rank) : 0;
  return Math.max(0, Math.min(MASTERY_MAX_RANK, n));
}

/** ATK and HP multiplier of a Mastery rank: x1 at rank 0, x MASTERY_STEP per rank. */
export function masteryMult(rank: number): number {
  return Math.pow(MASTERY_STEP, clampMastery(rank));
}

/** Materials to go from Mastery `rank` to `rank + 1`, or null at the cap. */
export function masteryCost(rank: number): ForgeCost | null {
  const r = clampMastery(rank);
  if (r >= MASTERY_MAX_RANK) return null;
  const g = Math.pow(MASTERY_COST_GROWTH, r);
  return { ore: Math.round(5000 * g), crystal: Math.round(5000 * g), coreC: Math.round(64 * g), coreR: Math.round(8 * g), coreE: 1 + Math.floor(r / 5) };
}

/** Everything from level 1 to max, for one hero. */
export function weaponTotalCost(): Required<ForgeCost> {
  const total = { ore: 0, crystal: 0, coreC: 0, coreR: 0, coreE: 0 };
  for (let l = 2; l <= WEAPON_MAX_LEVEL; l++) for (const m of FORGE_MATS) total[m] += WEAPON_COSTS[l][m] ?? 0;
  return total;
}
