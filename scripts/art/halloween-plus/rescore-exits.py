#!/usr/bin/env python3
"""HALLOWEEN-PLUS: re-score every recorded exit attempt with the lane detector (motionframes.exit_mid), write the best
attempt's evidence frame + crop per spec, and record device/exit-scores.json. Prints the specs still without a mid-exit
frame (re-run `capture.py motion <key>` for those). Usage: rescore-exits.py"""
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import motionframes  # noqa: E402
from PIL import Image  # noqa: E402

ROOT = pathlib.Path('artifacts/HALLOWEEN-PLUS'); OUT = ROOT / 'screens' / 'device'
records = {}
for line in (ROOT / 'device' / 'captures.jsonl').read_text().splitlines():
    r = json.loads(line)
    if 'motion' in r:
        records[r['motion']] = r
result, missing = {}, []
for key, r in records.items():
    attempts = []
    for folder in sorted(OUT.glob(f'{key}-exit[0-9]-frames')):
        m = motionframes.exit_mid(folder, r['camera'], r['exit']); m['folder'] = folder.name; attempts.append(m)
    best = max(attempts, key=lambda m: m['laneScore'])
    cam = r['camera']; cell = cam['cellDp'] * 3.5
    l, t, rr, b = best['box']; x, y = motionframes._cell(cam, *r['exit']['cells'][-1])
    crop = (int(min(l, x - 2.5 * cell)), int(min(t, y - 2.5 * cell)), int(max(rr, x + 2.5 * cell)), int(max(b, y + 2.5 * cell)))
    img = Image.open(OUT / best['folder'] / best['frame']).convert('RGB')
    img.save(OUT / f'{key}-exit-pick.png'); img.crop(crop).save(OUT / f'{key}-exit-pick-crop.png')
    result[key] = {'best': {k: best[k] for k in ('folder', 'frame', 'found', 'laneScore', 'laneResidual', 'box')},
                   'attempts': [{k: m[k] for k in ('folder', 'frame', 'found', 'laneScore', 'laneResidual')} for m in attempts]}
    if not best['found']:
        missing.append(key)
    print(key, result[key]['best'])
(ROOT / 'device' / 'exit-scores.json').write_text(json.dumps(result, indent=1) + '\n')
print('MISSING', ' '.join(missing))
