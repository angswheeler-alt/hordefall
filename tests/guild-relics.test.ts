import { describe, expect, it } from 'vitest';
import Decimal from 'break_infinity.js';
import { GameState } from '../src/state';
import { HEROES } from '../src/data';
import { guildBossLane } from '../src/formulas';
import {
  GUILD_RELICS, GUILD_RELIC_MAX_LEVEL, GUILD_RELIC_SLOTS, GUILD_RELIC_TIER2_LEVEL, GUILD_RELIC_CRAFT,
  guildRelicCost, guildRelicTotalCost, guildRelicEffect, warsteelForFight, warsteelForKill, warsteelForWeek,
} from '../src/guildRelics';

const relics = new Set(Object.keys(import.meta.glob('../src/assets/relics/*.png')).map((f) => f.split('/').pop()));
const starter = HEROES.find((h) => h.unlockCost === 0)!;
const byId = (id: string) => GUILD_RELICS.find((r) => r.id === id)!;

function fresh() {
  GameState.frozen = false;
  localStorage.clear();
  return new GameState();
}

/** Give Warsteel and level a guild relic to `level`. */
function raise(s: GameState, id: string, level: number) {
  s.warsteel += 1e9;
  while ((s.guildRelics[id] ?? 0) < level) expect(s.upgradeGuildRelic(id)).toBe(true);
}

describe('guild relics', () => {
  it('has six relics, three per tier, each with an icon', () => {
    expect(GUILD_RELICS.length).toBe(6);
    expect(GUILD_RELICS.filter((r) => r.tier === 1).length).toBe(3);
    expect(GUILD_RELICS.filter((r) => !relics.has(`${r.id}.png`)).map((r) => r.id)).toEqual([]);
  });

  it('costs 300 / 800 to craft and a few thousand Warsteel to max', () => {
    const t1 = GUILD_RELICS.find((r) => r.tier === 1)!;
    const t2 = GUILD_RELICS.find((r) => r.tier === 2)!;
    expect(guildRelicCost(t1, 0)).toBe(GUILD_RELIC_CRAFT[1]);
    expect(guildRelicCost(t2, 0)).toBe(GUILD_RELIC_CRAFT[2]);
    for (let l = 1; l < GUILD_RELIC_MAX_LEVEL; l++) expect(guildRelicCost(t1, l)).toBeGreaterThanOrEqual(guildRelicCost(t1, l - 1) * (l === 1 ? 0 : 1));
    // About 6-8 weeks of ~900 Warsteel for a first relic.
    expect(guildRelicTotalCost(t1)).toBeGreaterThan(5_000);
    expect(guildRelicTotalCost(t1)).toBeLessThan(8_000);
  });

  it('grows effects evenly to the full value at max level', () => {
    const standard = byId('g_standard');
    expect(guildRelicEffect(standard, 'guildBoss', GUILD_RELIC_MAX_LEVEL)).toBeCloseTo(1);
    expect(guildRelicEffect(standard, 'guildBoss', GUILD_RELIC_MAX_LEVEL / 2)).toBeCloseTo(0.5);
    expect(guildRelicEffect(standard, 'hp', GUILD_RELIC_MAX_LEVEL)).toBe(0);
  });

  it('crafts with Warsteel only, fills the guild slots, and caps at max level', () => {
    const s = fresh();
    const gems = s.gems;
    expect(s.upgradeGuildRelic('g_standard')).toBe(false);
    s.warsteel = 300;
    expect(s.upgradeGuildRelic('g_standard')).toBe(true);
    expect(s.warsteel).toBe(0);
    expect(s.gems).toBe(gems);
    expect(s.guildRelics.g_standard).toBe(1);
    expect(s.guildRelicEquipped).toEqual(['g_standard']);
    raise(s, 'g_standard', GUILD_RELIC_MAX_LEVEL);
    expect(s.guildRelicNextCost(byId('g_standard'))).toBeNull();
    expect(s.upgradeGuildRelic('g_standard')).toBe(false);
  });

  it('opens tier 2 once any guild relic reaches level 10', () => {
    const s = fresh();
    s.warsteel = 1e9;
    expect(s.guildRelicOpen(byId('g_drum'))).toBe(false);
    expect(s.upgradeGuildRelic('g_drum')).toBe(false);
    raise(s, 'g_spear', GUILD_RELIC_TIER2_LEVEL - 1);
    expect(s.guildRelicOpen(byId('g_drum'))).toBe(false);
    raise(s, 'g_spear', GUILD_RELIC_TIER2_LEVEL);
    expect(s.upgradeGuildRelic('g_drum')).toBe(true);
  });

  it('has its own slots, apart from normal relic slots', () => {
    const s = fresh();
    for (const id of ['g_standard', 'g_spear', 'g_aegis']) raise(s, id, GUILD_RELIC_TIER2_LEVEL);
    raise(s, 'g_drum', 1);
    expect(s.guildRelicEquipped.length).toBe(GUILD_RELIC_SLOTS);
    expect(s.guildRelicEquipped).not.toContain('g_drum');
    expect(s.toggleGuildRelic('g_drum')).toBe(false);
    expect(s.toggleGuildRelic('g_spear')).toBe(true);
    expect(s.toggleGuildRelic('g_drum')).toBe(true);
    expect(s.guildRelicEquipped).toEqual(['g_standard', 'g_aegis', 'g_drum']);
    expect(s.equipped).toEqual([]);
    expect(s.toggleGuildRelic('g_ledger')).toBe(false);
  });

  it('multiplies hero ATK, HP and Defense, only while equipped', () => {
    const s = fresh();
    const before = s.heroPower(starter);
    raise(s, 'g_aegis', GUILD_RELIC_MAX_LEVEL);
    raise(s, 'g_standard', GUILD_RELIC_MAX_LEVEL);
    const after = s.heroPower(starter);
    expect(after.hp.div(before.hp).toNumber()).toBeCloseTo(1.5);
    expect(after.defense.div(before.defense).toNumber()).toBeCloseTo(1.25);
    expect(after.atk.div(before.atk).toNumber()).toBeCloseTo(1.25);
    s.toggleGuildRelic('g_aegis');
    expect(s.heroPower(starter).hp.div(before.hp).toNumber()).toBeCloseTo(1);
  });

  it('Rallying Drum speeds attacks; Slayer\'s Spear and the Standard add boss damage', () => {
    const s = fresh();
    const aps = s.heroStats(starter).attacksPerSec.value;
    raise(s, 'g_spear', GUILD_RELIC_MAX_LEVEL);
    raise(s, 'g_drum', GUILD_RELIC_MAX_LEVEL);
    expect(s.heroStats(starter).attacksPerSec.value).toBeCloseTo(aps * 1.15);
    expect(s.bossDamageMult()).toBeCloseTo(1.5);
    expect(s.guildBossBonus()).toBeCloseTo(0);
    raise(s, 'g_standard', GUILD_RELIC_MAX_LEVEL);
    expect(s.guildBossBonus()).toBeCloseTo(1);
    // The lane boss has half the health with a x2 bonus, and lane damage counts double.
    const lane = guildBossLane(new Decimal(1000), new Decimal(0), s.guildBossBonus());
    expect(lane.hp.toNumber()).toBe(500);
    expect(lane.damageFor(new Decimal(100)).toNumber()).toBe(200);
  });

  it('drops Warsteel from rewarded fights, levels beaten and the week, boosted by the Pick and Ledger', () => {
    expect(warsteelForFight(5, new Decimal(0), new Decimal(1000))).toBe(15);
    expect(warsteelForFight(5, new Decimal(1000), new Decimal(1000))).toBe(30);
    expect(warsteelForKill(10)).toBe(40);
    expect(warsteelForWeek(0)).toBe(0);
    expect(warsteelForWeek(12)).toBe(120);
    const s = fresh();
    const fight = s.payGuildBossAttempt(5, new Decimal(0), new Decimal(1000));
    expect(fight.warsteel).toBe(15);
    expect(fight.coins).toBe(15);
    const got = s.payGuildBossRewards([{ week: '2026-10-26', level: 1 }, { week: '2026-10-26', level: 2 }], [3], []);
    expect(got.warsteel).toBe(22 + 24 + 30);
    expect(s.warsteel).toBe(15 + 76);
    raise(s, 'g_spear', GUILD_RELIC_TIER2_LEVEL);
    raise(s, 'g_pick', GUILD_RELIC_MAX_LEVEL);
    raise(s, 'g_ledger', GUILD_RELIC_MAX_LEVEL);
    expect(s.guildRelicEquipped).toEqual(['g_spear', 'g_pick', 'g_ledger']);
    const boosted = s.payGuildBossAttempt(5, new Decimal(0), new Decimal(1000));
    expect(boosted.warsteel).toBe(Math.round(15 * 1.5));
    expect(boosted.coins).toBe(Math.round(15 * 1.5));
  });

  it('saves and loads Warsteel, levels and slots, dropping bad data', () => {
    const s = fresh();
    raise(s, 'g_aegis', 4);
    s.warsteel = 123;
    s.save();
    const t = new GameState();
    expect(t.load()).toBe(true);
    expect(t.warsteel).toBe(123);
    expect(t.guildRelics).toEqual({ g_aegis: 4 });
    expect(t.guildRelicEquipped).toEqual(['g_aegis']);
    const raw = JSON.parse(localStorage.getItem('hordefall-save-v1')!);
    raw.guildRelics = { g_aegis: 99, nope: 3, g_spear: 0 };
    raw.guildRelicEquipped = ['g_aegis', 'g_spear', 'nope', 'g_aegis'];
    raw.warsteel = -5;
    localStorage.setItem('hordefall-save-v1', JSON.stringify(raw));
    const u = new GameState();
    u.load();
    expect(u.guildRelics).toEqual({ g_aegis: GUILD_RELIC_MAX_LEVEL });
    expect(u.guildRelicEquipped).toEqual(['g_aegis']);
    expect(u.warsteel).toBe(0);
  });
});
