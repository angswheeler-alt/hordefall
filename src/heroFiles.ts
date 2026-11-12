/**
 * Where a hero sprite file lives. Most are in public/heroes; newer heroes' sprites are bundled into the game
 * code from src/assets/heroes (art/heroes/animate.js BUNDLED) because the playable artifact is at its
 * 511-file cap. `name` is the file name without .png, e.g. "pasta", "pasta_run", "pasta_attack".
 */
const BUNDLED: Record<string, string> = Object.fromEntries(
  Object.entries(import.meta.glob('./assets/heroes/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>).map(
    ([f, url]) => [f.split('/').pop()!.slice(0, -4), url],
  ),
);

export const heroFile = (name: string): string => BUNDLED[name] ?? `heroes/${name}.png`;

/** True when `name` ships inside the game code (src/assets/heroes) rather than public/heroes. */
export const isBundledHero = (name: string): boolean => name in BUNDLED;
