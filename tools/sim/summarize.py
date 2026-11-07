#!/usr/bin/env python3
"""Summarize sim JSON outputs: medians (and p10/p90 over seeds) per checkpoint.
   python3 tools/sim/summarize.py OUT_DIR > summary.json
"""
import json, sys, glob, os, statistics as st
from collections import defaultdict

CHECKS = ['active 0.5h', 'active 2h', 'day 1', 'day 3', 'day 7', 'day 14', 'day 30', 'day 60', 'day 90', 'day 180', 'day 365']
METRICS = ['day', 'activeH', 'best', 'rekindles', 'keeper', 'owned', 'teamSize', 'teamStarsAvg', 'teamStarsMax', 'pinkAvg', 'goldLvAvg', 'heroLvAvg', 'heroLvMax',
           'emberLvAvg', 'emberLvMax', 'weaponAvg', 'weaponMax', 'glyphsSocketed', 'relicsOwned', 'relicStarsOpen', 'relicLvAvg', 'relicSlots', 'relicAtk', 'setsComplete',
           'teamSlots', 'ultSlots', 'gems', 'stones', 'essenceLog', 'wild', 'motes', 'trialMax', 'legendaryMedals', 'trophies', 'guildBossTop', 'cpLog', 'fixedTeamCpLog', 'gold', 'embers', 'guildCoins']


def q(xs, p):
    xs = sorted(xs)
    if not xs: return None
    k = (len(xs) - 1) * p
    lo, hi = int(k), min(int(k) + 1, len(xs) - 1)
    return round(xs[lo] + (xs[hi] - xs[lo]) * (k - lo), 2)


def main(d):
    groups = defaultdict(list)
    for f in sorted(glob.glob(os.path.join(d, '*.json'))):
        try: r = json.load(open(f))
        except Exception: continue
        if 'snaps' not in r: continue
        c = r['config']
        key = f"{r.get('variant','baseline')}|{c['policy']['name']}|{c['policy']['strategy']}|{c['days']}"
        groups[key].append(r)
    out = {}
    for key, runs in groups.items():
        g = {'seeds': len(runs), 'checks': {}, 'firsts': {}, 'ledger': {}}
        for tag in CHECKS:
            snaps = [next((s for s in r['snaps'] if s['tag'] == tag), None) for r in runs]
            snaps = [s for s in snaps if s]
            if not snaps: continue
            row = {}
            for m in METRICS:
                vals = [s[m] for s in snaps if isinstance(s.get(m), (int, float))]
                if vals: row[m] = {'med': q(vals, .5), 'p10': q(vals, .1), 'p90': q(vals, .9)}
            row['team'] = snaps[0]['team']
            row['stars'] = snaps[0]['stars']
            row['rarity'] = snaps[0]['rarity']
            row['modes'] = snaps[0]['modes']
            row['trialBest'] = snaps[0]['trialBest']
            led = snaps[0]['ledger']
            row['ledger'] = led
            g['checks'][tag] = row
        keys = set(k for r in runs for k in r['firsts'])
        for k in sorted(keys):
            vals = [r['firsts'][k] for r in runs if k in r['firsts']]
            g['firsts'][k] = {'med': q(vals, .5), 'p10': q(vals, .1), 'p90': q(vals, .9), 'reached': f"{len(vals)}/{len(runs)}"}
        g['runsFirst30'] = runs[0]['runs'][:30]
        g['rekindleCount'] = len(runs[0]['runs'])
        out[key] = g
    json.dump(out, sys.stdout, indent=1)


if __name__ == '__main__':
    main(sys.argv[1])
