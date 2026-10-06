#!/usr/bin/env python3
"""HALLOWEEN-PLUS real-viewport captures on emulator-5556 (test-ads seasons APK installed; save backed up first).

Every capture launches the ordinary MainActivity with the EXISTING native diagnostic override `-e artSkinSpec <json>`
(ArrowsBoardView.setArtSkin), so the real native board renders a spec that is not registered anywhere. The save selects
the owned seasonal Pumpkin (id 18) so the JS gate sends a skin selection and the Halloween board tint (#F3EEFA/#221A36);
the native view then parses the override JSON instead. Registered pack specs are passed as their exact SKIN_SPEC_JSON.

Usage (repo root):
  capture.py first-run                 launch once so the app creates its (empty, 0-byte) save tables
  capture.py boards [key ...]          static board for each spec x theme x board
  capture.py motion [key ...]          blocked tap (closed eyes) + one exit, light theme, small board
Never taps an ad: focus is checked before every input; a foreign activity aborts the run."""
import json
import pathlib
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from adbutil import DEVICE, PKG, ROOT, identity, run, sh, shell_quote, stopped  # noqa: E402
import device  # noqa: E402

NODE = '/Users/gentlegen/.nvm/versions/node/v20.19.4/bin/node'
DENSITY = 3.5
BOARDS = {'small': 12, 'long': 504, 'dense': 3827}
OWNED_LO = 262165  # bits 0, 2, 4 (the free styles) + 18 (Pumpkin), as HALLOWEEN-01b's fixture
LIVE = '/data/local/tmp/local/tmp/book01-live-ui.xml'
OUT = ROOT / 'screens' / 'device'
OUT.mkdir(parents=True, exist_ok=True)
SPECS = json.loads(subprocess.run([NODE, 'scripts/art/halloween-plus/plan.cjs', 'specs'], capture_output=True, text=True, check=True).stdout)
LEDGER = ROOT / 'device' / 'captures.jsonl'
CACHE = {}


def plan(index):
    return json.loads(subprocess.run([NODE, 'scripts/art/halloween-plus/plan.cjs', str(index)], capture_output=True, text=True, check=True).stdout)


def focus():
    value = sh('dumpsys window | grep mCurrentFocus')
    if PKG not in value or re.search(r'AdActivity|admob|gms|vending', value, re.I):
        raise SystemExit('Foreign window in front (ad?), aborting without input: ' + value)
    return value


def tree():
    sh(f'rm -f {LIVE}')
    output = run(['shell', 'uiautomator', 'runtest', '/system/framework/android.test.runner.jar',
                  '/system/framework/android.test.base.jar', '/data/local/tmp/book01-hierarchy.jar',
                  '-c', 'com.arrows.art.ArrowsHierarchy#testDump'], timeout=90, check=False)
    if 'OK (1 test)' not in output or re.search(r'FAILURES|shortMsg|No fresh hierarchy', output):
        return None
    return ET.fromstring(sh(f'cat {LIVE}'))


def bounds(node):
    return list(map(int, re.findall(r'\d+', node.attrib['bounds'])))


def find(nodes, label):
    return [n for n in nodes.iter('node') if label in (n.attrib.get('text'), n.attrib.get('content-desc'))
            or n.attrib.get('content-desc', '').startswith(label + ', ')]


def wait_for(label, seconds=150):
    end = time.time() + seconds
    while time.time() < end:
        nodes = tree()
        if nodes is not None and find(nodes, label):
            return nodes
        time.sleep(.7)
    raise RuntimeError('timed out waiting for ' + label)


def tap_xy(x, y):
    focus(); sh(f'input tap {int(round(x))} {int(round(y))}')


def save(theme, level):
    device.fixture({'arrows_total_solved': level, 'arrows_current_level': level, 'arrows_skin': 18,
                    'arrows_dark_mode': 1 if theme == 'dark' else 0, 'arrows_finished_games': 0, 'arrows_ftue_stage': 3,
                    'arrows_perfect_streak': 0, 'arrows_petals': 10, 'arrows_reward_points': 0, 'arrows_path_grants': 0,
                    'arrows_rewards_owned_lo': OWNED_LO, 'arrows_rewards_owned_hi': 0})


def camera_from_log(log):
    raw = re.findall(r'\[board-viewport\] w=([\d.]+) h=([\d.]+)', log)
    cam = re.findall(r'\[board-camera\] (?:new-board|refit|restore) viewport=([\d.]+)x([\d.]+) scale=([\d.e-]+) tx=([-\d.e]+) ty=([-\d.e]+)', log)
    if not raw or not cam:
        return None
    w, h = map(float, raw[-1]); vw, vh, scale, tx, ty = map(float, cam[-1])
    return {'layoutW': w, 'layoutH': h, 'vw': vw, 'vh': vh, 'scale': scale, 'tx': tx, 'ty': ty, 'cellDp': 40 * scale}


def open_board(key, theme, level):
    """Fresh process, fixture save, override launch, Play; returns the observed camera + board-view origin."""
    identity(); stopped(); save(theme, level)
    run(['logcat', '-c'])
    sh(f'am start -n {PKG}/.MainActivity -e artSkinSpec {shell_quote(SPECS[key])}', timeout=180)
    camera = None
    # A hierarchy dump costs ~26 s on this loaded host. The Play bounds observed once are reused; success is proven
    # by the board's own camera log line, and a miss falls back to a fresh dump (never blind repeated input).
    for attempt in range(2):
        if 'play' not in CACHE or attempt:
            nodes = wait_for('Play')
            play = [n for n in find(nodes, 'Play') if n.attrib.get('clickable') == 'true'] or find(nodes, 'Play')
            CACHE['play'] = bounds(play[0])
        else:
            time.sleep(6)
        l, t, r, b = CACHE['play']; tap_xy((l + r) / 2, (t + b) / 2)
        end = time.time() + 25
        while time.time() < end and camera is None:
            time.sleep(.8)
            camera = camera_from_log(run(['logcat', '-d', '-s', 'ReactNativeJS:I'], timeout=30))
        if camera is not None:
            break
    if camera is None:
        raise RuntimeError('no [board-camera] line after Play')
    time.sleep(2.5)  # level transition + first draw settle (META_LEVEL_TRANSITION)
    if 'origin' in CACHE:
        camera['originPx'] = CACHE['origin']; camera['originFrom'] = 'cached first dump (same header/layout)'
        assert abs(camera['layoutH'] - CACHE['layoutH']) < .01, 'board layout height changed; re-measure'
        return check_override(camera)
    nodes = tree()
    width, height = map(int, re.findall(r'(\d+)x(\d+)', sh('wm size'))[-1])
    views = [bounds(n) for n in nodes.iter('node') if n.attrib.get('class') == 'android.view.ViewGroup'] if nodes is not None else []
    want = camera['layoutH'] * DENSITY
    # Edge to edge: the board layout runs under the navigation bar, so its a11y bounds are clipped at the window
    # bottom; match the top edge by the logged layout height measured from the physical screen bottom.
    views = [v for v in views if v[0] == 0 and v[2] == width and v[1] > 0 and abs((height - v[1]) - want) <= 3]
    assert views, f'no board view of height {want}px'
    camera['originPx'] = views[0][:2]; camera['originFrom'] = 'hierarchy dump'
    CACHE['origin'] = camera['originPx']; CACHE['layoutH'] = camera['layoutH']
    return check_override(camera)


def check_override(camera):
    skin = [line for line in run(['logcat', '-d'], timeout=30).splitlines() if 'ArtSkinSpec' in line and 'Invalid' in line]
    assert not skin, skin  # the native parser rejected the override
    return camera


def cell_px(camera, r, c):
    x0, y0 = camera['originPx']; s = camera['scale']
    return x0 + (camera['tx'] + (c + .5) * 40 * s) * DENSITY, y0 + (camera['ty'] + (r + .5) * 40 * s) * DENSITY


def in_view(camera, r, c, margin=1.2):
    x0, y0 = camera['originPx']
    x, y = cell_px(camera, r, c); m = margin * camera['cellDp'] * DENSITY
    return x0 + m <= x <= x0 + camera['vw'] * DENSITY - m and y0 + m <= y <= y0 + camera['vh'] * DENSITY - m


def shot(name, meta):
    path = OUT / f'{name}.png'
    path.write_bytes(run(['exec-out', 'screencap', '-p'], binary=True, timeout=60))
    with LEDGER.open('a') as log:
        log.write(json.dumps({'file': str(path), 'time': time.time(), **meta}) + '\n')
    print(path, flush=True)


def record(name, action, seconds=5):
    """Full-resolution, 30 fps recording by the emulator itself (`adb emu screenrecord`, encoded on the host; the guest
    screenrecord cannot encode 1440x3120 and a guest screencap burst ran at ~1.5 s/frame on this loaded host). The tap
    is injected 1.2 s after the recording starts; frames are extracted at 30 fps with their time since the start."""
    video = (OUT / f'{name}.webm').resolve()
    video.unlink(missing_ok=True)
    started = time.time()
    run(['emu', 'screenrecord', 'start', '--time-limit', str(seconds), '--fps', '30', str(video)])
    time.sleep(1.2)
    tapped = time.time(); action()
    time.sleep(seconds + 1.5 - (time.time() - started) if seconds + 1.5 > time.time() - started else 0)
    run(['emu', 'screenrecord', 'stop'], check=False)
    end = time.time() + 30
    while time.time() < end and (not video.exists() or video.stat().st_size == 0):
        time.sleep(.5)
    time.sleep(1)
    folder = OUT / f'{name}-frames'; folder.mkdir(exist_ok=True)
    for old in folder.glob('*'):
        old.unlink()
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', str(video), '-vf', 'fps=30', str(folder / '%03d.png')], check=True)
    count = len(list(folder.glob('*.png')))
    (folder / 'timing.json').write_text(json.dumps({'fps': 30, 'tapSecondsAfterRecordStartHost': round(tapped - started, 3),
                                                     'frames': count}, indent=1) + '\n')
    print(name, count, 'frames; tap at', round(tapped - started, 2), 's', flush=True)


def first_run():
    identity(); stopped()
    sh(f'am start -W -n {PKG}/.MainActivity', timeout=60)
    time.sleep(12)
    focus(); stopped()
    print('rows after first run:', device.rows())


def boards(keys):
    for board, level in BOARDS.items():
        for theme in ('light', 'dark'):
            for key in keys:
                if (OUT / f'{key}-{board}-{theme}.png').exists():
                    continue  # resume: a capture is only written after its board camera was observed
                for attempt in range(3):
                    try:
                        camera = open_board(key, theme, level); break
                    except (RuntimeError, subprocess.TimeoutExpired) as error:
                        print('retry', key, board, theme, repr(error)[:200], flush=True)
                else:
                    raise RuntimeError(f'{key} {board} {theme} failed 3 times')
                shot(f'{key}-{board}-{theme}', {'spec': key, 'board': board, 'level': level, 'theme': theme, 'camera': camera})
    stopped()


def evidence(key, kind, folder, pick, camera, arrow):
    """Saves the chosen full frame and a 6-cell crop around the tapped head as <key>-<kind>.png / -crop.png."""
    from PIL import Image
    cell = camera['cellDp'] * DENSITY; x, y = cell_px(camera, *arrow['cells'][-1])
    img = Image.open(pathlib.Path(folder) / pick['frame']).convert('RGB')
    img.save(OUT / f'{key}-{kind}.png')
    img.crop(tuple(int(v) for v in (x - 3 * cell, y - 3 * cell, x + 3 * cell, y + 3 * cell))).save(OUT / f'{key}-{kind}-crop.png')


def motion(keys, exit_attempts=4):
    import motionframes
    level = BOARDS['small']; facts = plan(level)
    for key in keys:
        camera = open_board(key, 'light', level)
        arrows = facts['arrows']
        def pick(free):
            options = [a for a in arrows if a['free'] == free and len(a['cells']) >= 3 and in_view(camera, *a['cells'][-1])
                       and all(in_view(camera, *cell, margin=.6) for cell in a['cells'])]
            cx = camera['originPx'][0] + camera['vw'] * DENSITY / 2; cy = camera['originPx'][1] + camera['vh'] * DENSITY / 2
            return min(options, key=lambda a: (cell_px(camera, *a['cells'][-1])[0] - cx) ** 2 + (cell_px(camera, *a['cells'][-1])[1] - cy) ** 2)
        blocked, free = pick(False), pick(True)
        meta = {'spec': key, 'board': 'small', 'level': level, 'theme': 'light', 'camera': camera, 'blocked': blocked, 'exit': free}
        shot(f'{key}-motion-before', meta)
        record(f'{key}-blocked', lambda: tap_xy(*cell_px(camera, *blocked['cells'][-1])))
        peak = motionframes.blocked_peak(OUT / f'{key}-blocked-frames', camera, blocked)
        evidence(key, 'blocked-peak', OUT / f'{key}-blocked-frames', peak, camera, blocked)
        exits = []
        for attempt in range(1, exit_attempts + 1):
            # A blocked tap can move the camera (observed: the board zoomed out to show the blocker), so every exit gets a
            # fresh process and the same opening camera, verified equal before input.
            again = open_board(key, 'light', level)
            assert all(abs(again[k] - camera[k]) < 1e-3 for k in ('scale', 'tx', 'ty')) and again['originPx'] == camera['originPx'], (again, camera)
            name = f'{key}-exit{attempt}'
            record(name, lambda: tap_xy(*cell_px(camera, *free['cells'][-1])))
            mid = motionframes.exit_mid(OUT / f'{name}-frames', camera, free); mid['attempt'] = attempt; exits.append(mid)
            print(key, 'exit attempt', attempt, 'found', mid['found'], mid['laneScore'], 'residual', mid['laneResidual'], flush=True)
            if mid['found']:
                break
        best = max(exits, key=lambda m: m['laneScore'])
        evidence(key, 'exit-pick', OUT / f"{key}-exit{best['attempt']}-frames", best, camera, free)
        with LEDGER.open('a') as log:
            log.write(json.dumps({'motion': key, 'time': time.time(), **meta, 'blockedPeak': peak, 'exitAttempts': exits,
                                  'exitPick': {k: best[k] for k in ('attempt', 'frame', 'found', 'laneScore', 'laneResidual')},
                                  'blockedTapPx': cell_px(camera, *blocked['cells'][-1]), 'exitTapPx': cell_px(camera, *free['cells'][-1])}) + '\n')
    stopped()


if __name__ == '__main__':
    action, *rest = sys.argv[1:]
    if action == 'open':  # one board for inspection: open <key> <theme> <board>
        print(json.dumps(open_board(rest[0], rest[1], BOARDS[rest[2]]))); raise SystemExit(0)
    keys = rest or list(SPECS)
    unknown = [k for k in keys if k not in SPECS]
    assert not unknown, unknown
    if action == 'first-run': first_run()
    elif action == 'boards': boards(keys)
    elif action == 'motion': motion(keys)
    else: raise SystemExit('unknown action ' + action)
