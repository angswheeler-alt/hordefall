import { describe, expect, it } from 'vitest';
import { GameState } from '../src/state';
import { HEROES, RELEASED_HEROES, PLAYABLE_HEROES, MAX_STARS, ASCENDANT_CHEST, CHEST_DROPS } from '../src/data';
import { FORM_RARITIES, MAX_FORM, COUNTERED_BY, resolveForm, clampForm, ascendBlocker, formArtKey } from '../src/ascendant';
import { activeEffects } from '../src/skills';
import { ASCENDANT_HEROES, ascendantDef, isAscendant } from '../src/heroes/ascendant';
import { elementMultiplier } from '../src/data';

const test = ascendantDef('asc_test')!;

function fresh() {
  GameState.frozen = false;
  localStorage.clear();
  return new GameState();
}

/** A game where asc_test is recruited and has everything for every form. */
function ready() {
  const s = fresh();
  s.levels.asc_test = 1;
  s.stars.asc_test = MAX_STARS;
  s.trialBest.dark = 99;
  s.bestStage = 5000;
  s.essences.dark = 1e9;
  s.enhanceStones = 1e6;
  return s;
}

describe('Ascendant framework', () => {
  it('keeps Ascendant heroes out of the game for now', () => {
    for (const a of ASCENDANT_HEROES) {
      expect(HEROES.some((h) => h.id === a.base.id)).toBe(false);
      expect(RELEASED_HEROES).not.toContain(a.base.id);
      expect(PLAYABLE_HEROES.some((h) => h.id === a.base.id)).toBe(false);
    }
    expect(isAscendant('asc_test')).toBe(true);
    expect(isAscendant(HEROES[0].id)).toBe(false);
  });

  it('every Ascendant hero has four forms, starts Common and needs more for each step', () => {
    for (const a of ASCENDANT_HEROES) {
      expect(a.forms).toHaveLength(MAX_FORM + 1);
      expect(a.base.rarity).toBe('common');
      for (let i = 1; i < a.steps.length; i++) {
        for (const k of ['evolutions', 'trialTier', 'bestStage', 'essence', 'stones'] as const) expect(a.steps[i][k]).toBeGreaterThanOrEqual(a.steps[i - 1][k]);
      }
      expect(a.steps[a.steps.length - 1].evolutions).toBeLessThanOrEqual(MAX_STARS);
    }
  });

  it('each form shows its rarity and lays its changes over the forms before it', () => {
    const forms = [0, 1, 2, 3].map((f) => resolveForm(test, f));
    expect(forms.map((f) => f.rarity)).toEqual(FORM_RARITIES);
    expect(forms.map((f) => f.formName)).toEqual(['Form I', 'Form II', 'Form III', 'Form IV']);
    expect(forms[0].baseAtk).toBe(test.base.baseAtk);
    // Form III sets its own ATK and HP but keeps Form II's attack speed change... until it sets its own.
    expect(forms[2].baseAtk).toBe(9);
    expect(forms[3].attackCooldown).toBe(0.6);
    // The Charge from Form II carries on until Form IV replaces it.
    expect(forms[2].charge).toEqual(forms[1].charge);
    expect(forms[3].charge?.boost).toBe('bossDamage');
    // Art falls back to the form before when a form names none.
    expect(forms[0].art).toBe('asc_test');
    expect(forms[3].art).toBe('asc_test_f4');
    // Stats only go up from form to form, and the id and element never change.
    for (let i = 1; i < forms.length; i++) {
      expect(forms[i].baseAtk).toBeGreaterThanOrEqual(forms[i - 1].baseAtk);
      expect(forms[i].baseHp).toBeGreaterThanOrEqual(forms[i - 1].baseHp);
      expect(forms[i].id).toBe(test.base.id);
      expect(forms[i].element).toBe(test.base.element);
    }
    // The hero entry itself is never changed.
    expect(test.base.rarity).toBe('common');
  });

  it('clamps bad form values', () => {
    expect([clampForm(-2), clampForm(1.7), clampForm(9), clampForm('2'), clampForm(NaN)]).toEqual([0, 1, MAX_FORM, 0, 0]);
    expect(resolveForm(test, 42).rarity).toBe('legendary');
  });

  it('the chest hero counters the boss element', () => {
    for (const [boss, hero] of Object.entries(COUNTERED_BY)) expect(elementMultiplier(hero as never, boss as never)).toBeGreaterThan(1);
  });
});

describe('ascending', () => {
  it('names what is missing, in order', () => {
    const base = { form: 0, recruited: true, evolutions: 9, trialTier: 99, bestStage: 1e6, essence: 1e9, stones: 1e9 };
    expect(ascendBlocker(undefined, base)).toBe('unknown');
    expect(ascendBlocker(test, { ...base, form: MAX_FORM })).toBe('max');
    expect(ascendBlocker(test, { ...base, recruited: false })).toBe('locked');
    expect(ascendBlocker(test, { ...base, evolutions: 1 })).toBe('stars');
    expect(ascendBlocker(test, { ...base, trialTier: 0 })).toBe('trial');
    expect(ascendBlocker(test, { ...base, bestStage: 1 })).toBe('stage');
    expect(ascendBlocker(test, { ...base, essence: 0 })).toBe('essence');
    expect(ascendBlocker(test, { ...base, stones: 0 })).toBe('stones');
    expect(ascendBlocker(test, base)).toBeNull();
  });

  it('spends the step cost once and moves up one form', () => {
    const s = ready();
    const step = test.steps[0];
    expect(s.formOf('asc_test')).toBe(0);
    expect(s.ascend('asc_test')).toBe(true);
    expect(s.formOf('asc_test')).toBe(1);
    expect(s.essences.dark).toBe(1e9 - step.essence);
    expect(s.enhanceStones).toBe(1e6 - step.stones);
  });

  it('goes all the way to Legendary and no further, keeping stars and levels', () => {
    const s = ready();
    s.levels.asc_test = 40;
    s.emberLevels.asc_test = 12;
    s.awaken.asc_test = 2;
    for (let i = 0; i < MAX_FORM; i++) expect(s.ascend('asc_test')).toBe(true);
    expect(s.formOf('asc_test')).toBe(MAX_FORM);
    const essence = s.essences.dark;
    expect(s.ascend('asc_test')).toBe(false);
    expect(s.essences.dark).toBe(essence);
    expect([s.levels.asc_test, s.stars.asc_test, s.emberLevels.asc_test, s.awaken.asc_test]).toEqual([40, MAX_STARS, 12, 2]);
  });

  it('a failed try spends nothing', () => {
    for (const lack of ['stars', 'trial', 'stage', 'essence', 'stones', 'locked'] as const) {
      const s = ready();
      if (lack === 'stars') s.stars.asc_test = 1;
      if (lack === 'trial') s.trialBest.dark = 1;
      if (lack === 'stage') s.bestStage = 10;
      if (lack === 'essence') s.essences.dark = 1;
      if (lack === 'stones') s.enhanceStones = 1;
      if (lack === 'locked') s.levels.asc_test = 0;
      const before = { essence: s.essences.dark, stones: s.enhanceStones };
      expect(s.ascendBlocker('asc_test')).toBe(lack);
      expect(s.ascend('asc_test')).toBe(false);
      expect({ essence: s.essences.dark, stones: s.enhanceStones }).toEqual(before);
      expect(s.formOf('asc_test')).toBe(0);
    }
  });

  it('only Ascendant heroes ascend', () => {
    const s = ready();
    const normal = HEROES[0].id;
    s.levels[normal] = 1;
    s.stars[normal] = MAX_STARS;
    expect(s.ascendBlocker(normal)).toBe('unknown');
    expect(s.ascend(normal)).toBe(false);
    expect(s.forms[normal]).toBeUndefined();
  });
});

describe('Ascendant saves', () => {
  it('older saves load with every hero in its Common form', () => {
    const s = fresh();
    const data = s.toJSON();
    delete data.forms;
    GameState.writeLocal(data);
    const t = new GameState();
    expect(t.load()).toBe(true);
    expect(t.forms).toEqual({});
    expect(t.formOf('asc_test')).toBe(0);
  });

  it('forms survive a save and load, and bad values are repaired', () => {
    const s = ready();
    s.ascend('asc_test');
    s.ascend('asc_test');
    s.save();
    const t = new GameState();
    expect(t.load()).toBe(true);
    expect(t.formOf('asc_test')).toBe(2);

    const data = t.toJSON();
    data.forms = { asc_test: 7, other: -3, odd: 'x', half: 1.5 };
    GameState.writeLocal(data);
    const u = new GameState();
    expect(u.load()).toBe(true);
    expect(u.forms).toEqual({ asc_test: MAX_FORM, other: 0, half: 1 });
  });

  it('keeps save fields this version does not know, but not the cloud rev', () => {
    const s = fresh();
    GameState.writeLocal({ ...s.toJSON(), futureThing: { a: 1 }, rev: 12 });
    const t = new GameState();
    expect(t.load()).toBe(true);
    const out = t.toJSON();
    expect(out.futureThing).toEqual({ a: 1 });
    expect(out.rev).toBeUndefined();
    // Known fields always come from the game, never from the kept extras.
    t.gems = 777;
    expect(t.toJSON().gems).toBe(777);
    // A new game carries no extras.
    expect(Object.keys(GameState.freshSave())).not.toContain('futureThing');
  });
});

describe('forms in play', () => {
  it('stats come from the current form, on top of stars and levels', () => {
    const s = ready();
    const base = test.base;
    const before = s.heroStats(base, 10);
    for (let i = 0; i < MAX_FORM; i++) s.ascend('asc_test');
    const after = s.heroStats(base, 10);
    // Form IV: ATK 11 and HP 64 against Form I's 6 and 48, with the same 8★ and level.
    expect(after.atk.base.div(before.atk.base).toNumber()).toBeCloseTo(11 / 6, 6);
    expect(after.hp.base.div(before.hp.base).toNumber()).toBeCloseTo(64 / 48, 6);
    expect(after.attacksPerSec.base).toBeCloseTo(1 / 0.6, 6);
    expect(s.heroPower(base, 10).atk.gt(s.heroPower(base, 9).atk)).toBe(true);
  });

  it('other heroes are untouched', () => {
    const s = ready();
    for (const h of HEROES) expect(s.formDef(h)).toBe(h);
  });

  it('star skills read the hero as it is now', () => {
    const h = HEROES.find((x) => x.sp1.effect)!;
    const swapped = { kind: 'bossDamage' as const, value: 1.7 };
    const all = () => true;
    const plain = activeEffects(all).filter((a) => a.owner === h.id);
    const resolved = activeEffects(all, (x) => (x.id === h.id ? { ...x, sp1: { ...x.sp1, effect: swapped } } : x)).filter((a) => a.owner === h.id);
    expect(plain.map((a) => a.effect)).toContainEqual(h.sp1.effect);
    expect(resolved.map((a) => a.effect)).toContainEqual(swapped);
    expect(resolved.map((a) => a.effect)).not.toContainEqual(h.sp1.effect);
  });

  it('draws each form with the nearest art that has landed', () => {
    const has = (keys: string[]) => (k: string) => keys.includes(k);
    expect(formArtKey(test, 3, has(['asc_test_f2', 'asc_test_f3', 'asc_test_f4']))).toBe('asc_test_f4');
    expect(formArtKey(test, 3, has(['asc_test_f2']))).toBe('asc_test_f2');
    expect(formArtKey(test, 2, has([]))).toBe('asc_test');
    expect(formArtKey(test, 0, has(['asc_test_f4']))).toBe('asc_test');
  });

  it('lists the next form\'s needs for the hero page', () => {
    const s = ready();
    s.trialBest.dark = 1;
    const needs = s.ascendNeeds('asc_test')!;
    expect(needs).toHaveLength(5);
    expect(needs.map((n) => n.met)).toEqual([true, false, true, true, true]);
    expect(needs[1].text).toBe(`Dark Trial level ${test.steps[0].trialTier} cleared`);
    s.trialBest.dark = 99;
    for (let i = 0; i < MAX_FORM; i++) s.ascend('asc_test');
    expect(s.ascendNeeds('asc_test')).toBeNull();
    expect(s.ascendNeeds(HEROES[0].id)).toBeNull();
  });
});

describe('Ascendant Chest', () => {
  // Weeks (Monday UTC): 2026-10-19 has the Earth Guild Boss, 2026-10-26 the Light one, which Dark beats.
  const lightWeek = Date.parse('2026-10-28T12:00:00Z');
  const earthWeek = Date.parse('2026-10-21T12:00:00Z');
  const pool = [test];

  it('is hidden while no Ascendant hero is out', () => {
    const s = fresh();
    expect(s.ascendantChestState(lightWeek)).toBeNull();
    expect(s.buyAscendantChest(lightWeek)).toBeNull();
  });

  it('sells the hero whose element beats the Guild Boss of the week', () => {
    const s = fresh();
    const st = s.ascendantChestState(lightWeek, pool)!;
    expect([st.hero.id, st.boss, st.week, st.bought]).toEqual(['asc_test', 'light', '2026-10-26', 0]);
    expect(st.endsAt).toBe(Date.parse('2026-11-02'));
    expect(s.ascendantChestState(earthWeek, pool)).toBeNull();
  });

  it('each chest costs more and gives more, then sells out', () => {
    for (let i = 1; i < ASCENDANT_CHEST.length; i++) {
      expect(ASCENDANT_CHEST[i].gems).toBeGreaterThan(ASCENDANT_CHEST[i - 1].gems);
      expect(ASCENDANT_CHEST[i].crests).toBeGreaterThan(ASCENDANT_CHEST[i - 1].crests);
    }
    const s = fresh();
    s.gems = 1e6;
    let crests = 0;
    for (const step of ASCENDANT_CHEST) {
      const gems = s.gems;
      const got = s.buyAscendantChest(lightWeek, pool)!;
      crests += step.crests;
      expect([got.heroId, got.crests, gems - s.gems, s.crests.asc_test, got.drops.length]).toEqual(['asc_test', step.crests, step.gems, crests, CHEST_DROPS]);
    }
    expect(s.ascendantChestState(lightWeek, pool)!.next).toBeNull();
    const gems = s.gems;
    expect(s.buyAscendantChest(lightWeek, pool)).toBeNull();
    expect(s.gems).toBe(gems);
  });

  it('never sells the Ascendant hero through its other drops', () => {
    const s = fresh();
    s.gems = 1e6;
    for (let i = 0; i < 5; i++) for (const d of s.buyAscendantChest(lightWeek, pool)!.drops) expect(isAscendant(d.heroId)).toBe(false);
  });

  it('without enough Gems nothing is spent', () => {
    const s = fresh();
    s.gems = ASCENDANT_CHEST[0].gems - 1;
    expect(s.buyAscendantChest(lightWeek, pool)).toBeNull();
    expect([s.gems, s.crests.asc_test ?? 0, s.ascChest.bought]).toEqual([ASCENDANT_CHEST[0].gems - 1, 0, 0]);
  });

  it('prices reset with the next Light week and survive a reload', () => {
    const s = fresh();
    s.gems = 1e6;
    s.buyAscendantChest(lightWeek, pool);
    s.buyAscendantChest(lightWeek, pool);
    s.save();
    const t = new GameState();
    expect(t.load()).toBe(true);
    expect(t.ascendantChestState(lightWeek, pool)!.bought).toBe(2);
    // Five weeks later the Light boss is back, and the price starts over.
    const later = lightWeek + 5 * 7 * 86_400_000;
    expect(t.ascendantChestState(later, pool)!.bought).toBe(0);
    expect(t.ascendantChestState(later, pool)!.next).toEqual(ASCENDANT_CHEST[0]);
  });
});
