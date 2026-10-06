#!/usr/bin/env python3
"""HALLOWEEN-PLUS native contract summary (template: artifacts/HALLOWEEN-01b/summarize-contract.py).
Reads checks/native-{before,after,polish,halloween}.json and writes checks/contract-summary.json. Exits non-zero unless
the ART03 red control failed as expected and every other level/mode passed for every spec (candidates included)."""
import collections
import json
import pathlib

root = pathlib.Path('artifacts/HALLOWEEN-PLUS/checks')
load = lambda mode: json.loads((root / f'native-{mode}.json').read_text())
before, after, polish, hall = load('before'), load('after'), load('polish'), load('halloween')
assert all(r['status'] == 'EXPECTED_K1_FAIL' for r in before), 'ART03 red control did not fail'
assert all(r['status'] == 'PASS' for r in after + polish + hall), 'a contract mode failed'
levels = sorted(r['level'] for r in after)
assert levels == sorted(list(range(20)) + [3827]), levels
candidates = json.loads((root / 'contract-data.json').read_text())['candidates']
S = collections.defaultdict(collections.Counter); draws = collections.defaultdict(int)
for r in after:
    for s in r['specs']:
        for k in ['arrows', 'fitFailures', 'headFailures', 'oneCellChecks', 'alignedShaftChecks', 'featureNegativeControls',
                  'headBoundaryPixels', 'singleCellChecks']:
            S[s['spec']][k] += s[k]
        draws[s['spec']] = max([draws[s['spec']]] + [d['drawsWithMark'] for d in s['draws']])
        S[s['spec']]['flatLodLevels'] += int(s['flatLod']); S[s['spec']]['reducedMotionLevels'] += int(s['reducedMotion'])
P = collections.defaultdict(collections.Counter); H = collections.defaultdict(collections.Counter)
for r in polish:
    for s in r['specs']:
        for k in ['faceClearanceChecks', 'oneCellHeadFaces', 'unchangedPathArrays', 'negativeControls', 'blushClearanceChecks',
                  'blushOutsideReported']:
            P[s['spec']][k] += s.get(k, 0)
for r in hall:
    for s in r['specs']:
        for k, v in s.items():
            if k in ('spec', 'eyeShape', 'lengthBands', 'candidate'):
                continue
            if k.startswith('max'):
                H[s['spec']][k] = max(H[s['spec']][k], v)
            else:
                H[s['spec']][k] += int(v)
out = {'levels': levels, 'beforeArt03FitFailures': sum(r['fitFailures'] for r in before), 'candidates': candidates,
       'specs': {sid: {'candidate': sid in candidates, 'after': dict(S[sid]), 'maxDrawsWithMark': draws[sid],
                       'polish': dict(P[sid]), 'halloween': dict(H[sid])} for sid in S}}
for sid in candidates:
    v = out['specs'][sid]
    assert v['after']['fitFailures'] == 0 and v['after']['headFailures'] == 0 and v['maxDrawsWithMark'] <= 8, sid
    assert v['after']['flatLodLevels'] == 21 and v['after']['reducedMotionLevels'] == 21, sid
    assert v['polish'].get('blushOutsideReported', 0) == 0, sid
(root / 'contract-summary.json').write_text(json.dumps(out, indent=1) + '\n')
print('levels', levels, 'ART03 red control failures', out['beforeArt03FitFailures'])
for sid, v in out['specs'].items():
    a = v['after']
    print(f"{'*' if v['candidate'] else ' '} {sid:16} K1fail={a['fitFailures']} K3fail={a['headFailures']} draws={v['maxDrawsWithMark']} "
          f"oneCell={a['oneCellChecks']} featNeg={a['featureNegativeControls']} flat={a['flatLodLevels']} rm={a['reducedMotionLevels']} "
          f"axis={a['alignedShaftChecks']} joinPx={a['headBoundaryPixels']} polish={dict(v['polish'])} hw={dict(v['halloween'])}")
