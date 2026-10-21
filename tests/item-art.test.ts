import { describe, expect, it } from 'vitest';
import { RELICS, STALLS, TRIAL_BOSS_ART, TRIAL_ROTATION } from '../src/data';
import { BOSS_ANIMS, BOSS_ANIM_FRAMES } from '../src/bossAnims';

// Generated images by file name (Vite lists them without loading them).
const names = (files: Record<string, unknown>) => new Set(Object.keys(files).map((f) => f.split('/').pop()));
const stalls = names(import.meta.glob('../public/stalls/*.png'));
const relics = names(import.meta.glob('../public/relics/*.png'));
const bosses = names(import.meta.glob('../public/bosses/*.png'));

describe('item and Trial boss art', () => {
  it('has an icon for every Market Row stall', () => {
    expect(STALLS.filter((s) => !stalls.has(`${s.id}.png`)).map((s) => s.id)).toEqual([]);
  });

  it('has an icon for every relic', () => {
    expect(RELICS.filter((r) => !relics.has(`${r.id}.png`)).map((r) => r.id)).toEqual([]);
  });

  it('gives every Trial its own animated boss', () => {
    for (const el of TRIAL_ROTATION) {
      const id = TRIAL_BOSS_ART[el];
      expect(BOSS_ANIMS[id], id).toBeDefined();
      for (const anim of Object.keys(BOSS_ANIM_FRAMES)) expect(bosses.has(`${id}_${anim}.png`), `${id}_${anim}`).toBe(true);
    }
  });
});
