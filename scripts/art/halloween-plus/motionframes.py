"""HALLOWEEN-PLUS: choose motion evidence frames by measured pixel change (imported by capture.py and rescore-exits.py).

blocked: inside 0.9 s after the tap, the frame with the largest change in a 2.4-cell box around the tapped head
         (pink blocked ink + shake + closed eyes); later frames hold the flat missed mark and are excluded.
exit:    a MID-exit frame = the arrow is inside its EXIT LANE (head edge -> viewport edge, one cell wide, the arrow's own
         cells excluded), which is empty before the tap and again after the exit. A press-scale or tint frame changes the
         arrow's own cells but not the lane, so it cannot pass. (A first detector, min(diff to pre, diff to post) over the
         arrow + lane box, was fooled by exactly such frames: 7 of 10 'found' picks showed the untouched arrow.)
         The emulator recorder delivers ~6 distinct frames/s on this host and an exit trail lasts <= 320 ms, so a mid
         frame is not guaranteed; `found` = lane change >= 4 and >= 4x the pre->final lane residual."""
import json
import pathlib

from PIL import Image, ImageChops, ImageStat

DENSITY = 3.5
STEP = {0: (-1, 0), 1: (1, 0), 2: (0, -1), 3: (0, 1)}


def _cell(camera, r, c):
    x0, y0 = camera['originPx']; s = camera['scale']
    return x0 + (camera['tx'] + (c + .5) * 40 * s) * DENSITY, y0 + (camera['ty'] + (r + .5) * 40 * s) * DENSITY


def _diff(a, b, box):
    return sum(ImageStat.Stat(ImageChops.difference(a.crop(box), b.crop(box))).mean)


def frames_of(folder):
    folder = pathlib.Path(folder)
    timing = json.loads((folder / 'timing.json').read_text())
    return sorted(folder.glob('[0-9][0-9][0-9].png')), int(timing['tapSecondsAfterRecordStartHost'] * 30)


def blocked_peak(folder, camera, arrow):
    frames, tap = frames_of(folder); cell = camera['cellDp'] * DENSITY
    x, y = _cell(camera, *arrow['cells'][-1])
    box = tuple(int(v) for v in (x - 1.2 * cell, y - 1.2 * cell, x + 1.2 * cell, y + 1.2 * cell))
    base = Image.open(frames[max(0, tap - 6)]).convert('RGB')
    window = list(range(max(0, tap - 6), min(len(frames), tap + 27)))
    scores = {i: _diff(base, Image.open(frames[i]).convert('RGB'), box) for i in window}
    peak = max(scores, key=scores.get)
    return {'frame': frames[peak].name, 'index': peak, 'box': box, 'scores': {frames[i].name: round(s, 2) for i, s in scores.items()}}


def exit_mid(folder, camera, arrow):
    frames, tap = frames_of(folder); cell = camera['cellDp'] * DENSITY
    dr, dc = STEP[arrow['dir']]
    x0, y0 = camera['originPx']; x1, y1 = x0 + camera['vw'] * DENSITY, y0 + camera['vh'] * DENSITY
    hx, hy = _cell(camera, *arrow['cells'][-1])
    if dc:
        start = hx + dc * .6 * cell; end = x1 if dc > 0 else x0
        box = (min(start, end), hy - .5 * cell, max(start, end), hy + .5 * cell)
    else:
        start = hy + dr * .6 * cell; end = y1 if dr > 0 else y0
        box = (hx - .5 * cell, min(start, end), hx + .5 * cell, max(start, end))
    box = tuple(int(v) for v in box)
    pre = Image.open(frames[max(0, tap - 6)]).convert('RGB'); post = Image.open(frames[-1]).convert('RGB')
    residual = _diff(pre, post, box)
    scores = {i: _diff(pre, Image.open(frames[i]).convert('RGB'), box) for i in range(tap, len(frames))}
    best = max(scores, key=scores.get)
    return {'frame': frames[best].name, 'index': best, 'box': box, 'laneScore': round(scores[best], 2), 'laneResidual': round(residual, 2),
            'found': scores[best] >= 4 and scores[best] >= 4 * max(residual, .5),
            'scores': {frames[i].name: round(s, 2) for i, s in scores.items()}}
