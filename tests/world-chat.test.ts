import { describe, expect, it } from 'vitest';
import { ago, visibleMessages, type ChatMessage } from '../src/worldChat';

const msg = (id: number, user: string): ChatMessage => ({ id, user_id: user, username: user, body: `hi ${id}`, created_at: '2026-11-01T12:00:00Z' });

describe('all chat', () => {
  it('shows oldest first and hides muted players', () => {
    const newestFirst = [msg(3, 'a'), msg(2, 'b'), msg(1, 'a')];
    expect(visibleMessages(newestFirst, new Set()).map((m) => m.id)).toEqual([1, 2, 3]);
    expect(visibleMessages(newestFirst, new Set(['a'])).map((m) => m.id)).toEqual([2]);
  });
  it('says how long ago', () => {
    const t = Date.parse('2026-11-01T12:00:00Z');
    expect(ago('2026-11-01T12:00:00Z', t)).toBe('now');
    expect(ago('2026-11-01T11:15:00Z', t)).toBe('45m');
    expect(ago('2026-11-01T09:00:00Z', t)).toBe('3h');
    expect(ago('2026-10-30T12:00:00Z', t)).toBe('2d');
  });
});
