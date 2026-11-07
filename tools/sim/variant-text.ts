// Writes .sim/variant-text.json (variant name -> description) for the report page.
import { writeFileSync } from 'node:fs';
import { VARIANTS } from './variants';
writeFileSync(new URL('../../.sim/variant-text.json', import.meta.url).pathname, JSON.stringify(Object.fromEntries(Object.entries(VARIANTS).map(([k, v]) => [k, v.text])), null, 1));
