import { describe, expect, it } from 'vitest';
import scene from '../src/BattleScene.ts?raw';
import ui from '../src/ui.ts?raw';
import { PVP_ULTIMATES, ultsAllowed } from '../src/colosseum';

// Samuel (2026-11-04): no Ultimates in fights against other players (Colosseum and Rush).
describe('Ultimates in PvP', () => {
  it('are off in PvP and on everywhere else', () => {
    expect(PVP_ULTIMATES).toBe(false);
    expect(ultsAllowed(true)).toBe(false);
    expect(ultsAllowed(false)).toBe(true);
  });

  it('the battle checks it before any Ultimate fires, by tap or Auto ult', () => {
    const src = scene;
    const body = (name: string) => src.slice(src.indexOf(`${name}(`), src.indexOf(`${name}(`) + 400);
    expect(body('  triggerUlt')).toContain('ultsAllowed(!!this.pvp)');
    expect(body('private tryAutoUlt')).toContain('ultsAllowed(!!this.pvp)');
  });

  it('the Ult bar hides during a PvP fight', () => {
    expect(ui).toContain("classList.toggle('no-ults'");
  });
});
