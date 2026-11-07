import { describe, expect, it } from 'vitest';
import { GameState } from '../src/state';
import { HEROES, OFFLINE_CAP_HOURS } from '../src/data';
import { offlineNote } from '../src/offlineNote';

const fresh = () => new GameState();

describe('time to the offline max stage', () => {
  it('counts the stages and bosses up to the wall', () => {
    const s = fresh();
    const team = HEROES.filter((h) => ['blaze', 'ember', 'flint', 'cinder', 'briar'].includes(h.id));
    for (const h of HEROES) s.levels[h.id] = team.includes(h) ? 100 : 0;
    s.secondsPerStage = 10;
    s.stage = 3;
    const max = s.maxOffline();
    expect(max.stage).toBe(144);
    expect(max.outOfTime).toBe(false);
    // 141 stages at 10 s each, plus two boss fights that take at least a stage's time.
    expect(max.seconds).toBeGreaterThanOrEqual(141 * 10);
    expect(max.seconds).toBeLessThan(141 * 10 + 2 * 24 + 1);
    expect(offlineNote(true, max, s.stage)).toMatch(/^Reached in \d+m/);
    // Dreaming Moon makes the same climb take less real time.
    s.observatory = { ...s.observatory, offline: 10 };
    const faster = s.maxOffline();
    expect(faster.stage).toBe(144);
    expect(faster.seconds).toBeCloseTo(max.seconds / 1.5, 6);
  });

  it('says when 12 hours run out before the wall', () => {
    const s = fresh();
    const team = HEROES.filter((h) => ['blaze', 'ember', 'flint', 'cinder', 'briar'].includes(h.id));
    for (const h of HEROES) s.levels[h.id] = team.includes(h) ? 100 : 0;
    s.secondsPerStage = 600;
    s.stage = 3;
    const max = s.maxOffline();
    expect(max.outOfTime).toBe(true);
    expect(max.seconds).toBe(OFFLINE_CAP_HOURS * 3600);
    expect(max.stage).toBe(3 + 72);
    expect(offlineNote(true, max, s.stage)).toContain('still climbing');
  });

  it('explains a team at its wall or with auto-advance off', () => {
    const s = fresh();
    s.secondsPerStage = 1;
    s.stage = 20;
    const max = s.maxOffline();
    expect(max.stage).toBe(20);
    expect(offlineNote(true, max, 20)).toContain('wall');
    expect(offlineNote(false, max, 20)).toBe('Auto-advance is off');
  });
});
