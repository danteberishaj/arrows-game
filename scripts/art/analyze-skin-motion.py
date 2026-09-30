#!/usr/bin/env python3
"""Measure the isolated first arrow in lossless decoded frames; keep capture PTS."""
from pathlib import Path
import json
import statistics
from PIL import Image

root = Path('artifacts/ART-SKINS-02/recordings')
result = {}
for name, prefix in [('motion', 'press'), ('reduced', 'reduced-press')]:
    times = [float(line.strip()) for line in (root / f'{name}-pts.csv').read_text().splitlines() if line.strip()]
    frames = sorted(root.glob(f'{prefix}-[0-9][0-9][0-9].png'))
    assert len(times) == len(frames), (len(times), len(frames))
    rows = []
    for path, pts in zip(frames, times):
        image = Image.open(path).convert('RGB')
        selected = [(x,y) for y in range(image.height) for x in range(image.width)
                    if (lambda c: c[0] > 130 and c[0] > c[1] * 1.2 and c[1] > 70 and c[2] < 170)(image.getpixel((x,y)))]
        if selected:
            x = [p[0] for p in selected]; y = [p[1] for p in selected]
            rows.append({'pts': pts, 'left': min(x), 'top': min(y), 'width': max(x)-min(x)+1, 'height': max(y)-min(y)+1})
    gaps = [b-a for a,b in zip(times,times[1:])]
    result[name] = {'decodedFrames': len(frames), 'firstPts': times[0], 'lastPts': times[-1],
                    'frameGapP50Ms': statistics.median(gaps)*1000, 'frameGapMaxMs': max(gaps)*1000,
                    'firstArrowWidths': sorted(set(r['width'] for r in rows)), 'frames': rows}
(root / 'frame-analysis.json').write_text(json.dumps(result,indent=2)+'\n')
for name,data in result.items():
    print(name, {key:value for key,value in data.items() if key != 'frames'})
