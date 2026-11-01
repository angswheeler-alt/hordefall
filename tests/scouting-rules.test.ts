import { describe, expect, it } from 'vitest';
import { GameState } from '../src/state';
import { HEROES, type Element, type HeroType } from '../src/data';
import { keeperThreshold } from '../src/formulas';
import { SCOUT_KINDS, SCOUT_UNLOCK_LEVEL, pickScoutTeam, rollMission, scoutProblems, type ScoutCand, type ScoutMission } from '../src/scouting';

const T0 = Date.UTC(2026, 10, 2, 9, 30);

function scouter() {
  GameState.frozen = false;
  localStorage.clear();
  const s = new GameState();
  s.lifetimeEmbers = keeperThreshold(SCOUT_UNLOCK_LEVEL - 1);
  return s;
}

const cand = (id: string, stars: number, element: Element, type: HeroType, score = 10 * (stars + 1)): ScoutCand => ({ id, stars, element, type, score });

function gilded(): ScoutMission {
  return { ...rollMission('gilded', 'g:test'), element: 'fire', type: 'Knight' };
}

describe('scouting mission rules', () => {
  it('each kind needs more heroes, more stars and more matches the rarer it is', () => {
    expect([SCOUT_KINDS.common.size, SCOUT_KINDS.rare.size, SCOUT_KINDS.gilded.size]).toEqual([4, 5, 6]);
    expect([SCOUT_KINDS.common.minStar, SCOUT_KINDS.rare.minStar, SCOUT_KINDS.gilded.minStar]).toEqual([2, 3, 4]);
    const g = rollMission('gilded', 'g:x');
    expect(g.needElement).toBe(2);
    expect(g.needType).toBe(1);
    expect(g.minScore).toBe(180);
  });

  it('lists every rule a team breaks', () => {
    const m = gilded();
    const weak = [cand('a', 1, 'water', 'Rogue'), cand('b', 4, 'water', 'Rogue')];
    const p = scoutProblems(m, weak);
    expect(p.some((x) => x.startsWith('Needs 6 heroes'))).toBe(true);
    expect(p.some((x) => x.includes('4★'))).toBe(true);
    expect(p.some((x) => x.includes('Fire'))).toBe(true);
    expect(p.some((x) => x.includes('Knight'))).toBe(true);
    expect(p.some((x) => x.includes('Team Score'))).toBe(true);
    const good = [
      cand('f1', 4, 'fire', 'Knight'), cand('f2', 4, 'fire', 'Rogue'),
      cand('x1', 4, 'water', 'Rogue'), cand('x2', 4, 'water', 'Rogue'), cand('x3', 4, 'earth', 'Rogue'), cand('x4', 4, 'dark', 'Rogue'),
    ];
    expect(scoutProblems(m, good)).toEqual([]);
  });

  it('picks the needed element and Type before higher scores, and leaves out low-star heroes', () => {
    const m = gilded();
    const cands = [
      cand('big1', 6, 'water', 'Rogue'), cand('big2', 6, 'water', 'Rogue'), cand('big3', 6, 'earth', 'Rogue'),
      cand('big4', 6, 'earth', 'Rogue'), cand('big5', 6, 'dark', 'Rogue'), cand('big6', 6, 'dark', 'Rogue'),
      cand('fireknight', 3, 'fire', 'Knight'), cand('fire2', 3, 'fire', 'Rogue'), cand('lowfire', 2, 'fire', 'Rogue', 999),
    ];
    const team = pickScoutTeam(m, cands);
    expect(team.length).toBe(6);
    expect(team).toContain('fireknight');
    expect(team).toContain('fire2');
    expect(team).not.toContain('lowfire');
    expect(scoutProblems(m, team.map((id) => cands.find((c) => c.id === id)!))).toEqual([]);
  });

  it('a team that breaks the rules can\'t be sent', () => {
    const s = scouter();
    const ids = HEROES.slice(0, 10).map((h) => h.id);
    for (const id of ids) {
      s.levels[id] = 1;
      s.stars[id] = 0; // 1★: under every mission's lowest stars
    }
    s.scoutBoard(T0);
    expect(s.startScout('c0', ids.slice(0, 4), T0)).toBe(false);
    for (const id of ids) s.stars[id] = 1; // 2★
    expect(s.scoutProblems('c0', ids.slice(0, 4))).toEqual([]);
    expect(s.startScout('c0', ids.slice(0, 3), T0)).toBe(false);
    expect(s.startScout('c0', ids.slice(0, 4), T0)).toBe(true);
  });
});

describe('Deploy all', () => {
  it('sends teams to every mission when there are plenty of strong heroes, with no hero on two missions', () => {
    const s = scouter();
    for (const h of HEROES) {
      s.levels[h.id] = 1;
      s.stars[h.id] = 4;
    }
    const { sent, skipped } = s.deployAllScouts(T0);
    expect(skipped).toEqual([]);
    expect(sent.sort()).toEqual(['c0', 'c1', 'c2', 'g', 'r0']);
    const all = s.scout.slots.flatMap((x) => x.mission!.heroes);
    expect(new Set(all).size).toBe(all.length);
    expect(all.length).toBe(4 * 3 + 5 + 6);
    // Nothing left to send.
    expect(s.deployAllScouts(T0).sent).toEqual([]);
  });

  it('fills the most valuable missions first and skips the ones no team fits', () => {
    const s = scouter();
    // Only 8 heroes at 4★: enough for the Gilded mission (if its element and Type exist) or a Common, not everything.
    s.scoutBoard(T0);
    const g = s.scout.slots.find((x) => x.slot === 'g')!.mission!;
    const fits = HEROES.filter((h) => s.formDef(h).element === g.element && s.formDef(h).type === g.type);
    const els = HEROES.filter((h) => s.formDef(h).element === g.element && !fits.includes(h));
    const rest = HEROES.filter((h) => s.formDef(h).element !== g.element);
    const pool = [...fits.slice(0, 1), ...els.slice(0, 1), ...rest.slice(0, 6)];
    expect(pool.length).toBe(8);
    for (const h of pool) {
      s.levels[h.id] = 1;
      s.stars[h.id] = 4;
    }
    const { sent, skipped } = s.deployAllScouts(T0);
    expect(sent[0]).toBe('g');
    expect(skipped).toContain('r0');
    // The 2 heroes left over can't fill a 4-hero Common.
    expect(sent).toEqual(['g']);
    expect(skipped.sort()).toEqual(['c0', 'c1', 'c2', 'r0']);
  });
});

describe('Gilded mission turnover', () => {
  it('an unsent Gilded mission is replaced by the next day\'s, a running one is kept', () => {
    const s = scouter();
    s.scoutBoard(T0);
    const first = s.scout.slots.find((x) => x.slot === 'g')!.mission!.id;
    const next = T0 + 24 * 3600 * 1000;
    const g2 = s.scoutBoard(next).find((x) => x.slot === 'g')!.mission!;
    expect(g2.id).not.toBe(first);
    for (const h of HEROES) {
      s.levels[h.id] = 1;
      s.stars[h.id] = 4;
    }
    expect(s.startScout('g', s.scoutAutoPick('g'), next)).toBe(true);
    const later = next + 24 * 3600 * 1000;
    const g3 = s.scoutBoard(later).find((x) => x.slot === 'g')!.mission!;
    expect(g3.id).toBe(g2.id);
    expect(g3.startedAt).toBe(next);
  });
});
