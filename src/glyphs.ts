/**
 * Glyphs (design doc 5.6, built 2026-11-01): stat stones socketed into a hero's weapon (src/weapons.ts).
 * A weapon level opens WEAPON_GLYPHS[level].slots slots and holds Glyphs up to WEAPON_GLYPHS[level].maxStar.
 *
 * - A Glyph has a star (1-6, fixed when it drops), a family, a main stat set by its family and 1 to 4 extra stats.
 * - Glyph Dust levels a Glyph from +0 to GLYPH_MAX_LEVEL; the main stat doubles over those levels. Extra stats stay as rolled.
 * - Every 3 Glyphs of one family on a hero make a set: its set bonus counts once per full set (3, 6 or 9).
 * - Glyphs of GLYPH_BIND_STAR and up are bound to their weapon: taking one out costs an Unbinder (from Scouting),
 *   otherwise it can only be broken into Dust.
 * - Glyphs come from Glyph Chests (Rush tiers and the Rush Shop); rolls use a seeded generator, so tests are fixed.
 */
import { seededRandom } from './colosseum';

export type GlyphFamily = 'attack' | 'health' | 'defense' | 'speed' | 'crit' | 'frenzy' | 'lifesteal' | 'gold';
export const GLYPH_FAMILIES: GlyphFamily[] = ['attack', 'health', 'defense', 'speed', 'crit', 'frenzy', 'lifesteal', 'gold'];

/** What a Glyph can raise. All values are shares: 0.12 = +12% (crit, frenzy and lifesteal are chance or share points). */
export type GlyphStat = 'atk' | 'hp' | 'def' | 'speed' | 'crit' | 'critDmg' | 'frenzy' | 'lifesteal' | 'gold';

export interface Glyph {
  id: string;
  family: GlyphFamily;
  /** 1 to 6. */
  star: number;
  /** 0 to GLYPH_MAX_LEVEL, raised with Dust. */
  level: number;
  /** Extra stats as rolled, [stat, value]. */
  subs: Array<[GlyphStat, number]>;
  /** The hero whose weapon holds it, and the slot (0-based). Missing = in the bag. */
  hero?: string;
  slot?: number;
}

export const GLYPH_FAMILY_INFO: Record<GlyphFamily, { name: string; main: GlyphStat; set: Partial<Record<GlyphStat, number>>; setText: string; color: string }> = {
  attack: { name: 'Attack', main: 'atk', set: { atk: 0.2 }, setText: '+20% ATK', color: '#e0533a' },
  health: { name: 'Health', main: 'hp', set: { hp: 0.2 }, setText: '+20% HP', color: '#3fae5a' },
  defense: { name: 'Defense', main: 'def', set: { def: 0.25 }, setText: '+25% Defense', color: '#8a96a8' },
  speed: { name: 'Speed', main: 'speed', set: { speed: 0.15 }, setText: '+15% attack speed', color: '#41b6e6' },
  crit: { name: 'Crit', main: 'crit', set: { crit: 0.08 }, setText: '+8% crit chance', color: '#aa6ef0' },
  frenzy: { name: 'Frenzy', main: 'atk', set: { frenzy: 0.08 }, setText: '+8% Frenzy chance (attacks twice as fast for a moment)', color: '#ff7a1a' },
  lifesteal: { name: 'Lifesteal', main: 'hp', set: { lifesteal: 0.08 }, setText: 'Heals 8% of damage dealt', color: '#c0326b' },
  gold: { name: 'Gold Find', main: 'gold', set: { gold: 0.25 }, setText: '+25% gold from kills', color: '#e8b830' },
};

export const GLYPH_STAT_NAMES: Record<GlyphStat, string> = {
  atk: 'ATK',
  hp: 'HP',
  def: 'Defense',
  speed: 'Attack speed',
  crit: 'Crit chance',
  critDmg: 'Crit damage',
  frenzy: 'Frenzy chance',
  lifesteal: 'Lifesteal',
  gold: 'Gold from kills',
};

export const GLYPH_MAX_STAR = 6;
export const GLYPH_MAX_LEVEL = 10;
/** Glyphs of this star and up are bound to the weapon they sit in. */
export const GLYPH_BIND_STAR = 3;
/** Free Glyphs the bag holds; more drops turn straight into Dust. */
export const GLYPH_BAG_CAP = 300;
/** Glyph attack speed from all Glyphs together stops here (+100%). */
export const GLYPH_SPEED_CAP = 1;

/** Main stat at +0, by stat and star (index 0 = 1★). +GLYPH_MAX_LEVEL doubles it. Also the base for extra stats. */
const STAT_BASE: Record<GlyphStat, number[]> = {
  atk: [0.05, 0.08, 0.12, 0.17, 0.23, 0.3],
  hp: [0.05, 0.08, 0.12, 0.17, 0.23, 0.3],
  def: [0.06, 0.1, 0.15, 0.21, 0.28, 0.36],
  gold: [0.06, 0.1, 0.15, 0.21, 0.28, 0.36],
  speed: [0.02, 0.03, 0.045, 0.06, 0.08, 0.1],
  crit: [0.01, 0.015, 0.02, 0.03, 0.04, 0.05],
  critDmg: [0.04, 0.06, 0.09, 0.13, 0.18, 0.24],
  frenzy: [0.01, 0.015, 0.02, 0.03, 0.04, 0.05],
  lifesteal: [0.01, 0.015, 0.02, 0.03, 0.04, 0.05],
};
/** Extra stats a Glyph rolls, by star. */
export const GLYPH_SUB_COUNT = [1, 1, 2, 2, 3, 4];
/** Extra stats roll between these shares of the main stat's +0 value. */
const SUB_MIN = 0.3;
const SUB_MAX = 0.5;
const SUB_POOL: GlyphStat[] = ['atk', 'hp', 'def', 'speed', 'crit', 'critDmg'];

/** Dust a Glyph gives when salvaged or broken, by star (plus half the Dust spent levelling it). */
export const GLYPH_SALVAGE = [5, 12, 30, 70, 150, 300];

const clampStar = (n: number) => Math.max(1, Math.min(GLYPH_MAX_STAR, Math.floor(n) || 1));

/** Main stat value of a Glyph at its level. */
export function glyphMain(g: Pick<Glyph, 'family' | 'star' | 'level'>): { stat: GlyphStat; value: number } {
  const stat = GLYPH_FAMILY_INFO[g.family].main;
  const base = STAT_BASE[stat][clampStar(g.star) - 1];
  return { stat, value: base * (1 + Math.max(0, Math.min(GLYPH_MAX_LEVEL, g.level)) / GLYPH_MAX_LEVEL) };
}

/** Dust to level a Glyph from `level` to `level + 1`; null at max. */
export function glyphLevelCost(star: number, level: number): number | null {
  if (level >= GLYPH_MAX_LEVEL) return null;
  const s = clampStar(star);
  return 4 * s * s * (level + 1);
}

/** Dust spent to bring a Glyph from +0 to `level`. */
export function glyphDustSpent(star: number, level: number): number {
  let total = 0;
  for (let l = 0; l < Math.min(level, GLYPH_MAX_LEVEL); l++) total += glyphLevelCost(star, l)!;
  return total;
}

/** Dust back from salvaging (or breaking) a Glyph. */
export function glyphSalvage(g: Pick<Glyph, 'star' | 'level'>): number {
  return GLYPH_SALVAGE[clampStar(g.star) - 1] + Math.floor(glyphDustSpent(g.star, g.level) / 2);
}

export function glyphBound(g: Pick<Glyph, 'star'>): boolean {
  return g.star >= GLYPH_BIND_STAR;
}

/** Roll a new Glyph of a star from a seed (the family and extra stats come from the seed). */
export function rollGlyph(seed: string, star: number, family?: GlyphFamily): Glyph {
  const rng = seededRandom(`glyph:${seed}`);
  const s = clampStar(star);
  const fam = family ?? GLYPH_FAMILIES[Math.floor(rng() * GLYPH_FAMILIES.length) % GLYPH_FAMILIES.length];
  const main = GLYPH_FAMILY_INFO[fam].main;
  const pool = SUB_POOL.filter((x) => x !== main);
  const subs: Array<[GlyphStat, number]> = [];
  for (let i = 0; i < GLYPH_SUB_COUNT[s - 1] && pool.length; i++) {
    const stat = pool.splice(Math.floor(rng() * pool.length) % pool.length, 1)[0];
    const share = SUB_MIN + rng() * (SUB_MAX - SUB_MIN);
    subs.push([stat, Math.round(STAT_BASE[stat][s - 1] * share * 10000) / 10000]);
  }
  return { id: seed, family: fam, star: s, level: 0, subs };
}

/** Glyph Chests: chance of each star (index 0 = 1★). */
export type GlyphChestKind = 'glyph' | 'grand';
export const GLYPH_CHESTS: Record<GlyphChestKind, { name: string; odds: number[] }> = {
  glyph: { name: 'Glyph Chest', odds: [0.35, 0.35, 0.2, 0.1, 0, 0] },
  grand: { name: 'Grand Glyph Chest', odds: [0, 0, 0.5, 0.3, 0.15, 0.05] },
};

/** The star a chest gives for a seed. */
export function chestStar(kind: GlyphChestKind, seed: string): number {
  const r = seededRandom(`chest:${seed}`)();
  const odds = GLYPH_CHESTS[kind].odds;
  let acc = 0;
  for (let i = 0; i < odds.length; i++) {
    acc += odds[i];
    if (r < acc) return i + 1;
  }
  let top = odds.length;
  while (top > 1 && odds[top - 1] <= 0) top--;
  return top;
}

export type GlyphTotals = Record<GlyphStat, number>;
export const emptyTotals = (): GlyphTotals => ({ atk: 0, hp: 0, def: 0, speed: 0, crit: 0, critDmg: 0, frenzy: 0, lifesteal: 0, gold: 0 });

/** Full sets per family among some Glyphs. */
export function glyphSets(glyphs: Array<Pick<Glyph, 'family'>>): Partial<Record<GlyphFamily, number>> {
  const counts: Partial<Record<GlyphFamily, number>> = {};
  for (const g of glyphs) counts[g.family] = (counts[g.family] ?? 0) + 1;
  const sets: Partial<Record<GlyphFamily, number>> = {};
  for (const [f, n] of Object.entries(counts) as Array<[GlyphFamily, number]>) if (n >= 3) sets[f] = Math.floor(n / 3);
  return sets;
}

/** Everything a hero's socketed Glyphs add up to: main stats, extra stats and set bonuses. */
export function glyphTotals(glyphs: Glyph[]): GlyphTotals {
  const t = emptyTotals();
  for (const g of glyphs) {
    const m = glyphMain(g);
    t[m.stat] += m.value;
    for (const [stat, v] of g.subs) t[stat] += v;
  }
  for (const [f, n] of Object.entries(glyphSets(glyphs)) as Array<[GlyphFamily, number]>) {
    for (const [stat, v] of Object.entries(GLYPH_FAMILY_INFO[f].set) as Array<[GlyphStat, number]>) t[stat] += v * n;
  }
  t.speed = Math.min(GLYPH_SPEED_CAP, t.speed);
  return t;
}

/** "+12%" or "+1.5%" for a share. */
export function glyphPct(v: number): string {
  const p = v * 100;
  return `+${p >= 10 || Number.isInteger(p) ? Math.round(p) : p.toFixed(1)}%`;
}

/** A saved Glyph, checked. Null if it can't be read. */
export function cleanGlyph(raw: unknown): Glyph | null {
  const o = raw as Partial<Glyph> | null;
  if (!o || typeof o !== 'object' || typeof o.id !== 'string' || !GLYPH_FAMILIES.includes(o.family as GlyphFamily)) return null;
  const star = clampStar(Number(o.star));
  const level = Math.max(0, Math.min(GLYPH_MAX_LEVEL, Math.floor(Number(o.level) || 0)));
  const subs: Array<[GlyphStat, number]> = [];
  for (const x of Array.isArray(o.subs) ? o.subs : []) {
    if (!Array.isArray(x) || !(x[0] in STAT_BASE)) continue;
    const v = Number(x[1]);
    // An extra stat can't be bigger than its +0 main value at this star.
    if (Number.isFinite(v) && v > 0) subs.push([x[0] as GlyphStat, Math.min(v, STAT_BASE[x[0] as GlyphStat][star - 1])]);
  }
  const g: Glyph = { id: o.id, family: o.family as GlyphFamily, star, level, subs: subs.slice(0, GLYPH_SUB_COUNT[star - 1]) };
  if (typeof o.hero === 'string' && typeof o.slot === 'number' && Number.isInteger(o.slot) && o.slot >= 0 && o.slot < 9) {
    g.hero = o.hero;
    g.slot = o.slot;
  }
  return g;
}
