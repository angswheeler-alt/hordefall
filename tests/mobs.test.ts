import { describe, expect, it } from 'vitest';
import { MOB_KINDS, pickMob } from '../src/mobs';
import { MOB_ANIMS } from '../src/mobAnims';

describe('mob kinds', () => {
  it('starts with grunts only', () => {
    for (const roll of [0, 0.5, 0.99]) expect(pickMob(1, roll).id).toBe('grunt');
  });

  it('mixes in every walking kind later on', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) seen.add(pickMob(50, i / 100).id);
    expect([...seen].sort()).toEqual(['brute', 'caster', 'grunt', 'scuttler']);
  });

  it('keeps the average mob close to a grunt', () => {
    let hp = 0;
    for (let i = 0; i < 1000; i++) hp += pickMob(50, i / 1000).hp;
    expect(hp / 1000).toBeGreaterThan(0.95);
    expect(hp / 1000).toBeLessThan(1.1);
  });

  it('has art for every kind', () => {
    for (const id of Object.keys(MOB_KINDS)) expect(MOB_ANIMS[id]).toBeDefined();
  });
});
