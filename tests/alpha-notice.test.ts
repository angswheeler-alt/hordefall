import { describe, expect, it } from 'vitest';
import { ALPHA_NOTICE } from '../src/alphaNotice';

describe('alpha notice', () => {
  it('warns that progress may be reset before launch', () => {
    expect(ALPHA_NOTICE.title).toMatch(/alpha/i);
    expect(ALPHA_NOTICE.body).toMatch(/progress may be reset/i);
  });
});
