import { beforeEach, describe, expect, it, vi } from 'vitest';
import Decimal from 'break_infinity.js';
import { heroProfile, heroBuildEffects, buildBonus, BUILD_EFFECTS } from '../src/profiles';
import { GameState, rarityOdds, weekKey } from '../src/state';
import { mulEffect } from '../src/skills';
import {
  HEROES, STAR_STAT_MULT, MASTERY_EVOLUTIONS, AURA_EVOLUTIONS, STAR_CRESTS, MAX_STARS, LEGENDARY_MEDAL_RATE, CHEST_COST, CHEST_DROPS, CHEST_RARITY_WEIGHTS, LINEUP_SIZE,
  TICKET_CAP, TICKET_MINUTES, OFFLINE_CAP_HOURS, REKINDLE_STAGE, RELICS, RELIC_SETS, RELIC_SLOT_COSTS, RELIC_SLOT_STAGES, RELIC_START_SLOTS, RELIC_BASE_MAX, RELIC_ENHANCE_COSTS, TRIAL_LEVELS, RENAMED_HEROES, GUILD_CREDITS_PER_MEDAL,
} from '../src/data';

const starter = HEROES.find((h) => h.unlockCost === 0)!;
const other = HEROES.find((h) => h.unlockCost !== 0)!;

function fresh() {
  GameState.frozen = false;
  localStorage.clear();
  return new GameState();
}

beforeEach(() => {
  vi.useRealTimers();
});

describe('a new game', () => {
  it('starts with only the free starter recruited and in the lineup', () => {
    const s = fresh();
    expect(s.levels[starter.id]).toBe(1);
    expect(HEROES.filter((h) => s.levels[h.id] > 0).map((h) => h.id)).toEqual([starter.id]);
    expect(s.lineupCount()).toBe(1);
  });
});

describe('saving', () => {
  it('round-trips every field through toJSON/load', () => {
    const s = fresh();
    s.gold = new Decimal('1.5e40');
    s.stage = 77;
    s.reachStage(77);
    s.gems = 1234;
    s.embers = 55;
    s.emberLevels[starter.id] = 9;
    s.crests[other.id] = 42;
    s.stars[starter.id] = 2;
    s.essences.fire = 300;
    s.relics[RELICS[0].id] = 3;
    s.equipped = [RELICS[0].id];
    s.relicEnhance[RELICS[0].id] = 1;
    s.enhanceStones = 7;
    s.save();
    const t = new GameState();
    expect(t.load()).toBe(true);
    expect(t.toJSON()).toEqual(s.toJSON());
    expect(t.gold.toString()).toBe(s.gold.toString());
  });

  it('has no NaN, null or Infinity in a fresh save', () => {
    const s = fresh();
    const walk = (v: unknown, path: string): void => {
      if (typeof v === 'number') expect(Number.isFinite(v), path).toBe(true);
      else if (v === null) throw new Error(`null at ${path}`);
      else if (typeof v === 'object') for (const [k, x] of Object.entries(v as object)) walk(x, `${path}.${k}`);
    };
    walk(s.toJSON(), 'save');
  });

  it('moves old hero ids to their new names', () => {
    fresh();
    const [oldId, newId] = Object.entries(RENAMED_HEROES)[0];
    localStorage.setItem('hordefall-save-v1', JSON.stringify({ gold: '0', levels: { [oldId]: 30 }, crests: { [oldId]: 7 } }));
    const s = new GameState();
    s.load();
    expect(s.levels[newId]).toBe(30);
    expect(s.crests[newId]).toBe(7);
    expect(s.levels[oldId]).toBeUndefined();
  });

  it('survives a corrupt save without throwing', () => {
    fresh();
    localStorage.setItem('hordefall-save-v1', '{not json');
    const s = new GameState();
    expect(() => s.load()).not.toThrow();
  });

  it('stops saving once frozen (before a reload with another save)', () => {
    const s = fresh();
    s.save();
    GameState.wipe();
    s.gems = 999;
    s.save();
    expect(localStorage.getItem('hordefall-save-v1')).toBeNull();
    GameState.frozen = false;
  });

  it('account reset replaces the save with a fresh game that autosave cannot overwrite', () => {
    const s = fresh();
    s.stage = 420;
    s.gems = 5000;
    s.save();
    GameState.startOver(GameState.freshSave(7));
    s.save(); // the old page's autosave fires before the reload
    const saved = JSON.parse(localStorage.getItem('hordefall-save-v1')!);
    expect(saved.stage).toBe(1);
    expect(saved.rev).toBe(7);
    GameState.frozen = false;
    const after = new GameState();
    expect(after.load()).toBe(true);
    expect(after.stage).toBe(1);
    expect(after.gems).toBe(fresh().gems);
    expect(HEROES.filter((h) => after.levels[h.id] > 0).map((h) => h.id)).toEqual([starter.id]);
  });

  it('never moves lastSeen backwards', () => {
    const s = fresh();
    s.lastSeen = Date.now() + 3_600_000; // the clock was wound back after a visit "in the future"
    const ahead = s.lastSeen;
    s.save();
    expect(s.lastSeen).toBe(ahead);
  });
});

describe('offline earnings', () => {
  it('pays nothing under a minute or for negative time', () => {
    const s = fresh();
    expect(s.applyOffline(30)).toBeNull();
    expect(s.applyOffline(-5000)).toBeNull();
  });

  it('is capped and stops one stage before the next boss', () => {
    const s = fresh();
    s.goldPerSec = 10;
    s.secondsPerStage = 1;
    s.stage = 3;
    const r = s.applyOffline(1e9)!;
    expect(r.seconds).toBe(OFFLINE_CAP_HOURS * 3600);
    expect(s.stage).toBe(49);
    expect(r.gold.gte(10 * OFFLINE_CAP_HOURS * 3600)).toBe(true);
  });
});

describe('lineup', () => {
  it('refunds exactly the gold spent when a hero is benched', () => {
    const s = fresh();
    s.levels[other.id] = 25;
    const spent = s.goldSpent(other.id);
    const before = s.gold;
    const refund = s.setInLineup(other.id, false)!;
    expect(refund.toString()).toBe(spent.toString());
    expect(s.gold.toString()).toBe(before.plus(spent).toString());
    expect(s.levels[other.id]).toBe(1);
    // Benching again refunds nothing more.
    expect(s.setInLineup(other.id, false)).toBeNull();
  });

  it('never benches the last hero or exceeds the lineup size', () => {
    const s = fresh();
    expect(s.setInLineup(starter.id, false)).toBeNull();
    for (const h of HEROES) s.levels[h.id] = 1;
    s.benched = {};
    expect(s.lineupCount()).toBeLessThanOrEqual(HEROES.length);
    for (const h of HEROES) s.benched[h.id] = true;
    s.benched[starter.id] = false;
    delete s.benched[starter.id];
    for (const h of HEROES) s.setInLineup(h.id, true);
    expect(s.lineupCount()).toBe(LINEUP_SIZE);
  });
});

describe('medals, unlocks and evolution', () => {
  it('unlocks a hero only with enough crests', () => {
    const s = fresh();
    const need = s.unlockCrests(other)!;
    s.crests[other.id] = need - 1;
    expect(s.unlockHero(other.id)).toBe(false);
    s.crests[other.id] = need;
    expect(s.unlockHero(other.id)).toBe(true);
    expect(s.levels[other.id]).toBe(1);
    expect(s.crests[other.id]).toBe(0);
  });

  it('evolves up to the max and no further, only when unlocked', () => {
    const s = fresh();
    s.crests[other.id] = 1e6;
    expect(s.evolve(other.id)).toBe(false); // still locked
    s.crests[starter.id] = STAR_CRESTS.reduce((a, b) => a + b, 0) + 25;
    for (let i = 0; i < MAX_STARS; i++) expect(s.evolve(starter.id)).toBe(true);
    expect(s.evolve(starter.id)).toBe(false);
    expect(s.stars[starter.id]).toBe(MAX_STARS);
    // Leftover medals at max stars became Legendary medals.
    expect(s.legendaryMedals).toBe(Math.floor(25 / LEGENDARY_MEDAL_RATE));
    expect(s.crests[starter.id]).toBe(25 % LEGENDARY_MEDAL_RATE);
  });

  it('each star multiplies stats by 1.5, and 7★ adds the Type Mastery', () => {
    const s = fresh();
    const a = s.heroPower(starter, 10).atk;
    s.stars[starter.id] = 1;
    // Star skills can add more, so at least x1.5, and well short of the original's x2.
    expect(s.heroPower(starter, 10).atk.gte(a.times(STAR_STAT_MULT))).toBe(true);
    expect(STAR_STAT_MULT).toBe(1.5);
    const ranger = HEROES.find((h) => h.type === 'Ranger')!;
    s.levels[ranger.id] = 10;
    s.stars[ranger.id] = MASTERY_EVOLUTIONS - 1;
    const before = s.heroStats(ranger).critRate;
    s.stars[ranger.id] = MASTERY_EVOLUTIONS;
    expect(s.heroStats(ranger).critRate).toBeGreaterThanOrEqual(before + 0.1 - 1e-9);
  });

  it('element auras reach only heroes of that element', () => {
    const s = fresh();
    const byId = (id: string) => HEROES.find((h) => h.id === id)!;
    for (const id of ['blaze', 'ember', 'thorn', 'flint']) s.levels[id] = 10;
    const emberDef = s.heroPower(byId('ember')).defense;
    const thornDef = s.heroPower(byId('thorn')).defense;
    const emberCritDmg = s.heroStats(byId('ember')).critDmg;
    const thornCritDmg = s.heroStats(byId('thorn')).critDmg;
    s.stars.blaze = AURA_EVOLUTIONS;
    s.stars.flint = AURA_EVOLUTIONS;
    // Forge Guard (Flare): Fire heroes +40% Defense. Hot Blood (Flint): Fire heroes +20% crit damage.
    expect(s.heroPower(byId('ember')).defense.div(emberDef).toNumber()).toBeCloseTo(1.4, 6);
    expect(s.heroPower(byId('thorn')).defense.div(thornDef).toNumber()).toBeCloseTo(1, 6);
    expect(s.heroStats(byId('ember')).critDmg - emberCritDmg).toBeCloseTo(0.2, 6);
    expect(s.heroStats(byId('thorn')).critDmg).toBeCloseTo(thornCritDmg, 6);
  });

  it('enemy-side auras reach the team-wide query, element HP auras only their element', () => {
    const s = fresh();
    const byId = (id: string) => HEROES.find((h) => h.id === id)!;
    for (const id of ['shade', 'brook', 'thorn']) s.levels[id] = 10;
    const brineHp = s.heroPower(starter, 10).hp;
    const thornHp = s.heroPower(byId('thorn')).hp;
    s.stars.shade = AURA_EVOLUTIONS;
    s.stars.brook = AURA_EVOLUTIONS;
    // Dread Veil (Shade): enemies attack 10% slower. Spring Blessing (Brook): Water heroes +15% HP.
    expect(mulEffect(s.effects(), 'enemyHaste', null)).toBeCloseTo(0.9, 6);
    s.levels.dread = 10;
    s.stars.dread = AURA_EVOLUTIONS;
    // Shatter Armor (Dread): enemies take 15% more damage.
    expect(mulEffect(s.effects(), 'enemyVuln', null)).toBeCloseTo(1.15, 6);
    expect(s.heroPower(starter, 10).hp.div(brineHp).toNumber()).toBeCloseTo(1.15, 6);
    expect(s.heroPower(byId('thorn')).hp.div(thornHp).toNumber()).toBeCloseTo(1, 6);
  });

  it('a Support in the lineup rallies the whole team (+15% ATK) from 1★', () => {
    const s = fresh();
    const a = s.heroPower(starter, 10).atk;
    const support = HEROES.find((h) => h.type === 'Support')!;
    s.levels[support.id] = 1;
    expect(s.heroPower(starter, 10).atk.div(a).toNumber()).toBeCloseTo(1.15, 6);
    s.benched[support.id] = true;
    expect(s.heroPower(starter, 10).atk.div(a).toNumber()).toBeCloseTo(1, 6);
  });

  it('opening a chest costs gems and gives crests', () => {
    const s = fresh();
    s.gems = CHEST_COST - 1;
    expect(s.summon()).toBeNull();
    s.gems = CHEST_COST;
    const drops = s.summon()!;
    expect(drops).toHaveLength(CHEST_DROPS);
    expect(s.gems).toBe(0);
    const total = Object.values(s.crests).reduce((a, b) => a + b, 0);
    expect(total).toBe(drops.reduce((a, d) => a + d.crests, 0));
  });

  it('shows chest odds that add up to 100% and only for rarities that exist', () => {
    const odds = rarityOdds(HEROES, CHEST_RARITY_WEIGHTS);
    expect(odds.reduce((t, [, p]) => t + p, 0)).toBeCloseTo(100);
    for (const [r] of odds) expect(HEROES.some((h) => h.rarity === r)).toBe(true);
  });
});

describe('trial tickets', () => {
  it('regenerate one per period up to the cap', () => {
    const s = fresh();
    const t0 = 1_000_000_000_000;
    s.tickets = 5;
    s.ticketClock = t0;
    s.refreshTickets(t0 + 3 * TICKET_MINUTES * 60000 + 10);
    expect(s.tickets).toBe(8);
    s.refreshTickets(t0 + 1000 * TICKET_MINUTES * 60000);
    expect(s.tickets).toBe(TICKET_CAP);
  });

  it("don't freeze when the ticket clock is in the future", () => {
    const s = fresh();
    const now = 1_000_000_000_000;
    s.tickets = 5;
    s.ticketClock = now + 86_400_000;
    const wait = s.refreshTickets(now);
    expect(wait).toBeLessThanOrEqual(TICKET_MINUTES * 60);
  });

  it('open only after the stage 50 boss', () => {
    const s = fresh();
    const element = s.openTrials()[0];
    expect(s.playTrial(element, 1)).toBeNull();
    s.bestStage = 51;
    expect(s.playTrial(element, 1)?.won).toBe(true);
  });

  it('each trial level pays more than the last', () => {
    for (let i = 1; i < TRIAL_LEVELS.length; i++) {
      expect(TRIAL_LEVELS[i].essence).toBeGreaterThan(TRIAL_LEVELS[i - 1].essence);
      expect(TRIAL_LEVELS[i].medals).toBeGreaterThan(TRIAL_LEVELS[i - 1].medals);
    }
  });

  it('a win hands out all its medals, more than the element has heroes', () => {
    const s = fresh();
    s.bestStage = 51;
    const element = s.openTrials()[0];
    s.trialBest[element] = 7;
    for (const h of HEROES) if (h.element === element) s.levels[h.id] = 1;
    for (const h of HEROES) s.emberLevels[h.id] = 500;
    const before = HEROES.reduce((t, h) => t + (s.crests[h.id] ?? 0), 0);
    const r = s.playTrial(element, 8)!;
    expect(r.won).toBe(true);
    expect(r.medals).toHaveLength(TRIAL_LEVELS[7].medals);
    expect(HEROES.reduce((t, h) => t + (s.crests[h.id] ?? 0), 0) - before).toBe(TRIAL_LEVELS[7].medals);
  });
});

describe('relics', () => {
  it('buy slots with gems in order, then stop', () => {
    const s = fresh();
    s.gems = 1e6;
    expect(s.buyRelicSlot()).toBe(false); // stage gate
    s.bestStage = RELIC_SLOT_STAGES[RELIC_SLOT_STAGES.length - 1];
    for (const cost of RELIC_SLOT_COSTS) {
      const before = s.gems;
      expect(s.buyRelicSlot()).toBe(true);
      expect(before - s.gems).toBe(cost);
    }
    expect(s.buyRelicSlot()).toBe(false);
    expect(s.relicSlots).toBe(RELIC_START_SLOTS + RELIC_SLOT_COSTS.length);
  });

  it("can't equip more relics than slots", () => {
    const s = fresh();
    for (const r of RELICS) s.relics[r.id] = 1;
    for (const r of RELICS) s.toggleRelic(r.id);
    expect(s.equipped.length).toBe(s.relicSlots);
  });

  it('upgrades spend essence and fail without it', () => {
    const s = fresh();
    const def = RELICS[0];
    expect(s.upgradeRelic(def.id)).toBe(false);
    for (const e of def.essences) s.essences[e] = 1e9;
    expect(s.upgradeRelic(def.id)).toBe(true);
    expect(s.relics[def.id]).toBe(1);
  });

  it('opens the next star by maxing a relic of the star below', () => {
    const s = fresh();
    const two = RELICS.find((r) => r.stars === 2)!;
    for (const e of two.essences) s.essences[e] = 1e12;
    expect(s.relicStarsOpen()).toBe(1);
    expect(s.upgradeRelic(two.id)).toBe(false);
    s.relics[RELICS.find((r) => r.stars === 1)!.id] = RELIC_BASE_MAX;
    expect(s.relicStarsOpen()).toBe(2);
    expect(s.upgradeRelic(two.id)).toBe(true);
  });

  it('Enhance Stones raise the cap by 5 only at max level', () => {
    const s = fresh();
    const def = RELICS[0];
    s.enhanceStones = 1000;
    s.relics[def.id] = RELIC_BASE_MAX - 1;
    expect(s.enhanceRelic(def.id)).toBe(false);
    s.relics[def.id] = RELIC_BASE_MAX;
    expect(s.relicNextCost(def)).toBeNull();
    expect(s.enhanceRelic(def.id)).toBe(true);
    expect(s.enhanceStones).toBe(1000 - RELIC_ENHANCE_COSTS[0]);
    expect(s.relicMaxLevel(def)).toBe(RELIC_BASE_MAX + 5);
    expect(s.relicNextCost(def)).not.toBeNull();
  });

  it('a set gives its bonus once every piece is crafted, equipped or not', () => {
    const s = fresh();
    const set = RELIC_SETS[0];
    const pieces = RELICS.filter((r) => r.set === set.id);
    const [effect, value] = set.bonus[0];
    for (const p of pieces.slice(1)) s.relics[p.id] = 1;
    expect(s.relicBonus(effect)).toBe(0);
    s.relics[pieces[0].id] = 1;
    expect(s.relicBonus(effect)).toBeCloseTo(value / 100);
  });

  it('a piece gives each of its effects, reaching the listed number at level 20', () => {
    const s = fresh();
    const def = RELICS.find((r) => r.fx.length === 2)!;
    s.relics[def.id] = RELIC_BASE_MAX;
    s.equipped = [def.id];
    for (const [e, v] of def.fx) expect(s.relicBonus(e)).toBeCloseTo(v / 100);
  });

  it('set pieces need Enhance Stones to craft', () => {
    const s = fresh();
    const def = RELICS.find((r) => r.stones)!;
    for (const r of RELICS.filter((x) => x.stars < def.stars)) s.relics[r.id] = RELIC_BASE_MAX;
    for (const e of def.essences) s.essences[e] = 1e12;
    expect(s.upgradeRelic(def.id)).toBe(false);
    s.enhanceStones = def.stones!;
    expect(s.upgradeRelic(def.id)).toBe(true);
    expect(s.enhanceStones).toBe(0);
  });

  it('hero level discounts divide the cost and work without a slot', () => {
    const s = fresh();
    const def = RELICS.find((r) => r.fx.some(([e]) => e === 'cost'))!;
    s.relics[def.id] = RELIC_BASE_MAX;
    s.equipped = [];
    const v = def.fx.find(([e]) => e === 'cost')![1];
    expect(s.levelCostMult()).toBeCloseTo(1 / (1 + v / 100));
  });

  it('Defense relics raise hero Defense, element ones only for their element', () => {
    const s = fresh();
    const before = s.heroPower(starter).defense;
    expect(before.gt(0)).toBe(true);
    const piece = RELICS.find((r) => r.fx.some(([e]) => e === `${starter.element}Def`))!;
    s.relics[piece.id] = RELIC_BASE_MAX;
    s.equipped = [piece.id];
    expect(s.heroPower(starter).defense.gt(before)).toBe(true);
    const other = HEROES.find((h) => h.element !== starter.element)!;
    const otherBefore = new GameState().heroPower(other).defense;
    expect(s.heroPower(other).defense.toString()).toBe(otherBefore.toString());
  });

  it('hero stats: one calculation for the stat pages and battle', () => {
    const s = fresh();
    const st = s.heroStats(starter);
    expect(st.atk.value.toString()).toBe(s.heroPower(starter).atk.toString());
    expect(st.effectRes.value).toBeCloseTo(heroProfile(starter).effectRes);
    expect(st.attacksPerSec.base).toBeCloseTo(1 / starter.attackCooldown);
    const fast = RELIC_SETS.find((set) => set.bonus.some(([e]) => e === 'speed'))!;
    for (const r of RELICS.filter((x) => x.set === fast.id)) s.relics[r.id] = 1;
    expect(s.heroStats(starter).attacksPerSec.value).toBeGreaterThan(st.attacksPerSec.base);
    const burner = HEROES.find((h) => h.signature?.kind === 'burn');
    if (burner) expect(s.heroStats(burner).burnChance).toBe(1);
    const knight = HEROES.find((h) => h.type === 'Knight')!;
    expect(s.heroStats(knight).isKnight).toBe(true);
  });

  it('every hero has its own specialty, and builds of shared effects get stronger', () => {
    for (const h of HEROES) expect(heroProfile(h).specialty.length, h.id).toBeGreaterThan(0);
    // No two heroes share the same stats: every full profile (Type shape plus specialty) differs.
    const shapes = HEROES.map((h) => {
      const { specialty: _, ...stats } = heroProfile(h);
      return JSON.stringify(stats);
    });
    expect(new Set(shapes).size).toBe(HEROES.length);
    const s = fresh();
    // Builds: two heroes who share an effect make it last longer (roster changes, so use whichever pair exists).
    const effect = BUILD_EFFECTS.find((e) => HEROES.filter((h) => heroBuildEffects(h).includes(e)).length >= 2)!;
    const pair = HEROES.filter((h) => heroBuildEffects(h).includes(effect)).slice(0, 2);
    const time = `${effect}Time` as 'freezeTime' | 'burnTime' | 'poisonTime' | 'stunTime';
    for (const h of HEROES) s.levels[h.id] = 0;
    s.levels[pair[0].id] = 1;
    const solo = s.heroStats(pair[0]);
    s.levels[pair[1].id] = 1;
    expect(s.heroStats(pair[0])[time]).toBeGreaterThan(solo[time]);
    expect(buildBonus(3).dmg).toBeGreaterThan(buildBonus(2).dmg);
  });

  it('specialty bonuses reach the stat sheet', () => {
    const s = fresh();
    const byId = (id: string) => HEROES.find((h) => h.id === id)!;
    for (const id of ['brine', 'marina', 'aegis', 'flint', 'briar']) s.levels[id] = 1;
    expect(s.heroStats(byId('brine')).ultAtk).toBeCloseTo(0.2);
    expect(s.heroStats(byId('marina')).critRate).toBeCloseTo(0.2);
    expect(s.heroStats(byId('aegis')).stunChance).toBeCloseTo(0.1);
    expect(s.heroStats(byId('flint')).bonusGold).toBeCloseTo(1); // 2x gold, like Crush's Extra Gold
    expect(s.heroStats(byId('briar')).critRate).toBeGreaterThanOrEqual(0.25);
  });

  it('drops relics that are no longer in the game from old saves', () => {
    const s = fresh();
    s.relics.sigil = 5;
    s.equipped = ['sigil'];
    s.save();
    const t = new GameState();
    t.load();
    expect(t.relics.sigil).toBeUndefined();
    expect(t.equipped).toEqual([]);
  });

  it('old saves past level 20 keep their levels as Enhances', () => {
    const s = fresh();
    s.relics.warbanner = 30;
    s.save();
    const s2 = new GameState();
    expect(s2.load()).toBe(true);
    expect(s2.relics.warbanner).toBe(30);
    expect(s2.relicEnhance.warbanner).toBe(2);
  });
});

describe('rekindle', () => {
  it('is only possible past the Rekindle stage and keeps embers', () => {
    const s = fresh();
    expect(s.canRekindle()).toBe(false);
    s.reachStage(REKINDLE_STAGE + 20);
    expect(s.canRekindle()).toBe(true);
    const r = s.rekindle(1)!;
    expect(r.embers).toBeGreaterThan(0);
    expect(s.stage).toBe(1);
    expect(s.embers).toBe(r.embers);
    expect(s.rekindles).toBe(1);
    expect(s.canRekindle()).toBe(false);
  });

  it("won't take a boosted rekindle without the gems", () => {
    const s = fresh();
    s.reachStage(REKINDLE_STAGE + 20);
    s.gems = 0;
    expect(s.rekindle(3)).toBeNull();
    expect(s.rekindles).toBe(0);
  });
});

describe('save repair', () => {
  it('benches extra fighters beyond the lineup size and keeps their levels', () => {
    fresh();
    const levels = Object.fromEntries(HEROES.map((h) => [h.id, 40]));
    localStorage.setItem('hordefall-save-v1', JSON.stringify({ gold: '0', levels, benched: {} }));
    const s = new GameState();
    s.load();
    expect(s.lineupCount()).toBe(LINEUP_SIZE);
    expect(HEROES.every((h) => s.levels[h.id] === 40)).toBe(true);
  });

  it('repairs nonsense numbers and always keeps the starter', () => {
    fresh();
    localStorage.setItem('hordefall-save-v1', JSON.stringify({ gold: 'NaN', stage: -4, gems: 'lots', tickets: 999, levels: { [starter.id]: 0 }, stars: { [starter.id]: 99 } }));
    const s = new GameState();
    s.load();
    expect(s.gold.toString()).toBe('0');
    expect(s.stage).toBe(1);
    expect(s.gems).toBeGreaterThanOrEqual(0);
    expect(s.tickets).toBe(TICKET_CAP);
    expect(s.levels[starter.id]).toBe(1);
    expect(s.stars[starter.id]).toBe(MAX_STARS);
    expect(s.lineupCount()).toBe(1);
  });

  it('sets a damaged save aside instead of losing it', () => {
    fresh();
    localStorage.setItem('hordefall-save-v1', '{"gold": "1e10", broken');
    expect(new GameState().load()).toBe(false);
    const kept = (localStorage as any).keys().filter((k: string) => k.startsWith('hordefall-save-v1-unreadable-'));
    expect(kept).toHaveLength(1);
    expect(localStorage.getItem(kept[0])).toContain('1e10');
  });
});

describe('Daily Medal Bundle', () => {
  it('holds different heroes, opens after three daily challenges, and pays once a day', () => {
    const s = fresh();
    const day1 = new Date(2026, 9, 14, 12).getTime();
    const b = s.medalBundleState(day1);
    expect(b.drops.length).toBe(3);
    expect(new Set(b.drops.map((d) => d.heroId)).size).toBe(3);
    expect(b.drops.every((d) => HEROES.find((h) => h.id === d.heroId)!.rarity !== 'legendary')).toBe(true);
    expect(b.ready).toBe(false);
    expect(s.claimMedalBundle(day1)).toBeNull();

    vi.useFakeTimers();
    vi.setSystemTime(day1);
    s.track('kills', 300);
    s.track('stages', 20);
    expect(s.medalBundleState(day1).ready).toBe(false);
    s.track('minutes', 15);
    expect(s.medalBundleState(day1).ready).toBe(true);
    expect(s.rewardsWaiting(day1)).toBe(true);

    const before = b.drops.map((d) => s.crests[d.heroId] ?? 0);
    const drops = s.claimMedalBundle(day1)!;
    expect(drops.map((d) => d.heroId)).toEqual(b.drops.map((d) => d.heroId));
    b.drops.forEach((d, i) => expect(s.crests[d.heroId]).toBe(before[i] + d.crests));
    expect(s.claimMedalBundle(day1)).toBeNull();

    // Same bundle after a reload; a new one the next day.
    s.save();
    const again = new GameState();
    again.load();
    expect(again.medalBundleState(day1)).toMatchObject({ claimed: true, drops: b.drops });
    const next = again.medalBundleState(day1 + 86_400_000);
    expect(next.claimed).toBe(false);
    expect(next.done).toBe(0);
  });
});

describe('guild medals and credits', () => {
  it('giving medals pays credits by rarity, and only medals you have', () => {
    const s = fresh();
    const common = HEROES.find((h) => h.rarity === 'common')!;
    s.crests[common.id] = 4;
    expect(s.giveGuildMedals(common.id, 5)).toBeNull();
    expect(s.giveGuildMedals(common.id, 3)).toBe(3 * GUILD_CREDITS_PER_MEDAL.common);
    expect(s.crests[common.id]).toBe(1);
    expect(s.guildCredits).toBe(3 * GUILD_CREDITS_PER_MEDAL.common);
  });

  it('received medals can unlock a hero', () => {
    const s = fresh();
    const locked = HEROES.find((h) => h.rarity === 'common' && !s.levels[h.id])!;
    const drops = s.receiveGuildMedals([{ heroId: locked.id, crests: 20 }, { heroId: 'nobody', crests: 5 }]);
    expect(drops).toEqual([{ heroId: locked.id, crests: 20, isNew: true }]);
  });

  it('the guild shop spends credits and keeps tickets under the cap', () => {
    const s = fresh();
    expect(s.buyGuildItem('stone')).toBeNull();
    s.guildCredits = 1000;
    expect(s.buyGuildItem('chest')!.drops.length).toBe(CHEST_DROPS);
    expect(s.buyGuildItem('stone')).not.toBeNull();
    expect(s.enhanceStones).toBe(1);
    s.tickets = TICKET_CAP;
    expect(s.guildItemReady('tickets')).toBe(false);
    s.tickets = TICKET_CAP - 2;
    s.buyGuildItem('tickets');
    expect(s.tickets).toBe(TICKET_CAP);
    expect(s.guildCredits).toBe(1000 - 60 - 40 - 30);
    s.save();
    const t = new GameState();
    t.load();
    expect(t.guildCredits).toBe(s.guildCredits);
  });
});

describe('Guild Boss rewards', () => {
  it('damage uses the Trial team and the element edge', () => {
    const s = fresh();
    const plain = s.guildBossDamage(starter.element === 'light' ? 'water' : 'light');
    expect(plain.gt(0)).toBe(true);
    const weakTo = (['water', 'fire', 'earth'] as const).find((e) => e !== starter.element && ({ water: 'fire', fire: 'earth', earth: 'water' } as Record<string, string>)[starter.element] === e);
    if (weakTo) expect(s.guildBossDamage(weakTo).toNumber()).toBeCloseTo(plain.toNumber() * 4, -1);
  });

  it('attempts and kills pay Guild Coins, gold, Embers and a chest', () => {
    const s = fresh();
    const a = s.payGuildBossAttempt(3, new Decimal(0), new Decimal(1000));
    expect(a.coins).toBe(13);
    expect(a.gold.gt(0)).toBe(true);
    s.lifetimeEmbers = 50_000;
    const k = s.payGuildBossKill(3);
    expect(k).toMatchObject({ coins: 65, embers: 500 });
    expect(k.drops.length).toBe(CHEST_DROPS);
    expect(s.guildCredits).toBe(13 + 65);
  });
});

describe('Guild Research', () => {
  it('ranks give their bonuses, are capped and saved', () => {
    const s = fresh();
    const atk = s.heroPower(starter).atk;
    const boss = s.guildBossDamage('light');
    expect(s.setGuildResearch({ combat: 5, elemental: 2, prosperity: 99 })).toBe(true);
    expect(s.setGuildResearch({ combat: 5, elemental: 2, prosperity: 99 })).toBe(false);
    expect(s.researchBonus('combat')).toBeCloseTo(0.1);
    expect(s.researchBonus('prosperity')).toBeCloseTo(0.5);
    expect(s.researchBonus('exploration')).toBe(0);
    expect(s.heroPower(starter).atk.toNumber()).toBeCloseTo(atk.toNumber() * 1.1, -1);
    expect(s.guildBossDamage('light').toNumber()).toBeCloseTo(boss.toNumber() * 1.1 * 1.06, -2);
    const again = new GameState();
    again.load();
    expect(again.guildResearch).toEqual({ combat: 5, elemental: 2, prosperity: 10 });
    s.setGuildResearch({});
    expect(s.researchBonus('combat')).toBe(0);
  });

  it('Guild Coins only go down when there are enough', () => {
    const s = fresh();
    s.guildCredits = 150;
    expect(s.spendGuildCoins(200)).toBe(false);
    expect(s.spendGuildCoins(100)).toBe(true);
    expect(s.guildCredits).toBe(50);
  });
});

describe('Guild shop', () => {
  const day = new Date(2026, 9, 14, 12).getTime();

  it('rolls daily hero offers that can each be bought once', () => {
    const s = fresh();
    s.guildCredits = 1000;
    const shop = s.guildShopState(day);
    expect(shop.offers.length).toBe(4);
    expect(new Set(shop.offers.map((o) => o.heroId)).size).toBe(4);
    const first = shop.offers[0];
    const before = s.crests[first.heroId] ?? 0;
    expect(s.buyGuildOffer(0, day)).not.toBeNull();
    expect(s.crests[first.heroId]).toBe(before + first.crests);
    expect(s.guildCredits).toBe(1000 - first.cost);
    expect(s.buyGuildOffer(0, day)).toBeNull();
    const ids = shop.offers.map((o) => o.heroId).join();
    expect(s.guildShopState(day + 3600_000).offers.map((o) => o.heroId).join()).toBe(ids);
    expect(s.guildShopState(day + 24 * 3600_000).offers.every((o) => !o.bought)).toBe(true);
  });

  it('Wild Medals go to a picked hero, up to the weekly cap', () => {
    const s = fresh();
    s.guildCredits = 10_000;
    const common = HEROES.find((h) => h.id === 'brine')!;
    const legend = HEROES.find((h) => h.rarity === 'legendary');
    if (legend) expect(s.buyWildMedals(legend.id, 1, day)).toBeNull();
    expect(s.buyWildMedals(common.id, 15, day)).not.toBeNull();
    expect(s.wildMedalsLeft(day)).toBe(5);
    expect(s.buyWildMedals(common.id, 6, day)).toBeNull();
    expect(s.guildCredits).toBe(10_000 - 15 * 8);
    const nextWeek = day + 7 * 24 * 3600_000;
    expect(weekKey(nextWeek)).not.toBe(weekKey(day));
    expect(s.wildMedalsLeft(nextWeek)).toBe(20);
  });

  it('Ember pouches are limited per day and boosts stack to two hours', () => {
    const s = fresh();
    s.guildCredits = 10_000;
    s.lifetimeEmbers = 5_000;
    for (let i = 0; i < 3; i++) expect(s.buyGuildItem('embers', day)!.embers).toBeGreaterThanOrEqual(50);
    expect(s.buyGuildItem('embers', day)).toBeNull();
    expect(s.boostMult('banner', day)).toBe(1);
    for (let i = 0; i < 4; i++) expect(s.buyGuildItem('banner', day)).not.toBeNull();
    expect(s.buyGuildItem('banner', day)).toBeNull();
    expect(s.boostMult('banner', day + 119 * 60_000)).toBe(1.5);
    expect(s.boostMult('banner', day + 121 * 60_000)).toBe(1);
    const again = new GameState();
    again.load();
    expect(again.boosts.banner).toBe(s.boosts.banner);
    expect(again.guildShop.pouches).toBe(3);
  });
});

describe('Guild Quests', () => {
  it('counts kills, stages and Trials for the next report and pays rewards', () => {
    const s = fresh();
    s.track('kills', 7);
    s.track('stages');
    s.track('summons');
    expect(s.guildQuestPending).toEqual({ kills: 7, stages: 1, trials: 0 });
    s.save();
    const again = new GameState();
    again.load();
    expect(again.guildQuestPending).toEqual({ kills: 7, stages: 1, trials: 0 });
    expect(s.payGuildQuest('kills')).toEqual({ coins: 15, drops: [] });
    expect(s.payGuildQuest('track2').coins).toBe(60);
    const last = s.payGuildQuest('track4');
    expect(last.coins).toBe(120);
    expect(last.drops.length).toBe(CHEST_DROPS);
    expect(s.guildCredits).toBe(15 + 60 + 120);
  });
});
