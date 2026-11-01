/**
 * The Observatory (GDD section 8): a personal star chart that opens after the first Rekindle.
 * Sigils come from Rekindles (1 each) and player levels (1 per SIGIL_LEVEL_STEP levels past 1), so older saves get
 * theirs at once. Sigils buy ranks in five constellations, each a small permanent buff. A
 * constellation can be switched off for free (its Sigils stay in it); taking every Sigil back
 * costs OBSERVATORY_RESPEC_GEMS. Never pays Gems.
 */

export type ObsBranch = 'embers' | 'speed' | 'offline' | 'tickets' | 'skip';

export interface ObsDef {
  id: ObsBranch;
  name: string;
  /** Star colour on the chart. */
  color: string;
  /** Effect per rank (a share, or whole tickets for 'tickets'). */
  per: number;
  max: number;
  /** What `rank` ranks do, in words. */
  text: (rank: number) => string;
}

const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;

export const OBSERVATORY: ObsDef[] = [
  { id: 'embers', name: 'Ember Lens', color: '#5aa8ff', per: 0.1, max: 20, text: (r) => `+${pct(0.1 * r)} Embers from every Rekindle` },
  { id: 'speed', name: 'Swift Comet', color: '#6be08a', per: 0.025, max: 10, text: (r) => `+${pct(0.025 * r)} battle speed` },
  { id: 'offline', name: 'Dreaming Moon', color: '#ffd34a', per: 0.05, max: 10, text: (r) => `+${pct(0.05 * r)} offline progress (gold and stages)` },
  { id: 'tickets', name: 'Pilgrim Star', color: '#b77dff', per: 1, max: 10, text: (r) => `+${r} Trial ticket cap` },
  { id: 'skip', name: 'Leaping Star', color: '#ff8a5a', per: 0.01, max: 10, text: (r) => `${pct(0.01 * r)} chance to skip the next stage (never a boss)` },
];

export const OBSERVATORY_RESPEC_GEMS = 30;

export function obsDef(id: ObsBranch): ObsDef {
  return OBSERVATORY.find((d) => d.id === id)!;
}

/**
 * Rank N costs SIGIL_COST_STEP x N Sigils, and player levels pay 1 Sigil per SIGIL_LEVEL_STEP levels
 * (Samuel, 2026-11-01: maxed too fast at 1x and 1 per level; a full chart is now 1,290 Sigils).
 */
export const SIGIL_COST_STEP = 3;
export const SIGIL_LEVEL_STEP = 3;

/** Sigils to raise a constellation from `rank` to `rank + 1`. */
export function sigilCost(rank: number): number {
  return SIGIL_COST_STEP * (rank + 1);
}

/** Sigils spent to reach `rank` from 0. */
export function sigilsSpent(rank: number): number {
  return (SIGIL_COST_STEP * rank * (rank + 1)) / 2;
}

/** Sigils earned so far: one per Rekindle and one per SIGIL_LEVEL_STEP player levels past 1. */
export function sigilsEarned(rekindles: number, playerLevel: number): number {
  return Math.max(0, Math.floor(rekindles)) + Math.floor(Math.max(0, Math.floor(playerLevel) - 1) / SIGIL_LEVEL_STEP);
}

/** Ranks from a save, kept to known constellations and their caps. */
export function cleanObservatory(v: unknown): Partial<Record<ObsBranch, number>> {
  const out: Partial<Record<ObsBranch, number>> = {};
  if (!v || typeof v !== 'object') return out;
  for (const d of OBSERVATORY) {
    const r = Math.floor(Number((v as Record<string, unknown>)[d.id]) || 0);
    if (r > 0) out[d.id] = Math.min(d.max, r);
  }
  return out;
}

export function cleanObsOff(v: unknown): ObsBranch[] {
  return Array.isArray(v) ? OBSERVATORY.map((d) => d.id).filter((id) => v.includes(id)) : [];
}
