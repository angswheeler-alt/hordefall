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
 * of `boost` (0.5 = +50%). Data only for now; battle runs it in a later step.
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
 * The shared ascension steps (test values until the balance pass): Rare at 3★, Epic at 5★, Legendary at 8★,
 * each also needing a Trial level and a best stage. `finalStage` is the element boss the hero counters
 * (its Legendary challenge).
 */
export function standardSteps(finalStage: number): [AscensionStep, AscensionStep, AscensionStep] {
  return [
    { evolutions: 2, trialTier: 5, bestStage: 200, essence: 500, stones: 30 },
    { evolutions: 4, trialTier: 10, bestStage: 500, essence: 5000, stones: 100 },
    { evolutions: 7, trialTier: 15, bestStage: finalStage, essence: 50000, stones: 300 },
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
