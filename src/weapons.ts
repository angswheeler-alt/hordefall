/**
 * Weapons (design doc 5.5, built 2026-10-31): every hero carries a weapon from level 1 to WEAPON_MAX_LEVEL,
 * upgraded with Scouting materials (src/scouting.ts). Each weapon level gives the hero WEAPON_STAT_STEP more ATK
 * and HP, compounding, and opens Glyph slots (WEAPON_GLYPHS) for Glyphs up to a star (src/glyphs.ts).
 */

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

/** The weapon's look: 1 bronze (Lv 1-3), 2 silver (Lv 4-6), 3 gold (Lv 7-9). */
export function weaponLook(level: number): 1 | 2 | 3 {
  const l = clampWeaponLevel(level);
  return l >= 7 ? 3 : l >= 4 ? 2 : 1;
}
export const WEAPON_LOOK_NAMES = { 1: 'Bronze', 2: 'Silver', 3: 'Gold' } as const;

/** Cost to go from `level` to `level + 1`, or null at max. */
export function weaponUpgradeCost(level: number): ForgeCost | null {
  const l = clampWeaponLevel(level);
  return l >= WEAPON_MAX_LEVEL ? null : WEAPON_COSTS[l + 1];
}

/** Everything from level 1 to max, for one hero. */
export function weaponTotalCost(): Required<ForgeCost> {
  const total = { ore: 0, crystal: 0, coreC: 0, coreR: 0, coreE: 0 };
  for (let l = 2; l <= WEAPON_MAX_LEVEL; l++) for (const m of FORGE_MATS) total[m] += WEAPON_COSTS[l][m] ?? 0;
  return total;
}
