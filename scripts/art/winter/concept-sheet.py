#!/usr/bin/env python3
"""WINTER-01 owner concept sheet: Blender hero renders beside the existing skins.

Run with a Python that has Pillow (here /usr/bin/python3):
  /usr/bin/python3 scripts/art/winter/concept-sheet.py
Reads artifacts/WINTER-01/concepts/hero/<skin>-<theme>.png (scripts/art/winter/hero.py) and writes
artifacts/WINTER-01/concepts/owner-sheet.png. Exits non-zero if any render is missing.
"""
import pathlib
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path('artifacts/WINTER-01/concepts')
HERO = ROOT / 'hero'
BRIEF = pathlib.Path('docs/briefs/NEW-YEAR-01-package/previews')
STORE = pathlib.Path('store/screenshots/play-v2-ink-night/05-unlock-cute-styles.png')
FONTS = '/System/Library/Fonts/Supplemental/'
TITLE = ImageFont.truetype(FONTS + 'Arial Bold.ttf', 54)
HEAD = ImageFont.truetype(FONTS + 'Arial Bold.ttf', 34)
BODY = ImageFont.truetype(FONTS + 'Arial.ttf', 24)
INK, DIM = '#191724', '#5B5670'

# (skin, title, how the flat in-game port gets this look from existing SkinSpec layers)
ROWS = [
    ('New Year · Dec 1 – Jan 15', [
        ('frosted-glass', 'Frosted Glass', 'ice body, white centre shine + head oval, lavender rim'),
        ('golden-ribbon', 'Golden Ribbon', 'nested gold bands fake the round satin; cream ribbon + oval'),
        ('confetti', 'Confetti', 'lavender candy body, two rows of gold/mint spots, plain head'),
    ]),
    ('Winter · Dec 1 – Feb 28 · white snow exit burst', [
        ('snowman-a', 'Snowman A', 'snowball beads, coal eyes, pink cheeks, smile on the head'),
        ('snowman-b', 'Snowman B', 'smooth snow tube, same face'),
        ('snowfall-night', 'Snowfall A', 'night-blue body, white snowflake spots in two sizes'),
        ('snowy-pine', 'Snowfall B', 'pine-green body, white snowflake spots'),
    ]),
]
LABEL_W, CELL_W, PAD = 420, 880, 24


def fit(img, width):
    return img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)


def main():
    missing = [f'{s}-{t}.png' for _, rows in ROWS for s, _, _ in rows for t in ('light', 'dark')
               if not (HERO / f'{s}-{t}.png').exists()]
    if missing:
        sys.exit('missing renders: ' + ', '.join(missing))
    sample = fit(Image.open(HERO / 'confetti-light.png'), CELL_W)
    row_h = sample.height + PAD
    width = LABEL_W + 2 * CELL_W + 3 * PAD
    store = Image.open(STORE).crop((220, 660, 960, 1110))  # board area of the real in-game capture
    store = fit(store, 620)
    codex = [fit(Image.open(BRIEF / f'{n}-30px-review.png'), 520) for n in ('frosted-glass', 'golden-ribbon', 'confetti')]
    ref_h = max(store.height, max(c.height for c in codex)) + 70
    n_rows = sum(len(r) for _, r in ROWS)
    height = 130 + ref_h + len(ROWS) * 100 + n_rows * row_h + 60 + 60
    sheet = Image.new('RGB', (width, height), 'white')
    draw = ImageDraw.Draw(sheet)
    draw.text((PAD, 30), 'WINTER-01 · Blender hero concepts for New Year + snow skins', font=TITLE, fill=INK)
    y = 120
    draw.text((PAD, y), 'Today, real in-game: Critter (Play screenshot crop)',
              font=BODY, fill=DIM)
    draw.text((PAD + 660, y), 'Earlier flat Codex concepts (NEW-YEAR-01, 2026-10-25)', font=BODY, fill=DIM)
    sheet.paste(store, (PAD, y + 40))
    for i, c in enumerate(codex):
        sheet.paste(c, (PAD + 660 + i * (c.width + 12), y + 40))
    y += ref_h + 20
    for section, rows in ROWS:
        draw.text((PAD, y), section, font=HEAD, fill=INK)
        y += 52
        draw.text((LABEL_W + PAD * 2, y), 'light board', font=BODY, fill=DIM)
        draw.text((LABEL_W + CELL_W + PAD * 3, y), 'dark board', font=BODY, fill=DIM)
        y += 38
        for skin, title, port in rows:
            draw.text((PAD, y + 20), title, font=HEAD, fill=INK)
            words, line, ly = port.split(), '', y + 76
            for w in words:  # wrap the port note into the label column
                if draw.textlength(line + ' ' + w, font=BODY) > LABEL_W - PAD:
                    draw.text((PAD, ly), line.strip(), font=BODY, fill=DIM)
                    line, ly = '', ly + 32
                line += ' ' + w
            draw.text((PAD, ly), line.strip(), font=BODY, fill=DIM)
            for i, theme in enumerate(('light', 'dark')):
                sheet.paste(fit(Image.open(HERO / f'{skin}-{theme}.png'), CELL_W), (LABEL_W + PAD * (2 + i) + i * CELL_W, y))
            y += row_h
        y += 10
    draw.text((PAD, y + 10), 'Concept renders, not the game. The shipped skins are flat vector art drawn from these looks '
              '(notes on the left); in-game screenshots follow after you pick.', font=BODY, fill=DIM)
    out = ROOT / 'owner-sheet.png'
    sheet.save(out, optimize=True)
    print('WROTE', out, sheet.size)


main()
