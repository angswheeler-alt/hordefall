import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Timed Signatures (Gogu's Power Surge, Pasta's dark form running out) must tick in every mode, not only on stages.
 * Until 2026-11-15 only the stage loop ticked them, so Gogu never surged in Trials, Guild Boss, Colosseum or Rush
 * and Pasta's form never ended there. This guards each battle loop.
 */
const src = readFileSync(new URL('../src/BattleScene.ts', import.meta.url), 'utf8');
const body = (name: string) => {
  const start = src.indexOf(`  private ${name}(`);
  expect(start).toBeGreaterThan(-1);
  const end = src.indexOf('\n  }\n', start);
  return src.slice(start, end);
};

describe('timed Signatures tick in every mode', () => {
  it('Trials and Guild Boss', () => expect(body('updateTrial')).toContain('this.stepSignatureClock(h, dt)'));
  it('Colosseum and Rush, both sides', () => {
    const pvp = body('updatePvp');
    expect(pvp).toContain('this.stepSignatureClock(h, dt)');
    expect(pvp).toContain('this.stepSignatureClock(e, dt)');
  });
  it('stages', () => {
    const update = src.slice(src.indexOf('  update(_time'), src.indexOf('this.tickBurns(dt);', src.indexOf('  update(_time')));
    expect(update).toContain('this.stepSignatureClock(h, dt)');
  });
});
