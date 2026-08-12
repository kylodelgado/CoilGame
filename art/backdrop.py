"""
Coil — board backdrop generator for Blender 4.5 (EEVEE Next).

Renders the game board's ground: a dark terrarium floor — mossy soil with
faint stones — lit as a soft pool of light that falls off toward the edges,
so the vignette is baked into the image rather than composited in-game.

Design constraints, in order:
  1. DARK. The snake, food and UI read against this; nothing in the ground
     may compete with them. Values live in the bottom fifth of the range.
  2. LOW FREQUENCY. At gameplay speed fine detail is just noise; the texture
     works in soft metre-scale patches with only a whisper of grain.
  3. HUE-COHERENT. Everything is the skin's moss green family — the pool of
     light is the same hue lifted, never a new colour.

Builds into its OWN scene ("BACKDROP") with its own camera and light, so it
can live in the same .blend and the same Blender session as the snake without
either touching the other.

Usage (from Blender's python console or the MCP bridge):
    import backdrop; backdrop.rebuild(); backdrop.render_backdrop(outdir)
"""

import math

import bpy

SCENE = "BACKDROP"

# Board aspect: 16 x 21 cells. The plane is oversized ~8% so the camera never
# sees its edge even at the corners.
PLANE_W = 16.0
PLANE_H = 21.0
BLEED = 1.08

# Render size: one board-cell ends up ~64 px, plenty for a static ground.
RES_X = 1024
RES_Y = 1344


def _scene():
    sc = bpy.data.scenes.get(SCENE)
    if sc is None:
        sc = bpy.data.scenes.new(SCENE)
    return sc


def _clear(sc):
    for obj in list(sc.collection.objects):
        bpy.data.objects.remove(obj, do_unlink=True)


def _mat_ground():
    name = "MAT_Backdrop"
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

    # --- large moss patches -------------------------------------------------
    # Two octave scales of soft noise mixed between deep soil and moss green.
    # Both colours are near-black; the patchwork is a value shift of ~0.02,
    # visible as terrain, invisible as contrast.
    patches = nt.nodes.new("ShaderNodeTexNoise")
    patches.inputs["Scale"].default_value = 0.55
    patches.inputs["Detail"].default_value = 3.0
    patches.inputs["Roughness"].default_value = 0.55
    nt.links.new(tex.outputs["Object"], patches.inputs["Vector"])

    ramp = nt.nodes.new("ShaderNodeValToRGB")
    cr = ramp.color_ramp
    cr.interpolation = 'B_SPLINE'
    cr.elements[0].position = 0.30
    cr.elements[0].color = (0.010, 0.020, 0.012, 1.0)   # deep soil
    cr.elements[1].position = 0.62
    cr.elements[1].color = (0.022, 0.052, 0.026, 1.0)   # moss
    e = cr.elements.new(0.85)
    e.color = (0.034, 0.075, 0.038, 1.0)                # lit moss crown
    nt.links.new(patches.outputs["Fac"], ramp.inputs[0])

    # --- mossier centre -----------------------------------------------------
    # The moss itself thickens where the pool of light falls, fading out well
    # before the vignette takes over — so the middle reads as LIVING ground,
    # not just brighter dirt.
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
    mossy.inputs[2].default_value = (0.045, 0.098, 0.048, 1.0)
    nt.links.new(pool.outputs["Result"], mossy.inputs[0])
    nt.links.new(ramp.outputs["Color"], mossy.inputs[1])

    # --- sparse stones ------------------------------------------------------
    # Voronoi cells thresholded so only a scattering of cells survive; those
    # read as half-buried pebbles. Grey-green so they stay in family.
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
    stones.inputs[2].default_value = (0.040, 0.055, 0.046, 1.0)
    nt.links.new(stone_mask.outputs["Result"], stones.inputs[0])
    nt.links.new(mossy.outputs["Color"], stones.inputs[1])
    nt.links.new(stones.outputs["Color"], bsdf.inputs["Base Color"])

    # --- relief -------------------------------------------------------------
    # One bump stack: soft dunes from the patch noise + fine grain. The light
    # rakes it gently; this is where the ground stops being a flat fill.
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
    bump.inputs["Strength"].default_value = 0.60
    bump.inputs["Distance"].default_value = 0.22
    nt.links.new(relief.outputs["Color"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return m


def _mat_flat(name, color, rough=0.85):
    if name in bpy.data.materials:
        bpy.data.materials.remove(bpy.data.materials[name])
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1.0)
    b.inputs["Roughness"].default_value = rough
    if "Specular IOR Level" in b.inputs:
        b.inputs["Specular IOR Level"].default_value = 0.05
    return m


def _pebble_mesh(name="BD_PebbleMesh"):
    import bmesh
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.0)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    return me


def _leaf_mesh(name):
    """Pointed-oval leaf blade, length 1 along +X, as a single flat ngon."""
    pts = []
    n = 9
    for i in range(n + 1):
        s = i / n
        pts.append((s, 0.36 * math.sin(math.pi * s) ** 0.8))
    for i in range(n - 1, 0, -1):
        s = i / n
        pts.append((s, -0.36 * math.sin(math.pi * s) ** 0.8))
    me = bpy.data.meshes.new(name)
    me.from_pydata([(x, y, 0.0) for x, y in pts], [], [list(range(len(pts)))])
    return me


def _scatter(sc, rng):
    """
    Litter the floor with real geometry: half-buried pebbles that catch the
    key light on their crowns, and flat leaf blades in two tones. Real meshes
    rather than shader tricks so they cast actual soft shadows — the same
    reason the snake itself is a model. Counts and sizes are tuned to stay
    UNDER the snake: nothing here approaches a body segment's brightness, and
    a leaf is at most half a cell long.
    """
    for mn in ("BD_PebbleMesh", "BD_LeafA", "BD_LeafB"):
        if mn in bpy.data.meshes:
            bpy.data.meshes.remove(bpy.data.meshes[mn])
    hw, hh = PLANE_W / 2 * 0.97, PLANE_H / 2 * 0.97

    pebble = _pebble_mesh()
    pebble.materials.append(_mat_flat("MAT_Pebble", (0.052, 0.062, 0.054), 0.88))
    # Singles plus a few clusters — stones in nature keep company, and the
    # pairs/triples are what stop the scatter reading as polka dots.
    spots = [(rng.uniform(-hw, hw), rng.uniform(-hh, hh), 1) for _ in range(30)]
    for _ in range(7):
        cx, cy = rng.uniform(-hw, hw), rng.uniform(-hh, hh)
        spots.append((cx, cy, rng.randint(2, 3)))
    pi = 0
    for cx, cy, count in spots:
        for _ in range(count):
            r = rng.uniform(0.09, 0.28)
            ob = bpy.data.objects.new(f"BD_Pebble_{pi}", pebble)
            ob.location = (cx + rng.uniform(-0.35, 0.35),
                           cy + rng.uniform(-0.35, 0.35), -r * 0.30)
            ob.scale = (r * rng.uniform(0.8, 1.3), r * rng.uniform(0.8, 1.3),
                        r * 0.55)
            ob.rotation_euler = (0.0, 0.0, rng.uniform(0.0, 2 * math.pi))
            sc.collection.objects.link(ob)
            pi += 1

    leaf_a = _leaf_mesh("BD_LeafA")
    leaf_a.materials.append(_mat_flat("MAT_LeafOlive", (0.030, 0.052, 0.020), 0.80))
    leaf_b = _leaf_mesh("BD_LeafB")
    leaf_b.materials.append(_mat_flat("MAT_LeafBrown", (0.050, 0.038, 0.016), 0.80))
    # Half-a-cell-and-up blades: any smaller and a leaf renders as a fleck of
    # confetti instead of a shape.
    for i in range(52):
        me = leaf_a if rng.random() < 0.62 else leaf_b
        length = rng.uniform(0.45, 0.85)
        ob = bpy.data.objects.new(f"BD_Leaf_{i}", me)
        ob.location = (rng.uniform(-hw, hw), rng.uniform(-hh, hh), 0.012)
        ob.scale = (length, length * rng.uniform(0.8, 1.15), 1.0)
        ob.rotation_euler = (0.0, 0.0, rng.uniform(0.0, 2 * math.pi))
        sc.collection.objects.link(ob)


def rebuild():
    import random
    sc = _scene()
    _clear(sc)

    mesh = bpy.data.meshes.new("BD_GroundMesh")
    hw = PLANE_W * BLEED / 2
    hh = PLANE_H * BLEED / 2
    mesh.from_pydata(
        [(-hw, -hh, 0), (hw, -hh, 0), (hw, hh, 0), (-hw, hh, 0)],
        [], [(0, 1, 2, 3)])
    ground = bpy.data.objects.new("BD_Ground", mesh)
    ground.data.materials.append(_mat_ground())
    sc.collection.objects.link(ground)

    _scatter(sc, random.Random(11))

    # The pool of light: one big soft area lamp well above centre. Its natural
    # inverse-square falloff IS the vignette — no compositing needed.
    ld = bpy.data.lights.new("BD_Key", 'AREA')
    ld.energy = 1500.0
    ld.size = 14.0
    ld.color = (0.92, 1.0, 0.90)
    key = bpy.data.objects.new("BD_Key", ld)
    key.location = (0.0, 0.0, 9.0)
    sc.collection.objects.link(key)

    # Faint cool wash so the corners fall to a green-black, not a pure black.
    fd = bpy.data.lights.new("BD_Fill", 'SUN')
    fd.energy = 0.06
    fd.color = (0.70, 0.90, 0.80)
    fill = bpy.data.objects.new("BD_Fill", fd)
    fill.location = (0.0, 0.0, 6.0)
    sc.collection.objects.link(fill)

    cam_data = bpy.data.cameras.new("BD_Cam")
    cam_data.type = 'ORTHO'
    # ortho_scale spans the LARGER axis; frame the un-bled board exactly.
    cam_data.ortho_scale = max(PLANE_W, PLANE_H)
    cam = bpy.data.objects.new("BD_Cam", cam_data)
    cam.location = (0.0, 0.0, 12.0)
    sc.collection.objects.link(cam)
    sc.camera = cam

    sc.render.engine = 'BLENDER_EEVEE_NEXT'
    sc.render.resolution_x = RES_X
    sc.render.resolution_y = RES_Y
    sc.render.film_transparent = False
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGB'
    if hasattr(sc.eevee, "taa_render_samples"):
        sc.eevee.taa_render_samples = 64
    sc.view_settings.view_transform = 'Standard'
    return sc


def render_backdrop(outdir, name="backdrop.png"):
    import os
    os.makedirs(outdir, exist_ok=True)
    sc = rebuild()
    sc.render.filepath = os.path.join(outdir, name)
    # Render THIS scene regardless of which scene the window is showing.
    bpy.ops.render.render(write_still=True, scene=SCENE)
    return sc.render.filepath
