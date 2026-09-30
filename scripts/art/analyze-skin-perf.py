#!/usr/bin/env python3
"""Reproduce median permutation tests and reconcile raw gfxinfo rows."""
import json
import math
from pathlib import Path
import random
import statistics

root = Path('artifacts/ART-SKINS-01/perf')
raw = json.loads((root / 'raw.json').read_text())
runs = raw['runs']
seed = 20260930
iterations = 20000
rng = random.Random(seed)
median = statistics.median

def percentile(values, fraction):
    return sorted(values)[max(0, math.ceil(len(values) * fraction) - 1)]

summary = {'samples': {arm: sum(r['arm'] == arm for r in runs) for arm in ['A', 'B', 'A2']},
           'medians': {}, 'tests': {}, 'frameReconciliation': [], 'apkSha256': raw['apkSha256']}
for metric in ['buildMs', 'uiFrameP95Ms', 'deadlineMisses', 'frameCount', 'jankyFramePercent']:
    arms = {arm: [r[metric] for r in runs if r['arm'] == arm] for arm in ['A', 'B', 'A2']}
    off = arms['A'] + arms['A2']
    on = arms['B']
    summary['medians'][metric] = {arm: median(values) for arm, values in arms.items()}
    summary['medians'][metric]['OFFpooled'] = median(off)
    delta = median(on) - median(off)
    null = []
    for _ in range(iterations):
        shuffled = rng.sample(off, len(off))
        half = len(off) // 2
        null.append(abs(median(shuffled[:half]) - median(shuffled[half:])))
    combined = off + on
    extreme = 0
    for _ in range(iterations):
        shuffled = rng.sample(combined, len(combined))
        difference = abs(median(shuffled[:len(off)]) - median(shuffled[len(off):]))
        extreme += difference >= abs(delta)
    summary['tests'][metric] = {
        'medianRegression': delta, 'offVsOffObservedSpread': abs(median(arms['A']) - median(arms['A2'])),
        'offVsOffPermutationNullSpread': {
            'medianAbsoluteDifference': median(null), 'p95AbsoluteDifference': percentile(null, .95),
            'p99AbsoluteDifference': percentile(null, .99)},
        'twoSidedMedianPermutationP': (extreme + 1) / (iterations + 1),
        'iterations': iterations, 'seed': seed}

for run in runs:
    columns = None
    complete = {}
    excluded = {}
    for line in (root / f"run-{run['i']}-gfxinfo.txt").read_text().splitlines():
        line = line.strip()
        if line.startswith('Flags,'):
            columns = line.rstrip(',').split(',')
            continue
        if not columns or not line or not line[0].isdigit():
            continue
        values = line.rstrip(',').split(',')
        if len(values) != len(columns):
            continue
        try:
            row = dict(zip(columns, map(int, values)))
        except ValueError:
            continue
        start = row['IntendedVsync']
        end = row['FrameCompleted']
        key = (start, end)
        if row['Flags'] == 0 and start > 0 and end > start:
            complete[key] = row
        else:
            excluded[key] = row
    assert len(complete) == run['frameCount'], f"Run {run['i']} count mismatch"
    start = int(run['timing']['startNs'])
    end = int(run['timing']['endNs']) + raw['exitDurationMs'] * 1_000_000
    active = sorted(r['IntendedVsync'] for r in complete.values() if start <= r['IntendedVsync'] <= end)
    period = 1_000_000_000 / raw['refreshHz']
    gaps = sum(max(0, round((b - a) / period) - 1) for a, b in zip(active, active[1:]))
    summary['frameReconciliation'].append({
        'i': run['i'], 'arm': run['arm'], 'captureNominalSlots': run['expectedDisplayFrames'],
        'slitherNominalSlots': raw['exitDurationMs'] * raw['refreshHz'] / 1000,
        'allCompleteFrames': len(complete), 'completeFramesInTapAndSlitherWindow': len(active),
        'excludedRowsInThatWindow': sum(start <= r['IntendedVsync'] <= end for r in excluded.values()),
        'vsyncSlotsBetweenCompleteFramesWithoutACompleteRow': gaps})
summary['gate'] = {
    'staticBuildPass': summary['tests']['buildMs']['medianRegression'] <= summary['tests']['buildMs']['offVsOffPermutationNullSpread']['p95AbsoluteDifference'],
    'exitFramePass': False,
    'reason': 'Static recording cost exceeds OFF null spread. Low cadence and host contention do not support a passing exit-frame/drop verdict.'}
(root / 'summary.json').write_text(json.dumps(summary, indent=2) + '\n')
print(json.dumps({'samples': summary['samples'], 'completeFrames': sum(r['allCompleteFrames'] for r in summary['frameReconciliation']),
                  'activeFrames': sum(r['completeFramesInTapAndSlitherWindow'] for r in summary['frameReconciliation']),
                  'activeExcluded': sum(r['excludedRowsInThatWindow'] for r in summary['frameReconciliation']),
                  'activeGaps': sum(r['vsyncSlotsBetweenCompleteFramesWithoutACompleteRow'] for r in summary['frameReconciliation']), 'gate': summary['gate']}))
