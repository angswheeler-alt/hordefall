import { HEROES, AURA_EVOLUTIONS, MASTERY_EVOLUTIONS, TYPE_MASTERY, type Effect, type EffectKind } from './data';

/** A star skill that is switched on, with the hero who owns it. */
export interface ActiveEffect {
  owner: string;
  effect: Effect;
}

/**
 * Every star skill currently in force, for heroes in the lineup: SP1 at 2★ and SP2 at 3★ (1 and 2
 * evolutions; `stars` counts evolutions, so 0 = 1★), the Aura at 4★ (AURA_EVOLUTIONS) and, at 7★, the
 * hero's Type Mastery when it is a plain effect (TYPE_MASTERY).
 * `hasStar` is GameState.hasStar (recruited, in the lineup, and evolved far enough).
 */
export function activeEffects(hasStar: (id: string, star: number) => boolean): ActiveEffect[] {
  const out: ActiveEffect[] = [];
  for (const h of HEROES) {
    if (hasStar(h.id, 1) && h.sp1.effect) out.push({ owner: h.id, effect: h.sp1.effect });
    if (hasStar(h.id, 2) && h.sp2.effect) out.push({ owner: h.id, effect: h.sp2.effect });
    if (hasStar(h.id, AURA_EVOLUTIONS) && h.aura.effect) out.push({ owner: h.id, effect: h.aura.effect });
    const mastery = TYPE_MASTERY[h.type].effect;
    if (mastery && hasStar(h.id, MASTERY_EVOLUTIONS)) out.push({ owner: h.id, effect: mastery });
  }
  return out;
}

/** Effects of one kind that reach `heroId`: team-wide ones, plus the hero's own. null = team-wide only. */
function reaching(effects: ActiveEffect[], kind: EffectKind, heroId: string | null): Effect[] {
  return effects.filter((a) => a.effect.kind === kind && (a.effect.team || (heroId !== null && a.owner === heroId))).map((a) => a.effect);
}

/** Additive total, for chances and fractions (crit, dodge, reflect, regen...). */
export function sumEffect(effects: ActiveEffect[], kind: EffectKind, heroId: string | null): number {
  return reaching(effects, kind, heroId).reduce((t, e) => t + e.value, 0);
}

/** Multiplicative total, for multipliers (ATK, damage taken, cooldown...). 1 when nothing applies. */
export function mulEffect(effects: ActiveEffect[], kind: EffectKind, heroId: string | null): number {
  return reaching(effects, kind, heroId).reduce((t, e) => t * e.value, 1);
}

/** The hero's own "every Nth attack" effect, if any. */
export function everyNth(effects: ActiveEffect[], heroId: string): Effect | undefined {
  return reaching(effects, 'everyNth', heroId)[0];
}
