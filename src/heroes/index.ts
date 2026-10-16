import type { HeroDef } from '../data';
import type { HeroProfile } from '../profiles';
import { WATER_HEROES, WATER_PROFILES } from './water';
import { FIRE_HEROES, FIRE_PROFILES } from './fire';
import { EARTH_HEROES, EARTH_PROFILES } from './earth';
import { LIGHT_HEROES, LIGHT_PROFILES } from './light';
import { DARK_HEROES, DARK_PROFILES } from './dark';
import { SQUAD_HEROES, SQUAD_PROFILES } from './squads';

/** Every hero added from the full Crush roster after batch 4, one file per element. */
export const CRUSH_HEROES: HeroDef[] = [...WATER_HEROES, ...FIRE_HEROES, ...EARTH_HEROES, ...LIGHT_HEROES, ...DARK_HEROES, ...SQUAD_HEROES];
export const CRUSH_PROFILES: Record<string, HeroProfile> = { ...WATER_PROFILES, ...FIRE_PROFILES, ...EARTH_PROFILES, ...LIGHT_PROFILES, ...DARK_PROFILES, ...SQUAD_PROFILES };
