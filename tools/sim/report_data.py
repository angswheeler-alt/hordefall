#!/usr/bin/env python3
"""Collect simulator outputs into one JSON for the report page.
   python3 tools/sim/report_data.py > .sim/report-data.json
Reads .sim/base (profiles + strategies), .sim/exp (variants), .sim/rev (revised economy), .sim/mc-*.json, .sim/econ-db.json.
"""
import json, glob, os, statistics as st

ROOT = os.path.join(os.path.dirname(__file__), '..', '..', '.sim')
CHECKS = ['active 0.5h', 'active 2h', 'day 1', 'day 3', 'day 7', 'day 14', 'day 30', 'day 60', 'day 90', 'day 180', 'day 365']
KEYS = ['day', 'best', 'rekindles', 'teamSize', 'teamStarsAvg', 'teamStarsMax', 'pinkAvg', 'heroLvAvg', 'emberLvAvg', 'weaponAvg', 'glyphsSocketed',
        'relicsOwned', 'relicStarsOpen', 'relicLvAvg', 'relicSlots', 'teamSlots', 'gems', 'stones', 'essenceLog', 'motes', 'trialMax', 'legendaryMedals',
        'trophies', 'guildBossTop', 'owned', 'guildCoins', 'warsteel', 'cpLog']


def load(d):
    out = {}
    for f in sorted(glob.glob(os.path.join(ROOT, d, '*.json'))):
        try:
            r = json.load(open(f))
        except Exception:
            continue
        if 'snaps' in r:
            out[os.path.basename(f)[:-5]] = r
    return out


def med(xs):
    xs = [x for x in xs if isinstance(x, (int, float))]
    return round(st.median(xs), 2) if xs else None


def group(runs, prefix):
    rs = [r for k, r in runs.items() if k.startswith(prefix + '-s')]
    if not rs:
        return None
    g = {'seeds': len(rs), 'checks': {}, 'firsts': {}, 'curve': [], 'ledger365': None}
    for tag in CHECKS:
        snaps = [next((s for s in r['snaps'] if s['tag'] == tag), None) for r in rs]
        snaps = [s for s in snaps if s]
        if not snaps:
            continue
        row = {k: med([s.get(k) for s in snaps]) for k in KEYS}
        row['lo'] = min(s['best'] for s in snaps)
        row['hi'] = max(s['best'] for s in snaps)
        row['forge'] = snaps[0].get('forge')
        row['team'] = snaps[0].get('team')
        row['stars'] = snaps[0].get('stars')
        row['rarity'] = snaps[0].get('rarity')
        row['modes'] = snaps[0].get('modes')
        row['ascendant'] = snaps[0].get('ascendant')
        row['ledger'] = snaps[0].get('ledger')
        g['checks'][tag] = row
    keys = sorted(set(k for r in rs for k in r['firsts']))
    for k in keys:
        vals = [r['firsts'][k] for r in rs if k in r['firsts']]
        g['firsts'][k] = {'med': med(vals), 'reached': len(vals), 'of': len(rs)}
    # median best stage by day (every day) for the chart
    days = max(len(r['daily']) for r in rs)
    for i in range(days):
        vals = [r['daily'][i]['best'] for r in rs if i < len(r['daily'])]
        g['curve'].append(med(vals))
    g['runs'] = len(rs[0]['runs'])
    g['firstRuns'] = rs[0]['runs'][:12]
    return g


def main():
    base = load('base')
    out = {'profiles': {}, 'strategies': {}, 'experiments': {}, 'revised': {}, 'mc': {}}
    for p in ['A', 'B', 'C', 'D', 'E1', 'E2', 'E3']:
        g = group(base, f'baseline-{p}-365d')
        if g:
            out['profiles'][p] = g
    b1 = {k: v for k, v in base.items() if k == 'baseline-B-365d-s1'}
    if b1:
        out['baseB1'] = group(b1, 'baseline-B-365d')
    for s in ['concentrated', 'element', 'rarity', 'collection']:
        g = group(base, f'baseline-B-{s}-180d')
        if g:
            out['strategies'][s] = g
    exp = load('exp')
    for k in exp:
        name = k.rsplit('-s', 1)[0]
        g = group(exp, name)
        if g:
            out['experiments'][name] = g
    rev = load('rev')
    for k in rev:
        name = k.rsplit('-s', 1)[0]
        g = group(rev, name)
        if g:
            out['revised'][name] = g
    for f in glob.glob(os.path.join(ROOT, 'mc-*.json')):
        out['mc'][os.path.basename(f)[3:-5]] = json.load(open(f))
    try:
        out['econ'] = json.load(open(os.path.join(ROOT, 'econ-db.json')))
    except Exception:
        pass
    json.dump(out, open(os.path.join(ROOT, 'report-data.json'), 'w'))
    print('profiles', list(out['profiles']), 'strategies', list(out['strategies']), 'experiments', len(out['experiments']), 'revised', list(out['revised']))


if __name__ == '__main__':
    main()
