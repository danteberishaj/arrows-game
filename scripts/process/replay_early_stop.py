#!/usr/bin/env python3
"""PROCESS-SPEED E2: replay the pre-registered early-stop rule E2-R1 on archived perf series (no device).

Rule (docs/process/speed-experiments-2026-10-07.md, E2 pre-registration, committed 788dd3a before any outcome was read):
  looks after every completed block once each compared arm has k_min=3 runs; delta = null shift |med(N)-med(A)| when the
  series has a null arm N, else max(range A, range B), floored at the instrument resolution;
  effect   : |med(B)-med(A)| > delta and the A/B ranges do not overlap, same direction, m=2 consecutive looks;
  futility : |med(B)-med(A)| <= delta/2 and the ranges overlap, m=2 consecutive looks;
  absolute : every non-null arm's running median clears the threshold by > delta, same side, m=2 consecutive looks;
  the series stops when every gated metric is decided; otherwise it runs to its recorded end (original verdict).

Input: series JSON files (schema in artifacts/PROCESS-SPEED/phase2/e2/README or the E2 section of the doc).
Usage: python3 scripts/process/replay_early_stop.py <series.json or dir> [...] [--json out.json] [--sim 400] [--seed 7]
--sim N adds a label-permutation check: A/B labels are shuffled within each series (a null by construction) and the
rate at which the sequential rule claims an effect is compared with a single fixed-n look at the full series."""
import glob
import json
import os
import random
import statistics
import sys

K_MIN, M = 3, 2

args = sys.argv[1:]
out_path, sims, seed, paths = None, 0, 7, []
i = 0
while i < len(args):
    if args[i] == '--json': out_path = args[i + 1]; i += 2
    elif args[i] == '--sim': sims = int(args[i + 1]); i += 2
    elif args[i] == '--seed': seed = int(args[i + 1]); i += 2
    else: paths.append(args[i]); i += 1
files = []
for p in paths:
    files += sorted(glob.glob(os.path.join(p, '*.json'))) if os.path.isdir(p) else [p]


def med(xs):
    return statistics.median(xs)


def rng(xs):
    return max(xs) - min(xs) if len(xs) > 1 else 0.0


def look_state(metric, seen, arms_cmp, has_null):
    """Decision candidate for one metric at one look: ('shift', sign) | ('none', 0) | ('abs', sides) | None."""
    name, res = metric['name'], metric.get('resolution') or 0.0
    a = [v for arm, v in seen if arm == 'A']
    n = [v for arm, v in seen if arm == 'N']
    if metric.get('gate') == 'absolute' and metric.get('threshold') is not None:
        t = metric['threshold']
        groups = {arm: [v for x, v in seen if x == arm] for arm in ['A'] + arms_cmp}
        groups = {k: v for k, v in groups.items() if v}
        delta = max([rng(v) for v in groups.values()] + [res])
        if has_null and n and a: delta = max(abs(med(n) - med(a)), res)
        sides = {}
        for arm, vals in groups.items():
            d = med(vals) - t
            if abs(d) <= delta: return None
            sides[arm] = 1 if d > 0 else -1
        return ('abs', tuple(sorted(sides.items())))
    states = []
    for arm in arms_cmp:
        b = [v for x, v in seen if x == arm]
        if has_null and n and a: delta = abs(med(n) - med(a))
        else: delta = max(rng(a), rng(b))
        delta = max(delta, res)
        diff = med(b) - med(a)
        overlap = not (max(a) < min(b) or max(b) < min(a))
        if abs(diff) > delta and not overlap and abs(diff) > res: states.append(('shift', 1 if diff > 0 else -1))
        elif abs(diff) <= delta / 2 and overlap: states.append(('none', 0))
        else: return None
    return ('multi', tuple(states))


def metric_label(metric, state):
    bad_up = metric.get('bad_direction', 'higher') == 'higher'
    if state[0] == 'abs':
        good_side = -1 if bad_up else 1  # below a "higher is bad" budget passes
        return 'pass' if all(side == good_side for arm, side in state[1] if arm != 'A') else 'fail'
    labels = []
    for kind, sign in state[1]:
        if kind == 'none': labels.append('no shift')
        else: labels.append('shift worse' if (sign > 0) == bad_up else 'shift better')
    for worst in ('shift worse', 'shift better', 'no shift'):
        if worst in labels: return worst
    return 'no shift'


def replay(series, runs=None, sequential=True):
    runs = runs if runs is not None else series['runs']
    has_null = bool(series.get('has_null_arm')) and any(r['arm'] == 'N' for r in runs)
    arms_cmp = sorted({r['arm'] for r in runs} - {'A', 'N'})
    metrics = series['metrics']
    counts = {arm: 0 for arm in ['A'] + arms_cmp}
    last_block, history = 0, {m['name']: [] for m in metrics}
    decided = {}
    for idx, run in enumerate(runs):
        if run['arm'] in counts: counts[run['arm']] += 1
        block = min(counts.values())
        if block == last_block: continue
        last_block = block
        if block < K_MIN: continue
        if not sequential and idx != max(j for j, r in enumerate(runs) if r['arm'] in counts): continue
        for metric in metrics:
            name = metric['name']
            if name in decided: continue
            seen = [(r['arm'], r['values'][name]) for r in runs[:idx + 1] if name in r.get('values', {}) and r['values'][name] is not None]
            if sum(1 for arm, _ in seen if arm == 'A') < K_MIN or any(sum(1 for x, _ in seen if x == arm) < K_MIN for arm in arms_cmp):
                history[name].append(None); continue
            state = look_state(metric, seen, arms_cmp, has_null)
            history[name].append(state)
            need = M if sequential else 1
            tail = history[name][-need:]
            if state is not None and len(tail) == need and all(s == state for s in tail):
                decided[name] = (metric_label(metric, state), idx + 1, dict(counts))
        if len(decided) == len(metrics):
            return {'stopped': True, 'at_run': idx + 1, 'per_arm': dict(counts), 'decisions': {k: v[0] for k, v in decided.items()}}
    return {'stopped': False, 'at_run': len(runs), 'per_arm': dict(counts), 'decisions': {k: v[0] for k, v in decided.items()}}


def overall_ok(original, decisions, stopped):
    labels = list(decisions.values())
    if not stopped:
        return True  # ran to the recorded end: the original verdict stands by construction
    o = original.lower()
    if o.startswith('inconclusive'): return False  # the rule decided where the full series could not
    if o in ('no regression', 'no shift'): return not any(l in ('shift worse', 'fail') for l in labels)
    if o == 'regression': return any(l in ('shift worse', 'fail') for l in labels)
    if o == 'improvement': return any(l == 'shift better' for l in labels) and not any(l in ('shift worse', 'fail') for l in labels)
    if o == 'pass': return all(l in ('pass', 'no shift', 'shift better') for l in labels)
    if o == 'fail': return any(l in ('fail', 'shift worse') for l in labels)
    return False


rows, sim_rows = [], []
random.seed(seed)
for path in files:
    s = json.load(open(path))
    if not s.get('runs') or not s.get('metrics'):
        continue
    arms = {r['arm'] for r in s['runs']}
    per_arm_full = {a: sum(1 for r in s['runs'] if r['arm'] == a) for a in sorted(arms)}
    result = replay(s)
    verdict = s['original_verdict']['overall']
    kept = overall_ok(verdict, result['decisions'], result['stopped'])
    per_metric_orig = s['original_verdict'].get('per_metric', {})
    mismatched = {k: (per_metric_orig.get(k), v) for k, v in result['decisions'].items()
                  if result['stopped'] and per_metric_orig.get(k) and per_metric_orig.get(k) != v}
    row = {'series': s['series_id'], 'file': path, 'design': s.get('design'), 'null_arm': bool(s.get('has_null_arm')),
           'original_runs': len(s['runs']), 'original_per_arm': per_arm_full, 'original_verdict': verdict,
           'early_stop': result['stopped'], 'early_runs': result['at_run'], 'early_per_arm': result['per_arm'],
           'early_decisions': result['decisions'], 'verdict_kept': kept, 'per_metric_mismatch': mismatched,
           'runs_saved': len(s['runs']) - result['at_run'], 'confidence': s.get('confidence')}
    rows.append(row)
    if sims:
        ab = [r for r in s['runs'] if r['arm'] != 'N']
        labels = [r['arm'] for r in ab]
        seq_claims = fixed_claims = 0
        for _ in range(sims):
            shuffled = labels[:]; random.shuffle(shuffled)
            fake, it = [], iter(shuffled)
            for r in s['runs']:
                fake.append(r if r['arm'] == 'N' else {**r, 'arm': next(it)})
            seq = replay(s, fake, sequential=True)
            fixed = replay(s, fake, sequential=False)
            seq_claims += any(v in ('shift worse', 'shift better') for v in seq['decisions'].values())
            fixed_claims += any(v in ('shift worse', 'shift better') for v in fixed['decisions'].values())
        sim_rows.append({'series': s['series_id'], 'sims': sims, 'sequential_effect_rate': seq_claims / sims,
                         'fixed_n_effect_rate': fixed_claims / sims})

print(f"{'series':40} {'n orig':>7} {'n stop':>7} {'saved':>5}  {'original':16} {'early decisions':40} kept")
for r in rows:
    dec = ', '.join(f'{k}={v}' for k, v in r['early_decisions'].items()) if r['early_stop'] else '(ran to end)'
    print(f"{r['series'][:40]:40} {r['original_runs']:7d} {r['early_runs']:7d} {r['runs_saved']:5d}  {r['original_verdict'][:16]:16} {dec[:40]:40} {'yes' if r['verdict_kept'] else 'NO'}")
total = sum(r['original_runs'] for r in rows); saved = sum(r['runs_saved'] for r in rows)
flips = [r['series'] for r in rows if not r['verdict_kept']]
print(f'series {len(rows)}; runs {total}; saved {saved} ({saved / total:.1%} of runs); stopped early {sum(r["early_stop"] for r in rows)}; '
      f'median saved per series {statistics.median([r["runs_saved"] for r in rows]) if rows else 0}; flips {len(flips)} {flips}')
for r in sim_rows:
    print(f"  sim {r['series'][:40]:40} sequential effect rate {r['sequential_effect_rate']:.3f}  fixed-n {r['fixed_n_effect_rate']:.3f}")
if out_path:
    json.dump({'rule': 'E2-R1', 'k_min': K_MIN, 'm': M, 'rows': rows, 'sim': sim_rows,
               'summary': {'series': len(rows), 'runs': total, 'saved': saved, 'flips': flips}}, open(out_path, 'w'), indent=1)
