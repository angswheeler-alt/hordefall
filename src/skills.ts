import { HEROES, AURA_EVOLUTIONS, MASTERY_EVOLUTIONS, SUPPORT_RALLY, TYPE_MASTERY, type Effect, type EffectKind } from './data';

/** A star skill that is switched on, with the hero who owns it. */
export interface ActiveEffect {
  owner: string;
  effect: Effect;
}

/**
 * Every star skill currently in force, for heroes in the lineup: SP1 at 2★ and SP2 at 3★ (1 and 2
 * evolutions; `stars` counts evolutions, so 0 = 1★), the Aura at 4★ (AURA_EVOLUTIONS) and, at 7★, the
 * hero's Type Mastery when it is a plain effect (TYPE_MASTERY). Every Support also gives the team
 * SUPPORT_RALLY from 1★; Rallies add up (+15% each) as one effect instead of multiplying.
 * `hasStar` is GameState.hasStar (recruited, in the lineup, and evolved far enough).
 */
export function activeEffects(hasStar: (id: string, star: number) => boolean): ActiveEffect[] {
  const out: ActiveEffect[] = [];
  const rallies = HEROES.filter((h) => h.type === 'Support' && hasStar(h.id, 0));
  if (rallies.length) {
    out.push({ owner: rallies[0].id, effect: { ...SUPPORT_RALLY, value: 1 + (SUPPORT_RALLY.value - 1) * rallies.length } });
  }
  for (const h of HEROES) {
    if (hasStar(h.id, 1) && h.sp1.effect) out.push({ owner: h.id, effect: h.sp1.effect });
    if (hasStar(h.id, 2) && h.sp2.effect) out.push({ owner: h.id, effect: h.sp2.effect });
    if (hasStar(h.id, AURA_EVOLUTIONS) && h.aura.effect) out.push({ owner: h.id, effect: h.aura.effect });
    const mastery = TYPE_MASTERY[h.type].effect;
    if (mastery && hasStar(h.id, MASTERY_EVOLUTIONS)) out.push({ owner: h.id, effect: mastery });
  }
  return out;
}

/**
 * Effects of one kind that reach `heroId`: team-wide ones, plus the hero's own. null = team-wide only.
 * A team effect with an element reaches only heroes of that element (and never the null query).
 */
function reaching(effects: ActiveEffect[], kind: EffectKind, heroId: string | null): Effect[] {
  const element = heroId === null ? null : HEROES.find((h) => h.id === heroId)?.element;
  return effects
    .filter((a) => a.effect.kind === kind && (a.owner === heroId || (a.effect.team && (!a.effect.element || a.effect.element === element))))
    .map((a) => a.effect);
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

/** The hero's own every-Nth proc of this kind (slam, ward, snowball, assassinate), if any. */
export function procEffect(effects: ActiveEffect[], kind: 'slam' | 'ward' | 'snowball' | 'assassinate' | 'charm' | 'blind', heroId: string): Effect | undefined {
  return reaching(effects, kind, heroId)[0];
}

/** Whether an every-Nth proc fires on this attack count. */
export function procs(effect: Effect | undefined, attacks: number): boolean {
  return !!(effect && effect.every && attacks % effect.every === 0);
}
