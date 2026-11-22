// Bench-hero systems for the economy simulator (design study 2026-11-21, not in the game):
//   bonds  Squad Bonds: Partner bonds (Common + mentor) and Troop bonds (Commons of one element)
//   dojo   Type Dojo: one tower per Type, floors give that Type a permanent ATK/HP bonus + first-clear rewards
//   walls  Hold the Walls: three walls, each defended by its own 5 heroes, waves -> daily rewards
// Turn on with SIM_BENCH=bonds,dojo,walls (any subset). With none on, it only records what the systems WOULD see
// (Type and element team power), so the baseline can be used to calibrate the numbers.
// Tunables come from SIM_BENCH_CFG (JSON) over the defaults below.
import Decimal from 'break_infinity.js';

const ON = new Set((process.env.SIM_BENCH ?? '').split(',').map((x) => x.trim()).filter(Boolean));
export const BENCH_ON = ON;

export const CFG = {
  // bonds
  partnerPerStar: 0.10, // mentor ATK+HP per star of its Common partner
  troop: [0, 0, 0.10, 0.25, 0.50] as number[], // ATK for that element by Commons of it on the team (index = count, 4+ = last)
  variety: 0, // team ATK per different Type on the team (variety bonus)
  // dojo
  dojoFloors: 50,
  dojoPerFloor: 0.02, // ATK+HP for that Type per floor cleared
  dojoBase: 1, // floor 1 needs dojoBase x (5 one-star Common heroes' fixed CP)
  dojoGrowth: 1.25, // each floor needs this much more
  dojoWild: 5, // Wild Crests per first clear
  dojoGems10: 50, // Gems every 10th floor
  dojoOpenDay: 0, // opens at a player level; modelled as "after first Rekindle"
  // towers (Element Towers: rewards only, foes = heroes of that element)
  towerFloors: 1e9,
  towerBase: 31.6, // floor 1 foe team = towerBase x (5 one-star Commons' fixed CP)
  towerGrowth: 1.2, // each floor's foe team is this much stronger
  towerCrests: 5, // crests of the element per floor
  towerGems: 5, // Gems per floor
  towerEpic10: 10, // Epic crests every 10th floor
  towerStones5: 5, // Enhance Stones every 5th floor
  // walls
  wallsWaves: 30,
  wallsBase: 1, // wave 1 needs wallsBase x (5 one-star Commons' fixed CP)
  wallsGrowth: 1.22,
  wallsTries: 2,
  wallsWildPer: 1 / 3, // Wild Crests per wave per try (floored)
  wallsStonesPer: 1 / 5, // Enhance Stones per wave per try (floored)
  ...(process.env.SIM_BENCH_CFG ? JSON.parse(process.env.SIM_BENCH_CFG) : {}),
};

// Partner bonds: Common -> mentor (same element and Type where possible). Ascendant heroes left out.
export const PARTNERS: Record<string, string> = {
  crabarchers: 'aurora', crabspears: 'gaff', crabbrute: 'glacius', crabscrappers: 'skiff', bubbles: 'nerissa',
  magmaarchers: 'kestra', magmabrute: 'pyrrhus', magmascrappers: 'flint', wyrmling: 'ember',
  mudarchers: 'talonra', mudbrute: 'tusk', muddaggers: 'burrow', mudspears: 'verdana', seedling: 'sylvara',
  rook: 'wraith', bonearchers: 'weaver', bonebrute: 'ruin', boneswords: 'shade', drakebot: 'mourn', flit: 'hex',
  swiftwing: 'halo', glimmer: 'cyclo', glint: 'volta', mendbot: 'lumen', quill: 'brightmane',
};
const MENTOR_OF: Record<string, string[]> = {};
for (const [c, m] of Object.entries(PARTNERS)) (MENTOR_OF[m] ??= []).push(c);

const COUNTER: Record<string, string> = { fire: 'water', earth: 'fire', water: 'earth', light: 'dark', dark: 'light' };
// Raider elements by week (3 a week, rotating)
const RAIDS = [['fire', 'earth', 'water'], ['water', 'light', 'dark'], ['earth', 'dark', 'fire'], ['light', 'water', 'earth'], ['dark', 'fire', 'light']];

export function installBench(s: any, deps: { HEROES: any[]; elementMultiplier: (a: string, b: string) => number; utcWeekStart: (t: number) => string }) {
  const { HEROES, elementMultiplier } = deps;
  const byId = new Map(HEROES.map((h: any) => [h.id, h]));
  const commons = HEROES.filter((h: any) => h.rarity === 'common' && !String(h.id).startsWith('asc_'));
  const st = {
    noBond: false,
    floors: {} as Record<string, number>,
    wallsBest: 0, wallsLast: 0, wallsDay: '', wallsWeek: '',
    towers: {} as Record<string, number>,
    wildIn: { dojo: 0, walls: 0, towers: 0 }, stonesIn: { walls: 0, towers: 0 }, gemsIn: { dojo: 0, towers: 0 }, crestsIn: { towers: 0 },
  };

  const elOf = (h: any) => s.formDef(h).element;
  const isCommonNow = (id: string) => { const h = byId.get(id); return h && s.formDef(h).rarity === 'common' && !String(id).startsWith('asc_'); };

  /** ATK and HP multipliers from bonds + Dojo for a hero, given a team test (id -> on team). */
  function mults(base: any, onTeam: (id: string) => boolean, withDojo = true, typeCount?: number): { atk: number; hp: number } {
    let atk = 1, hp = 1;
    if (ON.has('bonds') && !st.noBond && onTeam(base.id)) {
      for (const c of MENTOR_OF[base.id] ?? []) if (onTeam(c) && (s.levels[c] ?? 0) > 0) {
        const m = 1 + CFG.partnerPerStar * ((s.stars[c] ?? 0) + 1);
        atk *= m; hp *= m;
      }
      const el = elOf(base);
      let n = 0;
      for (const c of commons) if (onTeam(c.id) && isCommonNow(c.id) && elOf(c) === el) n++;
      atk *= 1 + CFG.troop[Math.min(n, CFG.troop.length - 1)];
      if (CFG.variety) {
        let n2 = typeCount;
        if (n2 === undefined) { const types = new Set<string>(); for (const h of HEROES) if (onTeam(h.id) && (s.levels[h.id] ?? 0) > 0) types.add(s.formDef(h).type); n2 = types.size; }
        atk *= 1 + CFG.variety * n2;
      }
    }
    if (ON.has('dojo') && withDojo) {
      const f = st.floors[s.formDef(base).type] ?? 0;
      atk *= 1 + CFG.dojoPerFloor * f; hp *= 1 + CFG.dojoPerFloor * f;
    }
    return { atk, hp };
  }

  // Patch heroStats: ATK/HP (value) scaled by bonds (current lineup) and Dojo.
  if (ON.has('bonds') || ON.has('dojo')) {
    const orig = s.heroStats.bind(s);
    s.heroStats = (base: any, level?: number) => {
      const r = level === undefined ? orig(base) : orig(base, level);
      const m = mults(base, (id) => s.inLineup(id));
      if (m.atk === 1 && m.hp === 1) return r;
      return { ...r, atk: { ...r.atk, value: r.atk.value.times(m.atk) }, hp: { ...r.hp, value: r.hp.value.times(m.hp) } };
    };
  }

  /** Bond-aware team choice: start from the engine's pick, then swap in Commons while the team value rises. */
  function improveTeam(want: any[], owned: any[], score: Map<string, number>): any[] {
    if (!ON.has('bonds')) return want;
    const value = (team: any[]) => {
      const ids = new Set(team.map((h) => h.id));
      const tc = new Set(team.map((h) => s.formDef(h).type)).size;
      let v = 0;
      for (const h of team) {
        const m = mults(h, (id) => ids.has(id), false, tc);
        v += (score.get(h.id) ?? 0) * Math.sqrt(m.atk * m.hp);
      }
      return v;
    };
    let team = want.slice();
    let best = value(team);
    const cands = CFG.variety ? owned : owned.filter((h) => isCommonNow(h.id) || MENTOR_OF[h.id]);
    for (let round = 0; round < 10; round++) {
      let move: any[] | null = null; let mv = best;
      for (const c of cands) {
        if (team.includes(c)) continue;
        for (let i = 0; i < team.length; i++) {
          const t = team.slice(); t[i] = c;
          const v = value(t);
          if (v > mv * 1.001) { mv = v; move = t; }
        }
      }
      if (!move) break;
      team = move; best = mv;
    }
    return team;
  }

  // ---- fixed-level power (modes without levels) ----
  const fcp = (h: any) => s.fixedCombatPower(h) as Decimal;
  let unit = 0;
  /** Fixed CP of a 1-star Common with nothing else: the yardstick for Dojo and Walls difficulty. */
  function yard(): number {
    if (unit) return unit;
    const c = commons[0];
    const save = { lv: s.levels[c.id], st: s.stars[c.id] };
    st.noBond = true;
    s.levels[c.id] = 1; s.stars[c.id] = 0;
    unit = fcp(c).toNumber();
    if (save.lv === undefined) delete s.levels[c.id]; else s.levels[c.id] = save.lv;
    if (save.st === undefined) delete s.stars[c.id]; else s.stars[c.id] = save.st;
    st.noBond = false;
    return unit;
  }
  const top5 = (hs: any[], f: (h: any) => number) => hs.map(f).sort((a, b) => b - a).slice(0, 5).reduce((a, b) => a + b, 0);
  const owned = () => HEROES.filter((h: any) => (s.levels[h.id] ?? 0) > 0);

  function typePower(): Record<string, number> {
    const o: Record<string, number> = {};
    const hs = owned();
    for (const t of new Set(hs.map((h: any) => s.formDef(h).type))) o[t as string] = top5(hs.filter((h: any) => s.formDef(h).type === t), (h) => fcp(h).toNumber()) / (5 * yard());
    return o;
  }

  function dojo(day: number) {
    if (!ON.has('dojo') || !s.rekindles) return;
    void day;
    for (let g = 0; g < 3; g++) {
      const tp = typePower();
      let any = false;
      for (const [t, p] of Object.entries(tp)) {
        let f = st.floors[t] ?? 0;
        while (f < CFG.dojoFloors && p >= CFG.dojoBase * CFG.dojoGrowth ** f) {
          f++;
          s.wildCrests += CFG.dojoWild; st.wildIn.dojo += CFG.dojoWild;
          if (f % 10 === 0) { s.gems += CFG.dojoGems10; st.gemsIn.dojo += CFG.dojoGems10; }
          any = true;
        }
        st.floors[t] = f;
      }
      if (!any) break;
    }
  }

  let pickN = 0;
  function towers() {
    if (!ON.has('towers') || !s.rekindles) return;
    const hs = owned();
    for (const el of ['water', 'fire', 'earth', 'light', 'dark']) {
      const p = top5(hs.filter((h: any) => elOf(h) === el), (h) => fcp(h).toNumber()) / (5 * yard());
      let f = st.towers[el] ?? 0;
      // Endless towers (2026-11-22): 5 crests of the element + 5 Gems a floor, Stones every 5th, an Epic Element Chest every 10th.
      while (f < CFG.towerFloors && p >= CFG.towerBase * CFG.towerGrowth ** f) {
        f++;
        for (let i = 0; i < CFG.towerCrests; i++) { const pool = s.trialPool(el); s.addCrests(pool[pickN++ % pool.length].id, 1); }
        st.crestsIn.towers += CFG.towerCrests;
        s.gems += CFG.towerGems; st.gemsIn.towers += CFG.towerGems;
        if (f % 5 === 0) { s.enhanceStones += CFG.towerStones5; st.stonesIn.towers += CFG.towerStones5; }
        if (f % 10 === 0) {
          const epics = HEROES.filter((h: any) => h.element === el && h.rarity === 'epic' && !h.unique && !String(h.id).startsWith('asc_'));
          const open = epics.filter((h: any) => !s.atTopStar(h.id));
          const pool = open.length ? open : epics;
          if (pool.length) { s.addCrests(pool[pickN++ % pool.length].id, CFG.towerEpic10); st.crestsIn.towers += CFG.towerEpic10; }
        }
      }
      st.towers[el] = f;
    }
  }

  function wallsResult(raid: string[]): number {
    const used = new Set<string>();
    let worst = Infinity;
    const hs = owned();
    for (const r of raid) {
      const pick = hs.filter((h: any) => !used.has(h.id)).map((h: any) => ({ h, p: fcp(h).toNumber() * elementMultiplier(elOf(h), r) })).sort((a, b) => b.p - a.p).slice(0, 5);
      for (const x of pick) used.add(x.h.id);
      const p = pick.reduce((a, b) => a + b.p, 0) / (5 * yard());
      const waves = p < CFG.wallsBase ? 0 : Math.min(CFG.wallsWaves, 1 + Math.floor(Math.log(p / CFG.wallsBase) / Math.log(CFG.wallsGrowth)));
      worst = Math.min(worst, waves);
    }
    return worst === Infinity ? 0 : worst;
  }
  function raidOf(now: number) { const w = Math.floor(now / (7 * 86400000)); return RAIDS[w % RAIDS.length]; }

  function walls(now: number, dayKey: string) {
    if (!s.rekindles) return;
    const w = wallsResult(raidOf(now));
    st.wallsLast = w; st.wallsBest = Math.max(st.wallsBest, w);
    if (!ON.has('walls') || st.wallsDay === dayKey) return;
    st.wallsDay = dayKey;
    const wild = Math.floor(w * CFG.wallsWildPer) * CFG.wallsTries;
    const stones = Math.floor(w * CFG.wallsStonesPer) * CFG.wallsTries;
    s.wildCrests += wild; st.wildIn.walls += wild;
    s.enhanceStones += stones; st.stonesIn.walls += stones;
  }

  function snapshot(lineup: any[]) {
    const ids = new Set(lineup.map((h) => h.id));
    const tp = typePower();
    const elp: Record<string, number> = {};
    const hs = owned();
    for (const el of ['water', 'fire', 'earth', 'light', 'dark']) elp[el] = +(Math.log10(Math.max(1e-9, top5(hs.filter((h: any) => elOf(h) === el), (h) => fcp(h).toNumber()) / (5 * yard())))).toFixed(2);
    return {
      on: [...ON].join('+') || 'none',
      commonsOnTeam: lineup.filter((h) => isCommonNow(h.id)).length,
      partnersActive: Object.entries(PARTNERS).filter(([c, m]) => ids.has(c) && ids.has(m)).length,
      commonStarsAvg: +(commons.filter((c: any) => (s.levels[c.id] ?? 0) > 0).reduce((a: number, c: any) => a + (s.stars[c.id] ?? 0) + 1, 0) / Math.max(1, commons.filter((c: any) => (s.levels[c.id] ?? 0) > 0).length)).toFixed(2),
      typePowLog: Object.fromEntries(Object.entries(tp).map(([k, v]) => [k, +Math.log10(Math.max(1e-9, v)).toFixed(2)])),
      elemPowLog: elp,
      towers: { ...st.towers }, towersTotal: Object.values(st.towers).reduce((a, b) => a + b, 0),
      floors: { ...st.floors }, floorsTotal: Object.values(st.floors).reduce((a, b) => a + b, 0),
      wallsLast: st.wallsLast, wallsBest: st.wallsBest,
      wildIn: { ...st.wildIn }, stonesIn: { ...st.stonesIn }, gemsIn: { ...st.gemsIn }, crestsIn: { ...st.crestsIn },
    };
  }

  yard();
  return { improveTeam, dojo, towers, walls, snapshot, st };
}
