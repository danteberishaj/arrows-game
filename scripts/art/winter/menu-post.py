#!/usr/bin/env python3
"""WINTER-01: turn the Blender layers into app assets.

  /usr/bin/python3 scripts/art/winter/menu-post.py
Reads artifacts/WINTER-01/concepts/menu3d/{garland,snowscape,boardground}-{day,night}.png (scripts/art/winter/menu.py),
adds a soft halo under bright light sources (Blender's glare does not survive a transparent film), writes
assets/images/winter/<layer>-<day|night>.webp, plus specks.webp (static snow specks, board variant B).
Exits non-zero if an input is missing.
"""
import pathlib
import random
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFilter

SRC = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'artifacts/WINTER-01/concepts/menu3d')
OUT = pathlib.Path('assets/images/winter')
LAYERS = ('garland', 'snowscape', 'boardground')


def glow_layer(img, threshold, radius, strength):
    """Only the glow (no base): the app fades it in and out on the night garland for a slow twinkle."""
    r, g, b, a = img.split()
    hi = Image.merge('RGB', (r, g, b)).convert('HSV')
    _, s, v = hi.split()
    mask = ImageChops.multiply(v.point(lambda x: 255 if x > threshold else 0), s.point(lambda x: 255 if x > 70 else 0))
    mask = ImageChops.multiply(mask, a)
    glow = Image.merge('RGBA', (r, g, b, mask.point(lambda x: int(x * strength)))).filter(ImageFilter.GaussianBlur(radius))
    out = Image.new('RGBA', img.size, (0, 0, 0, 0))
    out.alpha_composite(glow)
    out.alpha_composite(glow.filter(ImageFilter.GaussianBlur(radius * .4)))
    return out


def halo(img, threshold, radius, strength):
    """Glow from bright, saturated pixels (bulbs, fairy lights, the star), blurred and placed under the layer."""
    r, g, b, a = img.split()
    hi = Image.merge('RGB', (r, g, b)).convert('HSV')
    _, s, v = hi.split()
    mask = ImageChops.multiply(v.point(lambda x: 255 if x > threshold else 0), s.point(lambda x: 255 if x > 70 else 0))
    mask = ImageChops.multiply(mask, a)
    glow = Image.merge('RGBA', (r, g, b, mask.point(lambda x: int(x * strength))))
    glow = glow.filter(ImageFilter.GaussianBlur(radius))
    out = Image.new('RGBA', img.size, (0, 0, 0, 0))
    out.alpha_composite(glow)
    out.alpha_composite(glow.filter(ImageFilter.GaussianBlur(radius * .4)))
    out.alpha_composite(img)
    return out


def specks(w=1440, h=2880, n=70):
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rng = random.Random(9)
    for _ in range(n):
        x, y, r = rng.uniform(0, w), rng.uniform(0, h * .85), rng.choice((3, 4, 5, 6))
        d.ellipse((x - r * 2.2, y - r * 2.2, x + r * 2.2, y + r * 2.2), fill=(255, 255, 255, 28))
        d.ellipse((x - r, y - r, x + r, y + r), fill=(255, 255, 255, 190))
    return img.filter(ImageFilter.GaussianBlur(.8))


def main():
    missing = [f'{l}-{t}.png' for l in LAYERS for t in ('day', 'night') if not (SRC / f'{l}-{t}.png').exists()]
    if missing:
        sys.exit('missing: ' + ', '.join(missing))
    OUT.mkdir(parents=True, exist_ok=True)
    for layer in LAYERS:
        for t in ('day', 'night'):
            img = Image.open(SRC / f'{layer}-{t}.png').convert('RGBA')
            if layer == 'garland' and t == 'night':
                glow = glow_layer(img, 120, 26, 1.0)
                gpath = OUT / 'garland-glow-night.webp'
                glow.save(gpath, 'WEBP', quality=80, method=6)
                print('WROTE', gpath, f'{gpath.stat().st_size // 1024} KB')
            elif layer != 'boardground':
                img = halo(img, 150 if t == 'night' else 185, 22 if layer == 'garland' else 12, .85 if t == 'night' else .5)
            path = OUT / f'{layer}-{t}.webp'
            img.save(path, 'WEBP', quality=86, method=6)
            print('WROTE', path, img.size, f'{path.stat().st_size // 1024} KB')
    path = OUT / 'specks.webp'
    specks().save(path, 'WEBP', quality=80, method=6)
    print('WROTE', path, f'{path.stat().st_size // 1024} KB')


main()
