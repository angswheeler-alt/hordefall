import { describe, expect, it } from 'vitest';
import { HEROES } from '../src/data';
import { ULT_FX_HEIGHT, ULT_FX_STYLES, parseUltFxFile, ultFxStyle } from '../src/ultFx';
import { weaponArtKey, weaponArtUrl } from '../src/weaponArt';
import { HERO_TYPES } from '../src/data';
import { WEAPON_KIND, WEAPON_LOOKS, WEAPON_LOOK_LEVEL, weaponLook, weaponName } from '../src/weapons';

const byId = (id: string) => HEROES.find((h) => h.id === id)!;

describe('Ultimate effect art', () => {
  it('gives every hero a known style with a size', () => {
    for (const h of HEROES) {
      const style = ultFxStyle(h);
      expect(ULT_FX_STYLES).toContain(style);
      expect(ULT_FX_HEIGHT[style]).toBeGreaterThan(0);
    }
  });

  it('picks styles from the Ultimate', () => {
    expect(ultFxStyle(byId('fern'))).toBe('aura'); // heal
    expect(ultFxStyle(byId('flint'))).toBe('strike'); // one target
    expect(ultFxStyle(byId('ashtor'))).toBe('dash');
    expect(ultFxStyle(byId('varuun'))).toBe('vortex');
    expect(ultFxStyle(byId('briar'))).toBe('rain'); // Arrow Storm
    expect(ultFxStyle(byId('brine'))).toBe('sweep'); // Rogue Wave
    expect(ultFxStyle(byId('thorn'))).toBe('rise'); // Bramble Wall
    expect(ultFxStyle(byId('seraph'))).toBe('beam'); // Judgement
    expect(ultFxStyle(byId('ember'))).toBe('drop'); // Meteor
  });

  it('reads single pictures and frame rows from file names', () => {
    expect(parseUltFxFile('./assets/ultfx/brine.png')).toEqual({ id: 'brine', frames: 1 });
    expect(parseUltFxFile('./assets/ultfx/asc_dark-f6.png')).toEqual({ id: 'asc_dark', frames: 6 });
    expect(parseUltFxFile('./assets/ultfx/Bad Name.png')).toBeNull();
  });
});

describe('Weapon looks', () => {
  it('change every three levels', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map(weaponLook)).toEqual([1, 1, 1, 2, 2, 2, 3, 3, 3]);
    for (const l of WEAPON_LOOKS) expect(weaponLook(WEAPON_LOOK_LEVEL[l])).toBe(l);
  });

  it('name a weapon kind for every Type', () => {
    for (const t of Object.keys(HERO_TYPES)) expect(WEAPON_KIND[t as keyof typeof WEAPON_KIND]).toBeTruthy();
    expect(weaponName('Samurai', 8)).toBe('Mythic Katana');
  });

  it("prefers a hero's own picture, then its Type, then a lower look", () => {
    const have = new Set(['brine-1', 'brine-2', 'samurai-1', 'samurai-2', 'samurai-3']);
    const has = (k: string) => have.has(k);
    expect(weaponArtKey('brine', 'Samurai', 2, has)).toBe('brine-2');
    expect(weaponArtKey('brine', 'Samurai', 3, has)).toBe('brine-2');
    expect(weaponArtKey('hibachi', 'Samurai', 3, has)).toBe('samurai-3');
    expect(weaponArtKey('x', 'Gunner', 1, has)).toBeNull();
  });

  it('has a placeholder picture for every hero at every look', () => {
    for (const h of HEROES) for (const l of WEAPON_LOOKS) expect(weaponArtUrl(h.id, h.type, WEAPON_LOOK_LEVEL[l])).toBeTruthy();
  });
});
