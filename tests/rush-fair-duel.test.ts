import { beforeEach, describe, expect, it } from 'vitest';
import { GameState } from '../src/state';
import { forward, ahead, mirrorX } from '../src/duel';
import { marchCap, marchStep } from '../src/movement';
import scene from '../src/BattleScene.ts?raw';
import ui from '../src/ui.ts?raw';

// User (2026-11-15): in Rush the attacking side won almost every even 1v1 (Pasta vs Gogu went to whoever attacked).
// Cause: the foe was a plain stat block (no Signature, star skills, dodge, lifesteal or rolled crits) and the
// player's hits ignored its DEF. Now both duelists fight with their full kits through the same hero code.

const LEFT = 36;
const RIGHT = 1440 - 36;

beforeEach(() => localStorage.clear());

/** The body of a method in BattleScene.ts, up to the next method. */
function method(name: string): string {
  const start = scene.indexOf(`  private ${name}(`);
  expect(start).toBeGreaterThan(-1);
  const next = scene.indexOf('\n  private ', start + 10);
  return scene.slice(start, next);
}

describe('Rush duel lane rules (src/duel.ts)', () => {
  it('the two sides face each other', () => {
    expect(forward('hero')).toBe(1);
    expect(forward('enemy')).toBe(-1);
    expect(ahead(100, 160, 'hero')).toBe(60);
    expect(ahead(160, 100, 'enemy')).toBe(60);
    expect(ahead(100, 60, 'hero')).toBe(-40);
  });

  it('mirrors spots between the two crystals', () => {
    expect(mirrorX(LEFT + 20, LEFT, RIGHT)).toBe(RIGHT - 20);
    expect(mirrorX(mirrorX(500, LEFT, RIGHT), LEFT, RIGHT)).toBe(500);
  });

  it('two heroes of the same speed close in on each other at the same pace, step for step', () => {
    const see = (x: number) => mirrorX(x, LEFT, RIGHT);
    let mine = LEFT + 20;
    let foe = RIGHT - 20;
    const stopAt = RIGHT - 14 - 30;
    for (let i = 0; i < 40; i++) {
      const me = { x: mine, type: 'Brawler' as const, alive: true, engaged: false };
      const it = { x: see(foe), type: 'Brawler' as const, alive: true, engaged: false };
      mine = marchStep(mine, 60, 0.1, marchCap(me, [me]), stopAt);
      foe = see(marchStep(see(foe), 60, 0.1, marchCap(it, [it]), stopAt));
      expect(mine - LEFT).toBeCloseTo(RIGHT - foe, 9);
    }
    expect(mine).toBeGreaterThan(LEFT + 20);
  });
});

describe('Rush foes fight with their own kit', () => {
  it('each foe comes with its own save, so its stars and star skills are its own', () => {
    const s = new GameState();
    const [f] = s.pvpFoeUnits({ name: 'Ghost', ghost: true, heroes: [{ id: 'pasta', stars: 6 }], ember: 1, power: 1, cp: '0' });
    expect(f.owner).toBeInstanceOf(GameState);
    expect(f.owner).not.toBe(s);
    expect(f.owner.hasStar('pasta', 6)).toBe(true);
    expect(f.owner.hasStar('pasta', 7)).toBe(false);
    // The player's own heroes give the foe nothing.
    expect(f.owner.effects().every((e) => e.owner === 'pasta')).toBe(true);
  });

  it('a Rush fight starts as a fair duel and hands the foe its save', () => {
    const body = ui.slice(ui.indexOf('  fightRush('), ui.indexOf('  expeditionLenders('));
    expect(body).toContain('owner: f.owner');
    expect(body).toContain('fair: true');
    // The Colosseum and Expeditions keep their old rules for now.
    const col = ui.slice(ui.indexOf('  fightExpedition('), ui.indexOf('  fightExpedition(') + 1500);
    expect(col).not.toContain('fair: true');
  });

  it('a fair-duel foe rolls its own crits and runs the hero step (Signature, surge, form)', () => {
    const start = scene.slice(scene.indexOf('  startPvp('), scene.indexOf('  leavePvp('));
    expect(start).toContain('atk: kit ? f.stats.atk.value :');
    expect(start).toContain('e.kit = true');
    expect(start).toContain('e.ownerFx = (f.owner ?? this.state).effects()');
    const pvp = method('updatePvp');
    expect(pvp).toContain('if (e.kit) this.stepKit(e, dt);');
    // Both sides' surge and form tick in PvP now (they never did on the player's side either).
    expect(pvp).toContain('this.stepKit(h, dt);');
    const kit = method('stepKit');
    expect(kit).toContain('this.endForm(u)');
    expect(kit).toContain('this.stepSurge(u, dt)');
  });

  it('star skills and effects are read from the unit’s own save', () => {
    expect(method('sum')).toContain('this.fxOf(u)');
    expect(method('mul')).toContain('this.fxOf(u)');
    expect(method('sigPlus')).toContain('this.ownerOf(h).hasStar');
    expect(method('mastery')).toContain('this.ownerOf(h).hasStar');
    expect(method('heroAttack')).toContain('const fx = this.fxOf(h);');
  });

  it('hits between duelists go through dodge, DEF and the defensive skills, both ways round', () => {
    const attack = method('heroAttack');
    expect(attack).toContain('if (this.kitted(t)) {');
    expect(attack).toContain('this.takeHit(h, t, amount, crit)');
    expect(attack).not.toContain('this.enemies');
    expect(method('enemyHits')).toContain('this.takeHit(e, target, e.atk.times(mult))');
    const take = method('takeHit');
    expect(take).toContain('defended(');
    expect(take).toContain('target.stats.dodge.value');
    expect(take).toContain("grit?.kind === 'grit'");
    expect(take).toContain("mask?.kind === 'mask'");
    expect(take).toContain('signatureReflect(');
  });

  it('the hero step works from either end of the lane', () => {
    const step = method('stepHeroAction');
    expect(step).toContain('const dir = forward(h.side);');
    expect(step).toContain('this.foesOf(h)');
    expect(step).toContain('this.damagePlayerCrystal(h.atk, h)');
    expect(step).toContain('mirrorX(x, PLAYER_CRYSTAL_X, ENEMY_CRYSTAL_X)');
    expect(step).not.toContain('this.heroes');
  });
});
