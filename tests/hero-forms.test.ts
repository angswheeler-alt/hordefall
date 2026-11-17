import { describe, it, expect } from 'vitest';
import { heroForms } from '../src/heroForms';
import { HEROES } from '../src/data';

const all = () => true;

describe('hero forms gallery', () => {
  it('Gogu shows his base look and every Power Surge stage', () => {
    const f = heroForms('kairo', all)!;
    expect(f.map((x) => x.art)).toEqual(['kairo', 'kairo_surge1', 'kairo_surge', 'kairo_ascend3', 'kairo_overdrive']);
    expect(f[4].name).toBe('Overdrive');
    expect(f[1].how).toContain('7 s');
  });

  it('skips surge stages whose art is missing', () => {
    const f = heroForms('kairo', (k) => k !== 'kairo_surge1')!;
    expect(f.map((x) => x.art)).not.toContain('kairo_surge1');
  });

  it('Pasta shows Boiling Over', () => {
    expect(heroForms('pasta', all)!.map((x) => x.art)).toEqual(['pasta', 'pasta_dark']);
  });

  it('Ascendant heroes show four forms', () => {
    const f = heroForms('asc_dark', all)!;
    expect(f).toHaveLength(4);
    expect(f[1].how).toContain('★');
  });

  it('heroes with one look have no forms', () => {
    const plain = HEROES.find((h) => h.id === 'brine')!;
    expect(heroForms(plain.id, all)).toBeNull();
  });
});
