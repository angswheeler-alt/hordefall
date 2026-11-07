#!/usr/bin/env python3
"""Build the report page: slim .sim/report-data.json and inject it into tools/sim/report-template.html.
   python3 tools/sim/report_data.py && python3 tools/sim/build_report.py .sim/report.html
"""
import json, os, sys

HERE = os.path.dirname(__file__)
ROOT = os.path.join(HERE, '..', '..', '.sim')
CHECKS = ['active 0.5h', 'active 2h', 'day 1', 'day 3', 'day 7', 'day 14', 'day 30', 'day 60', 'day 90', 'day 180', 'day 365']
ROW = ['day', 'best', 'lo', 'hi', 'rekindles', 'teamSize', 'teamStarsAvg', 'teamStarsMax', 'pinkAvg', 'heroLvAvg', 'emberLvAvg', 'weaponAvg', 'glyphsSocketed',
       'relicsOwned', 'relicStarsOpen', 'relicLvAvg', 'relicSlots', 'teamSlots', 'gems', 'stones', 'essenceLog', 'trialMax', 'legendaryMedals', 'trophies',
       'guildBossTop', 'owned', 'warsteel', 'motes']


def slim_group(g, curve_step=1):
    out = {'seeds': g['seeds'], 'checks': {}, 'firsts': {k: v['med'] for k, v in g['firsts'].items()}, 'curve': g['curve'][::curve_step], 'runs': g['runs']}
    for t, c in g['checks'].items():
        r = {k: c.get(k) for k in ROW}
        r['team'] = c.get('team')
        r['rarity'] = c.get('rarity')
        r['modes'] = c.get('modes')
        r['ascendant'] = c.get('ascendant')
        r['forge'] = c.get('forge')
        led = c.get('ledger') or {}
        r['gemsIn'] = led.get('gemsIn')
        r['gemsOut'] = led.get('gemsOut')
        r['crestsIn'] = led.get('crestsIn')
        r['stonesIn'] = led.get('stonesIn')
        r['trialWins'] = led.get('trialWins')
        r['rushPoints'] = led.get('rushPoints')
        r['pvp'] = led.get('pvp')
        out['checks'][t] = r
    return out


def main(dest):
    d = json.load(open(os.path.join(ROOT, 'report-data.json')))
    data = {
        'profiles': {k: slim_group(v) for k, v in d['profiles'].items()},
        'strategies': {k: slim_group(v) for k, v in d['strategies'].items()},
        'experiments': {k: slim_group(v) for k, v in d['experiments'].items()},
        'revised': {k: slim_group(v) for k, v in d['revised'].items()},
        'baseB1': slim_group(d['baseB1']) if d.get('baseB1') else None,
        'mc': d.get('mc', {}),
        'econ': {k: d.get('econ', {}).get(k) for k in ['gemsPerCrest', 'gemSinks', 'gemIncome', 'stars', 'heroChest', 'trials']},
    }
    data['variantText'] = {}
    vt = os.path.join(ROOT, 'variant-text.json')
    if os.path.exists(vt):
        data['variantText'] = json.load(open(vt))
    tpl = open(os.path.join(HERE, 'report-template.html')).read()
    html = tpl.replace('/*__DATA__*/null', json.dumps(data, separators=(',', ':')))
    open(dest, 'w').write(html)
    print('wrote', dest, len(html) // 1024, 'KB')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'report.html'))
