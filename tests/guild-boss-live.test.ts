import { describe, expect, it } from 'vitest';
import Decimal from 'break_infinity.js';
import { guildBossHitAtk, guildBossLane, defended, GUILD_BOSS_KILL_MARGIN } from '../src/formulas';
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
    // Knocking off all the lane health sends what was left plus a tiny overshoot, so the guild surely sees the kill.
    expect(lane.damageFor(lane.left).toNumber()).toBe(601);
    expect(lane.damageFor(new Decimal(100)).toNumber()).toBe(125);
    expect(lane.damageFor(new Decimal(-5)).toNumber()).toBe(0);
  });

  it('without research the lane health is the guild health', () => {
    const lane = guildBossLane(new Decimal(5000), new Decimal(0), 0);
    expect(lane.left.toNumber()).toBe(5000);
    expect(lane.damageFor(new Decimal(1234.7)).toNumber()).toBe(1234);
    // A boss the game rounds to "beaten" still shows a sliver, so the next fight can finish it.
    const crumb = guildBossLane(new Decimal(100), new Decimal(150), 0);
    expect(crumb.left.toNumber()).toBeCloseTo(100 * GUILD_BOSS_KILL_MARGIN);
    expect(crumb.damageFor(crumb.left).toNumber()).toBe(1);
  });

  // The server keeps the boss health exactly; the game's numbers keep ~16 digits. Read a sent damage string exactly.
  const exact = (s: string) => {
    const [m, e = '0'] = s.split('e');
    const [int, frac = ''] = m.split('.');
    const shift = Number(e) - frac.length;
    const digits = BigInt(int + frac);
    return shift >= 0 ? digits * 10n ** BigInt(shift) : digits / 10n ** BigInt(-shift);
  };

  it('a killing blow beats the exact server health on every level, even after earlier fights', () => {
    for (let level = 2; level <= 120; level += 2) {
      const hp = 432000n * BigInt(level) * 2n ** BigInt(1.5 * level); // guild_boss_hp for even levels
      for (const part of [0, 1, 3, 7, 13]) {
        // Some earlier fights took `part` sixteenths, stored exactly by the server.
        const done = (hp * BigInt(part)) / 16n + 12345n;
        const lane = guildBossLane(new Decimal(Number(hp)), new Decimal(Number(done)), 0.4);
        const sent = exact(lane.damageFor(lane.left).toString());
        expect(done + sent >= hp, `level ${level}, ${part}/16 done`).toBe(true);
        // and it doesn't overshoot by more than a crumb
        expect(sent - (hp - done) < hp / 100000n).toBe(true);
      }
    }
  });

  it('a boss left with a crumb by older games can be finished', () => {
    const hp = 432000n * 52n * 2n ** 78n;
    const done = hp - 10n ** 12n; // the server's few-trillion crumb, invisible next to ~6.8e30
    const lane = guildBossLane(new Decimal(Number(hp)), new Decimal(Number(done)), 0);
    expect(lane.left.gt(0)).toBe(true);
    expect(done + exact(lane.damageFor(lane.left).toString()) >= hp).toBe(true);
  });
});
