/** What a player must type before an account reset goes through. */
export const RESET_PHRASE = 'reset account';

/** True when the typed text matches the reset phrase (any capitals, extra spaces ignored). */
export function resetPhraseOk(text: string): boolean {
  return text.trim().replace(/\s+/g, ' ').toLowerCase() === RESET_PHRASE;
}
