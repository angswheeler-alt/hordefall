import { describe, expect, it } from 'vitest';
import sql from '../supabase/guilds.sql?raw';
import { guildBossFightWait, utcWeekStart, guildBossElement } from '../src/formulas';
import { GUILD_BOSS_ATTEMPTS, GUILD_BOSS_FIGHT_GAP_SECONDS, GUILD_BOSS_REST_MINUTES } from '../src/data';

describe('Guild Boss week', () => {
  it('the game and the server agree on the fight gap, the rest and the paid fights', () => {
    const hit = sql.slice(sql.indexOf('create or replace function public.hit_guild_boss'));
    expect(hit).toContain(`interval '${GUILD_BOSS_FIGHT_GAP_SECONDS / 60} minutes'`);
    expect(hit).toContain(`interval '${GUILD_BOSS_REST_MINUTES} minutes'`);
    expect(hit).toContain(`paid := used < ${GUILD_BOSS_ATTEMPTS};`);
    // No daily cap on fights any more.
    expect(hit).not.toContain('No attempts left');
  });

  it('waits out the rest first, then the player\'s own fight gap', () => {
    const now = 1_000_000_000_000;
    expect(guildBossFightWait(null, null, now)).toEqual({ kind: 'ready' });
    expect(guildBossFightWait(now + 90_000, now - 10_000, now)).toEqual({ kind: 'resting', ms: 90_000 });
    expect(guildBossFightWait(now - 1, now - 10_000, now)).toEqual({ kind: 'cooldown', ms: GUILD_BOSS_FIGHT_GAP_SECONDS * 1000 - 10_000 });
    expect(guildBossFightWait(null, now - GUILD_BOSS_FIGHT_GAP_SECONDS * 1000, now)).toEqual({ kind: 'ready' });
  });

  it('weeks start Monday 00:00 UTC, like the server', () => {
    expect(utcWeekStart(Date.parse('2026-10-26T00:00:00Z'))).toBe('2026-10-26');
    expect(utcWeekStart(Date.parse('2026-10-25T23:59:59Z'))).toBe('2026-10-19');
    expect(utcWeekStart(Date.parse('2026-11-01T12:00:00Z'))).toBe('2026-10-26');
    expect(guildBossElement('2026-10-26')).toBe('light');
  });
});

describe('Guild Boss weeks start near last week\'s best (2026-11-01)', () => {
  it('starts 10 levels below last week\'s best, never below 1', async () => {
    const { guildBossStartLevel } = await import('../src/formulas');
    expect(guildBossStartLevel(0)).toBe(1);
    expect(guildBossStartLevel(8)).toBe(1);
    expect(guildBossStartLevel(11)).toBe(1);
    expect(guildBossStartLevel(12)).toBe(2);
    expect(guildBossStartLevel(115)).toBe(105);
  });

  it('weekly chests count levels beaten that week, coins the top level', async () => {
    const { guildBossWeekReward } = await import('../src/formulas');
    expect(guildBossWeekReward(115, 6)).toEqual({ coins: 1250, chests: 2 });
    expect(guildBossWeekReward(115, 0)).toEqual({ coins: 0, chests: 0 });
    expect(guildBossWeekReward(30)).toEqual({ coins: 400, chests: 10 });
  });

  it('Ascendant crests follow the level\'s place in the week, not its number', async () => {
    const { GameState } = await import('../src/state');
    const { GUILD_BOSS_ASC_CRESTS } = await import('../src/data');
    const s = new GameState();
    const got = s.payGuildBossRewards([{ week: '2026-10-19', level: 101, n: 1 }, { week: '2026-10-19', level: 120, n: 20 }, { week: '2026-10-19', level: 121, n: 21 }], []);
    expect(got.ascendant.reduce((t, a) => t + a.crests, 0)).toBe(2 * GUILD_BOSS_ASC_CRESTS);
    const old = s.payGuildBossRewards([{ week: '2026-10-19', level: 21 }], []);
    expect(old.ascendant.length).toBe(0);
  });
});

describe('guilds.sql starts the week near last week\'s best', () => {
  it('guild_boss_week sets level and start_level from last week, and rewards send n and beaten', () => {
    const fn = sql.slice(sql.indexOf('create or replace function public.guild_boss_week()'));
    expect(fn).toContain("coalesce(max(b.level) - 1, 0) - 10");
    expect(fn).toContain('values (g, wk, public.guild_boss_element(wk), start, start, public.guild_boss_hp(start))');
    expect(sql).toContain("'n', k.level - b.start_level + 1");
    expect(sql).toContain("'beaten', b.level - b.start_level");
  });
});
