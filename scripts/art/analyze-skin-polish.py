#!/usr/bin/env python3
"""Cold preparation and paired recording results; missing exit captures stay unverified."""
import itertools
import json
from pathlib import Path
import statistics

root = Path('artifacts/ART-SKINS-03/perf')
raw = json.loads((root / 'raw.json').read_text())
runs = raw['runs']
assert len(runs) == 24 and sum(r['enabled'] for r in runs) == 12
for pair in range(12):
    assert sorted(r['enabled'] for r in runs if r['pair'] == pair) == [False, True]
on = [r for r in runs if r['enabled']]
assert all(len(r['prep']) == 1 and r['prep'][0]['detail'] == 2 and r['screenCell'] >= 28 for r in on)
cold = [r['prep'][0]['ms'] for r in on]
off_build = [r['buildMs'] for r in runs if not r['enabled']]
on_build = [r['buildMs'] for r in on]
paired = []
for pair in range(12):
    two = [r for r in runs if r['pair'] == pair]
    paired.append(next(r['buildMs'] for r in two if r['enabled']) - next(r['buildMs'] for r in two if not r['enabled']))
observed = abs(statistics.median(paired))
null = [abs(statistics.median(d*s for d,s in zip(paired,signs))) for signs in itertools.product([-1,1],repeat=12)]
summary = {'apkSha256': raw['apkSha256'], 'pairs': 12, 'screenCellDp': sorted(set(r['screenCell'] for r in runs)),
           'initialFullDetailEveryOpen': True, 'coldPreparation': {'samples': len(cold), 'medianMs': statistics.median(cold), 'maxMs': max(cold), 'minMs': min(cold), 'maxBudgetMs': 16, 'withinObservedBudget': max(cold) <= 16},
           'stripRecording': {'offMedianMs': statistics.median(off_build), 'onMedianMs': statistics.median(on_build), 'offRangeMs': [min(off_build),max(off_build)], 'onRangeMs':[min(on_build),max(on_build)],
                              'medianWithinPairDifferenceMs': statistics.median(paired), 'pairedMedianPermutationP': sum(x >= observed for x in null)/len(null), 'exactPermutations': len(null)},
           'hostBefore': runs[0]['before'], 'hostAfter': runs[-1]['after'],
           'exitStatus': 'UNVERIFIED', 'exitCaptures': sum(r['frames'] is not None for r in runs), 'exitRows': []}
for run in runs:
    frames = run['frames']
    if frames is not None:
        summary['exitRows'].append({'i':run['i'],'pair':run['pair'],'enabled':run['enabled'],'screenCellDp':run['screenCell'],
                                   'p50Ms':frames['uiFrameP50Ms'],'p95Ms':frames['uiFrameP95Ms'],
                                   'completedFrames':frames['completed'],'nominalSlots':frames['nominalSlots'],
                                   'acceptedExit':run.get('acceptedExit'), 'quietBefore':run['before']['quiet'],'quietAfter':run['after']['quiet']})
(root / 'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps(summary,indent=2))
