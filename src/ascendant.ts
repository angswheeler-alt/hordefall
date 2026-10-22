import type { HeroDef, Rarity, Element } from './data';

/**
 * Ascendant heroes (plan: Ascendant Heroes Plan, 2026-10-21): a hero that starts Common and ascends through
 * four permanent forms, Common, Rare, Epic and Legendary. Each form swaps in its own look, base stats and
 * skills on top of the hero's Common entry; stars, levels, Embers, pink stars and relics carry over untouched.
 *
 * The framework never names a character: heroes use codename ids (asc_dark, asc_fire...) and every name and
 * art key lives in the hero's data entry (src/heroes/ascendant.ts), so names and art can be swapped in one place.
 */

/** Form index (0 = Common) to the rarity the hero shows in that form. */
export const FORM_RARITIES: readonly Rarity[] = ['common', 'rare', 'epic', 'legendary'];
export const MAX_FORM = FORM_RARITIES.length - 1;

/**
 * Charge: every attack in a row adds a stack; at `stacks` the hero's next Signature fires empowered by `value`
 * of `boost` (0.5 = +50%). BattleScene runs it with chargeStep and chargeDamageMult below.
 */
export interface Charge {
  stacks: number;
  boost: 'damage' | 'pierce' | 'area' | 'attackSpeed' | 'bossDamage';
  value: number;
}

/** The hero fields a form may replace. */
type FormFields = Pick<
  HeroDef,
  'baseAtk' | 'baseHp' | 'baseDef' | 'range' | 'attackCooldown' | 'moveSpeed' | 'splash' | 'flying' | 'bio' | 'basic' | 'ultimate' | 'trait' | 'signature' | 'ult' | 'ultPlus' | 'sigPlus' | 'sp1' | 'sp2' | 'aura'
>;

/** One form: its own name and art, and whatever it changes. Anything left out stays as in the form before. */
export type AscendantForm = Partial<FormFields> & {
  formName: string;
  /** Art key in public/heroes (falls back to the form before when that art isn't there yet). */
  art?: string;
  charge?: Charge;
};

/** What one ascension needs (the step into form N), checked all at once before anything is spent. */
export interface AscensionStep {
  /** Evolutions the hero needs (0 = 1★, so 2 = 3★). */
  evolutions: number;
  /** Best Trial level cleared in the hero's own element. */
  trialTier: number;
  /** Lifetime best stage. */
  bestStage: number;
  /** One-time cost: Essence of the hero's element and Enhance Stones. */
  essence: number;
  stones: number;
}

export interface AscendantDef {
  /** The hero in its Common form: a normal hero entry. */
  base: HeroDef;
  /** Forms I to IV; forms[0] usually only names the Common form. */
  forms: [AscendantForm, AscendantForm, AscendantForm, AscendantForm];
  /** Steps into forms II, III and IV. */
  steps: [AscensionStep, AscensionStep, AscensionStep];
}

/** Which element each element's attacks beat (the Ascendant Chest sells the hero that counters the week's boss). */
export const COUNTERED_BY: Record<Element, Element> = { earth: 'fire', fire: 'water', water: 'earth', light: 'dark', dark: 'light' };

/**
 * The shared ascension steps: Rare at 3★, Epic at 5★, Legendary at 7★ (8★ is still their top star, past the
 * final form), each also needing a Trial level and a best stage. `finalStage` is the element boss the hero counters
 * (its Legendary challenge).
 */
export function standardSteps(finalStage: number): [AscensionStep, AscensionStep, AscensionStep] {
  return [
    { evolutions: 2, trialTier: 5, bestStage: 200, essence: 500, stones: 30 },
    { evolutions: 4, trialTier: 10, bestStage: 500, essence: 5000, stones: 100 },
    { evolutions: 6, trialTier: 15, bestStage: finalStage, essence: 50000, stones: 300 },
  ];
}

/** Clamp any saved value to a real form index. */
export function clampForm(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(MAX_FORM, Math.floor(v))) : 0;
}

/** The hero as it fights and shows in `form`: each form up to it laid over the Common entry, with that form's rarity. */
export function resolveForm(def: AscendantDef, form: number): HeroDef & { formName: string; art: string; charge?: Charge } {
  const f = clampForm(form);
  let hero: HeroDef = { ...def.base };
  let art = def.base.id;
  let charge: Charge | undefined;
  for (let i = 0; i <= f; i++) {
    const { formName: _name, art: formArt, charge: formCharge, ...fields } = def.forms[i];
    hero = { ...hero, ...fields };
    if (formArt) art = formArt;
    if (formCharge) charge = formCharge;
  }
  return { ...hero, rarity: FORM_RARITIES[f], formName: def.forms[f].formName, art, charge };
}

/**
 * The art key to draw a hero in `form`: that form's own art when `has` it, else the nearest form before it
 * that has art, else the hero's Common art.
 */
export function formArtKey(def: AscendantDef, form: number, has: (key: string) => boolean): string {
  for (let i = clampForm(form); i > 0; i--) {
    const art = def.forms[i].art;
    if (art && has(art)) return art;
  }
  return def.forms[0].art && has(def.forms[0].art) ? def.forms[0].art : def.base.id;
}

/** What still stands in the way of the next form, or null when the hero can ascend now. */
export type AscendBlocker = 'unknown' | 'max' | 'locked' | 'stars' | 'trial' | 'stage' | 'essence' | 'stones';

export interface AscendContext {
  form: number;
  recruited: boolean;
  evolutions: number;
  trialTier: number;
  bestStage: number;
  essence: number;
  stones: number;
}

export function ascendBlocker(def: AscendantDef | undefined, c: AscendContext): AscendBlocker | null {
  if (!def) return 'unknown';
  const form = clampForm(c.form);
  if (form >= MAX_FORM) return 'max';
  if (!c.recruited) return 'locked';
  const step = def.steps[form];
  if (c.evolutions < step.evolutions) return 'stars';
  if (c.trialTier < step.trialTier) return 'trial';
  if (c.bestStage < step.bestStage) return 'stage';
  if (c.essence < step.essence) return 'essence';
  if (c.stones < step.stones) return 'stones';
  return null;
}

/** The next form's requirements as the hero page lists them, each marked met or not; null at the last form. */
export function ascendNeeds(def: AscendantDef, c: AscendContext, essenceName: string): Array<{ text: string; met: boolean }> | null {
  const form = clampForm(c.form);
  if (form >= MAX_FORM) return null;
  const step = def.steps[form];
  const el = def.base.element;
  return [
    { text: `${step.evolutions + 1}★`, met: c.evolutions >= step.evolutions },
    { text: `${el[0].toUpperCase()}${el.slice(1)} Trial level ${step.trialTier} cleared`, met: c.trialTier >= step.trialTier },
    { text: `Stage ${step.bestStage.toLocaleString()} reached`, met: c.bestStage >= step.bestStage },
    { text: `${step.essence.toLocaleString()} ${essenceName}`, met: c.essence >= step.essence },
    { text: `${step.stones.toLocaleString()} Enhance Stones`, met: c.stones >= step.stones },
  ];
}

/** Charge in battle: how far a charged pierce reaches behind the target, a charged area hit's radius (px), and how long a charged haste lasts (s). */
export const CHARGE_LINE = 220;
export const CHARGE_AREA = 70;
export const CHARGE_HASTE_SECONDS = 4;

/** The Charge a hero fights with in its current form (set by resolveForm), if any. */
export function chargeOf(def: HeroDef): Charge | undefined {
  return (def as HeroDef & { charge?: Charge }).charge;
}

/** One attack's worth of Charge: the stacks after it, and whether this attack fires the charged Signature. */
export function chargeStep(stacks: number, c: Charge): { stacks: number; fired: boolean } {
  const next = stacks + 1;
  return next >= c.stacks ? { stacks: 0, fired: true } : { stacks: next, fired: false };
}

/** Damage multiplier of a charged attack on one target (bossDamage hits regular enemies for half the bonus). */
export function chargeDamageMult(c: Charge, isBoss: boolean): number {
  if (c.boost === 'attackSpeed') return 1;
  if (c.boost === 'bossDamage' && !isBoss) return 1 + c.value / 2;
  return 1 + c.value;
}

/** The Charge line on the hero page. */
export function chargeText(c: Charge): string {
  const pct = `${Math.round(c.value * 100)}%`;
  const what = {
    damage: `hits for +${pct} damage`,
    pierce: `cuts through every enemy in a line behind the target for +${pct} damage`,
    area: `hits every enemy around the target for +${pct} damage`,
    attackSpeed: `speeds up attacks by ${pct} for ${CHARGE_HASTE_SECONDS} seconds`,
    bossDamage: `hits bosses for +${pct} damage (other enemies +${Math.round(c.value * 50)}%)`,
  }[c.boost];
  const nth = c.stacks === 2 ? '2nd' : c.stacks === 3 ? '3rd' : `${c.stacks}th`;
  return `Charge: every ${nth} attack in a row ${what}.`;
}
