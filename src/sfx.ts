/**
 * Tiny synthesized sound effects (Web Audio), so the prototype needs no audio files.
 * Browsers only allow audio after a tap, so the context starts on the first pointer event.
 */
type Sound = 'hit' | 'crit' | 'kill' | 'coin' | 'hurt' | 'ult' | 'heal' | 'clear' | 'boss' | 'defeat' | 'chest' | 'unlock' | 'levelup' | 'tap';

/** Loudness of the whole mix at full volume. */
const MASTER = 0.35;

let ctx: AudioContext | null = null;
let out: GainNode | null = null;
/** Sound effects run through `master`, music through `musicBus`; both feed `out`. */
let master: GainNode | null = null;
let musicBus: GainNode | null = null;
let muted = false;
let sfxVolume = 1;
let musicVolume = 0.6;
const startListeners: (() => void)[] = [];
const lastPlayed: Partial<Record<Sound, number>> = {};
// Minimum gap per sound so a big fight doesn't turn into noise.
const MIN_GAP: Partial<Record<Sound, number>> = { hit: 0.05, hurt: 0.08, coin: 0.06, kill: 0.04, heal: 0.15, levelup: 0.07, tap: 0.05 };

export function initAudio() {
  const start = () => {
    if (!ctx) {
      try {
        ctx = new AudioContext();
        out = ctx.createGain();
        out.connect(ctx.destination);
        master = ctx.createGain();
        master.connect(out);
        musicBus = ctx.createGain();
        musicBus.connect(out);
        applyLevels();
        for (const fn of startListeners) fn();
      } catch {
        return;
      }
    }
    if (ctx.state === 'suspended' && !document.hidden) ctx.resume().catch(() => {});
  };
  window.addEventListener('pointerdown', start);
  window.addEventListener('keydown', start);
  // Nothing plays in a background tab (and phones keep the battery).
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend().catch(() => {});
    else ctx.resume().catch(() => {});
  });
}

/** The audio graph once the first tap has started it: `fn` runs then (or now, if it already has). */
export function onAudioStart(fn: () => void) {
  startListeners.push(fn);
  if (ctx) fn();
}

/** The music bus, while music can be heard. */
export function audio(): { ctx: AudioContext; bus: GainNode } | null {
  return ctx && musicBus && !muted && musicVolume > 0 ? { ctx, bus: musicBus } : null;
}

function applyLevels() {
  if (!ctx || !out || !master || !musicBus) return;
  const t = ctx.currentTime;
  out.gain.setTargetAtTime(muted ? 0 : MASTER, t, 0.02);
  // Squared so the slider feels even to the ear.
  master.gain.setTargetAtTime(sfxVolume * sfxVolume, t, 0.02);
  musicBus.gain.setTargetAtTime(musicVolume * musicVolume, t, 0.05);
}

export function setMuted(value: boolean) {
  muted = value;
  applyLevels();
}

/** Effects and music volume, 0 to 1 each. */
export function setVolumes(sfx: number, music: number) {
  sfxVolume = Math.max(0, Math.min(1, sfx));
  musicVolume = Math.max(0, Math.min(1, music));
  applyLevels();
}

function tone(type: OscillatorType, from: number, to: number, start: number, dur: number, vol: number) {
  if (!ctx || !master) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, start);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + dur);
  g.gain.setValueAtTime(vol, start);
  g.gain.exponentialRampToValueAtTime(0.001, start + dur);
  osc.connect(g).connect(master);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

let noiseBuf: AudioBuffer | null = null;
function noise(start: number, dur: number, vol: number, cutoff: number) {
  if (!ctx || !master) return;
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = cutoff;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, start);
  g.gain.exponentialRampToValueAtTime(0.001, start + dur);
  src.connect(filter).connect(g).connect(master);
  src.start(start);
  src.stop(start + dur + 0.02);
}

export function play(sound: Sound) {
  if (!ctx || !master || muted || sfxVolume === 0 || ctx.state !== 'running') return;
  const t = ctx.currentTime;
  const gap = MIN_GAP[sound] ?? 0;
  if (t - (lastPlayed[sound] ?? -1) < gap) return;
  lastPlayed[sound] = t;
  const v = 0.9 + Math.random() * 0.2; // slight pitch variety

  switch (sound) {
    case 'hit':
      noise(t, 0.06, 0.35, 2500);
      tone('square', 220 * v, 110, t, 0.06, 0.12);
      break;
    case 'crit':
      noise(t, 0.12, 0.5, 5000);
      tone('square', 520 * v, 140, t, 0.14, 0.2);
      tone('triangle', 1200, 600, t, 0.1, 0.12);
      break;
    case 'kill':
      tone('square', 600 * v, 1400, t, 0.08, 0.14);
      noise(t, 0.08, 0.2, 1500);
      break;
    case 'coin':
      tone('square', 988, 988, t, 0.05, 0.08);
      tone('square', 1319, 1319, t + 0.05, 0.08, 0.08);
      break;
    case 'hurt':
      tone('sawtooth', 160 * v, 70, t, 0.1, 0.12);
      break;
    case 'heal':
      tone('sine', 660, 990, t, 0.18, 0.12);
      break;
    case 'ult':
      noise(t, 0.5, 0.5, 900);
      tone('sawtooth', 90, 40, t, 0.5, 0.35);
      tone('square', 300, 1800, t, 0.25, 0.12);
      break;
    case 'clear':
      [523, 659, 784, 1047].forEach((f, i) => tone('square', f, f, t + i * 0.08, 0.12, 0.12));
      break;
    case 'boss':
      tone('sawtooth', 70, 50, t, 0.9, 0.35);
      tone('square', 140, 100, t + 0.15, 0.6, 0.15);
      break;
    case 'defeat':
      [392, 330, 262, 196].forEach((f, i) => tone('triangle', f, f * 0.97, t + i * 0.12, 0.16, 0.18));
      break;
    case 'chest':
      [784, 988, 1175, 1568].forEach((f, i) => tone('square', f, f, t + i * 0.05, 0.08, 0.1));
      break;
    case 'levelup':
      tone('square', 440 * v, 880 * v, t, 0.09, 0.1);
      tone('triangle', 880 * v, 1320 * v, t + 0.05, 0.1, 0.1);
      break;
    case 'tap':
      tone('triangle', 900, 700, t, 0.04, 0.08);
      break;
    case 'unlock':
      [523, 784, 1047, 1568].forEach((f, i) => tone('triangle', f, f, t + i * 0.1, 0.25, 0.18));
      break;
  }
}
