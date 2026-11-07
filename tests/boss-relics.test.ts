import { describe, expect, it } from 'vitest';
import Decimal from 'break_infinity.js';
import { GameState } from '../src/state';
import { HEROES } from '../src/data';
import { guildBossElement } from '../src/formulas';
import {
  BOSS_RELICS, BOSS_RELIC_SLOTS, BOSS_RELIC_MAX_LEVEL, BOSS_ITEM_CHANCE, BOSS_HEART_PITY, BOSS_ITEM_NAMES, GUILD_RELIC_ITEM_FROM,
  bossRelicCost, rollBossItems, guildRelicEffect,
} from '../src/guildRelics';

const icons = new Set(Object.keys(import.meta.glob('../src/assets/relics/*.png')).map((f) => f.split('/').pop()));
const byId = (id: string) => BOSS_RELICS.find((r) => r.id === id)!;
/** A fixed sequence of rolls, repeated. */
const seq = (...v: number[]) => { let i = 0; return () => v[i++ % v.length]; };
const never = () => 0.999;

function fresh() {
  GameState.frozen = false;
  localStorage.clear();
  return new GameState();
}

describe('boss relics and boss items', () => {
  it('has two relics and three items per Guild Boss, each relic with an icon', () => {
    for (const el of ['water', 'fire', 'earth', 'light', 'dark'] as const) {
      expect(BOSS_RELICS.filter((r) => r.element === el).length).toBe(2);
      expect(new Set(BOSS_ITEM_NAMES[el]).size).toBe(3);
    }
    expect(BOSS_RELICS.filter((r) => !icons.has(`${r.id}.png`)).map((r) => r.id)).toEqual([]);
    expect(BOSS_ITEM_CHANCE).toEqual([0.2, 0.05, 0.01]);
  });

  it('rolls each item tier on its own at 20% / 5% / 1%', () => {
    // Each roll draws common, rare, very rare in that order.
    expect(rollBossItems(1, 0, seq(0.19, 0.04, 0.009)).items).toEqual([1, 1, 1]);
    expect(rollBossItems(1, 0, seq(0.2, 0.05, 0.01)).items).toEqual([0, 0, 0]);
    expect(rollBossItems(1, 0, seq(0.1, 0.5, 0.5)).items).toEqual([1, 0, 0]);
    expect(rollBossItems(3, 0, never)).toEqual({ items: [0, 0, 0], pity: 3 });
  });

  it('makes the very rare item certain after BOSS_HEART_PITY rolls without one', () => {
    const a = rollBossItems(BOSS_HEART_PITY, 0, never);
    expect(a).toEqual({ items: [0, 0, 0], pity: BOSS_HEART_PITY });
    expect(rollBossItems(1, a.pity, never)).toEqual({ items: [0, 0, 1], pity: 0 });
    const s = fresh();
    expect(s.bossHeartPityLeft('fire')).toBe(BOSS_HEART_PITY);
    s.rollBossDrops('fire', 10, never);
    expect(s.bossHeartPityLeft('fire')).toBe(BOSS_HEART_PITY - 10);
    expect(s.bossHeartPityLeft('water')).toBe(BOSS_HEART_PITY);
  });

  it('drops items from rewarded fights against the boss element and from levels beaten', () => {
    const s = fresh();
    const fight = s.payGuildBossAttempt(5, new Decimal(0), new Decimal(1000), 'water', seq(0.1, 0.01, 0.5));
    expect(fight.items).toEqual([1, 1, 0]);
    expect(s.bossItemCount('water')).toEqual([1, 1, 0]);
    // No element (older callers): no items.
    expect(s.payGuildBossAttempt(5, new Decimal(0), new Decimal(1000)).items).toEqual([0, 0, 0]);
    // Levels beaten roll the items of that week's boss.
    const el = guildBossElement('2026-10-26');
    const before = s.bossItemCount(el);
    const got = s.payGuildBossRewards([{ week: '2026-10-26', level: 1 }, { week: '2026-10-26', level: 2 }], [], [], seq(0.1, 0.5, 0.5));
    expect(got.items).toEqual([{ element: el, got: [2, 0, 0] }]);
    expect(s.bossItemCount(el)).toEqual([before[0] + 2, before[1], before[2]]);
  });

  it('builds a relic from its own boss items only, then levels it with items and Warsteel', () => {
    const s = fresh();
    const pearl = byId('b_water1');
    expect(bossRelicCost(pearl, 0)).toEqual({ warsteel: 0, items: [5, 1, 0] });
    s.bossItems.fire = [99, 99, 99];
    expect(s.upgradeBossRelic('b_water1')).toBe(false);
    s.bossItems.water = [5, 1, 0];
    expect(s.upgradeBossRelic('b_water1')).toBe(true);
    expect(s.bossItemCount('water')).toEqual([0, 0, 0]);
    expect(s.bossRelics.b_water1).toBe(1);
    expect(s.bossRelicEquipped).toEqual(['b_water1']);
    // The second relic needs a very rare item.
    s.bossItems.water = [5, 2, 0];
    expect(s.upgradeBossRelic('b_water2')).toBe(false);
    s.bossItems.water = [5, 2, 1];
    expect(s.upgradeBossRelic('b_water2')).toBe(true);
    // Levels: 1 common each, a rare to reach 10, a very rare to reach the max; no Tempering.
    const next = bossRelicCost(pearl, 1)!;
    expect(next.items).toEqual([1, 0, 0]);
    expect(next.warsteel).toBeGreaterThan(0);
    expect(bossRelicCost(pearl, 9)!.items).toEqual([1, 1, 0]);
    expect(bossRelicCost(pearl, BOSS_RELIC_MAX_LEVEL - 1)!.items).toEqual([1, 0, 1]);
    expect(bossRelicCost(pearl, BOSS_RELIC_MAX_LEVEL)).toBeNull();
    s.warsteel = 1e9;
    s.bossItems.water = [100, 100, 100];
    while ((s.bossRelics.b_water1 ?? 0) < BOSS_RELIC_MAX_LEVEL) expect(s.upgradeBossRelic('b_water1')).toBe(true);
    expect(s.upgradeBossRelic('b_water1')).toBe(false);
    expect(s.bossItemCount('water')).toEqual([100 - (BOSS_RELIC_MAX_LEVEL - 1), 99, 99]);
  });

  it('boosts only heroes of its element, and only while equipped in its own slots', () => {
    const s = fresh();
    const water = HEROES.find((h) => h.element === 'water' && h.unlockCost === 0)!;
    const fire = HEROES.find((h) => h.element === 'fire')!;
    const w0 = s.heroPower(water);
    const f0 = s.heroPower(fire, 1);
    s.bossRelics.b_water1 = BOSS_RELIC_MAX_LEVEL;
    expect(s.toggleBossRelic('b_water1')).toBe(true);
    expect(s.heroPower(water).atk.div(w0.atk).toNumber()).toBeCloseTo(1 + guildRelicEffect(byId('b_water1'), 'elemAtk', BOSS_RELIC_MAX_LEVEL));
    expect(s.heroPower(water).atk.div(w0.atk).toNumber()).toBeCloseTo(1.6);
    expect(s.heroPower(water).hp.div(w0.hp).toNumber()).toBeCloseTo(1.3);
    expect(s.heroPower(fire, 1).atk.div(f0.atk).toNumber()).toBeCloseTo(1);
    s.bossRelics.b_fire2 = BOSS_RELIC_MAX_LEVEL;
    s.bossRelics.b_dark2 = BOSS_RELIC_MAX_LEVEL;
    expect(s.toggleBossRelic('b_fire2')).toBe(true);
    expect(s.toggleBossRelic('b_dark2')).toBe(false);
    expect(s.bossRelicEquipped.length).toBe(BOSS_RELIC_SLOTS);
    expect(s.heroPower(fire, 1).atk.div(f0.atk).toNumber()).toBeCloseTo(1.3);
    expect(s.guildRelicEquipped).toEqual([]);
    s.toggleBossRelic('b_water1');
    expect(s.heroPower(water).hp.div(w0.hp).toNumber()).toBeCloseTo(1);
  });

  it('makes the six guild relics cost a common boss item per level from level 10', () => {
    const s = fresh();
    s.warsteel = 1e9;
    while ((s.guildRelics.g_spear ?? 0) < GUILD_RELIC_ITEM_FROM) expect(s.upgradeGuildRelic('g_spear')).toBe(true);
    expect(s.upgradeGuildRelic('g_spear')).toBe(false);
    s.bossItems.fire = [1, 0, 0];
    s.bossItems.dark = [2, 5, 0];
    expect(s.upgradeGuildRelic('g_spear')).toBe(true);
    // Taken from the biggest pile of common items.
    expect(s.bossItemCount('dark')).toEqual([1, 5, 0]);
    expect(s.upgradeGuildRelic('g_spear')).toBe(true);
    expect(s.upgradeGuildRelic('g_spear')).toBe(true);
    expect(s.commonBossItems()).toBe(0);
    expect(s.upgradeGuildRelic('g_spear')).toBe(false);
    expect(s.guildRelics.g_spear).toBe(GUILD_RELIC_ITEM_FROM + 3);
  });

  it('keeps owned guild relic levels and saves boss items, pity and relics', () => {
    const s = fresh();
    s.guildRelics.g_aegis = 15;
    s.bossItems.earth = [4, 2, 1];
    s.bossItemPity.earth = 12;
    s.bossRelics.b_earth1 = 3;
    s.bossRelicEquipped = ['b_earth1'];
    s.save();
    const t = new GameState();
    expect(t.load()).toBe(true);
    expect(t.guildRelics.g_aegis).toBe(15);
    expect(t.bossItemCount('earth')).toEqual([4, 2, 1]);
    expect(t.bossHeartPityLeft('earth')).toBe(BOSS_HEART_PITY - 12);
    expect(t.bossRelics).toEqual({ b_earth1: 3 });
    expect(t.bossRelicEquipped).toEqual(['b_earth1']);
    const raw = JSON.parse(localStorage.getItem('hordefall-save-v1')!);
    raw.bossItems = { earth: [-1, 'x', 2.7], nope: [5, 5, 5] };
    raw.bossRelics = { b_earth1: 999, fake: 2 };
    raw.bossRelicEquipped = ['b_earth1', 'fake', 'b_water1'];
    localStorage.setItem('hordefall-save-v1', JSON.stringify(raw));
    const u = new GameState();
    u.load();
    expect(u.bossItemCount('earth')).toEqual([0, 0, 2]);
    expect(u.bossRelics).toEqual({ b_earth1: BOSS_RELIC_MAX_LEVEL });
    expect(u.bossRelicEquipped).toEqual(['b_earth1']);
  });
});
