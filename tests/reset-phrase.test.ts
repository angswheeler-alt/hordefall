import { describe, expect, it } from 'vitest';
import { RESET_PHRASE, resetPhraseOk } from '../src/resetPhrase';

describe('account reset phrase', () => {
  it('accepts the phrase with any capitals or spacing', () => {
    expect(resetPhraseOk(RESET_PHRASE)).toBe(true);
    expect(resetPhraseOk('RESET ACCOUNT')).toBe(true);
    expect(resetPhraseOk('  Reset   account ')).toBe(true);
  });
  it('refuses anything else', () => {
    for (const text of ['', 'reset', 'account', 'reset acount', 'resetaccount', 'reset account now']) expect(resetPhraseOk(text)).toBe(false);
  });
});
