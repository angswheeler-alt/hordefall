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
