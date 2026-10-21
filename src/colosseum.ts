import Decimal from 'break_infinity.js';
import { elementMultiplier, type Element } from './data';
import { defended } from './formulas';

/**
 * Colosseum (PvP), design doc section 12.1 and the plan agreed with Samuel on 2026-10-21:
 * async fights against saved teams, Ghost (bot) teams wherever a rank has no real players,
 * ranks from Bronze up with three sub-ranks each, Starmotes paid per fight, every day and
 * every week, and a drop of one full rank each Monday so players climb back up.
 */

/** Colosseum tickets: hold up to PVP_TICKET_CAP, one more every PVP_TICKET_MINUTES. */
export const PVP_TICKET_CAP = 10;
export const PVP_TICKET_MINUTES = 120;
/** Extra tickets for Gems each day (test price). */
export const PVP_TICKET_GEMS = 20;
export const PVP_TICKET_BUYS = 5;
/** Free new opponents every PVP_REFRESH_MINUTES. */
export const PVP_REFRESH_MINUTES = 10;
/** A fight lasts this long; if both teams still stand, the one with more HP left (as a share) wins. */
export const PVP_TIME = 60;

export const RANK_NAMES = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Legend'] as const;
/** Trophies where each sub-rank starts: Bronze I, II, III, Silver I ... Diamond III, then Legend. Each step needs more. */
export const RANK_TROPHIES = [0, 60, 140, 240, 360, 500, 660, 840, 1040, 1260, 1500, 1760, 2040, 2340, 2660, 3000];
export const LEGEND = RANK_TROPHIES.length - 1;
/** Starmotes paid each day (local midnight) and each week (Monday) for the sub-rank held, by sub-rank index. */
export const RANK_DAILY = [10, 12, 14, 16, 18, 20, 24, 27, 30, 34, 38, 42, 46, 50, 55, 60];
export const RANK_WEEKLY = [30, 40, 50, 60, 70, 80, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1200];
/** Each Monday, after the weekly pay, everyone drops this many sub-ranks (one full rank), never below Bronze I. */
export const WEEKLY_DROP = 3;

/**
 * Three opponents from the player's rank, nothing saying which is a real player and which a bot.
 * Bot teams land at a random share of the player's CP in [PVP_CP_MIN, PVP_CP_MAX] (times rank pressure);
 * real players qualify inside [PVP_REAL_MIN, PVP_REAL_MAX].
 */
export const PVP_CP_MIN = 0.85;
export const PVP_CP_MAX = 1.15;
export const PVP_REAL_MIN = 0.7;
export const PVP_REAL_MAX = 1.4;
/** What a win pays (any opponent), and what a loss costs. */
export const PVP_WIN_TROPHIES = 12;
export const PVP_WIN_MOTES = 5;
export const PVP_LOSS_TROPHIES = 8;
export const PVP_LOSS_MOTES = 1;
export const PVP_FIRST_WIN_MOTES = 10;
/** Ghosts get this much more CP for each sub-rank above Bronze I, so higher ranks need a stronger team. */
export const RANK_PRESSURE = 0.04;
/** Fallen fighters on both sides get back up this much faster in the Colosseum (lane: 6 s, Colosseum: 3 s). */
export const PVP_RESPAWN_MULT = 0.5;
/** Each win in a row gives this much more damage on the next attack, up to PVP_STREAK_MAX wins. */
export const PVP_STREAK_DMG = 0.1;
export const PVP_STREAK_MAX = 3;

/** Sub-rank index (0 = Bronze I, LEGEND = Legend) for a trophy count. */
export function rankIndex(trophies: number): number {
  let i = 0;
  while (i < LEGEND && trophies >= RANK_TROPHIES[i + 1]) i++;
  return i;
}

/** "Silver II", "Legend". */
export function rankName(index: number): string {
  if (index >= LEGEND) return 'Legend';
  return `${RANK_NAMES[Math.floor(index / 3)]} ${['I', 'II', 'III'][index % 3]}`;
}

/** Trophies after the weekly drop: the start of the sub-rank WEEKLY_DROP below (Legend drops to Diamond I). */
export function droppedTrophies(trophies: number): number {
  const i = rankIndex(trophies);
  return RANK_TROPHIES[Math.max(0, (i === LEGEND ? LEGEND - 1 : i) - WEEKLY_DROP)];
}

/** A small seeded random generator (mulberry32), so a Ghost is the same every time its seed comes up. */
export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Bot names read like real usernames, so players can't tell bots from people.
const NAME_WORDS = ['Shadow', 'Blaze', 'Frost', 'Storm', 'Ember', 'Tide', 'Moss', 'Iron', 'Lunar', 'Solar', 'Rogue', 'Wolf', 'Raven', 'Viper', 'Fox', 'Drake', 'Nova', 'Ash', 'Zen', 'Rune', 'Pixel', 'Thorn', 'Bolt', 'Echo', 'Onyx', 'Kitsu', 'Mango', 'Pepper', 'Bramble'];
const NAME_TAILS = ['fang', 'heart', 'blade', 'born', 'claw', 'wing', 'strike', 'byte', 'king', 'queen', 'smith', 'rider', 'lord', 'kid', 'main', 'tamer'];
const NAME_FIRST = ['kai', 'mira', 'leo', 'nina', 'jay', 'sora', 'theo', 'luna', 'max', 'ivy', 'ren', 'zoe', 'finn', 'aria', 'milo', 'yuki', 'sam', 'nate', 'emi', 'ollie'];

/** A made-up username from a seeded generator, in a few everyday styles ("FrostFang92", "mira_x", "xXBlazeXx"). */
export function ghostName(rand: () => number): string {
  const pick = <T>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  const num = () => String(Math.floor(rand() * (rand() < 0.5 ? 100 : 10000)));
  const style = Math.floor(rand() * 6);
  if (style === 0) return `${pick(NAME_WORDS)}${pick(NAME_TAILS)}${num()}`;
  if (style === 1) return `${pick(NAME_FIRST)}_${pick(NAME_TAILS)}`;
  if (style === 2) return `${pick(NAME_FIRST)}${num()}`;
  if (style === 3) return `xX${pick(NAME_WORDS)}Xx`;
  if (style === 4) return `${pick(NAME_WORDS)}${pick(NAME_TAILS)}`;
  return `The${pick(NAME_WORDS)}${pick(['', 'TTV', 'YT', 'GG'])}`;
}

/** One fighter as the Colosseum sees it: permanent stats only (no gold levels). */
export interface PvpUnit {
  id: string;
  element: Element;
  atk: Decimal;
  hp: Decimal;
  def: Decimal;
  attacksPerSec: number;
  critRate: number;
  critDmg: number;
  melee: boolean;
}

/** One hit in a fight, for the replay. */
export interface PvpHit {
  t: number;
  side: 0 | 1;
  from: number;
  to: number;
  /** Damage as a share of the target's max HP. */
  share: number;
  kill: boolean;
}

export interface PvpResult {
  won: boolean;
  seconds: number;
  hits: PvpHit[];
  /** HP left per unit at the end, as a share of max HP: [attackers, defenders]. */
  left: [number[], number[]];
}

/**
 * Fight two teams with no randomness: crits count at their average, every unit hits the
 * frontmost living enemy (melee stand in front), elements and Defense work as in battle.
 * `bonus` is the attacker's extra damage (the win streak). Side 0 attacks, side 1 defends.
 */
export function simulatePvp(attackers: PvpUnit[], defenders: PvpUnit[], bonus = 0, step = 0.1): PvpResult {
  const sides = [fightOrder(attackers), fightOrder(defenders)];
  const maxHp = sides.flat().reduce((m, u) => Decimal.max(m, u.hp), new Decimal(1));
  // Scale every stat by the biggest HP: Defense works as hit²/(hit+DEF), so the fight plays out the same in plain numbers.
  const scale = (d: Decimal) => d.div(maxHp).toNumber();
  const units = sides.map((team, side) =>
    team.map((u) => ({
      u,
      hp: scale(u.hp),
      max: scale(u.hp),
      atk: scale(u.atk) * (1 + u.critRate * u.critDmg) * (side === 0 ? 1 + bonus : 1),
      def: scale(u.def),
      next: 1 / Math.max(0.05, u.attacksPerSec),
    })),
  );
  const hits: PvpHit[] = [];
  const alive = (side: number) => units[side].some((x) => x.hp > 0);
  let t = 0;
  while (t < PVP_TIME && alive(0) && alive(1)) {
    t = Math.round((t + step) * 1000) / 1000;
    for (const side of [0, 1] as const) {
      const foes = units[1 - side];
      units[side].forEach((me, from) => {
        if (me.hp <= 0) return;
        while (me.next <= t) {
          me.next += 1 / Math.max(0.05, me.u.attacksPerSec);
          const to = foes.findIndex((f) => f.hp > 0);
          if (to < 0) return;
          const foe = foes[to];
          const raw = me.atk * elementMultiplier(me.u.element, foe.u.element);
          const dmg = defended(new Decimal(raw), new Decimal(foe.def)).toNumber();
          foe.hp = Math.max(0, foe.hp - dmg);
          hits.push({ t, side, from, to, share: Math.min(1, dmg / foe.max), kill: foe.hp <= 0 });
        }
      });
    }
  }
  const share = (side: number) => units[side].reduce((s, x) => s + x.hp, 0) / units[side].reduce((s, x) => s + x.max, 0);
  const won = !alive(1) ? true : !alive(0) ? false : share(0) > share(1);
  return { won, seconds: t, hits, left: [units[0].map((x) => x.hp / x.max), units[1].map((x) => x.hp / x.max)] };
}

/** The order units stand in a fight (melee in front), as simulatePvp uses for hit indexes. */
export function fightOrder<T extends { melee: boolean }>(team: T[]): T[] {
  return [...team].sort((a, b) => Number(b.melee) - Number(a.melee));
}
