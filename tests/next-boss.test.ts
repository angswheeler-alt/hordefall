import { describe, expect, it } from 'vitest';
import { nextBossInfo, nextBossLine, bossElement, BOSS_EVERY } from '../src/data';

describe('next boss hint', () => {
  it('points at the current stage on a boss stage, else the next boss stage', () => {
    expect(nextBossInfo(1).stage).toBe(BOSS_EVERY);
    expect(nextBossInfo(49).stage).toBe(50);
    expect(nextBossInfo(50).stage).toBe(50);
    expect(nextBossInfo(51).stage).toBe(100);
    expect(nextBossInfo(643).element).toBe(bossElement(650));
  });

  it('names the weakness only from stage 600, and "only" on the 100th-stage element bosses', () => {
    expect(nextBossInfo(540).weakness).toBeNull();
    expect(nextBossLine(540)).toBe(`Boss 550 · ${cap(bossElement(550))}`);
    expect(nextBossLine(599)).toBe('Boss 600 · Fire');
    expect(nextBossInfo(599)).toMatchObject({ weakness: 'water', onlyWeakness: true });
    expect(nextBossLine(700)).toBe('Boss 700 · Water');
    const b650 = nextBossInfo(601);
    expect(b650.onlyWeakness).toBe(false);
    expect(b650.weakness).not.toBeNull();
  });

  it('stays short enough to sit left of the Auto boss button', () => {
    for (let s = 1; s <= 5000; s += 7) expect(nextBossLine(s).length).toBeLessThanOrEqual(18);
  });
});

const cap = (e: string) => e[0].toUpperCase() + e.slice(1);
