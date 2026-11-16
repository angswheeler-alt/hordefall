/**
 * Rush duels (one hero a side) are fair: the foe fights with its full hero kit, just like the player's hero
 * (Signature, star skills, aura, crits, dodge, lifesteal, DEF). The battle code runs the same hero logic for
 * both fighters; these are the few lane rules that depend on which side a fighter is on.
 *
 * Before (2026-11-15 test): the foe was a plain stat block with no kit, its DEF was ignored by the player's hits
 * and its crits were averaged, so whoever attacked won almost every even duel (Pasta vs Gogu went to the attacker
 * both ways round).
 */
export type Side = 'hero' | 'enemy';

/** Which way a fighter walks and hits: the player's side goes right (+1), the foe's side goes left (-1). */
export function forward(side: Side): 1 | -1 {
  return side === 'hero' ? 1 : -1;
}

/** How far `toX` lies in front of a fighter at `fromX` on `side` (negative = behind it). */
export function ahead(fromX: number, toX: number, side: Side): number {
  return (toX - fromX) * forward(side);
}

/** The same spot seen from the other end of the lane (the lane is symmetric between the two crystals). */
export function mirrorX(x: number, leftCrystal: number, rightCrystal: number): number {
  return leftCrystal + rightCrystal - x;
}
