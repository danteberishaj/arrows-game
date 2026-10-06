#!/usr/bin/env python3
"""HALLOWEEN-PLUS owner sheets from the real-viewport emulator captures (unresized crops at 29.39 dp / 3.5 density)
and the native-Canvas contract renders. Writes, under artifacts/HALLOWEEN-PLUS/:
  owner-sheet.png              one row per candidate (A/B/C: small board light | dark), main variant's blocked + exit
                               frames, then "the pack together" (all six beside Pumpkin, Ghost and Candy Corn)
  screens/sheet-<candidate>.png every variant x {small, long, dense} x {light, dark}, full viewport (half size)
  screens/sheet-pack-dense.png  the dense board (3827) for all ten specs, light and dark
  screens/sheet-native.png      native-Canvas 38 dp fixture (long, bent and one-cell arrows) for all ten specs
  screens/sheet-manifest.json   every input file with its sha256 and crop box"""
import hashlib
import json
import pathlib

from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path('artifacts/HALLOWEEN-PLUS')
DEV = ROOT / 'screens' / 'device'
NATIVE = ROOT / 'screens' / 'native'
FONT = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 34)
SMALL = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 26)
TITLE = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 52)
BG, INK, DIM = '#FFFFFF', '#191724', '#5B5670'
CANDIDATES = {
    'mummy': [('mummy-a', 'A · tight wraps (every .20 cell)'), ('mummy-b', 'B · looser layered wraps (.35 + .23)')],
    'potion-slime': [('potion-slime-a', 'A · lime, outer soft halo'), ('potion-slime-b', 'B · lime, inner glow core'),
                     ('potion-slime-c', 'C · mint, outer soft halo')],
    'little-bat': [('little-bat-a', 'A · sleepy eyes + white fangs (blush field)'), ('little-bat-b', 'B · sleepy eyes + pink cheeks')],
}
TITLES = {'mummy': 'Mummy', 'potion-slime': 'Potion Slime', 'little-bat': 'Little Bat'}
PACK = [('pumpkin', 'Pumpkin (18)'), ('ghost', 'Ghost (19)'), ('candy-corn', 'Candy Corn (20)')]
manifest = {'screenCellDp': 29.387754, 'density': 3.5, 'resized': {}, 'inputs': []}
captures = {}
for line in (ROOT / 'device' / 'captures.jsonl').read_text().splitlines():
    record = json.loads(line)
    if 'file' in record:
        captures[pathlib.Path(record['file']).name] = record


def load(path, box=None):
    path = pathlib.Path(path)
    image = Image.open(path).convert('RGB')
    manifest['inputs'].append({'file': str(path), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'box': box})
    return image.crop(box) if box else image


def centre_box(name, cells_w=6.0, cells_h=6.0, dx=0.0, dy=0.0):
    """A crop of the board viewport centred on the viewport centre (+dx/dy cells), from the logged camera."""
    cam = captures[name]['camera']; cell = cam['cellDp'] * 3.5
    x0, y0 = cam['originPx']; cx = x0 + cam['vw'] * 3.5 / 2 + dx * cell; cy = y0 + cam['vh'] * 3.5 / 2 + dy * cell
    return tuple(int(round(v)) for v in (cx - cells_w * cell / 2, cy - cells_h * cell / 2, cx + cells_w * cell / 2, cy + cells_h * cell / 2))


def labelled(image, text, sub=None):
    pad = 56 if sub is None else 90
    tile = Image.new('RGB', (image.width, image.height + pad), BG)
    tile.paste(image, (0, pad)); draw = ImageDraw.Draw(tile)
    draw.text((6, 4), text, font=FONT, fill=INK)
    if sub: draw.text((6, 48), sub, font=SMALL, fill=DIM)
    return tile


def row(tiles, gap=24):
    width = sum(t.width for t in tiles) + gap * (len(tiles) - 1); height = max(t.height for t in tiles)
    out = Image.new('RGB', (width, height), BG); x = 0
    for t in tiles:
        out.paste(t, (x, 0)); x += t.width + gap
    return out


def stack(rows, titles, gap=40, margin=40, header=None):
    width = max(r.width for r in rows) + 2 * margin
    head = 0 if header is None else 120
    height = head + sum(r.height + 80 for r in rows) + gap * len(rows) + margin
    out = Image.new('RGB', (width, height), BG); draw = ImageDraw.Draw(out); y = margin
    if header:
        draw.text((margin, y), header[0], font=TITLE, fill=INK); draw.text((margin, y + 62), header[1], font=SMALL, fill=DIM); y += head
    for r, t in zip(rows, titles):
        draw.text((margin, y), t, font=TITLE, fill=INK); y += 80
        out.paste(r, (margin, y)); y += r.height + gap
        draw.line((margin, y - gap // 2, width - margin, y - gap // 2), fill='#DDD8EA', width=3)
    return out


def motion_tile(key, kind, suffix):
    path = DEV / f'{key}-{kind}-{suffix}-crop.png'
    return load(path) if path.exists() else None


# ---- owner-sheet.png
rows, titles = [], []
for cand, variants in CANDIDATES.items():
    tiles = []
    for key, note in variants:
        for theme in ('light', 'dark'):
            name = f'{key}-small-{theme}.png'
            tiles.append(labelled(load(DEV / name, centre_box(name)), f'{note.split(" · ")[0]} · {theme}', note.split(' · ')[1]))
    main = variants[0][0]
    for kind, suffix, text in [('blocked', 'peak', 'blocked tap (closed eyes)'), ('exit', 'pick', 'exit')]:
        tile = motion_tile(main, kind, suffix)
        if tile is not None:
            if kind == 'exit':
                tile = tile.resize((tile.width * 2 // 3, tile.height * 2 // 3)); size = 'light · mid-exit · 2/3'
            else:
                size = 'light · unresized'
            tiles.append(labelled(tile, f'{variants[0][1].split(" · ")[0]} · {text}', size))
    rows.append(row(tiles)); titles.append(TITLES[cand])
pack_tiles = []
for theme in ('light', 'dark'):
    for key, text in PACK + [(CANDIDATES[c][0][0], f'{TITLES[c]} A') for c in CANDIDATES]:
        name = f'{key}-small-{theme}.png'
        pack_tiles.append(labelled(load(DEV / name, centre_box(name, 4.5, 4.5)), text, theme))
rows.append(Image.new('RGB', (1, 1), BG)); titles.append('')  # placeholder replaced below
half = len(pack_tiles) // 2
rows[-1] = Image.new('RGB', (row(pack_tiles[:half]).width, row(pack_tiles[:half]).height * 2 + 24), BG)
rows[-1].paste(row(pack_tiles[:half]), (0, 0)); rows[-1].paste(row(pack_tiles[half:]), (0, row(pack_tiles[:half]).height + 24))
titles[-1] = 'The pack together · Pumpkin, Ghost, Candy Corn + the three A variants (same board, same crop)'
sheet = stack(rows, titles, header=('HALLOWEEN-PLUS concepts · owner pick sheet (2026-10-06)',
              'Real Android viewport, emulator-5556, level 13 (index 12) opening camera, 29.39 dp cells, unresized crops unless noted. '
              'Board tints #F3EEFA / #221A36. Concept only: nothing is registered.'))
sheet.save(ROOT / 'owner-sheet.png'); manifest['resized']['owner-sheet motion tiles'] = '2/3'

# ---- per-candidate full matrices (half size)
for cand, variants in CANDIDATES.items():
    rows, titles = [], []
    for key, note in variants:
        tiles = []
        for board in ('small', 'long', 'dense'):
            for theme in ('light', 'dark'):
                img = load(DEV / f'{key}-{board}-{theme}.png')
                tiles.append(labelled(img.resize((img.width // 2, img.height // 2)), f'{board} · {theme}'))
        rows.append(row(tiles)); titles.append(f'{TITLES[cand]} {note}')
    for key, text in PACK:
        tiles = []
        for board in ('small', 'long', 'dense'):
            for theme in ('light', 'dark'):
                img = load(DEV / f'{key}-{board}-{theme}.png')
                tiles.append(labelled(img.resize((img.width // 2, img.height // 2)), f'{board} · {theme}'))
        rows.append(row(tiles)); titles.append(f'reference: {text}')
    stack(rows, titles, header=(f'{TITLES[cand]} · all boards', 'small = level 13 (index 12), long = index 504 (18-cell arrows), '
          'dense = index 3827 (250 arrows); full viewport at half size')).save(ROOT / 'screens' / f'sheet-{cand}.png')

# ---- dense board, all ten
keys = [k for c in CANDIDATES.values() for k, _ in c] + [k for k, _ in PACK]
rows, titles = [], []
for theme in ('light', 'dark'):
    tiles = [labelled(load(DEV / f'{k}-dense-{theme}.png', centre_box(f'{k}-dense-{theme}.png', 7, 9)), k) for k in keys]
    rows.append(row(tiles[:5])); rows.append(row(tiles[5:])); titles += [f'dense (3827) · {theme}', '']
stack(rows, titles, header=('Dense board, all ten specs', '7 x 9 cells from the centre of the opening viewport, unresized')).save(ROOT / 'screens' / 'sheet-pack-dense.png')

# ---- native canvas fixture (one-cell, long and bent arrows)
if NATIVE.exists():
    rows, titles = [], []
    for theme in ('light', 'dark'):
        tiles = [labelled(load(NATIVE / f'art07-after-{k}-{theme}-fixture.png'), k) for k in keys if (NATIVE / f'art07-after-{k}-{theme}-fixture.png').exists()]
        if tiles:
            rows.append(row(tiles[:5])); titles.append(f'native Canvas 38 dp fixture · {theme}')
            if tiles[5:]: rows.append(row(tiles[5:])); titles.append('')
    if rows:
        stack(rows, titles, header=('Native-Canvas fixture (contract APK)', '6-cell, 2/3/4-cell, bent 5-cell and four one-cell arrows (bottom row), '
              'every direction; SkinPaths with the real spec JSON, density 3.5, unresized')).save(ROOT / 'screens' / 'sheet-native.png')
(ROOT / 'screens' / 'sheet-manifest.json').write_text(json.dumps(manifest, indent=1) + '\n')
print('sheets written;', len(manifest['inputs']), 'inputs')
