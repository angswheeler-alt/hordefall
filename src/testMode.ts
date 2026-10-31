import { HEROES, MAX_AWAKEN } from './data';
import { MAX_FORM } from './ascendant';
import { ascendantDef, isAscendant } from './heroes/ascendant';
import { GameState } from './state';
import { TEST_MODE_FLAG, TEST_SAVE_KEY } from './config';

/**
 * Admin test mode: try heroes at any stars, levels and forms on a copy of the
 * save. Entering copies the save to TEST_SAVE_KEY and reloads this tab with
 * TEST_MODE on; the account stays offline there (no cloud saves, leaderboards,
 * guild or Colosseum uploads), so nothing reaches the real save or other players.
 */

/** What the hero page's test controls can change. */
export type TestField = 'stars' | 'awaken' | 'level' | 'ember' | 'form';

/** Highest gold or Ember level the test controls go to. */
export const TEST_LEVEL_MAX = 100000;

/** The lowest and highest value of each test field for a hero. */
export function testRange(state: GameState, id: string, field: TestField): [number, number] {
  switch (field) {
    case 'stars':
      return [0, state.maxStars(id)];
    case 'awaken':
      return [0, state.awakenCap(id)];
    case 'level':
      return [1, TEST_LEVEL_MAX];
    case 'ember':
      return [0, TEST_LEVEL_MAX];
    case 'form':
      return isAscendant(id) ? [0, MAX_FORM] : [0, 0];
  }
}

/** A field's current value. */
export function testValue(state: GameState, id: string, field: TestField): number {
  switch (field) {
    case 'stars':
      return state.stars[id] ?? 0;
    case 'awaken':
      return state.awaken[id] ?? 0;
    case 'level':
      return state.levels[id] ?? 0;
    case 'ember':
      return state.emberLevels[id] ?? 0;
    case 'form':
      return state.formOf(id);
  }
}

/** Recruit a locked hero at level 1 for free (benched when the team is full). */
export function testRecruit(state: GameState, id: string) {
  if ((state.levels[id] ?? 0) > 0) return;
  state.levels[id] = 1;
  if (state.lineupCount() > state.teamSlots) state.benched[id] = true;
}

/** Set a field, kept inside its range; a locked hero is recruited first. Returns false if nothing changed. */
export function testSet(state: GameState, id: string, field: TestField, value: number): boolean {
  testRecruit(state, id);
  const [lo, hi] = testRange(state, id, field);
  const v = Math.max(lo, Math.min(hi, Math.floor(value)));
  const before = testValue(state, id, field);
  if (field === 'stars') state.stars[id] = v;
  else if (field === 'awaken') state.awaken[id] = v;
  else if (field === 'level') state.levels[id] = v;
  else if (field === 'ember') state.emberLevels[id] = v;
  else state.forms[id] = v;
  if (field === 'stars') {
    // Fewer yellow stars hold fewer pink ones.
    state.awaken[id] = Math.min(state.awaken[id] ?? 0, state.awakenCap(id));
    // An Ascendant hero takes the form its stars allow (3★ Rare, 5★ Epic, 8★ Legendary), skipping the other gates.
    const def = ascendantDef(id);
    if (def) state.forms[id] = def.steps.filter((step) => v >= step.evolutions).length;
  }
  return v !== before;
}

/** Add `delta` to a field (see testSet). */
export function testAdjust(state: GameState, id: string, field: TestField, delta: number): boolean {
  return testSet(state, id, field, testValue(state, id, field) + delta);
}

/** Top stars, all pink stars and the last form; levels are left alone. */
export function testMaxHero(state: GameState, id: string) {
  testSet(state, id, 'stars', state.maxStars(id));
  testSet(state, id, 'awaken', MAX_AWAKEN);
  if (isAscendant(id)) testSet(state, id, 'form', MAX_FORM);
}

/** Recruit and max every hero in the game. */
export function testMaxAll(state: GameState) {
  for (const h of HEROES) testMaxHero(state, h.id);
}

const setFlag = (on: boolean) => {
  try {
    if (on) sessionStorage.setItem(TEST_MODE_FLAG, '1');
    else sessionStorage.removeItem(TEST_MODE_FLAG);
  } catch {
    /* storage blocked: test mode can't start */
  }
};

/** Copy the current save into test mode and reload this tab there. */
export function enterTestMode(state: GameState) {
  state.save();
  try {
    localStorage.setItem(TEST_SAVE_KEY, JSON.stringify(state.toJSON()));
  } catch {
    return;
  }
  setFlag(true);
  GameState.frozen = true;
  location.reload();
}

/** Leave test mode: this tab goes back to the real save. The test copy is replaced next time. */
export function exitTestMode() {
  GameState.frozen = true;
  setFlag(false);
  location.reload();
}
