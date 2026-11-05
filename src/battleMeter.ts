import Decimal from 'break_infinity.js';

// The battle meter under the Colosseum, Rush, Expedition and Trial lanes: damage dealt, taken and
// healed by each fighter. Samuel (2026-11-05): in fights against other players the meter also
// lists every enemy hero on its own line, not only the enemy team's totals.

/** One line of the battle meter. */
export interface PvpMeterRow {
  id: string;
  dealt: Decimal;
  taken: Decimal;
  healed: Decimal;
}

export type MeterKind = 'dealt' | 'taken' | 'healed';

export const meterRow = (id: string): PvpMeterRow => ({ id, dealt: new Decimal(0), taken: new Decimal(0), healed: new Decimal(0) });

/** The meter of one fight: the player's heroes, the foes' totals, and (PvP only) each foe hero. */
export interface FightMeter {
  meter: Map<string, PvpMeterRow>;
  foeMeter: PvpMeterRow;
  /** Each enemy hero (by hero id); only fights against other players have these. */
  foeRows?: Map<string, PvpMeterRow>;
}

/** Who did (or took) a hit, as the meter sees it. */
export interface MeterUnit {
  side: 'hero' | 'enemy';
  def?: { id: string } | null;
}

/** Count damage or healing: a hero adds to their own line; a foe adds to the foes' totals and to their own line. */
export function addToMeter(m: FightMeter, unit: MeterUnit, kind: MeterKind, amount: Decimal) {
  if (amount.lte(0)) return;
  if (unit.side === 'hero') {
    const row = unit.def ? m.meter.get(unit.def.id) : undefined;
    if (row) row[kind] = row[kind].plus(amount);
    return;
  }
  m.foeMeter[kind] = m.foeMeter[kind].plus(amount);
  const own = unit.def ? m.foeRows?.get(unit.def.id) : undefined;
  if (own) own[kind] = own[kind].plus(amount);
}

/** Largest value of each kind over all the rows, so both teams' bars share one scale. */
export function meterTops(rows: PvpMeterRow[]): Record<MeterKind, Decimal> {
  const top = (k: MeterKind) => rows.reduce((x, r) => Decimal.max(x, r[k]), new Decimal(0));
  return { dealt: top('dealt'), taken: top('taken'), healed: top('healed') };
}
