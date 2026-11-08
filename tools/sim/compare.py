#!/usr/bin/env python3
"""Compare a candidate economy against a baseline, metric by metric, with regression flags.

  python3 tools/sim/compare.py --base DIR --base-variant recheck --cand DIR2 --cand-variant emberMid \
      [--profiles A,B,C] [--days 365] [--thresholds tools/sim/thresholds.json] [--out report.md]

Runs are the JSON files written by tools/sim/run.ts (<variant>-<profile>-<days>d-s<seed>.json). Seeds are
paired: only seeds present for both sides are compared, so the same random luck sits on both sides.
For each metric it prints the baseline and candidate median, the absolute and % change, the candidate's
worst case, and a status from the per-metric thresholds: PASS (inside warn), WARN, FAIL (past fail).
Integrity checks (any mismatch is a FAIL): one-time Stage Milestone Gems and Stones in each run's ledger
must equal exactly what milestoneReward() pays for the milestones reached (mirrors src/rewards.ts).
"""
import argparse, glob, json, math, os, re, statistics as st

def load(dirs, variant, profile, days):
    out = {}
    for d in dirs:
        for f in glob.glob(os.path.join(d, f'{variant}-{profile}-{days}d-s*.json')):
            seed = int(re.search(r'-s(\d+)\.json$', f).group(1))
            out[seed] = json.load(open(f))
    return out

def day_row(run, day):
    rows = run['daily']
    best = None
    for r in rows:
        if r['day'] <= day: best = r
    return best

def stalls(run, until):
    n = run_len = longest = 0; prev = None
    for r in run['daily']:
        if r['day'] > until: break
        if prev is not None and r['best'] <= prev: n += 1; run_len += 1; longest = max(longest, run_len)
        else: run_len = 0
        prev = r['best']
    return n, longest

def ledger(run, until):
    return (day_row(run, until) or {}).get('ledger') or {}

# What the Stage Milestones pay up to milestone stage m (src/rewards.ts milestoneReward, MILESTONE_STEP 50).
def milestone_totals(m):
    gems = stones = 0
    for s in range(50, m + 1, 50):
        if s % 500 == 0: gems += 100; stones += 5
        elif s % 100 == 0: gems += 20; stones += 1
        else: stones += 1
    return gems, stones

def integrity(run, until):
    """None when the milestone ledger matches some number of claimed milestones exactly, else a message."""
    lg = ledger(run, until)
    g = (lg.get('gemsIn') or {}).get('milestones', 0); s = (lg.get('stonesIn') or {}).get('milestones', 0)
    best = (day_row(run, until) or {}).get('best', 0)
    for m in range(0, best + 51, 50):
        if milestone_totals(m) == (g, s): return None
    return f'milestone Gems {g} / Stones {s} match no milestone count up to stage {best}'

def metrics(run, days):
    m = {}
    for d in (30, 90, 180, 365, 730):
        if d <= days and day_row(run, d): m[f'best_d{d}'] = day_row(run, d)['best']
    spans = [(1, 30), (30, 90), (90, 180), (180, 365), (365, 730)]
    for a, b in spans:
        if b <= days and day_row(run, a) and day_row(run, b):
            m[f'pace_{a}_{b}'] = (day_row(run, b)['best'] - day_row(run, a)['best']) / (b - a)
    n, longest = stalls(run, days)
    m['stalled_days'] = n; m['longest_stall'] = longest
    end = day_row(run, days); lg = end.get('ledger') or {}
    m['gems_earned'] = sum((lg.get('gemsIn') or {}).values())
    m['essence_earned_log'] = math.log10(max(1, lg.get('essenceIn') or 1))
    m['trial_crests'] = (lg.get('crestsIn') or {}).get('trials', 0)
    m['stones_earned'] = sum((lg.get('stonesIn') or {}).values())
    m['trial_max'] = end.get('trialMax') or 0
    m['team_stars'] = end.get('teamStarsAvg') or 0
    m['relic_multiplier'] = end.get('relicAtk') or 0
    m['competitive_power_log'] = end.get('fixedTeamCpLog') or 0
    m['keeper_level'] = end.get('keeper') or 0
    a = day_row(run, min(90, days)); 
    if a and end['rekindles'] > a['rekindles']:
        m['ember_levels_per_rekindle'] = (end['emberLvAvg'] - a['emberLvAvg']) / (end['rekindles'] - a['rekindles'])
    return m

LOWER_IS_BETTER = {'stalled_days', 'longest_stall'}
LABELS = {
    'competitive_power_log': 'Simulated competitive power (log10)', 'essence_earned_log': 'Essence earned (log10)',
    'relic_multiplier': 'Relic ATK multiplier', 'trial_crests': 'Trial crests earned', 'longest_stall': 'Longest stall (days)',
    'stalled_days': 'Total stalled days', 'gems_earned': 'Gems earned', 'stones_earned': 'Stones earned',
    'trial_max': 'Highest Trial level', 'team_stars': 'Team stars (avg)', 'keeper_level': 'Keeper level',
    'ember_levels_per_rekindle': 'Ember levels per Rekindle (day 90 on)',
}
def label(k):
    if k in LABELS: return LABELS[k]
    if k.startswith('best_d'): return f'Best stage day {k[6:]}'
    if k.startswith('pace_'): a, b = k[5:].split('_'); return f'Stages/day, days {a}-{b}'
    return k

def status(k, pct, th):
    t = th.get(k)
    if t is None or pct is None: return 'PASS'
    if t['dir'] == 'up' and pct < 0: return 'PASS'
    if t['dir'] == 'down' and pct > 0: return 'PASS'
    a = abs(pct)
    return 'FAIL' if a > t['fail'] else 'WARN' if a > t['warn'] else 'PASS'

def fmt(x):
    if x is None: return '—'
    if isinstance(x, float) and abs(x) < 100: return f'{x:,.2f}'
    return f'{x:,.0f}'

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--base', required=True); ap.add_argument('--base-variant', required=True)
    ap.add_argument('--cand', required=True); ap.add_argument('--cand-variant', required=True)
    ap.add_argument('--profiles', default='A,B,C,D,E1,E2,E3'); ap.add_argument('--days', type=int, default=365)
    ap.add_argument('--thresholds', default=os.path.join(os.path.dirname(__file__), 'thresholds.json'))
    ap.add_argument('--out')
    a = ap.parse_args()
    th = {k: v for k, v in json.load(open(a.thresholds)).items() if not k.startswith('_')}
    lines = [f'# {a.cand_variant} vs {a.base_variant} ({a.days} days)', '']
    worst_all = 'PASS'
    for p in a.profiles.split(','):
        B = load(a.base.split(','), a.base_variant, p, a.days); C = load(a.cand.split(','), a.cand_variant, p, a.days)
        seeds = sorted(set(B) & set(C))
        if not seeds: continue
        lines += [f'## Profile {p} (paired seeds {", ".join(map(str, seeds))})', '',
                  '| Metric | Baseline | New run | Absolute Δ | % Δ | New worst case | Status |', '|---|---|---|---|---|---|---|']
        mb = [metrics(B[s], a.days) for s in seeds]; mc = [metrics(C[s], a.days) for s in seeds]
        for k in mb[0]:
            xb = [m[k] for m in mb if k in m]; xc = [m[k] for m in mc if k in m]
            if not xb or not xc: continue
            b, c = st.median(xb), st.median(xc)
            # log10 metrics: the % is the real change in the underlying amount (10^Δ - 1)
            pct = (10 ** (c - b) - 1) * 100 if k.endswith('_log') else (c - b) / abs(b) * 100 if b else None
            worst = max(xc) if k in LOWER_IS_BETTER else min(xc)
            s = status(k, pct, th)
            if s == 'FAIL' or (s == 'WARN' and worst_all == 'PASS'): worst_all = s if worst_all != 'FAIL' else 'FAIL'
            lines.append(f'| {label(k)} | {fmt(b)} | {fmt(c)} | {fmt(c - b)} | {"—" if pct is None else f"{pct:+.1f}%"} | {fmt(worst)} | {s} |')
        bad = [f'{side} seed {s}: {msg}' for side, R in (('baseline', B), ('new', C)) for s in seeds if (msg := integrity(R[s], a.days))]
        lines.append(f'| One-time milestone rewards | | | | | | {"FAIL" if bad else "PASS"} |')
        if bad: worst_all = 'FAIL'; lines += [''] + [f'- {b}' for b in bad]
        lines.append('')
    lines.insert(1, f'Overall: **{worst_all}** (PASS = within expected variation, WARN = worth investigating, FAIL = past the agreed threshold or an integrity check failed)')
    text = '\n'.join(lines)
    if a.out: open(a.out, 'w').write(text)
    print(text)

if __name__ == '__main__':
    main()
