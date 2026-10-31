import { describe, it, expect } from 'vitest';
import { HEROES, HERO_TYPES, type HeroType } from '../src/data';
import { GameState } from '../src/state';
import { TYPE_POSITION, BACKLINE_GAP, STRAGGLER_RANGE, marchCap, marchStep, type Marcher } from '../src/movement';

const byId = (id: string) => HEROES.find((h) => h.id === id)!;
const m = (type: HeroType, x: number, engaged = false): Marcher => ({ type, x, engaged, alive: true });

/** Walk a team down an empty lane for `seconds`, the way BattleScene does each frame. */
function march(team: { type: HeroType; speed: number; x: number }[], seconds: number) {
  const dt = 1 / 60;
  for (let t = 0; t < seconds; t += dt) {
    for (const h of team) {
      const ms = team.map((u) => m(u.type, u.x));
      h.x = marchStep(h.x, h.speed, dt, marchCap(ms[team.indexOf(h)], ms), Infinity);
    }
  }
  return team;
}

describe('hero movement', () => {
  it('uses the proposed Move Speeds for the five available heroes', () => {
    const speeds = Object.fromEntries(['brine', 'ember', 'thorn', 'lumen', 'rook'].map((id) => [byId(id).name, byId(id).moveSpeed]));
    expect(speeds).toEqual({ Brine: 120, Ember: 105, Thicket: 100, Lumen: 105, Rook: 110 });
  });

  it('keeps Move Speed separate from attack speed', () => {
    const s = new GameState();
    const brine = byId('brine');
    const before = s.heroStats(brine, 10);
    const faster = s.heroStats({ ...brine, moveSpeed: brine.moveSpeed * 2 }, 10);
    expect(faster.moveSpeed.value).toBe(240);
    expect(faster.attacksPerSec.value).toBe(before.attacksPerSec.value);
    expect(1 / before.attacksPerSec.base).toBeCloseTo(0.8);
  });

  it('gives every Type a lane position', () => {
    for (const t of Object.keys(HERO_TYPES) as HeroType[]) expect(TYPE_POSITION[t], t).toBeTruthy();
    expect(TYPE_POSITION.Knight).toBe('front');
    expect(TYPE_POSITION.Brawler).toBe('front');
    expect(TYPE_POSITION.Ranger).toBe('ranged');
    expect(TYPE_POSITION.Magician).toBe('ranged');
    expect(TYPE_POSITION.Support).toBe('support');
  });

  it('lets melee heroes charge at their own speed', () => {
    const rogue = m('Rogue', 200);
    expect(marchCap(rogue, [rogue, m('Samurai', 150), m('Knight', 120)])).toBe(Infinity);
  });

  it('a fast Rogue reaches the enemy well before a slower Samurai (user report: 170 vs 110)', () => {
    const [rogue, samurai] = march([{ type: 'Rogue', speed: 170, x: 0 }, { type: 'Samurai', speed: 110, x: 0 }], 4);
    expect(rogue.x).toBeCloseTo(170 * 4, -1);
    expect(samurai.x).toBeCloseTo(110 * 4, -1);
    // Walking 600 px to meet the enemy: the Rogue arrives in about 3.5 s, the Samurai in about 5.5 s.
    const arrive = (speed: number) => 600 / speed;
    expect(arrive(110) - arrive(170)).toBeGreaterThan(1.5);
  });

  it('ignores allies far back at the crystal (just respawned)', () => {
    const rook = m('Ranger', 400);
    expect(marchCap(rook, [rook, m('Knight', 400 - STRAGGLER_RANGE - 1)])).toBe(Infinity);
  });

  it('keeps ranged heroes behind the front line and Supports near their allies', () => {
    const rook = m('Ranger', 100);
    expect(marchCap(rook, [rook, m('Knight', 140), m('Samurai', 180)])).toBe(180 - BACKLINE_GAP);
    const lumen = m('Support', 100);
    expect(marchCap(lumen, [lumen, m('Ranger', 150)])).toBe(150 - BACKLINE_GAP);
    // With no one to stay behind, they walk freely.
    expect(marchCap(rook, [rook])).toBe(Infinity);
    expect(marchCap(lumen, [lumen, m('Support', 90, true)])).toBe(Infinity);
  });

  it('marches the five with the melee in front and the back line behind them', () => {
    const team = march(
      ['brine', 'ember', 'thorn', 'lumen', 'rook'].map((id) => ({ type: byId(id).type, speed: byId(id).moveSpeed, x: 0 })),
      6,
    );
    const at = Object.fromEntries(team.map((h, i) => [['brine', 'ember', 'thorn', 'lumen', 'rook'][i], h.x]));
    const front = Math.max(at.brine, at.thorn);
    expect(at.brine).toBe(front);
    expect(at.ember).toBeLessThanOrEqual(front - BACKLINE_GAP);
    expect(at.rook).toBeLessThanOrEqual(front - BACKLINE_GAP);
    expect(at.lumen).toBeLessThan(front);
    // Each melee hero walks at its own speed; the back line keeps up behind the fastest.
    expect(at.brine).toBeCloseTo(120 * 6, -1);
    expect(at.thorn).toBeCloseTo(100 * 6, -1);
    expect(Math.min(...Object.values(at))).toBeGreaterThan(100 * 6 * 0.8);
  });

  it('never steps backwards or past the stop point', () => {
    expect(marchStep(100, 120, 1, 50, 1000)).toBe(100);
    expect(marchStep(100, 120, 1, Infinity, 150)).toBe(150);
    expect(marchStep(100, 120, 0.5, Infinity, 1000)).toBe(160);
  });
});
