import { Path, Skia } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import type { Cell } from '../engine/types';
import { clamp01, interpCell, segmentFrom } from './interpolate';
import type { SnakeGlide } from './useSnakeGlide';

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

/**
 * Append a closed polygon (count vertices) to the path, rounding each vertex by
 * radius r (clamped to half the adjacent edges) via a quad through the vertex.
 * r <= 0 draws sharp corners. UI-thread worklet.
 */
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

/** Samples (K+1 points) of the quad A→(control C)→B. */
const RIBBON_SAMPLES = 8;

/**
 * Append one body segment as a filled ribbon swept along a SMOOTH quadratic
 * centerline A→(control C)→B. The curve is sampled finely and offset by ±hw
 * along its tangent normal, so the sides are smooth (not angular) and a turn
 * makes the outer edge run long while the inner edge pulls in — the segment
 * wraps the corner, squeezing inside / stretching outside, automatically per
 * turn direction. Ends are rounded within bounds (gaps preserved). UI-thread
 * worklet.
 */
function appendSmoothRibbon(
  path: ReturnType<typeof Skia.Path.Make>,
  ax: number,
  ay: number,
  cx: number,
  cy: number,
  bx: number,
  by: number,
  hw: number,
  r: number,
) {
  'worklet';
  const leftX: number[] = [];
  const leftY: number[] = [];
  const rightX: number[] = [];
  const rightY: number[] = [];
  for (let k = 0; k <= RIBBON_SAMPLES; k++) {
    const u = k / RIBBON_SAMPLES;
    const mu = 1 - u;
    const x = mu * mu * ax + 2 * mu * u * cx + u * u * bx;
    const y = mu * mu * ay + 2 * mu * u * cy + u * u * by;
    const tx = 2 * mu * (cx - ax) + 2 * u * (bx - cx);
    const ty = 2 * mu * (cy - ay) + 2 * u * (by - cy);
    const tl = Math.sqrt(tx * tx + ty * ty) || 1;
    const nx = (-ty / tl) * hw;
    const ny = (tx / tl) * hw;
    leftX.push(x + nx);
    leftY.push(y + ny);
    rightX.push(x - nx);
    rightY.push(y - ny);
  }
  // Outline: left edge forward, then right edge backward.
  const polyX: number[] = [];
  const polyY: number[] = [];
  for (let k = 0; k <= RIBBON_SAMPLES; k++) {
    polyX.push(leftX[k]);
    polyY.push(leftY[k]);
  }
  for (let k = RIBBON_SAMPLES; k >= 0; k--) {
    polyX.push(rightX[k]);
    polyY.push(rightY[k]);
  }
  appendRoundedPoly(path, polyX, polyY, polyX.length, r);
}

/**
 * Build the snake as a chain of INDEPENDENT segments that wrap around corners:
 * one smooth ribbon per cell along its bent centerline (inset for a gap), so
 * segments rotate and squeeze inside / stretch outside each turn. The head and
 * tail synthesize their open end half a cell along the heading so they stay
 * full-length. Wrap seams break the neighbor links. UI-thread worklet; pure.
 */
function buildWrappedSegments(
  from: Cell[],
  to: Cell[],
  t: number,
  begin: number,
  end: number,
  origin: { x: number; y: number },
  cellSize: number,
  gap: number,
  rounded: boolean,
) {
  'worklet';
  const path = Skia.Path.Make();
  const n = to.length;
  const stop = Math.min(end, n);
  const breakSq = cellSize * 1.5 * (cellSize * 1.5);
  const hw = (cellSize - gap) / 2;
  const half = gap / 2;
  const span = cellSize / 2 - half; // half-cell reach for an open (head/tail) end
  const r = rounded ? Math.min(hw, cellSize / 4) : 0;

  for (let i = begin; i < stop; i++) {
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
      // Lone cell: an axis-aligned rounded square.
      appendRoundedPoly(
        path,
        [cx - hw, cx + hw, cx + hw, cx - hw],
        [cy - hw, cy - hw, cy + hw, cy + hw],
        4,
        r,
      );
      continue;
    }

    // End A: midpoint toward prev (inset), or a synthesized nose for the head.
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
    // End B: midpoint toward next (inset), or a synthesized tail tip.
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

    appendSmoothRibbon(path, ax, ay, cx, cy, bx, by, hw, r);
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
  /** Cell pitch in pixels. */
  cellSize: number;
  /** Absolute pixel origin for cell (0,0). */
  origin: { x: number; y: number };
  /** Inter-cell channel; segments are inset by this so they read as separate. */
  gap: number;
  /** Rounded vs square cells (mirrors skin.cellShape). */
  rounded: boolean;
  /** 'tube' = independent segments that wrap around corners; 'segments' =
   * axis-aligned discrete cells (the retro look). */
  render: 'tube' | 'segments';
  headColor: string;
  bodyColor: string;
}

/**
 * Continuous-glide snake renderer. The engine stays discrete (one cell/tick);
 * this draws the in-between frames by interpolating each segment from its
 * previous grid cell to its current one. Both looks are a chain of INDEPENDENT
 * per-cell segments: 'tube' draws each as a ribbon along its bent centerline so
 * it rotates and squeezes-inside / stretches-outside around turns (a dynamic
 * wrap); 'segments' keeps them axis-aligned (retro). The head is simply the first
 * segment in the head color. Two derived values keep the hook count fixed for any
 * length and rebuild every frame on the UI thread via the glide's Reanimated
 * clock. A pure projection of the glide state. (smooth movement)
 */
export function AnimatedSnake({
  glide,
  cellSize,
  origin,
  gap,
  rounded,
  render,
  headColor,
  bodyColor,
}: AnimatedSnakeProps) {
  const { clock, from, to, start, duration } = glide;
  const wrapped = render === 'tube';
  // A touch more separation than the raw cell gap so segments read as distinct.
  const segGap = wrapped ? Math.max(gap, cellSize * 0.12) : gap;
  const inset = gap / 2;
  const size = cellSize - gap;
  const corner = rounded ? cellSize / 4 : 0;

  const bodyPath = useDerivedValue(() => {
    'worklet';
    const t = clamp01((clock.value - start.value) / duration.value);
    if (wrapped) {
      return buildWrappedSegments(
        from.value, to.value, t, 1, to.value.length, origin, cellSize, segGap, rounded,
      );
    }
    return buildSegmentsPath(
      from.value, to.value, t, 1, to.value.length, origin, cellSize, inset, size, corner,
    );
  });

  const headPath = useDerivedValue(() => {
    'worklet';
    const t = clamp01((clock.value - start.value) / duration.value);
    if (wrapped) {
      return buildWrappedSegments(
        from.value, to.value, t, 0, 1, origin, cellSize, segGap, rounded,
      );
    }
    return buildSegmentsPath(
      from.value, to.value, t, 0, 1, origin, cellSize, inset, size, corner,
    );
  });

  return (
    <>
      <Path path={bodyPath} color={bodyColor} />
      <Path path={headPath} color={headColor} />
    </>
  );
}
