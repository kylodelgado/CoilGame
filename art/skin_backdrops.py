"""
Coil — per-skin board backdrop generator (Blender, EEVEE).

A palette-parameterized sibling of backdrop.py: the same dark-ground recipe
(low-frequency patches, pool-of-light vignette, sparse scatter) re-tinted for
each of the game's four skins, so every skin gets a pre-rendered floor that
belongs to the same family as the hand-tuned moss original.

Skins and their reads:
  greenOnBlack -> the original moss terrarium (backdrop.py output, unchanged)
  amberCrt     -> burnt-amber terrarium: dark bronze soil, rust leaves,
                  warm phosphor pool of light
  monoLcd      -> pale LCD paper: LIGHT ground, faint sage mottling, quiet
                  vignette, no leaf litter (a clean screen, not a forest)
  neon         -> indigo glass floor: near-black violet ground, cool
                  cyan-violet pool, sparse dark pebbles, no leaves

Usage (from the MCP bridge, with backdrop.py importable):
    import skin_backdrops; skin_backdrops.render_all(outdir)
"""

import importlib
import math
import os
import sys

import bpy

# Reuse the neutral machinery from the original generator.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import backdrop  # noqa: E402

SCENE = backdrop.SCENE
PLANE_W = backdrop.PLANE_W
PLANE_H = backdrop.PLANE_H
BLEED = backdrop.BLEED
RES_X = backdrop.RES_X
RES_Y = backdrop.RES_Y


def _srgb_to_linear(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hexlin(hx, lift=1.0):
    """'#RRGGBB' -> linear rgb tuple, optionally value-lifted."""
    hx = hx.lstrip('#')
    r, g, b = (int(hx[i:i + 2], 16) for i in (0, 2, 4))
    return tuple(min(1.0, _srgb_to_linear(v) * lift) for v in (r, g, b))


# --------------------------------------------------------------------------
# Palettes. Values chosen off the actual Skin colors in src/skins/*.ts, kept
# in the bottom fifth of the range for dark skins (the snake/food/UI must
# always win) and the top fifth for monoLcd.
# --------------------------------------------------------------------------
PALETTES = {
    # The moss terrarium, re-rendered in the same value range as its siblings.
    # The original hand-tuned render sat ~4x brighter (mean luminance 0.18 vs
    # 0.04), which washed the snake, food and walls out during play — the board
    # must stay the quietest thing on screen.
    'greenOnBlack': {
        'soil':   hexlin('#040805'),
        'mid':    hexlin('#0A1409'),
        'crown':  hexlin('#12200E'),
        'pool':   hexlin('#16280F'),
        'stone':  hexlin('#0F150E'),
        'leaf_a': hexlin('#16260E'),   # olive blade
        'leaf_b': hexlin('#1A1608'),   # dry brown blade
        'leaves': 52,
        'pebbles': 30,
        'key_color': (0.92, 1.0, 0.90),
        'key_energy': 1500.0,
        'fill_color': (0.70, 0.90, 0.80),
        'fill_energy': 0.06,
        'bump': 0.60,
    },
    'amberCrt': {
        'soil':   hexlin('#070300'),
        'mid':    hexlin('#150A02'),
        'crown':  hexlin('#241203'),
        'pool':   hexlin('#2E1A05'),
        'stone':  hexlin('#1C1308'),
        'leaf_a': hexlin('#20120A'),   # rust
        'leaf_b': hexlin('#171004'),   # burnt umber
        'leaves': 44,
        'pebbles': 30,
        'key_color': (1.0, 0.62, 0.18),
        'key_energy': 1500.0,
        'fill_color': (1.0, 0.75, 0.40),
        'fill_energy': 0.05,
        'bump': 0.60,
    },
    'monoLcd': {
        'soil':   hexlin('#8FAF0E'),
        'mid':    hexlin('#9BBC0F'),
        'crown':  hexlin('#A6C81A'),
        'pool':   hexlin('#AECF22'),
        'stone':  hexlin('#88A80C'),
        'leaf_a': None,                # a clean screen, not a forest
        'leaf_b': None,
        'leaves': 0,
        'pebbles': 16,
        'key_color': (1.0, 1.0, 0.92),
        'key_energy': 2600.0,          # bright: this floor must render LIGHT
        'fill_color': (0.95, 1.0, 0.85),
        'fill_energy': 1.4,            # strong ambient -> gentle vignette
        'bump': 0.18,                  # LCD is nearly flat
    },
    'neon': {
        'soil':   hexlin('#06060C'),
        'mid':    hexlin('#0D0D1B'),
        'crown':  hexlin('#15152C'),
        'pool':   hexlin('#1A1A38'),
        'stone':  hexlin('#12121F'),
        'leaf_a': None,
        'leaf_b': None,
        'leaves': 0,
        'pebbles': 24,
        'key_color': (0.45, 0.75, 1.0),
        'key_energy': 1500.0,
        'fill_color': (0.55, 0.45, 1.0),
        'fill_energy': 0.07,
        'bump': 0.45,
    },
}


def _mat_ground_pal(pal):
    """backdrop._mat_ground with every color drawn from the palette."""
    name = "MAT_BackdropSkin"
    if name in bpy.data.materials:
        bpy.data.materials.remove(bpy.data.materials[name])
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.92
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.08

    tex = nt.nodes.new("ShaderNodeTexCoord")

    patches = nt.nodes.new("ShaderNodeTexNoise")
    patches.inputs["Scale"].default_value = 0.55
    patches.inputs["Detail"].default_value = 3.0
    patches.inputs["Roughness"].default_value = 0.55
    nt.links.new(tex.outputs["Object"], patches.inputs["Vector"])

    ramp = nt.nodes.new("ShaderNodeValToRGB")
    cr = ramp.color_ramp
    cr.interpolation = 'B_SPLINE'
    cr.elements[0].position = 0.30
    cr.elements[0].color = (*pal['soil'], 1.0)
    cr.elements[1].position = 0.62
    cr.elements[1].color = (*pal['mid'], 1.0)
    e = cr.elements.new(0.85)
    e.color = (*pal['crown'], 1.0)
    nt.links.new(patches.outputs["Fac"], ramp.inputs[0])

    rad = nt.nodes.new("ShaderNodeVectorMath")
    rad.operation = 'LENGTH'
    nt.links.new(tex.outputs["Object"], rad.inputs[0])
    pool = nt.nodes.new("ShaderNodeMapRange")
    pool.interpolation_type = 'SMOOTHSTEP'
    pool.clamp = True
    pool.inputs["From Min"].default_value = 2.5
    pool.inputs["From Max"].default_value = 8.5
    pool.inputs["To Min"].default_value = 0.55
    pool.inputs["To Max"].default_value = 0.0
    nt.links.new(rad.outputs["Value"], pool.inputs["Value"])
    mossy = nt.nodes.new("ShaderNodeMixRGB")
    mossy.blend_type = 'MIX'
    mossy.inputs[2].default_value = (*pal['pool'], 1.0)
    nt.links.new(pool.outputs["Result"], mossy.inputs[0])
    nt.links.new(ramp.outputs["Color"], mossy.inputs[1])

    vor = nt.nodes.new("ShaderNodeTexVoronoi")
    vor.feature = 'SMOOTH_F1'
    vor.inputs["Scale"].default_value = 2.6
    vor.inputs["Randomness"].default_value = 1.0
    nt.links.new(tex.outputs["Object"], vor.inputs["Vector"])
    stone_mask = nt.nodes.new("ShaderNodeMapRange")
    stone_mask.interpolation_type = 'SMOOTHSTEP'
    stone_mask.clamp = True
    stone_mask.inputs["From Min"].default_value = 0.10
    stone_mask.inputs["From Max"].default_value = 0.0
    stone_mask.inputs["To Min"].default_value = 0.0
    stone_mask.inputs["To Max"].default_value = 0.75
    nt.links.new(vor.outputs["Distance"], stone_mask.inputs["Value"])

    stones = nt.nodes.new("ShaderNodeMixRGB")
    stones.blend_type = 'MIX'
    stones.inputs[2].default_value = (*pal['stone'], 1.0)
    nt.links.new(stone_mask.outputs["Result"], stones.inputs[0])
    nt.links.new(mossy.outputs["Color"], stones.inputs[1])
    nt.links.new(stones.outputs["Color"], bsdf.inputs["Base Color"])

    grain = nt.nodes.new("ShaderNodeTexNoise")
    grain.inputs["Scale"].default_value = 18.0
    grain.inputs["Detail"].default_value = 5.0
    nt.links.new(tex.outputs["Object"], grain.inputs["Vector"])

    relief = nt.nodes.new("ShaderNodeMixRGB")
    relief.blend_type = 'MIX'
    relief.inputs[0].default_value = 0.25
    nt.links.new(patches.outputs["Fac"], relief.inputs[1])
    nt.links.new(grain.outputs["Fac"], relief.inputs[2])

    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = pal['bump']
    bump.inputs["Distance"].default_value = 0.22
    nt.links.new(relief.outputs["Color"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return m


def _scatter_pal(sc, rng, pal):
    """backdrop._scatter with palette colors and per-skin counts."""
    for mn in ("BD_PebbleMesh", "BD_LeafA", "BD_LeafB"):
        if mn in bpy.data.meshes:
            bpy.data.meshes.remove(bpy.data.meshes[mn])
    hw, hh = PLANE_W / 2 * 0.97, PLANE_H / 2 * 0.97

    if pal['pebbles'] > 0:
        pebble = backdrop._pebble_mesh()
        pebble.materials.append(
            backdrop._mat_flat("MAT_PebbleSkin", pal['stone'], 0.88))
        spots = [(rng.uniform(-hw, hw), rng.uniform(-hh, hh), 1)
                 for _ in range(pal['pebbles'])]
        for _ in range(max(2, pal['pebbles'] // 5)):
            cx, cy = rng.uniform(-hw, hw), rng.uniform(-hh, hh)
            spots.append((cx, cy, rng.randint(2, 3)))
        pi = 0
        for cx, cy, count in spots:
            for _ in range(count):
                r = rng.uniform(0.09, 0.28)
                ob = bpy.data.objects.new(f"BD_Pebble_{pi}", pebble)
                ob.location = (cx + rng.uniform(-0.35, 0.35),
                               cy + rng.uniform(-0.35, 0.35), -r * 0.30)
                ob.scale = (r * rng.uniform(0.8, 1.3),
                            r * rng.uniform(0.8, 1.3), r * 0.55)
                ob.rotation_euler = (0.0, 0.0, rng.uniform(0.0, 2 * math.pi))
                sc.collection.objects.link(ob)
                pi += 1

    if pal['leaves'] > 0 and pal['leaf_a'] and pal['leaf_b']:
        leaf_a = backdrop._leaf_mesh("BD_LeafA")
        leaf_a.materials.append(
            backdrop._mat_flat("MAT_LeafASkin", pal['leaf_a'], 0.80))
        leaf_b = backdrop._leaf_mesh("BD_LeafB")
        leaf_b.materials.append(
            backdrop._mat_flat("MAT_LeafBSkin", pal['leaf_b'], 0.80))
        for i in range(pal['leaves']):
            me = leaf_a if rng.random() < 0.62 else leaf_b
            length = rng.uniform(0.45, 0.85)
            ob = bpy.data.objects.new(f"BD_Leaf_{i}", me)
            ob.location = (rng.uniform(-hw, hw), rng.uniform(-hh, hh), 0.012)
            ob.scale = (length, length * rng.uniform(0.8, 1.15), 1.0)
            ob.rotation_euler = (0.0, 0.0, rng.uniform(0.0, 2 * math.pi))
            sc.collection.objects.link(ob)


def _eevee_id():
    """EEVEE's identifier moved between Blender versions; pick what exists."""
    ids = {e.identifier for e in
           bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items}
    for cand in ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE'):
        if cand in ids:
            return cand
    return 'CYCLES'


def rebuild_skin(skin_id):
    import random
    pal = PALETTES[skin_id]
    sc = backdrop._scene()
    backdrop._clear(sc)

    mesh = bpy.data.meshes.new("BD_GroundMesh")
    hw = PLANE_W * BLEED / 2
    hh = PLANE_H * BLEED / 2
    mesh.from_pydata(
        [(-hw, -hh, 0), (hw, -hh, 0), (hw, hh, 0), (-hw, hh, 0)],
        [], [(0, 1, 2, 3)])
    ground = bpy.data.objects.new("BD_Ground", mesh)
    ground.data.materials.append(_mat_ground_pal(pal))
    sc.collection.objects.link(ground)

    _scatter_pal(sc, random.Random(11), pal)

    ld = bpy.data.lights.new("BD_Key", 'AREA')
    ld.energy = pal['key_energy']
    ld.size = 14.0
    ld.color = pal['key_color']
    key = bpy.data.objects.new("BD_Key", ld)
    key.location = (0.0, 0.0, 9.0)
    sc.collection.objects.link(key)

    fd = bpy.data.lights.new("BD_Fill", 'SUN')
    fd.energy = pal['fill_energy']
    fd.color = pal['fill_color']
    fill = bpy.data.objects.new("BD_Fill", fd)
    fill.location = (0.0, 0.0, 6.0)
    sc.collection.objects.link(fill)

    cam_data = bpy.data.cameras.new("BD_Cam")
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = max(PLANE_W, PLANE_H)
    cam = bpy.data.objects.new("BD_Cam", cam_data)
    cam.location = (0.0, 0.0, 12.0)
    sc.collection.objects.link(cam)
    sc.camera = cam

    sc.render.engine = _eevee_id()
    sc.render.resolution_x = RES_X
    sc.render.resolution_y = RES_Y
    sc.render.film_transparent = False
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGB'
    if hasattr(sc.eevee, "taa_render_samples"):
        sc.eevee.taa_render_samples = 64
    sc.view_settings.view_transform = 'Standard'
    return sc


def render_skin(skin_id, outdir):
    os.makedirs(outdir, exist_ok=True)
    sc = rebuild_skin(skin_id)
    path = os.path.join(outdir, f"backdrop_{skin_id}.png")
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True, scene=SCENE)
    return path


def render_all(outdir):
    return [render_skin(s, outdir) for s in PALETTES]
