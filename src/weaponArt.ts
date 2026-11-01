/**
 * Weapon pictures (2026-11-01). Files in src/assets/weapons/ are named `<key>-<look>.png`, where key is a hero id
 * (that hero's own weapon, drawn by the user) or a Type in lower case (a placeholder for every hero of that Type
 * still waiting for its own art), and look is 1-3 (src/weapons.ts).
 * A hero's own picture wins over its Type's; a missing look falls back to the nearest lower look that exists.
 */
import { weaponLook, type WeaponLook } from './weapons';

const files = import.meta.glob('./assets/weapons/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const ART: Record<string, string> = {};
for (const [path, url] of Object.entries(files)) {
  const m = /\/([a-z0-9_]+)-([1-3])\.png$/.exec(path);
  if (m) ART[`${m[1]}-${m[2]}`] = url;
}

/** Key of the picture for a hero's weapon at a look, or null when there is none. */
export function weaponArtKey(heroId: string, type: string, look: WeaponLook, has: (key: string) => boolean = (k) => k in ART): string | null {
  for (const key of [heroId, type.toLowerCase()]) {
    for (let l = look; l >= 1; l--) if (has(`${key}-${l}`)) return `${key}-${l}`;
  }
  return null;
}

/** URL of the picture for a hero's weapon at a weapon level, or null. */
export function weaponArtUrl(heroId: string, type: string, level: number): string | null {
  const key = weaponArtKey(heroId, type, weaponLook(level));
  return key ? ART[key] : null;
}
