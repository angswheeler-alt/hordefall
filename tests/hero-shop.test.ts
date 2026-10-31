import { beforeEach, describe, expect, it } from 'vitest';
import { GameState, SHOP_HEROES, weekIndex, medalPackCost } from '../src/state';
import { MEDAL_PACK, HERO_SHOP_OFFERS, HERO_SHOP_REFRESH_MINUTES, HERO_SHOP_REFRESH_GEMS, FEATURED_BUNDLE, FEATURED_BIG_BUNDLE, FEATURED_BIG_EVERY, TICKET_CAP, TICKET_GEMS, TICKETS_PER_DAY, BOUGHT_TICKET_CAP } from '../src/data';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 21, 12);
/** A fixed "random" so the tests never depend on luck. */
const seq = (...xs: number[]) => {
  let i = 0;
  return () => xs[i++ % xs.length];
};

let s: GameState;
beforeEach(() => {
  localStorage.clear();
  s = new GameState();
  s.gems = 100_000;
  s.ticketClock = NOW;
});

describe('medal pack', () => {
  it('gives the picked hero its medals for Gems', () => {
    const h = SHOP_HEROES.find((x) => x.rarity === 'epic')!;
    const before = s.crests[h.id] ?? 0;
    const drops = s.buyMedalPack(h.id);
    expect(drops?.[0]).toMatchObject({ heroId: h.id, crests: MEDAL_PACK.medals });
    expect(s.gems).toBe(100_000 - MEDAL_PACK.gems.epic);
    expect(s.crests[h.id]).toBe(before + MEDAL_PACK.medals);
  });

  it('prices packs by rarity', () => {
    for (const r of ['common', 'rare', 'epic'] as const) expect(medalPackCost(SHOP_HEROES.find((h) => h.rarity === r)!.id)).toBe(MEDAL_PACK.gems[r]);
    expect(MEDAL_PACK.gems.common).toBeLessThan(MEDAL_PACK.gems.rare);
    expect(MEDAL_PACK.gems.rare).toBeLessThan(MEDAL_PACK.gems.epic);
  });

  it('refuses Legendary heroes and short wallets', () => {
    expect(SHOP_HEROES.some((h) => h.rarity === 'legendary')).toBe(false);
    const id = SHOP_HEROES[0].id;
    s.gems = medalPackCost(id)! - 1;
    expect(s.buyMedalPack(id)).toBeNull();
    expect(s.gems).toBe(medalPackCost(id)! - 1);
  });
});

describe('rotating hero shop', () => {
  it('shows four different heroes with a Common, a Rare and an Epic', () => {
    const { offers } = s.heroShopState(NOW, seq(0.1, 0.5, 0.9, 0.3));
    expect(offers).toHaveLength(HERO_SHOP_OFFERS);
    expect(new Set(offers.map((o) => o.heroId)).size).toBe(HERO_SHOP_OFFERS);
    const rarities = offers.map((o) => SHOP_HEROES.find((h) => h.id === o.heroId)!.rarity);
    expect(rarities.slice(0, 3)).toEqual(['common', 'rare', 'epic']);
  });

  it('sells each offer once', () => {
    const { offers } = s.heroShopState(NOW, seq(0.2));
    expect(s.buyHeroShopOffer(0, NOW)).not.toBeNull();
    expect(s.gems).toBe(100_000 - offers[0].gems);
    expect(s.buyHeroShopOffer(0, NOW)).toBeNull();
  });

  it('refreshes for free on the timer, or early for Gems', () => {
    const first = s.heroShopState(NOW, seq(0.2)).offers.map((o) => o.heroId);
    expect(s.heroShopState(NOW + 60_000, seq(0.8)).offers.map((o) => o.heroId)).toEqual(first);
    const later = s.heroShopState(NOW + HERO_SHOP_REFRESH_MINUTES * 60_000, seq(0.8));
    expect(later.offers.map((o) => o.heroId)).not.toEqual(first);
    expect(s.gems).toBe(100_000);
    expect(s.refreshHeroShopEarly(NOW + HERO_SHOP_REFRESH_MINUTES * 60_000 + 1, seq(0.2))).toBe(true);
    expect(s.gems).toBe(100_000 - HERO_SHOP_REFRESH_GEMS);
  });
});

describe('featured hero', () => {
  it('changes weekly and every shop hero comes round', () => {
    const seen = new Set<string>();
    for (let w = 0; w < SHOP_HEROES.length; w++) seen.add(s.featuredState(NOW + w * 7 * DAY).hero.id);
    expect(seen.size).toBe(SHOP_HEROES.length);
  });

  it('sells the bundle once a week and the big one only on big weeks', () => {
    let t = NOW;
    while (weekIndex(t) % FEATURED_BIG_EVERY !== 1) t += 7 * DAY;
    const hero = s.featuredState(t).hero.id;
    expect(s.buyFeatured('small', t)?.[0]).toMatchObject({ heroId: hero, crests: FEATURED_BUNDLE.medals });
    expect(s.buyFeatured('small', t)).toBeNull();
    expect(s.buyFeatured('big', t)).toBeNull();
    while (weekIndex(t) % FEATURED_BIG_EVERY !== 0) t += 7 * DAY;
    expect(s.featuredState(t).small).toBe(false);
    expect(s.buyFeatured('big', t)?.[0].crests).toBe(FEATURED_BIG_BUNDLE.medals);
    expect(s.gems).toBe(100_000 - FEATURED_BUNDLE.gems - FEATURED_BIG_BUNDLE.gems);
  });
});

describe('Trial tickets for Gems', () => {
  it('go to the bought stash, apart from the refilling tickets, within the daily limit', () => {
    s.tickets = TICKET_CAP;
    expect(s.ticketsBuyable(NOW)).toBe(TICKETS_PER_DAY);
    expect(s.buyTickets(TICKETS_PER_DAY + 1, NOW)).toBe(false);
    expect(s.buyTickets(3, NOW)).toBe(true);
    expect(s.tickets).toBe(TICKET_CAP);
    expect(s.boughtTickets).toBe(3);
    expect(s.trialTickets()).toBe(TICKET_CAP + 3);
    expect(s.gems).toBe(100_000 - 3 * TICKET_GEMS);
    expect(s.ticketsBuyable(NOW)).toBe(TICKETS_PER_DAY - 3);
    expect(s.ticketsBuyable(NOW + DAY)).toBe(TICKETS_PER_DAY);
  });

  it('stop at the stash cap', () => {
    s.boughtTickets = BOUGHT_TICKET_CAP - 2;
    expect(s.ticketsBuyable(NOW)).toBe(2);
  });
});

describe('hero shop saves', () => {
  it('keeps offers, featured buys and ticket buys', () => {
    s.heroShopState(NOW, seq(0.4));
    s.buyHeroShopOffer(1, NOW);
    s.buyFeatured('small', NOW);
    s.tickets = 0;
    s.buyTickets(2, NOW);
    s.save();
    const t = new GameState();
    expect(t.load()).toBe(true);
    expect(t.heroShop).toEqual(s.heroShop);
    expect(t.featuredState(NOW).small).toBe(true);
    expect(t.ticketBuysLeft(NOW)).toBe(TICKETS_PER_DAY - 2);
  });
});
