#!/usr/bin/env python3
"""HALLOWEEN-PLUS shipped (2026-10-07): device evidence for the REGISTERED Mummy (21) and Potion Slime (22) on
emulator-5556, through the real app (no `artSkinSpec` override). Run from the repo root after `device.py backup` and
the test-ads seasons APK install. Never taps an ad: every input checks the focused window first.

  shipped.py fixture-book                  save: 30 petals, only the free styles owned, Classic selected, light
  shipped.py launch                        cold start to the menu (waits for Play)
  shipped.py tree [name]                   dump the live hierarchy (text/content-desc nodes) to device/shipped-<name>.json
  shipped.py tap <label>                   tap the node whose text/content-desc is <label> (or starts with "<label>, ")
  shipped.py swipe-up                      scroll the sheet content up once
  shipped.py shot <name>                   full screenshot to screens/shipped/<name>.png (+ ledger line)
  shipped.py rows <name>                   save rows to device/shipped-rows-<name>.txt
  shipped.py board <skin-id> <light|dark>  owned + selected registered skin, Play, wait for the board camera, screenshot,
                                           count the spec's exact colours and the Halloween tint in the board area
"""
import json
import pathlib
import re
import subprocess
import sys
import time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from adbutil import DEVICE, PKG, ROOT, identity, run, sh, stopped  # noqa: E402
import capture  # noqa: E402  (tree/find/wait_for/focus/camera_from_log helpers; SPECS includes mummy/potion-slime)
import device  # noqa: E402

OUT = ROOT / 'screens' / 'shipped'
OUT.mkdir(parents=True, exist_ok=True)
LEDGER = DEVICE / 'shipped-captures.jsonl'
FREE_LO = (1 << 0) | (1 << 2) | (1 << 4)  # Classic, Sherbet, Candy Gloss (FREE_REWARD_IDS)
SKINS = {'mummy': 21, 'potion-slime': 22}
LEVEL = 12  # v1 index 12 (LEVEL 13): opens zoomed at 29.39 dp, so head faces render (concept report)
TINT = {'light': (0xF3, 0xEE, 0xFA), 'dark': (0x22, 0x1A, 0x36)}


def base(theme, level, skin, owned_lo, petals):
    return {'arrows_total_solved': level, 'arrows_current_level': level, 'arrows_skin': skin,
            'arrows_dark_mode': 1 if theme == 'dark' else 0, 'arrows_finished_games': 0, 'arrows_ftue_stage': 3,
            'arrows_perfect_streak': 0, 'arrows_petals': petals, 'arrows_reward_points': 0, 'arrows_path_grants': 0,
            'arrows_rewards_owned_lo': owned_lo, 'arrows_rewards_owned_hi': 0}


def shot(name, meta=None):
    path = OUT / f'{name}.png'
    path.write_bytes(run(['exec-out', 'screencap', '-p'], binary=True, timeout=60))
    with LEDGER.open('a') as log:
        log.write(json.dumps({'file': str(path), 'time': time.time(), 'deviceDate': sh('date'), **(meta or {})}) + '\n')
    print(path, flush=True)
    return path


def launch():
    identity(); stopped()
    run(['logcat', '-c'])
    sh(f'am start -n {PKG}/.MainActivity', timeout=180)
    capture.wait_for('Play')
    capture.focus()


def nodes_json(nodes):
    return [{k: n.attrib.get(k) for k in ('text', 'content-desc', 'bounds', 'clickable', 'selected', 'class')}
            for n in nodes.iter('node') if n.attrib.get('text') or n.attrib.get('content-desc')]


def tap(label):
    capture.focus()
    nodes = capture.wait_for(label, seconds=90)
    found = capture.find(nodes, label)
    node = next((n for n in found if n.attrib.get('clickable') == 'true'), found[0])
    l, t, r, b = capture.bounds(node)
    assert r > l and b > t, node.attrib
    capture.tap_xy((l + r) / 2, (t + b) / 2)
    time.sleep(1.5)
    print('tapped', label, node.attrib['bounds'], flush=True)


def colour_counts(path, colours, box):
    from PIL import Image
    img = Image.open(path).convert('RGB').crop(box)
    data = img.getdata()
    wanted = {name: tuple(int(hex_[i:i + 2], 16) for i in (1, 3, 5)) for name, hex_ in colours.items()}
    counts = {name: 0 for name in wanted}
    lookup = {rgb: name for name, rgb in wanted.items()}
    for px in data:
        name = lookup.get(px)
        if name:
            counts[name] += 1
    return counts


def board(skin, theme):
    identity(); stopped()
    device.fixture(base(theme, LEVEL, SKINS[skin], FREE_LO | (1 << SKINS[skin]), 10))
    launch()
    play = [n for n in capture.find(capture.wait_for('Play'), 'Play') if n.attrib.get('clickable') == 'true']
    l, t, r, b = capture.bounds(play[0]); capture.tap_xy((l + r) / 2, (t + b) / 2)
    camera = None; end = time.time() + 40
    while time.time() < end and camera is None:
        time.sleep(.8)
        camera = capture.camera_from_log(run(['logcat', '-d', '-s', 'ReactNativeJS:I'], timeout=30))
    if camera is None:
        raise SystemExit('no [board-camera] line after Play')
    time.sleep(3)  # level transition + first draw
    capture.focus()
    spec = json.loads(capture.SPECS[skin])
    colours = {'tint': '#%02X%02X%02X' % TINT[theme], 'body': spec['palette']['colours'][0]}
    for layer in spec['layers']:
        if layer['kind'] in ('rim', 'seam', 'shine', 'spots') and layer['colour'].startswith('#'):
            colours.setdefault(layer['kind'], layer['colour'])
    path = shot(f'board-{skin}-{theme}', {'skin': skin, 'theme': theme, 'level': LEVEL, 'camera': camera})
    width, height = map(int, re.findall(r'(\d+)x(\d+)', sh('wm size'))[-1])
    top = int(height - camera['layoutH'] * capture.DENSITY)
    counts = colour_counts(path, colours, (0, max(top, 0), width, height))
    record = {'skin': skin, 'theme': theme, 'colours': colours, 'boardTopPx': top, 'exactPixelCounts': counts,
              'rows': device.rows()}
    with (DEVICE / 'shipped-board-pixels.jsonl').open('a') as log:
        log.write(json.dumps(record) + '\n')
    print(json.dumps({k: record[k] for k in ('skin', 'theme', 'exactPixelCounts')}), flush=True)
    stopped()


if __name__ == '__main__':
    action, *args = sys.argv[1:]
    if action == 'fixture-book':
        identity(); device.fixture(base('light', 0, 0, FREE_LO, 30)); print(device.rows())
    elif action == 'launch': launch()
    elif action == 'tree':
        nodes = capture.tree()
        assert nodes is not None, 'hierarchy dump failed'
        out = nodes_json(nodes)
        (DEVICE / f"shipped-{args[0] if args else 'tree'}.json").write_text(json.dumps(out, indent=1) + '\n')
        for n in out:
            print(n['bounds'], n['clickable'], repr(n['text']), repr(n['content-desc']))
    elif action == 'tap': tap(args[0])
    elif action == 'swipe-up':
        capture.focus(); sh('input swipe 720 2300 720 1300 400'); time.sleep(1.5)
    elif action == 'shot': shot(args[0])
    elif action == 'rows':
        value = device.rows(); (DEVICE / f'shipped-rows-{args[0]}.txt').write_text(f'{value}\n'); print(value)
    elif action == 'board': board(args[0], args[1])
    else: raise SystemExit('unknown action ' + action)
