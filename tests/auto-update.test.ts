import { describe, expect, it } from 'vitest';
import { builtScript, IDLE_MS, isNewBuild, quietMoment, type ScreenNow } from '../src/autoUpdate';

describe('auto update', () => {
  it('reads the hashed game script from the built page', () => {
    const html = '<head><script type="module" crossorigin src="./assets/index-AbC123.js"></script><link rel="stylesheet" href="./assets/index-x.css"></head>';
    expect(builtScript(html)).toBe('index-AbC123.js');
    expect(builtScript('<script src="./assets/index-Z9.js" type="module"></script>')).toBe('index-Z9.js');
    expect(builtScript('<p>offline</p>')).toBeNull();
  });
  it('reloads only for a different known build', () => {
    expect(isNewBuild('index-a.js', 'index-b.js')).toBe(true);
    expect(isNewBuild('index-a.js', 'index-a.js')).toBe(false);
    expect(isNewBuild('index-a.js', null)).toBe(false);
    expect(isNewBuild(null, 'index-b.js')).toBe(false);
  });
});

describe('auto update waits for a quiet moment', () => {
  const resting: ScreenNow = { idleMs: IDLE_MS, visible: true, home: true, inFight: false, overlayOpen: false };
  it('restarts a player resting on the stage screen', () => {
    expect(quietMoment(resting)).toBe(true);
  });
  it('never cuts into play, menus, fights or a hidden tab', () => {
    expect(quietMoment({ ...resting, idleMs: IDLE_MS - 1 })).toBe(false);
    expect(quietMoment({ ...resting, home: false })).toBe(false);
    expect(quietMoment({ ...resting, inFight: true })).toBe(false);
    expect(quietMoment({ ...resting, overlayOpen: true })).toBe(false);
    expect(quietMoment({ ...resting, visible: false })).toBe(false);
  });
});
