import { describe, expect, it } from 'vitest';
import Decimal from 'break_infinity.js';
import { GameState } from '../src/state';
import { enemyHp } from '../src/formulas';
import {
  BOMB_RADIUS,
  BURROW_BEHIND,
  BURROW_NEAR,
  GUARD_RANGED,
  MOB_ART_PENDING,
  MOB_ELEMENTS,
  MOB_KINDS,
  MOB_TRICK_TEXT,
  SPECIAL_MOBS,
  SUMMON_MAX,
  SUMMON_NEAR,
  bombVictims,
  burrowSpot,
  guardShare,
  mobLoad,
  pickMob,
  summonReady,
} from '../src/mobs';
import { JOURNAL_MOBS, MOB_NAMES, cleanStamps, journalPage, mobPageId } from '../src/journal';
import { placeholderSvg, placeholderUrl } from '../src/mobPlaceholders';

function fresh() {
  GameState.frozen = false;
  localStorage.clear();
  return new GameState();
}

const kindsOn = (stage: number) => {
  const seen = new Set<string>();
  for (let i = 0; i < 2000; i++) seen.add(pickMob(stage, i / 2000).id);
  return seen;
};

describe('special mob kinds', () => {
  it('first show up on stages 100, 300, 600 and 1,000', () => {
    expect(SPECIAL_MOBS.map((id) => MOB_KINDS[id].fromStage)).toEqual([100, 300, 600, 1000]);
    for (const id of SPECIAL_MOBS) {
      expect(kindsOn(MOB_KINDS[id].fromStage - 1).has(id)).toBe(false);
      expect(kindsOn(MOB_KINDS[id].fromStage).has(id)).toBe(true);
    }
    expect(kindsOn(99).size).toBe(4);
    expect(kindsOn(1000).size).toBe(8);
  });

  it('each has a trick, a description and a Journal name', () => {
    for (const id of SPECIAL_MOBS) {
      expect(MOB_KINDS[id].trick).toBeTruthy();
      expect(MOB_TRICK_TEXT[id]!.length).toBeGreaterThan(20);
      expect(MOB_NAMES[id]).toBeTruthy();
    }
  });

  it('stay a small share of mobs, so stages still feel familiar', () => {
    let special = 0;
    for (let i = 0; i < 1000; i++) if (MOB_KINDS[pickMob(5000, i / 1000).id].trick) special++;
    expect(special / 1000).toBeGreaterThan(0.12);
    expect(special / 1000).toBeLessThan(0.22);
  });
});

describe('Shieldbearer', () => {
  it('blocks ranged hits from the front while its shield stands', () => {
    expect(guardShare(true, true, 100, 200)).toBe(GUARD_RANGED);
    expect(GUARD_RANGED).toBeLessThan(0.5);
  });

  it('takes melee hits, hits from behind and anything once the shield is broken in full', () => {
    expect(guardShare(true, false, 180, 200)).toBe(1);
    expect(guardShare(true, true, 260, 200)).toBe(1);
    expect(guardShare(false, true, 100, 200)).toBe(1);
  });
});

describe('Bomber', () => {
  it('catches every living hero close by, and only them', () => {
    const heroes = [
      { x: 300, alive: true },
      { x: 300 - BOMB_RADIUS, alive: true },
      { x: 300 - BOMB_RADIUS - 1, alive: true },
      { x: 310, alive: false },
    ];
    expect(bombVictims(300, heroes)).toEqual(heroes.slice(0, 2));
  });
});

describe('Summoner', () => {
  it('calls a minion when the timer is up, a hero is near and it has room', () => {
    expect(summonReady(10, 10, 0, SUMMON_NEAR)).toBe(true);
    expect(summonReady(9.9, 10, 0, 100)).toBe(false);
    expect(summonReady(10, 10, SUMMON_MAX, 100)).toBe(false);
    expect(summonReady(10, 10, 0, SUMMON_NEAR + 1)).toBe(false);
  });
});

describe('Burrower', () => {
  const team = [
    { x: 400, alive: true },
    { x: 360, alive: true },
    { x: 300, alive: true },
  ];

  it('digs once the front hero is close and comes up next to the back row', () => {
    expect(burrowSpot(400 + BURROW_NEAR + 1, team)).toBeNull();
    expect(burrowSpot(400 + BURROW_NEAR, team)).toBe(300 + BURROW_BEHIND);
    expect(burrowSpot(420, team)).toBe(300 + BURROW_BEHIND);
  });

  it('ignores fallen heroes and stays up when the team is bunched or gone', () => {
    expect(burrowSpot(450, [...team, { x: 100, alive: false }])).toBe(300 + BURROW_BEHIND);
    expect(burrowSpot(450, [{ x: 400, alive: true }, { x: 390, alive: true }])).toBeNull();
    expect(burrowSpot(450, [])).toBeNull();
  });

  it('never digs once it is already past the front hero', () => {
    expect(burrowSpot(380, team)).toBeNull();
  });
});

describe('balance', () => {
  it('changes nothing before stage 100', () => {
    expect(mobLoad(99, 0)).toEqual({ hp: 1, atk: 1, gold: 1 });
  });

  it('moves a mixed team’s wall back under one stage (enemy HP grows 7% a stage)', () => {
    for (const stage of [100, 300, 600, 1000, 5000]) {
      const load = mobLoad(stage, 0.5);
      expect(load.hp).toBeGreaterThan(1);
      expect(Math.log(load.hp) / Math.log(1.07)).toBeLessThan(1);
      expect(load.atk).toBeLessThan(1.05);
    }
  });

  it('hits teams without melee harder (Shieldbearers), but under 1.5 stages', () => {
    for (const stage of [100, 1000]) {
      expect(mobLoad(stage, 0).hp).toBeGreaterThan(mobLoad(stage, 1).hp);
      expect(Math.log(mobLoad(stage, 0).hp) / Math.log(1.07)).toBeLessThan(1.5);
    }
  });

  it('pays about enough extra gold to cover the extra time', () => {
    for (const stage of [100, 300, 600, 1000]) {
      const load = mobLoad(stage, 0.5);
      expect(load.gold).toBeGreaterThan(1);
      expect(Math.abs(load.gold - load.hp)).toBeLessThan(0.05);
    }
  });

  it('offline: a team just able to clear plain mobs on stage 100 is stopped by Shieldbearers', () => {
    const s = fresh();
    const team = (share: number, melee: number) => ({ dps: enemyHp(100).times(15 / 8).times(share), hp: new Decimal('1e300'), def: new Decimal(0), melee });
    expect(s.canClearStage(99, { ...team(1.001, 0.5), dps: enemyHp(99).times(15 / 8 * 1.001) })).toBe(true);
    expect(s.canClearStage(100, team(1.01, 0.5))).toBe(false);
    expect(s.canClearStage(100, team(1.04, 1))).toBe(true);
    expect(s.canClearStage(100, team(1.04, 0))).toBe(false);
    expect(s.canClearStage(100, team(1.09, 0))).toBe(true);
  });

  it('counts the team’s melee share from its heroes', () => {
    const s = fresh();
    const melee = s.stageTeam().melee;
    expect(melee).toBeGreaterThanOrEqual(0);
    expect(melee).toBeLessThanOrEqual(1);
  });
});

describe('Journal, shinies and art', () => {
  it('has a page per special kind and element, listed after the older kinds', () => {
    expect(JOURNAL_MOBS.slice(-4)).toEqual(SPECIAL_MOBS);
    for (const id of SPECIAL_MOBS) for (const el of MOB_ELEMENTS) expect(journalPage(mobPageId(id, el))?.group).toBe('mob');
    expect(journalPage(mobPageId('bomber', 'fire'))?.name).toBe('Fire Bomber');
  });

  it('keeps gold stamps from shiny special mobs in a save', () => {
    expect(cleanStamps([mobPageId('summoner', 'dark'), 'mob_bogus_dark'])).toEqual([mobPageId('summoner', 'dark')]);
  });

  it('draws a placeholder for every kind still waiting on its art', () => {
    expect(MOB_ART_PENDING).toEqual(SPECIAL_MOBS);
    for (const id of MOB_ART_PENDING) {
      const svg = placeholderSvg(id, '#ff0000');
      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg).toContain('#ff0000');
      // Single quotes only, so the picture can sit inside an HTML style attribute.
      expect(svg).not.toContain('"');
      expect(placeholderUrl(id).startsWith('data:image/svg+xml,')).toBe(true);
    }
  });
});
