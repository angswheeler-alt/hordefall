import { describe, it, expect } from 'vitest';
import { RESPAWN_SECONDS } from '../src/data';
import { respawnTime, reviveIn, stageStartRevives } from '../src/respawn';

const up = (name: string) => ({ name, alive: true, respawnAt: 0 });
const down = (name: string, respawnAt: number) => ({ name, alive: false, respawnAt });

describe('revive cooldown', () => {
  it('a fallen hero waits RESPAWN_SECONDS, shorter with Rattle Back', () => {
    expect(RESPAWN_SECONDS).toBe(8);
    expect(respawnTime(100)).toBe(108);
    expect(respawnTime(100, 0.8)).toBeCloseTo(106.4);
  });

  it('counts down only while down', () => {
    expect(reviveIn(down('a', 108), 103)).toBe(5);
    expect(reviveIn(down('a', 108), 110)).toBe(0);
    expect(reviveIn(up('a'), 103)).toBe(0);
  });

  it('a stage clear does not bring a fallen hero back early', () => {
    const team = [up('a'), down('b', 108), down('c', 101)];
    expect(stageStartRevives(team, 102, false).map((h) => h.name)).toEqual(['a', 'c']);
  });

  it('a lost stage brings the whole team back', () => {
    const team = [down('a', 108), down('b', 109)];
    expect(stageStartRevives(team, 102, true)).toHaveLength(2);
  });

  it('never starts a stage with nobody standing', () => {
    const team = [down('a', 108), down('b', 109)];
    expect(stageStartRevives(team, 102, false)).toHaveLength(2);
  });
});
