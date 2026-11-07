// Run one or more simulations and write JSON + CSV.
//   npx vite-node tools/sim/run.ts -- --policy B --days 365 --seeds 1 --out tools/sim/out/base
// Options: --policy A|B|C|D|E1|E2|E3  --days N  --seeds N (Monte Carlo: seeds 1..N)  --seed K (single seed)
//          --strategy balanced|concentrated|element|rarity|collection  --tag name  --out dir  --progress N
// Economy variants: set SIM_SRC to a patched copy of src/ (variants.ts makes them).
import { mkdirSync, writeFileSync } from 'node:fs';
import { runSim } from './engine';

const args = process.argv.slice(2).filter((a) => a !== '--');
const opt = (k: string, d?: string) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const policy = opt('policy', 'B')!;
const days = Number(opt('days', '30'));
const seeds = opt('seed') ? [Number(opt('seed'))] : Array.from({ length: Number(opt('seeds', '1')) }, (_, i) => i + 1);
const strategy = opt('strategy') as any;
const out = opt('out', 'tools/sim/out')!;
const tag = opt('tag', `${policy}${strategy ? '-' + strategy : ''}-${days}d`)!;
mkdirSync(out, { recursive: true });

const flat = (o: any, p = '', r: Record<string, any> = {}) => {
  for (const [k, v] of Object.entries(o)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) flat(v, p + k + '.', r);
    else r[p + k] = Array.isArray(v) ? v.join('|') : v;
  }
  return r;
};

for (const seed of seeds) {
  const t0 = performance.now();
  const res = await runSim({ policy, days, seed, strategy, label: `${tag}#${seed}`, progressEvery: Number(opt('progress', '10')) });
  const file = `${out}/${tag}-s${seed}`;
  writeFileSync(file + '.json', JSON.stringify({ ...res, variant: process.env.SIM_VARIANT ?? 'baseline', seconds: Math.round((performance.now() - t0) / 1000) }));
  const rows = res.daily.map((r: any) => flat({ ...r, ledger: undefined, team: r.team.join(' '), ascendant: r.ascendant.join(' ') }));
  const cols = [...new Set(rows.flatMap((r: any) => Object.keys(r)))];
  writeFileSync(file + '.csv', [cols.join(','), ...rows.map((r: any) => cols.map((c) => JSON.stringify(r[c] ?? '')).join(','))].join('\n'));
  console.error(`done ${file} in ${Math.round((performance.now() - t0) / 1000)} s`);
}
