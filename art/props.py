"""
Coil — board prop generator (Blender, EEVEE).

Renders every non-snake actor on the board as a top-down sprite in the SAME
lighting language as the snake head sprites (warm key high-left, cool green
and cyan rims), so the whole board reads as one photographed diorama instead
of one 3D actor among flat vector shapes.

Props:
  food          luminous egg (neutral warm; skins add their own under-glow)
  bonus         golden scarab beetle
  pu_<kind>     powerup medallions: carved stone disc + embossed symbol,
                tinted per kind to match POWERUP_META colors
  wall_a/b/c    mossy stone blocks (three variants so runs of wall don't tile)
  arrow         GPS compass needle (luminous, hot core)
  frame_edge    tileable stone border strip (solid-wall board frame)
  emblem_*      mode-card emblems for the home screen
Everything renders transparent-background PNG at 256 px (emblem 320 px).

Usage (MCP bridge):
    import props; props.build_all(); props.render_all(outdir)
"""

import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

SCENE = "PROPS"
RES = 256

# POWERUP_META colors (src/render/powerupMeta.ts) — single source of truth.
POWERUPS = {
    'points':  ('#FFD54A', 'gem'),
    'magnet':  ('#FF5A5A', 'horseshoe'),
    'slow':    ('#4FA3FF', 'triangle'),
    'shrink':  ('#36D399', 'minus'),
    'double':  ('#B57BFF', 'diamond'),
    'wallbuster': ('#FF8A3D', 'cross'),
}


def _srgb_to_linear(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hexlin(hx, lift=1.0):
    hx = hx.lstrip('#')
    r, g, b = (int(hx[i:i + 2], 16) for i in (0, 2, 4))
    return tuple(min(1.0, _srgb_to_linear(v) * lift) for v in (r, g, b))


# ---------------------------------------------------------------- scene ----

def _scene():
    sc = bpy.data.scenes.get(SCENE)
    if sc is None:
        sc = bpy.data.scenes.new(SCENE)
    return sc


def _clear(sc):
    for o in list(sc.collection.objects):
        bpy.data.objects.remove(o, do_unlink=True)


def _eevee_id():
    ids = {e.identifier for e in
           bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items}
    for cand in ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE'):
        if cand in ids:
            return cand
    return 'CYCLES'


def _rig(sc, ortho=2.4):
    """Sprite rig: top-down ortho camera + the snake-sprite light language."""
    def lamp(name, loc, energy, color, size=2.2):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.energy = energy
        ld.color = color
        ld.size = size
        ob = bpy.data.objects.new(name, ld)
        ob.location = loc
        sc.collection.objects.link(ob)

    lamp("PR_Key", (-1.6, -1.4, 3.2), 260, (1.0, 0.95, 0.82))
    lamp("PR_RimL", (-1.8, 1.6, 1.4), 120, (0.25, 1.0, 0.55), 1.6)
    lamp("PR_RimR", (2.0, 1.2, 1.4), 100, (0.15, 0.9, 1.0), 1.6)
    lamp("PR_Fill", (1.4, -1.8, 0.8), 40, (0.4, 0.8, 0.6), 1.8)

    cd = bpy.data.cameras.new("PR_Cam")
    cd.type = 'ORTHO'
    cd.ortho_scale = ortho
    cam = bpy.data.objects.new("PR_Cam", cd)
    cam.location = (0, 0, 8)
    sc.collection.objects.link(cam)
    sc.camera = cam

    sc.render.engine = _eevee_id()
    sc.render.resolution_x = RES
    sc.render.resolution_y = RES
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    if hasattr(sc.eevee, "taa_render_samples"):
        sc.eevee.taa_render_samples = 96
    sc.view_settings.view_transform = 'Standard'


# ------------------------------------------------------------ materials ----

def mat(name, color, rough=0.5, metal=0.0, emit=None, emit_str=0.0):
    m = bpy.data.materials.get(name)
    if m:
        bpy.data.materials.remove(m)
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1.0)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if emit is not None and "Emission Color" in b.inputs:
        b.inputs["Emission Color"].default_value = (*emit, 1.0)
        b.inputs["Emission Strength"].default_value = emit_str
    return m


def mat_stone(name, base, mossy=None):
    """Rough stone with noise-broken color + bump, optional moss in crevices."""
    m = bpy.data.materials.get(name)
    if m:
        bpy.data.materials.remove(m)
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Roughness"].default_value = 0.85

    tex = nt.nodes.new("ShaderNodeTexCoord")
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 7.0
    noise.inputs["Detail"].default_value = 6.0
    nt.links.new(tex.outputs["Object"], noise.inputs["Vector"])

    ramp = nt.nodes.new("ShaderNodeValToRGB")
    cr = ramp.color_ramp
    cr.elements[0].position = 0.35
    cr.elements[0].color = (*[v * 0.55 for v in base], 1.0)
    cr.elements[1].position = 0.75
    cr.elements[1].color = (*base, 1.0)
    nt.links.new(noise.outputs["Fac"], ramp.inputs[0])

    if mossy is not None:
        moss_noise = nt.nodes.new("ShaderNodeTexNoise")
        moss_noise.inputs["Scale"].default_value = 3.4
        moss_noise.inputs["Detail"].default_value = 4.0
        nt.links.new(tex.outputs["Object"], moss_noise.inputs["Vector"])
        moss_mask = nt.nodes.new("ShaderNodeMapRange")
        moss_mask.interpolation_type = 'SMOOTHSTEP'
        moss_mask.clamp = True
        moss_mask.inputs["From Min"].default_value = 0.48
        moss_mask.inputs["From Max"].default_value = 0.72
        nt.links.new(moss_noise.outputs["Fac"], moss_mask.inputs["Value"])
        mix = nt.nodes.new("ShaderNodeMixRGB")
        mix.inputs[2].default_value = (*mossy, 1.0)
        nt.links.new(moss_mask.outputs["Result"], mix.inputs[0])
        nt.links.new(ramp.outputs["Color"], mix.inputs[1])
        nt.links.new(mix.outputs["Color"], b.inputs["Base Color"])
    else:
        nt.links.new(ramp.outputs["Color"], b.inputs["Base Color"])

    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.85
    bump.inputs["Distance"].default_value = 0.09
    nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], b.inputs["Normal"])
    return m


# ------------------------------------------------------------- builders ----

def _link(sc, ob):
    sc.collection.objects.link(ob)
    return ob


def _smooth(ob):
    for p in ob.data.polygons:
        p.use_smooth = True


def _uv_sphere(name, r=1.0, seg=48, rings=32):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=r)
    bm.to_mesh(me)
    bm.free()
    return me


def _cylinder(name, r=1.0, depth=0.3, seg=64):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg,
                          radius1=r, radius2=r, depth=depth)
    bm.to_mesh(me)
    bm.free()
    return me


def _box(name, sx, sy, sz):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(sx, sy, sz), verts=bm.verts)
    bm.to_mesh(me)
    bm.free()
    return me


def build_food(sc):
    """Luminous egg: warm pearl shell over a soft inner glow."""
    me = _uv_sphere("FoodEgg", 0.72)
    ob = bpy.data.objects.new("PROP_food", me)
    ob.scale = (0.86, 1.0, 0.9)          # egg profile in plan view
    ob.location = (0, 0, 0.62)
    m = mat("MAT_FoodShell", hexlin('#FFF4D6'), rough=0.32,
            emit=hexlin('#FFB84D'), emit_str=0.85)
    me.materials.append(m)
    _smooth(ob)
    return _link(sc, ob)


def build_bonus(sc):
    """Golden scarab: domed shell, head, split line via slight gap."""
    objs = []
    shell = _uv_sphere("ScarabShell", 0.62)
    ob = bpy.data.objects.new("PROP_bonus_shell", shell)
    ob.scale = (0.82, 1.0, 0.52)
    ob.location = (0, -0.08, 0.36)
    mgold = mat("MAT_Gold", hexlin('#E8B33A'), rough=0.28, metal=1.0,
                emit=hexlin('#7A5A10'), emit_str=0.25)
    shell.materials.append(mgold)
    _smooth(ob)
    objs.append(_link(sc, ob))

    head = _uv_sphere("ScarabHead", 0.30)
    hob = bpy.data.objects.new("PROP_bonus_head", head)
    hob.scale = (0.85, 0.7, 0.6)
    hob.location = (0, 0.52, 0.24)
    head.materials.append(mgold)
    _smooth(hob)
    objs.append(_link(sc, hob))

    # Shell split: a thin dark wedge pressed into the dome.
    seam = _box("ScarabSeam", 0.03, 0.98, 0.5)
    sob = bpy.data.objects.new("PROP_bonus_seam", seam)
    sob.location = (0, -0.1, 0.5)
    seam.materials.append(mat("MAT_SeamDark", hexlin('#4A3608'), rough=0.6))
    objs.append(_link(sc, sob))

    # Six stub legs.
    leg = _box("ScarabLeg", 0.34, 0.08, 0.07)
    mleg = mat("MAT_LegGold", hexlin('#B8892A'), rough=0.4, metal=1.0)
    leg.materials.append(mleg)
    for i, (y, ang) in enumerate([(-0.42, 0.5), (0.02, 0.15), (0.38, -0.35)]):
        for side in (-1, 1):
            lob = bpy.data.objects.new(f"PROP_bonus_leg{i}{side}", leg)
            lob.location = (side * 0.62, y, 0.10)
            lob.rotation_euler = (0, 0, side * ang)
            objs.append(_link(sc, lob))
    return objs


def _symbol_mesh(token):
    """Extruded symbol meshes, each ~1.0 across, thickness 0.16."""
    T = 0.16

    def from_boxes(boxes):
        out = []
        for i, (sx, sy, loc, rz) in enumerate(boxes):
            me = _box(f"Sym_{token}_{i}", sx, sy, T)
            ob = bpy.data.objects.new(f"SYM_{token}_{i}", me)
            ob.location = (*loc, 0)
            ob.rotation_euler = (0, 0, rz)
            out.append(ob)
        return out

    if token == 'minus':
        return from_boxes([(0.9, 0.3, (0, 0), 0)])
    if token == 'cross':
        return from_boxes([(1.0, 0.26, (0, 0), math.radians(45)),
                           (1.0, 0.26, (0, 0), math.radians(-45))])
    if token == 'diamond':
        return from_boxes([(0.66, 0.66, (0, 0), math.radians(45))])
    if token == 'triangle':
        me = bpy.data.meshes.new("Sym_tri")
        bm = bmesh.new()
        pts = [(-0.5, 0.38, 0), (0.5, 0.38, 0), (0.0, -0.5, 0)]
        vs = [bm.verts.new(p) for p in pts]
        bm.faces.new(vs)
        r = bmesh.ops.extrude_face_region(bm, geom=list(bm.faces))
        verts = [g for g in r['geom'] if isinstance(g, bmesh.types.BMVert)]
        bmesh.ops.translate(bm, vec=(0, 0, T), verts=verts)
        bm.to_mesh(me)
        bm.free()
        return [bpy.data.objects.new("SYM_tri", me)]
    if token == 'horseshoe':
        # U magnet: torus arc + two leg boxes with pale tips.
        me = bpy.data.meshes.new("Sym_horse")
        bm = bmesh.new()
        bmesh.ops.create_circle(bm, cap_ends=False, radius=0.34, segments=40)
        bm.to_mesh(me)
        bm.free()
        # build manually: arc swept — simpler: use a torus cut in half
        me2 = bpy.data.meshes.new("Sym_horse2")
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=8, v_segments=6, radius=0.1)
        bm.to_mesh(me2)
        bm.free()
        # fallback: torus via primitive op on object level is easier:
        curve = bpy.data.curves.new("HorseCurve", 'CURVE')
        curve.dimensions = '3D'
        sp = curve.splines.new('NURBS')
        n = 24
        sp.points.add(n)
        for i in range(n + 1):
            a = math.pi * (i / n)             # half circle, opening DOWN
            x = 0.34 * math.cos(a)
            y = 0.20 + 0.34 * math.sin(a)
            sp.points[i].co = (x, y, 0, 1)
        sp.use_endpoint_u = True
        curve.bevel_depth = 0.13
        curve.bevel_resolution = 6
        curve.use_fill_caps = True
        arc = bpy.data.objects.new("SYM_horse_arc", curve)
        legs = from_boxes([(0.26, 0.34, (-0.34, 0.06), 0),
                           (0.26, 0.34, (0.34, 0.06), 0)])
        return [arc] + legs
    if token == 'gem':
        me = bpy.data.meshes.new("Sym_gem")
        bm = bmesh.new()
        bmesh.ops.create_icosphere(bm, subdivisions=1, radius=0.45)
        bm.to_mesh(me)
        bm.free()
        return [bpy.data.objects.new("SYM_gem", me)]
    raise ValueError(token)


def build_medallion(sc, kind):
    """Stone disc + embossed tinted symbol."""
    color_hex, token = POWERUPS[kind]
    tint = hexlin(color_hex)
    objs = []

    disc = _cylinder(f"Disc_{kind}", 0.78, 0.22)
    dob = bpy.data.objects.new(f"PROP_pu_{kind}_disc", disc)
    dob.location = (0, 0, 0.11)
    disc.materials.append(mat_stone(f"MAT_Disc_{kind}", hexlin('#3A4038')))
    _smooth(dob)
    objs.append(_link(sc, dob))

    # thin luminous RING around the disc edge (a swept circle, not a lid —
    # a covering disc kills the stone and reads as flat candy)
    ring_cu = bpy.data.curves.new(f"RingCurve_{kind}", 'CURVE')
    ring_cu.dimensions = '3D'
    sp = ring_cu.splines.new('NURBS')
    n = 32
    sp.points.add(n)
    for i in range(n + 1):
        a = 2 * math.pi * i / n
        sp.points[i].co = (0.66 * math.cos(a), 0.66 * math.sin(a), 0, 1)
    sp.use_cyclic_u = True
    ring_cu.bevel_depth = 0.045
    ring_cu.bevel_resolution = 6
    rob = bpy.data.objects.new(f"PROP_pu_{kind}_ring", ring_cu)
    rob.location = (0, 0, 0.235)
    ring_cu.materials.append(mat(f"MAT_Rim_{kind}", tint, rough=0.4,
                                 emit=tint, emit_str=1.6))
    objs.append(_link(sc, rob))

    msym = mat(f"MAT_Sym_{kind}", tint, rough=0.35,
               emit=tint, emit_str=2.2)
    for so in _symbol_mesh(token):
        so.name = f"PROP_pu_{kind}_{so.name}"
        if so.type == 'CURVE':
            pass
        else:
            so.data.materials.append(msym)
        if so.type == 'CURVE':
            so.data.materials.append(msym)
        so.location = (so.location.x, so.location.y, 0.30)
        so.scale = (0.72, 0.72, 0.72)
        objs.append(_link(sc, so))
    return objs


def build_wall(sc, variant, seed):
    """One mossy stone block filling ~a cell, irregular silhouette."""
    import random
    rng = random.Random(seed)
    me = bpy.data.meshes.new(f"Wall_{variant}")
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(1.30, 1.30, 0.62), verts=bm.verts)
    # random vertex jitter for an irregular boulder read
    for v in bm.verts:
        v.co.x += rng.uniform(-0.16, 0.16)
        v.co.y += rng.uniform(-0.16, 0.16)
        v.co.z += rng.uniform(-0.08, 0.08)
    bmesh.ops.bevel(bm, geom=list(bm.edges), offset=0.14, segments=3,
                    profile=0.7, affect='EDGES')
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(f"PROP_wall_{variant}", me)
    ob.location = (0, 0, 0.38)
    ob.rotation_euler = (0, 0, rng.uniform(0, math.pi))
    me.materials.append(
        mat_stone(f"MAT_Wall_{variant}", hexlin('#2E332C'),
                  mossy=hexlin('#365E22')))
    _smooth(ob)
    return _link(sc, ob)


def build_arrow(sc):
    """Compass needle: elongated luminous diamond, hot core."""
    me = bpy.data.meshes.new("Needle")
    bm = bmesh.new()
    pts = [(0, 0.85, 0), (0.30, -0.15, 0), (0, -0.55, 0), (-0.30, -0.15, 0)]
    vs = [bm.verts.new(p) for p in pts]
    bm.faces.new(vs)
    r = bmesh.ops.extrude_face_region(bm, geom=list(bm.faces))
    verts = [g for g in r['geom'] if isinstance(g, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, vec=(0, 0, 0.22), verts=verts)
    bmesh.ops.bevel(bm, geom=list(bm.edges), offset=0.05, segments=2,
                    affect='EDGES')
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new("PROP_arrow", me)
    ob.location = (0, 0, 0.2)
    m = mat("MAT_Needle", hexlin('#FF2EC4'), rough=0.25, metal=0.55,
            emit=hexlin('#FF2EC4'), emit_str=0.5)
    me.materials.append(m)
    _smooth(ob)
    _link(sc, ob)

    # white-hot tip so the pointing end reads at a glance
    tip = _uv_sphere("Tip", 0.11)
    tob = bpy.data.objects.new("PROP_arrow_tip", tip)
    tob.location = (0, 0.78, 0.31)
    tip.materials.append(mat("MAT_Tip", (1, 1, 1), rough=0.2,
                             emit=(1.0, 0.85, 1.0), emit_str=4.0))
    _smooth(tob)
    _link(sc, tob)
    return ob


def build_frame_edge(sc):
    """A run of small stones for the solid-wall border, tileable in X."""
    import random
    rng = random.Random(7)
    objs = []
    mstone = mat_stone("MAT_Frame", hexlin('#4E5450'), mossy=hexlin('#28451f'))
    x = -1.1
    i = 0
    while x < 1.1:
        w = rng.uniform(0.28, 0.5)
        me = bpy.data.meshes.new(f"FrameStone{i}")
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.scale(bm, vec=(w, rng.uniform(0.42, 0.55),
                                 rng.uniform(0.3, 0.44)), verts=bm.verts)
        for v in bm.verts:
            v.co.x += rng.uniform(-0.03, 0.03)
            v.co.y += rng.uniform(-0.03, 0.03)
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=0.06, segments=2,
                        affect='EDGES')
        bm.to_mesh(me)
        bm.free()
        ob = bpy.data.objects.new(f"PROP_frame_{i}", me)
        ob.location = (x + w / 2, rng.uniform(-0.04, 0.04), 0.2)
        me.materials.append(mstone)
        _smooth(ob)
        objs.append(_link(sc, ob))
        x += w + rng.uniform(0.015, 0.05)
        i += 1
    return objs


# ------------------------------------------------------------- renderer ----

PROP_BUILDERS = {
    'food': build_food,
    'bonus': build_bonus,
    'wall_a': lambda sc: build_wall(sc, 'a', 3),
    'wall_b': lambda sc: build_wall(sc, 'b', 11),
    'wall_c': lambda sc: build_wall(sc, 'c', 27),
    'arrow': build_arrow,
}


def render_prop(name, outdir, ortho=2.4, res=RES):
    sc = _scene()
    _clear(sc)
    _rig(sc, ortho)
    sc.render.resolution_x = res
    sc.render.resolution_y = res
    if name in PROP_BUILDERS:
        PROP_BUILDERS[name](sc)
    elif name.startswith('pu_'):
        build_medallion(sc, name[3:])
    elif name == 'frame_edge':
        _clear(sc)
        _rig(sc, ortho)
        build_frame_edge(sc)
        sc.render.resolution_x = 512
        sc.render.resolution_y = 128
        sc.camera.data.ortho_scale = 2.3
    os.makedirs(outdir, exist_ok=True)
    path = os.path.join(outdir, f"{name}.png")
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True, scene=SCENE)
    return path


def render_all(outdir):
    out = []
    for n in ['food', 'bonus', 'wall_a', 'wall_b', 'wall_c', 'arrow',
              'frame_edge'] + [f'pu_{k}' for k in POWERUPS]:
        out.append(render_prop(n, outdir))
    return out
