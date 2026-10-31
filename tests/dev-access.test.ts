import { describe, expect, it } from 'vitest';
import { devToolsAllowed } from '../src/devAccess';

describe('prototype tools access', () => {
  it('dev builds always get them', () => {
    expect(devToolsAllowed(true, false, false)).toBe(true);
  });
  it('a ?dev link alone is not enough', () => {
    expect(devToolsAllowed(false, true, false)).toBe(false);
  });
  it('a ?dev link opens them for a signed-in admin', () => {
    expect(devToolsAllowed(false, true, true)).toBe(true);
  });
  it('admins without ?dev play normally', () => {
    expect(devToolsAllowed(false, false, true)).toBe(false);
  });
});
