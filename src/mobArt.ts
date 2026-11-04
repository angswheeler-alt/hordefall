// Where a mob picture lives. The first five mobs ship as files in public/mobs/; mobs added after the artifact neared
// its 511-file cap (art/mobs/animate.js ASSET_MOBS) live in src/assets/mobs/ and are imported here, so the
// artifact build inlines them into game.js and the GitHub Pages build gives them hashed files.
const ASSETS = import.meta.glob('./assets/mobs/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const BY_FILE = new Map(Object.entries(ASSETS).map(([path, url]) => [path.split('/').pop()!, url]));

/** URL of a mob picture, by file name (e.g. `bomber_fire_walk.png`). */
export function mobArtUrl(file: string): string {
  return BY_FILE.get(file) ?? `mobs/${file}`;
}

/** Whether the picture ships from src/assets/mobs (tests). */
export function isAssetMob(file: string): boolean {
  return BY_FILE.has(file);
}
