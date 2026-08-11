import { Skia } from '@shopify/react-native-skia';
import type { Cell } from '../engine/types';
import { clamp01, interpCell, segmentFrom } from './interpolate';

/**
 * Ribbon geometry for the snake body — pure worklet math, no React.
 *
 * Shared by the flat renderer (AnimatedSnake) and the shaded 3D one
 * (Snake3DBody), which draws these same ribbons several times at decreasing
 * widths to fake a round tube. Keeping the builders here means both renderers
 * agree exactly on the centreline, so the head sprite lines up either way.
 */

/** Max trailing cells the taper spans (long snakes). */
export const TAIL_LEN = 6;
/** Fraction of the snake length the taper spans (short snakes taper less). */
export const TAIL_FRACTION = 0.4;
/** Width multiplier at the very tip of the tail (lower = pointier). */
export const TAIL_MIN = 0.26;
/** Samples (K+1 points) of each segment's quad centerline. */
export const RIBBON_SAMPLES = 8;
/** Shimmer travel period (ms) and half-window (segments). */
export const SHIMMER_PERIOD = 1300;
export const SHIMMER_HALF = 1.4;

/** Which cells a build covers. */
export const GROUP_HEAD = 0;
export const GROUP_BODY = 1;
export const GROUP_TAIL = 2;

type SkPath = ReturnType<typeof Skia.Path.Make>;

/** Interpolated pixel center of snake cell i. */
export function center(
  from: Cell[],
  to: Cell[],
  t: number,
  i: number,
  origin: { x: number; y: number },
  cellSize: number,
): [number, number] {
  'worklet';
  const c = interpCell(segmentFrom(from, to[i], i), to[i], t);
  return [origin.x + (c.x + 0.5) * cellSize, origin.y + (c.y + 0.5) * cellSize];
}

/** Append a closed polygon, rounding each vertex by r. UI-thread worklet. */
export function appendRoundedPoly(
  path: SkPath,
  xs: number[],
  ys: number[],
  count: number,
  r: number,
) {
  'worklet';
  if (count < 3) {
    return;
  }
  if (r <= 0) {
    path.moveTo(xs[0], ys[0]);
    for (let k = 1; k < count; k++) {
      path.lineTo(xs[k], ys[k]);
    }
    path.close();
    return;
  }
  for (let k = 0; k < count; k++) {
    const cx = xs[k];
    const cy = ys[k];
    const px = xs[(k - 1 + count) % count];
    const py = ys[(k - 1 + count) % count];
    const nx = xs[(k + 1) % count];
    const ny = ys[(k + 1) % count];
    const inDx = cx - px;
    const inDy = cy - py;
    const inLen = Math.sqrt(inDx * inDx + inDy * inDy) || 1;
    const ri = Math.min(r, inLen / 2);
    const outDx = nx - cx;
    const outDy = ny - cy;
    const outLen = Math.sqrt(outDx * outDx + outDy * outDy) || 1;
    const ro = Math.min(r, outLen / 2);
    if (k === 0) {
      path.moveTo(cx - (inDx / inLen) * ri, cy - (inDy / inLen) * ri);
    } else {
      path.lineTo(cx - (inDx / inLen) * ri, cy - (inDy / inLen) * ri);
    }
    path.quadTo(cx, cy, cx + (outDx / outLen) * ro, cy + (outDy / outLen) * ro);
  }
  path.close();
}

/**
 * Filled ribbon swept along the smooth quad A→(control C)→B, with the half-width
 * interpolating from hwStart (at A) to hwEnd (at B) so the segment tapers within
 * itself. UI-thread worklet.
 */
export function appendSmoothRibbon(
  path: SkPath,
  ax: number,
  ay: number,
  cx: number,
  cy: number,
  bx: number,
  by: number,
  hwStart: number,
  hwEnd: number,
  r: number,
) {
  'worklet';
  const polyX: number[] = [];
  const polyY: number[] = [];
  const rx: number[] = [];
  const ry: number[] = [];
  for (let k = 0; k <= RIBBON_SAMPLES; k++) {
    const u = k / RIBBON_SAMPLES;
    const hw = hwStart + (hwEnd - hwStart) * u;
    const mu = 1 - u;
    const x = mu * mu * ax + 2 * mu * u * cx + u * u * bx;
    const y = mu * mu * ay + 2 * mu * u * cy + u * u * by;
    const tx = 2 * mu * (cx - ax) + 2 * u * (bx - cx);
    const ty = 2 * mu * (cy - ay) + 2 * u * (by - cy);
    const tl = Math.sqrt(tx * tx + ty * ty) || 1;
    const nx = (-ty / tl) * hw;
    const ny = (tx / tl) * hw;
    polyX.push(x + nx);
    polyY.push(y + ny);
    rx.push(x - nx);
    ry.push(y - ny);
  }
  for (let k = RIBBON_SAMPLES; k >= 0; k--) {
    polyX.push(rx[k]);
    polyY.push(ry[k]);
  }
  appendRoundedPoly(path, polyX, polyY, polyX.length, r);
}

/** Append the wrapped ribbon for cell i with the given half-width. UI-thread worklet. */
export function appendSegmentAt(
  path: SkPath,
  from: Cell[],
  to: Cell[],
  t: number,
  i: number,
  n: number,
  origin: { x: number; y: number },
  cellSize: number,
  gap: number,
  hwStart: number,
  hwEnd: number,
  rounded: boolean,
) {
  'worklet';
  const breakSq = cellSize * 1.5 * (cellSize * 1.5);
  const half = gap / 2;
  const span = cellSize / 2 - half;
  // Round the ends close to a full semicircle (pill-ish) for soft segment edges.
  const r = rounded ? Math.min(hwStart, hwEnd) * 0.92 : 0;
  const [cx, cy] = center(from, to, t, i, origin, cellSize);

  let prevX = cx;
  let prevY = cy;
  let hasPrev = false;
  if (i > 0) {
    const [x, y] = center(from, to, t, i - 1, origin, cellSize);
    if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= breakSq) {
      prevX = x;
      prevY = y;
      hasPrev = true;
    }
  }
  let nextX = cx;
  let nextY = cy;
  let hasNext = false;
  if (i < n - 1) {
    const [x, y] = center(from, to, t, i + 1, origin, cellSize);
    if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= breakSq) {
      nextX = x;
      nextY = y;
      hasNext = true;
    }
  }

  if (!hasPrev && !hasNext) {
    const hw = (hwStart + hwEnd) / 2;
    appendRoundedPoly(
      path,
      [cx - hw, cx + hw, cx + hw, cx - hw],
      [cy - hw, cy - hw, cy + hw, cy + hw],
      4,
      r,
    );
    return;
  }

  let ax: number;
  let ay: number;
  if (hasPrev) {
    const mx = (prevX + cx) / 2;
    const my = (prevY + cy) / 2;
    const dx = cx - mx;
    const dy = cy - my;
    const l = Math.sqrt(dx * dx + dy * dy) || 1;
    ax = mx + (dx / l) * half;
    ay = my + (dy / l) * half;
  } else {
    const dx = cx - nextX;
    const dy = cy - nextY;
    const l = Math.sqrt(dx * dx + dy * dy) || 1;
    ax = cx + (dx / l) * span;
    ay = cy + (dy / l) * span;
  }
  let bx: number;
  let by: number;
  if (hasNext) {
    const mx = (cx + nextX) / 2;
    const my = (cy + nextY) / 2;
    const dx = cx - mx;
    const dy = cy - my;
    const l = Math.sqrt(dx * dx + dy * dy) || 1;
    bx = mx + (dx / l) * half;
    by = my + (dy / l) * half;
  } else {
    const dx = cx - prevX;
    const dy = cy - prevY;
    const l = Math.sqrt(dx * dx + dy * dy) || 1;
    bx = cx + (dx / l) * span;
    by = cy + (dy / l) * span;
  }
  appendSmoothRibbon(path, ax, ay, cx, cy, bx, by, hwStart, hwEnd, r);
}

/**
 * How many trailing cells the taper spans for a snake of length n. Always at
 * least one once there is a body cell to taper (so the tail shows even on the
 * 3-cell starting snake), growing with length up to TAIL_LEN.
 */
export function taperCellsFor(n: number): number {
  'worklet';
  if (n < 2) {
    return 0;
  }
  return Math.max(1, Math.min(TAIL_LEN, Math.floor((n - 1) * TAIL_FRACTION)));
}

/**
 * Continuous width multiplier at centerline position `pos` (in cell-index units;
 * the tail tip is at n-0.5). Full (1) until the taper region, then eases down to
 * TAIL_MIN at the tip. Evaluated at each segment's two ends so the segment tapers
 * within itself and joins its neighbors seamlessly (a smooth cone, no steps).
 */
export function widthFactor(pos: number, n: number, taperCells: number): number {
  'worklet';
  if (taperCells <= 0) {
    return 1;
  }
  const tipPos = n - 0.5;
  const startPos = tipPos - taperCells;
  if (pos <= startPos) {
    return 1;
  }
  let x = (pos - startPos) / taperCells;
  if (x > 1) {
    x = 1;
  }
  // Ease-in (x^2): stays near full through the body, narrows toward the tip.
  return 1 - (1 - TAIL_MIN) * x * x;
}

/**
 * Build one color group of the wrapped snake: `which` selects GROUP_HEAD (cell
 * 0), GROUP_BODY or GROUP_TAIL (the trailing taper). Ranges + taper are computed
 * from the current length inside the worklet. UI-thread worklet; pure.
 *
 * This is the FLAT renderer's build — one ribbon per cell with a gap between
 * them. The 3D renderer uses computeSpine/tubeFromSpine instead, which traces a
 * single continuous centreline.
 */
export function buildTaperedGroup(
  from: Cell[],
  to: Cell[],
  t: number,
  origin: { x: number; y: number },
  cellSize: number,
  gap: number,
  rounded: boolean,
  which: number,
) {
  'worklet';
  const path = Skia.Path.Make();
  const n = to.length;
  if (n === 0) {
    return path;
  }
  const baseHw = (cellSize - gap) / 2;
  const taperCells = taperCellsFor(n);
  const tailStart = n - taperCells; // body/tail color boundary
  let begin = 0;
  let end = 0;
  if (which === GROUP_HEAD) {
    begin = 0;
    end = Math.min(1, n);
  } else if (which === GROUP_BODY) {
    begin = Math.min(1, n);
    end = tailStart;
  } else {
    begin = tailStart;
    end = n;
  }
  for (let i = begin; i < end; i++) {
    const hwStart = baseHw * widthFactor(i - 0.5, n, taperCells);
    const hwEnd = baseHw * widthFactor(i + 0.5, n, taperCells);
    appendSegmentAt(path, from, to, t, i, n, origin, cellSize, gap, hwStart, hwEnd, rounded);
  }
  return path;
}

/** Chevron "scales" pointing toward the head, one per body/tail cell. */
export function buildScales(
  from: Cell[],
  to: Cell[],
  t: number,
  origin: { x: number; y: number },
  cellSize: number,
  gap: number,
  widthScale: number = 1,
  depthScale: number = 1,
  begin: number = 1,
) {
  'worklet';
  const path = Skia.Path.Make();
  const n = to.length;
  const breakSq = cellSize * 1.5 * (cellSize * 1.5);
  const baseHw = ((cellSize - gap) / 2) * widthScale;
  const taperCells = taperCellsFor(n);
  const depth = cellSize * 0.18 * depthScale;
  for (let i = Math.max(1, begin); i < n; i++) {
    const [cx, cy] = center(from, to, t, i, origin, cellSize);
    // Direction toward the head (toward lower index).
    let dx = 0;
    let dy = 0;
    const [pxv, pyv] = center(from, to, t, i - 1, origin, cellSize);
    if ((pxv - cx) * (pxv - cx) + (pyv - cy) * (pyv - cy) <= breakSq) {
      dx = pxv - cx;
      dy = pyv - cy;
    } else {
      continue; // wrap seam — skip this scale
    }
    const dl = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / dl;
    const uy = dy / dl;
    const w = baseHw * widthFactor(i, n, taperCells) * 0.62;
    const px = -uy;
    const py = ux;
    const tipx = cx + ux * depth;
    const tipy = cy + uy * depth;
    path.moveTo(cx + px * w, cy + py * w);
    path.lineTo(tipx, tipy);
    path.lineTo(cx - px * w, cy - py * w);
  }
  return path;
}

// --------------------------------------------------------------------------
// continuous tube (the 3D renderer)
// --------------------------------------------------------------------------

/** Quad samples per interior cell when tracing the spine. */
const SPINE_K = 4;
/** Points in each end cap's semicircle. */
const CAP_ARC = 6;
/**
 * The body narrows toward the head over this many cells, down to HEAD_MIN.
 * The head is a rigid sprite, so the ribbon has to shrink to a thread by the
 * time it reaches the head cell or its edges show around the jaw; it widens
 * back to full right about where the sprite's neck collar ends.
 */
const HEAD_TAPER = 1.35;
const HEAD_MIN = 0.3;
/** Extra samples past the last cell that bring the tail to a point. */
const TIP_STEPS = 3;
const TIP_CELLS = 0.5;

/** A traced centreline: positions, frames, and the width factor at each sample. */
export interface Spine {
  xs: number[];
  ys: number[];
  /** Unit normal (left of travel) per sample. */
  nxs: number[];
  nys: number[];
  /** Unit tangent per sample (needed to bulge the end caps outward). */
  txs: number[];
  tys: number[];
  /** Width multiplier 0..1 per sample. */
  wf: number[];
  /**
   * Distance travelled along the body in px, used as the texture's V axis.
   * Wrap jumps are NOT added, so the pattern keeps flowing down the snake
   * instead of leaping a board-width at every portal.
   */
  arc: number[];
  /** Inclusive sample ranges, one per unwrapped run. */
  runStart: number[];
  runEnd: number[];
}

/** Width multiplier at a fractional cell index: tail taper AND head taper. */
export function spineWidth(idx: number, n: number, taperCells: number): number {
  'worklet';
  const tail = widthFactor(idx, n, taperCells);
  if (idx >= HEAD_TAPER) {
    return tail;
  }
  const u = idx <= 0 ? 0 : idx / HEAD_TAPER;
  const ss = u * u * (3 - 2 * u);
  return tail * (HEAD_MIN + (1 - HEAD_MIN) * ss);
}

/**
 * Trace the snake as ONE smooth centreline rather than a chain of per-cell
 * pieces.
 *
 * The old per-segment build gives every cell its own ribbon with a gap between
 * them, which shows as a visibly beaded body and separate corner pieces. Here
 * consecutive cell centres are joined by quads through their midpoints, so
 * corners round themselves and the body is continuous by construction.
 *
 * PORTAL wraps split the snake into runs; each run becomes its own capped
 * outline instead of streaking across the board. UI-thread worklet; pure.
 */
export function computeSpine(
  from: Cell[],
  to: Cell[],
  t: number,
  origin: { x: number; y: number },
  cellSize: number,
): Spine {
  'worklet';
  const xs: number[] = [];
  const ys: number[] = [];
  const nxs: number[] = [];
  const nys: number[] = [];
  const txs: number[] = [];
  const tys: number[] = [];
  const wf: number[] = [];
  const arc: number[] = [];
  const runStart: number[] = [];
  const runEnd: number[] = [];
  const n = to.length;
  if (n === 0) {
    return { xs, ys, nxs, nys, txs, tys, wf, arc, runStart, runEnd };
  }

  const cx: number[] = [];
  const cy: number[] = [];
  for (let i = 0; i < n; i++) {
    const [x, y] = center(from, to, t, i, origin, cellSize);
    cx.push(x);
    cy.push(y);
  }
  const breakSq = cellSize * 1.5 * (cellSize * 1.5);
  const taperCells = taperCellsFor(n);

  const push = (x: number, y: number, idx: number) => {
    xs.push(x);
    ys.push(y);
    wf.push(spineWidth(idx, n, taperCells));
  };

  let i = 0;
  while (i < n) {
    let j = i;
    while (
      j + 1 < n &&
      (cx[j + 1] - cx[j]) * (cx[j + 1] - cx[j]) +
        (cy[j + 1] - cy[j]) * (cy[j + 1] - cy[j]) <=
        breakSq
    ) {
      j++;
    }
    const s = xs.length;
    push(cx[i], cy[i], i);
    for (let k = i + 1; k <= j - 1; k++) {
      const ax = (cx[k - 1] + cx[k]) / 2;
      const ay = (cy[k - 1] + cy[k]) / 2;
      const bx = (cx[k] + cx[k + 1]) / 2;
      const by = (cy[k] + cy[k + 1]) / 2;
      for (let q = 1; q <= SPINE_K; q++) {
        const u = q / SPINE_K;
        const mu = 1 - u;
        push(
          mu * mu * ax + 2 * mu * u * cx[k] + u * u * bx,
          mu * mu * ay + 2 * mu * u * cy[k] + u * u * by,
          k - 0.5 + u,
        );
      }
    }
    if (j > i) {
      push(cx[j], cy[j], j);
    }
    runStart.push(s);
    runEnd.push(xs.length - 1);
    i = j + 1;
  }

  // Draw the tail out to an actual point. Without this the strip stops at the
  // last cell centre still ~26% wide, leaving a visibly squared-off stump.
  const last = runEnd.length - 1;
  const e0 = runEnd[last];
  if (e0 > runStart[last]) {
    let dx = xs[e0] - xs[e0 - 1];
    let dy = ys[e0] - ys[e0 - 1];
    const l = Math.sqrt(dx * dx + dy * dy);
    if (l > 1e-6) {
      dx /= l;
      dy /= l;
      const wEnd = wf[e0];
      for (let q = 1; q <= TIP_STEPS; q++) {
        const f = q / TIP_STEPS;
        const d = TIP_CELLS * cellSize * f;
        xs.push(xs[e0] + dx * d);
        ys.push(ys[e0] + dy * d);
        wf.push(wEnd * Math.pow(1 - f, 0.7));
      }
      runEnd[last] = xs.length - 1;
    }
  }

  // Arc length, accumulated across runs but never across the jump between them.
  let acc = 0;
  for (let r = 0; r < runStart.length; r++) {
    for (let k = runStart[r]; k <= runEnd[r]; k++) {
      if (k > runStart[r]) {
        acc += Math.sqrt(
          (xs[k] - xs[k - 1]) * (xs[k] - xs[k - 1]) +
            (ys[k] - ys[k - 1]) * (ys[k] - ys[k - 1]),
        );
      }
      arc[k] = acc;
    }
  }

  // Frames, from central differences clamped to each run's own ends.
  for (let r = 0; r < runStart.length; r++) {
    const s = runStart[r];
    const e = runEnd[r];
    for (let k = s; k <= e; k++) {
      const a = k > s ? k - 1 : k;
      const b = k < e ? k + 1 : k;
      let tx = xs[b] - xs[a];
      let ty = ys[b] - ys[a];
      const l = Math.sqrt(tx * tx + ty * ty);
      if (l < 1e-6) {
        tx = 0;
        ty = -1;
      } else {
        tx /= l;
        ty /= l;
      }
      txs.push(tx);
      tys.push(ty);
      nxs.push(-ty);
      nys.push(tx);
    }
  }
  return { xs, ys, nxs, nys, txs, tys, wf, arc, runStart, runEnd };
}

/**
 * Turn the spine into a textured triangle strip: two vertices per sample,
 * offset either side, with U spanning the strip texture's full width and V
 * running with arc length so the scale pattern flows down the body.
 *
 * Separate runs are stitched with a pair of duplicated vertices. Those produce
 * only zero-area triangles, which keeps one strip valid across a PORTAL wrap
 * without needing a second draw call.
 */
export function meshFromSpine(
  sp: Spine,
  baseHw: number,
  texW: number,
  texH: number,
  tileLenPx: number,
) {
  'worklet';
  const verts: { x: number; y: number }[] = [];
  const uvs: { x: number; y: number }[] = [];
  const { xs, ys, nxs, nys, wf, arc, runStart, runEnd } = sp;
  for (let r = 0; r < runStart.length; r++) {
    const s = runStart[r];
    const e = runEnd[r];
    if (e <= s) {
      continue; // a lone sample cannot form a strip
    }
    if (verts.length > 0) {
      const prev = verts[verts.length - 1];
      const prevUv = uvs[uvs.length - 1];
      const hw0 = baseHw * wf[s];
      verts.push({ x: prev.x, y: prev.y });
      uvs.push({ x: prevUv.x, y: prevUv.y });
      verts.push({ x: xs[s] + nxs[s] * hw0, y: ys[s] + nys[s] * hw0 });
      uvs.push({ x: 0, y: (arc[s] / tileLenPx) * texH });
    }
    for (let k = s; k <= e; k++) {
      const hw = baseHw * wf[k];
      const v = (arc[k] / tileLenPx) * texH;
      verts.push({ x: xs[k] + nxs[k] * hw, y: ys[k] + nys[k] * hw });
      uvs.push({ x: 0, y: v });
      verts.push({ x: xs[k] - nxs[k] * hw, y: ys[k] - nys[k] * hw });
      uvs.push({ x: texW, y: v });
    }
  }
  return { verts, uvs };
}

/**
 * One closed outline per run, offset `baseHw * wf * widthScale` either side of
 * the spine and closed with a round cap at each end.
 *
 * The caps are built into the outline rather than added as separate circles:
 * a circle appended to the same path can cancel against the ribbon under
 * non-zero fill and punch a hole where they overlap.
 */
export function tubeFromSpine(sp: Spine, baseHw: number, widthScale: number) {
  'worklet';
  const path = Skia.Path.Make();
  const { xs, ys, nxs, nys, txs, tys, wf, runStart, runEnd } = sp;
  const hwAt = (k: number) => baseHw * wf[k] * widthScale;

  for (let r = 0; r < runStart.length; r++) {
    const s = runStart[r];
    const e = runEnd[r];
    if (s === e) {
      path.addCircle(xs[s], ys[s], Math.max(0.5, hwAt(s)));
      continue;
    }
    let hw = hwAt(s);
    path.moveTo(xs[s] + nxs[s] * hw, ys[s] + nys[s] * hw);
    for (let k = s + 1; k <= e; k++) {
      hw = hwAt(k);
      path.lineTo(xs[k] + nxs[k] * hw, ys[k] + nys[k] * hw);
    }
    // Tail cap: left -> forward -> right.
    hw = hwAt(e);
    for (let a = 1; a < CAP_ARC; a++) {
      const th = (Math.PI * a) / CAP_ARC;
      const c = Math.cos(th);
      const sn = Math.sin(th);
      path.lineTo(
        xs[e] + hw * (c * nxs[e] + sn * txs[e]),
        ys[e] + hw * (c * nys[e] + sn * tys[e]),
      );
    }
    path.lineTo(xs[e] - nxs[e] * hw, ys[e] - nys[e] * hw);
    for (let k = e - 1; k >= s; k--) {
      hw = hwAt(k);
      path.lineTo(xs[k] - nxs[k] * hw, ys[k] - nys[k] * hw);
    }
    // Head cap: right -> backward -> left, then close.
    hw = hwAt(s);
    for (let a = 1; a < CAP_ARC; a++) {
      const th = (Math.PI * a) / CAP_ARC;
      const c = Math.cos(th);
      const sn = Math.sin(th);
      path.lineTo(
        xs[s] - hw * (c * nxs[s] + sn * txs[s]),
        ys[s] - hw * (c * nys[s] + sn * tys[s]),
      );
    }
    path.close();
  }
  return path;
}

/** Segments inside a window that travels head↔tail over time (shimmer). */
export function buildShimmer(
  from: Cell[],
  to: Cell[],
  t: number,
  clockVal: number,
  origin: { x: number; y: number },
  cellSize: number,
  gap: number,
  rounded: boolean,
) {
  'worklet';
  const path = Skia.Path.Make();
  const n = to.length;
  if (n === 0) {
    return path;
  }
  const baseHw = (cellSize - gap) / 2;
  const taperCells = taperCellsFor(n);
  const phase = (clockVal % SHIMMER_PERIOD) / SHIMMER_PERIOD;
  const centerIdx = phase * (n + 4) - 2;
  for (let i = 0; i < n; i++) {
    if (Math.abs(i - centerIdx) < SHIMMER_HALF) {
      const hwStart = baseHw * widthFactor(i - 0.5, n, taperCells);
      const hwEnd = baseHw * widthFactor(i + 0.5, n, taperCells);
      appendSegmentAt(path, from, to, t, i, n, origin, cellSize, gap, hwStart, hwEnd, rounded);
    }
  }
  return path;
}

/** Axis-aligned discrete rounded-rect cells over [begin,end) — the retro look. */
export function buildSegmentsPath(
  from: Cell[],
  to: Cell[],
  t: number,
  begin: number,
  end: number,
  origin: { x: number; y: number },
  cellSize: number,
  inset: number,
  size: number,
  corner: number,
) {
  'worklet';
  const path = Skia.Path.Make();
  const stop = Math.min(end, to.length);
  for (let i = begin; i < stop; i++) {
    const c = interpCell(segmentFrom(from, to[i], i), to[i], t);
    const x = origin.x + c.x * cellSize + inset;
    const y = origin.y + c.y * cellSize + inset;
    const rect = Skia.XYWHRect(x, y, size, size);
    if (corner > 0) {
      path.addRRect(Skia.RRectXY(rect, corner, corner));
    } else {
      path.addRect(rect);
    }
  }
  return path;
}

export { clamp01 };
