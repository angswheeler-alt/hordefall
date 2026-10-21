import { beforeEach, describe, expect, it } from 'vitest';
import { GameState } from '../src/state';
import { TRACKS, STEPS_PER_BAR, notesAt, midiHz } from '../src/music';

beforeEach(() => localStorage.clear());

describe('Music', () => {
  it('tracks are whole bars and the bass fits the melody', () => {
    for (const t of Object.values(TRACKS)) {
      expect(t.lead.length % STEPS_PER_BAR).toBe(0);
      expect(t.lead.length % t.bass.length).toBe(0);
      for (const beat of [...t.kick, ...t.snare, ...t.hat]) expect(beat).toBeLessThan(STEPS_PER_BAR);
    }
    expect(TRACKS.boss.bpm).toBeGreaterThan(TRACKS.field.bpm);
  });

  it('loops', () => {
    const t = TRACKS.field;
    expect(notesAt(t, t.lead.length + 3)).toEqual(notesAt(t, 3));
    expect(notesAt(t, 0).kick).toBe(true);
  });

  it('tunes to A440', () => {
    expect(midiHz(69)).toBe(440);
    expect(midiHz(81)).toBe(880);
  });
});

describe('Sound settings', () => {
  it('start at full effects and 60% music, and save', () => {
    const s = new GameState();
    expect(s.sfxVolume).toBe(1);
    expect(s.musicVolume).toBe(0.6);
    s.sfxVolume = 0.25;
    s.musicVolume = 0;
    s.muted = true;
    s.save();
    const back = new GameState();
    back.load();
    expect([back.sfxVolume, back.musicVolume, back.muted]).toEqual([0.25, 0, true]);
  });

  it('older saves get the defaults; bad values are clamped', () => {
    const d = new GameState().toJSON();
    delete d.sfxVolume;
    d.musicVolume = 7;
    GameState.writeLocal(d);
    const s = new GameState();
    s.load();
    expect(s.sfxVolume).toBe(1);
    expect(s.musicVolume).toBe(1);
  });
});
