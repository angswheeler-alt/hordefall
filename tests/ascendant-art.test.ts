import { describe, expect, it } from 'vitest';
import { GameState } from '../src/state';

function fresh() {
  GameState.frozen = false;
  return new GameState();
}

describe('Ascendant form art everywhere', () => {
  it('an Ascendant hero is shown with its current form art', () => {
    const s = fresh();
    expect(s.heroArtKey('asc_dark')).toBe('asc_dark');
    s.forms.asc_dark = 1;
    expect(s.heroArtKey('asc_dark')).toBe('asc_dark_f2');
    s.forms.asc_dark = 3;
    expect(s.heroArtKey('asc_dark')).toBe('asc_dark_f4');
  });

  it('other heroes keep their own picture', () => {
    expect(fresh().heroArtKey('brine')).toBe('brine');
  });
});
