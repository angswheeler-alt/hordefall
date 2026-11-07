// Economy database: every cost, reward and odds table, read from the game's own modules (no numbers typed in here).
//   npx vite-node tools/sim/econ-db.ts -- --out tools/sim/out/econ-db.json
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
(globalThis as any).localStorage = { getItem: () => null, setItem() {}, removeItem() {}, clear() {} };
const SRC = process.env.SIM_SRC ?? new URL('../../src', import.meta.url).pathname;
const D = await import(SRC + '/data.ts');
const F = await import(SRC + '/formulas.ts');
const R = await import(SRC + '/rewards.ts');
const S = await import(SRC + '/state.ts');
const W = await import(SRC + '/weapons.ts');
const SC = await import(SRC + '/scouting.ts');
const GL = await import(SRC + '/glyphs.ts');
const RU = await import(SRC + '/rush.ts');
const CO = await import(SRC + '/colosseum.ts');
const OB = await import(SRC + '/observatory.ts');
const GR = await import(SRC + '/guildRelics.ts');
const AS = await import(SRC + '/ascendant.ts');
const J = await import(SRC + '/journal.ts');

const args = process.argv.slice(2).filter((a) => a !== '--');
const out = args[args.indexOf('--out') + 1] ?? 'tools/sim/out/econ-db.json';

const ev = (rolls: Array<[number, number]>) => rolls.reduce((t, [v, w]) => t + v * w, 0) / rolls.reduce((t, [, w]) => t + w, 0);
const count = (xs: any[], f: (x: any) => string) => xs.reduce((m: Record<string, number>, x) => ((m[f(x)] = (m[f(x)] ?? 0) + 1), m), {});
const shop = S.SHOP_HEROES;
const byRarity = count(shop, (h) => h.rarity);
const byElRar = count(shop, (h) => `${h.element}/${h.rarity}`);
const cum = (xs: number[]) => xs.map((_, i) => xs.slice(0, i + 1).reduce((a, b) => a + b, 0));

// ---- crests per Gem ----
const chestW = D.CHEST_RARITY_WEIGHTS as Record<string, number>;
const wTot = Object.values(chestW).reduce((a, b) => a + b, 0);
const perDrop = Object.fromEntries(Object.keys(chestW).map((r) => [r, ev(D.CREST_ROLLS[r])]));
const chestCrests = Object.fromEntries(Object.keys(chestW).map((r) => [r, (D.CHEST_DROPS * chestW[r]) / wTot * perDrop[r]]));
const chestPerHero = Object.fromEntries(Object.keys(chestW).map((r) => [r, chestCrests[r] / byRarity[r]]));
const trialW = D.TRIAL_RARITY_WEIGHTS as Record<string, number>;
const tTot = Object.values(trialW).reduce((a, b) => a + b, 0);

const gemsPerCrest: Record<string, Record<string, number | string>> = {
  'Hero Chest, any hero of the rarity (random)': Object.fromEntries(Object.keys(chestW).map((r) => [r, +(D.CHEST_COST / chestCrests[r]).toFixed(2)])),
  'Hero Chest, one chosen hero (random)': Object.fromEntries(Object.keys(chestW).map((r) => [r, +(D.CHEST_COST / chestPerHero[r]).toFixed(0)])),
  'Hero Shop offer (random hero, 4 per 8 h)': Object.fromEntries(Object.entries(D.HERO_SHOP_DEALS).map(([r, d]: any) => [r, +(d.gems / d.medals).toFixed(2)])),
  'Crest pack (100, any hero)': Object.fromEntries(Object.entries(D.MEDAL_PACK.gems).map(([r, g]: any) => [r, +(g / D.MEDAL_PACK.medals).toFixed(2)])),
  'Featured bundle (weekly hero)': { any: +(D.FEATURED_BUNDLE.gems / D.FEATURED_BUNDLE.medals).toFixed(2) },
  'Featured big bundle (every 4th week)': { any: +(D.FEATURED_BIG_BUNDLE.gems / D.FEATURED_BIG_BUNDLE.medals).toFixed(2) },
  'Hero Voucher (weekly, 3 of 4 weeks)': Object.fromEntries(Object.entries(D.HERO_VOUCHER.medals).map(([r, m]: any) => [r, +(D.HERO_VOUCHER.gems / m).toFixed(2)])),
  'Monthly Crest Pack (500 Wild)': Object.fromEntries(Object.entries(SC.WILD_CREST_COST).map(([r, c]: any) => [r, +(D.MONTHLY_CREST_PACK.gems / (D.MONTHLY_CREST_PACK.wild / c)).toFixed(2)])),
  'Trial ticket (2 crests of the element, random)': { anyOfElement: +(D.TICKET_GEMS / D.TRIAL_MEDALS).toFixed(2) },
  'Ticket Crate (30 tickets)': { anyOfElement: +(D.TICKET_CRATE.gems / D.TICKET_CRATE.tickets / D.TRIAL_MEDALS).toFixed(2) },
  'Ascendant Chest buys 1..10 (its hero)': Object.fromEntries(D.ASCENDANT_CHEST.map((c: any, i: number) => [`buy${i + 1}`, +(c.gems / c.crests).toFixed(2)])),
};

// ---- Gem income (fixed and expected) ----
const loginGems = R.LOGIN_CYCLE.reduce((t: number, r: any) => t + (r.gems ?? 0), 0);
const loginChests = R.LOGIN_CYCLE.reduce((t: number, r: any) => t + (r.chests ?? 0), 0);
const spinW = R.SPIN_SLICES.reduce((t: number, s: any) => t + s.weight, 0);
const spinGems = R.SPIN_SLICES.reduce((t: number, s: any) => t + (s.reward.gems ?? 0) * s.weight, 0) / spinW;
const spinChests = R.SPIN_SLICES.reduce((t: number, s: any) => t + (s.reward.chests ?? 0) * s.weight, 0) / spinW;
const achGems = R.ACHIEVEMENTS.reduce((t: number, a: any) => t + a.tiers.reduce((u: number, [, g]: any) => u + g, 0), 0);
const bootGems = R.BOOTCAMP.reduce((t: number, b: any) => t + b.gems, 0);
const milestoneGemsTo = (stage: number) => { let g = 0, w = 0, c = 0; for (let st = 50; st <= stage; st += 50) { const r = R.milestoneReward(st); g += r.gems; w += r.wild; c += r.chests; } return { gems: g, wild: w, chests: c }; };
const rushGems = RU.RUSH_TIERS.reduce((t: number, x: any) => t + (x.reward.gems ?? 0), 0);

const db = {
  generatedFrom: SRC,
  heroes: { shopPool: shop.length, byRarity, byElementRarity: byElRar, legendary: D.HEROES.filter((h: any) => h.rarity === 'legendary').map((h: any) => h.id), ascendant: D.HEROES.filter((h: any) => String(h.id).startsWith('asc_')).map((h: any) => h.id) },
  goldLevels: {
    rule: 'cost(level) = upgradeBaseCost x 1.08^(level-1); stats = level x 2^floor(level/20) (x2 every 20 levels); enemies x1.07 per stage; gold per kill x1.075 per stage',
    upgradeBaseCost: count(D.HEROES, (h) => String(h.upgradeBaseCost)),
    costAt: Object.fromEntries([1, 10, 50, 100, 200, 300, 500, 1000, 2000].map((l) => [l, F.upgradeCost(D.HEROES[0], l).toExponential(2)])),
    statScaleAt: Object.fromEntries([1, 10, 20, 50, 100, 200, 500, 1000].map((l) => [l, Number(F.heroAtk(D.HEROES[0], l).div(F.heroAtk(D.HEROES[0], 1)).toExponential(2))])),
  },
  embers: {
    rule: 'Ember level cost ceil(1.07^level); Rekindle pays floor(40 x 1.06^(payStage-126) x (1 + 0.1 x (playerLevel-1)) x (1 + relic Embers) x (1 + Ember Lens))',
    costAt: Object.fromEntries([0, 10, 50, 100, 200, 500, 1000, 2000, 3000, 5000].map((l) => [l, F.emberCost(l)])),
    cumulativeTo: Object.fromEntries([10, 50, 100, 200, 500, 1000, 2000, 3000, 5000].map((l) => [l, +(Math.pow(1.07, l) / 0.07).toExponential(2)])),
    rekindleYieldAt: Object.fromEntries([150, 200, 300, 500, 1000, 2000, 3000, 5000].map((st) => [st, F.emberYield(st, D.REKINDLE_STAGE)])),
    rekindleStage: D.REKINDLE_STAGE, headStart: { from: D.HEAD_START_FROM, share: D.HEAD_START_SHARE, power: D.HEAD_START_POWER }, softZone: F.EMBER_SOFT_ZONE,
    boosts: D.REKINDLE_BOOSTS, wheel: D.WHEEL_PRIZES, wheelSlots: { start: D.ROAD_START, step: D.ROAD_STEP, max: D.ROAD_LENGTH },
  },
  stars: { crestsPerStar: D.STAR_CRESTS, cumulative: cum(D.STAR_CRESTS), unlock: D.UNLOCK_CRESTS, statMultPerStar: D.STAR_STAT_MULT, regularMax: D.REGULAR_MAX_STARS + 1, ascendantMax: D.MAX_STARS + 1, legendaryRate: D.LEGENDARY_MEDAL_RATE, legendaryUnlock: D.LEGENDARY_UNLOCK_MEDALS, pinkStarmotes: D.AWAKEN_STARMOTES, pinkCum: cum(D.AWAKEN_STARMOTES), pinkMult: D.AWAKEN_STAT_MULT },
  heroChest: { gems: D.CHEST_COST, drops: D.CHEST_DROPS, rarityWeights: chestW, crestRolls: D.CREST_ROLLS, expectedCrestsPerDrop: perDrop, expectedCrestsPerChestByRarity: chestCrests, expectedPerHeroPerChest: chestPerHero },
  gemsPerCrest,
  gemIncome: {
    dailyChallenges: { perDay: R.DAILY_GEMS * R.DAILIES.length, goals: R.DAILIES },
    loginCalendar30: { gems: loginGems, chests: loginChests, perDayGems: +(loginGems / 30).toFixed(1) },
    luckySpin: { gemsPerDay: +spinGems.toFixed(2), chestsPerDay: +spinChests.toFixed(3) },
    goldChests: { gemsEach: D.GOLD_CHEST_GEMS, capPerDay: D.GOLD_CHEST_GEMS_PER_DAY },
    shinies: { odds: J.SHINY_ODDS, perDay: J.SHINY_PER_DAY, gems: J.SHINY_GEMS, chestChance: J.SHINY_CHEST_CHANCE, maxGemsPerDay: J.SHINY_PER_DAY * J.SHINY_GEMS * (1 - J.SHINY_CHEST_CHANCE) },
    achievementsTotal: achGems, bootcampTotal: bootGems, startGems: D.START_GEMS,
    stageMilestonesTo: Object.fromEntries([500, 1000, 2000, 3000, 5000].map((s) => [s, milestoneGemsTo(s)])),
    rushPerEvent: rushGems,
  },
  gemSinks: {
    teamSlots: D.TEAM_SLOT_COSTS, teamSlotsTotal: D.TEAM_SLOT_COSTS.reduce((a: number, b: number) => a + b, 0), ultSlots: D.ULT_SLOT_COSTS,
    relicSlots: D.RELIC_SLOT_COSTS, relicSlotsTotal: D.RELIC_SLOT_COSTS.reduce((a: number, b: number) => a + b, 0), relicSlotStages: D.RELIC_SLOT_STAGES,
    hourglass: { gems: D.HOURGLASS_GEMS, minutes: D.HOURGLASS_MINUTES, perDay: D.HOURGLASS_PER_DAY }, goldBoost: { gems: D.GOLD_BOOST_GEMS, minutes: D.GOLD_BOOST_MINUTES, mult: D.GOLD_BOOST_MULT, maxMinutes: D.GOLD_BOOST_MAX_MINUTES },
    heroChest: D.CHEST_COST, crestPack: D.MEDAL_PACK, heroShop: D.HERO_SHOP_DEALS, shopRefresh: D.HERO_SHOP_REFRESH_GEMS, featured: [D.FEATURED_BUNDLE, D.FEATURED_BIG_BUNDLE],
    tickets: { gems: D.TICKET_GEMS, perDay: D.TICKETS_PER_DAY, stashCap: D.BOUGHT_TICKET_CAP }, ticketCrate: D.TICKET_CRATE, voucher: D.HERO_VOUCHER, monthlyPack: D.MONTHLY_CREST_PACK,
    ascendantChest: D.ASCENDANT_CHEST, ascendantChestWeek: D.ASCENDANT_CHEST.reduce((t: any, c: any) => ({ gems: t.gems + c.gems, crests: t.crests + c.crests }), { gems: 0, crests: 0 }),
    rekindleBoost: D.REKINDLE_BOOSTS, pvpTicket: { gems: CO.PVP_TICKET_GEMS, perDay: CO.PVP_TICKET_BUYS }, observatoryRespec: OB.OBSERVATORY_RESPEC_GEMS,
  },
  trials: {
    unlockStage: D.TRIAL_UNLOCK_STAGE, tickets: { regenMinutes: D.TICKET_MINUTES, cap: D.TICKET_CAP, perDay: (24 * 60) / D.TICKET_MINUTES }, crestsPerWin: D.TRIAL_MEDALS, rarityWeights: trialW, eventMult: D.TRIAL_EVENT_MEDAL_MULT,
    schedule: D.TRIAL_SCHEDULE, allOpen: D.ALL_TRIALS_DAYS,
    levels: D.TRIAL_LEVELS.map((l: any, i: number) => ({ level: i + 1, essence: l.essence, difficulty: l.difficulty, req: l.req, stones: S.trialStones(i + 1), firstWin: D.trialFirstWin(i + 1) })),
    crestShareByRarity: Object.fromEntries(Object.keys(trialW).map((r) => [r, trialW[r] / tTot])),
  },
  relics: {
    count: D.RELICS.length, byStars: count(D.RELICS, (r) => String(r.stars)), sets: D.RELIC_SETS.length, setStartShare: D.RELIC_SET_START_SHARE,
    levelRule: 'Essence of each of 2 kinds per level = craft x 2^(level/2); N★ opens when an (N-1)★ reaches level 20; Enhance +5 cap for 5/10/20/40 Stones',
    craftByStars: Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8].map((st) => [st, [...new Set(D.RELICS.filter((r: any) => r.stars === st).map((r: any) => r.craft))]])),
    costToLv20ByCraft: Object.fromEntries([10, 300, 5000, 4e5, 1e6, 3e6, 2e7, 1.5e8, 1.2e9, 1e10].map((c) => [c, Array.from({ length: 20 }, (_, l) => F.relicCost(l, c)).reduce((a, b) => a + b, 0)])),
    enhance: D.RELIC_ENHANCE_COSTS, shop: { size: D.RELIC_SHOP_SIZE, refreshMinutes: D.RELIC_SHOP_REFRESH_MINUTES },
  },
  weapons: { costs: W.WEAPON_COSTS, total: W.weaponTotalCost(), statPerLevel: W.WEAPON_STAT_STEP, max: W.WEAPON_MAX_LEVEL, glyphSlots: W.WEAPON_GLYPHS },
  scouting: { unlockPlayerLevel: SC.SCOUT_UNLOCK_LEVEL, kinds: SC.SCOUT_KINDS, rewards: { common4h: SC.fullReward({ kind: 'common', hours: 4 }), rare6h: SC.fullReward({ kind: 'rare', hours: 6 }), gilded: SC.fullReward({ kind: 'gilded', hours: 6 }) }, wildCost: SC.WILD_CREST_COST },
  glyphs: { chests: GL.GLYPH_CHESTS, levelCost: 'Dust 4 x star^2 x (level+1)', salvage: GL.GLYPH_SALVAGE, bagCap: GL.GLYPH_BAG_CAP },
  rush: { unlockPlayerLevel: RU.RUSH_UNLOCK_LEVEL, days: RU.RUSH_DAYS, tickets: { start: RU.RUSH_START_TICKETS, daily: RU.RUSH_DAILY_TICKETS, perFight: RU.RUSH_FIGHT_TICKETS }, tiers: RU.RUSH_TIERS, shop: RU.RUSH_SHOP, crests: { pack: RU.RUSH_CREST_PACK, coins: RU.RUSH_CREST_COINS, limit: RU.RUSH_CREST_LIMIT }, brackets: RU.RUSH_BRACKETS },
  colosseum: { opens: `player level ${D.AWAKEN_UNLOCK_LEVEL}`, tickets: { cap: CO.PVP_TICKET_CAP, regenMinutes: CO.PVP_TICKET_MINUTES }, win: { trophies: CO.PVP_WIN_TROPHIES, motes: CO.PVP_WIN_MOTES, firstWinMotes: CO.PVP_FIRST_WIN_MOTES }, loss: { trophies: CO.PVP_LOSS_TROPHIES, motes: CO.PVP_LOSS_MOTES }, rankTrophies: CO.RANK_TROPHIES, rankDaily: CO.RANK_DAILY, rankWeekly: CO.RANK_WEEKLY, weeklyDropRanks: CO.WEEKLY_DROP },
  guild: {
    opens: 'after the first Rekindle (signed in)', boss: { hpBase: F.GUILD_BOSS_HP_BASE, hpGrowth: F.GUILD_BOSS_HP_GROWTH, fightsPerDay: D.GUILD_BOSS_ATTEMPTS, cap: D.GUILD_BOSS_FIGHT_CAP, killCoins: '3 x (10 + level) per level', weekly: '10 x (10 + top) coins + 1 Hero Chest per 5 levels beaten (max 4)', ascCrests: `${D.GUILD_BOSS_ASC_CRESTS}/level for the first ${D.GUILD_BOSS_ASC_LEVELS} levels`, startBack: F.GUILD_BOSS_START_BACK },
    shop: D.GUILD_SHOP, chestsPerWeek: D.GUILD_CHESTS_PER_WEEK, offers: { medals: D.GUILD_OFFER_MEDALS, cost: D.GUILD_OFFER_COST }, wild: { cost: D.GUILD_WILD_COST, perWeek: D.GUILD_WILD_PER_WEEK },
    requests: { crests: D.GUILD_REQUEST_GOAL, everyHours: D.GUILD_REQUEST_HOURS, donorCoins: D.GUILD_CREDITS_PER_MEDAL }, quests: { track: D.GUILD_QUEST_TRACK, personal: D.GUILD_QUEST_PERSONAL_COINS },
    research: D.GUILD_RESEARCH, researchTotal: F.researchPointsFor(10), relics: GR.GUILD_RELICS.map((r: any) => ({ id: r.id, tier: r.tier, fx: r.fx, totalWarsteel: GR.guildRelicTotalCost(r) })),
  },
  observatory: { branches: OB.OBSERVATORY.map((o: any) => ({ id: o.id, per: o.per, max: o.max, sigilsToMax: OB.sigilsSpent(o.max) })), sigils: 'rekindles + floor((playerLevel-1)/3)' },
  ascendant: { steps: AS.standardSteps(0), chestWeek: D.ASCENDANT_CHEST },
  stalls: { count: D.STALLS.length, autoLevel: D.STALL_AUTO_LEVEL, milestone: D.STALL_MILESTONE, rekindleRevenue: D.STALL_REKINDLE_REVENUE },
  offline: { capHours: D.OFFLINE_CAP_HOURS },
  observedIn: 'src/data.ts, src/formulas.ts, src/rewards.ts, src/state.ts and the system modules',
};
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(db, null, 1));
console.log(JSON.stringify({ byRarity, gemsPerCrest, chestCrests, chestPerHero, gemIncome: db.gemIncome, sinks: { teamSlotsTotal: db.gemSinks.teamSlotsTotal, relicSlotsTotal: db.gemSinks.relicSlotsTotal, asc: db.gemSinks.ascendantChestWeek } }, null, 1));
