import { describe, expect, it } from 'vitest';
import { GameState } from '../src/state';
import { HEROES } from '../src/data';
import { MOB_KINDS, MOB_ELEMENTS } from '../src/mobs';
import {
  JOURNAL_PAGES,
  JOURNAL_TIERS,
  SHINY_GEMS,
  SHINY_ODDS,
  SHINY_PER_DAY,
  STAMP_BONUS,
  TIER_BONUS,
  bossPageId,
  cleanJournal,
  cleanStamps,
  guildPageId,
  isShinyRoll,
  journalBonus,
  journalPage,
  journalTier,
  mobPageId,
  nextTierAt,
  shinyTreasure,
  trialPageId,
} from '../src/journal';

function fresh() {
  GameState.frozen = false;
  localStorage.clear();
  return new GameState();
}

const NOON = new Date(2026, 10, 3, 12).getTime();
const NEXT_DAY = new Date(2026, 10, 4, 12).getTime();

describe('Hunting Journal pages', () => {
  it('has a page for every mob kind in every element, plus 15 bosses', () => {
    const mobs = JOURNAL_PAGES.filter((p) => p.group === 'mob');
    expect(mobs).toHaveLength(Object.keys(MOB_KINDS).length * MOB_ELEMENTS.length);
    expect(mobs).toHaveLength(45);
    for (const kind of Object.keys(MOB_KINDS)) for (const el of MOB_ELEMENTS) expect(journalPage(mobPageId(kind as never, el))).toBeTruthy();
    expect(JOURNAL_PAGES.filter((p) => p.group === 'boss')).toHaveLength(5);
    expect(JOURNAL_PAGES.filter((p) => p.group === 'trial')).toHaveLength(5);
    expect(JOURNAL_PAGES.filter((p) => p.group === 'guild')).toHaveLength(5);
    expect(new Set(JOURNAL_PAGES.map((p) => p.id)).size).toBe(65);
  });

  it('mobs use 100 / 1,000 / 10,000 and tiers grow the bonus', () => {
    expect(JOURNAL_TIERS.mob).toEqual([100, 1000, 10000]);
    const page = journalPage(mobPageId('grunt', 'fire'))!;
    expect(journalTier(page, 99)).toBe(0);
    expect(journalTier(page, 100)).toBe(1);
    expect(journalTier(page, 9999)).toBe(2);
    expect(journalTier(page, 10000)).toBe(3);
    expect(nextTierAt(page, 0)).toBe(100);
    expect(nextTierAt(page, 100)).toBe(1000);
    expect(nextTierAt(page, 10000)).toBeNull();
    expect(journalBonus(page, 0, false)).toBe(0);
    expect(journalBonus(page, 100, false)).toBe(TIER_BONUS[0]);
    expect(journalBonus(page, 10000, true)).toBeCloseTo(TIER_BONUS[2] + STAMP_BONUS);
    expect(TIER_BONUS[0]).toBeLessThan(TIER_BONUS[1]);
    expect(TIER_BONUS[1]).toBeLessThan(TIER_BONUS[2]);
  });

  it('boss pages use smaller tiers than mobs', () => {
    for (const g of ['boss', 'trial', 'guild'] as const) expect(JOURNAL_TIERS[g][2]).toBeLessThan(JOURNAL_TIERS.mob[2]);
  });
});

describe('Hunting Journal in the save', () => {
  it('counts kills, reports a crossed tier once, and raises the damage multiplier', () => {
    const s = fresh();
    const id = mobPageId('brute', 'water');
    expect(s.journalMult(id)).toBe(1);
    expect(s.journalAdd(id, 99)).toBe(0);
    expect(s.journalAdd(id)).toBe(1);
    expect(s.journalNews).toEqual({ pageId: id, tier: 1 });
    expect(s.journalAdd(id)).toBe(0);
    expect(s.journalKills(id)).toBe(101);
    expect(s.journalMult(id)).toBeCloseTo(1 + TIER_BONUS[0]);
    // Other pages and unknown enemies are untouched.
    expect(s.journalMult(mobPageId('brute', 'fire'))).toBe(1);
    expect(s.journalMult(undefined)).toBe(1);
    expect(s.journalAdd('nope')).toBe(0);
  });

  it('a won Trial counts on its Trial boss page (Quick wins too), a loss does not', () => {
    const s = fresh();
    s.bestStage = 51;
    const el = s.openTrials()[0];
    for (const h of HEROES) if (h.element === el) s.levels[h.id] = 1;
    for (const h of HEROES) s.emberLevels[h.id] = 500;
    s.finishTrial(el, 1, false, 30);
    expect(s.journalKills(trialPageId(el))).toBe(0);
    s.finishTrial(el, 1, true, 8);
    expect(s.journalKills(trialPageId(el))).toBe(1);
    expect(s.quickTrial(el, 1)).toBeTruthy();
    expect(s.journalKills(trialPageId(el))).toBe(2);
  });

  it('saves and loads kills and stamps, dropping unknown pages', () => {
    const s = fresh();
    s.journalAdd(bossPageId('fire'), 12);
    s.journalAdd(guildPageId('dark'), 3);
    s.journalStamps = [mobPageId('grunt', 'earth')];
    s.save();
    const t = new GameState();
    t.load();
    expect(t.journalKills(bossPageId('fire'))).toBe(12);
    expect(t.journalKills(guildPageId('dark'))).toBe(3);
    expect(t.journalStamps).toEqual([mobPageId('grunt', 'earth')]);
    expect(cleanJournal({ boss_fire: 4.7, made_up: 9, mob_grunt_fire: -3 })).toEqual({ boss_fire: 4 });
    // Only mob pages take stamps.
    expect(cleanStamps([mobPageId('caster', 'light'), 'boss_fire', mobPageId('caster', 'light'), 5])).toEqual([mobPageId('caster', 'light')]);
  });
});

describe('Shinies', () => {
  it('about 1 in 2,000 spawns, and none once the daily cap is reached', () => {
    expect(SHINY_ODDS).toBe(2000);
    expect(isShinyRoll(0, 0)).toBe(true);
    expect(isShinyRoll(1 / SHINY_ODDS - 1e-9, 0)).toBe(true);
    expect(isShinyRoll(1 / SHINY_ODDS, 0)).toBe(false);
    expect(isShinyRoll(0, SHINY_PER_DAY)).toBe(false);
    expect(shinyTreasure(0)).toBe('chest');
    expect(shinyTreasure(0.99)).toBe('gems');
  });

  it('a beaten shiny stamps its page once and pays Gems or a Hero Chest', () => {
    const s = fresh();
    const id = mobPageId('scuttler', 'dark');
    const gems = s.gems;
    const a = s.catchShiny(id, 0.99, NOON)!;
    expect(a).toEqual({ gems: SHINY_GEMS, chest: false, stamped: true });
    expect(s.gems).toBe(gems + SHINY_GEMS);
    expect(s.journalStamps).toEqual([id]);
    expect(s.journalMult(id)).toBeCloseTo(1 + STAMP_BONUS);
    const b = s.catchShiny(id, 0, NOON)!;
    expect(b.chest).toBe(true);
    expect(b.stamped).toBe(false);
    expect(s.gems).toBe(gems + SHINY_GEMS);
    expect(s.shinyDrops?.length).toBeGreaterThan(0);
    expect(s.journalStamps).toEqual([id]);
    // Bosses never have shinies.
    expect(s.catchShiny(bossPageId('fire'), 0.99, NOON)).toBeNull();
  });

  it('stops paying after the daily cap and starts again the next day', () => {
    const s = fresh();
    const id = mobPageId('grunt', 'water');
    for (let i = 0; i < SHINY_PER_DAY; i++) expect(s.catchShiny(id, 0.99, NOON)).not.toBeNull();
    expect(s.shiniesToday(NOON)).toBe(SHINY_PER_DAY);
    expect(s.rollShiny(0, NOON)).toBe(false);
    expect(s.catchShiny(id, 0.99, NOON)).toBeNull();
    expect(s.rollShiny(0, NEXT_DAY)).toBe(true);
    expect(s.catchShiny(id, 0.99, NEXT_DAY)).not.toBeNull();
  });
});
