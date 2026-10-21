/**
 * Background music, synthesized like the sound effects (no audio files): a calm adventure
 * loop on the field and a faster one for bosses, Trials and the Colosseum.
 * Tracks are eighth-note grids; the scheduler looks a little ahead so timing stays tight.
 */
import { audio, onAudioStart } from './sfx';

export type Mood = 'field' | 'boss';

/** A MIDI note per eighth (null = rest). */
type Line = (number | null)[];

export interface Track {
  bpm: number;
  /** Lead melody, bass, and which eighths of a bar get kick / snare / hat. */
  lead: Line;
  bass: Line;
  kick: number[];
  snare: number[];
  hat: number[];
}

const _ = null;

export const TRACKS: Record<Mood, Track> = {
  // C - G - Am - F, twice, with an answering second half.
  field: {
    bpm: 112,
    lead: [
      76, _, 79, _, 84, _, 79, 76,
      74, _, 79, _, 83, _, 81, 79,
      72, _, 76, _, 81, _, 79, 76,
      77, _, 81, _, 79, _, 76, 74,
      79, 76, 72, 76, 79, _, 81, 79,
      71, 74, 79, _, 74, _, 71, 74,
      69, 72, 76, 81, 79, 76, 72, 76,
      77, _, 76, _, 74, _, _, _,
    ],
    bass: [
      48, _, 55, _, 48, _, 55, _,
      43, _, 50, _, 43, _, 50, _,
      45, _, 52, _, 45, _, 52, _,
      41, _, 48, _, 41, _, 48, _,
      48, _, 55, _, 48, _, 55, _,
      43, _, 50, _, 43, _, 50, _,
      45, _, 52, _, 45, _, 52, _,
      41, _, 48, _, 43, _, 47, _,
    ],
    kick: [0, 4],
    snare: [2, 6],
    hat: [1, 3, 5, 7],
  },
  // D minor: Dm - Dm - Bb - A, driving eighths.
  boss: {
    bpm: 150,
    lead: [
      62, _, 65, _, 69, _, 68, 69,
      74, _, 72, _, 69, _, 65, _,
      70, _, 69, _, 65, _, 62, _,
      61, _, 64, _, 69, _, _, _,
    ],
    bass: [
      38, 50, 38, 50, 38, 50, 38, 50,
      38, 50, 38, 50, 38, 50, 38, 50,
      34, 46, 34, 46, 34, 46, 34, 46,
      33, 45, 33, 45, 33, 45, 33, 45,
    ],
    kick: [0, 2, 4, 6],
    snare: [2, 6],
    hat: [0, 1, 2, 3, 4, 5, 6, 7],
  },
};

export const STEPS_PER_BAR = 8;

/** What plays on eighth `step` of a track (it loops). */
export function notesAt(track: Track, step: number) {
  const i = step % track.lead.length;
  const beat = step % STEPS_PER_BAR;
  return {
    lead: track.lead[i],
    bass: track.bass[i % track.bass.length],
    kick: track.kick.includes(beat),
    snare: track.snare.includes(beat),
    hat: track.hat.includes(beat),
  };
}

export const midiHz = (n: number) => 440 * 2 ** ((n - 69) / 12);

const LOOKAHEAD = 0.15;

export class Music {
  private mood: Mood = 'field';
  private playing: Mood = 'field';
  private step = 0;
  private next = 0;
  private noise: AudioBuffer | null = null;

  /** `mood` is asked every tick, so the music follows the game (it switches on the next bar). */
  constructor(private moodOf: () => Mood) {
    onAudioStart(() => {
      const a = audio();
      if (a) this.next = a.ctx.currentTime + 0.1;
    });
    setInterval(() => this.tick(), 40);
  }

  private tick() {
    const a = audio();
    if (!a || a.ctx.state !== 'running') return;
    this.mood = this.moodOf();
    const { ctx } = a;
    // Back from a pause (or far behind): start fresh rather than play a burst of catch-up notes.
    if (this.next < ctx.currentTime - 0.2) {
      this.next = ctx.currentTime + 0.05;
      this.step = 0;
    }
    while (this.next < ctx.currentTime + LOOKAHEAD) {
      if (this.step % STEPS_PER_BAR === 0 && this.mood !== this.playing) {
        this.playing = this.mood;
        this.step = 0;
      }
      const track = TRACKS[this.playing];
      const eighth = 60 / track.bpm / 2;
      this.play(a.ctx, a.bus, track, this.step, this.next, eighth);
      this.step++;
      this.next += eighth;
    }
  }

  private play(ctx: AudioContext, bus: GainNode, track: Track, step: number, t: number, eighth: number) {
    const n = notesAt(track, step);
    if (n.lead !== null) this.voice(ctx, bus, 'square', midiHz(n.lead), t, eighth * 0.9, 0.05);
    if (n.bass !== null) this.voice(ctx, bus, 'triangle', midiHz(n.bass), t, eighth * 0.95, 0.16);
    if (n.kick) this.kick(ctx, bus, t);
    if (n.snare) this.hiss(ctx, bus, t, 0.09, 0.07, 1800);
    if (n.hat) this.hiss(ctx, bus, t, 0.03, 0.025, 7000);
  }

  private voice(ctx: AudioContext, bus: GainNode, type: OscillatorType, hz: number, t: number, dur: number, vol: number) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = hz;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(bus);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private kick(ctx: AudioContext, bus: GainNode, t: number) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(g).connect(bus);
    osc.start(t);
    osc.stop(t + 0.17);
  }

  private hiss(ctx: AudioContext, bus: GainNode, t: number, dur: number, vol: number, cutoff: number) {
    if (!this.noise) {
      this.noise = ctx.createBuffer(1, ctx.sampleRate * 0.25, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(bus);
    src.start(t);
    src.stop(t + dur + 0.02);
  }
}
