"""WINTER-01 hero concept renders (Blender 5.2, headless, Cycles).

Concept art only: the shipped skins are flat procedural SkinSpecs. These renders set the look the port aims at.
Layout matches the NEW-YEAR-01 concept sheets: an 8x4-cell board, a 4-cell straight pointing right, a rounded L
ending down, a one-cell head pointing left. Proportions follow the launch recipe (.48 rim / .425 body, .44 head).

Run (outside the Claude sandbox: Metal device detection is denied inside it):
  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python scripts/art/winter/hero.py -- \
      --out artifacts/WINTER-01/concepts/hero [--skins frosted-glass,snowman-a] [--themes light,dark] [--samples 48]
"""
import math
import os
import sys

import bpy
from mathutils import Vector

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []


def arg(name, default):
    return ARGS[ARGS.index(name) + 1] if name in ARGS else default


BOARDS = {'light': '#F3F6FF', 'dark': '#13111C'}  # NEW-YEAR-01 shared starting tints
BODY_R, RIM_R = .2125, .24  # .425 body / .48 rim, in cells

# Each skin: rim colour, body recipe, extra decoration. 'kind' picks the geometry recipe.
SKINS = {
    'frosted-glass': dict(title='Frosted Glass', season='New Year', rim='#8C7BB5', body='frost', shine='#F7F4FF'),
    'golden-ribbon': dict(title='Golden Ribbon', season='New Year', rim='#9A633F', body='gold', ribbon='#FFF4D0'),
    'confetti': dict(title='Confetti', season='New Year', rim='#8068B8', body='candy:#B8A4EB',
                     dots=('#FFD24A', '#80C8BC')),
    'snowman-a': dict(title='Snowman A (snowball beads)', season='Winter', rim='#6E88A8', body='snow', beads=True,
                      face=True, burst=True),
    'snowman-b': dict(title='Snowman B (smooth snow)', season='Winter', rim='#6E88A8', body='snow', face=True,
                      burst=True),
    'snowfall-night': dict(title='Snowfall A (night sky)', season='Winter', rim='#5B7FB0', body='candy:#24345E',
                           flakes=True, burst=True),
    'snowy-pine': dict(title='Snowfall B (snowy pine)', season='Winter', rim='#4E8C6A', body='candy:#2B5E45',
                       flakes=True, burst=True),
}


def lin(hex_colour):
    h = hex_colour.lstrip('#')
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4)
    return (*out, 1)


def principled(name, colour, **inputs):
    mat = bpy.data.materials.new(name)
    tree = mat.node_tree
    bsdf = next(n for n in tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = lin(colour)
    for key, value in inputs.items():
        if key == 'bump':
            continue
        bsdf.inputs[key].default_value = lin(value) if isinstance(value, str) else value
    if 'bump' in inputs:  # fine noise: frost / snow sparkle
        scale, strength = inputs['bump']
        noise = tree.nodes.new('ShaderNodeTexNoise')
        noise.inputs['Scale'].default_value = scale
        noise.inputs['Detail'].default_value = 8
        bump = tree.nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = strength
        tree.links.new(noise.outputs['Fac'], bump.inputs['Height'])
        tree.links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    return mat


def body_material(recipe):
    if recipe == 'frost':
        return principled('frost', '#CFE6F7', **{'Roughness': .3, 'Transmission Weight': .12, 'Coat Weight': .6,
                                                  'Subsurface Weight': .45, 'bump': (90, .18)})
    if recipe == 'gold':
        return principled('gold', '#F4C967', **{'Metallic': .75, 'Roughness': .3, 'Coat Weight': .3})
    if recipe == 'snow':
        return principled('snow', '#F7FAFF', **{'Roughness': .6, 'Subsurface Weight': .35, 'bump': (140, .35)})
    return principled('candy', recipe.split(':')[1], **{'Roughness': .32, 'Coat Weight': 1, 'Coat Roughness': .08})


def snow_material():
    return principled('flake', '#FFFFFF', **{'Roughness': .5, 'Subsurface Weight': .3, 'bump': (160, .3),
                                             'Emission Color': '#FFFFFF', 'Emission Strength': .08})


def link(obj):
    bpy.context.scene.collection.objects.link(obj)
    return obj


def tube(points, radius, z, mat, name):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = radius
    curve.bevel_resolution = 10
    curve.use_fill_caps = True
    spline = curve.splines.new('POLY')
    spline.points.add(len(points) - 1)
    for p, q in zip(spline.points, points):
        p.co = (q[0], q[1], z, 1)
    obj = link(bpy.data.objects.new(name, curve))
    obj.data.materials.append(mat)
    for end in (points[0],):  # round tail cap (the head covers the other end)
        sphere(end, radius, z, mat, name + '-cap')
    return obj


def sphere(xy, radius, z, mat, name, squash=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, location=(xy[0], xy[1], z), segments=40, ring_count=20)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = squash
    bpy.ops.object.shade_smooth()
    obj.data.materials.append(mat)
    return obj


def filleted_path(cells, radius=.36, steps=10):
    """Cell centres -> polyline with rounded corners (the renderer's rounded centreline)."""
    pts = [Vector(c) for c in cells]
    out = [pts[0]]
    for a, b, c in zip(pts, pts[1:], pts[2:]):
        d1, d2 = (b - a).normalized(), (c - b).normalized()
        if abs(d1.dot(d2)) > .999:
            out.append(b)
            continue
        p0, p1 = b - d1 * radius, b + d2 * radius
        for i in range(steps + 1):  # quadratic Bezier through the corner
            t = i / steps
            out.append((1 - t) ** 2 * p0 + 2 * (1 - t) * t * b + t ** 2 * p1)
    out.append(pts[-1])
    return out


def rounded_triangle(centre, d, grow, z, depth, mat, name):
    """Directional head: back .30 behind the head-cell centre, tip .42 past it, half-width .44, .10 fillets."""
    d = Vector(d)
    n = Vector((-d.y, d.x))
    c = Vector(centre)
    corners = [c + d * (.42 + grow), c - d * (.30 + grow * .6) + n * (.44 + grow), c - d * (.30 + grow * .6) - n * (.44 + grow)]
    poly = []
    for i, p in enumerate(corners):
        prev, nxt = corners[i - 1], corners[(i + 1) % 3]
        a, b = p + (prev - p).normalized() * .14, p + (nxt - p).normalized() * .14
        for k in range(7):
            t = k / 6
            poly.append((1 - t) ** 2 * a + 2 * (1 - t) * t * p + t ** 2 * b)
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '2D'
    curve.fill_mode = 'BOTH'
    curve.extrude = depth
    curve.bevel_depth = depth * .9
    curve.bevel_resolution = 8
    spline = curve.splines.new('POLY')
    spline.points.add(len(poly) - 1)
    for p, q in zip(spline.points, poly):
        p.co = (q.x, q.y, 0, 1)
    spline.use_cyclic_u = True
    obj = link(bpy.data.objects.new(name, curve))
    obj.location.z = z
    obj.data.materials.append(mat)
    return obj


def sample(path, step):
    """Points every `step` along a polyline, with tangent."""
    out, carry = [], 0.0
    for a, b in zip(path, path[1:]):
        seg = (b - a).length
        if seg == 0:
            continue
        t = carry
        while t < seg:
            out.append((a + (b - a) * (t / seg), (b - a).normalized()))
            t += step
        carry = t - seg
    return out


def arrow(cells, head_dir, skin, mats, tag):
    s = SKINS[skin]
    head = Vector(cells[-1])
    d = Vector(head_dir)
    shaft = filleted_path(cells[:-1] + [tuple(head - d * .2)]) if len(cells) > 1 else None
    z_rim, z_body = .23, .25
    z_tube_rim = .13  # rim tube sits lower so the body covers its top and shows only as an outline ring
    if shaft:
        if s.get('beads'):
            for i, (p, _) in enumerate(sample(shaft, .3)):
                sphere(p, RIM_R + .025, z_rim - .05, mats['rim'], f'{tag}-rimbead{i}', (1, 1, .7))
                sphere(p, BODY_R + .04, z_body, mats['body'], f'{tag}-bead{i}', (1, 1, .75))
        else:
            tube(shaft, RIM_R + .012, z_tube_rim, mats['rim'], f'{tag}-rim')
            tube(shaft, BODY_R, z_body, mats['body'], f'{tag}-body')
        top = z_body + BODY_R * .92
        if s.get('shine'):
            tube(shaft[:-1] + [shaft[-1] - d * .1], .035, top, mats['shine'], f'{tag}-shine')
        if s.get('ribbon'):
            tube(shaft[:-1] + [shaft[-1] - d * .1], .07, top - .025, mats['ribbon'], f'{tag}-ribbon')
        if s.get('dots') or s.get('flakes'):
            for i, (p, t) in enumerate(sample(shaft, .27)):
                n = Vector((-t.y, t.x))
                side = 1 if i % 2 else -1
                if s.get('dots'):
                    sphere(p + n * .085 * side, .045, top - .01, mats['dot%d' % (i % 2)], f'{tag}-dot{i}', (1, 1, .45))
                else:
                    size = (.05, .035, .042)[i % 3]
                    sphere(p + n * .08 * side, size, top - .005, mats['flake'], f'{tag}-flake{i}', (1, 1, .6))
    rounded_triangle(head, d, .045, z_rim - .06, .1, mats['rim'], f'{tag}-headrim')
    rounded_triangle(head, d, 0, z_body - .06, .11, mats['body'], f'{tag}-head')
    head_top = z_body + .17
    if s.get('shine') or s.get('ribbon'):  # contained head oval on the shaft axis
        o = sphere(head - d * .02, .1, head_top, mats['shine' if s.get('shine') else 'ribbon'], f'{tag}-oval', (1, .55, .3))
        o.rotation_euler.z = math.atan2(d.y, d.x)
    if s.get('face'):  # upright face, like the game's head faces
        for x in (-.11, .11):
            sphere(head + Vector((x, .04)), .042, head_top + .01, mats['coal'], f'{tag}-eye{x}', (1, 1, .6))
            sphere(head + Vector((x * 1.55, -.06)), .05, head_top - .015, mats['cheek'], f'{tag}-cheek{x}', (1, .7, .3))
        for k in range(5):  # coal-dot smile
            a = math.radians(-150 + k * 30)
            sphere(head + Vector((.075 * math.cos(a), -.04 + .055 * math.sin(a))), .016, head_top, mats['coal'],
                   f'{tag}-smile{k}', (1, 1, .6))
    if s.get('burst') and len(cells) == 1:  # the exit burst: existing bounded particles, white + ice-blue (white alone vanishes on light boards)
        for k in range(16):
            ang = math.radians(k * 137.5)
            dist = .5 + .12 * (k % 4)
            p = head - d * (.55 + .25 * (k % 3)) + Vector((math.cos(ang), math.sin(ang))) * dist * .55
            sphere(p, .03 + .012 * (k % 3), .2 + .05 * (k % 2), mats['flake' if k % 2 else 'iceflake'], f'{tag}-burst{k}')


def make_mats(skin):
    s = SKINS[skin]
    return {
        'rim': principled('rim', s['rim'], **{'Roughness': .45}),
        'body': body_material(s['body']),
        'shine': principled('shine', s.get('shine', '#FFFFFF'), **{'Roughness': .2, 'Emission Color': s.get('shine', '#FFFFFF'),
                                                                     'Emission Strength': .25}),
        'ribbon': principled('ribbon', s.get('ribbon', '#FFFFFF'), **{'Roughness': .35, 'Sheen Weight': 1,
                                                                       'Sheen Tint': '#FFFFFF', 'Coat Weight': .4}),
        'dot0': principled('dot0', (s.get('dots') or ('#FFFFFF',))[0], **{'Metallic': .55, 'Roughness': .25}),
        'dot1': principled('dot1', (s.get('dots') or ('#FFFFFF', '#FFFFFF'))[1], **{'Roughness': .3, 'Coat Weight': 1}),
        'flake': snow_material(),
        'coal': principled('coal', '#22222A', **{'Roughness': .7}),
        'cheek': principled('cheek', '#F2A7B8', **{'Roughness': .6}),
        'iceflake': principled('iceflake', '#BFE3FF', **{'Roughness': .4, 'Emission Color': '#BFE3FF',
                                                          'Emission Strength': .1}),
    }


def setup_render(theme, centre, cam_loc, ortho, res_x, res_y, world_light='#E9ECF6', world_dark='#1A1726'):
    scene = bpy.context.scene
    for loc, energy, colour, size in (((centre[0] - 3, centre[1] - 5, 8), 700, '#FFF4E6', 6),
                                      ((centre[0] + 5, centre[1] + 4, 6), 350, '#DCE8FF', 5),
                                      ((centre[0], centre[1] + 7, 3), 250, '#FFFFFF', 4)):
        light = bpy.data.lights.new('l', 'AREA')
        light.energy, light.size, light.color = energy, size, lin(colour)[:3]
        obj = link(bpy.data.objects.new('l', light))
        obj.location = loc
        obj.rotation_euler = (Vector((centre[0], centre[1], 0)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    world = bpy.data.worlds.new('w')
    world.use_nodes = True
    bg = next(n for n in world.node_tree.nodes if n.type == 'BACKGROUND')
    bg.inputs['Color'].default_value = lin(world_light if theme == 'light' else world_dark)
    bg.inputs['Strength'].default_value = .55
    scene.world = world
    cam = bpy.data.cameras.new('cam')
    cam.type = 'ORTHO'
    cam.ortho_scale = ortho
    cam_obj = link(bpy.data.objects.new('cam', cam))
    cam_obj.location = cam_loc
    cam_obj.rotation_euler = (Vector((centre[0], centre[1], 0)) - Vector(cam_loc)).to_track_quat('-Z', 'Y').to_euler()
    scene.camera = cam_obj
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = int(arg('--samples', '48'))
    scene.cycles.use_denoising = True
    try:
        scene.cycles.device = 'GPU'
        prefs = bpy.context.preferences.addons['cycles'].preferences
        prefs.compute_device_type = 'METAL'
        prefs.get_devices()
        for dev in prefs.devices:
            dev.use = True
    except Exception as exc:  # CPU fallback
        print('GPU unavailable:', exc)
    scene.view_settings.view_transform = 'Standard'  # keep the palette hexes faithful
    scene.render.resolution_x, scene.render.resolution_y = res_x, res_y
    scene.render.film_transparent = False


def build(skin, theme):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    board_col = BOARDS[theme]
    mats = make_mats(skin)
    # board slab with grid dots at cell corners
    bpy.ops.mesh.primitive_cube_add(size=1, location=(4, 2, -.1))
    slab = bpy.context.active_object
    slab.scale = (8.6, 4.6, .2)
    bev = slab.modifiers.new('bevel', 'BEVEL')
    bev.width, bev.segments = .25, 6
    slab.data.materials.append(principled('board', board_col, **{'Roughness': .7}))
    dot = principled('grid', '#C9CCE0' if theme == 'light' else '#2C2838', **{'Roughness': .8})
    for x in range(9):
        for y in range(5):
            sphere((x, y), .035, .0, dot, f'grid{x}{y}', (1, 1, .3))

    arrow([(.5, 2.5), (1.5, 2.5), (2.5, 2.5), (3.5, 2.5)], (1, 0), skin, mats, 'straight')
    arrow([(4.5, 2.5), (5.5, 2.5), (5.5, 1.5), (5.5, .5)], (0, -1), skin, mats, 'ell')
    arrow([(6.6, 2.0)], (-1, 0), skin, mats, 'one')
    setup_render(theme, (4, 2), (4, -3.2, 9), 9.6, int(arg('--res', '1600')), int(int(arg('--res', '1600')) * .55))


def main():
    out = os.path.abspath(arg('--out', 'artifacts/WINTER-01/concepts/hero'))
    os.makedirs(out, exist_ok=True)
    for skin in arg('--skins', ','.join(SKINS)).split(','):
        for theme in arg('--themes', 'light,dark').split(','):
            build(skin, theme)
            path = os.path.join(out, f'{skin}-{theme}.png')
            bpy.context.scene.render.filepath = path
            bpy.ops.render.render(write_still=True)
            print('RENDERED', path, flush=True)
    print('DONE', flush=True)


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print('FAILED', repr(exc), flush=True)
        raise
