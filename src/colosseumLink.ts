import type { SupabaseClient } from '@supabase/supabase-js';
import type { Account } from './account';
import { cleanSnapHero, type GameState, type PvpCandidate, type PvpSnapHero } from './state';
import { RANK_TROPHIES, LEGEND, rankIndex } from './colosseum';

// The Colosseum's server side (supabase/colosseum.sql): uploads this player's defense team,
// finds real players in the same rank to fight, and keeps the defense log and leaderboard.
// Without an account, or before the SQL has been run, the Colosseum uses Ghosts only.

/** How often a signed-in game uploads its defense team (only when it changed, or every 10 minutes). */
const REPORT_SECONDS = 60;
const REPORT_ANYWAY_MS = 10 * 60_000;

/** A server that hasn't had colosseum.sql run yet. */
const missingServer = (message: string) => /does not exist|schema cache|PGRST20[0-9]|42883|42P01/i.test(message);

export interface ColosseumBoard {
  top: Array<{ rank: number; username: string; trophies: number; isMe: boolean }>;
  log: Array<{ attacker: string; attackerWon: boolean; at: string }>;
}

export class ColosseumLink {
  private lastReport = '';
  private lastReportAt = 0;
  /** True once the server says colosseum.sql hasn't been run. */
  serverMissing = false;

  constructor(
    private state: GameState,
    private account: Account,
  ) {
    account.listeners.push(() => void this.report());
    setInterval(() => void this.report(), REPORT_SECONDS * 1000);
  }

  private get db(): SupabaseClient | null {
    return this.account.userId && !this.serverMissing ? this.account.client : null;
  }

  /** Whether real opponents can be looked for: signed in and the server is set up. */
  get online(): boolean {
    return !!this.db;
  }

  private failed(message: string) {
    if (missingServer(message)) this.serverMissing = true;
  }

  /** Upload the defense team when it changed (or now and then anyway). */
  async report(force = false) {
    const db = this.db;
    if (!db || !this.state.pvpOpen()) return;
    const payload = this.state.pvpSnapshot();
    if (!payload.p_team.length) return;
    const key = JSON.stringify(payload);
    if (!force && key === this.lastReport && Date.now() - this.lastReportAt < REPORT_ANYWAY_MS) return;
    const { error } = await db.rpc('save_colosseum_team', payload);
    if (error) return this.failed(error.message);
    this.lastReport = key;
    this.lastReportAt = Date.now();
  }

  /** Real players in this player's rank, closest in power first. Empty when offline or on any error. */
  async candidates(): Promise<PvpCandidate[]> {
    const db = this.db;
    if (!db) return [];
    void this.report();
    const s = this.state;
    const r = rankIndex(s.pvp.trophies);
    const cp = s.teamCpOf(s.pvpAttackTeam());
    const { data, error } = await db.rpc('colosseum_opponents', {
      p_min: RANK_TROPHIES[r],
      p_max: r < LEGEND ? RANK_TROPHIES[r + 1] : 1_000_000,
      p_cp_log: cp.gt(1) ? cp.log10() : 0,
    });
    if (error) {
      this.failed(error.message);
      return [];
    }
    const out: PvpCandidate[] = [];
    for (const row of (data ?? []) as Array<{ user_id: string; username: string; team_cp: string; team: unknown }>) {
      if (row.user_id === this.account.userId || typeof row.team_cp !== 'string' || !/^[0-9.e+]{1,40}$/.test(row.team_cp)) continue;
      const team = (Array.isArray(row.team) ? row.team : []).map(cleanSnapHero).filter((x): x is PvpSnapHero => !!x).slice(0, 10);
      if (team.length) out.push({ userId: row.user_id, name: String(row.username ?? 'Player').slice(0, 24), cp: row.team_cp, team });
    }
    return out;
  }

  /** Tell the defender how a fight against their team went (for their defense log). */
  async reportFight(defender: string, attackerWon: boolean) {
    const db = this.db;
    if (!db) return;
    const { error } = await db.rpc('report_colosseum_fight', { p_defender: defender, p_attacker_won: attackerWon });
    if (error) this.failed(error.message);
  }

  /** The top players by trophies and this player's defense log, or null when offline. */
  async board(): Promise<ColosseumBoard | null> {
    const db = this.db;
    if (!db) return null;
    void this.report(true);
    const [top, log] = await Promise.all([db.rpc('colosseum_board'), db.rpc('my_colosseum_log')]);
    if (top.error || log.error) {
      this.failed((top.error ?? log.error)!.message);
      return null;
    }
    return {
      top: ((top.data ?? []) as Array<{ rank: number; username: string; trophies: number; is_me: boolean }>).map((r) => ({ rank: Number(r.rank), username: String(r.username), trophies: Number(r.trophies), isMe: !!r.is_me })),
      log: ((log.data ?? []) as Array<{ attacker_name: string; attacker_won: boolean; created_at: string }>).map((r) => ({ attacker: String(r.attacker_name), attackerWon: !!r.attacker_won, at: String(r.created_at) })),
    };
  }
}
