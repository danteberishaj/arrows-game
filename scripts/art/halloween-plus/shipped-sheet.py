#!/usr/bin/env python3
"""HALLOWEEN-PLUS shipped owner sheet (2026-10-07) from the real emulator-5556 captures in screens/shipped/.
Writes artifacts/HALLOWEEN-PLUS/shipped-sheet.png and screens/shipped/sheet-manifest.json (input sha256 + scale).
Row 1: the book flow (Halloween section, Mummy confirm, bought, after "Use it now"), half size.
Row 2: Mummy and Potion Slime boards, light and dark, half size.
Row 3: unresized 640 x 640 px crops from the centre of each board's play area (29.39 dp cells, density 3.5)."""
import hashlib
import json
import pathlib

from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path('artifacts/HALLOWEEN-PLUS')
SHOTS = ROOT / 'screens' / 'shipped'
FONT = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 30)
SMALL = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 24)
TITLE = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 48)
BOOK = [('01-book-halloween-section', 'Book: Halloween section (5 styles, 20 petals)'), ('02-mummy-confirm', 'Mummy: buy for 20 petals'),
        ('03-mummy-bought', 'Bought with petals'), ('04-use-it-now', 'After "Use it now"')]
BOARDS = [('board-mummy-light', 'Mummy · light (#F3EEFA)'), ('board-mummy-dark', 'Mummy · dark (#221A36)'),
          ('board-potion-slime-light', 'Potion Slime · light'), ('board-potion-slime-dark', 'Potion Slime · dark')]
pixels = {}
for line in (ROOT / 'device' / 'shipped-board-pixels.jsonl').read_text().splitlines():
    r = json.loads(line); pixels[f"board-{r['skin']}-{r['theme']}"] = r
manifest = {'inputs': [], 'scale': {'row1': .5, 'row2': .5, 'row3': 1}}


def load(name):
    path = SHOTS / f'{name}.png'
    manifest['inputs'].append({'file': str(path), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
    return Image.open(path).convert('RGB')


def labelled(img, text):
    pad = 46
    out = Image.new('RGB', (img.width, img.height + pad), 'white')
    out.paste(img, (0, pad)); ImageDraw.Draw(out).text((8, 8), text, font=FONT, fill='#191724')
    return out


def row(images, gap=24):
    w = sum(i.width for i in images) + gap * (len(images) - 1); h = max(i.height for i in images)
    out = Image.new('RGB', (w, h), 'white'); x = 0
    for i in images:
        out.paste(i, (x, 0)); x += i.width + gap
    return out


half = lambda img: img.resize((img.width // 2, img.height // 2), Image.LANCZOS)
r1 = row([labelled(half(load(n)), t) for n, t in BOOK])
r2 = row([labelled(half(load(n)), t) for n, t in BOARDS])
crops = []
for name, text in BOARDS:
    img = load(name); top = pixels[name]['boardTopPx']; cx = img.width // 2; cy = top + (img.height - top) // 2
    crops.append(labelled(img.crop((cx - 320, cy - 320, cx + 320, cy + 320)), text + ' · 1:1'))
r3 = row(crops)
rows = [r1, r2, r3]
header = ['HALLOWEEN-PLUS shipped · Mummy (21) and Potion Slime (22) · emulator-5556, 2026-10-07',
          'Real app, registered skins (no override). Rows 1-2 half size; row 3 unresized 640 px crops (29.39 dp cells).']
W = max(r.width for r in rows) + 48
H = 150 + sum(r.height + 40 for r in rows)
sheet = Image.new('RGB', (W, H), 'white'); d = ImageDraw.Draw(sheet)
d.text((24, 20), header[0], font=TITLE, fill='#191724'); d.text((24, 88), header[1], font=SMALL, fill='#5B5670')
y = 150
for r in rows:
    sheet.paste(r, (24, y)); y += r.height + 40
sheet.save(ROOT / 'shipped-sheet.png')
manifest['output'] = {'file': str(ROOT / 'shipped-sheet.png'), 'size': sheet.size,
                      'sha256': hashlib.sha256((ROOT / 'shipped-sheet.png').read_bytes()).hexdigest()}
(SHOTS / 'sheet-manifest.json').write_text(json.dumps(manifest, indent=1) + '\n')
print(manifest['output'])
