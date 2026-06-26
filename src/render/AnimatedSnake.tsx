import { LinearGradient, Path, Skia, vec } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import type { Cell, SnakeEffect } from '../engine/types';
import { darken, lighten, withAlpha } from './color';
import { clamp01, interpCell, segmentFrom } from './interpolate';
import type { SnakeGlide } from './useSnakeGlide';

/** Max trailing cells the taper spans (long snakes). */
const TAIL_LEN = 6;
/** Fraction of the snake length the taper spans (short snakes taper less). */
const TAIL_FRACTION = 0.4;
/** Width multiplier at the very tip of the tail. */
const TAIL_MIN = 0.4;
/** Samples (K+1 points) of each segment's quad centerline. */
const RIBBON_SAMPLES = 8;
/** Shimmer travel period (ms) and half-window (segments). */
const SHIMMER_PERIOD = 1300;
const SHIMMER_HALF = 1.4;

/** Interpolated pixel center of snake cell i. */
function center(
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
function appendRoundedPoly(
  path: ReturnType<typeof Skia.Path.Make>,
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
function appendSmoothRibbon(
  path: ReturnType<typeof Skia.Path.Make>,
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
function appendSegmentAt(
  path: ReturnType<typeof Skia.Path.Make>,
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
  const r = rounded ? Math.min(hwStart, hwEnd, cellSize / 4) : 0;
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
function taperCellsFor(n: number): number {
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
function widthFactor(pos: number, n: number, taperCells: number): number {
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
 * Build one color group of the wrapped snake: which 0 = head (cell 0), 1 = body,
 * 2 = tail (the trailing TAIL_LEN cells, tapering in width). Ranges + taper are
 * computed from the current length inside the worklet. UI-thread worklet; pure.
 */
function buildTaperedGroup(
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
  if (which === 0) {
    begin = 0;
    end = Math.min(1, n);
  } else if (which === 1) {
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
function buildScales(
  from: Cell[],
  to: Cell[],
  t: number,
  origin: { x: number; y: number },
  cellSize: number,
  gap: number,
) {
  'worklet';
  const path = Skia.Path.Make();
  const n = to.length;
  const breakSq = cellSize * 1.5 * (cellSize * 1.5);
  const baseHw = (cellSize - gap) / 2;
  const taperCells = taperCellsFor(n);
  const depth = cellSize * 0.18;
  for (let i = 1; i < n; i++) {
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

/** Segments inside a window that travels head↔tail over time (shimmer). */
function buildShimmer(
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
function buildSegmentsPath(
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

interface AnimatedSnakeProps {
  /** Shared glide state (clock + endpoints + timing) from useSnakeGlide. */
  glide: SnakeGlide;
  cellSize: number;
  origin: { x: number; y: number };
  gap: number;
  rounded: boolean;
  /** 'tube' = wrapped independent segments; 'segments' = axis-aligned retro. */
  render: 'tube' | 'segments';
  /** Body texture/effect (temporary, switchable in Settings). */
  effect: SnakeEffect;
  /** Visible board height (px) for the top-lit gloss gradient. */
  boardHeight: number;
  headColor: string;
  bodyColor: string;
}

/**
 * Continuous-glide snake renderer. The body is a chain of independent segments
 * that wrap around corners (see buildTaperedGroup/appendSmoothRibbon); the
 * trailing segments taper in width and shade into a darker tail; and a
 * switchable body effect (gloss/scales/outline/shimmer) overlays on top. All
 * geometry rebuilds every frame on the UI thread via the glide's Reanimated
 * clock; colors/shades are derived on the JS thread. A pure projection of the
 * glide state. (smooth movement + texture)
 */
export function AnimatedSnake({
  glide,
  cellSize,
  origin,
  gap,
  rounded,
  render,
  effect,
  boardHeight,
  headColor,
  bodyColor,
}: AnimatedSnakeProps) {
  const { clock, from, to, start, duration } = glide;
  const wrapped = render === 'tube';
  const segGap = wrapped ? Math.max(gap, cellSize * 0.12) : gap;
  const inset = gap / 2;
  const size = cellSize - gap;
  const corner = rounded ? cellSize / 4 : 0;

  // Derived shades (JS thread).
  const tailColor = darken(bodyColor, 0.34);
  const outlineBody = darken(bodyColor, 0.55);
  const outlineHead = darken(headColor, 0.5);
  const outlineTail = darken(tailColor, 0.5);
  const scaleColor = darken(bodyColor, 0.32);
  const shimmerColor = withAlpha(lighten(bodyColor, 0.75), 0.5);
  const gy0 = origin.y;
  const gy1 = origin.y + boardHeight;

  const headPath = useDerivedValue(() => {
    'worklet';
    const t = clamp01((clock.value - start.value) / duration.value);
    return wrapped
      ? buildTaperedGroup(from.value, to.value, t, origin, cellSize, segGap, rounded, 0)
      : buildSegmentsPath(from.value, to.value, t, 0, 1, origin, cellSize, inset, size, corner);
  });

  const bodyPath = useDerivedValue(() => {
    'worklet';
    const t = clamp01((clock.value - start.value) / duration.value);
    return wrapped
      ? buildTaperedGroup(from.value, to.value, t, origin, cellSize, segGap, rounded, 1)
      : buildSegmentsPath(from.value, to.value, t, 1, to.value.length, origin, cellSize, inset, size, corner);
  });

  const tailPath = useDerivedValue(() => {
    'worklet';
    const t = clamp01((clock.value - start.value) / duration.value);
    return wrapped
      ? buildTaperedGroup(from.value, to.value, t, origin, cellSize, segGap, rounded, 2)
      : Skia.Path.Make();
  });

  const fxPath = useDerivedValue(() => {
    'worklet';
    const t = clamp01((clock.value - start.value) / duration.value);
    if (wrapped && effect === 'scales') {
      return buildScales(from.value, to.value, t, origin, cellSize, segGap);
    }
    if (wrapped && effect === 'shimmer') {
      return buildShimmer(from.value, to.value, t, clock.value, origin, cellSize, segGap, rounded);
    }
    return Skia.Path.Make();
  });

  // Segments (retro) mode: plain body + head, no taper/effects.
  if (!wrapped) {
    return (
      <>
        <Path path={bodyPath} color={bodyColor} />
        <Path path={headPath} color={headColor} />
      </>
    );
  }

  const fill = (
    p: ReturnType<typeof useDerivedValue<ReturnType<typeof Skia.Path.Make>>>,
    color: string,
    key: string,
  ) => {
    if (effect === 'gloss') {
      return (
        <Path key={key} path={p}>
          <LinearGradient
            start={vec(0, gy0)}
            end={vec(0, gy1)}
            colors={[lighten(color, 0.45), color, darken(color, 0.32)]}
          />
        </Path>
      );
    }
    return <Path key={key} path={p} color={color} />;
  };

  const outlineWidth = Math.max(1.5, cellSize * 0.07);

  return (
    <>
      {fill(bodyPath, bodyColor, 'body')}
      {fill(tailPath, tailColor, 'tail')}
      {fill(headPath, headColor, 'head')}

      {effect === 'outline' && (
        <>
          <Path path={bodyPath} color={outlineBody} style="stroke" strokeWidth={outlineWidth} strokeJoin="round" />
          <Path path={tailPath} color={outlineTail} style="stroke" strokeWidth={outlineWidth} strokeJoin="round" />
          <Path path={headPath} color={outlineHead} style="stroke" strokeWidth={outlineWidth} strokeJoin="round" />
        </>
      )}

      {effect === 'scales' && (
        <Path
          path={fxPath}
          color={scaleColor}
          style="stroke"
          strokeWidth={Math.max(1, cellSize * 0.06)}
          strokeJoin="round"
          strokeCap="round"
        />
      )}

      {effect === 'shimmer' && <Path path={fxPath} color={shimmerColor} />}
    </>
  );
}
