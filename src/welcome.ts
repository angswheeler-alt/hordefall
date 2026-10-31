import { HEROES, TICKET_CRATE, HERO_VOUCHER, TRIAL_EVENT_MEDAL_MULT, TRIAL_ROTATION, type Element } from './data';
import { dayKey } from './rewards';
import { utcWeekStart, guildBossElement } from './formulas';
import { weekIndex, type GameState } from './state';

// The "While you were away" pop-up (Samuel, 2026-10-31): when the game opens after time away it lists
// what happened meanwhile: Colosseum rewards and defense fights, events that started or ended, and
// the offline progress. Pure functions here; the UI draws the sections.

export interface WelcomeSection {
  /** Short heading, e.g. "Colosseum". */
  title: string;
  /** One line each, plain text with <b> for numbers (already safe HTML). */
  lines: string[];
}

const ELEMENT_LABEL: Record<Element, string> = { water: 'Water', fire: 'Fire', earth: 'Earth', light: 'Light', dark: 'Dark' };
const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Words for a list: "Fire", "Fire and Water", "Fire, Water and Earth". */
function listWords(items: string[]): string {
  return items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/**
 * Events that started, ended or changed between `from` (when the game last ran) and `to` (now):
 * double-crest Trial weekends, the Hero Shop's weekly deal, the Guild Boss week and today's open Trials.
 * Empty when nothing changed.
 */
export function eventNews(s: GameState, from: number, to: number): string[] {
  if (!(to > from)) return [];
  const lines: string[] = [];
  const trials = s.trialsUnlocked();
  const newDay = dayKey(from) !== dayKey(to);

  if (trials) {
    const onNow = s.trialEventOn(to);
    const onThen = s.trialEventOn(from);
    if (onNow && !onThen) {
      const ev = s.nextTrialEvent(to);
      lines.push(`<b>Double Trial crests</b> weekend has started: every Trial win pays x${TRIAL_EVENT_MEDAL_MULT} crests until ${WEEKDAY[new Date(ev.end).getDay()]}.`);
    } else if (!onNow) {
      // The event that was on when we left, or the first one after that.
      const ev = s.nextTrialEvent(from);
      if (ev.end > from && ev.end <= to) {
        const next = s.nextTrialEvent(to);
        const when = new Date(next.start).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
        lines.push(`${onThen ? 'The double Trial crests weekend has ended.' : 'You missed a double Trial crests weekend.'} Next one starts ${when}.`);
      }
    }
  }

  if (weekIndex(from) !== weekIndex(to)) {
    const deal = s.dealState(to);
    lines.push(
      deal.kind === 'crate'
        ? `New Hero Shop deal this week: <b>Ticket Crate</b> (${TICKET_CRATE.tickets} Trial tickets for ${deal.gems} Gems).`
        : `New Hero Shop deal this week: <b>Hero Voucher</b> (up to ${HERO_VOUCHER.medals.common} crests for a hero you pick, ${deal.gems} Gems).`,
    );
  }

  const bossWeek = utcWeekStart(to);
  if (utcWeekStart(from) !== bossWeek) {
    const chest = s.ascendantChestState(to);
    const hero = chest ? HEROES.find((h) => h.id === chest.hero.id)?.name ?? chest.hero.id : null;
    lines.push(`New Guild Boss week: a <b>${ELEMENT_LABEL[guildBossElement(bossWeek)]}</b> boss.${hero ? ` This week's Ascendant Chest has <b>${hero}</b>.` : ''}`);
  }

  if (trials && newDay) {
    const open = s.openTrials(to);
    lines.push(open.length === TRIAL_ROTATION.length ? 'All five Trials are open today.' : `Trials open today: ${listWords(open.map((e) => ELEMENT_LABEL[e]))}.`);
  }
  if (newDay) lines.push('A new day: daily challenges and the login reward are ready.');
  return lines;
}

/** Colosseum fights against this player's defense team since `from` (newest first in `log`). */
export function defenseNews(log: Array<{ attacker: string; attackerWon: boolean; at: string }>, from: number): string[] {
  const fights = log.filter((f) => {
    const t = Date.parse(f.at);
    return Number.isFinite(t) && t > from;
  });
  if (!fights.length) return [];
  const held = fights.filter((f) => !f.attackerWon).length;
  const lost = fights.length - held;
  const lines = [`Your defense team was attacked <b>${fights.length}</b> time${fights.length === 1 ? '' : 's'}: <b>${held}</b> held, <b>${lost}</b> lost. Defense losses cost nothing.`];
  for (const f of fights.slice(0, 5)) lines.push(`${f.attackerWon ? 'Lost to' : 'Beat'} ${escapeHtml(f.attacker)}`);
  if (fights.length > 5) lines.push(`…and ${fights.length - 5} more in the Colosseum log.`);
  return lines;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Pays any Colosseum daily/weekly rewards now due and returns every reward line the player hasn't seen yet. */
export function colosseumNews(s: GameState, now: number): string[] {
  s.pvpTick(now);
  return [...s.pvp.notes];
}
