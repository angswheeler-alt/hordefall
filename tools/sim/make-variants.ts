// Make the patched src/ copies for the economy experiments:  npx vite-node tools/sim/make-variants.ts -- [names...]
import { VARIANTS, makeVariant } from './variants';
const names = process.argv.slice(2).filter((a) => a !== '--' && !a.endsWith('.ts'));
for (const n of names.length ? names : Object.keys(VARIANTS)) console.log(n, makeVariant(n));
