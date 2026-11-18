#!/usr/bin/env python3
"""WINTER-01 Christmas menu concepts drawn over the committed menu screenshots (Oct 6 base; the live menu has since
gained Daily/Gallery entries). Flat vector shapes only, so the look can ship as react-native-svg.

  /usr/bin/python3 scripts/art/winter/menu-mock.py   -> artifacts/WINTER-01/concepts/menu/<variant>-<theme>.png
Variants: lights (warm bulb garland along the top + snow cap on Play), hill (snowy hill with pines at the bottom +
still snowflakes).
"""
import math
import pathlib
import random

from PIL import Image, ImageDraw, ImageFilter

BASE = {'light': 'store/screenshots/set-a-default/01-menu-daylight-af9a4467.png',
        'dark': 'store/screenshots/set-a-default/07-menu-inknight-af9a4467.png'}
OUT = pathlib.Path('artifacts/WINTER-01/concepts/menu')
PLAY = (278, 1685, 1162, 1925)  # Play button box in the 1440x2880 capture
BULBS = ['#E5484D', '#FFC94A', '#3FB67A', '#5BA8F5']
SS = 2  # supersample for smooth edges


def snowflake(d, cx, cy, r, colour, width):
    for k in range(6):
        a = math.radians(k * 60 + 90)
        x, y = cx + r * math.cos(a), cy + r * math.sin(a)
        d.line((cx, cy, x, y), fill=colour, width=width)
        for side in (-1, 1):  # small barbs
            bx, by = cx + r * .6 * math.cos(a), cy + r * .6 * math.sin(a)
            b = a + side * math.radians(40)
            d.line((bx, by, bx + r * .3 * math.cos(b), by + r * .3 * math.sin(b)), fill=colour, width=width)


def snow_cap(d, box, colour, shade):
    x0, y0, x1, _ = box
    h = 56
    pts = [(x0 + 60, y0 + 30)]
    for i in range(13):  # wavy drips along the top edge of the pill
        x = x0 + 60 + (x1 - x0 - 120) * i / 12
        pts.append((x, y0 + (34 if i % 2 else 58) + (8 if i % 3 == 0 else 0)))
    pts += [(x1 - 60, y0 + 30), (x1 - 120, y0 - h * .55), (x0 + 120, y0 - h * .55)]
    d.polygon([(x * SS, y * SS) for x, y in pts], fill=shade)
    d.polygon([(x * SS, (y - 8) * SS) for x, y in pts], fill=colour)


def lights(img, theme):
    w, _ = img.size
    glow = Image.new('RGBA', (w * SS, img.size[1] * SS), (0, 0, 0, 0))
    g = ImageDraw.Draw(glow)
    top = Image.new('RGBA', glow.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(top)
    wire = '#2E5E3E' if theme == 'light' else '#7FA88A'
    pts = []
    for span in range(3):  # three sagging scallops across the top
        x0, x1 = -20 + span * 495, -20 + (span + 1) * 495
        for i in range(31):
            t = i / 30
            pts.append((x0 + (x1 - x0) * t, 330 + 90 * math.sin(math.pi * t)))
    d.line([(x * SS, y * SS) for x, y in pts], fill=wire, width=5 * SS, joint='curve')
    for k, idx in enumerate(range(4, len(pts), 8)):
        x, y = pts[idx]
        c = BULBS[k % 4]
        g.ellipse(((x - 46) * SS, (y + 10 - 46) * SS, (x + 46) * SS, (y + 10 + 46) * SS), fill=c + ('70' if theme == 'dark' else '40'))
        d.rounded_rectangle(((x - 9) * SS, (y - 6) * SS, (x + 9) * SS, (y + 10) * SS), 3 * SS, fill='#8A8F99')
        d.ellipse(((x - 17) * SS, (y + 6) * SS, (x + 17) * SS, (y + 48) * SS), fill=c)
        d.ellipse(((x - 9) * SS, (y + 14) * SS, (x - 2) * SS, (y + 26) * SS), fill='#FFFFFFAA')
    glow = glow.filter(ImageFilter.GaussianBlur(18 * SS))
    snow_cap(d, PLAY, '#FFFFFF' if theme == 'light' else '#EEF4FB', '#C9D8EE')
    return glow, top


def hill(img, theme):
    w, h = img.size
    top = Image.new('RGBA', (w * SS, h * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(top)
    rng = random.Random(3)
    flake = '#B9CBE6' if theme == 'light' else '#FFFFFF99'
    for _ in range(16):  # still snowflakes in the empty upper half
        x, y = rng.uniform(80, w - 80), rng.uniform(380, 1250)
        if 330 < x < 1110 and 940 < y < 1250:
            continue  # keep the logo/level text clear
        snowflake(d, x * SS, y * SS, rng.choice((14, 20, 26)) * SS, flake, 3 * SS)
    back = '#E3ECF8' if theme == 'light' else '#2A3550'
    front = '#F7FAFF' if theme == 'light' else '#3A4868'
    d.ellipse((-300 * SS, 2640 * SS, 900 * SS, 3500 * SS), fill=back)
    d.ellipse((500 * SS, 2680 * SS, 1800 * SS, 3550 * SS), fill=back)
    for x, base, s in ((260, 2700, .8), (1180, 2735, .7), (1270, 2760, .5)):  # small pines on the far hill
        pine = '#3F8A63' if theme == 'light' else '#5FA982'
        for tier in range(3):
            tw, ty = (90 - tier * 22) * s, base - tier * 55 * s
            d.polygon([((x - tw) * SS, ty * SS), ((x + tw) * SS, ty * SS), (x * SS, (ty - 95 * s) * SS)], fill=pine)
            d.polygon([((x - tw * .6) * SS, (ty - 20 * s) * SS), ((x + tw * .6) * SS, (ty - 20 * s) * SS),
                       (x * SS, (ty - 95 * s) * SS)], fill='#FFFFFF66')
    d.ellipse((-400 * SS, 2760 * SS, 1100 * SS, 3700 * SS), fill=front)
    d.ellipse((400 * SS, 2790 * SS, 2000 * SS, 3800 * SS), fill=front)
    return None, top


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for theme, path in BASE.items():
        base = Image.open(path).convert('RGBA')
        for name, fn in (('lights', lights), ('hill', hill)):
            glow, top = fn(base, theme)
            big = base.resize((base.width * SS, base.height * SS))
            if glow is not None:
                big = Image.alpha_composite(big, glow)
            big = Image.alpha_composite(big, top)
            out = OUT / f'{name}-{theme}.png'
            big.resize(base.size, Image.LANCZOS).convert('RGB').save(out)
            print('WROTE', out)


main()
