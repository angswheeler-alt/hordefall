import type { Element } from './data';

/** Shared hero-page phrases, used by data.ts and the roster files in src/heroes/. */
export const VS: Record<Element, string> = {
  fire: 'Fire deals 4x to Earth and 0.5x to Water.',
  earth: 'Earth deals 4x to Water and 0.5x to Fire.',
  water: 'Water deals 4x to Fire and 0.5x to Earth.',
  dark: 'Dark deals 2x to Light and 0.5x to Dark.',
  light: 'Light deals 2x to Dark and 0.5x to Light.',
};
/**
 * Ultimate hits deal this many times ATK (x1.5 from 5★). Samuel (2026-10-22): 40x -> 25x, with +20% hero ATK
 * (HERO_ATK_MULT), so Ultimates carry under half of a team's boss damage instead of ~60%.
 */
export const ULT_MULTIPLIER = 25;
/** An Ultimate's hit as text: `share` of ULT_MULTIPLIER, e.g. ultX(3.5) = "87.5x". */
export const ultX = (share: number) => `${+(ULT_MULTIPLIER * share).toFixed(1)}x`;
export const ULT = (what: string) => `${what} every enemy ahead for ${ultX(1)} ATK, with element bonuses.`;
export const HEAL_BASIC = 'Heals the most injured nearby ally for 3x ATK. Attacks when nobody needs healing.';
