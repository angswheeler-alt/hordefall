// Economy variants for controlled experiments: each is a list of exact text edits to a COPY of src/.
// The game itself is never changed. Make a copy:  npx vite-node tools/sim/variants.ts -- <name> [<name>...]
// then run the sim with SIM_SRC=.sim/variants/<name>/src SIM_VARIANT=<name>.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

type Edit = [file: string, find: string, replace: string];
const STAR = 'export const STAR_CRESTS = [10, 50, 250, 600, 1500, 2500, 5000];';
const stars = (xs: number[]): Edit => ['data.ts', STAR, `export const STAR_CRESTS = [${xs.join(', ')}];`];
const scaleStars = (k: number) => stars([10, 50, 250, 600, 1500, 2500, 5000].map((x) => Math.round(x * k)));

/** Ember payout growth per stage, by band: [[fromStage, rate], ...] in rising order; below the first band it stays 1.06. */
const EMBER_PAY = 'return Decimal.pow(1.06, emberPayStage(runBestStage, lifetimeBest) - rekindleStage - 1);';
function emberCurve(bands: [number, number][]): Edit {
  const parts = bands.map(([from, rate], i) => {
    const to = i + 1 < bands.length ? bands[i + 1][0] : 1e9;
    return `.times(Decimal.pow(${rate} / 1.06, Math.min(Math.max(pay, ${from}), ${to}) - ${from}))`;
  });
  return ['formulas.ts', EMBER_PAY, `const pay = emberPayStage(runBestStage, lifetimeBest);\n  return Decimal.pow(1.06, pay - rekindleStage - 1)${parts.join('')};`];
}

/** Year-two study: "stall breaker" Ember bonus that grows each day the best stage has not risen (after a grace period), reset when the best stage passes a new multiple of resetStep. stageMode: the bonus is extra pay stages (perDay stages a day, x1.062 each) instead of a flat percentage. */
function stallBreaker(graceDays: number, perDay: number, cap: number, resetStep = 1, stageMode = false): Edit[] {
  const bonus = stageMode
    ? `return Math.pow(1.062, Math.min(${cap}, Math.max(0, days - ${graceDays}) * ${perDay}));`
    : `return 1 + Math.min(${cap}, Math.max(0, days - ${graceDays}) * ${perDay});`;
  return [
    ['state.ts', '  bestStage = 1;\n', '  bestStage = 1;\n  bestStageAt = Date.now();\n'],
    ['state.ts', '    this.bestStage = Math.max(this.bestStage, stage);\n', `    if (Math.floor(stage / ${resetStep}) > Math.floor(this.bestStage / ${resetStep})) this.bestStageAt = Date.now();\n    this.bestStage = Math.max(this.bestStage, stage);\n`],
    ['state.ts', "(1 + this.obsBonus('embers'))).floor();\n  }\n", `(1 + this.obsBonus('embers'))).times(this.stallBreaker()).floor();\n  }\n\n  stallBreaker() {\n    const days = (Date.now() - this.bestStageAt) / 86400000;\n    ${bonus}\n  }\n`],
  ];
}

/**
 * Year-two study: second prestige layer ("Ascension", working name). On top of the stall breaker.
 * Ascending sets every hero's Ember level to keep x its level, clears unspent Embers and restarts the run; in return every
 * later Rekindle pays as if `gain` stages further, for good. It opens when the team's average Ember level is at least
 * minLevel and above the level of the previous Ascension. Trial requirements keep counting the highest level ever reached.
 */
function prestige(gain: number, keep: number, minLevel: number, catchUp = false): Edit[] {
  // catchUp: until the team is back at the level it gave up, Rekindle pays by the record stage, so the climb back takes days, not months
  const fast: Edit[] = catchUp ? [['state.ts', 'emberYield(this.runBestStage, REKINDLE_STAGE', 'emberYield(this.ascensions > 0 && this.ascendLevel() < this.ascLastLevel ? Math.max(this.runBestStage, this.bestStage) : this.runBestStage, REKINDLE_STAGE']] : [];
  return [
    ...fast,
    ['state.ts', '  bestStage = 1;\n', '  bestStage = 1;\n  ascensions = 0;\n  ascStages = 0;\n  ascLastLevel = 0;\n  emberPeak: Record<string, number> = {};\n'],
    ['state.ts', '.times(this.stallBreaker()).floor();', '.times(this.stallBreaker()).times(Math.pow(1.062, this.ascStages)).floor();'],
    ['state.ts', '(this.emberLevels[h.id] ?? 0) >= level).length;', '(Math.max(this.emberLevels[h.id] ?? 0, this.emberPeak[h.id] ?? 0)) >= level).length;'],
    ['state.ts', '  stallBreaker() {\n', `  ascendLevel() {
    const team = HEROES.filter((h) => this.inLineup(h.id));
    return team.length ? team.reduce((t, h) => t + (this.emberLevels[h.id] ?? 0), 0) / team.length : 0;
  }

  canEmberAscend() {
    const lv = this.ascendLevel();
    return lv >= ${minLevel} && lv > this.ascLastLevel;
  }

  emberAscend() {
    if (!this.canEmberAscend()) return false;
    this.ascLastLevel = this.ascendLevel();
    for (const h of HEROES) {
      const lv = this.emberLevels[h.id] ?? 0;
      this.emberPeak[h.id] = Math.max(this.emberPeak[h.id] ?? 0, lv);
      this.emberLevels[h.id] = Math.floor(lv * ${keep});
    }
    this.embers = new Decimal(0);
    this.ascensions += 1;
    this.ascStages += ${gain};
    this.gold = new Decimal(0);
    const start = this.headStart ? this.headStartStage() : 1;
    this.stage = start;
    this.runBestStage = start;
    this.runStartStage = start;
    for (const def of STALLS) this.stalls[def.id] = { level: 0, progress: 0 };
    this.autoAdvance = true;
    for (const h of HEROES) this.levels[h.id] = h.unlockCost === 0 ? 1 : this.levels[h.id] > 0 ? 1 : 0;
    this.secondsPerStage = 20;
    this.goldPerSec = 0;
    return true;
  }

  stallBreaker() {\n`],
  ];
}

export const VARIANTS: Record<string, { text: string; edits: Edit[] }> = {
  baseline: { text: 'The game as it is on main.', edits: [] },
  // gold
  'gold+20': { text: 'Gold per kill +20% (GOLD_BASE 0.7 -> 0.84)', edits: [['formulas.ts', 'const GOLD_BASE = 0.7;', 'const GOLD_BASE = 0.84;']] },
  'gold-20': { text: 'Gold per kill -20% (GOLD_BASE 0.7 -> 0.56)', edits: [['formulas.ts', 'const GOLD_BASE = 0.7;', 'const GOLD_BASE = 0.56;']] },
  'levelcost+30': { text: 'Hero level gold cost +30%', edits: [['formulas.ts', 'times(def.upgradeBaseCost * mult)', 'times(def.upgradeBaseCost * mult * 1.3)']] },
  'levelcost-30': { text: 'Hero level gold cost -30%', edits: [['formulas.ts', 'times(def.upgradeBaseCost * mult)', 'times(def.upgradeBaseCost * mult * 0.7)']] },
  // Embers (Prism)
  'ember1.065': { text: 'Ember level cost growth 1.07 -> 1.065 per level', edits: [['formulas.ts', 'export const EMBER_COST_GROWTH = 1.07;', 'export const EMBER_COST_GROWTH = 1.065;']] },
  'ember1.075': { text: 'Ember level cost growth 1.07 -> 1.075 per level', edits: [['formulas.ts', 'export const EMBER_COST_GROWTH = 1.07;', 'export const EMBER_COST_GROWTH = 1.075;']] },
  // enemies and bosses
  'enemy1.072': { text: 'Enemy growth 1.07 -> 1.072 per stage', edits: [['formulas.ts', 'const ENEMY_GROWTH = 1.07;', 'const ENEMY_GROWTH = 1.072;']] },
  'enemy1.068': { text: 'Enemy growth 1.07 -> 1.068 per stage', edits: [['formulas.ts', 'const ENEMY_GROWTH = 1.07;', 'const ENEMY_GROWTH = 1.068;']] },
  'bossHp-20': { text: 'Stage boss HP -20% (x280 -> x224 mob HP)', edits: [['formulas.ts', 'return enemyHp(stage).times(280);', 'return enemyHp(stage).times(224);']] },
  'bossHp+30': { text: 'Stage boss HP +30% (x280 -> x364 mob HP)', edits: [['formulas.ts', 'return enemyHp(stage).times(280);', 'return enemyHp(stage).times(364);']] },
  // crests and stars
  'stars-20': { text: 'Star crest costs -20% (user rejected cheaper stars on 2026-10-21; tested for comparison only)', edits: [scaleStars(0.8)] },
  'stars-30': { text: 'Star crest costs -30% (comparison only, see stars-20)', edits: [scaleStars(0.7)] },
  'stars+20': { text: 'Star crest costs +20%', edits: [scaleStars(1.2)] },
  'trialEpic': { text: 'Trial crest odds C80/R17/E3 -> C70/R22/E8 (same count, rarer heroes more often)', edits: [['data.ts', 'TRIAL_RARITY_WEIGHTS: Record<Exclude<Rarity, \'legendary\'>, number> = { common: 80, rare: 17, epic: 3 }', 'TRIAL_RARITY_WEIGHTS: Record<Exclude<Rarity, \'legendary\'>, number> = { common: 70, rare: 22, epic: 8 }']] },
  'trialCrests3': { text: 'Trial win 2 -> 3 crests (+50%)', edits: [['data.ts', 'export const TRIAL_MEDALS = 2;', 'export const TRIAL_MEDALS = 3;']] },
  'chestEpic': { text: 'Hero Chest odds C70/R22/E8 -> C60/R28/E12', edits: [['data.ts', '{ common: 70, rare: 22, epic: 8 };\n/** Medals per drop', '{ common: 60, rare: 28, epic: 12 };\n/** Medals per drop']] },
  // gems
  'gems+20': { text: 'Daily challenge Gems 5 -> 6 each and gold-chest Gem cap 150 -> 180 a day (+20% of daily Gems)', edits: [['rewards.ts', 'export const DAILY_GEMS = 5;', 'export const DAILY_GEMS = 6;'], ['data.ts', 'export const GOLD_CHEST_GEMS_PER_DAY = 150;', 'export const GOLD_CHEST_GEMS_PER_DAY = 180;']] },
  'gems-20': { text: 'Daily challenge Gems 5 -> 4 each and gold-chest Gem cap 150 -> 120 a day (-20%)', edits: [['rewards.ts', 'export const DAILY_GEMS = 5;', 'export const DAILY_GEMS = 4;'], ['data.ts', 'export const GOLD_CHEST_GEMS_PER_DAY = 150;', 'export const GOLD_CHEST_GEMS_PER_DAY = 120;']] },
  'packs-20': { text: 'Crest pack prices -20% (C300/R500/E1000 -> 240/400/800)', edits: [['data.ts', 'gems: { common: 300, rare: 500, epic: 1000 } }', 'gems: { common: 240, rare: 400, epic: 800 } }']] },
  // equipment, idle, guild
  'weapons-30': { text: 'Weapon forge costs -30% (Ore/Crystal/Cores)', edits: [['weapons.ts', 'export function weaponUpgradeCost(level: number): ForgeCost | null {\n  const l = clampWeaponLevel(level);\n  return l >= WEAPON_MAX_LEVEL ? null : WEAPON_COSTS[l + 1];', 'export function weaponUpgradeCost(level: number): ForgeCost | null {\n  const l = clampWeaponLevel(level);\n  if (l >= WEAPON_MAX_LEVEL) return null;\n  return Object.fromEntries(Object.entries(WEAPON_COSTS[l + 1]).map(([k, v]) => [k, Math.max(1, Math.round((v as number) * 0.7))]));']] },
  'offline16': { text: 'Offline cap 12 h -> 16 h', edits: [['data.ts', 'export const OFFLINE_CAP_HOURS = 12;', 'export const OFFLINE_CAP_HOURS = 16;']] },
  'offline8': { text: 'Offline cap 12 h -> 8 h', edits: [['data.ts', 'export const OFFLINE_CAP_HOURS = 12;', 'export const OFFLINE_CAP_HOURS = 8;']] },
  'guildChests5': { text: 'Guild Shop Hero Chests 10 -> 5 a week', edits: [['data.ts', 'export const GUILD_CHESTS_PER_WEEK = 10;', 'export const GUILD_CHESTS_PER_WEEK = 5;']] },
  'essence-30': { text: 'Trial Essence -30%', edits: [['data.ts', 'essence: Math.round(20 * 2 **', 'essence: Math.round(14 * 2 **']] },
  'relicSet+': { text: 'Relic set bonus starts at 10% instead of 25% of full', edits: [['data.ts', 'export const RELIC_SET_START_SHARE = 0.25;', 'export const RELIC_SET_START_SHARE = 0.1;']] },
  // proposals found by the audit
  'rarityStats': { text: 'Rarity sets base power: Rare x1.5 and Epic x2.25 ATK/HP/DEF (one star of difference per rarity step)', edits: [
    ['formulas.ts', 'return levelScale(level).times(def.baseAtk * HERO_ATK_MULT);', "return levelScale(level).times(def.baseAtk * HERO_ATK_MULT * ({ common: 1, rare: 1.5, epic: 2.25, legendary: 3.4 } as Record<string, number>)[def.rarity]);"],
    ['formulas.ts', 'return levelScale(level).times(def.baseHp);', "return levelScale(level).times(def.baseHp * ({ common: 1, rare: 1.5, epic: 2.25, legendary: 3.4 } as Record<string, number>)[def.rarity]);"],
  ] },
  'trialReqSmooth': { text: 'Trial levels 27-33 need Ember 3,550/3,800/4,050/4,300/4,600/4,900/5,300 (was 3,700-7,550): a new level every 1-2 months in year one', edits: [
    ['data.ts', '[5, 3700], [5, 4100], [5, 4500], [5, 4900], [5, 6300], [5, 6900], [5, 7550],', '[5, 3550], [5, 3800], [5, 4050], [5, 4300], [5, 4600], [5, 4900], [5, 5300],'],
  ] },
  'trialStonesHalf': { text: 'Trial Enhance Stones: 1 per win only from level 16 (was from level 6), 2 from 36', edits: [
    ['state.ts', 'return tier >= 36 ? 3 : tier >= 26 ? 2 : tier >= 6 ? 1 : 0;', 'return tier >= 36 ? 2 : tier >= 16 ? 1 : 0;'],
  ] },
  'ember1.068': { text: 'Ember level cost growth 1.07 -> 1.068 per level (a milder speed-up than 1.065)', edits: [['formulas.ts', 'export const EMBER_COST_GROWTH = 1.07;', 'export const EMBER_COST_GROWTH = 1.068;']] },
  'starEmber': { text: 'Each star above 1★ makes a hero\'s Ember levels count 2% more in battle (7★ = +12%), so stars keep mattering for stages', edits: [
    ['state.ts', '    return effectiveLevel(this.levels[id] ?? 0, this.emberLevels[id] ?? 0);', '    return effectiveLevel(this.levels[id] ?? 0, Math.floor((this.emberLevels[id] ?? 0) * (1 + 0.02 * (this.stars[id] ?? 0))));'],
  ] },
  'elementBossSoft': { text: 'Every-100th element bosses take 20% damage from other elements instead of none (softens the user rule from PR #95)', edits: [
    ['data.ts', 'export function bossImmuneTo(stage: number, attacker: Element | null): boolean {\n  if (!isElementBossStage(stage)) return false;', 'export const ELEMENT_BOSS_OTHER_SHARE = 0.2;\nexport function bossImmuneTo(stage: number, attacker: Element | null): boolean {\n  if (!isElementBossStage(stage) || attacker !== null) return false;'],
  ] },
  'rarity2': { text: 'Rarity sets base power with about two stars per step: Rare x2.25, Epic x5, Legendary x11 ATK/HP', edits: [
    ['formulas.ts', 'return levelScale(level).times(def.baseAtk * HERO_ATK_MULT);', "return levelScale(level).times(def.baseAtk * HERO_ATK_MULT * ({ common: 1, rare: 2.25, epic: 5, legendary: 11 } as Record<string, number>)[def.rarity]);"],
    ['formulas.ts', 'return levelScale(level).times(def.baseHp);', "return levelScale(level).times(def.baseHp * ({ common: 1, rare: 2.25, epic: 5, legendary: 11 } as Record<string, number>)[def.rarity]);"],
  ] },
  'starEmber05': { text: 'Each star above 1★ makes a hero\'s Ember levels count 0.5% more in battle (7★ = +3%)', edits: [
    ['state.ts', '    return effectiveLevel(this.levels[id] ?? 0, this.emberLevels[id] ?? 0);', '    return effectiveLevel(this.levels[id] ?? 0, Math.floor((this.emberLevels[id] ?? 0) * (1 + 0.005 * (this.stars[id] ?? 0))));'],
  ] },
  'starEmber1': { text: 'Each star above 1★ makes a hero\'s Ember levels count 1% more in battle (7★ = +6%)', edits: [
    ['state.ts', '    return effectiveLevel(this.levels[id] ?? 0, this.emberLevels[id] ?? 0);', '    return effectiveLevel(this.levels[id] ?? 0, Math.floor((this.emberLevels[id] ?? 0) * (1 + 0.01 * (this.stars[id] ?? 0))));'],
  ] },
  // Ember payout curve (2026-11-07 midgame study): Rekindle pays more Embers per stage past a stage, nothing else changes.
  emberMid: { text: 'Leading candidate: Ember payout 6% -> 6.05% per stage from stage 2,000, 6.2% from 4,000', edits: [emberCurve([[2000, 1.0605], [4000, 1.062]])] },
  emberMidDelayed: { text: 'Candidate B: Ember payout 6.05% per stage from stage 3,000, 6.2% from 4,000', edits: [emberCurve([[3000, 1.0605], [4000, 1.062]])] },
  emberStepped: { text: 'Stepped: Ember payout 6.05% from 2,000, 6.10% from 4,000, 6.15% from 6,000, 6.2% from 8,000', edits: [emberCurve([[2000, 1.0605], [4000, 1.061], [6000, 1.0615], [8000, 1.062]])] },
  // Year-two plateau study (2026-11-08): emberMid plus a late payout step. Costs stay 6.8% a level.
  lateEmber65: { text: 'emberMid + Ember payout 6.5% per stage from stage 10,000', edits: [emberCurve([[2000, 1.0605], [4000, 1.062], [10000, 1.065]])] },
  lateEmber68: { text: 'emberMid + Ember payout 6.8% per stage from stage 10,000 (matches the Ember cost growth)', edits: [emberCurve([[2000, 1.0605], [4000, 1.062], [10000, 1.068]])] },
  stallBreak: { text: 'emberMid + stall breaker: +25% Embers per day without a new best stage after 7 days, up to +500%', edits: [emberCurve([[2000, 1.0605], [4000, 1.062]]), ...stallBreaker(7, 0.25, 5)] },
  stallBreakStrong: { text: 'emberMid + stall breaker: +50% Embers per day without a new best stage after 5 days, up to +1,000%', edits: [emberCurve([[2000, 1.0605], [4000, 1.062]]), ...stallBreaker(5, 0.5, 10)] },
  stallBreak50: { text: 'emberMid + stall breaker: +25% Embers per day after 7 days without a new 50-stage milestone, up to +500%', edits: [emberCurve([[2000, 1.0605], [4000, 1.062]]), ...stallBreaker(7, 0.25, 5, 50)] },
  stallBreak50Strong: { text: 'emberMid + stall breaker: +50% Embers per day after 5 days without a new 50-stage milestone, up to +1,000%', edits: [emberCurve([[2000, 1.0605], [4000, 1.062]]), ...stallBreaker(5, 0.5, 10, 50)] },
  stallStage: { text: 'emberMid + stall breaker: after 5 days without a new boss milestone, Rekindle pays as if 3 stages further per day, up to +60 stages', edits: [emberCurve([[2000, 1.0605], [4000, 1.062]]), ...stallBreaker(5, 3, 60, 50, true)] },
  stallStageStrong: { text: 'emberMid + stall breaker: after 3 days without a new boss milestone, Rekindle pays as if 5 stages further per day, up to +100 stages', edits: [emberCurve([[2000, 1.0605], [4000, 1.062]]), ...stallBreaker(3, 5, 100, 50, true)] },
  asc50: { text: 'emberMid v2 + Ascension: Ember levels x0, each one makes Rekindle pay as if 50 stages further for good (opens at team Ember level 8000)', edits: [emberCurve([[2000, 1.0605], [4000, 1.062]]), ...stallBreaker(3, 5, 100, 50, true), ...prestige(50, 0, 8000)] },
  asc150: { text: 'emberMid v2 + Ascension: Ember levels x0, each one makes Rekindle pay as if 150 stages further for good (opens at team Ember level 8000)', edits: [emberCurve([[2000, 1.0605], [4000, 1.062]]), ...stallBreaker(3, 5, 100, 50, true), ...prestige(150, 0, 8000)] },
  asc400: { text: 'emberMid v2 + Ascension: Ember levels x0, each one makes Rekindle pay as if 400 stages further for good (opens at team Ember level 8000)', edits: [emberCurve([[2000, 1.0605], [4000, 1.062]]), ...stallBreaker(3, 5, 100, 50, true), ...prestige(400, 0, 8000)] },
  asc150half: { text: 'emberMid v2 + Ascension: Ember levels x0.5, each one makes Rekindle pay as if 150 stages further for good (opens at team Ember level 8000)', edits: [emberCurve([[2000, 1.0605], [4000, 1.062]]), ...stallBreaker(3, 5, 100, 50, true), ...prestige(150, 0.5, 8000)] },
  asc20: { text: 'emberMid v2 + Ascension: Ember levels x0, each one makes Rekindle pay as if 20 stages further for good (opens at team Ember level 8000)', edits: [emberCurve([[2000, 1.0605], [4000, 1.062]]), ...stallBreaker(3, 5, 100, 50, true), ...prestige(20, 0, 8000)] },
  asc20half: { text: 'emberMid v2 + Ascension: Ember levels x0.5, each one makes Rekindle pay as if 20 stages further for good (opens at team Ember level 8000)', edits: [emberCurve([[2000, 1.0605], [4000, 1.062]]), ...stallBreaker(3, 5, 100, 50, true), ...prestige(20, 0.5, 8000)] },
  asc20k80: { text: 'emberMid v2 + Ascension: Ember levels x0.8, each one makes Rekindle pay as if 20 stages further for good (opens at team Ember level 8000)', edits: [emberCurve([[2000, 1.0605], [4000, 1.062]]), ...stallBreaker(3, 5, 100, 50, true), ...prestige(20, 0.8, 8000)] },
  asc50half: { text: 'emberMid v2 + Ascension: Ember levels x0.5, each one makes Rekindle pay as if 50 stages further for good (opens at team Ember level 8000)', edits: [emberCurve([[2000, 1.0605], [4000, 1.062]]), ...stallBreaker(3, 5, 100, 50, true), ...prestige(50, 0.5, 8000)] },
  asc50k80: { text: 'emberMid v2 + Ascension: Ember levels x0.8, each one makes Rekindle pay as if 50 stages further for good (opens at team Ember level 8000)', edits: [emberCurve([[2000, 1.0605], [4000, 1.062]]), ...stallBreaker(3, 5, 100, 50, true), ...prestige(50, 0.8, 8000)] },
  asc10c: { text: 'emberMid v2 + Ascension with catch-up: Ember levels to 0, Rekindle pays by the record stage until the old level is back, each one adds 10 pay stages for good', edits: [emberCurve([[2000, 1.0605], [4000, 1.062]]), ...stallBreaker(3, 5, 100, 50, true), ...prestige(10, 0, 8000, true)] },
  asc20c: { text: 'emberMid v2 + Ascension with catch-up: Ember levels to 0, Rekindle pays by the record stage until the old level is back, each one adds 20 pay stages for good', edits: [emberCurve([[2000, 1.0605], [4000, 1.062]]), ...stallBreaker(3, 5, 100, 50, true), ...prestige(20, 0, 8000, true)] },
  asc30c: { text: 'emberMid v2 + Ascension with catch-up: Ember levels to 0, Rekindle pays by the record stage until the old level is back, each one adds 30 pay stages for good', edits: [emberCurve([[2000, 1.0605], [4000, 1.062]]), ...stallBreaker(3, 5, 100, 50, true), ...prestige(30, 0, 8000, true)] },
  lateEmber64: { text: 'emberMid + Ember payout 6.4% per stage from stage 10,000', edits: [emberCurve([[2000, 1.0605], [4000, 1.062], [10000, 1.064]])] },
  lateEmber65at11k: { text: 'emberMid + Ember payout 6.5% per stage from stage 11,000', edits: [emberCurve([[2000, 1.0605], [4000, 1.062], [11000, 1.065]])] },
  'ember6.2': { text: 'Flat: Ember payout 6.2% per stage from stage 2,000', edits: [emberCurve([[2000, 1.062]])] },
};

/** Bundles: several variants applied together (the audit's recommended set). */
export const BUNDLES: Record<string, { text: string; parts: string[] }> = {
  revised: { text: 'Recommended set: rarityStats + trialReqSmooth + trialStonesHalf', parts: ['rarityStats', 'trialReqSmooth', 'trialStonesHalf'] },
  final: { text: 'Build set: trialReqSmooth + trialStonesHalf + ember1.068 + starEmber05 + rarity2', parts: ['trialReqSmooth', 'trialStonesHalf', 'ember1.068', 'starEmber05', 'rarity2'] },
};
for (const [k, b] of Object.entries(BUNDLES)) VARIANTS[k] = { text: b.text, edits: b.parts.flatMap((p) => VARIANTS[p].edits) };

/** Make (or remake) the patched copy; returns its src path. Throws if an edit doesn't match exactly once. */
export function makeVariant(name: string, root = new URL('../..', import.meta.url).pathname): string {
  const v = VARIANTS[name];
  if (!v) throw new Error('unknown variant ' + name);
  const dir = `${root}.sim/variants/${name}/src`;
  if (existsSync(dir)) rmSync(dir, { recursive: true });
  mkdirSync(dir, { recursive: true });
  cpSync(`${root}src`, dir, { recursive: true });
  for (const [file, find, rep] of v.edits) {
    const p = `${dir}/${file}`;
    const txt = readFileSync(p, 'utf8');
    const n = txt.split(find).length - 1;
    if (n !== 1) throw new Error(`${name}: edit in ${file} matched ${n} times: ${find.slice(0, 60)}`);
    writeFileSync(p, txt.replace(find, rep));
  }
  return dir;
}

