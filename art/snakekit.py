"""
Coil — snake asset generator for Blender 4.5 (EEVEE Next).

Designed to READ FROM A STRAIGHT-DOWN CAMERA (rotation-safe: one sprite that
the game can rotate freely to any heading).

The mouth problem, and how it's solved
--------------------------------------
A jaw that hinges in the vertical plane is nearly invisible from directly
above: both jaws foreshorten toward the same point and the maw never opens in
the silhouette. Splitting the snout sideways does open in plan view, but a
mouth doesn't work like that and it reads wrong.

So instead the WHOLE HEAD REARS BACK as it opens. Pitching the head up turns
the mouth aperture — which normally faces forward — to face the camera, and a
completely conventional jaw hinge then reads perfectly from above. It's also
what a snake actually does before it strikes, so the gape animation and the
anatomy agree.

Units: 1.0 == 1 grid cell.  +Y = forward (snout), +Z = up (toward camera).

Everything is bound with a plain Armature modifier + one full-weight vertex
group per bone (rigid), so the rig is trivial to pose and exports clean.
"""

import math

import bmesh
import bpy
from mathutils import Vector

# --------------------------------------------------------------------------
# tunables
# --------------------------------------------------------------------------

RING = 20          # verts per lofted cross-section (multiple of 4)
SE_P = 0.72        # superellipse exponent: <1 = boxy-round, 1 = ellipse

# Cranium centreline profile: (y, halfwidth, height above mouth-line, depth below)
# The "viper" read comes from the plan silhouette: narrow neck -> broad jowls ->
# a near-straight taper to a blunt snout.
CRANIUM = [
    (-0.80, 0.32, 0.22, 0.09),   # neck stub
    (-0.68, 0.50, 0.32, 0.10),
    (-0.54, 0.62, 0.38, 0.10),
    (-0.40, 0.67, 0.40, 0.10),   # widest — jowls
    (-0.22, 0.645, 0.41, 0.10),  # eye zone
    (-0.04, 0.575, 0.40, 0.10),
    (0.14, 0.490, 0.37, 0.09),
    (0.32, 0.405, 0.33, 0.09),
    (0.50, 0.335, 0.29, 0.08),
    (0.64, 0.275, 0.24, 0.07),
    (0.72, 0.200, 0.17, 0.055),
    (0.76, 0.100, 0.09, 0.035),  # blunt tip
]

NOSE_Y = 0.76        # snout tip
MOUTH_LINE = -0.02   # the seam the jaw opens along
# The tongue must ride ON TOP of the mouth floor, not inside the jaw slab below
# it, or it reads as emerging from under the chin instead of out of the mouth.
TONGUE_Z = MOUTH_LINE + 0.09
JAW_HINGE_Y = -0.34  # mouth corner
NECK_Y = -0.95       # where the head pivots when it rears

# How far the head rears is a direct trade: the cavity revealed to a top-down
# camera is length * (1 - cos(pitch)), but the head also foreshortens by cos.
# ~44 deg buys a clearly readable mouth without the head collapsing to a stub.
REST_PITCH = 0.0     # head pitch with the mouth shut
STRIKE_PITCH = 44.0  # ...and at full gape
# Dropping the jaw by ~the same angle the head rears keeps it lying flat and
# fully extended forward, which makes the revealed mouth band as deep as
# possible. Drop much less and the jaw follows the head up, closing the band.
JAW_DROP = 42.0      # lower jaw swing at full gape
MOUTH_INSET = 0.74   # mouth surfaces are narrower than the jaw that carries them

COL = "SNAKE"


# --------------------------------------------------------------------------
# small helpers
# --------------------------------------------------------------------------

def _collection():
    if COL in bpy.data.collections:
        return bpy.data.collections[COL]
    c = bpy.data.collections.new(COL)
    bpy.context.scene.collection.children.link(c)
    return c


def purge_all():
    """Nuke every object + orphan datablock so rebuilds are deterministic."""
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.armatures,
                  bpy.data.cameras, bpy.data.lights, bpy.data.actions,
                  bpy.data.node_groups, bpy.data.collections):
        for b in list(block):
            if b.users == 0:
                block.remove(b)


def superellipse(w, htop, hbot, n=RING, p=SE_P, ridge=0.0,
                 ridge_ang=52.0, ridge_w=20.0):
    """
    Closed (x, z) cross-section: rounded-boxy dome on top, shallower below.

    `ridge` adds a symmetric radial bulge centred on +/-`ridge_ang` degrees --
    the supraocular scale ridge. Growing it out of the cross-section rather than
    bolting on a separate box guarantees it merges with the skull instead of
    reading as a fin stuck to the side of the head.
    """
    pts = []
    for i in range(n):
        deg = 360.0 * i / n
        a = math.radians(deg)
        c, s = math.cos(a), math.sin(a)
        x = w * math.copysign(abs(c) ** p, c)
        h = htop if s >= 0 else hbot
        z = math.copysign(h * abs(s) ** p, s)
        if ridge > 0.0:
            d = min(abs(deg - ridge_ang), abs(deg - (180.0 - ridge_ang)))
            b = ridge * math.exp(-((d / ridge_w) ** 2))
            x *= 1.0 + b
            z *= 1.0 + b
        pts.append((x, z))
    return pts


def _lerp_curve(points, x):
    """Piecewise-linear lookup over [(x, y), ...] sorted by x."""
    if x <= points[0][0]:
        return points[0][1]
    if x >= points[-1][0]:
        return points[-1][1]
    for (x0, y0), (x1, y1) in zip(points, points[1:]):
        if x0 <= x <= x1:
            return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    return points[-1][1]


# Strength of the brow ridge along the head's length. Peaks over the eye zone:
# strong enough that the eyes read as set INTO sockets under a brow, which is
# most of what separates "reptile skull" from "smooth cone with eyes on it".
RIDGE = [(-0.66, 0.0), (-0.44, 0.15), (-0.22, 0.22), (-0.02, 0.17),
         (0.18, 0.08), (0.36, 0.0)]


def loft(name, sections, mat=None, smooth=True, subsurf=2):
    """
    sections: [(y, [(x, z), ...]), ...] — equal-length, consistently wound rings.
    Bridges consecutive rings into quads and caps both ends.
    """
    bm = bmesh.new()
    rings = []
    for y, pts in sections:
        rings.append([bm.verts.new((x, y, z)) for x, z in pts])
    bm.verts.ensure_lookup_table()

    n = len(rings[0])
    for a, b in zip(rings, rings[1:]):
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((a[i], a[j], b[j], b[i]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])

    bm.normal_update()
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()

    obj = bpy.data.objects.new(name, me)
    _collection().objects.link(obj)
    if smooth:
        for poly in me.polygons:
            poly.use_smooth = True
    if subsurf:
        m = obj.modifiers.new("Subsurf", 'SUBSURF')
        m.levels = subsurf
        m.render_levels = subsurf
    if mat:
        obj.data.materials.append(mat)
    return obj


def resample(profile, y0, y1, steps):
    """Linearly resample a (y, w, htop, hbot) profile over [y0, y1]."""
    ys = [p[0] for p in profile]

    def at(y, idx):
        if y <= ys[0]:
            return profile[0][idx]
        if y >= ys[-1]:
            return profile[-1][idx]
        for k in range(len(ys) - 1):
            if ys[k] <= y <= ys[k + 1]:
                f = (y - ys[k]) / (ys[k + 1] - ys[k])
                return profile[k][idx] + f * (profile[k + 1][idx] - profile[k][idx])
        return profile[-1][idx]

    out = []
    for i in range(steps + 1):
        y = y0 + (y1 - y0) * i / steps
        out.append((y, at(y, 1), at(y, 2), at(y, 3)))
    return out


def prim(kind, name, mat=None, **kw):
    getattr(bpy.ops.mesh, kind)(**kw)
    obj = bpy.context.active_object
    obj.name = name
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    _collection().objects.link(obj)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    if mat:
        obj.data.materials.append(mat)
    return obj


# --------------------------------------------------------------------------
# materials
# --------------------------------------------------------------------------

def mat_basic(name, color, rough=0.45, spec=0.5, emit=None, emit_str=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = spec
    if emit:
        bsdf.inputs["Emission Color"].default_value = (*emit, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emit_str
    return m


def mat_scales(name, dorsal, flank, rim=(0.02, 0.09, 0.06),
               cell=8.0, stretch_y=0.62, randomness=0.45,
               bump=0.70, groove=0.52, tint=0.14,
               flank_stop=0.22, dorsal_stop=0.48):
    """
    Snake scales.

    Three things stack to make individual scales actually visible at sprite
    size, and all three matter:
      1. BUMP off a voronoi "distance to edge" field — cell BORDERS, so the
         scales get real relief instead of the lumpy noise an F1-distance
         bump gives.
      2. GROOVE darkening from the same field, so every scale is outlined even
         where the lighting is flat. This is what survives downscaling.
      3. Per-cell TINT from the voronoi Color output, so no two scales are
         quite the same green — without it a regular cell grid reads as fabric.

    Underneath all of it the base colour is still driven by world-normal Z
    (facing up = bright dorsal, edge-on = dark flank, silhouette = near-black
    rim), which is what gives every piece the same round-tube read from
    straight above regardless of its size.
    """
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.42
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.55

    # --- base tube shading, from the world normal -------------------------
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    shade = nt.nodes.new("ShaderNodeValToRGB")
    cr = shade.color_ramp
    cr.interpolation = 'B_SPLINE'
    # Full dorsal colour by ~0.62 (about 50 deg off vertical), not 0.88: the
    # ramp is camera-relative, so a late dorsal stop turns the whole head a
    # different, darker green the moment it rears back.
    cr.elements[0].position = 0.02
    cr.elements[0].color = (*rim, 1.0)
    cr.elements[1].position = flank_stop
    cr.elements[1].color = (*flank, 1.0)
    cr.elements.new(dorsal_stop).color = (*dorsal, 1.0)
    nt.links.new(geo.outputs["Normal"], sep.inputs[0])
    nt.links.new(sep.outputs["Z"], shade.inputs[0])

    # --- scale cells ------------------------------------------------------
    tex = nt.nodes.new("ShaderNodeTexCoord")
    mapn = nt.nodes.new("ShaderNodeMapping")
    # Squashing Y stretches the cells ALONG the body, like real dorsal scales.
    mapn.inputs["Scale"].default_value = (1.0, stretch_y, 1.0)
    nt.links.new(tex.outputs["Object"], mapn.inputs["Vector"])

    edge = nt.nodes.new("ShaderNodeTexVoronoi")
    edge.feature = 'DISTANCE_TO_EDGE'
    edge.inputs["Scale"].default_value = cell
    edge.inputs["Randomness"].default_value = randomness
    nt.links.new(mapn.outputs["Vector"], edge.inputs["Vector"])

    cells = nt.nodes.new("ShaderNodeTexVoronoi")
    cells.feature = 'F1'
    cells.inputs["Scale"].default_value = cell
    cells.inputs["Randomness"].default_value = randomness
    nt.links.new(mapn.outputs["Vector"], cells.inputs["Vector"])

    # per-cell brightness jitter
    cell_rgb = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(cells.outputs["Color"], cell_rgb.inputs[0])
    jitter = nt.nodes.new("ShaderNodeMapRange")
    jitter.inputs["To Min"].default_value = 1.0 - tint
    jitter.inputs["To Max"].default_value = 1.0 + tint
    nt.links.new(cell_rgb.outputs["X"], jitter.inputs["Value"])

    tinted = nt.nodes.new("ShaderNodeMixRGB")
    tinted.blend_type = 'MULTIPLY'
    tinted.inputs[0].default_value = 1.0
    nt.links.new(shade.outputs["Color"], tinted.inputs[1])
    nt.links.new(jitter.outputs["Result"], tinted.inputs[2])

    # dark groove between scales
    gr = nt.nodes.new("ShaderNodeValToRGB")
    gcr = gr.color_ramp
    gcr.interpolation = 'EASE'
    gcr.elements[0].position = 0.0
    gcr.elements[0].color = (groove, groove, groove, 1.0)
    gcr.elements[1].position = 0.18
    gcr.elements[1].color = (1.0, 1.0, 1.0, 1.0)
    nt.links.new(edge.outputs["Distance"], gr.inputs[0])

    grooved = nt.nodes.new("ShaderNodeMixRGB")
    grooved.blend_type = 'MULTIPLY'
    grooved.inputs[0].default_value = 1.0
    nt.links.new(tinted.outputs["Color"], grooved.inputs[1])
    nt.links.new(gr.outputs["Color"], grooved.inputs[2])
    nt.links.new(grooved.outputs["Color"], bsdf.inputs["Base Color"])

    bmp = nt.nodes.new("ShaderNodeBump")
    bmp.inputs["Strength"].default_value = bump
    bmp.inputs["Distance"].default_value = 0.035
    nt.links.new(edge.outputs["Distance"], bmp.inputs["Height"])
    nt.links.new(bmp.outputs["Normal"], bsdf.inputs["Normal"])
    return m


# --------------------------------------------------------------------------
# body strip material
# --------------------------------------------------------------------------

# The strip texture tiles every TEX_CELLS along the body. Everything patterned
# below is built from periodic functions of object Y with a period that divides
# TEX_CELLS exactly, so the strip is seamless under plain REPEAT tiling. That
# matters beyond tidiness: mirror tiling flips the scales' overlap direction on
# every other tile, so the snake's skin visibly points the wrong way half the
# time.
# SCALE_ROWS must be EVEN, not merely an integer: alternate rows are staggered
# half a cell sideways, so an odd row count lands opposite parities on the two
# ends of the tile and puts a visible half-cell jog in the lattice at the seam.
SCALE_ROWS = 38        # scale rows per tile (even -> seamless)
SCALE_COLS = 19        # scale columns across the tube's full width
SCALE_AX = 0.60        # scale dome radius across, as a fraction of its cell
SCALE_AY = 0.66        # ...and along the body
# Blotches per tile. This is also how many DISTINCT blotches exist before the
# pattern repeats, since the jitter is keyed off the band index — hence a tile
# spanning three cells rather than two.
SADDLE_BANDS = 3       # dorsal saddle blotches per tile (integer -> seamless)


def _mth(nt, op, a, b=None, c=None, clamp=False):
    """One Math node, with unlinked inputs taking plain floats."""
    n = nt.nodes.new("ShaderNodeMath")
    n.operation = op
    n.use_clamp = clamp
    for i, v in enumerate((a, b, c)):
        if v is None:
            continue
        if isinstance(v, (int, float)):
            n.inputs[i].default_value = float(v)
        else:
            nt.links.new(v, n.inputs[i])
    return n.outputs[0]


def _range(nt, val, fmin, fmax, tmin, tmax, interp='SMOOTHSTEP'):
    """Map Range node — the workhorse for every smoothstep below."""
    n = nt.nodes.new("ShaderNodeMapRange")
    n.interpolation_type = interp
    n.clamp = True
    nt.links.new(val, n.inputs["Value"])
    for name, v in (("From Min", fmin), ("From Max", fmax),
                    ("To Min", tmin), ("To Max", tmax)):
        if isinstance(v, (int, float)):
            n.inputs[name].default_value = float(v)
        else:
            nt.links.new(v, n.inputs[name])
    return n.outputs["Result"]


def _mix(nt, fac, a, b, blend='MIX'):
    """MixRGB node; a/b may be sockets or RGB tuples."""
    n = nt.nodes.new("ShaderNodeMixRGB")
    n.blend_type = blend
    if isinstance(fac, (int, float)):
        n.inputs[0].default_value = float(fac)
    else:
        nt.links.new(fac, n.inputs[0])
    for i, v in enumerate((a, b), start=1):
        if isinstance(v, tuple):
            n.inputs[i].default_value = (*v, 1.0)
        else:
            nt.links.new(v, n.inputs[i])
    return n.outputs[0]


def _ramp(nt, val, stops, interp='EASE'):
    """ColorRamp from [(pos, (r,g,b)), ...]; first two stops reuse the defaults."""
    n = nt.nodes.new("ShaderNodeValToRGB")
    cr = n.color_ramp
    cr.interpolation = interp
    cr.elements[0].position, cr.elements[0].color = stops[0][0], (*stops[0][1], 1.0)
    cr.elements[1].position, cr.elements[1].color = stops[1][0], (*stops[1][1], 1.0)
    for pos, col in stops[2:]:
        cr.elements.new(pos).color = (*col, 1.0)
    nt.links.new(val, n.inputs[0])
    return n.outputs["Color"]


def _scale_lattice(nt, ox, oy, rows_per_unit, cols_per_unit, wrap_rows=0):
    """
    A staggered lattice of overlapping scale domes — the imbricated pattern real
    snakes have, and (unlike a voronoi) exactly periodic along the body.

    Returns (height, groove, cell_id). `height` is the dome, biased so each
    scale's POSTERIOR edge sits proudest: scales shingle backwards, and that
    asymmetry is the whole reason a snake's skin reads as directional at all.
    `groove` is the darkening that survives downscaling to sprite size.

    Densities are given per world unit (== per grid cell) rather than per tile,
    so the head and the body can be handed the SAME numbers and end up with
    scales of the same physical size. They are different meshes rendered at
    different framings, and nothing else keeps their skin looking like one
    animal's.

    `wrap_rows` folds the per-scale tint back on itself for tiling surfaces;
    pass 0 on anything that does not tile.
    """
    # Row index and the fraction within the row.
    row = _mth(nt, 'MULTIPLY', oy, rows_per_unit)
    ry = _mth(nt, 'WRAP', row, 1.0, 0.0)
    ridx = _mth(nt, 'FLOOR', row)
    # Alternate rows shift half a cell across — that stagger is what makes the
    # lattice read as scales rather than as a chequerboard.
    parity = _mth(nt, 'WRAP', ridx, 2.0, 0.0)
    col = _mth(nt, 'MULTIPLY', ox, cols_per_unit)
    col = _mth(nt, 'ADD', col, _mth(nt, 'MULTIPLY', parity, 0.5))
    rx = _mth(nt, 'WRAP', col, 1.0, 0.0)

    # Elliptical distance from the cell centre.
    dx = _mth(nt, 'DIVIDE', _mth(nt, 'SUBTRACT', rx, 0.5), SCALE_AX)
    dy = _mth(nt, 'DIVIDE', _mth(nt, 'SUBTRACT', ry, 0.5), SCALE_AY)
    d = _mth(nt, 'SQRT', _mth(nt, 'ADD',
                              _mth(nt, 'MULTIPLY', dx, dx),
                              _mth(nt, 'MULTIPLY', dy, dy)))

    # Flat-topped, not a bubble: the falloff is confined to the outer third of
    # the cell so each scale has a plateau and a defined rim. A dome that eases
    # all the way from the centre renders as bubble wrap.
    dome = _range(nt, d, 0.98, 0.55, 0.0, 1.0)
    # Posterior (-Y, i.e. low ry) edge raised: the free edge of each shingle.
    shingle = _range(nt, ry, 0.0, 1.0, 1.0, 0.70, interp='LINEAR')
    height = _mth(nt, 'MULTIPLY', dome, shingle)
    groove = _range(nt, d, 0.74, 1.00, 1.0, 0.74)

    # Per-scale tint. Cell ids are wrapped to the tile so the jitter is periodic
    # too — an unwrapped hash would put a seam of odd-coloured scales at the
    # tile boundary.
    wn = nt.nodes.new("ShaderNodeTexWhiteNoise")
    wn.noise_dimensions = '2D'
    comb = nt.nodes.new("ShaderNodeCombineXYZ")
    rid = _mth(nt, 'WRAP', ridx, float(wrap_rows), 0.0) if wrap_rows else ridx
    nt.links.new(rid, comb.inputs["X"])
    nt.links.new(_mth(nt, 'FLOOR', col), comb.inputs["Y"])
    nt.links.new(comb.outputs["Vector"], wn.inputs["Vector"])
    return height, groove, wn.outputs["Value"]


def _saddles(nt, oy, xn, hw_mid=0.21, hw_edge=0.115, reach=0.70, fade=0.47):
    """
    Dorsal saddle blotches: dark lens-shaped bands, widest over the spine and
    pinching as they wrap down the flanks.

    This is the single biggest cartoon-snake cue — a uniformly green tube has no
    features for the eye to track, so it reads as a static noodle no matter how
    well it is shaded. Bands give the motion something to move.

    The blotch half-width tapers with a SMOOTHSTEP across the body, not
    linearly: a linear taper makes the band's edge a straight diagonal in
    (across, along) space, so the blotches render as hard mechanical chevrons
    instead of the rounded lens shape an animal has.
    """
    sy = _mth(nt, 'MULTIPLY', oy, SADDLE_BANDS / TEX_CELLS)

    # Per-blotch jitter. Identically sized blotches at a fixed pitch read as a
    # machined hose, not an animal — the eye locks onto the regularity instantly
    # at speed. Keying the jitter off the WRAPPED band index keeps the variation
    # periodic over the tile, so the strip stays seamless while still looking
    # hand-drawn.
    bidx = _mth(nt, 'WRAP', _mth(nt, 'FLOOR', sy), float(SADDLE_BANDS), 0.0)
    wn = nt.nodes.new("ShaderNodeTexWhiteNoise")
    wn.noise_dimensions = '1D'
    nt.links.new(bidx, wn.inputs["W"])
    jit = wn.outputs["Value"]

    centre = _range(nt, jit, 0.0, 1.0, 0.42, 0.58, interp='LINEAR')
    sd = _mth(nt, 'ABSOLUTE', _mth(nt, 'SUBTRACT',
                                   _mth(nt, 'WRAP', sy, 1.0, 0.0), centre))
    grow = _range(nt, jit, 0.0, 1.0, 0.72, 1.0, interp='LINEAR')
    # Held near-constant across the dorsal half before tapering. Tapering from
    # the midline outward (the obvious reading of "widest over the spine")
    # sharpens both ends of the blotch into points, and a row of dark points
    # reads as holes punched through the body rather than as pigment on it.
    hw = _mth(nt, 'MULTIPLY', _range(nt, xn, 0.35, reach, hw_mid, hw_edge), grow)

    inside = _range(nt, sd, _mth(nt, 'SUBTRACT', hw, 0.035), hw, 1.0, 0.0)
    # Fade the blotch out before it reaches the silhouette. The flanks are
    # already almost black from the form ramp, so a saddle that runs all the way
    # to the edge simply merges into them and reads as a PINCH in the body
    # rather than as a marking on it.
    inside = _mth(nt, 'MULTIPLY', inside, _range(nt, xn, reach, fade, 0.0, 1.0))
    # A thin bright keyline hugging each blotch. Without it the dark band just
    # muddies into the flank shading; with it the marking reads as drawn. It has
    # to stay genuinely THIN — widen it and it stops being a line and becomes a
    # second, blown-out band competing with the blotch it is meant to define.
    edge = _mth(nt, 'MULTIPLY',
                _range(nt, sd, hw, _mth(nt, 'ADD', hw, 0.010), 0.0, 1.0),
                _range(nt, sd, _mth(nt, 'ADD', hw, 0.022),
                       _mth(nt, 'ADD', hw, 0.040), 1.0, 0.0))
    return inside, edge


def mat_body_strip(name="MAT_BodyStrip",
                   rim=(0.008, 0.030, 0.028),
                   flank=(0.022, 0.115, 0.075),
                   mid=(0.068, 0.335, 0.170),
                   dorsal=(0.195, 0.605, 0.272),
                   spine=(0.345, 0.790, 0.380),
                   saddle=(0.170, 0.270, 0.250),
                   keyline=(0.520, 0.880, 0.450),
                   gloss=(0.760, 0.980, 0.780),
                   tint=0.055, bump=0.42, key_amt=0.16, saddle_kw=None):
    """
    The body tube's own material — deliberately NOT shared with the head.

    The head is a rotating sprite whose shading has to survive being pitched up
    to strike, which forces a shallow, forgiving normal ramp. The body tube
    never tilts, so it can afford a ramp that sweeps the FULL width: near-black
    at the silhouette through to a hot spine highlight. That full sweep is what
    turns a flat green strip into something with a round cross-section.

    On top of the form sit three pattern layers — imbricated scales, dorsal
    saddles, and a wet gloss that tightens toward the spine.
    """
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    half = 0.5 * (1.0 + TEX_BLEED)

    tex = nt.nodes.new("ShaderNodeTexCoord")
    obj = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tex.outputs["Object"], obj.inputs[0])
    ox, oy = obj.outputs["X"], obj.outputs["Y"]

    # --- form: the round-tube read ------------------------------------------
    # Driven by ACROSS-BODY POSITION, not by the surface normal's Z. On a tube
    # this shallow the normal is a badly behaved control: nz is still 0.68 at
    # three-quarters of the way to the silhouette and only reaches the dark end
    # of its range in the final 1% of the width. Ramp stops placed against it
    # therefore bunch every dark tone into a hairline at the very edge and leave
    # the whole visible body sitting in the two brightest stops — which is
    # exactly what renders as a flat green noodle with a thin outline.
    #
    # Object X is linear across the frame, so a stop at 0.62 lands at 62% of the
    # half-width, and the falloff curve becomes something authored rather than
    # inherited from the cross-section.
    xn = _mth(nt, 'DIVIDE', _mth(nt, 'ABSOLUTE', ox), half, clamp=True)
    # Mid/flank stops pulled inboard vs the obvious even spacing: the darkening
    # has to be well under way by two-thirds width or the tube reads flat, and
    # the eye accepts a much steeper falloff than a real cylinder would give.
    form = _ramp(nt, xn, [(0.00, spine), (0.24, dorsal), (0.52, mid),
                          (0.78, flank), (1.00, rim)], interp='LINEAR')

    # --- scales -------------------------------------------------------------
    height, groove, cell_id = _scale_lattice(
        nt, ox, oy, SCALE_ROWS / TEX_CELLS, SCALE_COLS / (2.0 * half),
        wrap_rows=SCALE_ROWS)
    jitter = _range(nt, cell_id, 0.0, 1.0, 1.0 - tint, 1.0 + tint,
                    interp='LINEAR')
    col = _mix(nt, 1.0, form, jitter, blend='MULTIPLY')
    col = _mix(nt, 1.0, col, groove, blend='MULTIPLY')

    # --- saddles ------------------------------------------------------------
    inside, edge = _saddles(nt, oy, xn, **(saddle_kw or {}))
    col = _mix(nt, inside, col, _mix(nt, 1.0, col, saddle, blend='MULTIPLY'))
    col = _mix(nt, _mth(nt, 'MULTIPLY', edge, key_amt), col, keyline)

    # --- gloss ---------------------------------------------------------------
    # Painted straight into the albedo rather than left to the BSDF's specular.
    # A real specular highlight on a tube this glossy blows out to white across
    # the entire dorsal band and takes the scale bump with it, turning the strip
    # milky. Authoring the sheen as an explicit narrow band means its width and
    # strength are exactly what they are set to, and it can never clip.
    sheen = _mth(nt, 'MULTIPLY', _range(nt, xn, 0.30, 0.02, 0.0, 1.0), 0.42)
    # Dulled over the blotches — pigment there is matte, and letting the sheen
    # run at full strength across a saddle erases the marking it crosses.
    sheen = _mth(nt, 'MULTIPLY', sheen,
                 _range(nt, inside, 0.0, 1.0, 1.0, 0.40, interp='LINEAR'))
    col = _mix(nt, sheen, col, gloss)
    nt.links.new(col, bsdf.inputs["Base Color"])

    # Matte enough that the light rig contributes shape, not glare.
    nt.links.new(_range(nt, xn, 0.0, 1.0, 0.55, 0.88, interp='LINEAR'),
                 bsdf.inputs["Roughness"])
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.20

    bmp = nt.nodes.new("ShaderNodeBump")
    bmp.inputs["Strength"].default_value = bump
    bmp.inputs["Distance"].default_value = 0.022
    nt.links.new(height, bmp.inputs["Height"])
    nt.links.new(bmp.outputs["Normal"], bsdf.inputs["Normal"])
    return m


def mat_body_normal(name="MAT_BodyNormal", bump=0.42):
    """
    World-normal-as-colour bake material for the body tube, scale bump
    included: colour = normal * 0.5 + 0.5, emitted flat so lighting cannot
    touch it. On the rest-pose tube, world axes coincide with the ribbon's
    tangent frame, so the render IS a tangent-space normal strip: R = across
    the body, G = along it, B = toward the camera.
    """
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        if n.type != 'OUTPUT_MATERIAL':
            nt.nodes.remove(n)
    out = nt.nodes["Material Output"]
    em = nt.nodes.new("ShaderNodeEmission")
    nt.links.new(em.outputs["Emission"], out.inputs["Surface"])

    half = 0.5 * (1.0 + TEX_BLEED)
    tex = nt.nodes.new("ShaderNodeTexCoord")
    obj = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tex.outputs["Object"], obj.inputs[0])
    height, _groove, _cid = _scale_lattice(
        nt, obj.outputs["X"], obj.outputs["Y"],
        SCALE_ROWS / TEX_CELLS, SCALE_COLS / (2.0 * half),
        wrap_rows=SCALE_ROWS)

    bmp = nt.nodes.new("ShaderNodeBump")
    bmp.inputs["Strength"].default_value = bump
    bmp.inputs["Distance"].default_value = 0.022
    nt.links.new(height, bmp.inputs["Height"])

    enc = nt.nodes.new("ShaderNodeVectorMath")
    enc.operation = 'MULTIPLY_ADD'
    enc.inputs[1].default_value = (0.5, 0.5, 0.5)
    enc.inputs[2].default_value = (0.5, 0.5, 0.5)
    nt.links.new(bmp.outputs["Normal"], enc.inputs[0])
    nt.links.new(enc.outputs["Vector"], em.inputs["Color"])
    return m


def mat_head_scales(name="MAT_HeadScale",
                    rim=(0.012, 0.052, 0.040),
                    flank=(0.030, 0.150, 0.092),
                    mid=(0.075, 0.350, 0.180),
                    dorsal=(0.195, 0.605, 0.272),
                    crown=(0.175, 0.275, 0.255),
                    tint=0.055, bump=0.55,
                    flank_stop=0.26, dorsal_stop=0.60):
    """
    The head's skin, matched to the body's.

    Shares the body's scale lattice at the SAME per-cell density, so the skin
    is continuous across the neck instead of the head wearing a visibly
    different material. It also carries a dark crown patch, which is what stops
    a blotched body ending in a plain green head — the two read as one animal
    only if the head is marked too.

    Unlike the body, the base shading here stays keyed to the world normal and
    keeps a SHALLOW ramp. The head is a sprite that rears up to strike, and the
    ramp is camera-relative: a steep one repaints the whole skull a darker green
    the instant it pitches back, which flickers as the bite animation plays.
    """
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.42

    tex = nt.nodes.new("ShaderNodeTexCoord")
    obj = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tex.outputs["Object"], obj.inputs[0])
    ox, oy = obj.outputs["X"], obj.outputs["Y"]

    geo = nt.nodes.new("ShaderNodeNewGeometry")
    nrm = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(geo.outputs["Normal"], nrm.inputs[0])
    form = _ramp(nt, nrm.outputs["Z"],
                 [(0.02, rim), (flank_stop, flank),
                  (dorsal_stop, mid), (0.92, dorsal)], interp='B_SPLINE')

    # Wet-gloss roughness: tight highlights on the dorsal surfaces, matte on
    # the flanks. A single constant roughness is exactly what makes the head
    # read as moulded rubber — real (and toy) reptiles are shiniest where the
    # light rakes their back.
    nt.links.new(_range(nt, nrm.outputs["Z"], 0.30, 1.00, 0.58, 0.30,
                        interp='LINEAR'), bsdf.inputs["Roughness"])

    height, groove, cell_id = _scale_lattice(
        nt, ox, oy, SCALE_ROWS / TEX_CELLS, SCALE_COLS / (2.0 * half_unit()))
    jitter = _range(nt, cell_id, 0.0, 1.0, 1.0 - tint, 1.0 + tint,
                    interp='LINEAR')
    col = _mix(nt, 1.0, form, jitter, blend='MULTIPLY')
    col = _mix(nt, 1.0, col, groove, blend='MULTIPLY')

    # --- cavity darkening -------------------------------------------------
    # Raytraced AO multiplied into the albedo. The head is all soft convex
    # forms, so the only places this bites are the eye sockets, under the brow
    # ridge, the mouth seam and the neck tuck — exactly the crevices that need
    # to go dark for the shape to read as volume instead of a decal. Floored
    # well above black so it shades, never outlines.
    ao = nt.nodes.new("ShaderNodeAmbientOcclusion")
    ao.inputs["Distance"].default_value = 0.30
    occ = _range(nt, ao.outputs["AO"], 0.0, 1.0, 0.42, 1.0, interp='LINEAR')
    col = _mix(nt, 1.0, col, occ, blend='MULTIPLY')

    # --- grazing iridescence ----------------------------------------------
    # A faint teal shift where the surface turns away from the camera. Kept
    # weak and DARK so it layers into the flank shading instead of eating the
    # silhouette rim that gives the sprite its outline.
    lw = nt.nodes.new("ShaderNodeLayerWeight")
    lw.inputs["Blend"].default_value = 0.35
    iri = _mth(nt, 'MULTIPLY', lw.outputs["Facing"], 0.28)
    col = _mix(nt, iri, col, (0.10, 0.34, 0.40))

    # Crown patch: a broad dark band across the jowls, set just BEHIND the eyes.
    # Placed over them it would dirty the face and fight the one feature that
    # has to stay legible at sprite size; sitting behind them it frames the face
    # and gives the head a marking to answer the body's blotches, so the two
    # stop looking like different animals.
    #
    # Centred at y = -0.34, which is as far back as it can go and still be SEEN:
    # the skull-base collar occludes the cranium behind roughly y = -0.5, so a
    # band placed on the actual back of the skull renders entirely inside
    # geometry the camera never sees.
    dx = _mth(nt, 'DIVIDE', ox, 1.05)
    dy = _mth(nt, 'DIVIDE', _mth(nt, 'ADD', oy, 0.34), 0.26)
    d = _mth(nt, 'SQRT', _mth(nt, 'ADD',
                              _mth(nt, 'MULTIPLY', dx, dx),
                              _mth(nt, 'MULTIPLY', dy, dy)))
    patch = _range(nt, d, 0.62, 1.12, 1.0, 0.0)
    col = _mix(nt, patch, col, _mix(nt, 1.0, col, crown, blend='MULTIPLY'))
    nt.links.new(col, bsdf.inputs["Base Color"])

    bmp = nt.nodes.new("ShaderNodeBump")
    bmp.inputs["Strength"].default_value = bump
    bmp.inputs["Distance"].default_value = 0.030
    nt.links.new(height, bmp.inputs["Height"])
    nt.links.new(bmp.outputs["Normal"], bsdf.inputs["Normal"])
    return m


def half_unit():
    """The body tube's half-width — the reference for scale column density."""
    return 0.5 * (1.0 + TEX_BLEED)


def build_materials():
    return {
        # Head: a SHALLOW ramp (full dorsal by ~50 deg off vertical). The ramp
        # is camera-relative, so a steep one turns the whole head a darker
        # green the moment it rears back to strike.
        "scale": mat_head_scales(),
        # Body: a STEEP ramp. The body never tilts, and it needs the shading to
        # gradate right across the tube or it renders as a flat green strip.
        "scale_body": mat_scales("MAT_ScaleBody", (0.10, 0.47, 0.21),
                                 (0.020, 0.135, 0.075),
                                 flank_stop=0.52, dorsal_stop=0.93),
        # The strip tube gets its own material — see mat_body_strip for why it
        # can use a far steeper ramp than anything that has to rotate.
        "body_strip": mat_body_strip(),
        "mouth": mat_basic("MAT_Mouth", (0.30, 0.045, 0.075), rough=0.45),
        "throat": mat_basic("MAT_Throat", (0.075, 0.010, 0.025), rough=0.7),
        "fang": mat_basic("MAT_Fang", (0.97, 0.96, 0.90), rough=0.20, spec=0.9),
        "eye": mat_basic("MAT_Eye", (0.98, 0.72, 0.09), rough=0.10, spec=1.0),
        "pupil": mat_basic("MAT_Pupil", (0.015, 0.015, 0.02), rough=0.1, spec=1.0),
        "glint": mat_basic("MAT_Glint", (1.0, 1.0, 1.0), rough=0.05,
                           emit=(1.0, 1.0, 1.0), emit_str=1.4),
        "tongue": mat_basic("MAT_Tongue", (0.93, 0.20, 0.34), rough=0.28),
        "nostril": mat_basic("MAT_Nostril", (0.015, 0.045, 0.035), rough=0.65),
    }


# --------------------------------------------------------------------------
# geometry
# --------------------------------------------------------------------------

def build_cranium(M):
    """Upper head, one solid piece. Sits entirely above the mouth line."""
    secs = [(y, superellipse(w, ht, 0.06, ridge=_lerp_curve(RIDGE, y)))
            for y, w, ht, _hb in resample(CRANIUM, -0.80, NOSE_Y, 26)]
    obj = loft("SNK_Cranium", secs, M["scale"])
    obj.location.z = MOUTH_LINE + 0.06
    return obj


def build_lower_jaw(M):
    """Lower jaw: the belly slab of the head, hinged at the mouth corner."""
    secs = [(y, superellipse(w * 0.965, 0.02, hb + 0.06))
            for y, w, _ht, hb in resample(CRANIUM, JAW_HINGE_Y - 0.02,
                                          NOSE_Y - 0.01, 14)]
    obj = loft("SNK_Jaw", secs, M["scale"])
    obj.location.z = MOUTH_LINE - 0.02
    return obj


def build_mouth_surfaces(M):
    """
    Palate (roof, on the cranium) and floor (on the jaw), as thin slabs INSET
    from the head's width.

    Inset matters: colouring the jaw's whole top surface instead turns the
    entire lower jaw red from above, so nothing frames the cavity and the head
    reads as one flat pink blob. Leaving a green rim around the opening is what
    makes it read as a mouth.

    Each slab straddles the mouth line rather than sitting wholly inside its
    parent: the floor pokes slightly ABOVE the jaw's top so it is what you see
    once the cranium retracts (buried inside the jaw it is never visible at
    all), and the roof hangs slightly BELOW the cranium. When the mouth shuts
    each one hides inside the opposite, wider half.
    """
    roof = loft("SNK_Palate",
                [(y, superellipse(w * MOUTH_INSET, 0.05, 0.03))
                 for y, w, _ht, _hb in resample(CRANIUM, JAW_HINGE_Y,
                                                NOSE_Y - 0.05, 12)],
                M["mouth"], subsurf=1)
    roof.location.z = MOUTH_LINE - 0.01

    floor = loft("SNK_MouthFloor",
                 [(y, superellipse(w * MOUTH_INSET, 0.03, 0.05))
                  for y, w, _ht, _hb in resample(CRANIUM, JAW_HINGE_Y,
                                                 NOSE_Y - 0.05, 12)],
                 M["mouth"], subsurf=1)
    floor.location.z = MOUTH_LINE + 0.005
    return [roof, floor]


# Neck collar: (y, halfwidth). Sized to the BODY tube, not to the cranium's
# tapering rear, so the game's body ribbon can run underneath it and stay
# hidden — a neck narrower than the body leaves the first body segment's
# corners poking out around the head. It also has to stop just past the second
# cell centre: any longer and the straight collar juts out of a curving body on
# a turn, because the head sprite is rigid.
NECK = [(-0.50, 0.560), (-0.62, 0.532), (-0.75, 0.494), (-0.89, 0.464)]
# Height ratios shared with the body tube. Domed rather than flat: a shallow
# cross-section keeps its normal pointing straight up across nearly the whole
# width, so the shading never gradates and the body reads as a flat strip.
NECK_TOP, NECK_BOT = 0.62, 0.42


def build_skull_base(M):
    """
    Body-width neck collar. Stays flat on the ground while the head rears, so
    the head lifts off it instead of the whole snake tipping up.
    """
    secs = [(y, superellipse(w, w * NECK_TOP, w * NECK_BOT, p=BODY_P))
            for y, w in NECK]
    return loft("SNK_SkullBase", secs, M["scale"])


def build_throat(M):
    o = prim("primitive_uv_sphere_add", "SNK_Throat", M["throat"],
             radius=1.0, segments=20, ring_count=12,
             location=(0.0, -0.20, MOUTH_LINE - 0.05))
    o.scale = (0.30, 0.24, 0.11)
    return o


def build_eyes(M):
    out = []
    for side, tag in ((1, "L"), (-1, "R")):
        eye = prim("primitive_uv_sphere_add", f"SNK_Eye_{tag}", M["eye"],
                   radius=1.0, segments=24, ring_count=16,
                   location=(side * 0.345, -0.16, 0.300))
        eye.scale = (0.200, 0.230, 0.195)
        out.append(eye)

        # Slit pupil sitting on TOP of the eyeball so it reads from straight down.
        pup = prim("primitive_uv_sphere_add", f"SNK_Pupil_{tag}", M["pupil"],
                   radius=1.0, segments=16, ring_count=10,
                   location=(side * 0.352, -0.16, 0.455))
        pup.scale = (0.052, 0.125, 0.048)
        out.append(pup)

        # Tiny offset highlight — cheap, but it's what stops the eye reading as
        # a flat sticker once the sprite is scaled down to cell size.
        gl = prim("primitive_uv_sphere_add", f"SNK_Glint_{tag}", M["glint"],
                  radius=1.0, segments=12, ring_count=8,
                  location=(side * 0.300, -0.075, 0.452))
        gl.scale = (0.040, 0.048, 0.030)
        out.append(gl)
    return out


def build_nostrils(M):
    """
    Two small dark pits at the snout tip. Besides the eyes they are the only
    facial feature a straight-down camera can see, and they anchor which end
    is the front — without them the closed-mouth head is just a green wedge.
    Mostly buried in the snout so only a sliver shows: a full dark dot reads
    as a second pair of eyes at sprite size.
    """
    out = []
    for side, tag in ((1, "L"), (-1, "R")):
        n = prim("primitive_uv_sphere_add", f"SNK_Nostril_{tag}", M["nostril"],
                 radius=1.0, segments=12, ring_count=8,
                 location=(side * 0.105, 0.600, 0.310))
        n.scale = (0.032, 0.048, 0.022)
        n.rotation_euler = (0.0, 0.0, side * math.radians(18.0))
        out.append(n)
    return out


def build_fangs(M):
    """Hang from the upper jaw; swing into view as the head rears."""
    out = []
    for side, tag in ((1, "L"), (-1, "R")):
        f = prim("primitive_cone_add", f"SNK_Fang_{tag}", M["fang"],
                 vertices=14, radius1=0.070, radius2=0.006, depth=0.34,
                 location=(side * 0.185, 0.54, MOUTH_LINE - 0.10))
        f.rotation_euler = (math.radians(192.0), 0.0, side * math.radians(-7.0))
        out.append(f)
    return out


def build_tongue(M):
    """Y-forked tongue: a shaft that splits into two diverging tips."""
    def bar(name, pts):
        secs = []
        for y, cx, r in pts:
            secs.append((y, [(cx + x, z) for x, z in superellipse(r, r, r)]))
        return loft(name, secs, M["tongue"], subsurf=1)

    shaft = bar("SNK_Tongue", [(-0.22, 0.0, 0.062), (0.02, 0.0, 0.062),
                               (0.20, 0.0, 0.056), (0.32, 0.0, 0.048)])
    forks = [
        bar("SNK_TongueForkL", [(0.28, 0.024, 0.044), (0.44, 0.088, 0.032),
                                (0.58, 0.150, 0.018), (0.66, 0.186, 0.005)]),
        bar("SNK_TongueForkR", [(0.28, -0.024, 0.044), (0.44, -0.088, 0.032),
                                (0.58, -0.150, 0.018), (0.66, -0.186, 0.005)]),
    ]

    bpy.ops.object.select_all(action='DESELECT')
    for f in forks:
        f.select_set(True)
    shaft.select_set(True)
    bpy.context.view_layer.objects.active = shaft
    bpy.ops.object.join()
    shaft.location.z = TONGUE_Z
    return shaft


BODY_P = 0.88   # rounder cross-section than the head — boxy beads don't chain
# How much wider than its render frame the texture tube is drawn.
TEX_BLEED = 0.015
# Body length (in cells) covered by one tile of the body strip texture.
# Must match TEX_CELLS in src/render/Snake3DBody.tsx.
TEX_CELLS = 3.0


def build_body(M):
    """
    One body bead + a tapering tail, drawn chained along the path in-game.

    Flat-topped and near-constant-width through the middle: tall round beads
    overlap into a string of balls, a broad low profile overlaps into a tube.
    """
    seg_pts = [(-0.58, 0.330, 0.120, 0.080), (-0.42, 0.450, 0.175, 0.120),
               (-0.22, 0.495, 0.200, 0.140), (0.00, 0.500, 0.205, 0.145),
               (0.22, 0.495, 0.200, 0.140), (0.42, 0.450, 0.175, 0.120),
               (0.58, 0.330, 0.120, 0.080)]
    seg = loft("SNK_BodySeg",
               [(y, superellipse(w, ht, hb, p=BODY_P)) for y, w, ht, hb in seg_pts],
               M["scale_body"])
    seg.location.x = 3.0

    tail_pts = [(-0.80, 0.500, 0.250, 0.165), (-0.30, 0.455, 0.228, 0.152),
                (0.20, 0.360, 0.180, 0.122), (0.62, 0.235, 0.118, 0.082),
                (0.88, 0.120, 0.062, 0.045), (1.00, 0.030, 0.016, 0.012)]
    tail = loft("SNK_Tail",
                [(y, superellipse(w, ht, hb, p=BODY_P)) for y, w, ht, hb in tail_pts],
                M["scale_body"])
    # Parked far enough apart that no piece bleeds into another's render frame.
    tail.location.x = 7.0

    # A long straight tube, rendered edge-to-edge into a strip texture that the
    # game maps across its body ribbon. Slightly WIDER than the render frame so
    # the strip's left/right pixels are fully opaque tube rather than half-
    # covered antialiased silhouette — the game's own outline supplies the AA.
    # A near-semicircular section (p=1, height ~= halfwidth), NOT the boxy
    # profile used elsewhere: on a flat-topped tube the normal points straight
    # up across most of the width and the shading only breaks at the very
    # edge, so the strip renders flat. A round section sweeps the gradient
    # across the whole width, which is what reads as a tube.
    r = 0.5 * (1.0 + TEX_BLEED)
    tube = loft("SNK_BodyTube",
                [(y, superellipse(r, r * 0.95, r * 0.55, p=1.0))
                 for y in (-3.0, -1.5, 0.0, 1.5, 3.0)],
                M["body_strip"])
    tube.location.x = 12.0
    return [seg, tail, tube]


# --------------------------------------------------------------------------
# rig
# --------------------------------------------------------------------------

BONES = [
    # name,        head,                          tail,                          parent
    ("root",       (0.0, -1.35, 0.0),             (0.0, -1.05, 0.0),             None),
    # head_base is the REAR pivot: rotating it tips the whole head up so the
    # mouth aperture turns to face the camera.
    ("head_base",  (0.0, NECK_Y, 0.05),           (0.0, NECK_Y + 0.30, 0.05),    "root"),
    ("jaw",        (0.0, JAW_HINGE_Y, MOUTH_LINE), (0.0, 0.08, MOUTH_LINE),      "head_base"),
    ("tongue_01",  (0.0, -0.12, TONGUE_Z),         (0.0, 0.28, TONGUE_Z),         "jaw"),
    ("tongue_02",  (0.0, 0.28, TONGUE_Z),          (0.0, 0.72, TONGUE_Z),         "tongue_01"),
]

# object name -> bone it rigidly follows
BINDING = {
    "SNK_Cranium": "head_base",
    "SNK_Eye_L": "head_base", "SNK_Eye_R": "head_base",
    "SNK_Pupil_L": "head_base", "SNK_Pupil_R": "head_base",
    "SNK_Glint_L": "head_base", "SNK_Glint_R": "head_base",
    "SNK_Nostril_L": "head_base", "SNK_Nostril_R": "head_base",
    "SNK_Fang_L": "head_base", "SNK_Fang_R": "head_base",
    "SNK_Throat": "head_base",
    "SNK_Palate": "head_base",
    "SNK_Jaw": "jaw",
    "SNK_MouthFloor": "jaw",
    # Neck rides `root`, NOT head_base, so it stays put while the head rears.
    "SNK_SkullBase": "root",
}


def build_rig():
    arm_data = bpy.data.armatures.new("SNK_Armature")
    arm = bpy.data.objects.new("SNK_Rig", arm_data)
    _collection().objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    made = {}
    for name, head, tail, parent in BONES:
        b = arm_data.edit_bones.new(name)
        b.head, b.tail = Vector(head), Vector(tail)
        if parent:
            b.parent = made[parent]
        made[name] = b
    bpy.ops.object.mode_set(mode='OBJECT')
    return arm


def bind_rigid(obj, arm, bone):
    """Whole object rides one bone: single 100% vertex group + armature mod."""
    vg = obj.vertex_groups.new(name=bone)
    vg.add(range(len(obj.data.vertices)), 1.0, 'REPLACE')
    obj.parent = arm
    m = obj.modifiers.new("Armature", 'ARMATURE')
    m.object = arm


def bind_tongue(obj, arm):
    """Weight the tongue along Y so it bends across the two tongue bones."""
    g1 = obj.vertex_groups.new(name="tongue_01")
    g2 = obj.vertex_groups.new(name="tongue_02")
    for v in obj.data.vertices:
        t = min(1.0, max(0.0, (v.co.y - 0.10) / 0.30))
        g1.add([v.index], 1.0 - t, 'REPLACE')
        g2.add([v.index], t, 'REPLACE')
    obj.parent = arm
    m = obj.modifiers.new("Armature", 'ARMATURE')
    m.object = arm


# --------------------------------------------------------------------------
# camera / lights / render
# --------------------------------------------------------------------------

def build_stage():
    """Straight-down orthographic camera + rotation-safe lighting."""
    cam_data = bpy.data.cameras.new("CAM_TopDown")
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = 2.6
    cam = bpy.data.objects.new("CAM_TopDown", cam_data)
    cam.location = (0.0, 0.0, 8.0)
    cam.rotation_euler = (0.0, 0.0, 0.0)     # looks down -Z, screen-up = +Y
    _collection().objects.link(cam)
    bpy.context.scene.camera = cam

    def light(name, kind, loc, energy, size=2.0, color=(1, 1, 1), rot=(0, 0, 0)):
        d = bpy.data.lights.new(name, kind)
        d.energy = energy
        d.color = color
        if kind == 'AREA':
            d.size = size
        if kind == 'SUN':
            d.angle = math.radians(25)
        o = bpy.data.objects.new(name, d)
        o.location = loc
        o.rotation_euler = rot
        _collection().objects.link(o)
        return o

    # Key: broad and nearly overhead so the shading survives sprite rotation.
    light("KEY", 'AREA', (0.35, 0.55, 4.2), 260.0, size=5.0, color=(1.0, 0.98, 0.93))
    # Ring fills from four sides: volume without a rotation-locked direction.
    for i, (x, y) in enumerate(((3.2, 0), (-3.2, 0), (0, 3.2), (0, -3.2))):
        light(f"RIM_{i}", 'AREA', (x, y, 1.4), 34.0, size=3.0,
              color=(0.66, 0.82, 1.0),
              rot=(math.radians(70), 0.0, math.atan2(-y, -x) + math.pi / 2))
    light("TOP", 'SUN', (0, 0, 6), 0.35, rot=(math.radians(12), 0, 0))

    world = bpy.data.worlds.new("SNK_World") if not bpy.data.worlds else bpy.data.worlds[0]
    bpy.context.scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (0.30, 0.38, 0.45, 1.0)
        bg.inputs[1].default_value = 0.18
    return cam


def setup_render():
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE_NEXT'
    sc.render.resolution_x = 512
    sc.render.resolution_y = 512
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    ee = sc.eevee
    for attr, val in (("taa_render_samples", 64), ("use_raytracing", True),
                      ("use_shadows", True), ("use_volumetric_shadows", False)):
        if hasattr(ee, attr):
            setattr(ee, attr, val)
    sc.view_settings.view_transform = 'Standard'
    sc.view_settings.look = 'None'


# --------------------------------------------------------------------------
# poses
# --------------------------------------------------------------------------

def set_pose(arm, gape=0.0, tongue=0.0, tongue_bend=0.0, rear=None):
    """
    gape   0..1 : head rears back AND the jaw drops (the two together are what
                  make an opening mouth legible to a straight-down camera)
    rear   0..1 : override the rear independently of the jaw, for idle poses
    tongue 0..1 : tongue slides forward out of the mouth
    """
    if rear is None:
        rear = gape
    pb = arm.pose.bones
    pitch = REST_PITCH + (STRIKE_PITCH - REST_PITCH) * rear
    pb["head_base"].rotation_mode = 'XYZ'
    pb["head_base"].rotation_euler = (math.radians(pitch), 0.0, 0.0)
    # Fake a little perspective: a reared head is nearer the camera, and an
    # orthographic render won't grow it on its own.
    s = 1.0 + 0.05 * rear
    pb["head_base"].scale = (s, s, s)

    pb["jaw"].rotation_mode = 'XYZ'
    pb["jaw"].rotation_euler = (math.radians(-JAW_DROP * gape), 0.0, 0.0)

    for name, amt in (("tongue_01", 0.60), ("tongue_02", 0.40)):
        b = pb[name]
        b.rotation_mode = 'XYZ'
        b.rotation_euler = (math.radians(-16.0 * tongue_bend), 0.0, 0.0)
        b.location = (0.0, 0.40 * tongue * amt, 0.0)
    bpy.context.view_layer.update()


# --------------------------------------------------------------------------
# render / export
# --------------------------------------------------------------------------

def aim_camera(tilt=0.0, ortho=2.6, focus=(0.0, 0.0, 0.0), dist=9.0):
    """
    Place the ortho camera `tilt` degrees off straight-down, orbiting in the YZ
    plane so screen-up stays +Y (the snake's forward). tilt=0 is pure top-down.
    """
    cam = bpy.data.objects["CAM_TopDown"]
    t = math.radians(tilt)
    cam.data.ortho_scale = ortho
    cam.rotation_euler = (t, 0.0, 0.0)
    cam.location = (focus[0],
                    focus[1] - dist * math.sin(t),
                    focus[2] + dist * math.cos(t))
    return cam


def render_poses(outdir, poses, prefix="head", res=512, ortho=2.6,
                 tilt=0.0, focus=(0.0, 0.0, 0.0)):
    """Render each named pose to <outdir>/<prefix>_<name>.png."""
    import os
    os.makedirs(outdir, exist_ok=True)
    sc = bpy.context.scene
    aim_camera(tilt=tilt, ortho=ortho, focus=focus)
    sc.render.resolution_x = sc.render.resolution_y = res
    arm = bpy.data.objects["SNK_Rig"]
    paths = []
    for name, kw in poses:
        set_pose(arm, **kw)
        sc.render.filepath = os.path.join(outdir, f"{prefix}_{name}.png")
        bpy.ops.render.render(write_still=True)
        paths.append(sc.render.filepath)
    set_pose(arm, gape=0.0)
    return paths


# Each sprite is rendered with the camera centred on the piece, so the sprite's
# centre pixel IS the piece's anchor. `span` is how many grid cells wide the
# frame is: the game draws the sprite at span * cellSize px.
HEAD_SPAN = 2.6
BODY_SPAN = 1.5

GAPE_FRAMES = 6     # closed -> full strike gape
FLICK_FRAMES = 4    # idle tongue flick, mouth shut

# Strip texture size. Wider than it needs to be for the on-screen body width,
# because the scale lattice is fine and the mesh stretches the strip across
# ribbons that widen on the outside of every turn.
STRIP_W = 256
STRIP_H = int(STRIP_W * TEX_CELLS)


def render_body_strip(outdir, name="body_tex.png"):
    """
    Render the tube edge-to-edge into the strip texture the game maps across
    its body ribbon.

    The strip gets its OWN lighting, and that is not a detail. The standing rig
    rings the subject with four fill lights so the head stays readable however
    the sprite is rotated — but those fills land squarely on the tube's flanks,
    lifting exactly the pixels that are supposed to be darkest and flattening
    the tube back into a strip. So the fills are muted here and a single broad
    overhead key does the work, letting the material's own normal ramp carry
    the round cross-section.
    """
    import os
    os.makedirs(outdir, exist_ok=True)
    sc = bpy.context.scene
    tube = bpy.data.objects["SNK_BodyTube"]
    lights = [o for o in bpy.data.objects if o.type == 'LIGHT']
    saved = [(o, o.location.copy(), o.data.energy) for o in lights]
    for o in lights:
        o.location.x += tube.location.x
        if o.name.startswith("RIM_"):
            o.data.energy *= 0.22
        elif o.name == "KEY":
            o.data.energy *= 0.45
            # Centred, or the specular runs down one side of the body and the
            # snake looks lit from a fixed direction as it turns.
            o.location.x = tube.location.x
            o.location.y = 0.0
    # ortho_scale spans the LARGER axis, so this frames TEX_CELLS vertically and
    # exactly one cell horizontally.
    aim_camera(tilt=0.0, ortho=TEX_CELLS, focus=(tube.location.x, 0.0, 0.0))
    sc.render.resolution_x, sc.render.resolution_y = STRIP_W, STRIP_H
    sc.render.film_transparent = False
    sc.render.filepath = os.path.join(outdir, name)
    bpy.ops.render.render(write_still=True)
    sc.render.film_transparent = True
    for o, loc, energy in saved:
        o.location = loc
        o.data.energy = energy
    return name


def render_body_normal_strip(outdir, name="body_normal.png"):
    """
    Bake the body tube's shading normals into a strip matching body_tex.png
    pixel-for-pixel. The game does not consume this yet — it exists so a
    future renderer can light the ribbon dynamically (tilted cameras, moving
    lights) instead of relying on the shading baked into the colour strip.
    """
    import os
    os.makedirs(outdir, exist_ok=True)
    sc = bpy.context.scene
    tube = bpy.data.objects["SNK_BodyTube"]
    saved = list(tube.data.materials)
    tube.data.materials.clear()
    tube.data.materials.append(mat_body_normal())
    aim_camera(tilt=0.0, ortho=TEX_CELLS, focus=(tube.location.x, 0.0, 0.0))
    sc.render.resolution_x, sc.render.resolution_y = STRIP_W, STRIP_H
    sc.render.film_transparent = False
    sc.render.filepath = os.path.join(outdir, name)
    bpy.ops.render.render(write_still=True)
    sc.render.film_transparent = True
    tube.data.materials.clear()
    for m in saved:
        tube.data.materials.append(m)
    return name


def export_sprites(outdir, res_head=320, res_body=256):
    """Render every sprite the game needs plus a manifest describing them."""
    import json
    import os
    os.makedirs(outdir, exist_ok=True)
    sc = bpy.context.scene
    arm = bpy.data.objects["SNK_Rig"]
    frames = {"gape": [], "flick": []}

    def shoot(name, res, span, focus):
        """
        Render one sprite. The whole light rig is carried to the subject rather
        than the subject to the rig: the lights are fixed in world space, so a
        piece parked off-origin would otherwise be lit from the side and bake a
        false shadow down one edge — and moving the piece to the origin instead
        just buries it inside the head.
        """
        dx, dy = focus[0], focus[1]
        lights = [o for o in bpy.data.objects if o.type == 'LIGHT']
        for o in lights:
            o.location.x += dx
            o.location.y += dy
        aim_camera(tilt=0.0, ortho=span, focus=focus)
        sc.render.resolution_x = sc.render.resolution_y = res
        sc.render.filepath = os.path.join(outdir, f"{name}.png")
        bpy.ops.render.render(write_still=True)
        for o in lights:
            o.location.x -= dx
            o.location.y -= dy
        return f"{name}.png"

    for i in range(GAPE_FRAMES):
        g = i / (GAPE_FRAMES - 1)
        set_pose(arm, gape=g, tongue=0.85 * g, tongue_bend=0.3 * g)
        frames["gape"].append(shoot(f"head_gape_{i}", res_head, HEAD_SPAN, (0, 0, 0)))

    for i in range(FLICK_FRAMES):
        t = i / (FLICK_FRAMES - 1)
        # rear=0 so flick frame 0 is pixel-identical to gape frame 0 — that
        # shared rest pose is what lets the game cut between the two clips.
        set_pose(arm, gape=0.0, rear=0.0, tongue=t, tongue_bend=0.35 * t)
        frames["flick"].append(shoot(f"head_flick_{i}", res_head, HEAD_SPAN, (0, 0, 0)))

    set_pose(arm, gape=0.0)
    # The bead and tail-cap meshes stay in the .blend as shape reference, but
    # the game draws the body as one textured ribbon, so they aren't exported.
    render_body_strip(outdir)
    render_body_normal_strip(outdir)
    sc.render.resolution_x = sc.render.resolution_y = res_body

    manifest = {
        "generator": "snakekit.export_sprites",
        "projection": "orthographic, straight down (rotation-safe: rotate the "
                      "sprite freely to face any heading)",
        "forward": "+Y in world == UP in the sprite image",
        "anchor": "image centre == the piece's grid-cell anchor",
        "head": {"span_cells": HEAD_SPAN, "size_px": res_head,
                 "gape": frames["gape"], "flick": frames["flick"]},
        "body": {"strip": {"image": "body_tex.png", "cells_long": TEX_CELLS,
                           "u_spans": "the full tube width, edge to edge",
                           "tile": "REPEAT vertically — every pattern layer is "
                                   "periodic over the tile, so it tiles without "
                                   "mirroring. Do not mirror it: that flips the "
                                   "scales' overlap direction on alternate "
                                   "tiles, pointing the skin backwards down "
                                   "half the snake."},
                 "normal": {"image": "body_normal.png",
                            "note": "shading normals of the same tube, "
                                    "colour = normal * 0.5 + 0.5 (sRGB-encoded "
                                    "PNG), R across / G along / B up. Not "
                                    "consumed by the game yet — baked for a "
                                    "future dynamically lit ribbon."}},
    }
    with open(os.path.join(outdir, "snake.json"), "w") as fh:
        json.dump(manifest, fh, indent=2)
    return manifest


# --------------------------------------------------------------------------
# entry point
# --------------------------------------------------------------------------

def rebuild():
    purge_all()
    M = build_materials()

    build_cranium(M)
    build_lower_jaw(M)
    build_mouth_surfaces(M)
    build_skull_base(M)
    build_throat(M)
    build_eyes(M)
    build_nostrils(M)
    build_fangs(M)
    tongue = build_tongue(M)
    build_body(M)

    arm = build_rig()
    for name, bone in BINDING.items():
        obj = bpy.data.objects.get(name)
        if obj:
            bind_rigid(obj, arm, bone)
    bind_tongue(tongue, arm)

    build_stage()
    setup_render()
    set_pose(arm, gape=0.0)
    return arm
