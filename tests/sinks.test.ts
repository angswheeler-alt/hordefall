import { beforeEach, describe, expect, it } from 'vitest';
import { GameState } from '../src/state';
import { HEROES, RELICS, RELIC_BASE_MAX, RELIC_ENHANCE_COSTS, RELIC_ENHANCE_LEVELS, TRIAL_LEVELS } from '../src/data';
import {
  ALCHEMY_CORES_PER_WEEK, ALCHEMY_CORE_STONES, ALCHEMY_DUST, ALCHEMY_DUST_MIN, ALCHEMY_DUST_PER_WEEK, ALCHEMY_SWAP_MIN, ALCHEMY_SWAP_RATE, ALCHEMY_SWAP_RUNS,
  ATTUNE_STEP, RELIC_TEMPER_CAP, attuneBulk, attuneCost, relicTemperCost,
} from '../src/sinks';

beforeEach(() => localStorage.clear());

const MON = new Date(2026, 10, 2, 12).getTime(); // a Monday
const DAY = 86_400_000;

describe('Elemental Attunement', () => {
  it('spends the element\'s own Essence and adds ATK and HP to that element only', () => {
    const s = new GameState();
    const h = HEROES.find((x) => x.unlockCost === 0)!;
    const other = HEROES.find((x) => x.element !== h.element)!;
    const before = s.heroPower(h);
    const otherBefore = s.heroPower(other);
    s.essences[h.element] = attuneCost(0) + attuneCost(1) - 1;
    expect(s.buyAttune(h.element, 'max')).toBe(1);
    expect(s.attuneRank(h.element)).toBe(1);
    expect(s.essences[h.element]).toBe(attuneCost(1) - 1);
    expect(s.heroPower(h).atk.div(before.atk).toNumber()).toBeCloseTo(1 + ATTUNE_STEP);
    expect(s.heroPower(h).hp.div(before.hp).toNumber()).toBeCloseTo(1 + ATTUNE_STEP);
    expect(s.heroPower(other).atk.eq(otherBefore.atk)).toBe(true);
    expect(s.buyAttune(h.element, 1)).toBe(0);
  });

  it('costs grow every rank, bulk buys match single buys, ranks save and load', () => {
    expect(attuneCost(10)).toBeGreaterThan(attuneCost(9));
    const bulk = attuneBulk(0, 1e6);
    let cost = 0;
    for (let r = 0; r < bulk.ranks; r++) cost += attuneCost(r);
    expect(bulk.cost).toBe(cost);
    expect(cost + attuneCost(bulk.ranks)).toBeGreaterThan(1e6);
    const s = new GameState();
    s.essences.fire = 1e7;
    const n = s.buyAttune('fire', 'max');
    expect(n).toBeGreaterThan(5);
    s.save();
    const t = new GameState();
    t.load();
    expect(t.attuneRank('fire')).toBe(n);
    expect(t.attuneRank('water')).toBe(0);
  });
});

describe('Relic Tempering', () => {
  it('opens after the last Enhance at full level, spends Stones and adds one level of effect each, up to the cap', () => {
    const s = new GameState();
    const def = RELICS.find((r) => r.fx.some(([e]) => e === 'atk') && !r.set)!;
    const top = RELIC_BASE_MAX + RELIC_ENHANCE_LEVELS * RELIC_ENHANCE_COSTS.length;
    s.relics[def.id] = top - 1;
    s.relicEnhance[def.id] = RELIC_ENHANCE_COSTS.length;
    expect(s.temperCost(def)).toBeNull();
    s.relics[def.id] = top;
    expect(s.temperCost(def)).toBe(relicTemperCost(def.stars, 0));
    const before = s.relicEffect(def, 'atk');
    s.enhanceStones = 1e6;
    expect(s.temperRelic(def.id)).toBe(true);
    expect(s.enhanceStones).toBe(1e6 - relicTemperCost(def.stars, 0));
    expect(s.relicEffect(def, 'atk')).toBeCloseTo(before * (top + 1) / top);
    for (let i = 1; i < RELIC_TEMPER_CAP; i++) expect(s.temperRelic(def.id)).toBe(true);
    expect(s.temperRelic(def.id)).toBe(false);
    expect(s.temperCost(def)).toBeNull();
    s.save();
    const t = new GameState();
    t.load();
    expect(t.temperCount(def.id)).toBe(RELIC_TEMPER_CAP);
  });

  it('old saves with junk temper data load clean', () => {
    const s = new GameState();
    const data = s.toJSON();
    data.relicTemper = { nope: 5, [RELICS[0].id]: 999, [RELICS[1].id]: -3 };
    data.attune = { fire: 'x', water: 4 };
    data.alchemy = 'junk';
    localStorage.setItem('hordefall-save-v1', JSON.stringify(data));
    const t = new GameState();
    t.load();
    expect(t.relicTemper).toEqual({ [RELICS[0].id]: RELIC_TEMPER_CAP });
    expect(t.attune).toEqual({ water: 4 });
    expect(t.alchemy.swapped).toBe(0);
  });
});

describe('Alchemist\'s Table', () => {
  it('swaps Essence 3 to 1 up to a weekly limit that follows the best Trial level', () => {
    const s = new GameState();
    expect(s.swapLeft(MON)).toBe(ALCHEMY_SWAP_MIN);
    s.trialBest.fire = 20;
    const cap = ALCHEMY_SWAP_RUNS * TRIAL_LEVELS[19].essence;
    expect(s.swapLeft(MON)).toBe(cap);
    s.essences.fire = cap * ALCHEMY_SWAP_RATE * 2;
    expect(s.swapMost('fire', 'fire', MON)).toBe(0);
    expect(s.swapMost('fire', 'dark', MON)).toBe(cap);
    expect(s.alchemySwap('fire', 'dark', cap + 1, MON)).toBe(false);
    expect(s.alchemySwap('fire', 'dark', cap, MON)).toBe(true);
    expect(s.essences.dark).toBe(cap);
    expect(s.essences.fire).toBe(cap * ALCHEMY_SWAP_RATE);
    expect(s.swapLeft(MON + DAY)).toBe(0);
    expect(s.swapLeft(MON + 7 * DAY)).toBe(cap);
  });

  it('sells Glyph Dust and Epic Forge Cores a few times a week', () => {
    const s = new GameState();
    s.essences.water = 1e9;
    s.enhanceStones = 10_000;
    for (let i = 0; i < ALCHEMY_DUST_PER_WEEK; i++) expect(s.alchemyDust('water', MON)).toBe(true);
    expect(s.alchemyDust('water', MON)).toBe(false);
    expect(s.glyphDust).toBe(ALCHEMY_DUST * ALCHEMY_DUST_PER_WEEK);
    expect(s.essences.water).toBe(1e9 - ALCHEMY_DUST_MIN * ALCHEMY_DUST_PER_WEEK);
    for (let i = 0; i < ALCHEMY_CORES_PER_WEEK; i++) expect(s.alchemyCore(MON)).toBe(true);
    expect(s.alchemyCore(MON)).toBe(false);
    expect(s.forge.coreE).toBe(ALCHEMY_CORES_PER_WEEK);
    expect(s.enhanceStones).toBe(10_000 - ALCHEMY_CORE_STONES * ALCHEMY_CORES_PER_WEEK);
    expect(s.alchemyCore(MON + 7 * DAY)).toBe(true);
  });
});
