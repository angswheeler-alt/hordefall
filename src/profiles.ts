import type { HeroDef, Role } from './data';

/**
 * Stat profiles: what makes each hero play differently beyond ATK, HP and speed. A hero's role sets its
 * shape (Vanguards are hard to hurt and resist effects, Strikers crit and dodge, Marksmen crit hard,
 * Casters bring effects, Menders resist), and each hero adds one specialty with a trade-off, so no hero
 * is strictly better than another and any five can share a team.
 *
 * Numbers are fractions: crit 0.18 = 18%, critDmg 1.5 = +150% (a crit hits for 2.5x), defMult x Defense,
 * atkMult / hpMult x base ATK / HP (the trade-off for a strong specialty).
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
}

export const ROLE_PROFILES: Record<Role, StatProfile> = {
  Vanguard: { crit: 0.05, critDmg: 1, dodge: 0, frenzy: 0, effectRes: 0.4, defMult: 4, stunChance: 0, freezeChance: 0, burnChance: 0, poisonChance: 0, atkMult: 1, hpMult: 1 },
  Striker: { crit: 0.18, critDmg: 1.5, dodge: 0.08, frenzy: 0.08, effectRes: 0.15, defMult: 1, stunChance: 0, freezeChance: 0, burnChance: 0, poisonChance: 0, atkMult: 1, hpMult: 1 },
  Marksman: { crit: 0.15, critDmg: 2, dodge: 0.05, frenzy: 0.05, effectRes: 0.15, defMult: 0.75, stunChance: 0, freezeChance: 0, burnChance: 0, poisonChance: 0, atkMult: 1, hpMult: 1 },
  Caster: { crit: 0.08, critDmg: 1, dodge: 0.03, frenzy: 0.03, effectRes: 0.25, defMult: 0.75, stunChance: 0, freezeChance: 0, burnChance: 0, poisonChance: 0, atkMult: 1, hpMult: 1 },
  Mender: { crit: 0.05, critDmg: 1, dodge: 0.05, frenzy: 0.03, effectRes: 0.35, defMult: 1.5, stunChance: 0, freezeChance: 0, burnChance: 0, poisonChance: 0, atkMult: 1, hpMult: 1 },
};

/** Older heroes have a job but no role yet. */
const JOB_ROLES: Record<string, Role> = {
  Blademaster: 'Striker',
  Rogue: 'Striker',
  Knight: 'Vanguard',
  Ranger: 'Marksman',
  Mage: 'Caster',
  Support: 'Mender',
};

export function roleOf(def: HeroDef): Role {
  return def.role ?? JOB_ROLES[def.job] ?? 'Striker';
}

/** Each hero's specialty on top of its role: a few numbers and the one-line text the hero page shows. */
export const HERO_PROFILES: Record<string, Partial<StatProfile> & { specialty: string }> = {
  // Water
  brine: { frenzy: 0.15, specialty: 'Pirate rush: 15% Frenzy chance' },
  brook: { effectRes: 0.6, freezeChance: 0.06, specialty: 'Cold spring: 60% Effect Resistance, 6% chance to freeze' },
  ripple: { freezeChance: 0.08, crit: 0.1, specialty: 'Frost arrows: 8% chance to freeze, crits less often (10%)' },
  marina: { freezeChance: 0.12, hpMult: 0.9, specialty: 'Sea witch: 12% chance to freeze, a little less HP' },
  // Fire
  blaze: { burnChance: 0.15, critDmg: 1.2, specialty: 'Blazing blade: 15% chance to burn, softer crits (+120%)' },
  ember: { specialty: 'Pyromancer: every hit burns' },
  flint: { dodge: 0.2, specialty: 'Quick feet: dodges 20% of attacks, 2x gold' },
  cinder: { stunChance: 0.08, specialty: 'Magma fists: 8% chance to stun' },
  // Earth
  briar: { poisonChance: 0.12, crit: 0.1, specialty: 'Venom thorns: 12% chance to poison, crits less often (10%)' },
  fern: { dodge: 0.15, specialty: 'Light step: dodges 15% of attacks' },
  thorn: { defMult: 5, effectRes: 0.55, specialty: 'Bark skin: 5x Defense and 55% Effect Resistance' },
  moss: { poisonChance: 0.25, hpMult: 0.8, specialty: 'Spore druid: 25% chance to poison, low HP' },
  // Dark
  shade: { dodge: 0.25, crit: 0.25, poisonChance: 0.08, hpMult: 0.75, specialty: 'Assassin: 25% dodge, 25% crit, poisoned blades (8%), low HP' },
  vex: { stunChance: 0.1, hpMult: 0.9, specialty: 'Hex: 10% chance to stun, a little less HP' },
  rook: { critDmg: 3, crit: 0.12, specialty: 'Nightstalker: crits hit for +300%, but land less often (12%)' },
  dread: { frenzy: 0.12, defMult: 3, specialty: 'Dark fury: 12% Frenzy chance, less Defense than other Knights' },
  // Light
  dawn: { stunChance: 0.06, effectRes: 0.3, specialty: 'Blinding blade: 6% chance to stun, 30% Effect Resistance' },
  lumen: { effectRes: 0.5, specialty: 'Lantern ward: 50% Effect Resistance' },
  sol: { burnChance: 0.12, crit: 0.1, specialty: 'Sunfire arrows: 12% chance to burn, crits less often (10%)' },
  aegis: { defMult: 6, effectRes: 0.6, atkMult: 0.9, specialty: 'Holy wall: 6x Defense and 60% Effect Resistance, a little less ATK' },
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

/** The full profile for a hero: role shape plus specialty. */
export function heroProfile(def: HeroDef): StatProfile & { specialty: string } {
  const own = HERO_PROFILES[def.id];
  return { ...ROLE_PROFILES[roleOf(def)], ...(own ?? { specialty: '' }) };
}
