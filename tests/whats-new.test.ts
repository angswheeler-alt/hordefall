import { beforeEach, describe, expect, it } from 'vitest';
import { GameState } from '../src/state';
import { WHATS_NEW, WHATS_NEW_MAX_CHARS, WHATS_NEW_SHOWN, allWhatsNewIds, unseenWhatsNew, whatsNewLines } from '../src/whatsNew';

beforeEach(() => localStorage.clear());

describe("What's new list", () => {
  it('has unique, kebab-case ids', () => {
    const ids = allWhatsNewIds();
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('is newest first with real dates', () => {
    for (const e of WHATS_NEW) expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (let i = 1; i < WHATS_NEW.length; i++) expect(WHATS_NEW[i - 1].date >= WHATS_NEW[i].date).toBe(true);
  });

  it('keeps every line short and plain (only <b>)', () => {
    for (const e of WHATS_NEW) {
      expect(e.text.replace(/<\/?b>/g, '').length).toBeLessThanOrEqual(WHATS_NEW_MAX_CHARS);
      expect(e.text.replace(/<\/?b>/g, '')).not.toMatch(/[<>]/);
    }
  });
});

describe("What's new for a player", () => {
  it('a brand-new game has seen everything', () => {
    const s = new GameState();
    expect(whatsNewLines(s.whatsNewSeen)).toEqual([]);
  });

  it('a save from before the list sees every entry, once', () => {
    const s = new GameState();
    const data = s.toJSON();
    delete data.whatsNewSeen;
    GameState.writeLocal(data);
    const loaded = new GameState();
    loaded.load();
    expect(unseenWhatsNew(loaded.whatsNewSeen)).toHaveLength(WHATS_NEW.length);
    loaded.markWhatsNewSeen();
    loaded.save();
    const again = new GameState();
    again.load();
    expect(whatsNewLines(again.whatsNewSeen)).toEqual([]);
  });

  it('only shows entries added since the last visit', () => {
    const seen = allWhatsNewIds().slice(1);
    expect(unseenWhatsNew(seen).map((e) => e.id)).toEqual([WHATS_NEW[0].id]);
  });

  it(`caps the pop-up at ${WHATS_NEW_SHOWN} lines plus "and N more"`, () => {
    const extra = Array.from({ length: WHATS_NEW_SHOWN + 3 }, (_, i) => ({ id: `x-${i}`, date: '2099-01-01', text: `Thing ${i}` }));
    WHATS_NEW.unshift(...extra);
    try {
      const lines = whatsNewLines([]);
      expect(lines).toHaveLength(WHATS_NEW_SHOWN + 1);
      expect(lines[lines.length - 1]).toContain(`${WHATS_NEW.length - WHATS_NEW_SHOWN} more`);
    } finally {
      WHATS_NEW.splice(0, extra.length);
    }
  });
});
