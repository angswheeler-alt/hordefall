/**
 * Mailbox gifts (user, 2026-11-13). A gift with `existingOnly` goes to players whose save existed before the
 * update that added it: a brand-new save marks it 'none' at birth (GameState constructor), an older save
 * that loads without it marks it 'open'. Each gift can be claimed once per save.
 */
export type MailState = 'open' | 'claimed' | 'none';

export interface MailGift {
  id: string;
  title: string;
  text: string;
  /** A hero given at 1★ (already owned: PASTA-style unlock crests instead). */
  hero: string;
  existingOnly: boolean;
}

export const MAIL_GIFTS: MailGift[] = [
  {
    id: 'pasta-launch',
    title: 'Thank you for playing!',
    text: 'A gift for everyone who was here before Pasta arrived: Pasta himself, at 1★.',
    hero: 'pasta',
    existingOnly: true,
  },
];

/** Mail states for a brand-new save: gifts for existing players are not theirs. */
export function newSaveMail(): Record<string, MailState> {
  return Object.fromEntries(MAIL_GIFTS.filter((g) => g.existingOnly).map((g) => [g.id, 'none' as MailState]));
}

/** Mail states for a loaded save: keep what it had, and open every existing-player gift it has never seen. */
export function loadedMail(saved: unknown): Record<string, MailState> {
  const out: Record<string, MailState> = {};
  if (saved && typeof saved === 'object') {
    for (const [id, v] of Object.entries(saved as Record<string, unknown>)) if (v === 'open' || v === 'claimed' || v === 'none') out[id] = v;
  }
  for (const g of MAIL_GIFTS) if (g.existingOnly && !(g.id in out)) out[g.id] = 'open';
  return out;
}
