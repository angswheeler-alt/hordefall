import { describe, it, expect } from 'vitest';
import sql from '../supabase/reports.sql?raw';
import { reportQuestion } from '../src/report';

describe('player reports', () => {
  it('asks before reporting, naming the player', () => {
    expect(reportQuestion('chat', 'grumpy')).toMatch(/message from grumpy/);
    expect(reportQuestion('name', 'grumpy')).toMatch(/"grumpy"/);
  });

  it('only signed-in players report, only admins read or close', () => {
    expect(sql).toMatch(/revoke all on function public\.report_player\(text, bigint, uuid\) from public, anon;/);
    expect(sql).toMatch(/revoke all on function public\.report_name_of\(uuid\) from public, anon, authenticated;/);
    expect(sql).toMatch(/revoke all on function public\.admin_player_reports\(\), public\.admin_close_report\(bigint, boolean\) from public, anon;/);
    expect(sql).toMatch(/alter table public\.player_reports enable row level security/);
    for (const fn of ['admin_player_reports', 'admin_close_report']) expect(sql).toMatch(new RegExp(`function public\\.${fn}[\\s\\S]*?save_admins`));
  });

  it('copies the reported message on the server, and guild messages only from your own guild', () => {
    const body = sql.slice(sql.indexOf('function public.report_player'));
    expect(body).toMatch(/from world_messages w where w\.id = p_message/);
    expect(body).toMatch(/g\.guild_id = \(select m\.guild_id from guild_members m where m\.user_id = me\)/);
  });
});
