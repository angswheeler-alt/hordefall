import type { HeroDef } from '../data';
import type { HeroProfile } from '../profiles';
import { WATER_HEROES, WATER_PROFILES } from './water';
import { FIRE_HEROES, FIRE_PROFILES } from './fire';
import { EARTH_HEROES, EARTH_PROFILES } from './earth';
import { LIGHT_HEROES, LIGHT_PROFILES } from './light';
import { DARK_HEROES, DARK_PROFILES } from './dark';
import { SQUAD_HEROES, SQUAD_PROFILES } from './squads';
import { ASCENDANT_FIVE } from './ascendant';

/** The rest of the roster, one file per element, plus the squads. */
export const ROSTER_HEROES: HeroDef[] = [...WATER_HEROES, ...FIRE_HEROES, ...EARTH_HEROES, ...LIGHT_HEROES, ...DARK_HEROES, ...SQUAD_HEROES, ...ASCENDANT_FIVE.map((a) => a.base)];
export const ROSTER_PROFILES: Record<string, HeroProfile> = { ...WATER_PROFILES, ...FIRE_PROFILES, ...EARTH_PROFILES, ...LIGHT_PROFILES, ...DARK_PROFILES, ...SQUAD_PROFILES,
  // The Ascendant heroes (src/heroes/ascendant.ts): their own Signatures carry them, so plain profiles.
  asc_dark: { crit: 0.15, critDmg: 1.6, specialty: 'Cleaver edge: 15% crit for +160%' },
  asc_fire: { hpMult: 1.1, dodge: 0.1, specialty: 'Rubber body: +10% HP and dodges 10% of attacks' },
  asc_light: { crit: 0.1, effectRes: 0.3, specialty: 'Holy armor: 10% crit and 30% Effect Resistance' },
  asc_water: { freezeChance: 0.08, aoeDmg: 0.1, specialty: 'Tide magic: 8% chance to freeze and +10% splash damage' },
  asc_earth: { aoeDmg: 0.15, atkMult: 0.95, specialty: 'Wind magic: +15% splash damage, a little less ATK' },
};
