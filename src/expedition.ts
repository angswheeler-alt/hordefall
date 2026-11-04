/**
 * Expedition (Samuel, 2026-11-04): an optional mini roguelike. The player walks a short map of stops, picks a path
 * at every fork, picks one of three Boons after each won fight, and hires heroes from friends, Colosseum players or
 * travelers along the way. The last stop is a boss.
 *
 * - Never forced: one charge a day, stacking up to EXP_CHARGE_CAP, so it can wait for days.
 * - Levels: clearing level N by hand opens level N+1 and lets the player Auto-clear level N for
 *   EXP_AUTO_SHARE of the reward without playing.
 * - Foes scale to the party's power when the run starts, so the choices (Boons, hires, paths) decide the run.
 * - Three hearts: a lost fight costs one and the fight can be tried again; no hearts left ends the run,
 *   and the player keeps a share of the reward for the stops cleared.
 * - Rewards are things the game already has (Gems, Wild Crests, Enhance Stones, a Glyph Chest), about a
 *   Scouting day's worth, so nothing runs away.
 */
import type { Element, HeroType } from './data';
import { seededRandom } from './colosseum';

/** Expedition is hidden from players for now (Samuel, 2026-11-04: "take it out for now"). Set true to bring it back. */
export const EXP_ENABLED = false;
export const EXP_UNLOCK_LEVEL = 10;
export const EXP_CHARGE_CAP = 5;
export const EXP_HEARTS = 3;
/** Stops on the map: EXP_ROWS forks, then the boss. */
export const EXP_ROWS = 7;
export const EXP_STOPS = EXP_ROWS + 1;
/** Own heroes in the party, and borrowed heroes on top. */
export const EXP_PARTY_MAX = 5;
export const EXP_HIRE_MAX = 2;
/** Auto-clear pays this share of a full clear. */
export const EXP_AUTO_SHARE = 0.8;
export const EXP_MAX_LEVEL = 30;

export type ExpNodeKind = 'fight' | 'elite' | 'camp' | 'recruit' | 'mystery' | 'boss';

export const EXP_NODE_INFO: Record<ExpNodeKind, { name: string; text: string }> = {
  fight: { name: 'Fight', text: 'A team of raiders. Win to pick a Boon.' },
  elite: { name: 'Elite', text: 'A much stronger team. Win for a Boon and extra loot.' },
  camp: { name: 'Camp', text: 'Rest: get a heart back, or train for a Boon.' },
  recruit: { name: 'Tavern', text: 'Hire a hero from another player.' },
  mystery: { name: 'Mystery', text: 'Something odd on the road. Choose what to do.' },
  boss: { name: 'Boss', text: 'The warlord at the end. Beat it to finish the Expedition.' },
};

/** How strong foes are, as a share of the party's power at the start, before the level's own step. */
export function foeShare(row: number, kind: ExpNodeKind): number {
  const base = 0.6 + 0.05 * row;
  if (kind === 'elite') return base * 1.25;
  if (kind === 'boss') return 1.1;
  return base;
}

/** Each Expedition level makes foes this much stronger. */
export function levelMult(level: number): number {
  return 1 + 0.08 * (Math.max(1, level) - 1);
}

// ---------- Boons ----------

export interface Boon {
  id: string;
  name: string;
  text: string;
  atk?: number;
  hp?: number;
  def?: number;
  /** Only heroes of this element / Type, or only borrowed heroes. */
  element?: Element;
  type?: HeroType;
  hired?: boolean;
}

const ELEMS: Element[] = ['water', 'fire', 'earth', 'light', 'dark'];
const TYPES: HeroType[] = ['Ranger', 'Gunner', 'Magician', 'Knight', 'Barbarian', 'Rogue', 'Lancer', 'Samurai', 'Brawler', 'Support'];
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export const BOONS: Boon[] = [
  { id: 'steel', name: 'Sharpened Steel', text: 'Whole party +20% ATK', atk: 0.2 },
  { id: 'rations', name: 'Hearty Rations', text: 'Whole party +25% HP', hp: 0.25 },
  { id: 'wall', name: 'Shield Wall', text: 'Whole party +40% Defense', def: 0.4 },
  { id: 'glass', name: 'Glass Cannon', text: 'Whole party +45% ATK, but -15% HP', atk: 0.45, hp: -0.15 },
  { id: 'hired', name: 'Good Pay', text: 'Borrowed heroes +60% ATK and HP', atk: 0.6, hp: 0.6, hired: true },
  ...ELEMS.map((e) => ({ id: `el-${e}`, name: `${cap(e)} Fervor`, text: `${cap(e)} heroes +50% ATK`, atk: 0.5, element: e })),
  ...TYPES.map((t) => ({ id: `ty-${t}`, name: `${t} Drill`, text: `${t}s +40% ATK and HP`, atk: 0.4, hp: 0.4, type: t })),
];
export const boonById = (id: string) => BOONS.find((b) => b.id === id);

/** A hero as a Boon sees it. */
export interface BoonTarget {
  element: Element;
  type: HeroType;
  hired: boolean;
}

export function boonApplies(b: Boon, u: BoonTarget): boolean {
  if (b.hired && !u.hired) return false;
  if (b.element && b.element !== u.element) return false;
  if (b.type && b.type !== u.type) return false;
  return true;
}

/** Stat multipliers from all Boons taken (they stack by multiplying). */
export function boonMults(ids: string[], u: BoonTarget): { atk: number; hp: number; def: number } {
  const m = { atk: 1, hp: 1, def: 1 };
  for (const id of ids) {
    const b = boonById(id);
    if (!b || !boonApplies(b, u)) continue;
    m.atk *= 1 + (b.atk ?? 0);
    m.hp *= 1 + (b.hp ?? 0);
    m.def *= 1 + (b.def ?? 0);
  }
  return m;
}

/** Three Boons to choose from: only ones that help someone in the party. */
export function rollBoons(seed: string, party: BoonTarget[]): string[] {
  const rand = seededRandom(seed);
  const useful = BOONS.filter((b) => party.some((u) => boonApplies(b, u)));
  const out: string[] = [];
  const pool = [...useful];
  while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0].id);
  return out;
}

// ---------- The map ----------

/** Two choices per row, then the boss. Row 0 always offers a Tavern; a Camp turns up late in the road. */
export function makeMap(seed: string): ExpNodeKind[][] {
  const rand = seededRandom(seed);
  const pickTwo = (kinds: ExpNodeKind[]): ExpNodeKind[] => {
    const a = kinds[Math.floor(rand() * kinds.length)];
    const rest = kinds.filter((k) => k !== a);
    return [a, rest[Math.floor(rand() * rest.length)]];
  };
  const rows: ExpNodeKind[][] = [];
  for (let r = 0; r < EXP_ROWS; r++) {
    if (r === 0) rows.push(['fight', 'recruit']);
    else if (r === 1) rows.push(pickTwo(['fight', 'mystery', 'elite']));
    else if (r === EXP_ROWS - 1) rows.push(['camp', pickTwo(['fight', 'elite', 'recruit'])[0]]);
    else rows.push(pickTwo(['fight', 'fight', 'elite', 'recruit', 'mystery', 'camp']));
  }
  // A coin flip for which side each choice sits on.
  for (const row of rows) if (rand() < 0.5) row.reverse();
  rows.push(['boss']);
  return rows;
}

// ---------- Mystery events ----------

export interface MysteryOption {
  id: 'shrine' | 'gamble' | 'stranger' | 'leave' | 'cache';
  label: string;
  text: string;
}

export const MYSTERY_OPTIONS: MysteryOption[] = [
  { id: 'shrine', label: 'Pray at the shrine', text: 'Pick a Boon, but lose a heart.' },
  { id: 'gamble', label: 'Open the strange chest', text: 'Half the time +1 extra Wild Crest at the end, half the time lose a heart.' },
  { id: 'stranger', label: 'Help the stranger', text: 'A wandering hero offers to join for free.' },
  { id: 'cache', label: 'Search the ruins', text: '+2 Gems at the end of the run.' },
  { id: 'leave', label: 'Walk on', text: 'Nothing happens.' },
];

/** The options a Mystery stop offers: two of the first four, plus Walk on. */
export function mysteryOptions(seed: string): MysteryOption[] {
  const rand = seededRandom(seed);
  const pool = MYSTERY_OPTIONS.filter((o) => o.id !== 'leave');
  const a = pool.splice(Math.floor(rand() * pool.length), 1)[0];
  const b = pool[Math.floor(rand() * pool.length)];
  return [a, b, MYSTERY_OPTIONS.find((o) => o.id === 'leave')!];
}

// ---------- Rewards ----------

export interface ExpReward {
  gems: number;
  wild: number;
  stones: number;
  /** Glyph Chest (1-3★) or, from level 6, a Rare Glyph Chest. */
  chest: 'glyph' | 'grand' | null;
}

/** What a full clear of a level pays (boss beaten). */
export function fullReward(level: number): ExpReward {
  const l = Math.max(1, Math.min(EXP_MAX_LEVEL, level));
  return { gems: Math.min(40, 10 + 2 * l), wild: Math.min(15, 2 + l), stones: 1 + Math.floor(l / 3), chest: l >= 6 ? 'grand' : 'glyph' };
}

/** A run that ended early: a share of the full clear for the stops cleared, no chest. */
export function partReward(level: number, stopsCleared: number): ExpReward {
  const f = fullReward(level);
  const share = Math.max(0, Math.min(EXP_STOPS - 1, stopsCleared)) / EXP_STOPS;
  return { gems: Math.floor(f.gems * share), wild: Math.floor(f.wild * share), stones: Math.floor(f.stones * share), chest: null };
}

/** Auto-clear: EXP_AUTO_SHARE of a full clear, chest included. */
export function autoReward(level: number): ExpReward {
  const f = fullReward(level);
  return { gems: Math.floor(f.gems * EXP_AUTO_SHARE), wild: Math.floor(f.wild * EXP_AUTO_SHARE), stones: Math.max(1, Math.floor(f.stones * EXP_AUTO_SHARE)), chest: f.chest };
}

// ---------- State ----------

/** A hero someone else owns, offered at a Tavern: stats fitted to the party's own heroes. */
export interface ExpHire {
  /** Who it belongs to, and where they were found. */
  owner: string;
  source: 'friend' | 'arena' | 'traveler';
  id: string;
  stars: number;
  ember: number;
  power: number;
  cp: string;
}

/** A player whose heroes can be hired (from the server, or made up). */
export interface ExpLender {
  name: string;
  source: ExpHire['source'];
  heroes: Array<{ id: string; stars: number }>;
}

export interface ExpRun {
  level: number;
  seed: string;
  map: ExpNodeKind[][];
  /** Stops cleared; the next stop is on row `row`. */
  row: number;
  /** Which choice was taken on each row passed. */
  path: number[];
  /** The stop picked on the current row (-1 = still choosing). */
  at: number;
  hearts: number;
  party: string[];
  hires: ExpHire[];
  boons: string[];
  /** Party power when the run began: foes are fitted to it. */
  basePower: string;
  /** Choices waiting for the player: Boons to pick, heroes to hire, a Mystery. */
  offer?: { kind: 'boon' | 'hire' | 'mystery' | 'camp'; boons?: string[]; hires?: ExpHire[]; mystery?: MysteryOption['id'][] };
  /** Extras earned along the road. */
  bonusWild: number;
  bonusGems: number;
  elites: number;
  /** Foes of the current fight (fitted when the stop is picked). */
  foe?: { name: string; heroes: Array<{ id: string; stars: number }>; ember: number; power: number; cp: string };
  /** A fight is running (closing the game mid-fight counts as a loss). */
  fighting?: boolean;
  /** Lenders for Taverns, fixed for the run. */
  lenders: ExpLender[];
}

export interface ExpState {
  charges: number;
  /** Local day charges were last added. */
  day: string;
  /** Best level cleared by hand (0 = none). */
  best: number;
  runs: number;
  clears: number;
  run?: ExpRun;
}

export function newExpedition(): ExpState {
  return { charges: 0, day: '', best: 0, runs: 0, clears: 0 };
}

/** Whole days from one local day key to another. */
export function daysBetween(from: string, to: string): number {
  const t = (k: string) => {
    const [y, m, d] = k.split('-').map(Number);
    return Date.UTC(y, (m || 1) - 1, d || 1);
  };
  if (!from) return 1;
  return Math.max(0, Math.round((t(to) - t(from)) / 86_400_000));
}

const KINDS: ExpNodeKind[] = ['fight', 'elite', 'camp', 'recruit', 'mystery', 'boss'];

/** Clean a saved Expedition. A fight that was running when the game closed counts as a loss. */
export function cleanExpedition(raw: unknown, heroIds: Set<string>): ExpState {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<ExpState>;
  const int = (v: unknown, lo = 0, hi = Number.MAX_SAFE_INTEGER) => Math.min(hi, Math.max(lo, Math.floor(Number(v) || 0)));
  const s = newExpedition();
  s.charges = int(r.charges, 0, EXP_CHARGE_CAP);
  s.day = typeof r.day === 'string' ? r.day : '';
  s.best = int(r.best, 0, EXP_MAX_LEVEL);
  s.runs = int(r.runs);
  s.clears = int(r.clears);
  const run = r.run as Partial<ExpRun> | null | undefined;
  if (run && typeof run === 'object' && Array.isArray(run.map) && Array.isArray(run.party)) {
    const map = run.map.map((row) => (Array.isArray(row) ? row.filter((k): k is ExpNodeKind => KINDS.includes(k as ExpNodeKind)) : []));
    const party = run.party.filter((id): id is string => typeof id === 'string' && heroIds.has(id)).slice(0, EXP_PARTY_MAX);
    if (map.length === EXP_STOPS && map.every((row) => row.length) && party.length) {
      const hireOk = (h: unknown): h is ExpHire => !!h && typeof h === 'object' && typeof (h as ExpHire).id === 'string' && heroIds.has((h as ExpHire).id);
      const cleanHire = (h: ExpHire): ExpHire => ({ owner: String(h.owner ?? 'Traveler').slice(0, 24), source: h.source === 'friend' || h.source === 'arena' ? h.source : 'traveler', id: h.id, stars: int(h.stars, 0, 7), ember: int(h.ember, 1), power: Number(h.power) > 0 ? Number(h.power) : 1, cp: typeof h.cp === 'string' ? h.cp : '0' });
      const out: ExpRun = {
        level: int(run.level, 1, EXP_MAX_LEVEL),
        seed: typeof run.seed === 'string' ? run.seed : 'x',
        map,
        row: int(run.row, 0, EXP_STOPS - 1),
        path: Array.isArray(run.path) ? run.path.map((x) => int(x, 0, 1)) : [],
        at: Number(run.at) === 0 || Number(run.at) === 1 ? Number(run.at) : -1,
        hearts: int(run.hearts, 0, EXP_HEARTS),
        party,
        hires: (Array.isArray(run.hires) ? run.hires : []).filter(hireOk).map(cleanHire).slice(0, EXP_HIRE_MAX),
        boons: (Array.isArray(run.boons) ? run.boons : []).filter((id): id is string => typeof id === 'string' && !!boonById(id)),
        basePower: typeof run.basePower === 'string' ? run.basePower : '1',
        bonusWild: int(run.bonusWild),
        bonusGems: int(run.bonusGems),
        elites: int(run.elites),
        lenders: (Array.isArray(run.lenders) ? run.lenders : [])
          .filter((l): l is ExpLender => !!l && typeof l === 'object' && Array.isArray((l as ExpLender).heroes))
          .map((l): ExpLender => ({ name: String(l.name ?? 'Traveler').slice(0, 24), source: l.source === 'friend' || l.source === 'arena' ? l.source : 'traveler', heroes: l.heroes.filter((x) => x && heroIds.has(x.id)).map((x) => ({ id: x.id, stars: int(x.stars, 0, 7) })).slice(0, 10) }))
          .slice(0, 16),
      };
      if (run.offer && typeof run.offer === 'object') {
        const o = run.offer;
        if (o.kind === 'boon' || o.kind === 'camp') out.offer = { kind: o.kind, boons: (o.boons ?? []).filter((id) => !!boonById(id)) };
        else if (o.kind === 'hire') out.offer = { kind: 'hire', hires: (o.hires ?? []).filter(hireOk).map(cleanHire) };
        else if (o.kind === 'mystery') out.offer = { kind: 'mystery', mystery: (o.mystery ?? []).filter((id) => MYSTERY_OPTIONS.some((m) => m.id === id)) };
      }
      if (run.foe && typeof run.foe === 'object' && Array.isArray(run.foe.heroes)) {
        const f = run.foe;
        out.foe = { name: String(f.name ?? 'Raiders').slice(0, 24), heroes: f.heroes.filter((x) => x && heroIds.has(x.id)).map((x) => ({ id: x.id, stars: int(x.stars, 0, 7) })), ember: int(f.ember, 1), power: Number(f.power) > 0 ? Number(f.power) : 1, cp: typeof f.cp === 'string' ? f.cp : '0' };
        if (!out.foe.heroes.length) delete out.foe;
      }
      if (run.fighting) out.hearts = Math.max(0, out.hearts - 1);
      s.run = out;
    }
  }
  return s;
}
