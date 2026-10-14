import type { HeroDef, HeroType } from './data';

/**
 * Stat profiles: what makes each hero play differently beyond ATK, HP and speed. A hero's Type sets its
 * shape (Knights are hard to hurt, Brawlers are tough and stun, Barbarians hit hard with Frenzy, Rogues
 * dodge and crit, Samurai, Rangers and Gunners crit hard, Magicians bring effects, Supports resist), and
 * each hero adds one specialty with a trade-off, so no hero is strictly better than another and any
 * five can share a team.
 *
 * Numbers are fractions: crit 0.18 = 18%, critDmg 1.5 = +150% (a crit hits for 2.5x), defMult x Defense,
 * atkMult / hpMult x base ATK / HP (the trade-off for a strong specialty). ultAtk, aoeDmg, effectTime
 * (how much longer this hero's freezes, burns, poisons and stuns last), shield (Knight shield) and goldBonus
 * are bonuses, 0.2 = +20%. Every hero's full profile is different (tests/state.test.ts checks it).
 */
export interface StatProfile {
  crit: number;
  critDmg: number;
  dodge: number;
  frenzy: number;
  effectRes: number;
  defMult: number;
  stunChance: number;
  freezeChance: number;
  burnChance: number;
  poisonChance: number;
  atkMult: number;
  hpMult: number;
  ultAtk: number;
  aoeDmg: number;
  effectTime: number;
  shield: number;
  goldBonus: number;
}

const NO_BONUS = { ultAtk: 0, aoeDmg: 0, effectTime: 0, shield: 0, goldBonus: 0 };

export const TYPE_PROFILES: Record<HeroType, StatProfile> = {
  Knight: { crit: 0.05, critDmg: 1, dodge: 0, frenzy: 0, effectRes: 0.4, defMult: 4, stunChance: 0, freezeChance: 0, burnChance: 0, poisonChance: 0, atkMult: 1, hpMult: 1, ...NO_BONUS },
  Brawler: { crit: 0.1, critDmg: 1.2, dodge: 0.06, frenzy: 0.1, effectRes: 0.3, defMult: 2.5, stunChance: 0.03, freezeChance: 0, burnChance: 0, poisonChance: 0, atkMult: 1, hpMult: 1, ...NO_BONUS },
  Barbarian: { crit: 0.15, critDmg: 1.8, dodge: 0.03, frenzy: 0.12, effectRes: 0.2, defMult: 1.5, stunChance: 0, freezeChance: 0, burnChance: 0, poisonChance: 0, atkMult: 1, hpMult: 1, ...NO_BONUS },
  Lancer: { crit: 0.12, critDmg: 1.5, dodge: 0.05, frenzy: 0.06, effectRes: 0.25, defMult: 2, stunChance: 0, freezeChance: 0, burnChance: 0, poisonChance: 0, atkMult: 1, hpMult: 1, ...NO_BONUS },
  Samurai: { crit: 0.2, critDmg: 2, dodge: 0.06, frenzy: 0.05, effectRes: 0.2, defMult: 1, stunChance: 0, freezeChance: 0, burnChance: 0, poisonChance: 0, atkMult: 1, hpMult: 1, ...NO_BONUS },
  Rogue: { crit: 0.22, critDmg: 1.5, dodge: 0.12, frenzy: 0.06, effectRes: 0.1, defMult: 0.75, stunChance: 0, freezeChance: 0, burnChance: 0, poisonChance: 0, atkMult: 1, hpMult: 1, ...NO_BONUS },
  Ranger: { crit: 0.15, critDmg: 2, dodge: 0.05, frenzy: 0.05, effectRes: 0.15, defMult: 0.75, stunChance: 0, freezeChance: 0, burnChance: 0, poisonChance: 0, atkMult: 1, hpMult: 1, ...NO_BONUS },
  Gunner: { crit: 0.12, critDmg: 2.2, dodge: 0.03, frenzy: 0.08, effectRes: 0.15, defMult: 0.75, stunChance: 0, freezeChance: 0, burnChance: 0, poisonChance: 0, atkMult: 1, hpMult: 1, ...NO_BONUS },
  Magician: { crit: 0.08, critDmg: 1, dodge: 0.03, frenzy: 0.03, effectRes: 0.25, defMult: 0.75, stunChance: 0, freezeChance: 0, burnChance: 0, poisonChance: 0, atkMult: 1, hpMult: 1, ...NO_BONUS },
  Support: { crit: 0.05, critDmg: 1, dodge: 0.05, frenzy: 0.03, effectRes: 0.35, defMult: 1.5, stunChance: 0, freezeChance: 0, burnChance: 0, poisonChance: 0, atkMult: 1, hpMult: 1, ...NO_BONUS },
};

/** Each hero's specialty on top of its Type: a few numbers and the one-line text the hero page shows. */
export const HERO_PROFILES: Record<string, Partial<StatProfile> & { specialty: string }> = {
  // Water
  brine: { frenzy: 0.15, ultAtk: 0.2, effectRes: 0.05, specialty: 'Pirate rush: 15% Frenzy and +20% Ultimate damage, but only 5% Effect Resistance' },
  brook: { effectRes: 0.6, atkMult: 0.9, specialty: 'Calm waters: 60% Effect Resistance, a little less ATK' },
  ripple: { critDmg: 2.4, crit: 0.1, specialty: 'Snow sniper: crits hit for +240% but land less often (10%)' },
  marina: { crit: 0.2, critDmg: 0.8, specialty: 'Storm caster: 20% crit, but softer crits (+80%)' },
  // Fire
  blaze: { atkMult: 1.2, hpMult: 1.15, frenzy: 0.04, specialty: 'Fire axe: +20% ATK and +15% HP, but rarely goes into Frenzy (4%)' },
  ember: { effectTime: 0.25, aoeDmg: 0.1, defMult: 0.5, specialty: 'Pyromancer: every hit burns, burns last 25% longer, +10% splash damage, half the Defense' },
  flint: { crit: 0.3, dodge: 0.1, hpMult: 0.9, specialty: 'Desert dancer: 30% crit and dodges 10% of attacks, a little less HP' },
  cinder: { crit: 0.2, atkMult: 1.1, stunChance: 0, specialty: 'Steam fists: 20% crit and +10% ATK, but never stuns' },
  // Earth
  briar: { crit: 0.25, critDmg: 1.8, specialty: 'Master archer: 25% crit, but softer crits (+180%)' },
  fern: { dodge: 0.15, effectRes: 0.5, hpMult: 0.9, specialty: 'Light step: dodges 15% of attacks, 50% Effect Resistance, a little less HP' },
  thorn: { defMult: 5, effectRes: 0.55, crit: 0.02, specialty: 'Bark skin: 5x Defense and 55% Effect Resistance, rarely crits (2%)' },
  moss: { hpMult: 1.15, aoeDmg: 0.1, crit: 0.05, specialty: 'Grove keeper: +15% HP and +10% splash damage, rarely crits (5%)' },
  // Dark
  shade: { dodge: 0.1, crit: 0.2, hpMult: 0.85, specialty: 'Shadow ninja: dodges 10% of attacks and 20% crit, less HP' },
  vex: { stunChance: 0.1, critDmg: 1.6, hpMult: 0.85, specialty: 'Hex: 10% chance to stun, crits hit for +160%, less HP' },
  rook: { critDmg: 3, crit: 0.12, ultAtk: 0.1, specialty: 'Nightstalker: crits hit for +300% and +10% Ultimate damage, but crits land less often (12%)' },
  dread: { frenzy: 0.12, defMult: 3, shield: 0.25, specialty: 'Dark fury: 12% Frenzy and a 25% stronger Knight shield, less Defense than other Knights' },
  // Light
  dawn: { stunChance: 0.06, effectTime: 0.2, effectRes: 0.3, critDmg: 1.2, specialty: 'Blinding blade: 6% chance to stun, stuns last 20% longer, 30% Effect Resistance, softer crits (+120%)' },
  lumen: { effectRes: 0.5, defMult: 2, crit: 0.02, specialty: 'Lantern ward: 50% Effect Resistance and 2x Defense, rarely crits (2%)' },
  sol: { burnChance: 0.12, critDmg: 2.4, crit: 0.1, specialty: 'Sunfire arrows: 12% chance to burn, crits hit for +240% but land less often (10%)' },
  aegis: { defMult: 6, effectRes: 0.6, shield: 0.5, atkMult: 0.9, specialty: 'Holy wall: 6x Defense, 60% Effect Resistance and a 50% stronger Knight shield, a little less ATK' },
};

/**
 * Builds: lining up heroes who share an effect makes that effect stronger for all of them.
 * 2 heroes: the effect lasts 25% longer. 3 or more: also +50% effect damage (stun: lasts 50% longer instead).
 */
export type BuildEffect = 'freeze' | 'burn' | 'poison' | 'stun';
export const BUILD_EFFECTS: BuildEffect[] = ['freeze', 'burn', 'poison', 'stun'];
export const BUILD_TIERS: Array<{ heroes: number; time: number; dmg: number }> = [
  { heroes: 2, time: 0.25, dmg: 0 },
  { heroes: 3, time: 0.25, dmg: 0.5 },
];

/** Which build effects a hero brings. */
export function heroBuildEffects(def: HeroDef): BuildEffect[] {
  const p = heroProfile(def);
  const out: BuildEffect[] = [];
  if (p.freezeChance > 0) out.push('freeze');
  if (p.burnChance > 0 || def.signature?.kind === 'burn') out.push('burn');
  if (p.poisonChance > 0) out.push('poison');
  if (p.stunChance > 0) out.push('stun');
  return out;
}

/** Time and damage bonus a build of `count` heroes gives. */
export function buildBonus(count: number): { time: number; dmg: number } {
  const tier = [...BUILD_TIERS].reverse().find((t) => count >= t.heroes);
  return tier ? { time: tier.time, dmg: tier.dmg } : { time: 0, dmg: 0 };
}

/** The full profile for a hero: Type shape plus specialty. */
export function heroProfile(def: HeroDef): StatProfile & { specialty: string } {
  const own = HERO_PROFILES[def.id];
  return { ...TYPE_PROFILES[def.type], ...(own ?? { specialty: '' }) };
}
