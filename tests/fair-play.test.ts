import { describe, it, expect } from 'vitest';
import social from '../supabase/social.sql?raw';
import colosseum from '../supabase/colosseum.sql?raw';

/** Every function the SQL file creates, with its argument types as Postgres names them. */
function functions(sql: string): string[] {
  return [...sql.matchAll(/create or replace function public\.(\w+)\(([^)]*)\)/g)].map((m) => m[1]);
}

describe('fair play checks on the server', () => {
  it('save_profile caps best stage, Rekindles and Combat Power', () => {
    const body = social.slice(social.indexOf('function public.save_profile'));
    expect(body).toMatch(/fair_stage_cap/);
    expect(body).toMatch(/cap_rk/);
    expect(body).toMatch(/fair_cp_cap/);
  });

  it('save_colosseum_team caps trophies', () => {
    expect(colosseum.slice(colosseum.indexOf('function public.save_colosseum_team'))).toMatch(/tro > cap/);
  });

  it('players cannot call the fair-play helpers or read the notes', () => {
    for (const fn of ['fair_stage_cap', 'fair_cp_cap', 'fair_flag', 'fair_minutes']) {
      expect(functions(social)).toContain(fn);
      expect(social).toMatch(new RegExp(`revoke all on function public\\.${fn}\\([^)]*\\) from public, anon, authenticated;`));
    }
    expect(social).toMatch(/alter table public\.fair_play_flags enable row level security/);
    expect(social).toMatch(/function public\.admin_fair_play_flags[\s\S]*?save_admins/);
  });
});
