/**
 * Reporting a player to the admin (supabase/reports.sql): a message in all chat or guild
 * chat, or a username on the leaderboards. The server copies the message itself; admins
 * read reports on admin.html.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type ReportKind = 'chat' | 'guild' | 'name';

/** The question asked before a report goes out. */
export function reportQuestion(kind: ReportKind, name: string): string {
  return kind === 'name'
    ? `Report the name "${name}" to the game admin as rude or offensive?`
    : `Report this message from ${name} to the game admin? Use this for rude, hateful or spam messages.`;
}

/** Send a report; returns what to tell the player. */
export async function sendReport(db: SupabaseClient, kind: ReportKind, target: { message?: number; user?: string }): Promise<{ ok: boolean; text: string }> {
  const { error } = await db.rpc('report_player', { p_kind: kind, p_message: target.message ?? null, p_user: target.user ?? null });
  if (!error) return { ok: true, text: 'Thanks. The report was sent to the admin.' };
  if (/does not exist|schema cache|PGRST20[0-9]|42883|42P01/i.test(error.message)) return { ok: false, text: 'Reports aren\'t set up on the server yet (supabase/reports.sql needs to be run once).' };
  return { ok: false, text: error.message };
}
