"""WINTER-01 Christmas menu layers, rendered in Blender (stylized toy 3D, matching the arrow hero renders).

Transparent PNG layers for the menu, day (light theme) and night (dark theme):
  garland-<t>.png    1440x560  bulb garland across the top (bulb glow is added by menu-post.py)
  snowscape-<t>.png  1440x900  snow hills, rounded snow-capped pines, a little snowman; night adds fairy lights
  boardground-<t>.png 1440x420 snow drift band for the bottom of the winter board (behind the arrows)
  playcap-<t>.png    1000x300  soft snow ridge with icicles for the Play button's top edge (button = 884x240 px)
Snow uses Voyager's CC0 Snow 002 maps; the scene is lit by Voyager's CC0 Evening Sky 042 A HDRI
(artifacts/WINTER-01/blender-assets, fetched with `voyager cloud assets add`, credits in CREDITS.txt there).

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python scripts/art/winter/menu.py -- \
      [--out artifacts/WINTER-01/concepts/menu3d] [--layers garland,snowscape,playcap] [--times day,night] [--samples 64]
"""
import math
import os
import random
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hero import arg, lin, link, principled  # noqa: E402

ASSETS = os.path.abspath('artifacts/WINTER-01/blender-assets/assets')
SNOW_TEX = os.path.join(ASSETS, 'vy.material.snow002@2', 'tex')
HDRI = os.path.join(ASSETS, 'vy.hdri.eveningskyhdri042a@2', 'eveningskyhdri042a_1k.exr')
BULBS = ['#FF4B55', '#FFC53D', '#3CCB7F', '#4FA3FF', '#C77DFF']


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def snow_mat(name='snow', tint='#F4F8FF', scale=1.5):
    """Voyager Snow 002 PBR maps, tinted, with a little subsurface so it reads as soft snow, not plaster."""
    mat = bpy.data.materials.new(name)
    t = mat.node_tree
    bsdf = next(n for n in t.nodes if n.type == 'BSDF_PRINCIPLED')
    coord = t.nodes.new('ShaderNodeTexCoord')
    mapping = t.nodes.new('ShaderNodeMapping')
    mapping.inputs['Scale'].default_value = (scale, scale, scale)
    t.links.new(coord.outputs['Object'], mapping.inputs['Vector'])

    def tex(file, colour):
        node = t.nodes.new('ShaderNodeTexImage')
        node.image = bpy.data.images.load(os.path.join(SNOW_TEX, file))
        node.image.colorspace_settings.name = 'sRGB' if colour else 'Non-Color'
        node.projection = 'BOX'
        node.projection_blend = .3
        t.links.new(mapping.outputs['Vector'], node.inputs['Vector'])
        return node
    base = tex('snow002_basecolor_1k.jpg', True)
    mix = t.nodes.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    mix.blend_type = 'MULTIPLY'
    mix.inputs['Factor'].default_value = 1
    t.links.new(base.outputs['Color'], mix.inputs['A'])
    mix.inputs['B'].default_value = lin(tint)
    t.links.new(mix.outputs['Result'], bsdf.inputs['Base Color'])
    orm = tex('snow002_orm_1k.jpg', False)
    sep = t.nodes.new('ShaderNodeSeparateColor')
    t.links.new(orm.outputs['Color'], sep.inputs['Color'])
    t.links.new(sep.outputs['Green'], bsdf.inputs['Roughness'])
    nmap = t.nodes.new('ShaderNodeNormalMap')
    nmap.inputs['Strength'].default_value = .8
    t.links.new(tex('snow002_normal_1k.jpg', False).outputs['Color'], nmap.inputs['Color'])
    t.links.new(nmap.outputs['Normal'], bsdf.inputs['Normal'])
    bsdf.inputs['Subsurface Weight'].default_value = .35
    bsdf.inputs['Subsurface Radius'].default_value = (.6, .7, 1.0)
    bsdf.inputs['Metallic'].default_value = 0
    return mat


def mesh_obj(op, name, mat, smooth=True, bevel=0, **kw):
    op(**kw)
    obj = bpy.context.active_object
    obj.name = name
    if bevel:
        b = obj.modifiers.new('bevel', 'BEVEL')
        b.width, b.segments = bevel, 4
    if smooth:
        bpy.ops.object.shade_smooth()
    obj.data.materials.append(mat)
    return obj


def ball(loc, r, mat, name, scale=(1, 1, 1)):
    o = mesh_obj(bpy.ops.mesh.primitive_uv_sphere_add, name, mat, radius=r, location=loc, segments=48, ring_count=24)
    o.scale = scale
    return o


def cone(loc, r1, depth, mat, name, r2=0.0):
    return mesh_obj(bpy.ops.mesh.primitive_cone_add, name, mat, bevel=min(r1, depth) * .18, vertices=48, radius1=r1,
                    radius2=r2, depth=depth, location=loc)


def world(strength, tint='#FFFFFF'):
    w = bpy.data.worlds.new('w')
    w.use_nodes = True
    t = w.node_tree
    bg = next(n for n in t.nodes if n.type == 'BACKGROUND')
    env = t.nodes.new('ShaderNodeTexEnvironment')
    env.image = bpy.data.images.load(HDRI)
    mix = t.nodes.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    mix.blend_type = 'MULTIPLY'
    mix.inputs['Factor'].default_value = 1
    t.links.new(env.outputs['Color'], mix.inputs['A'])
    mix.inputs['B'].default_value = lin(tint)
    t.links.new(mix.outputs['Result'], bg.inputs['Color'])
    bg.inputs['Strength'].default_value = strength
    bpy.context.scene.world = w


def sun(rot, energy, colour):
    light = bpy.data.lights.new('sun', 'SUN')
    light.energy, light.color, light.angle = energy, lin(colour)[:3], math.radians(8)
    obj = link(bpy.data.objects.new('sun', light))
    obj.rotation_euler = [math.radians(a) for a in rot]


def camera(loc, target, ortho=None, lens=35):
    cam = bpy.data.cameras.new('cam')
    if ortho:
        cam.type, cam.ortho_scale = 'ORTHO', ortho
    else:
        cam.lens = lens
    obj = link(bpy.data.objects.new('cam', cam))
    obj.location = loc
    obj.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    bpy.context.scene.camera = obj


def render_settings(w, h):
    s = bpy.context.scene
    s.render.engine = 'CYCLES'
    s.cycles.samples = int(arg('--samples', '64'))
    s.cycles.use_denoising = True
    try:
        s.cycles.device = 'GPU'
        prefs = bpy.context.preferences.addons['cycles'].preferences
        prefs.compute_device_type = 'METAL'
        prefs.get_devices()
        for d in prefs.devices:
            d.use = True
    except Exception as exc:
        print('GPU unavailable:', exc)
    s.view_settings.view_transform = 'Standard'  # AgX washed the bulb colours to pastels
    s.render.film_transparent = True
    s.render.image_settings.color_mode = 'RGBA'
    s.render.resolution_x, s.render.resolution_y = w, h


FIR = ('#1B4D33', '#24603F', '#2F7049', '#3A8052')  # needle greens, dark to light
WARM_BULBS = ('#D7263D', '#F2B134', '#2E9E5B', '#FFE3A3', '#D7263D', '#F2B134', '#3B7DD8', '#FFE3A3')


def needle_mesh(name, tufts, mats, seed=1, length=(.16, .26), width=.018):
    """One mesh of thin 4-sided needles. tufts: [(centre Vector, axis Vector, radius)]; needles fan out from the axis.
    Material per needle picks a random green so the bough reads as foliage, not a tube."""
    import bmesh
    rng = random.Random(seed)
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    for c, axis, rad in tufts:
        axis = axis.normalized()
        side = axis.orthogonal().normalized()
        up = axis.cross(side).normalized()
        for _ in range(int(16 + rad * 40)):
            a = rng.uniform(0, 2 * math.pi)
            radial = (side * math.cos(a) + up * math.sin(a))
            base = c + radial * rng.uniform(0, rad * .45) + axis * rng.uniform(-.06, .06)
            d = (radial + axis * rng.uniform(-.5, .5)).normalized()
            L = rng.uniform(*length)
            tip = base + d * L
            o1 = d.orthogonal().normalized() * width
            o2 = d.cross(o1).normalized() * width
            vs = [bm.verts.new(base + o1), bm.verts.new(base + o2), bm.verts.new(base - o1), bm.verts.new(base - o2),
                  bm.verts.new(tip)]
            mi = rng.randrange(len(mats))
            for i in range(4):
                f = bm.faces.new((vs[i], vs[(i + 1) % 4], vs[4]))
                f.material_index = mi
    bm.to_mesh(me)
    bm.free()
    obj = link(bpy.data.objects.new(name, me))
    for m in mats:
        obj.data.materials.append(m)
    return obj


def fir_mats(night):
    return [principled(f'fir{i}', c, **{'Roughness': .55, 'Subsurface Weight': .15, 'Coat Weight': .2})
            for i, c in enumerate(FIR)]


def bow(loc, scale, mat):
    """Velvet bow: two flattened loops, a knot and two tails."""
    for side in (-1, 1):
        lp = mesh_obj(bpy.ops.mesh.primitive_torus_add, f'loop{loc.x:.1f}{side}', mat, major_radius=.24 * scale,
                      minor_radius=.095 * scale, location=loc + Vector((side * .2 * scale, -.08, .04 * scale)))
        lp.rotation_euler = (math.radians(90), math.radians(side * 25), 0)
        lp.scale = (1, .55, 1)
        tail = mesh_obj(bpy.ops.mesh.primitive_cube_add, f'tail{loc.x:.1f}{side}', mat, bevel=.03 * scale,
                        size=1, location=loc + Vector((side * .14 * scale, -.1, -.32 * scale)))
        tail.scale = (.11 * scale, .03, .42 * scale)
        tail.rotation_euler.y = math.radians(side * -18)
    ball(loc + Vector((0, -.12, 0)), .1 * scale, mat, f'knot{loc.x:.1f}', (1, .8, 1))


def garland(night):
    """WINTER-01 v2: a fir swag (needle tufts along three scallops) with small warm bulbs tucked in, red velvet bows
    at the tie points and glossy baubles in the dips. v1 (bare wire + big pastel bulbs) read as cheap/party."""
    reset()
    pts = []
    for span in range(3):
        x0 = -7.6 + span * 5.07
        for i in range(61):
            t = i / 60
            pts.append(Vector((x0 + 5.07 * t, 0, 2.35 - .95 * math.sin(math.pi * t))))
    tufts = []
    for i in range(0, len(pts) - 1):
        a, b = pts[i], pts[i + 1]
        for k in range(2):
            c = a.lerp(b, k / 2)
            tufts.append((c, b - a, .34))
    needle_mesh('swag', tufts, fir_mats(night), seed=3)
    rng = random.Random(11)
    brass = principled('cap', '#B89A5E', **{'Metallic': 1, 'Roughness': .35})
    for k, idx in enumerate(range(4, len(pts) - 2, 6)):
        if idx % 61 in (0, 60) or idx % 61 < 5 or idx % 61 > 56:
            continue  # leave the tie points to the bows
        p = pts[idx]
        colour = WARM_BULBS[k % len(WARM_BULBS)]
        glass = principled(f'bulb{k}', colour, **{'Roughness': .1, 'Transmission Weight': .35, 'Coat Weight': 1,
                                                  'Emission Color': colour,
                                                  'Emission Strength': 1.25 if night else .55})
        off = Vector((rng.uniform(-.05, .05), -.3, rng.uniform(-.22, -.05)))
        tilt = math.radians(rng.uniform(-25, 25))
        c = cone(p + off + Vector((0, 0, .1)), .045, .09, brass, f'cap{k}', r2=.04)
        c.rotation_euler.y = tilt
        b = ball(p + off + Vector((math.sin(tilt) * -.1, 0, -.06)), .085, glass, f'b{k}', (1, 1, 1.4))
        b.rotation_euler.y = tilt
        if night:  # each bulb lights the needles around it: the warm pools are what make string lights feel cosy
            pl = bpy.data.lights.new(f'pl{k}', 'POINT')
            pl.energy, pl.color, pl.shadow_soft_size = 28, lin(colour)[:3], .12
            link(bpy.data.objects.new(f'pl{k}', pl)).location = b.location + Vector((0, -.12, 0))
    velvet = principled('velvet', '#C8102E', **{'Roughness': .6, 'Sheen Weight': .8, 'Sheen Tint': '#FF8A8A'})
    for x in (-7.6 + 5.07, -7.6 + 2 * 5.07):
        bow(Vector((x, -.25, 2.3)), 1.0, velvet)
    gold = principled('gold', '#F0C35A', **{'Metallic': .55, 'Roughness': .22, 'Coat Weight': 1})
    red = principled('red', '#C21E32', **{'Metallic': .7, 'Roughness': .15, 'Coat Weight': 1})
    for i, (span, col) in enumerate(((0, gold), (1, red), (2, gold))):
        x = -7.6 + span * 5.07 + 2.53 + (-.35 if i == 1 else .3)
        string = cone(Vector((x, -.2, 1.25)), .006, .35, brass, f'str{i}')
        ball(Vector((x, -.2, .93)), .19, col, f'bauble{i}')
        cone(Vector((x, -.2, 1.14)), .05, .06, brass, f'bcap{i}', r2=.05)
        del string
    world(.3 if night else .95, '#9FB2FF' if night else '#FFFFFF')
    sun((55, 10, 25), .8 if night else 3.2, '#9DB4FF' if night else '#FFF1DE')
    camera((0, -20, 1.4), (0, 0, 1.4), ortho=14.4)
    render_settings(1440, 560)


def star_mesh(name, mat, r, loc):
    """Faceted 5-point star (front-facing, bevelled), replacing the ico 'hexagon' that read as a placeholder."""
    import bmesh
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    ring = []
    for k in range(10):
        a = math.pi / 2 + k * math.pi / 5
        rr = r if k % 2 == 0 else r * .45
        ring.append(bm.verts.new((rr * math.cos(a), 0, rr * math.sin(a))))
    front, back = bm.verts.new((0, -r * .28, 0)), bm.verts.new((0, r * .28, 0))
    for k in range(10):
        bm.faces.new((ring[k], ring[(k + 1) % 10], front))
        bm.faces.new((ring[(k + 1) % 10], ring[k], back))
    bm.to_mesh(me)
    bm.free()
    obj = link(bpy.data.objects.new(name, me))
    obj.location = loc
    obj.data.materials.append(mat)
    return obj


def tier_mesh(name, mat, apex, R, H, lobes=9, droop=.1, phase=0.0, cap=1.0):
    """Stylized fir tier: concave cone whose rim is scalloped into `lobes` drooping skirts. cap<1 builds only the top
    `cap` fraction (used for the snow drape, whose edge gets its own softer wave)."""
    import bmesh
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    seg, rings = 96, 14
    tip = bm.verts.new(apex)
    prev = None
    for j in range(1, rings + 1):
        t = cap * j / rings
        ring = []
        for i in range(seg):
            th = 2 * math.pi * i / seg
            wave = .5 + .5 * math.cos(lobes * th + phase)
            edge = (t / cap) ** 3  # scallops only near this mesh's own rim
            r = R * (t ** .85) * (1 + .1 * wave * edge)
            z = apex.z - H * t - droop * H * wave * edge
            ring.append(bm.verts.new((apex.x + r * math.cos(th), apex.y + r * math.sin(th), z)))
        if prev is None:
            for i in range(seg):
                bm.faces.new((tip, ring[i], ring[(i + 1) % seg]))
        else:
            for i in range(seg):
                bm.faces.new((prev[i], ring[i], ring[(i + 1) % seg], prev[(i + 1) % seg]))
        prev = ring
    bm.to_mesh(me)
    bm.free()
    for poly in me.polygons:
        poly.use_smooth = True
    obj = link(bpy.data.objects.new(name, me))
    obj.data.materials.append(mat)
    return obj


def pine(x, y, h, mat_green, mat_snow, name, lights=None):
    """WINTER-01 v2 fir: three scalloped tiers, each with a wavy snow drape. (v1 stacked plain cones read as a toy
    kit; needle tufts read as topiary.)"""
    trunk = principled('trunk', '#6B4A33', **{'Roughness': .8})
    cone((x, y, .25), .14 * h, .5, trunk, f'{name}-trunk')
    for tier in range(3):
        R = (1.0 - tier * .24) * h * .66
        H = (1.0 - tier * .12) * h * .95
        apex = Vector((x, y, .45 + tier * .62 * h + .95 * h))
        ph = tier * 1.3
        tier_mesh(f'{name}-t{tier}', mat_green, apex, R, H, phase=ph)
        tier_mesh(f'{name}-s{tier}', mat_snow, apex + Vector((0, 0, .015)), R * 1.04, H, lobes=6, droop=.08,
                  phase=ph + .7, cap=.42)
    if lights:  # a small gold star on the lit tree
        star = principled('star', '#F2B134', **{'Metallic': .8, 'Roughness': .2, 'Emission Color': '#FFB52E',
                                                 'Emission Strength': 1.2})
        star_mesh(f'{name}-star', star, .16 * h, (x, y - .1, .45 + 2 * .62 * h + .98 * h))
    if lights:
        rng = random.Random(len(name))
        for k in range(26):  # warm fairy lights spiralling round the tree
            a = k * 2.3
            zt = .7 + k * (1.9 * h / 26)
            rr = (1.0 - (zt - .45) / (2.4 * h)) * h * .6 + .05
            ball((x + rr * math.cos(a), y + rr * math.sin(a), zt), .055, lights[k % len(lights)], f'{name}-fl{k}')
        del rng


def snowscape(night):
    reset()
    snow = snow_mat(tint='#F4F8FF' if night else '#FFFFFF')
    green = principled('pine', '#24603F', **{'Roughness': .6})
    global FIR_MATS
    FIR_MATS = fir_mats(night)
    for i, (x, y, sx, sz) in enumerate(((-4.5, 4, 7, 2.2), (4.5, 5, 8, 2.6), (0, 1.5, 9, 1.4), (-6, -.5, 5, 1.2),
                                        (6.5, 0, 5, 1.0))):
        hill = ball((x, y, -sz * .55), 1, snow, f'hill{i}', (sx, 3.5, sz))
        hill.modifiers.new('sub', 'SUBSURF').levels = 2
    ground = ball((0, 0, -1.25), 1, snow, 'ground', (16, 6, 1.35))  # swallows the front hills' lips
    ground.modifiers.new('sub', 'SUBSURF').levels = 2
    fairy = [principled(f'fl{c}', c, **{'Emission Color': c, 'Emission Strength': 9 if night else 2.5})
             for c in ('#FFD27A', '#E8434F', '#FFE9B0')]
    pine(-4.0, 4.2, 2.1, green, snow, 'pineA', lights=fairy)
    pine(-1.9, 5.4, 1.4, green, snow, 'pineB')
    pine(4.4, 5.0, 1.8, green, snow, 'pineC')
    pine(6.2, 6.2, 1.2, green, snow, 'pineD')
    # little snowman: a nod to the Snowman skin
    coal = principled('coal', '#25252C', **{'Roughness': .7})
    sx, sy = 1.6, 1.4
    ball((sx, sy, .62), .62, snow, 'sm1')
    ball((sx, sy, 1.48), .45, snow, 'sm2')
    ball((sx, sy, 2.13), .33, snow, 'sm3')
    for ex in (-.11, .11):
        ball((sx + ex, sy - .3, 2.2), .045, coal, f'eye{ex}')
    carrot = cone((sx, sy - .42, 2.12), .06, .32, principled('carrot', '#F28C28', **{'Roughness': .5}), 'carrot')
    carrot.rotation_euler.x = math.radians(90)
    scarf = mesh_obj(bpy.ops.mesh.primitive_torus_add, 'scarf', principled('scarf', '#D94350', **{'Roughness': .7}),
                     major_radius=.36, minor_radius=.09, location=(sx, sy, 1.85))
    scarf.scale.z = .8
    wool = principled('scarf2', '#D94350', **{'Roughness': .8, 'Sheen Weight': .6})
    tail = mesh_obj(bpy.ops.mesh.primitive_cube_add, 'scarf-tail', wool, bevel=.04, size=1,
                    location=(sx + .2, sy - .32, 1.6))
    tail.scale = (.15, .06, .42)
    tail.rotation_euler.y = math.radians(-12)
    for k in range(3):
        ball((sx, sy - .43, 1.33 + k * .22), .04, coal, f'btn{k}')
    world(.45 if night else 1.0, '#A9BFFF' if night else '#FFFFFF')
    sun((48, 8, 210) if night else (45, 5, 40), 1.8 if night else 3.2, '#A9BCFF' if night else '#FFF0DC')
    camera((0, -15, 3.6), (0, 3, 1.4), lens=34)
    render_settings(1440, 900)


def playcap(night):
    reset()
    snow = snow_mat(tint='#F2F6FF' if night else '#FFFFFF', scale=3)
    ice = principled('ice', '#DCEEFF', **{'Roughness': .15, 'Subsurface Weight': .5, 'Coat Weight': 1})
    mb = bpy.data.metaballs.new('ridge')
    mb.resolution, mb.render_resolution = .06, .03
    rng = random.Random(5)
    top = 1.2  # the pill is 8.84 x 2.4 (1 m = 100 px); its flat top runs from x = -3.22 to 3.22
    for k in range(34):
        x = -3.7 + k * .22
        y_top = top if abs(x) <= 3.22 else top - (abs(x) - 3.22) ** 2 * .9  # follow the rounded ends a little
        el = mb.elements.new()
        el.co = (x, 0, y_top + rng.uniform(.0, .12))
        el.radius = rng.uniform(.45, .62)
    obj = link(bpy.data.objects.new('ridge', mb))
    obj.scale = (1, .75, .7)
    obj.data.materials.append(snow)
    for k in range(11):  # short icicles hanging over the button face
        x = -3.0 + k * .6 + rng.uniform(-.12, .12)
        c = cone((x, -.25, top - .38), .08, rng.uniform(.3, .6), ice, f'icicle{k}')
        c.rotation_euler.x = math.radians(180)
    world(.2 if night else 1.0, '#B8C8FF' if night else '#FFFFFF')
    sun((55, 0, 20), .9 if night else 3.0, '#A9BCFF' if night else '#FFF1DE')
    camera((0, -20, .9), (0, 0, .9), ortho=10)
    render_settings(1000, 300)


def boardground(night):
    """Snow drift band for the bottom of the play area (drawn behind the arrows). Day snow gets a cool blue
    shade so it still reads on the near-white light board."""
    reset()
    snow = snow_mat(tint='#E4EEFA' if not night else '#E9F0FB', scale=2)
    rng = random.Random(11)
    mb = bpy.data.metaballs.new('drift')
    mb.resolution, mb.render_resolution = .08, .04
    for k in range(30):
        el = mb.elements.new()
        el.co = (-7.6 + k * .53, 0, rng.uniform(-.55, -.2))
        el.radius = rng.uniform(.75, 1.15)
    obj = link(bpy.data.objects.new('drift', mb))
    obj.scale = (1, .7, .75)
    obj.data.materials.append(snow)
    world(.4 if night else 1.0, '#A9BFFF' if night else '#DCE6FF')
    sun((60, 0, 25), 1.6 if night else 3.0, '#A9BCFF' if night else '#FFF1DE')
    camera((0, -20, 3.4), (0, 0, -.1), ortho=14.4)
    render_settings(1440, 420)


def main():
    out = os.path.abspath(arg('--out', 'artifacts/WINTER-01/concepts/menu3d'))
    os.makedirs(out, exist_ok=True)
    builders = {'garland': garland, 'snowscape': snowscape, 'playcap': playcap, 'boardground': boardground}
    for layer in arg('--layers', 'garland,snowscape').split(','):  # playcap dropped: read as a sausage, cheapened the menu
        for t in arg('--times', 'day,night').split(','):
            builders[layer](t == 'night')
            path = os.path.join(out, f'{layer}-{t}.png')
            bpy.context.scene.render.filepath = path
            bpy.ops.render.render(write_still=True)
            print('RENDERED', path, flush=True)
    print('DONE', flush=True)


try:
    main()
except Exception as exc:
    print('FAILED', repr(exc), flush=True)
    raise
