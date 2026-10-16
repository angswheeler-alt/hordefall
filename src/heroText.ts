import type { Element } from './data';

/** Shared hero-page phrases, used by data.ts and the Crush roster files in src/heroes/. */
export const VS: Record<Element, string> = {
  fire: 'Fire deals 4x to Earth and 0.5x to Water.',
  earth: 'Earth deals 4x to Water and 0.5x to Fire.',
  water: 'Water deals 4x to Fire and 0.5x to Earth.',
  dark: 'Dark deals 2x to Light and 0.5x to Dark.',
  light: 'Light deals 2x to Dark and 0.5x to Light.',
};
export const ULT = (what: string) => `${what} every enemy ahead for 40x ATK, with element bonuses.`;
export const HEAL_BASIC = 'Heals the most injured nearby ally for 3x ATK. Attacks when nobody needs healing.';
