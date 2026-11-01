import { describe, expect, it } from 'vitest';
import { GameState } from '../src/state';
import { HEROES } from '../src/data';
import { keeperThreshold } from '../src/formulas';
import { dayKey } from '../src/rewards';
import { isAscendant } from '../src/heroes/ascendant';
import {
  SCOUT_BONUS_COMMONS, SCOUT_KINDS, SCOUT_UNLOCK_LEVEL, cleanScout, fullReward, heroScoutScore, newScout, refreshBoard, rollMission, scoutReward, scoutShare,
} from '../src/scouting';
import { WEAPON_COSTS, WEAPON_MAX_LEVEL, weaponLook, weaponMult, weaponTotalCost, weaponUpgradeCost } from '../src/weapons';

const HOUR = 3600 * 1000;
const T0 = Date.UTC(2026, 10, 2, 9, 30);

function fresh() {
  GameState.frozen = false;
  localStorage.clear();
  return new GameState();
}

/** A state with Scouting open and every hero recruited. */
function scouter() {
  const s = fresh();
  s.lifetimeEmbers = keeperThreshold(SCOUT_UNLOCK_LEVEL - 1);
  for (const h of HEROES) s.levels[h.id] = 1;
  return s;
}

describe('weapons', () => {
  it('follows the design doc cost table and tops out at level 9', () => {
    expect(WEAPON_MAX_LEVEL).toBe(9);
    expect(WEAPON_COSTS[2]).toEqual({ ore: 10, crystal: 10, coreC: 2 });
    expect(WEAPON_COSTS[9]).toEqual({ ore: 5000, crystal: 5000, coreC: 256, coreR: 32, coreE: 8 });
    expect(weaponUpgradeCost(9)).toBeNull();
    expect(weaponTotalCost()).toEqual({ ore: 13360, crystal: 13360, coreC: 510, coreR: 63, coreE: 16 });
  });

  it('gives +15% ATK and HP per level, compounding, and changes look at 4 and 7', () => {
    expect(weaponMult(1)).toBe(1);
    expect(weaponMult(9)).toBeCloseTo(Math.pow(1.15, 8));
    expect([1, 3, 4, 6, 7, 9].map(weaponLook)).toEqual([1, 1, 2, 2, 3, 3]);
  });

  it('upgrading spends materials and raises the hero power', () => {
    const s = fresh();
    const h = HEROES.find((x) => x.unlockCost === 0)!;
    const before = s.heroPower(h);
    expect(s.upgradeWeapon(h.id)).toBe(false);
    s.forge = { ore: 60, crystal: 60, coreC: 6, coreR: 0, coreE: 0 };
    expect(s.upgradeWeapon(h.id)).toBe(true);
    expect(s.upgradeWeapon(h.id)).toBe(true);
    expect(s.weaponLevel(h.id)).toBe(3);
    expect(s.forge).toEqual({ ore: 0, crystal: 0, coreC: 0, coreR: 0, coreE: 0 });
    const after = s.heroPower(h);
    expect(after.atk.div(before.atk).toNumber()).toBeCloseTo(1.15 * 1.15);
    expect(after.hp.div(before.hp).toNumber()).toBeCloseTo(1.15 * 1.15);
    expect(s.weaponBlock(h.id)).toBe('Not enough materials');
  });

  it('needs the hero recruited', () => {
    const s = fresh();
    const locked = HEROES.find((x) => x.unlockCost > 0)!;
    s.forge = { ore: 1e6, crystal: 1e6, coreC: 1e6, coreR: 1e6, coreE: 1e6 };
    expect(s.weaponBlock(locked.id)).toBe('Recruit this hero first');
    expect(s.upgradeWeapon(locked.id)).toBe(false);
  });

  it('saves and loads weapon levels and materials', () => {
    const s = fresh();
    const h = HEROES.find((x) => x.unlockCost === 0)!;
    s.forge = { ore: 1e6, crystal: 1e6, coreC: 1e6, coreR: 1e6, coreE: 1e6 };
    for (let i = 0; i < 20; i++) s.upgradeWeapon(h.id);
    expect(s.weaponLevel(h.id)).toBe(9);
    s.wildCrests = 7;
    s.save();
    const t = new GameState();
    expect(t.load()).toBe(true);
    expect(t.weaponLevel(h.id)).toBe(9);
    expect(t.forge.coreE).toBe(1e6 - 16);
    expect(t.wildCrests).toBe(7);
  });
});

describe('scouting', () => {
  it('opens at player level 15', () => {
    const s = fresh();
    expect(s.scoutOpen()).toBe(false);
    expect(s.scoutBoard(T0).every((x) => !x.mission)).toBe(true);
    s.lifetimeEmbers = keeperThreshold(SCOUT_UNLOCK_LEVEL - 1);
    expect(s.scoutOpen()).toBe(true);
  });

  it('rolls the same mission for the same seed', () => {
    expect(rollMission('rare', 'r0:5')).toEqual(rollMission('rare', 'r0:5'));
    for (let i = 0; i < 50; i++) {
      const m = rollMission('common', `c0:${i}`);
      expect(SCOUT_KINDS.common.hours).toContain(m.hours);
      expect(m.size).toBe(3);
    }
  });

  it('posts 3 Common, 1 Rare and the day\'s Gilded mission', () => {
    const s = scouter();
    const board = s.scoutBoard(T0);
    expect(board.map((x) => x.kind)).toEqual(['common', 'common', 'common', 'rare', 'gilded']);
    expect(board.every((x) => x.mission && !x.mission.startedAt)).toBe(true);
    expect(s.scout.gildedDay).toBe(dayKey(T0));
  });

  it('scores heroes by stars, pink stars and weapon, with Type and element bonuses', () => {
    expect(heroScoutScore(0, 0, 1, false, false)).toBe(10);
    expect(heroScoutScore(2, 0, 1, true, false)).toBe(45);
    expect(heroScoutScore(2, 0, 1, true, true)).toBe(68);
    expect(heroScoutScore(3, 2, 5, false, false)).toBe(70);
    expect(scoutShare(45, 'common')).toBe(0.5);
    expect(scoutShare(500, 'common')).toBe(1);
  });

  it('pays weapon materials scaled by the Team Score', () => {
    expect(fullReward({ kind: 'common', hours: 4 })).toEqual({ ore: 120, crystal: 120, coreC: 4 });
    expect(fullReward({ kind: 'rare', hours: 6 })).toEqual({ unbinder: 1, ore: 300, crystal: 300, coreC: 12, coreR: 3, coreE: 1 });
    expect(fullReward({ kind: 'gilded', hours: 6 }).wild).toBe(20);
    expect(scoutReward({ kind: 'common', hours: 4 }, 0.5)).toEqual({ ore: 60, crystal: 60, coreC: 2 });
    expect(scoutReward({ kind: 'rare', hours: 6 }, 0.4)).toEqual({ ore: 120, crystal: 120, coreC: 5, coreR: 1 });
  });

  it('runs a mission: heroes are busy, it finishes after its hours, collecting pays and queues the next', () => {
    const s = scouter();
    s.scoutBoard(T0);
    const team = s.scoutAutoPick('c0');
    expect(team.length).toBe(3);
    expect(s.startScout('c0', team, T0)).toBe(true);
    expect([...s.scoutBusy()].sort()).toEqual([...team].sort());
    // A busy hero can't go on a second mission.
    expect(s.startScout('c1', [team[0]], T0)).toBe(false);
    expect(s.scoutAutoPick('c1').some((id) => team.includes(id))).toBe(false);
    const m = s.scout.slots[0].mission!;
    expect(s.claimScout('c0', T0 + m.hours * HOUR - 1)).toBeNull();
    expect(s.scoutReadyCount(T0 + m.hours * HOUR)).toBe(1);
    const share = s.scoutScore('c0', team).share;
    const reward = s.claimScout('c0', T0 + m.hours * HOUR)!;
    expect(reward).toEqual(scoutReward(m, share));
    expect(s.forge.ore).toBe(reward.ore ?? 0);
    expect(s.scoutBusy().size).toBe(0);
    expect(s.scout.slots[0].mission).toBeUndefined();
    // The slot refills at the next full hour.
    const refill = s.scout.slots[0].readyAt;
    expect(refill % HOUR).toBe(0);
    expect(s.scoutBoard(refill - 1)[0].mission).toBeUndefined();
    expect(s.scoutBoard(refill)[0].mission).toBeDefined();
  });

  it('recalling brings heroes home with nothing paid', () => {
    const s = scouter();
    s.scoutBoard(T0);
    expect(s.startScout('r0', s.scoutAutoPick('r0'), T0)).toBe(true);
    expect(s.recallScout('r0')).toBe(true);
    expect(s.scoutBusy().size).toBe(0);
    expect(s.forge.ore).toBe(0);
  });

  it('every 5 Commons finished adds a bonus Rare', () => {
    const st = newScout();
    refreshBoard(st, T0, 'd1');
    st.commons = SCOUT_BONUS_COMMONS;
    refreshBoard(st, T0, 'd1');
    expect(st.slots.filter((x) => x.slot === 'rb').length).toBe(1);
    expect(st.commons).toBe(0);
  });

  it('posts one Gilded mission a day, paying Wild Crests that go to a picked hero', () => {
    const s = scouter();
    s.scoutBoard(T0);
    const g = s.scout.slots.find((x) => x.slot === 'g')!;
    expect(s.startScout('g', s.scoutAutoPick('g'), T0)).toBe(true);
    const end = T0 + g.mission!.hours * HOUR;
    const reward = s.claimScout('g', end)!;
    expect(reward.wild).toBeGreaterThan(0);
    // Same day: no second Gilded.
    expect(s.scoutBoard(end).some((x) => x.slot === 'g')).toBe(dayKey(end) !== dayKey(T0));
    const common = HEROES.find((h) => h.rarity === 'common' && !isAscendant(h.id))!;
    const before = s.crests[common.id] ?? 0;
    s.wildCrests = 5;
    expect(s.useWildCrests(common.id, 5)).not.toBeNull();
    expect(s.crests[common.id]).toBe(before + 5);
    expect(s.wildCrests).toBe(0);
    const legendary = HEROES.find((h) => h.rarity === 'legendary');
    if (legendary) expect(s.wildCrestCost(legendary.id)).toBeNull();
    const asc = HEROES.find((h) => isAscendant(h.id));
    if (asc) expect(s.wildCrestCost(asc.id)).toBeNull();
  });

  it('keeps a running mission through save and load, and rerolls tampered missions from their seed', () => {
    const s = scouter();
    s.scoutBoard(T0);
    const team = s.scoutAutoPick('c1');
    s.startScout('c1', team, T0);
    s.save();
    const t = new GameState();
    expect(t.load()).toBe(true);
    expect(t.scout.slots.find((x) => x.slot === 'c1')!.mission!.heroes).toEqual(team);
    const hacked = JSON.parse(JSON.stringify(s.scout));
    hacked.slots[0].mission.hours = 0;
    hacked.slots.push({ slot: 'zz' }, { slot: 'c0' });
    const clean = cleanScout(hacked, new Set(HEROES.map((h) => h.id)));
    expect(clean.slots[0].mission!.hours).toBe(s.scout.slots[0].mission!.hours);
    expect(clean.slots.filter((x) => x.slot === 'c0').length).toBe(1);
    expect(clean.slots.some((x) => x.slot === 'zz')).toBe(false);
  });
});
