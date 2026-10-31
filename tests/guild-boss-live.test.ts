import { describe, expect, it } from 'vitest';
import Decimal from 'break_infinity.js';
import { guildBossHitAtk, guildBossLane, defended } from '../src/formulas';
import { GUILD_BOSS_HIT_SHARE, GUILD_BOSS_HIT_PER_LEVEL, GUILD_BOSS_HIT_LEVEL_CAP } from '../src/data';

describe('Guild Boss live fight', () => {
  it('lands a share of the team\'s average HP after Defense, a little more each level, up to a cap', () => {
    const hp = new Decimal(10_000);
    const none = new Decimal(0);
    expect(guildBossHitAtk(hp, none, 1).toNumber()).toBeCloseTo(10_000 * GUILD_BOSS_HIT_SHARE);
    expect(guildBossHitAtk(hp, none, 6).toNumber()).toBeCloseTo(10_000 * GUILD_BOSS_HIT_SHARE * (1 + 5 * GUILD_BOSS_HIT_PER_LEVEL));
    const capped = guildBossHitAtk(hp, none, GUILD_BOSS_HIT_LEVEL_CAP + 1).toNumber();
    expect(guildBossHitAtk(hp, none, 500).toNumber()).toBeCloseTo(capped);
    // A boss hit never takes a whole hero down at once.
    expect(capped).toBeLessThan(10_000 * 0.5);
    // Tough heroes still take the same share: the hit grows to get through their Defense.
    const def = new Decimal(3000);
    expect(defended(guildBossHitAtk(hp, def, 1), def).toNumber()).toBeCloseTo(10_000 * GUILD_BOSS_HIT_SHARE, 3);
  });

  it('stands in the lane with the guild\'s health left, shrunk by Elemental Studies', () => {
    const lane = guildBossLane(new Decimal(1000), new Decimal(400), 0.25);
    expect(lane.hp.toNumber()).toBeCloseTo(800);
    expect(lane.left.toNumber()).toBeCloseTo(480);
    // Knocking off all the lane health sends exactly what was left to the guild.
    expect(lane.damageFor(lane.left).toNumber()).toBe(600);
    expect(lane.damageFor(new Decimal(100)).toNumber()).toBe(125);
    expect(lane.damageFor(new Decimal(-5)).toNumber()).toBe(0);
  });

  it('without research the lane health is the guild health', () => {
    const lane = guildBossLane(new Decimal(5000), new Decimal(0), 0);
    expect(lane.left.toNumber()).toBe(5000);
    expect(lane.damageFor(new Decimal(1234.7)).toNumber()).toBe(1234);
    // An already-beaten boss has nothing left to take.
    expect(guildBossLane(new Decimal(100), new Decimal(150), 0).left.toNumber()).toBe(0);
  });
});
