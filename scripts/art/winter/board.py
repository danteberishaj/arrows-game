"""WINTER-01 snowy-board concepts: a portrait play area (9x15 cells) of Snowman A / Snowfall A arrows.

Variants: plain (today's flat tint), ground (snow drift along the bottom + icy tint), snowy (ground + frosted top
corners + snow-dusted grid dots + still snow specks). Concept art only; the shipped board is drawn flat, behind arrows.

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python scripts/art/winter/board.py -- \
      --out artifacts/WINTER-01/concepts/board [--skins snowman-a] [--variants ground] [--themes light] [--samples 32]
"""
import os
import random
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hero  # noqa: E402  (shared arrow builder + materials)

ICY = {'light': '#EEF4FB', 'dark': '#121A2B'}  # candidate winter tints; contrast audit decides
ARROWS = [
    ([(0.5, 14.5), (0.5, 13.5)], (0, -1)),
    ([(1.5, 13.5), (2.5, 13.5), (3.5, 13.5)], (1, 0)),
    ([(8.5, 14.5), (7.5, 14.5)], (-1, 0)),
    ([(5.5, 13.5), (5.5, 12.5), (6.5, 12.5), (7.5, 12.5)], (1, 0)),
    ([(0.5, 11.5), (0.5, 10.5), (0.5, 9.5)], (0, -1)),
    ([(2.5, 11.5), (3.5, 11.5), (3.5, 10.5)], (0, -1)),
    ([(4.5, 10.5)], (-1, 0)),
    ([(6.5, 10.5), (6.5, 9.5), (6.5, 8.5), (7.5, 8.5)], (1, 0)),
    ([(1.5, 8.5), (2.5, 8.5), (3.5, 8.5), (4.5, 8.5)], (1, 0)),
    ([(8.5, 6.5), (7.5, 6.5), (6.5, 6.5)], (-1, 0)),
    ([(1.5, 6.5), (1.5, 5.5), (2.5, 5.5), (3.5, 5.5)], (1, 0)),
    ([(5.5, 5.5), (5.5, 4.5), (5.5, 3.5)], (0, -1)),
    ([(0.5, 3.5), (1.5, 3.5)], (1, 0)),
    ([(7.5, 4.5)], (0, 1)),
    ([(6.5, 1.5), (7.5, 1.5), (7.5, 0.5)], (0, -1)),
    ([(1.5, 1.5), (2.5, 1.5), (3.5, 1.5), (3.5, 0.5)], (0, -1)),
]


def drift(name, balls, mat):
    """Soft snow mound from metaballs; flattened so its top stays below the arrows."""
    mb = bpy.data.metaballs.new(name)
    mb.resolution = .08
    mb.render_resolution = .05
    for x, y, r in balls:
        el = mb.elements.new()
        el.co = (x, y, 0)
        el.radius = r
    obj = hero.link(bpy.data.objects.new(name, mb))
    obj.scale.z = .3
    obj.location.z = -.05
    obj.data.materials.append(mat)
    return obj


def build(skin, variant, theme):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    hero.SKINS[skin]['burst'] = False  # the burst is an exit effect, not part of a resting board
    mats = hero.make_mats(skin)
    tint = hero.BOARDS[theme] if variant == 'plain' else ICY[theme]
    bpy.ops.mesh.primitive_cube_add(size=1, location=(4.5, 7.5, -.1))
    slab = bpy.context.active_object
    slab.scale = (9.4, 15.4, .2)
    bpy.ops.object.transform_apply(scale=True)  # so the bevel is an absolute .25, not scaled into a pill
    bev = slab.modifiers.new('bevel', 'BEVEL')
    bev.width, bev.segments = .25, 6
    slab.data.materials.append(hero.principled('board', tint, **{'Roughness': .7}))
    snow = hero.principled('drift', '#F8FBFF' if theme == 'light' else '#DCE7F5',
                           **{'Roughness': .65, 'Subsurface Weight': .4, 'bump': (120, .35)})
    rng = random.Random(7)
    dusted = variant == 'snowy'
    dot_col = ('#FFFFFF' if theme == 'light' else '#C9D8EE') if dusted else ('#C9CCE0' if theme == 'light' else '#2C2838')
    dot = hero.principled('grid', dot_col, **{'Roughness': .6})
    for x in range(10):
        for y in range(16):
            hero.sphere((x, y), .05 if dusted else .035, 0, dot, f'grid{x}-{y}', (1, 1, .3))
    if variant in ('ground', 'snowy'):
        balls = [(x * .4 - .1, rng.uniform(.05, .6), rng.uniform(.7, 1.05)) for x in range(25)]
        drift('ground', balls, snow)
    if dusted:
        for cx, cy in ((-.1, 15.1), (9.1, 15.1)):  # frosted top corners
            drift(f'corner{cx}', [(cx + rng.uniform(-.2, .6) * (1 if cx < 1 else -1), cy - rng.uniform(.1, .8), rng.uniform(.6, .9))
                                  for _ in range(7)], snow)
        speck = hero.principled('speck', '#FFFFFF', **{'Roughness': .5, 'Emission Color': '#FFFFFF',
                                                       'Emission Strength': .15})
        for k in range(45):
            hero.sphere((rng.uniform(.2, 8.8), rng.uniform(1.5, 14.8)), rng.choice((.025, .035, .045)), .02, speck,
                        f'speck{k}', (1, 1, .4))
    for i, (cells, d) in enumerate(ARROWS):
        hero.arrow(cells, d, skin, mats, f'a{i}')
    hero.setup_render(theme, (4.5, 7.5), (4.5, 3.5, 18), 16.6, 900, 1600, world_light='#DDE3EE', world_dark='#0D0B14')


def main():
    out = os.path.abspath(hero.arg('--out', 'artifacts/WINTER-01/concepts/board'))
    os.makedirs(out, exist_ok=True)
    for skin in hero.arg('--skins', 'snowman-a,snowfall-night').split(','):
        for variant in hero.arg('--variants', 'plain,ground,snowy').split(','):
            for theme in hero.arg('--themes', 'light,dark').split(','):
                build(skin, variant, theme)
                path = os.path.join(out, f'{skin}-{variant}-{theme}.png')
                bpy.context.scene.render.filepath = path
                bpy.ops.render.render(write_still=True)
                print('RENDERED', path, flush=True)
    print('DONE', flush=True)


try:
    main()
except Exception as exc:
    print('FAILED', repr(exc), flush=True)
    raise
