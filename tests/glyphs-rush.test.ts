import { describe, expect, it } from 'vitest';
import { GameState } from '../src/state';
import { HEROES } from '../src/data';
import { keeperThreshold } from '../src/formulas';
import {
  GLYPH_BAG_CAP, GLYPH_FAMILY_INFO, GLYPH_MAX_LEVEL, GLYPH_SUB_COUNT, chestStar, cleanGlyph, glyphDustSpent, glyphLevelCost, glyphMain, glyphSalvage, glyphSets, glyphTotals, rollGlyph, type Glyph,
} from '../src/glyphs';
import {
  RUSH_DAILY_TICKETS, RUSH_FIGHT_TICKETS, RUSH_FREE_HOURS, RUSH_START_TICKETS, RUSH_STREAK_UP, RUSH_TIERS, RUSH_UNLOCK_LEVEL, cleanRush, freeAttacks, inBracket, rushLevelMult, rushWinPoints,
} from '../src/rush';
import { fullReward } from '../src/scouting';

const HOUR = 3600 * 1000;
const at = (m: number, d: number, h = 12) => new Date(2026, m - 1, d, h).getTime();

function fresh() {
  GameState.frozen = false;
  localStorage.clear();
  return new GameState();
}

/** Player level 15 with every hero recruited. */
function veteran() {
  const s = fresh();
  s.lifetimeEmbers = keeperThreshold(Math.max(RUSH_UNLOCK_LEVEL, 15) - 1);
  for (const h of HEROES) s.levels[h.id] = 1;
  return s;
}

const starter = () => HEROES.find((x) => x.unlockCost === 0)!;

describe('glyph rules', () => {
  it('doubles the main stat from +0 to max level', () => {
    const g = { family: 'attack' as const, star: 6, level: 0 };
    expect(glyphMain(g)).toEqual({ stat: 'atk', value: 0.3 });
    expect(glyphMain({ ...g, level: GLYPH_MAX_LEVEL }).value).toBeCloseTo(0.6);
    expect(glyphMain({ family: 'crit', star: 1, level: 0 })).toEqual({ stat: 'crit', value: 0.01 });
  });

  it('rolls the same Glyph from the same seed, with the star\'s number of extra stats', () => {
    const a = rollGlyph('x1', 5);
    expect(rollGlyph('x1', 5)).toEqual(a);
    for (let star = 1; star <= 6; star++) {
      const g = rollGlyph(`s${star}`, star);
      expect(g.subs.length).toBe(GLYPH_SUB_COUNT[star - 1]);
      // Extra stats never repeat and never copy the main stat.
      const stats = g.subs.map(([k]) => k);
      expect(new Set(stats).size).toBe(stats.length);
      expect(stats).not.toContain(GLYPH_FAMILY_INFO[g.family].main);
    }
  });

  it('costs and refunds Dust', () => {
    expect(glyphLevelCost(1, 0)).toBe(4);
    expect(glyphLevelCost(6, 9)).toBe(1440);
    expect(glyphLevelCost(6, GLYPH_MAX_LEVEL)).toBeNull();
    expect(glyphDustSpent(6, GLYPH_MAX_LEVEL)).toBe(4 * 36 * 55);
    expect(glyphSalvage({ star: 3, level: 0 })).toBe(30);
    expect(glyphSalvage({ star: 6, level: 2 })).toBe(300 + (144 + 288) / 2);
  });

  it('counts a set bonus for every 3 Glyphs of a family', () => {
    const g = (family: Glyph['family'], i: number): Glyph => ({ id: `t${i}`, family, star: 1, level: 0, subs: [] });
    const six = [0, 1, 2, 3, 4, 5].map((i) => g('lifesteal', i));
    expect(glyphSets(six)).toEqual({ lifesteal: 2 });
    expect(glyphSets(six.slice(0, 2))).toEqual({});
    const t = glyphTotals([g('attack', 1), g('attack', 2), g('attack', 3)]);
    expect(t.atk).toBeCloseTo(0.05 * 3 + 0.2);
    expect(glyphTotals(six).lifesteal).toBeCloseTo(0.16);
  });

  it('chest stars follow the chest', () => {
    for (let i = 0; i < 200; i++) {
      expect(chestStar('glyph', `a${i}`)).toBeLessThanOrEqual(3);
      expect(chestStar('grand', `a${i}`)).toBeGreaterThanOrEqual(3);
      expect(chestStar('family', `a${i}`)).toBeGreaterThanOrEqual(2);
      expect(chestStar('family', `a${i}`)).toBeLessThanOrEqual(5);
    }
  });

  it('cleans saved Glyphs', () => {
    expect(cleanGlyph({ id: 'a', family: 'nope', star: 1 })).toBeNull();
    const g = cleanGlyph({ id: 'a', family: 'speed', star: 9, level: 99, subs: [['atk', 5], ['bad', 1]], hero: 'x', slot: 2 })!;
    expect(g.star).toBe(6);
    expect(g.level).toBe(GLYPH_MAX_LEVEL);
    expect(g.subs).toEqual([['atk', 0.3]]);
    expect(g.slot).toBe(2);
  });
});

describe('glyphs on heroes', () => {
  it('fit the weapon\'s open slots and star limit, and raise the hero', () => {
    const s = fresh();
    const h = starter();
    const before = s.heroPower(h).atk;
    const small = s.gainGlyph(2, 'attack').glyph!;
    const big = s.gainGlyph(3, 'attack').glyph!;
    expect(s.socketBlock(h.id, 1, small.id)).toBe('Slot not open yet');
    expect(s.socketBlock(h.id, 0, big.id)).toBe('This weapon holds up to 2★');
    expect(s.socketGlyph(h.id, 0, small.id)).toBe(true);
    expect(s.heroPower(h).atk.div(before).toNumber()).toBeCloseTo(1 + glyphMain(small).value + (small.subs.find(([k]) => k === 'atk')?.[1] ?? 0));
    expect(s.bagGlyphs().map((g) => g.id)).toEqual([big.id]);
    // Unbound Glyphs come out for free.
    expect(s.takeOutGlyph(small.id)).toBe(true);
    expect(s.heroPower(h).atk.toString()).toBe(before.toString());
  });

  it('bound Glyphs need an Unbinder or break into Dust', () => {
    const s = fresh();
    const h = starter();
    s.weapons[h.id] = 3;
    s.glyphsChanged();
    const g = s.gainGlyph(3, 'health').glyph!;
    const other = s.gainGlyph(3, 'defense').glyph!;
    expect(s.socketGlyph(h.id, 0, g.id)).toBe(true);
    expect(s.takeOutGlyph(g.id)).toBe(false);
    expect(s.takeOutGlyph(g.id, 'unbind')).toBe(false);
    // Swapping a bound Glyph also needs a choice.
    expect(s.socketGlyph(h.id, 0, other.id)).toBe(false);
    s.unbinders = 1;
    expect(s.socketGlyph(h.id, 0, other.id, 'unbind')).toBe(true);
    expect(s.unbinders).toBe(0);
    expect(s.glyphAt(h.id, 0)?.id).toBe(other.id);
    expect(s.bagGlyphs().map((x) => x.id)).toEqual([g.id]);
    expect(s.takeOutGlyph(other.id, 'break')).toBe(true);
    expect(s.glyphDust).toBe(30);
    expect(s.glyphs.map((x) => x.id)).toEqual([g.id]);
  });

  it('levels with Dust and salvages from the bag', () => {
    const s = fresh();
    const g = s.gainGlyph(1, 'gold').glyph!;
    expect(s.levelGlyph(g.id)).toBe(false);
    s.glyphDust = 4;
    expect(s.levelGlyph(g.id)).toBe(true);
    expect(s.glyphs[0].level).toBe(1);
    expect(s.salvageGlyphs([g.id])).toBe(5 + 2);
    expect(s.glyphs).toEqual([]);
  });

  it('turns drops into Dust when the bag is full', () => {
    const s = fresh();
    for (let i = 0; i < GLYPH_BAG_CAP; i++) s.gainGlyph(1);
    expect(s.gainGlyph(1)).toEqual({ dust: 5 });
    expect(s.bagGlyphs().length).toBe(GLYPH_BAG_CAP);
  });

  it('Speed, Crit, Lifesteal and Gold Find reach the stat sheet', () => {
    const s = fresh();
    const h = starter();
    s.weapons[h.id] = 9;
    const base = s.heroStats(h);
    // Lifesteal Glyphs raise HP; three of them make the set that heals.
    for (const [i, fam] of (['speed', 'crit', 'gold', 'lifesteal', 'lifesteal', 'lifesteal'] as const).entries()) {
      const g = s.gainGlyph(6, fam).glyph!;
      g.subs = [];
      s.socketGlyph(h.id, i, g.id);
    }
    const st = s.heroStats(h);
    expect(st.attacksPerSec.value / base.attacksPerSec.value).toBeCloseTo(1.1);
    expect(st.critRate - base.critRate).toBeCloseTo(0.05);
    expect(st.lifesteal).toBeCloseTo(0.08);
    expect((1 + st.bonusGold) / (1 + base.bonusGold)).toBeCloseTo(1.36);
  });

  it('save and load keep Glyphs, Dust and Unbinders', () => {
    const s = fresh();
    const h = starter();
    const g = s.gainGlyph(2, 'crit').glyph!;
    s.socketGlyph(h.id, 0, g.id);
    s.gainGlyph(4, 'frenzy');
    s.glyphDust = 77;
    s.unbinders = 3;
    s.save();
    const t = new GameState();
    expect(t.load()).toBe(true);
    expect(t.glyphs).toEqual(s.glyphs);
    expect(t.glyphDust).toBe(77);
    expect(t.unbinders).toBe(3);
    expect(t.heroPower(h).atk.toString()).toBe(s.heroPower(h).atk.toString());
  });
});

describe('scouting pays Unbinders', () => {
  it('Rare missions pay 1 and Gilded 2', () => {
    expect(fullReward({ kind: 'rare', hours: 4 }).unbinder).toBe(1);
    expect(fullReward({ kind: 'gilded', hours: 6 }).unbinder).toBe(2);
    expect(fullReward({ kind: 'common', hours: 4 }).unbinder).toBeUndefined();
  });
});

describe('rush rules', () => {
  it('brackets overlap at 3★ and 5★ and stop at 7★', () => {
    expect([0, 1, 2].map((b) => inBracket(2, b))).toEqual([true, true, false]);
    expect([0, 1, 2].map((b) => inBracket(4, b))).toEqual([false, true, true]);
    expect(inBracket(7, 2)).toBe(true);
  });

  it('points grow with bracket, opponent, Rush level and featured heroes', () => {
    expect(rushWinPoints(0, 1, 1, false)).toBe(10);
    expect(rushWinPoints(2, 2, 1, false)).toBe(49);
    expect(rushLevelMult(3)).toBe(1.5);
    expect(rushWinPoints(1, 1, 3, true)).toBe(36);
  });

  it('free attacks start at 1 and come back every period, up to 2', () => {
    expect(freeAttacks(undefined, 0)).toBe(1);
    expect(freeAttacks(undefined, 5)).toBe(2);
    expect(freeAttacks({ n: 0, p: 3 }, 3)).toBe(0);
    expect(freeAttacks({ n: 0, p: 3 }, 4)).toBe(1);
  });

  it('a fight running when the game closed counts as a loss', () => {
    const r = cleanRush({ id: 'x', streak: 2, losses: 1, active: { bracket: 0, foe: 0, hero: 'a', free: true } }, new Set());
    expect(r.losses).toBe(2);
    expect(r.streak).toBe(0);
    expect(r.active).toBeUndefined();
  });
});

describe('the Rush event', () => {
  it('runs Thursday to Sunday on weeks without the double Trial weekend', () => {
    const s = veteran();
    // 7-8 Nov 2026 is the double-crest weekend, so that week has no Rush; the weeks around it do.
    expect(s.rushOn(at(11, 5))).toBe(false);
    expect(s.rushOn(at(11, 7))).toBe(false);
    expect(s.rushOn(at(10, 22))).toBe(true);
    expect([28, 29, 30, 31].map((d) => s.rushOn(at(10, d)))).toEqual([false, true, true, true]);
    expect(s.rushOn(at(11, 1))).toBe(true);
    expect(s.rushOn(at(11, 2))).toBe(false);
    expect([19, 26].map((d) => s.rushOn(at(11, d)))).toEqual([true, true]);
    const w = s.rushWindow(at(11, 3));
    expect(w.start).toBe(new Date(2026, 10, 12).getTime());
    expect(w.end).toBe(new Date(2026, 10, 16).getTime());
  });

  it('starts with tickets, adds more each day, and starts fresh next event (coins stay)', () => {
    const s = veteran();
    s.rushCoins = 50;
    expect(s.rushSync(at(10, 29, 9))).toBe(true);
    expect(s.rush.tickets).toBe(RUSH_START_TICKETS);
    s.rushSync(at(10, 29, 20));
    expect(s.rush.tickets).toBe(RUSH_START_TICKETS);
    s.rushSync(at(10, 30, 8));
    expect(s.rush.tickets).toBe(RUSH_START_TICKETS + RUSH_DAILY_TICKETS);
    s.rushSync(at(11, 12, 8));
    expect(s.rush.tickets).toBe(RUSH_START_TICKETS);
    expect(s.rushCoins).toBe(50);
  });

  it('fights use free attacks first, then tickets; four wins raise the Rush level; tiers pay out', () => {
    const s = veteran();
    const t = at(10, 29, 1);
    s.rushSync(t);
    const foes = s.rushFoes(0, t);
    expect(foes.length).toBe(3);
    // Easy, Even and Hard opponents sit at rising shares of the best hero's CP.
    const cps = foes.map((f) => Number(f.cp));
    expect(cps[0]).toBeLessThan(cps[2]);
    const h = s.rushHeroes(0)[0];
    expect(s.rushFree(h.id, t)).toBe(1);
    expect(s.startRush(0, 0, h.id, t)).not.toBeNull();
    expect(s.rushFree(h.id, t)).toBe(0);
    expect(s.rush.tickets).toBe(RUSH_START_TICKETS);
    let r = s.finishRush(true)!;
    expect(r.points).toBe(rushWinPoints(0, 0, 1, r.featured));
    expect(s.skillTeam).toBeNull();
    // That bracket gets new opponents.
    expect(s.rush.foes[0]).toEqual([]);
    for (let i = 1; i < RUSH_STREAK_UP; i++) {
      s.rushFoes(0, t);
      expect(s.startRush(0, 1, h.id, t)).not.toBeNull();
      r = s.finishRush(true)!;
    }
    expect(s.rush.tickets).toBe(RUSH_START_TICKETS - (RUSH_STREAK_UP - 1) * RUSH_FIGHT_TICKETS);
    expect(r.levelUp).toBe(true);
    expect(s.rush.level).toBe(2);
    expect(s.rush.streak).toBe(0);
    // The free attack comes back after the period.
    expect(s.rushFree(h.id, t + RUSH_FREE_HOURS * HOUR)).toBe(1);
    // Tiers: push past the first ones.
    s.rush.points = RUSH_TIERS[2].points - 1;
    s.rushFoes(0, t);
    s.startRush(0, 2, h.id, t);
    const gems = s.gems;
    r = s.finishRush(true)!;
    expect(s.rush.tiers).toBe(3);
    expect(r.tiers.length).toBe(3);
    expect(s.gems - gems).toBe(20);
    expect(s.glyphDust).toBe(300);
    expect(s.glyphs.length).toBe(3);
  });

  it('a loss pays a few coins and resets the streak, not the level', () => {
    const s = veteran();
    const t = at(10, 29, 1);
    s.rushSync(t);
    s.rush.level = 3;
    s.rush.streak = 2;
    s.stars[starter().id] = 3;
    const hero = s.rushHeroes(1)[0];
    s.rushFoes(1, t);
    expect(s.startRush(1, 0, hero.id, t)).not.toBeNull();
    const coins = s.rushCoins;
    const r = s.finishRush(false)!;
    expect(r.points).toBe(0);
    expect(s.rushCoins - coins).toBe(3);
    expect(s.rush.level).toBe(3);
    expect(s.rush.streak).toBe(0);
  });

  it('is closed below its player level and outside the event', () => {
    const s = fresh();
    expect(s.rushOpen()).toBe(false);
    const v = veteran();
    const h = starter();
    expect(v.rushBlock(0, 0, h.id, at(11, 3))).toBe('No Rush right now');
  });

  it('the shop sells chests, Dust, cores, Unbinders and featured crests, with limits', () => {
    const s = veteran();
    const t = at(10, 29, 1);
    s.rushSync(t);
    s.rushCoins = 10_000;
    expect(s.buyRushItem('grand')!.glyphs.length).toBe(1);
    expect(s.buyRushItem('grand')).not.toBeNull();
    expect(s.buyRushItem('grand')).toBeNull();
    // Family chest: the player picks the family, and the Glyph is of that family.
    expect(s.buyRushItem('family')).toBeNull();
    const fam = s.buyRushItem('family', 'lifesteal')!;
    expect(fam.glyphs[0].glyph!.family).toBe('lifesteal');
    expect(fam.glyphs[0].glyph!.star).toBeGreaterThanOrEqual(2);
    expect(s.rushShopLeft('family')).toBe(2);
    s.buyRushItem('coreR');
    expect(s.forge.coreR).toBe(1);
    s.buyRushItem('unbinder');
    expect(s.unbinders).toBe(1);
    const feat = s.rushFeatured();
    expect(feat.length).toBe(9);
    expect(s.rushFeatured()).toEqual(feat);
    const drops = s.buyRushCrests(feat[0].id, t)!;
    expect(drops.reduce((n, d) => n + d.crests, 0)).toBe(5);
    expect(s.buyRushCrests(HEROES.find((h) => !feat.includes(h))!.id, t)).toBeNull();
  });

  it('saves and loads the event', () => {
    const s = veteran();
    const t = at(10, 29, 1);
    s.rushSync(t);
    s.rushFoes(0, t);
    s.rushCoins = 42;
    s.rush.points = 120;
    s.save();
    const u = new GameState();
    u.load();
    expect(u.rush).toEqual(s.rush);
    expect(u.rushCoins).toBe(42);
  });
});
