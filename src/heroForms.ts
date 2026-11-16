/**
 * Heroes whose look changes in battle or as they grow (Samuel 2026-11-15): the Stars tab shows every form and the
 * Collection marks these heroes. Pure data: `has` says which sprites the game has loaded.
 */
import { FORM_RARITIES, formArtKey } from './ascendant';
import { ascendantDef } from './heroes/ascendant';
import { SURGE_FORMS } from './kits';
import { HEROES } from './data';

export interface HeroForm {
  name: string;
  /** Sprite key for this form. */
  art: string;
  /** How the hero reaches it. */
  how: string;
}

const ROMAN = ['I', 'II', 'III', 'IV'];
const SURGE_NAMES = ['Surge I', 'Surge II', 'Surge III', 'Overdrive'];

/** The hero's forms, base first; null for heroes with a single look. */
export function heroForms(id: string, has: (art: string) => boolean): HeroForm[] | null {
  const asc = ascendantDef(id);
  if (asc) {
    return asc.forms.map((f, i) => ({
      name: f.formName,
      art: formArtKey(asc, i, has),
      how: i === 0 ? `Form I, ${FORM_RARITIES[0]}: starting form` : `Form ${ROMAN[i]}, ${FORM_RARITIES[i]}: ascend at ${asc.steps[i - 1].evolutions + 1}★`,
    }));
  }
  const def = HEROES.find((h) => h.id === id);
  if (!def) return null;
  const sig = def.signature as { kind: string; every?: number; formAt?: number; formSeconds?: number } | undefined;
  if (sig?.kind === 'surge' && sig.every) {
    const forms: HeroForm[] = [{ name: def.name, art: id, how: 'His normal look' }];
    for (let stage = 1; stage <= 4; stage++) {
      const art = SURGE_FORMS[stage]?.find(has);
      if (art) forms.push({ name: SURGE_NAMES[stage - 1], art, how: `Power Surge stage ${stage}: after ${sig.every * stage} s alive in a fight` });
    }
    return forms.length > 1 ? forms : null;
  }
  if (sig?.kind === 'grit' && has(`${id}_dark`)) {
    return [
      { name: def.name, art: id, how: 'His normal look' },
      { name: 'Boiling Over', art: `${id}_dark`, how: `After ${sig.formAt} hits in a row or his Ultimate, for ${sig.formSeconds} s` },
    ];
  }
  return null;
}
