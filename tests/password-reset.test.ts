import { describe, expect, it } from 'vitest';
import { recoveryFromHash } from '../src/account';

describe('password reset links', () => {
  it('spots a reset link', () => {
    expect(recoveryFromHash('#access_token=abc&expires_in=3600&refresh_token=r&token_type=bearer&type=recovery')).toBe('link');
  });
  it('spots an expired or used link', () => {
    expect(recoveryFromHash('#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired')).toBe('expired');
  });
  it('ignores ordinary pages and other sign-in links', () => {
    expect(recoveryFromHash('')).toBeNull();
    expect(recoveryFromHash('#access_token=abc&type=signup')).toBeNull();
  });
});
