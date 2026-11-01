import html from '../index.html?raw';
import { describe, expect, it } from 'vitest';
import { CLAIM_LISTS, CLAIM_ROOT, claimOf } from '../src/claims';

/** Ids of every element that encloses `id` in index.html, found with a small tag stack. */
function ancestorsOf(html: string, id: string): string[] {
  const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
  const stack: { tag: string; id: string }[] = [];
  const tagRe = /<\/?([a-zA-Z][\w-]*)([^>]*)>/g;
  for (let m; (m = tagRe.exec(html)); ) {
    const [whole, rawTag, attrs] = m;
    const tag = rawTag.toLowerCase();
    if (whole.startsWith('</')) {
      const at = stack.map((x) => x.tag).lastIndexOf(tag);
      if (at >= 0) stack.length = at;
      continue;
    }
    const own = /\sid="([^"]+)"/.exec(attrs)?.[1] ?? '';
    if (own === id) return stack.map((x) => x.id).filter(Boolean);
    if (!VOID.has(tag) && !attrs.trim().endsWith('/')) stack.push({ tag, id: own });
  }
  throw new Error(`#${id} not found in index.html`);
}

/** A button-like stand-in for closest(): the button itself, or null. */
const button = (claim: string, disabled = false) => {
  const btn = { dataset: { claim }, disabled, closest: (sel: string) => (sel === 'button[data-claim]' ? btn : null) };
  return btn as unknown as EventTarget;
};

describe('Goal Claim buttons', () => {
  it('every list with Claim buttons sits inside the element that listens for them', () => {
    for (const list of CLAIM_LISTS) expect(ancestorsOf(html, list), list).toContain(CLAIM_ROOT);
  });

  it('the Home daily challenges are covered (they were outside the old Shop-only listener)', () => {
    expect(ancestorsOf(html, 'daily-list')).toContain('home');
    expect(ancestorsOf(html, 'daily-list')).toContain(CLAIM_ROOT);
  });

  it('reads the goal from an enabled Claim button and ignores everything else', () => {
    expect(claimOf(button('daily:kills'))).toEqual({ kind: 'daily', id: 'kills' });
    expect(claimOf(button('ach:stage'))).toEqual({ kind: 'ach', id: 'stage' });
    expect(claimOf(button('boot:team3'))).toEqual({ kind: 'boot', id: 'team3' });
    expect(claimOf(button('daily:kills', true))).toBeNull();
    expect(claimOf(button('junk'))).toBeNull();
    expect(claimOf(null)).toBeNull();
  });
});
