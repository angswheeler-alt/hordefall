// Hordefall economy simulator: drives the real GameState (src/state.ts) with a model of play.
//
// Nothing here changes the game. It loads the game's own modules from SIM_SRC (default: this repo's src/), so an
// economy variant is just a patched copy of src/ (see variants.ts). It never touches the network, Supabase or saves:
// GameState writes to an in-memory localStorage stub and save() is switched off.
//
// What is modelled vs. what the real game does is listed in tools/sim/README.md ("Model limits").
import Decimal from 'break_infinity.js';
import { POLICIES, type Policy } from './policies';

// ---------- in-memory localStorage (GameState reads it on load) ----------
const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
};

const SRC = process.env.SIM_SRC ?? new URL('../../src', import.meta.url).pathname;

// ---------- deterministic randomness and a sim clock ----------
let gameSeed = 1;
/** Game RNG (chest drops, Trial crests, wheel...): replaces Math.random, which the game uses. */
function lcg() {
  gameSeed = (Math.imul(gameSeed, 1664525) + 1013904223) >>> 0;
  return gameSeed / 4294967296;
}
Math.random = lcg;
/** Separate RNG for the player's behaviour (missed days...), so two policies see the same drop luck where possible. */
function makeRng(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let NOW = 0;
Date.now = () => NOW;

const S = await import(SRC + '/state.ts');
const F = await import(SRC + '/formulas.ts');
const D = await import(SRC + '/data.ts');
const R = await import(SRC + '/rewards.ts');
const W = await import(SRC + '/weapons.ts');
const GL = await import(SRC + '/glyphs.ts');
const RU = await import(SRC + '/rush.ts');
const OB = await import(SRC + '/observatory.ts');
const MU = await import(SRC + '/mutations.ts');
const MO = await import(SRC + '/mobs.ts');
const ST = await import(SRC + '/stats.ts');
const GR = await import(SRC + '/guildRelics.ts');
const AS = await import(SRC + '/ascendant.ts');
const { HEROES, STALLS, elementMultiplier, enemyElement, TRIAL_ROTATION, RELICS, CHEST_COST, MEDAL_PACK, STAR_CRESTS } = D;
type Hero = (typeof HEROES)[number];

export interface SimConfig {
  policy: string; // key of POLICIES
  days: number;
  seed: number;
  /** Extra Gems bought per day (hypothetical real-money purchases). Overrides the policy's. */
  paidGemsPerDay?: number;
  /** Override the hero investment strategy. */
  strategy?: Policy['strategy'];
  label?: string;
  /** Write a progress line every N days to stderr (0 = never). */
  progressEvery?: number;
}

const CHECK_DAYS = [1, 3, 7, 14, 30, 60, 90, 180, 365];
const CHECK_ACTIVE_H = [0.5, 2];
const lg = (d: Decimal) => (d.gt(0) ? +d.log10().toFixed(2) : 0);

export async function runSim(cfg: SimConfig) {
  const P: Policy = { ...POLICIES[cfg.policy], ...(cfg.strategy ? { strategy: cfg.strategy } : {}) };
  if (!P) throw new Error('unknown policy ' + cfg.policy);
  if (cfg.paidGemsPerDay !== undefined) P.paidGemsPerDay = cfg.paidGemsPerDay;
  gameSeed = cfg.seed * 7919 + 17;
  const brng = makeRng(cfg.seed * 104729 + 3);
  store.clear();
  NOW = new Date('2026-11-02T08:00:00').getTime(); // a Monday; the container runs in UTC so local = UTC
  const T0 = NOW;

  const s: any = new S.GameState();
  s.save = () => {};
  s.speed2x = true;

  // ---------- memo: relic / skill / research bonuses only change during chores ----------
  let frozen = false;
  const memo = new Map<string, any>();
  for (const name of ['relicBonus', 'effects', 'researchBonus', 'guildRelicBonus', 'levelCostMult', 'stallCostMult', 'bossDamageMult', 'marketRevenueMult', 'stallBonusLevels', 'obsBonus', 'keeperBonus', 'gameSpeedBonus', 'fixedCombatPower', 'heroCombatPower']) {
    const orig = s[name].bind(s);
    s[name] = (...a: any[]) => {
      if (!frozen) return orig(...a);
      const k = name + ':' + a.map((x) => (x && typeof x === 'object' ? x.id : x)).join(',');
      if (memo.has(k)) return memo.get(k);
      const v = orig(...a);
      memo.set(k, v);
      return v;
    };
  }
  const freeze = () => { memo.clear(); frozen = true; };
  const thaw = () => { frozen = false; memo.clear(); };

  // ---------- ledgers ----------
  const L = {
    gold: { kills: new Decimal(0), clears: new Decimal(0), chests: new Decimal(0), market: new Decimal(0), offline: new Decimal(0), rewards: new Decimal(0) },
    goldSpent: { heroes: new Decimal(0), stalls: new Decimal(0) },
    gemsIn: {} as Record<string, number>,
    gemsOut: {} as Record<string, number>,
    crestsIn: {} as Record<string, number>,
    emberIn: new Decimal(0),
    stonesIn: {} as Record<string, number>,
    essenceIn: 0,
    guildCoinsIn: {} as Record<string, number>,
    guildCoinsOut: {} as Record<string, number>,
    motesIn: 0,
    wildIn: 0,
    forgeIn: { ore: 0, crystal: 0, coreC: 0, coreR: 0, coreE: 0 } as Record<string, number>,
    rushPoints: [] as number[],
    trialWins: 0,
    chestsOpened: 0,
    pvpFights: 0,
    pvpWins: 0,
    rushFights: 0,
    guildWeeks: [] as Array<{ week: string; start: number; top: number; beaten: number }>,
    shinies: 0,
  };
  const add = (o: Record<string, number>, k: string, v: number) => { if (v) o[k] = (o[k] ?? 0) + v; };
  const crestTotal = () => HEROES.reduce((t: number, h: Hero) => t + (s.crests[h.id] ?? 0), 0) + s.legendaryMedals * D.LEGENDARY_MEDAL_RATE;
  /** Run fn, booking Gem / crest / stone deltas against `src`. */
  function book<T>(src: string, fn: () => T): T {
    const g = s.gems, c = crestTotal(), st = s.enhanceStones, gc = s.guildCredits, w = s.wildCrests;
    const unlockedBefore = HEROES.filter((h: Hero) => s.levels[h.id] > 0).length;
    const r = fn();
    const dg = s.gems - g;
    if (dg > 0) add(L.gemsIn, src, dg); else if (dg < 0) add(L.gemsOut, src, -dg);
    const dc = crestTotal() - c;
    if (dc > 0) add(L.crestsIn, src, dc);
    const ds = s.enhanceStones - st;
    if (ds > 0) add(L.stonesIn, src, ds);
    const dgc = s.guildCredits - gc;
    if (dgc > 0) add(L.guildCoinsIn, src, dgc); else if (dgc < 0) add(L.guildCoinsOut, src, -dgc);
    if (s.wildCrests > w) L.wildIn += s.wildCrests - w;
    void unlockedBefore;
    return r;
  }

  // ---------- clock ----------
  let activeSec = 0;
  const day = () => (NOW - T0) / 86400000;

  // ---------- team model (cached stats, scaled by level) ----------
  const levelScale = (lv: number) => (lv <= 0 ? new Decimal(0) : Decimal.pow(2, Math.floor(lv / 20)).times(lv));
  type Member = { def: Hero; el: string; ref: number; atk: Decimal; hp: Decimal; dfn: Decimal; aps: number; crit: number; splash: number; gold: number; melee: boolean };
  let team: Member[] | null = null;
  const lineup = (): Hero[] => HEROES.filter((h: Hero) => s.inLineup(h.id));
  function buildTeam(): Member[] {
    return lineup().map((def) => {
      const ref = Math.max(1, s.heroLevel(def.id));
      const st = s.heroStats(def, ref);
      const k = levelScale(ref);
      return {
        def, el: s.formDef(def).element, ref,
        atk: st.atk.value.div(k), hp: st.hp.value.div(k), dfn: st.def.value.div(k),
        aps: st.attacksPerSec.value,
        crit: 1 + Math.min(1, Math.max(0, st.critRate)) * Math.max(0, st.critDmg),
        splash: st.hasAoe ? 1.5 : 1,
        gold: 1 + st.bonusGold,
        melee: (st.range?.value ?? 999) <= 60,
      };
    });
  }
  const getTeam = () => (team ??= buildTeam());
  const dirty = () => { team = null; };
  function teamDps(element: string): Decimal {
    let dps = new Decimal(0);
    for (const m of getTeam()) dps = dps.plus(m.atk.times(levelScale(s.heroLevel(m.def.id))).times(m.aps * m.crit * m.splash * elementMultiplier(m.el, element)));
    return dps;
  }
  function teamGoldMult(): number {
    let w = 0, t = 0;
    for (const m of getTeam()) { const a = m.atk.toNumber() || 1e-300; w += a; t += a * m.gold; }
    return w > 0 ? t / w : 1;
  }
  /** GameState.canBeatBoss with cached stats (same formula). */
  function beatsBoss(stage: number): { won: boolean; seconds: number } {
    const element = D.bossHasElement(stage) ? D.bossElement(stage) : null;
    const elemental = 1 + s.researchBonus('elemental');
    let dps = new Decimal(0);
    let survive = 0;
    for (const m of getTeam()) {
      const ls = levelScale(s.heroLevel(m.def.id));
      if (!D.bossImmuneTo(stage, m.el)) {
        // Variant hook: a share of normal damage from non-weakness elements on the 100th-stage element bosses.
        const soft = (D as any).ELEMENT_BOSS_OTHER_SHARE !== undefined && D.isElementBossStage(stage) && D.bossWeakness(stage) !== m.el ? (D as any).ELEMENT_BOSS_OTHER_SHARE : 1;
        const mult = (element ? elementMultiplier(m.el, element) * elemental : 1) * soft;
        dps = dps.plus(m.atk.times(ls).times(m.aps * mult * m.crit));
      }
      const hit = F.bossAtk(stage).times(element ? elementMultiplier(element, m.el) : 1);
      const perSec = F.defended(hit, m.dfn.times(ls)).div(D.OFFLINE_BOSS_COOLDOWN);
      survive += perSec.gt(0) ? m.hp.times(ls).div(perSec).toNumber() : Infinity;
    }
    dps = dps.times(s.bossDamageMult());
    const killTime = dps.gt(0) ? F.bossHp(stage).div(dps).toNumber() : Infinity;
    const won = killTime <= Math.min(survive, D.BOSS_TIME_LIMIT * D.OFFLINE_BOSS_TIME_SHARE);
    return { won, seconds: won ? killTime : Infinity };
  }

  const WALK = 12.4; // game seconds for heroes to cross the lane with nothing in the way
  /** A regular stage: game seconds to clear and enemies killed, or null when the team can't keep up. */
  function stageClear(stage: number): { t: number; kills: number; gold: number } | null {
    const mut = MU.mutationLoad(stage);
    const kinds = MO.mobLoad(stage, 0.5);
    const hp = F.enemyHp(stage).times(1.045 * mut.hp * kinds.hp);
    const dps = teamDps(enemyElement(stage));
    if (dps.lte(0)) return null;
    const g = Math.min(3, 1 + Math.floor((stage - 1) / 8) + 0.3);
    const w = Math.min(3, 1 + Math.floor((stage - 1) / 15));
    const n0 = 3 * g + w;
    const r = hp.div(dps).toNumber();
    const crystal = F.crystalHp(stage).div(dps).toNumber();
    const denom = 1 - (w * r) / 7;
    if (denom < 0.15) return null;
    const t = (WALK + n0 * r + crystal) / denom;
    if (t > 90) return null;
    return { t, kills: n0 + Math.floor(t / 7) * w, gold: mut.gold * kinds.gold };
  }

  // ---------- spending gold ----------
  const MANUAL_STALL_EFF = 0.6;
  function marketIncomePerSec(active: boolean): Decimal {
    let tot = new Decimal(0);
    for (const def of STALLS) {
      const st = s.stalls[def.id];
      if (st.level <= 0) continue;
      const inc = s.stallIncome(def).div(s.stallCycle(def));
      tot = tot.plus(s.stallAuto(def.id) ? inc : active ? inc.times(MANUAL_STALL_EFF * P.stallTapShare) : 0);
    }
    return tot;
  }
  function spendGold() {
    if (P.stalls) {
      for (let guard = 0; guard < 400; guard++) {
        let best: { def: any; cost: Decimal; pay: number } | null = null;
        for (const def of STALLS) {
          const lv = s.stalls[def.id].level;
          const cost = F.stallUpgradeCost(def, lv, s.stallCostMult());
          if (cost.gt(s.gold)) continue;
          const eff = (l: number) => (l >= D.STALL_AUTO_LEVEL ? l + s.stallBonusLevels() : l);
          const gain = F.stallIncome(def, eff(lv + 1)).minus(F.stallIncome(def, eff(lv))).times(s.marketRevenueMult() * (1 + s.relicBonus('stall'))).div(s.stallCycle(def)).times(lv + 1 >= D.STALL_AUTO_LEVEL ? 1 : MANUAL_STALL_EFF);
          const pay = cost.div(Decimal.max(gain, 1e-300)).toNumber() * (lv + 1 === D.STALL_AUTO_LEVEL ? 0.5 : 1);
          if (pay < 240 && (!best || pay < best.pay)) best = { def, cost, pay };
        }
        if (!best) break;
        s.gold = s.gold.minus(best.cost);
        L.goldSpent.stalls = L.goldSpent.stalls.plus(best.cost);
        s.stalls[best.def.id].level += 1;
      }
    }
    const g = s.gold;
    if (P.strategy === 'concentrated') {
      // Carry first: level the carry while its next level costs under 8x the cheapest teammate's, else the cheapest.
      const lu = lineup();
      const carry = carryId();
      let bought = 0;
      for (let guard = 0; guard < 5000; guard++) {
        let pick: Hero | null = null; let best: Decimal | null = null;
        for (const h of lu) {
          const c = F.upgradeCost(h, s.levels[h.id], s.levelCostMult()).times(h.id === carry ? 0.125 : 1);
          if (!best || c.lt(best)) { best = c; pick = h; }
        }
        if (!pick) break;
        const real = F.upgradeCost(pick, s.levels[pick.id], s.levelCostMult());
        if (real.gt(s.gold)) break;
        s.gold = s.gold.minus(real); s.levels[pick.id] += 1; bought++;
      }
      s.track('levels', bought);
    } else s.levelAll();
    L.goldSpent.heroes = L.goldSpent.heroes.plus(g.minus(s.gold));
  }

  // ---------- heroes: carry, lineup, Embers ----------
  const heroScore = (h: Hero, lvl = 100) => {
    const st = s.heroStats(h, lvl);
    return st.atk.value.times(st.attacksPerSec.value).times(st.hp.value).sqrt().toNumber();
  };
  let carryCache = '';
  function carryId(): string {
    if (carryCache && s.inLineup(carryCache)) return carryCache;
    const lu = lineup();
    carryCache = lu.slice().sort((a, b) => { const sa = s.heroStats(a, 100), sb = s.heroStats(b, 100); return sb.atk.value.times(sb.attacksPerSec.value).cmp(sa.atk.value.times(sa.attacksPerSec.value)); })[0]?.id ?? '';
    return carryCache;
  }
  let focusElement = '';
  function pickLineup() {
    const owned = HEROES.filter((h: Hero) => (s.levels[h.id] ?? 0) > 0);
    const score = new Map(owned.map((h: Hero) => [h.id, heroScore(h)]));
    const by = (a: Hero, b: Hero) => (score.get(b.id) ?? 0) - (score.get(a.id) ?? 0);
    let want: Hero[] = [];
    if (P.strategy === 'element') {
      if (!focusElement) focusElement = s.formDef(owned[0]).element;
      want = owned.filter((h) => s.formDef(h).element === focusElement).sort(by).slice(0, s.teamSlots);
    } else if (P.strategy === 'rarity') {
      const rank: Record<string, number> = { legendary: 4, epic: 3, rare: 2, common: 1 };
      want = owned.slice().sort((a, b) => rank[s.formDef(b).rarity] - rank[s.formDef(a).rarity] || by(a, b)).slice(0, s.teamSlots);
    } else {
      for (const el of TRIAL_ROTATION) {
        const c = owned.filter((h) => s.formDef(h).element === el).sort(by)[0];
        if (c && want.length < s.teamSlots) want.push(c);
      }
    }
    for (const h of owned.sort(by)) if (want.length < s.teamSlots && !want.includes(h)) want.push(h);
    const now = lineup();
    if (now.length === want.length && now.every((h) => want.includes(h))) return;
    // Embers move off heroes leaving the team (Reset Embers refunds all), then the exact team is set.
    for (const h of now) if (!want.includes(h)) s.resetEmbers(h.id);
    for (const h of HEROES) if ((s.levels[h.id] ?? 0) > 0) { if (want.includes(h)) delete s.benched[h.id]; else s.benched[h.id] = true; }
    carryCache = '';
    spendEmbers();
    dirty();
  }
  function spendEmbers() {
    const lu = lineup();
    if (!lu.length) return;
    const carry = P.strategy === 'concentrated' ? carryId() : '';
    // cheapest next level first (weighted toward the carry for the concentrated strategy)
    for (let guard = 0; guard < 200000; guard++) {
      let pick: Hero | null = null; let best = Infinity;
      for (const h of lu) {
        // Costs grow by a fixed factor a level, so the cheapest next level is the lowest level (the carry counts 8x cheaper).
        const c = (s.emberLevels[h.id] ?? 0) - (h.id === carry ? Math.log(8) / Math.log(F.EMBER_COST_GROWTH) : 0);
        if (c < best) { best = c; pick = h; }
      }
      if (!pick || s.buyEmbers(pick.id, 1) <= 0) break;
    }
    dirty();
  }
  /** Crests a hero still needs for its next unlock or star. */
  function need(h: Hero): number {
    if (!(s.levels[h.id] > 0)) return Math.max(0, (s.unlockCrests(h) ?? 1e9) - (s.crests[h.id] ?? 0));
    const c = s.evolveCost(h.id);
    return c === null ? 1e9 : Math.max(0, c - (s.medalsFor(h.id) ?? 0));
  }
  /** Heroes the player wants crests for, best first (the strategy's choice). */
  function crestTargets(): Hero[] {
    const lu = lineup();
    const live = (h: Hero) => need(h) < 1e9 && !D.HEROES.find((x: Hero) => x.id === h.id && x.rarity === 'legendary');
    if (P.strategy === 'collection') {
      const locked = S.SHOP_HEROES.filter((h: Hero) => !(s.levels[h.id] > 0));
      const owned = HEROES.filter((h: Hero) => s.levels[h.id] > 0 && live(h)).sort((a: Hero, b: Hero) => (s.stars[a.id] ?? 0) - (s.stars[b.id] ?? 0));
      return [...locked, ...owned];
    }
    if (P.strategy === 'concentrated') {
      const c = carryId();
      return [...lu.filter((h) => h.id === c && live(h)), ...lu.filter((h) => h.id !== c && live(h)).sort((a, b) => need(a) - need(b))];
    }
    return lu.filter(live).sort((a, b) => need(a) - need(b));
  }

  // ---------- Gems ----------
  const reserve = () => {
    // Save for the next team slot (always the best buy) and for a relic slot a relic is waiting on.
    const t = s.nextTeamSlotCost();
    if (t !== null && s.teamSlots < P.teamSlotGoal) return t;
    const owned = Object.keys(s.relics).filter((k) => s.relics[k] > 0).length;
    const r = s.nextSlotCost();
    if (r !== null && owned > s.relicSlots) return r;
    return 0;
  };
  function spendGems(active: boolean) {
    // team slots first, then relic slots when a relic waits
    for (let c = s.nextTeamSlotCost(); c !== null && s.teamSlots < P.teamSlotGoal && s.gems >= c; c = s.nextTeamSlotCost()) if (!book('g:teamSlots', () => s.buyTeamSlot())) break;
    const ownedRelics = Object.keys(s.relics).filter((k) => s.relics[k] > 0).length;
    for (let sc = s.nextSlotCost(); sc !== null && ownedRelics > s.relicSlots && s.gems >= sc; sc = s.nextSlotCost()) if (!book('g:relicSlots', () => s.buyRelicSlot())) break;
    if (reserve() > 0) return;
    if (P.ultSlots) for (let c = s.nextUltSlotCost(); c !== null && s.gems >= c + 200; c = s.nextUltSlotCost()) if (!book('g:ultSlots', () => s.buyUltSlot())) break;
    const g = P.gems;
    if (g === 'chests') {
      while (s.gems >= CHEST_COST) { book('g:heroChest', () => s.summon()); L.chestsOpened++; }
      return;
    }
    if (g === 'wasteful') {
      // D: boosts, refreshes and chests; buys medal packs for whoever is lowest
      if (active && s.hourglassesLeft() > 0 && s.gems >= D.HOURGLASS_GEMS + 100) book('g:hourglass', () => { const r = s.useHourglass(); if (r) L.gold.rewards = L.gold.rewards.plus(r); });
      if (active && s.goldBoostReady() && s.gems >= D.GOLD_BOOST_GEMS + 100) book('g:goldBoost', () => s.buyGoldBoost());
      if (s.gems >= D.HERO_SHOP_REFRESH_GEMS + 200 && brng() < 0.3) book('g:shopRefresh', () => s.refreshHeroShopEarly());
      s.heroShopState().offers.forEach((o: any, i: number) => { if (!o.bought) book('g:heroShop', () => s.buyHeroShopOffer(i)); });
      if (s.rekindles > 0 && brng() < 0.2) {/* boost bought at Rekindle, see maybeRekindle */}
      while (s.gems >= CHEST_COST * 10) { book('g:heroChest', () => s.summon(10)); L.chestsOpened += 10; }
      return;
    }
    // 'optimal' / 'sensible': cheapest crests per Gem for the heroes the strategy wants
    const targets = crestTargets();
    const want = new Set(targets.slice(0, P.gems === 'optimal' ? 6 : 10).map((h) => h.id));
    // Monthly Crest Pack: 1,000 Gems -> 500 Wild Crests (2/4/8 Gems a Common/Rare/Epic crest)
    if (P.monthlyPack) { const m = s.monthlyPackState(NOW); if (!m.bought && s.gems >= m.gems) book('g:monthlyPack', () => s.buyMonthlyPack(NOW)); }
    // Hero Shop offers for wanted heroes (C 2, R 4, E 8 Gems a crest)
    s.heroShopState().offers.forEach((o: any, i: number) => { if (!o.bought && want.has(o.heroId)) book('g:heroShop', () => s.buyHeroShopOffer(i)); });
    // weekly deal: Hero Voucher (C 2.5 / R 5 / E 8.3) or Ticket Crate (6.7 Gems a ticket)
    const d = s.dealState(NOW);
    if (!d.bought && s.gems >= d.gems + P.gemFloor) {
      if (d.kind === 'voucher') book('g:voucher', () => s.buyDeal(NOW));
      else if (P.buyCrate && s.trialsUnlocked()) book('g:ticketCrate', () => s.buyDeal(NOW));
    }
    while (s.vouchers > 0) { const t = targets.find((h) => s.voucherMedals(h.id) !== null); if (!t || !book('g:voucher', () => s.useVoucher(t.id))) break; s.evolveAll(); }
    // featured hero bundles when it's a wanted hero
    const f = s.featuredState();
    for (const kind of ['small', 'big'] as const) if (!f[kind] && want.has(f.hero.id) && s.gems >= P.gemFloor) book('g:featured', () => s.buyFeatured(kind));
    // Ascendant Chest: the first few cheap buys of the week for the picked Ascendant hero
    if (P.ascChestBuys > 0) {
      const st = s.ascendantChestState(NOW);
      for (let k = 0; st && k < P.ascChestBuys; k++) {
        const c = s.ascendantChestState(NOW);
        if (!c?.next || c.bought >= P.ascChestBuys || s.gems < c.next.gems + P.gemFloor) break;
        book('g:ascChest', () => s.buyAscendantChest(NOW));
      }
    }
    // Trial tickets with Gems (2 crests + Essence for 10 Gems) when the Trials still pay
    if (active && P.buyTickets && s.trialsUnlocked() && s.trialTickets() < 5) { const n = Math.min(s.ticketsBuyable(), Math.floor((s.gems - P.gemFloor) / D.TICKET_GEMS)); if (n > 0) book('g:tickets', () => s.buyTickets(n)); }
    // Crest packs (100 crests: C 3 / R 5 / E 10 Gems a crest) on the wanted hero closest to a star
    for (let guard = 0; guard < 50; guard++) {
      const t = targets.find((h) => (MEDAL_PACK.gems as any)[h.rarity] !== undefined && !String(h.id).startsWith('asc_'));
      if (!t) break;
      const pc = (MEDAL_PACK.gems as any)[t.rarity];
      if (s.gems < pc + P.gemFloor || !P.packs) break;
      book('g:crestPack', () => s.buyMedalPack(t.id));
      s.evolveAll();
    }
    if (P.gems === 'sensible') while (s.gems >= CHEST_COST * 10 + P.gemFloor) { book('g:heroChest', () => s.summon(10)); L.chestsOpened += 10; }
  }

  // ---------- chores (every session start and every ~15 min of play) ----------
  let doDailies = true;
  function chores(active: boolean) {
    thaw();
    if (doDailies) {
      for (const r of s.dailies()) if (r.progress >= r.def.goal) book('dailies', () => s.claimDaily(r.def.stat));
      book('bundle', () => s.claimMedalBundle());
    }
    book('login', () => s.claimLogin());
    book('spin', () => s.spin());
    for (const a of s.achievements()) if (a.ready) book('achievements', () => s.claimAchievement(a.def.id));
    for (const b of R.BOOTCAMP) book('bootcamp', () => s.claimBootcamp(b.id));
    book('milestones', () => s.claimMilestones());
    // relics: equip what fits
    for (const r of RELICS) if (s.relics[r.id] && !s.equipped.includes(r.id)) s.toggleRelic(r.id);
    if (P.paidGemsPerDay > 0) { /* paid Gems land once a day, see day loop */ }
    spendGems(active);
    systems(active);
    // unlock and evolve
    for (const h of HEROES) if (s.canUnlock(h)) s.unlockHero(h.id);
    s.evolveAll();
    ascend();
    pickLineup();
    if (active && s.trialsUnlocked()) trials();
    if (active) relicChores();
    observatory();
    spendEmbers();
    dirty();
    carryCache = '';
    freeze();
  }

  function trials() {
    s.refreshTickets();
    for (let guard = 0; s.trialTickets() > 0 && guard < 200; guard++) {
      let played = false;
      for (const el of s.openTrials()) {
        if (s.trialTickets() <= 0) break;
        let pick = 0;
        for (let tier = s.trialUnlocked(el); tier >= 1; tier--) if (s.trialReqMet(tier) && s.simulateTrial(tier, el).won) { pick = tier; break; }
        if (!pick) continue;
        const sim = s.simulateTrial(pick, el);
        const e0 = Object.values(s.essences).reduce((a: number, b: any) => a + b, 0) as number;
        const r = book('trials', () => s.finishTrial(el, pick, true, sim.seconds));
        if (r) { L.trialWins++; L.essenceIn += (Object.values(s.essences).reduce((a: number, b: any) => a + b, 0) as number) - e0; }
        played = true;
      }
      if (!played) break;
    }
  }

  function relicChores() {
    for (let k = 0; k < 2; k++) {
      for (const r of s.relicShopState().offers) if (s.canAffordRelic(r)) s.buyRelic(r.id);
      if (!s.refreshRelicShop()) break;
    }
    for (let guard = 0; guard < 600; guard++) {
      const ups = RELICS.filter((r: any) => s.relics[r.id] && s.canUpgradeRelic(r));
      if (!ups.length) break;
      const up = P.relics === 'random' ? ups[Math.floor(brng() * ups.length)] : ups.sort((a: any, b: any) => (s.relicNextCost(a) ?? 0) - (s.relicNextCost(b) ?? 0))[0];
      book('relicUp', () => s.upgradeRelic(up.id));
    }
    for (const r of RELICS) if (s.relics[r.id] && s.enhanceCost(r) !== null) book('relicEnhance', () => s.enhanceRelic(r.id));
    // Essence / Stones sinks (src/sinks.ts), when the game has them: Tempering, half of spare Essence into Attunement, weekly Alchemist trades.
    if (typeof s.temperRelic === 'function') {
      for (const r of RELICS) if (s.relics[r.id]) for (let g = 0; g < 40 && s.temperCost(r) !== null; g++) if (!book('relicTemper', () => s.temperRelic(r.id))) break;
      for (const el of ['water', 'earth', 'fire', 'light', 'dark']) {
        const keep = Math.floor((s.essences[el] ?? 0) / 2);
        for (let g = 0; g < 500 && (s.essences[el] ?? 0) - s.attuneNextCost(el) >= keep; g++) if (!s.buyAttune(el, 1)) break;
      }
      while (s.enhanceStones > 1000 && s.alchemyCore()) { /* weekly limit stops it */ }
      if (typeof s.alchemyOreCore === 'function') {
        while (Math.min(s.forge.ore, s.forge.crystal) > 20_000 && s.alchemyOreCore()) { /* weekly */ }
        while (Math.min(s.forge.ore, s.forge.crystal) > 20_000 && s.alchemyOreDust()) { /* weekly */ }
      }
      const els = ['water', 'earth', 'fire', 'light', 'dark'].sort((a, b) => (s.essences[b] ?? 0) - (s.essences[a] ?? 0));
      for (let g = 0; g < 5; g++) if (!s.alchemyDust(els[0])) break;
      const most = s.swapMost(els[0], els[4]);
      if (most > 0) s.alchemySwap(els[0], els[4], most);
    }
    for (const r of RELICS) if (s.relics[r.id] && !s.equipped.includes(r.id)) s.toggleRelic(r.id);
  }

  function observatory() {
    if (!s.observatoryOpen()) return;
    const order = ['embers', 'tickets', 'speed', 'offline', 'skip'];
    for (let guard = 0; guard < 100; guard++) {
      let bought = false;
      for (const id of order) if (s.buyObservatory(id)) { bought = true; break; }
      if (!bought) break;
    }
  }

  function ascend() {
    for (const h of HEROES) if (String(h.id).startsWith('asc_') && s.levels[h.id] > 0) while (s.ascend(h.id)) dirty();
  }

  // ---------- systems: Scouting, Wild Crests, weapons, Rush, Glyphs, Colosseum, guild ----------
  let lastRushId = '';
  function systems(active: boolean) {
    if (P.scouting && s.scoutOpen()) {
      s.scoutBoard(NOW);
      for (const sl of [...s.scout.slots]) if (s.scoutDone(sl.slot, NOW)) {
        const r = book('scouting', () => s.claimScout(sl.slot, NOW));
        if (r) for (const k of Object.keys(L.forgeIn)) L.forgeIn[k] += (r as any)[k] ?? 0;
      }
      s.deployAllScouts(NOW);
    }
    // Wild Crests to wanted heroes
    const targets = crestTargets();
    for (let guard = 0; guard < 200; guard++) {
      const t = targets.find((h) => s.wildCrestCost(h.id) !== null && need(h) > 0 && need(h) < 1e9 && s.wildCrests >= s.wildCrestCost(h.id)!);
      if (!t) break;
      const n = Math.min(need(t), Math.floor(s.wildCrests / s.wildCrestCost(t.id)!));
      if (n < 1 || !s.useWildCrests(t.id, n)) break;
      s.evolveAll();
    }
    // weapons: lineup (or everyone for 'spread')
    const wpool = P.weapons === 'spread' ? HEROES.filter((h: Hero) => s.levels[h.id] > 0) : P.strategy === 'concentrated' ? [lineup().find((h) => h.id === carryId())!, ...lineup()].filter(Boolean) : lineup();
    for (let guard = 0; guard < 200; guard++) {
      const cand = wpool.filter((h: Hero) => s.weaponBlock(h.id) === null).sort((a: Hero, b: Hero) => (P.strategy === 'concentrated' && a.id === carryId() ? -1 : 0) || s.weaponLevel(a.id) - s.weaponLevel(b.id));
      if (!cand.length || !s.upgradeWeapon(cand[0].id)) break;
    }
    // Rush and the Colosseum don't change stars or relics: their many Combat Power lookups can use the memo.
    freeze();
    if (P.rush && active) rush();
    thaw();
    glyphs();
    freeze();
    if (P.pvp && active) pvp();
    thaw();
    if (P.guild) guildDaily(active);
  }

  const GOOD = new Set(['attack', 'frenzy', 'crit', 'speed', 'health']);
  const gScore = (g: any) => g.star * 10 + g.level + (GOOD.has(g.family) ? 3 : 0) + (g.family === 'attack' ? 2 : 0);
  function glyphs() {
    for (const h of lineup()) {
      const { slots, maxStar } = s.glyphSlots(h.id);
      for (let i = 0; i < slots; i++) {
        const cur = s.glyphAt(h.id, i);
        const best = s.bagGlyphs().filter((g: any) => g.star <= maxStar).sort((a: any, b: any) => gScore(b) - gScore(a))[0];
        if (!best) break;
        if (!cur) s.socketGlyph(h.id, i, best.id);
        else if (gScore(best) > gScore(cur) + 5) {
          if (!GL.glyphBound(cur)) s.socketGlyph(h.id, i, best.id);
          else if (s.unbinders > 0) s.socketGlyph(h.id, i, best.id, 'unbind');
          else if (best.star >= cur.star + 2) s.socketGlyph(h.id, i, best.id, 'break');
        }
      }
    }
    if (s.bagGlyphs().length > 60) s.salvageGlyphs(s.bagGlyphs().filter((g: any) => g.star <= 2).map((g: any) => g.id));
    for (let guard = 0; guard < 400; guard++) {
      const sock = s.glyphs.filter((g: any) => g.hero && GL.glyphLevelCost(g.star, g.level) !== null).sort((a: any, b: any) => GL.glyphLevelCost(a.star, a.level)! - GL.glyphLevelCost(b.star, b.level)!);
      if (!sock.length || !s.levelGlyph(sock[0].id)) break;
    }
  }

  function rush() {
    if (!s.rushOpen() || !s.rushOn(NOW)) return;
    s.rushSync(NOW);
    if (s.rush.id !== lastRushId) { if (lastRushId) L.rushPoints.push(-1); lastRushId = s.rush.id; }
    const fight = (b: number, hero: string): boolean => {
      if (!s.rushFoes(b, NOW).length) return false;
      for (const f of [2, 1, 0]) {
        if (s.rushBlock(b, f, hero, NOW) !== null) return false;
        const fc = s.rushForecast(b, f, hero);
        if (fc && fc.won) { book('rush', () => { s.startRush(b, f, hero, NOW); s.finishRush(true); }); L.rushFights++; return true; }
      }
      if (s.rushBlock(b, 0, hero, NOW) !== null) return false;
      s.startRush(b, 0, hero, NOW); s.finishRush(false); L.rushFights++;
      return true;
    };
    for (let b = 2; b >= 0; b--) for (const h of s.rushHeroes(b)) for (let k = 0; k < 2 && s.rushFree(h.id, NOW) > 0; k++) if (!fight(b, h.id)) break;
    for (let guard = 0; guard < 60 && s.rush.tickets >= RU.RUSH_FIGHT_TICKETS; guard++) {
      let done = false;
      for (let b = 2; b >= 0 && !done; b--) { const h = s.rushHeroes(b)[0]; if (h && fight(b, h.id)) done = true; }
      if (!done) break;
    }
    L.rushPoints[L.rushPoints.length - 1] = s.rush.points;
    if (L.rushPoints.length === 0) L.rushPoints.push(s.rush.points);
    for (const it of ['grand', 'family', 'glyph', 'coreR', 'dust', 'unbinder'] as const) for (let k = 0; k < 10; k++) if (!s.buyRushItem(it, it === 'family' ? 'attack' : undefined)) break;
    for (const h of crestTargets().slice(0, 5)) for (let k = 0; k < 2; k++) if (!book('rushShop', () => s.buyRushCrests(h.id, NOW))) break;
  }

  function pvp() {
    if (!s.pvpOpen()) return;
    const m0 = s.starmotes;
    s.pvpTick(NOW);
    s.refreshPvpTickets(NOW);
    for (let guard = 0; guard < 15 && s.pvp.tickets > 0; guard++) {
      if (!s.pvp.picks.length) s.rollPvpOpponents(NOW);
      let slot = -1;
      for (let i = 0; i < s.pvp.picks.length; i++) { const fc = s.pvpForecast(i); if (fc?.won) { slot = i; break; } }
      if (!s.startPvp(slot >= 0 ? slot : 0, NOW)) break;
      s.finishPvp(slot >= 0, NOW);
      L.pvpFights++; if (slot >= 0) L.pvpWins++;
    }
    L.motesIn += s.starmotes - m0;
    for (let guard = 0; guard < 50; guard++) {
      const c = lineup().filter((h) => s.awakenBlock(h.id) === null).sort((a, b) => (s.awakenCost(a.id) ?? 1e9) - (s.awakenCost(b.id) ?? 1e9));
      if (!c.length || !s.awakenHero(c[0].id)) break;
    }
  }

  // ---------- guild (server side modelled: a guild of peers about as strong as the player) ----------
  const G = { week: '', start: 1, level: 1, hpLeft: new Decimal(0), lastTop: 0, beaten: 0, kills: [] as Array<{ week: string; level: number; n: number }>, research: 0, pendingWeek: null as null | { top: number; beaten: number }, fightsDay: '', fightsLeft: 0, questDone: false, requestAt: 0 };
  function guildWeekRoll() {
    const week = F.utcWeekStart(NOW);
    if (G.week === week) return;
    if (G.week) {
      // the finished week pays on the next claim
      book('guild', () => s.payGuildBossRewards(G.kills, [{ top: G.level - 1, beaten: G.beaten }]));
      L.guildWeeks.push({ week: G.week, start: G.start, top: G.level - 1, beaten: G.beaten });
      // quests: the shared track (if the guild finished it) and 4 personal rewards
      if (G.questDone) for (const t of ['track1', 'track2', 'track3', 'track4']) book('guildQuest', () => s.payGuildQuest(t));
      for (let i = 0; i < 4; i++) book('guildQuest', () => s.payGuildQuest('kills'));
      G.lastTop = G.level - 1;
    }
    G.week = week; G.start = F.guildBossStartLevel(G.lastTop); G.level = G.start; G.hpLeft = F.guildBossHp(G.level); G.beaten = 0; G.kills = [];
    G.questDone = P.guild!.questTrack;
    if (P.ascChestBuys > 0 || P.guild) {
      const pick = HEROES.find((h: Hero) => String(h.id).startsWith('asc_') && s.inLineup(h.id)) ?? HEROES.find((h: Hero) => String(h.id).startsWith('asc_') && s.levels[h.id] > 0);
      if (pick && s.guildAscPick !== pick.id) s.setGuildAscPick(pick.id);
    }
  }
  function guildDaily(active: boolean) {
    if (!s.rekindles) return; // guilds open after the first Rekindle
    guildWeekRoll();
    const el = F.guildBossElement(G.week);
    const today = R.dayKey(NOW);
    if (G.fightsDay !== today) { G.fightsLeft = Math.min(D.GUILD_BOSS_FIGHT_CAP, G.fightsLeft + D.GUILD_BOSS_ATTEMPTS * (G.fightsDay ? Math.max(1, Math.round((Date.parse(today) - Date.parse(G.fightsDay)) / 86400000)) : 1)); G.fightsDay = today; }
    if (!active) return;
    // The player's own fights; the rest of the guild (members-1 peers) fights alongside, each doing the same damage.
    const fights = Math.min(G.fightsLeft, P.guild!.fightsPerSession);
    if (fights > 0) {
      if (s.guildBossPicks.length === 0) s.guildBossPicks = lineup().map((h) => h.id);
      const dmg = s.guildBossDamage(el);
      for (let f = 0; f < fights; f++) {
        G.fightsLeft--;
        const hp = F.guildBossHp(G.level);
        book('guildBoss', () => s.payGuildBossAttempt(G.level, dmg, hp));
        // the guild's damage for this round of fights: the player plus peers (each peer fights about as often)
        let pool = dmg.times(P.guild!.members * P.guild!.peerShare);
        for (let hits = 0; hits < 100 && pool.gte(G.hpLeft); hits++) {
          pool = pool.minus(G.hpLeft);
          G.beaten++;
          G.kills.push({ week: G.week, level: G.level, n: G.level - G.start + 1 });
          G.level++;
          G.hpLeft = F.guildBossHp(G.level);
        }
        G.hpLeft = G.hpLeft.minus(pool);
      }
      // research: each attempt by every member adds 10 + level to the focus branch (combat first)
      G.research += fights * P.guild!.members * (10 + G.level);
      const rank = F.researchRank(G.research / 4);
      s.setGuildResearch({ combat: rank, prosperity: rank, exploration: rank, elemental: rank });
    }
    // requests and donations: one Common request every 4 h is filled; giving pays Guild Coins
    if (NOW - G.requestAt >= D.GUILD_REQUEST_HOURS * 3600000) {
      const common = crestTargets().find((h) => h.rarity === 'common') ?? S.SHOP_HEROES.find((h: Hero) => h.rarity === 'common');
      if (common) book('guildRequest', () => s.receiveGuildMedals([{ heroId: common.id, crests: D.GUILD_REQUEST_GOAL }]));
      G.requestAt = NOW;
    }
    for (let i = 0; i < P.guild!.donationsPerSession; i++) { const c = S.SHOP_HEROES.find((h: Hero) => h.rarity === 'common'); book('guildDonate', () => s.giveGuildMedals(c.id, D.GUILD_DONATE_MAX)); }
    // Guild Shop: weekly chests, Wild Medals for the crest target, daily offers for wanted heroes, Warsteel
    for (let k = 0; k < 10 && s.guildItemReady('chest', NOW); k++) book('gc:chest', () => s.buyGuildItem('chest', NOW));
    const t = crestTargets()[0];
    if (t && s.wildMedalCost(t.id) !== null) { const n = Math.min(s.wildMedalsLeft(NOW), Math.floor(s.guildCredits / s.wildMedalCost(t.id)!)); if (n > 0) book('gc:wildMedals', () => s.buyWildMedals(t.id, n, NOW)); }
    const want = new Set(crestTargets().slice(0, 6).map((h) => h.id));
    s.guildShopState(NOW).offers.forEach((o: any, i: number) => { if (!o.bought && want.has(o.heroId)) book('gc:offer', () => s.buyGuildOffer(i, NOW)); });
    for (let k = 0; k < 3 && s.guildItemReady('warsteel', NOW); k++) book('gc:warsteel', () => s.buyGuildItem('warsteel', NOW));
    while (s.guildCredits >= 400 && s.guildItemReady('stone', NOW)) book('gc:stone', () => s.buyGuildItem('stone', NOW));
    for (let guard = 0; guard < 100; guard++) {
      const up = GR.GUILD_RELICS.filter((r: any) => s.guildRelicOpen(r) && s.guildRelicNextCost(r) !== null && s.warsteel >= s.guildRelicNextCost(r)!).sort((a: any, b: any) => s.guildRelicNextCost(a)! - s.guildRelicNextCost(b)!)[0];
      if (!up || !s.upgradeGuildRelic(up.id)) break;
    }
  }

  // ---------- one stage of active play ----------
  let lastBestAt = 0, runBestAt = 0, goldChestAcc = 0, shinyAcc = 0;
  const runs: Array<{ n: number; start: number; best: number; minutes: number; day: number }> = [];
  let runStartActive = 0;
  function playStage(): number {
    const stage = s.stage;
    const speed = (s.bestStage >= D.SPEED_UNLOCK_STAGE ? 2 : 1) * s.gameSpeedBonus();
    const gm = teamGoldMult() * s.goldBoostMult(NOW);
    let gameT: number;
    let killGold = new Decimal(0), clearGold = new Decimal(0), kills = 0;
    if (F.isBossStage(stage)) {
      const fight = beatsBoss(stage);
      if (fight.won) {
        gameT = WALK + fight.seconds;
        clearGold = F.goldPerKill(stage).times(10 * gm).plus(F.stageClearGold(stage));
        s.track('stages');
        s.reachStage(stage + 1);
        s.autoAdvance = true;
      } else {
        gameT = WALK + 30;
        s.autoAdvance = false;
        s.stage = stage - 1;
      }
    } else {
      const c = stageClear(stage);
      if (!c) {
        gameT = 60;
        s.autoAdvance = false;
        s.stage = Math.max(s.runStartStage, stage - 1);
      } else {
        gameT = c.t;
        kills = c.kills;
        killGold = F.goldPerKill(stage).times(c.kills * gm * c.gold);
        clearGold = F.stageClearGold(stage);
        s.track('kills', c.kills);
        s.track('stages');
        if (s.autoAdvance) { s.reachStage(stage + 1); s.rollStageSkip(); }
        else if (F.isBossStage(stage + 1) ? beatsBoss(stage + 1).won : stageClear(stage + 1) !== null) { s.autoAdvance = true; s.reachStage(stage + 1); }
      }
    }
    const real = gameT / speed;
    // floating chests about every 35 game seconds; P.chestTap of them tapped; 10% are gold chests paying Gems
    const chests = (gameT / 35) * P.chestTap;
    const chestGold = F.goldPerKill(stage).times(12 * chests * (1 + s.relicBonus('gold')) * s.goldBoostMult(NOW));
    goldChestAcc += chests * 0.1;
    while (goldChestAcc >= 1) { goldChestAcc -= 1; book('goldChests', () => s.takeChestGems(NOW)); }
    s.track('chests', chests);
    // shinies: 1 in 2,000 mobs, up to 5 a day
    shinyAcc += kills / 2000;
    while (shinyAcc >= 1) { shinyAcc -= 1; const r = book('shiny', () => s.catchShiny('mob_grunt_water', brng(), NOW)); if (r) L.shinies++; }
    const auto = s.tickMarket(real);
    const manual = marketIncomePerSec(true).minus(s.marketAutoPerSec()).times(real);
    const gain = killGold.plus(clearGold).plus(chestGold);
    s.gold = s.gold.plus(gain).plus(manual);
    L.gold.kills = L.gold.kills.plus(killGold);
    L.gold.clears = L.gold.clears.plus(clearGold);
    L.gold.chests = L.gold.chests.plus(chestGold);
    L.gold.market = L.gold.market.plus(auto).plus(manual);
    s.recordIncome(gain, real);
    s.recordStageTime(real);
    s.track('minutes', real / 60);
    activeSec += real;
    NOW += real * 1000;
    if (s.runBestStage > runBestAt) { runBestAt = s.runBestStage; lastBestAt = activeSec; }
    return real;
  }

  function maybeRekindle(): boolean {
    if (!s.canRekindle()) return false;
    if ((activeSec - lastBestAt) / 60 < P.rekindleStuckMin) return false;
    thaw();
    const best = s.runBestStage, start = s.runStartStage;
    let mult = 1;
    if (P.gems === 'wasteful' && s.gems >= 300) mult = 2;
    const g0 = s.gems;
    const r = s.rekindle(mult);
    if (!r) { freeze(); return false; }
    if (g0 > s.gems) add(L.gemsOut, 'g:rekindleBoost', g0 - s.gems);
    L.emberIn = L.emberIn.plus(r.embers);
    add(L.stonesIn, 'playerLevel', r.stones);
    runs.push({ n: s.rekindles, start, best, minutes: (activeSec - runStartActive) / 60, day: +day().toFixed(2) });
    runStartActive = activeSec; runBestAt = s.runBestStage; lastBestAt = activeSec;
    observatory();
    spendEmbers();
    dirty();
    freeze();
    return true;
  }

  // ---------- snapshots ----------
  const snaps: any[] = [];
  const daily: any[] = [];
  const firsts: Record<string, number> = {};
  const mark = (k: string, cond: boolean) => { if (cond && firsts[k] === undefined) firsts[k] = +day().toFixed(2); };
  function snapshot(tag: string) {
    thaw();
    const lu = lineup();
    const owned = HEROES.filter((h: Hero) => s.levels[h.id] > 0);
    const rar: Record<string, number> = {};
    for (const h of owned) rar[s.formDef(h).rarity] = (rar[s.formDef(h).rarity] ?? 0) + 1;
    const stars: Record<string, number> = {};
    for (const h of owned) { const k = (s.stars[h.id] ?? 0) + 1; stars[k] = (stars[k] ?? 0) + 1; }
    const avg = (xs: number[]) => (xs.length ? +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2) : 0);
    const relicsOwned = RELICS.filter((r: any) => s.relics[r.id] > 0);
    const essence = Object.values(s.essences).reduce((a: number, b: any) => a + (b as number), 0) as number;
    const trialBest = TRIAL_ROTATION.map((e: string) => s.trialBest[e] ?? 0);
    const glyphN = lu.map((h) => s.heroGlyphs(h.id).length);
    const ascForms = HEROES.filter((h: Hero) => String(h.id).startsWith('asc_') && s.levels[h.id] > 0).map((h: Hero) => `${h.id}:${(s.stars[h.id] ?? 0) + 1}*F${s.formOf(h.id) + 1}`);
    const rec = {
      tag, day: +day().toFixed(2), activeH: +(activeSec / 3600).toFixed(2), stage: s.stage, best: s.bestStage, rekindles: s.rekindles, keeper: s.keeperLevel(),
      owned: owned.length, rarity: rar, stars, team: lu.map((h) => `${h.name}(${s.formDef(h).rarity[0]}${(s.stars[h.id] ?? 0) + 1}★${s.awaken[h.id] ? '+' + s.awaken[h.id] + 'p' : ''})`),
      teamSize: lu.length, teamStarsAvg: avg(lu.map((h) => (s.stars[h.id] ?? 0) + 1)), teamStarsMax: Math.max(0, ...owned.map((h: Hero) => (s.stars[h.id] ?? 0) + 1)),
      goldLvAvg: avg(lu.map((h) => s.levels[h.id])), goldLvMax: Math.max(0, ...lu.map((h) => s.levels[h.id])),
      emberLvAvg: avg(lu.map((h) => s.emberLevels[h.id] ?? 0)), emberLvMax: Math.max(0, ...lu.map((h) => s.emberLevels[h.id] ?? 0)),
      heroLvAvg: avg(lu.map((h) => s.heroLevel(h.id))), heroLvMax: Math.max(0, ...lu.map((h) => s.heroLevel(h.id))),
      pinkAvg: avg(lu.map((h) => s.awaken[h.id] ?? 0)), weaponAvg: avg(lu.map((h) => s.weaponLevel(h.id))), weaponMax: Math.max(1, ...owned.map((h: Hero) => s.weaponLevel(h.id))),
      glyphsSocketed: glyphN.reduce((a, b) => a + b, 0), glyphAtkAvg: avg(lu.map((h) => s.glyphBonus(h.id).atk)),
      relicsOwned: relicsOwned.length, relicStarsOpen: s.relicStarsOpen(), relicLvAvg: avg(relicsOwned.map((r: any) => s.relics[r.id])), relicSlots: s.relicSlots, relicAtk: +s.relicBonus('atk').toFixed(1), relicHp: +s.relicBonus('hp').toFixed(1),
      setsComplete: D.RELIC_SETS.filter((x: any) => s.setComplete(x.id)).length,
      teamSlots: s.teamSlots, ultSlots: s.ultSlots,
      gems: Math.floor(s.gems), gold: lg(s.gold), embers: lg(new Decimal(s.embers)), stones: s.enhanceStones, essenceLog: essence > 0 ? +Math.log10(essence).toFixed(2) : 0,
      tickets: s.trialTickets(), wild: s.wildCrests, motes: s.starmotes, forge: { ...s.forge }, glyphDust: s.glyphDust, guildCoins: s.guildCredits, warsteel: s.warsteel, rushCoins: s.rushCoins,
      trialBest, trialMax: Math.max(...trialBest), legendaryMedals: s.legendaryMedals,
      trophies: s.pvp?.trophies ?? 0, rushLevel: s.rush?.level ?? 0, observatory: { ...s.observatory }, ascendant: ascForms,
      cpLog: lg(s.totalCombatPower()), fixedTeamCpLog: lg(s.fixedTeamCp(lu)), guildBossTop: G.lastTop, guildBossLevel: G.level,
      modes: { trials: s.trialsUnlocked(), rekindle: s.rekindles > 0, observatory: s.observatoryOpen(), scouting: s.scoutOpen(), colosseum: s.pvpOpen(), rush: s.rushOpen(), guild: !!P.guild && s.rekindles > 0, awakening: s.awakenOpen() },
      ledger: {
        goldLog: Object.fromEntries(Object.entries(L.gold).map(([k, v]) => [k, lg(v as Decimal)])),
        goldSpentLog: { heroes: lg(L.goldSpent.heroes), stalls: lg(L.goldSpent.stalls) },
        gemsIn: { ...L.gemsIn }, gemsOut: { ...L.gemsOut }, crestsIn: { ...L.crestsIn }, stonesIn: { ...L.stonesIn }, guildCoinsIn: { ...L.guildCoinsIn }, guildCoinsOut: { ...L.guildCoinsOut },
        emberLog: lg(L.emberIn), essenceIn: Math.round(L.essenceIn), motesIn: L.motesIn, wildIn: L.wildIn, forgeIn: { ...L.forgeIn },
        trialWins: L.trialWins, chestsOpened: L.chestsOpened, pvp: [L.pvpFights, L.pvpWins], rushFights: L.rushFights, rushPoints: [...L.rushPoints], shinies: L.shinies,
      },
    };
    freeze();
    return rec;
  }

  // ---------- main loop ----------
  const sessionSec = (P.hoursPerDay * 3600) / P.sessionsPerDay;
  const firstSessionSec = Math.max(sessionSec, (P.firstSessionMinutes ?? 0) * 60);
  let lastSeen = NOW;
  const doneActive = new Set<number>();
  freeze();
  for (let d = 0; d < cfg.days; d++) {
    const dayStart = T0 + d * 86400000;
    const skip = d > 0 && brng() < P.skipDayChance;
    doDailies = brng() < P.dailiesChance;
    if (!skip) {
      for (let k = 0; k < P.sessionsPerDay; k++) {
        const at = dayStart + Math.round((k * 15 * 3600000) / P.sessionsPerDay);
        if (at > NOW) {
          thaw();
          NOW = at;
          const off = s.applyOffline((at - lastSeen) / 1000);
          if (off) L.gold.offline = L.gold.offline.plus(off.gold);
        }
        chores(true);
        const len = d === 0 && k === 0 ? firstSessionSec : sessionSec;
        const end = activeSec + len;
        let since = 0;
        while (activeSec < end) {
          const r = playStage();
          since += r;
          spendGold();
          maybeRekindle();
          for (const h of CHECK_ACTIVE_H) if (!doneActive.has(h) && activeSec >= h * 3600) { doneActive.add(h); snaps.push(snapshot(`active ${h}h`)); }
          if (since > 900) { chores(true); since = 0; }
        }
        chores(true);
        lastSeen = NOW;
      }
    }
    // paid Gems (hypothetical purchases) arrive once a day
    if (P.paidGemsPerDay > 0) add(L.gemsIn, 'paid', P.paidGemsPerDay), (s.gems += P.paidGemsPerDay);
    // end of day: move the clock to next morning (offline is applied at the next session)
    NOW = Math.max(NOW, dayStart + 86400000 - 1);
    thaw();
    if (P.guild) guildDaily(false);
    const rec = snapshot(`day ${d + 1}`);
    daily.push(rec);
    if (CHECK_DAYS.includes(d + 1)) snaps.push(rec);
    mark('rekindle', s.rekindles > 0); mark('trials', s.trialsUnlocked()); mark('team5', s.teamSlots >= 5); mark('team10', s.teamSlots >= 10);
    mark('stage1000', s.bestStage >= 1000); mark('stage2000', s.bestStage >= 2000); mark('stage3000', s.bestStage >= 3000); mark('stage5000', s.bestStage >= 5000);
    mark('first4star', rec.teamStarsMax >= 4); mark('first5star', rec.teamStarsMax >= 5); mark('first6star', rec.teamStarsMax >= 6); mark('first7star', rec.teamStarsMax >= 7);
    mark('team4star', lineup().every((h) => (s.stars[h.id] ?? 0) >= 3)); mark('team5star', lineup().every((h) => (s.stars[h.id] ?? 0) >= 4));
    mark('team6star', lineup().every((h) => (s.stars[h.id] ?? 0) >= 5)); mark('team7star', lineup().every((h) => (s.stars[h.id] ?? 0) >= 6));
    mark('allRelics1to5', RELICS.filter((r: any) => r.stars <= 5).every((r: any) => s.relics[r.id] > 0)); mark('relic6open', s.relicStarsOpen() >= 6); mark('relic7open', s.relicStarsOpen() >= 7); mark('relic8open', s.relicStarsOpen() >= 8);
    mark('weapon9', HEROES.some((h: Hero) => s.weaponLevel(h.id) >= 9)); mark('teamWeapon9', lineup().every((h) => s.weaponLevel(h.id) >= 9));
    mark('allHeroesOwned', S.SHOP_HEROES.every((h: Hero) => s.levels[h.id] > 0)); mark('firstLegendary', HEROES.some((h: Hero) => h.rarity === 'legendary' && s.levels[h.id] > 0));
    mark('colosseum', s.pvpOpen()); mark('scouting', s.scoutOpen()); mark('rush', s.rushOpen()); mark('trial25', rec.trialMax >= 25); mark('trial30', rec.trialMax >= 30); mark('trial40', rec.trialMax >= 40);
    mark('ascFinal', HEROES.some((h: Hero) => String(h.id).startsWith('asc_') && s.formOf(h.id) >= 3));
    freeze();
    if (cfg.progressEvery && (d + 1) % cfg.progressEvery === 0) console.error(`[${cfg.label ?? cfg.policy}] day ${d + 1} best ${s.bestStage} gems ${Math.floor(s.gems)} stars ${rec.teamStarsAvg} ember ${rec.emberLvAvg}`);
  }
  thaw();
  return { config: { ...cfg, policy: P }, snaps, daily, runs, firsts };
}
