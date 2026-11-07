import { describe, expect, it } from 'vitest';
import { glyphStatRows, type Glyph } from '../src/glyphs';

describe('glyph stat rows (shown before equipping)', () => {
  it('lists the main stat first with its value, then every extra stat', () => {
    const g: Glyph = { id: 'x', family: 'frenzy', star: 3, level: 0, subs: [['crit', 0.008], ['def', 0.05]] };
    expect(glyphStatRows(g)).toEqual([
      { name: 'ATK', value: '+12%', main: true },
      { name: 'Crit chance', value: '+0.8%', main: false },
      { name: 'Defense', value: '+5%', main: false },
    ]);
  });

  it('main stat follows the level', () => {
    const g: Glyph = { id: 'y', family: 'health', star: 1, level: 10, subs: [] };
    expect(glyphStatRows(g)).toEqual([{ name: 'HP', value: '+10%', main: true }]);
  });
});
