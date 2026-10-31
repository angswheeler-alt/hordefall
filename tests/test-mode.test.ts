import { beforeEach, describe, expect, it } from 'vitest';
import { GameState } from '../src/state';
import { HEROES, MAX_AWAKEN, MAX_STARS, REGULAR_MAX_STARS } from '../src/data';
import { MAX_FORM } from '../src/ascendant';
import { isAscendant } from '../src/heroes/ascendant';
import { TEST_MODE, TEST_SAVE_KEY } from '../src/config';
import { testAdjust, testMaxAll, testMaxHero, testRange, testSet, TEST_LEVEL_MAX } from '../src/testMode';

const starter = HEROES.find((h) => h.unlockCost === 0)!;
const locked = HEROES.find((h) => h.unlockCost !== 0 && !isAscendant(h.id))!;
const asc = HEROES.find((h) => isAscendant(h.id))!;

beforeEach(() => localStorage.clear());

describe('Admin test mode', () => {
  it('is off unless the tab turned it on, and the normal save never uses the test key', () => {
    expect(TEST_MODE).toBe(false);
    new GameState().save();
    expect(localStorage.getItem(TEST_SAVE_KEY)).toBeNull();
    expect(localStorage.getItem('hordefall-save-v1')).not.toBeNull();
  });

  it('sets stars inside the hero\'s range: 7★ for regular heroes, 8★ for Ascendant', () => {
    const s = new GameState();
    testSet(s, starter.id, 'stars', 99);
    expect(s.stars[starter.id]).toBe(REGULAR_MAX_STARS);
    testSet(s, asc.id, 'stars', 99);
    expect(s.stars[asc.id]).toBe(MAX_STARS);
    testAdjust(s, starter.id, 'stars', -100);
    expect(s.stars[starter.id]).toBe(0);
  });

  it('recruits a locked hero the first time it is changed', () => {
    const s = new GameState();
    expect(s.levels[locked.id]).toBe(0);
    testAdjust(s, locked.id, 'stars', 2);
    expect(s.levels[locked.id]).toBe(1);
    expect(s.stars[locked.id]).toBe(2);
  });

  it('moves an Ascendant hero\'s form with its stars: Rare at 3★, Epic at 5★, Legendary at 8★', () => {
    const s = new GameState();
    const forms = [0, 1, 2, 3, 4, 5, 6, 7].map((stars) => {
      testSet(s, asc.id, 'stars', stars);
      return s.formOf(asc.id);
    });
    expect(forms).toEqual([0, 0, 1, 1, 2, 2, 2, 3]);
    testSet(s, asc.id, 'stars', 0);
    expect(s.formOf(asc.id)).toBe(0);
  });

  it('keeps pink stars within the yellow stars when stars go down', () => {
    const s = new GameState();
    testSet(s, starter.id, 'stars', 5);
    testSet(s, starter.id, 'awaken', MAX_AWAKEN);
    expect(s.awaken[starter.id]).toBe(6);
    testSet(s, starter.id, 'stars', 1);
    expect(s.awaken[starter.id]).toBe(2);
  });

  it('keeps levels between 1 and the cap, and forms only on Ascendant heroes', () => {
    const s = new GameState();
    testAdjust(s, starter.id, 'level', -100);
    expect(s.levels[starter.id]).toBe(1);
    testSet(s, starter.id, 'ember', 1e9);
    expect(s.emberLevels[starter.id]).toBe(TEST_LEVEL_MAX);
    expect(testRange(s, starter.id, 'form')).toEqual([0, 0]);
    testSet(s, asc.id, 'form', 2);
    expect(s.formOf(asc.id)).toBe(2);
  });

  it('maxes one hero or every hero', () => {
    const s = new GameState();
    testMaxHero(s, asc.id);
    expect(s.stars[asc.id]).toBe(MAX_STARS);
    expect(s.formOf(asc.id)).toBe(MAX_FORM);
    testMaxAll(s);
    for (const h of HEROES) {
      expect(s.levels[h.id]).toBeGreaterThan(0);
      expect(s.stars[h.id]).toBe(s.maxStars(h.id));
      expect(s.awaken[h.id]).toBe(s.awakenCap(h.id));
    }
    expect(s.lineupCount()).toBeLessThanOrEqual(s.teamSlots);
  });
});
