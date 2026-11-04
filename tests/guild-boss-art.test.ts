import { describe, expect, it } from 'vitest';
import { BOSS_ANIMS } from '../src/bossAnims';
import { GUILD_BOSS_NAMES } from '../src/data';

describe('Guild Boss art', () => {
  it('every element has its own Guild Boss animations', () => {
    for (const element of Object.keys(GUILD_BOSS_NAMES)) expect(BOSS_ANIMS[`guild_${element}`], element).toBeTruthy();
  });
});
