import { describe, expect, it } from 'vitest';
import { GameState } from '../src/state';
import { HEROES } from '../src/data';
import { keeperThreshold } from '../src/formulas';
import {
  BOONS, EXP_AUTO_SHARE, EXP_CHARGE_CAP, EXP_HEARTS, EXP_HIRE_MAX, EXP_ROWS, EXP_STOPS, EXP_UNLOCK_LEVEL,
  autoReward, boonMults, cleanExpedition, daysBetween, fullReward, makeMap, partReward, rollBoons,
} from '../src/expedition';

const at = (m: number, d: number, h = 12) => new Date(2026, m - 1, d, h).getTime();

function fresh() {
  GameState.frozen = false;
  localStorage.clear();
  return new GameState();
}

/** Player level EXP_UNLOCK_LEVEL with every hero recruited at Ember level 20. */
function player() {
  const s = fresh();
  s.lifetimeEmbers = keeperThreshold(EXP_UNLOCK_LEVEL - 1);
  for (const h of HEROES) {
    s.levels[h.id] = 1;
    s.emberLevels[h.id] = 20;
  }
  return s;
}

describe('expedition rules', () => {
  it('makes a map of forks ending with the boss, the same for the same seed', () => {
    const m = makeMap('a');
    expect(m).toHaveLength(EXP_STOPS);
    expect(m[EXP_ROWS]).toEqual(['boss']);
    for (const row of m.slice(0, EXP_ROWS)) {
      expect(row).toHaveLength(2);
      expect(row[0]).not.toBe(row[1]);
    }
    expect(m[0]).toContain('recruit');
    expect(m[EXP_ROWS - 1]).toContain('camp');
    expect(makeMap('a')).toEqual(m);
  });

  it('stacks Boons by multiplying, and only for heroes they fit', () => {
    const fire = { element: 'fire' as const, type: 'Knight' as const, hired: false };
    const m = boonMults(['steel', 'el-fire', 'el-water', 'hired'], fire);
    expect(m.atk).toBeCloseTo(1.2 * 1.5);
    expect(m.hp).toBe(1);
    expect(boonMults(['hired'], { ...fire, hired: true }).atk).toBeCloseTo(1.6);
  });

  it('offers three useful Boons', () => {
    const party = [{ element: 'water' as const, type: 'Samurai' as const, hired: false }];
    const offer = rollBoons('x', party);
    expect(offer).toHaveLength(3);
    expect(new Set(offer).size).toBe(3);
    for (const id of offer) {
      const b = BOONS.find((x) => x.id === id)!;
      expect(b.hired).toBeFalsy();
      if (b.element) expect(b.element).toBe('water');
      if (b.type) expect(b.type).toBe('Samurai');
    }
  });

  it('pays a share for a partial run and 80% for Auto-clear', () => {
    expect(partReward(5, 0)).toEqual({ gems: 0, wild: 0, stones: 0, chest: null });
    expect(partReward(5, 4).gems).toBe(Math.floor(fullReward(5).gems / 2));
    expect(autoReward(5).gems).toBe(Math.floor(fullReward(5).gems * EXP_AUTO_SHARE));
    expect(autoReward(5).chest).toBe(fullReward(5).chest);
    expect(fullReward(30).gems).toBeLessThanOrEqual(40);
  });

  it('counts days between local day keys', () => {
    expect(daysBetween('2026-11-01', '2026-11-04')).toBe(3);
    expect(daysBetween('2026-10-31', '2026-11-01')).toBe(1);
    expect(daysBetween('', '2026-11-01')).toBe(1);
  });
});

describe('expedition in the game', () => {
  it('is closed below the unlock level', () => {
    const s = fresh();
    expect(s.expOpen()).toBe(false);
    expect(s.expStart(1, [HEROES[0].id], [], at(11, 4))).toBeNull();
  });

  it('gives one charge a day, stacking up to the cap', () => {
    const s = player();
    s.expSync(at(11, 1));
    expect(s.expedition.charges).toBe(1);
    s.expSync(at(11, 1, 20));
    expect(s.expedition.charges).toBe(1);
    s.expSync(at(11, 3));
    expect(s.expedition.charges).toBe(3);
    s.expSync(at(11, 20));
    expect(s.expedition.charges).toBe(EXP_CHARGE_CAP);
  });

  it('plays a run: path, fights, Boons, hires, boss, then unlocks Auto-clear', () => {
    const s = player();
    const now = at(11, 4);
    s.expSync(now);
    const party = s.expDefaultParty();
    expect(party.length).toBe(5);
    const gems = s.gems;
    const run = s.expStart(1, party, [{ name: 'pal', source: 'friend', heroes: HEROES.filter((h) => !party.includes(h.id)).slice(0, 3).map((h) => ({ id: h.id, stars: 0 })) }], now)!;
    expect(run).not.toBeNull();
    expect(s.expedition.charges).toBe(0);
    expect(s.expStart(1, party, [], now)).toBeNull();
    let guard = 0;
    while (s.expedition.run && guard++ < 50) {
      const r = s.expedition.run;
      if (r.offer) {
        if (r.offer.kind === 'hire') expect(s.expHire(0, 0)).toBe(true);
        else if (r.offer.kind === 'mystery') expect(s.expMystery('leave')).not.toBeNull();
        else expect(s.expTakeBoon(r.offer.boons![0])).toBe(true);
        continue;
      }
      if (r.at < 0) {
        // Prefer the Tavern on the first row.
        const pick = r.map[r.row].indexOf('recruit');
        expect(s.expPick(pick >= 0 ? pick : 0)).toBe(true);
        continue;
      }
      expect(s.expFightStart()).toBe(true);
      expect(s.skillTeam?.has(party[0])).toBe(true);
      const res = s.expFightEnd(true)!;
      expect(s.skillTeam).toBeNull();
      if (res.end) {
        expect(res.end.cleared).toBe(true);
        expect(res.end.reward.gems).toBe(fullReward(1).gems);
      }
    }
    expect(s.expedition.run).toBeUndefined();
    expect(s.expedition.best).toBe(1);
    expect(s.gems).toBe(gems + fullReward(1).gems);
    // Next day: Auto-clear level 1 for 80%.
    const auto = s.expAuto(1, at(11, 5))!;
    expect(auto.reward).toEqual(autoReward(1));
    expect(s.expAuto(2, at(11, 5))).toBeNull();
  });

  it('borrowed heroes are fitted to the party and limited to two', () => {
    const s = player();
    s.expSync(at(11, 4));
    const party = s.expDefaultParty();
    s.expStart(1, party, [], at(11, 4));
    const r = s.expedition.run!;
    r.map[0] = ['recruit', 'fight'];
    s.expPick(0);
    const offer = r.offer!.hires!;
    expect(offer.length).toBe(3);
    for (const h of offer) expect(party).not.toContain(h.id);
    s.expHire(0);
    expect(r.hires).toHaveLength(1);
    expect(r.hires.length).toBeLessThanOrEqual(EXP_HIRE_MAX);
    expect(s.expPartyPower().gt(0)).toBe(true);
  });

  it('a loss costs a heart, and the last heart ends the run with part of the loot', () => {
    const s = player();
    s.expSync(at(11, 4));
    s.expStart(2 > s.expMaxLevel() ? 1 : 2, s.expDefaultParty(), [], at(11, 4));
    const r = s.expedition.run!;
    r.map[0] = ['fight', 'recruit'];
    s.expPick(0);
    for (let i = 1; i <= EXP_HEARTS; i++) {
      s.expFightStart();
      const res = s.expFightEnd(false)!;
      expect(res.heartsLeft).toBe(EXP_HEARTS - i);
      if (i < EXP_HEARTS) expect(res.end).toBeNull();
      else expect(res.end!.cleared).toBe(false);
    }
    expect(s.expedition.run).toBeUndefined();
    expect(s.expedition.best).toBe(0);
  });

  it('saves and loads a run; a fight left open counts as a lost heart', () => {
    const s = player();
    s.expSync(at(11, 4));
    s.expStart(1, s.expDefaultParty(), [], at(11, 4));
    s.expedition.run!.map[0] = ['fight', 'recruit'];
    s.expPick(0);
    s.expFightStart();
    const raw = JSON.parse(JSON.stringify(s.expedition));
    const back = cleanExpedition(raw, new Set(HEROES.map((h) => h.id)));
    expect(back.run!.hearts).toBe(EXP_HEARTS - 1);
    expect(back.run!.foe).toBeTruthy();
    expect(back.run!.party).toEqual(s.expedition.run!.party);
    expect(cleanExpedition({ charges: 99, run: { map: 'x' } }, new Set()).charges).toBe(EXP_CHARGE_CAP);
  });

  it('foes match the party: an unboosted party wins the first fight', () => {
    const s = player();
    s.expSync(at(11, 4));
    s.expStart(1, s.expDefaultParty(), [], at(11, 4));
    const r = s.expedition.run!;
    r.map[0] = ['fight', 'recruit'];
    s.expPick(0);
    expect(s.expForecast()!.won).toBe(true);
  });
});
