// Monte Carlo of Hero Crest luck: thousands of players' crest drops over a year, using the game's own odds
// (Hero Chest rarity weights and roll sizes, Trial rarity weights, the Trial pool rule that skips maxed heroes,
// the weekly Trial schedule and the Daily Crest Bundle). Daily amounts per source come from a full sim run
// (tools/sim/run.ts ledger), so this answers "how much does luck move the star timeline?".
//   npx vite-node tools/sim/crest-mc.ts -- --paths 5000 --days 365 --trials 46 --chests 4.5 --bundle 0.9 --targeted 25 --out f.json
import { writeFileSync } from 'node:fs';
(globalThis as any).localStorage = { getItem: () => null, setItem() {}, removeItem() {}, clear() {} };
const SRC = process.env.SIM_SRC ?? new URL('../../src', import.meta.url).pathname;
const D = await import(SRC + '/data.ts');
const S = await import(SRC + '/state.ts');

const args = process.argv.slice(2).filter((a) => a !== '--');
const opt = (k: string, d: number) => { const i = args.indexOf('--' + k); return i >= 0 ? Number(args[i + 1]) : d; };
const PATHS = opt('paths', 5000), DAYS = opt('days', 365);
const TRIALS = opt('trials', 46); // Trial wins a day
const CHESTS = opt('chests', 4); // free Hero Chests a day (login, spin, guild shop, milestones, first wins...)
const BUNDLE = opt('bundle', 0.9); // Daily Crest Bundles claimed a day
const TARGETED = opt('targeted', 20); // crests a day the player can aim at heroes they pick (Wild, vouchers, packs, guild Wild Medals)
const seedArg = opt('seed', 1);
const outIdx = args.indexOf('--out');

let seed = seedArg >>> 0;
const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const heroes = S.SHOP_HEROES as any[];
const N = heroes.length;
const idx = new Map(heroes.map((h, i) => [h.id, i]));
const RAR = ['common', 'rare', 'epic'];
const rarOf = heroes.map((h) => RAR.indexOf(h.rarity));
const elOf = heroes.map((h) => h.element);
const STAR = D.STAR_CRESTS as number[];
const UNLOCK = [D.UNLOCK_CRESTS.common, D.UNLOCK_CRESTS.rare, D.UNLOCK_CRESTS.epic];
const MAXEVO = D.REGULAR_MAX_STARS; // 6 evolutions = 7★
const chestW = RAR.map((r) => (D.CHEST_RARITY_WEIGHTS as any)[r]);
const trialW = RAR.map((r) => (D.TRIAL_RARITY_WEIGHTS as any)[r]);
const rolls = RAR.map((r) => (D.CREST_ROLLS as any)[r] as Array<[number, number]>);
const pickW = (w: number[]) => { let x = rnd() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < w.length; i++) if ((x -= w[i]) < 0) return i; return w.length - 1; };
const byRar = RAR.map((_, r) => heroes.map((_, i) => i).filter((i) => rarOf[i] === r));

// The three heroes we follow: the first Common, Rare and Epic of Water (stand-ins for "a hero you want").
const followed = [0, 1, 2].map((r) => byRar[r].find((i) => elOf[i] === 'water' && heroes[i].unlockCost > 0)!);
const MILESTONES = ['unlock', '2', '3', '4', '5', '6', '7'];

type Result = Record<string, number[]>; // key -> days per path (Infinity when never)
const res: Record<string, Result> = { untargeted: {}, targeted: {} };
const rosterOwned: number[][] = [[], [], []]; // day 30/90/365 owned counts
const sevenStars: number[] = [];

for (const mode of ['untargeted', 'targeted'] as const) {
  for (let p = 0; p < PATHS; p++) {
    seed = (seedArg * 100003 + p * 7919 + (mode === 'targeted' ? 1 : 0)) >>> 0;
    const crests = new Float64Array(N), evo = new Int8Array(N).fill(-1); // -1 locked
    const hit: Record<string, number> = {};
    const settle = (d: number) => {
      for (let i = 0; i < N; i++) {
        if (evo[i] < 0 && crests[i] >= UNLOCK[rarOf[i]]) { crests[i] -= UNLOCK[rarOf[i]]; evo[i] = 0; }
        while (evo[i] >= 0 && evo[i] < MAXEVO && crests[i] >= STAR[evo[i]]) { crests[i] -= STAR[evo[i]]; evo[i]++; }
      }
      followed.forEach((h, k) => {
        const key = (m: string) => `${RAR[k]}:${m}`;
        if (evo[h] >= 0 && hit[key('unlock')] === undefined) hit[key('unlock')] = d;
        for (let st = 2; st <= 7; st++) if (evo[h] >= st - 1 && hit[key(String(st))] === undefined) hit[key(String(st))] = d;
      });
    };
    for (let d = 1; d <= DAYS; d++) {
      const weekday = (d - 1 + 1) % 7; // day 1 = Monday
      const open = (D.TRIAL_ROTATION as string[]).filter((e) => (D.TRIAL_SCHEDULE as any)[e].includes(weekday) || D.ALL_TRIALS_DAYS.includes(weekday));
      // Trials: wins spread over the open elements, 2 crests each to the element's pool (maxed heroes skipped)
      const wins = Math.floor(TRIALS) + (rnd() < TRIALS % 1 ? 1 : 0);
      for (let w = 0; w < wins; w++) {
        const el = open[w % open.length];
        let pool = heroes.map((_, i) => i).filter((i) => elOf[i] === el && evo[i] < MAXEVO);
        if (!pool.length) pool = heroes.map((_, i) => i).filter((i) => elOf[i] === el);
        for (let c = 0; c < D.TRIAL_MEDALS; c++) {
          const present = [0, 1, 2].filter((r) => pool.some((i) => rarOf[i] === r));
          const r = present[pickW(present.map((x) => trialW[x]))];
          const cand = pool.filter((i) => rarOf[i] === r);
          crests[cand[Math.floor(rnd() * cand.length)]] += 1;
        }
      }
      // Hero Chests: 3 drops by rarity weight, random hero, rolled size
      const chests = Math.floor(CHESTS) + (rnd() < CHESTS % 1 ? 1 : 0);
      for (let c = 0; c < chests * D.CHEST_DROPS; c++) {
        const r = pickW(chestW);
        const h = byRar[r][Math.floor(rnd() * byRar[r].length)];
        crests[h] += rolls[r][pickW(rolls[r].map((x) => x[1]))][0];
      }
      // Daily Crest Bundle: 3 different heroes at chest odds, smallest size
      if (rnd() < BUNDLE) for (let c = 0; c < 3; c++) { const r = pickW(chestW); crests[byRar[r][Math.floor(rnd() * byRar[r].length)]] += rolls[r][0][0]; }
      // Targeted crests (Wild Crests etc.) priced 1/2/4 per Common/Rare/Epic crest, all to the followed Epic when on
      if (mode === 'targeted') { const h = followed[2]; crests[h] += TARGETED / 4; }
      settle(d);
      if (mode === 'untargeted') {
        if (d === 30) rosterOwned[0].push(evo.filter((e) => e >= 0).length);
        if (d === 90) rosterOwned[1].push(evo.filter((e) => e >= 0).length);
        if (d === 365) { rosterOwned[2].push(evo.filter((e) => e >= 0).length); sevenStars.push(evo.filter((e) => e >= MAXEVO).length); }
      }
    }
    for (const k of [0, 1, 2]) for (const m of MILESTONES) { const key = `${RAR[k]}:${m}`; (res[mode][key] ??= []).push(hit[key] ?? Infinity); }
  }
}
const q = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor((s.length - 1) * p)]; };
const fmt = (v: number) => (Number.isFinite(v) ? v : null);
const summary: any = { inputs: { PATHS, DAYS, TRIALS, CHESTS, BUNDLE, TARGETED }, followed: followed.map((i) => `${heroes[i].id} (${heroes[i].rarity} ${heroes[i].element})`), modes: {} };
for (const mode of Object.keys(res)) {
  summary.modes[mode] = {};
  for (const [k, v] of Object.entries(res[mode])) summary.modes[mode][k] = { p10: fmt(q(v, 0.1)), p50: fmt(q(v, 0.5)), p90: fmt(q(v, 0.9)), reachedShare: +(v.filter(Number.isFinite).length / v.length).toFixed(3) };
}
summary.roster = { owned30: [q(rosterOwned[0], 0.1), q(rosterOwned[0], 0.5), q(rosterOwned[0], 0.9)], owned90: [q(rosterOwned[1], 0.1), q(rosterOwned[1], 0.5), q(rosterOwned[1], 0.9)], owned365: [q(rosterOwned[2], 0.1), q(rosterOwned[2], 0.5), q(rosterOwned[2], 0.9)], sevenStar365: [q(sevenStars, 0.1), q(sevenStars, 0.5), q(sevenStars, 0.9)], of: N };
if (outIdx >= 0) writeFileSync(args[outIdx + 1], JSON.stringify(summary, null, 1));
console.log(JSON.stringify(summary, null, 1));
