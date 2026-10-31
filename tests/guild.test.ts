import { describe, expect, it } from 'vitest';
import { isAscendant } from '../src/heroes/ascendant';
import sql from '../supabase/guilds.sql?raw';
import { HEROES, RELEASED_HEROES, GUILD_REQUEST_GOAL, GUILD_REQUEST_HOURS, GUILD_REQUEST_OPEN_HOURS } from '../src/data';

describe('guild medal requests', () => {
  it('lets the server accept exactly the released Common heroes', () => {
    const body = sql.match(/function public\.guild_requestable_heroes\(\)[\s\S]*?array\[([\s\S]*?)\]/)![1];
    const serverIds = [...body.matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
    const commons = HEROES.filter((h) => h.rarity === 'common' && RELEASED_HEROES.includes(h.id) && !isAscendant(h.id)).map((h) => h.id).sort();
    expect(serverIds).toEqual(commons);
  });

  it('caps a player at 10 medals every 4 hours, matching the server', () => {
    expect(GUILD_REQUEST_GOAL).toBe(10);
    expect(GUILD_REQUEST_HOURS).toBe(4);
    // A request closes before the next one can open, so two can't fill at once.
    expect(GUILD_REQUEST_OPEN_HOURS).toBeLessThanOrEqual(GUILD_REQUEST_HOURS);
    expect(sql).toMatch(/public\.guild_username\(\), p_hero, 10\)/);
    expect(sql.match(/interval '4 hours'/g)?.length).toBe(2);
  });
});
