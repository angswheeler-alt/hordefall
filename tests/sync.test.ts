import { describe, expect, it } from 'vitest';
import { decideSync, isFresh, isReadable, recommendedSave, type SyncInput } from '../src/sync';

const NOW = 1_800_000_000_000;
const fresh = { stage: 1, bestStage: 1, rekindles: 0, lastSeen: NOW };
const played = (best: number, rekindles = 0, lastSeen = NOW, rev?: number) => ({ stage: best, bestStage: best, rekindles, lastSeen, rev });

const run = (over: Partial<SyncInput>) =>
  decideSync({ mode: 'start', cloud: null, local: fresh, knownRev: null, loadedLastSeen: NOW, ...over });

describe('cloud save sync rules', () => {
  it('never treats a failed request as "no save"', () => {
    expect(run({ cloud: undefined, local: played(300) })).toBe('pause');
    expect(run({ cloud: undefined, knownRev: 4 })).toBe('pause');
  });

  it('creates a cloud save only for an account that never had one on this device', () => {
    expect(run({ cloud: null, local: played(40) })).toBe('create');
  });

  it('pauses instead of starting over when a synced save goes missing or is unreadable', () => {
    expect(run({ cloud: null, knownRev: 7, local: played(200) })).toBe('missing');
    expect(run({ cloud: 'garbage', knownRev: 7 })).toBe('missing');
    expect(run({ cloud: { hello: 1 }, knownRev: null })).toBe('missing');
  });

  it('auto-loads the cloud save on a fresh device, even one that was just opened', () => {
    expect(run({ cloud: played(500, 3, NOW - 86_400_000, 12), local: fresh, loadedLastSeen: NOW })).toBe('take-cloud');
    expect(run({ mode: 'signin', cloud: played(500, 3, NOW - 86_400_000, 12) })).toBe('take-cloud');
  });

  it('auto-loads a newer cloud save when this device has not played since', () => {
    const cloud = played(320, 2, NOW, 9);
    expect(run({ cloud, local: played(300, 2, NOW - 60_000), knownRev: 8, loadedLastSeen: NOW - 60_000 })).toBe('take-cloud');
  });

  it('never replaces real progress with a stage 1 save automatically', () => {
    // Cloud reset to stage 1 by another device: ask, even though it is newer.
    expect(run({ cloud: { ...fresh, rev: 9, lastSeen: NOW + 1 }, local: played(400, 3), knownRev: 8 })).toBe('ask');
    // This device's save went back to stage 1 although it was in sync: don't upload it.
    expect(run({ cloud: played(400, 3, NOW, 8), local: fresh, knownRev: 8 })).toBe('take-cloud');
    expect(run({ cloud: played(400, 3, NOW, 8), local: played(20), knownRev: 8 })).toBe('ask');
  });

  it('keeps uploading when this device is the one in sync', () => {
    expect(run({ cloud: played(100, 1, NOW, 5), local: played(120, 1), knownRev: 5 })).toBe('upload');
    expect(run({ cloud: { ...fresh, rev: 1 }, local: fresh, knownRev: 1 })).toBe('upload');
  });

  it('opens on whichever save was played last when it is at least as far', () => {
    expect(run({ cloud: played(500, 4, NOW, 9), local: played(300, 4, NOW - 1), knownRev: 8, loadedLastSeen: NOW - 1 })).toBe('take-cloud');
    expect(run({ cloud: played(500, 1, NOW, 9), local: played(500, 1, NOW + 1), knownRev: 8, loadedLastSeen: NOW + 1 })).toBe('keep-device');
    expect(run({ cloud: played(450, 1, NOW, 9), local: played(500, 2, NOW + 1), loadedLastSeen: NOW + 1 })).toBe('keep-device');
  });

  it('never lets a save that is behind win quietly, however recent', () => {
    // The phone case: the cloud was last written by a device stuck at 899, this device is at 1,250.
    expect(run({ cloud: played(899, 14, NOW, 9), local: played(1250, 25, NOW - 1), knownRev: 3, loadedLastSeen: NOW - 1 })).toBe('ask');
    // Even a little behind, or behind only on Rekindles.
    expect(run({ cloud: played(100, 0, NOW + 5, 9), local: played(300), knownRev: 8 })).toBe('ask');
    expect(run({ cloud: played(500, 1, NOW, 9), local: played(300, 4, NOW - 1), knownRev: 8, loadedLastSeen: NOW - 1 })).toBe('ask');
    expect(run({ cloud: played(500, 2, NOW, 9), local: played(450, 2, NOW + 1), knownRev: 8, loadedLastSeen: NOW + 1 })).toBe('ask');
  });

  it('recommends the save with more progress', () => {
    expect(recommendedSave(played(1250, 25), played(899, 14))).toBe('device');
    expect(recommendedSave(played(899, 14), played(1250, 25))).toBe('cloud');
    expect(recommendedSave(played(500, 3), played(500, 2))).toBe('device');
    expect(recommendedSave(played(500, 2), played(500, 2))).toBe('cloud');
  });

  it('asks when both sides have progress outside of opening the game', () => {
    const cloud = played(500, 1, NOW, 9);
    expect(run({ mode: 'signin', cloud, local: played(50) })).toBe('ask');
    expect(run({ mode: 'signin', cloud, local: played(400, 0, NOW + 1), loadedLastSeen: NOW + 1 })).toBe('ask');
    expect(run({ mode: 'conflict', cloud, local: played(600, 1), knownRev: 8 })).toBe('ask');
  });

  it('on "Play here", carries on from the other device unless this one is further on', () => {
    const t = (cloud: object, local: object) => run({ mode: 'takeover', cloud, local, knownRev: 8, loadedLastSeen: NOW + 1 });
    expect(t(played(500, 2, NOW, 9), played(500, 2))).toBe('take-cloud');
    expect(t(played(520, 2, NOW, 9), played(500, 2))).toBe('take-cloud');
    expect(t(played(500, 2, NOW, 9), played(530, 3))).toBe('keep-device');
    expect(t(played(520, 1, NOW, 9), played(500, 3))).toBe('ask');
    expect(t({ ...fresh, rev: 9 }, played(500, 2))).toBe('ask');
    // Nobody saved since: just keep saving.
    expect(run({ mode: 'takeover', cloud: played(500, 2, NOW, 8), local: played(510, 2), knownRev: 8 })).toBe('upload');
  });

  it('reads saves defensively', () => {
    expect(isFresh({})).toBe(true);
    expect(isFresh({ bestStage: 2 })).toBe(false);
    expect(isReadable({ stage: 3 })).toBe(true);
    expect(isReadable(null)).toBe(false);
    expect(isReadable([])).toBe(false);
  });
});
