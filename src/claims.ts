/**
 * Goal Claim buttons (daily challenges on Home, Recruit Trials and achievements in the Shop).
 * One click listener on the whole panel area handles them all, so a list can live on any tab.
 * The daily list moved to the Home panel but the listener stayed on the Shop's #rewards,
 * so daily Claim buttons did nothing; only Claim all worked.
 */
export const CLAIM_ROOT = 'panels';

/** Lists whose rows carry a `data-claim="kind:id"` button. Each must sit inside CLAIM_ROOT. */
export const CLAIM_LISTS = ['daily-list', 'boot-list', 'ach-list'] as const;

export type ClaimKind = 'daily' | 'ach' | 'boot';

/** The goal a click asks to claim, or null when it missed an enabled Claim button. */
export function claimOf(target: EventTarget | null): { kind: ClaimKind; id: string } | null {
  const el = target as HTMLElement | null;
  const btn = el?.closest?.<HTMLButtonElement>('button[data-claim]');
  if (!btn || btn.disabled) return null;
  const [kind, id] = (btn.dataset.claim ?? '').split(':');
  if ((kind !== 'daily' && kind !== 'ach' && kind !== 'boot') || !id) return null;
  return { kind, id };
}
