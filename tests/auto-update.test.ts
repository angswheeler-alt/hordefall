import { describe, expect, it } from 'vitest';
import { builtScript, isNewBuild } from '../src/autoUpdate';

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
