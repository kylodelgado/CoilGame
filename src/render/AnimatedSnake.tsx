import { Path, Skia } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import type { Cell } from '../engine/types';
import { clamp01, interpCell, segmentFrom } from './interpolate';
import type { SnakeGlide } from './useSnakeGlide';

/**
 * Append a SMOOTH curve through pts[s..e) to the path: each interior point is a
 * quadratic control point and the curve passes through the midpoints between
 * consecutive points, so the body genuinely bends through corners (a slither)
 * rather than making a hard L. Straight runs stay straight. UI-thread worklet.
 */
function appendSmoothRun(
  path: ReturnType<typeof Skia.Path.Make>,
  xs: number[],
  ys: number[],
  s: number,
  e: number,
) {
  'worklet';
  const m = e - s;
  if (m <= 0) {
    return;
  }
  path.moveTo(xs[s], ys[s]);
  if (m === 1) {
    // A lone cell: a zero-length subpath renders as a dot under a round cap.
    path.lineTo(xs[s], ys[s]);
    return;
  }
  if (m === 2) {
    path.lineTo(xs[s + 1], ys[s + 1]);
    return;
  }
  // Curve through the midpoints, using each interior point as the control.
  for (let i = s + 1; i < e - 2; i++) {
    const xc = (xs[i] + xs[i + 1]) / 2;
    const yc = (ys[i] + ys[i + 1]) / 2;
    path.quadTo(xs[i], ys[i], xc, yc);
  }
  path.quadTo(xs[e - 2], ys[e - 2], xs[e - 1], ys[e - 1]);
}

/**
 * Build the snake body as a smooth spline through the interpolated centers of its
 * cells, head-first. Drawn STROKED (thick, round/bevel join) this reads as one
 * continuous creature that curves through turns. The points are split into runs
 * wherever two consecutive centers are far apart in pixels (a PORTAL wrap), and
 * each run is smoothed independently so the tube never streaks across the board.
 * UI-thread worklet; pure.
 */
function buildTubePath(
  from: Cell[],
  to: Cell[],
  t: number,
  origin: { x: number; y: number },
  cellSize: number,
) {
  'worklet';
  const path = Skia.Path.Make();
  const n = to.length;
  if (n === 0) {
    return path;
  }
  // Interpolated pixel centers.
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < n; i++) {
    const c = interpCell(segmentFrom(from, to[i], i), to[i], t);
    xs.push(origin.x + (c.x + 0.5) * cellSize);
    ys.push(origin.y + (c.y + 0.5) * cellSize);
  }
  // Split into contiguous runs, breaking where a step jumps more than ~1.5 cells
  // (a wrap), and smooth each run on its own.
  const breakSq = cellSize * 1.5 * (cellSize * 1.5);
  let runStart = 0;
  for (let i = 1; i <= n; i++) {
    const wrap =
      i < n &&
      (xs[i] - xs[i - 1]) * (xs[i] - xs[i - 1]) +
        (ys[i] - ys[i - 1]) * (ys[i] - ys[i - 1]) >
        breakSq;
    if (i === n || wrap) {
      appendSmoothRun(path, xs, ys, runStart, i);
      runStart = i;
    }
  }
  return path;
}

/** A filled head cap (circle or square) at the interpolated head center. */
function buildHeadPath(
  from: Cell[],
  to: Cell[],
  t: number,
  origin: { x: number; y: number },
  cellSize: number,
  radius: number,
  rounded: boolean,
) {
  'worklet';
  const path = Skia.Path.Make();
  if (to.length === 0) {
    return path;
  }
  const c = interpCell(segmentFrom(from, to[0], 0), to[0], t);
  const cx = origin.x + (c.x + 0.5) * cellSize;
  const cy = origin.y + (c.y + 0.5) * cellSize;
  if (rounded) {
    path.addCircle(cx, cy, radius);
  } else {
    path.addRect(Skia.XYWHRect(cx - radius, cy - radius, radius * 2, radius * 2));
  }
  return path;
}

/**
 * Build the snake as discrete rounded-rect cells over [begin,end) — the classic
 * blocky look, each cell inset by the gap so neighbors read as separate segments.
 * Each cell is independent, so wraps need no special handling. UI-thread worklet.
 */
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
  /**
   * Absolute pixel origin for cell (0,0). For Classic this is the grid origin;
   * for GPS it is the world origin and a parent <Group> applies the camera pan,
   * so the snake is always drawn at absolute world-pixel coordinates here.
   */
  origin: { x: number; y: number };
  /** Inter-cell channel; the tube is `cellSize - gap` thick / segments inset by gap. */
  gap: number;
  /** Rounded vs square cells (mirrors skin.cellShape) — sets joins/caps. */
  rounded: boolean;
  /** 'tube' = continuous stroked body; 'segments' = discrete rounded cells. */
  render: 'tube' | 'segments';
  headColor: string;
  bodyColor: string;
}

/**
 * Continuous-glide snake renderer. The engine stays discrete (one cell/tick);
 * this draws the in-between frames by interpolating each segment from its
 * previous grid cell to its current one. The skin chooses the look: 'tube'
 * renders the whole body as one stroked path (a flowing tube with rounded
 * corners) plus a brighter head cap; 'segments' renders discrete rounded cells
 * with a gap (the classic blocky snake). Two derived values keep the hook count
 * fixed for any length and rebuild every frame on the UI thread via the glide's
 * Reanimated clock. A pure projection of the glide state. (smooth movement)
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
  const tube = render === 'tube';
  const thickness = cellSize - gap;
  const headRadius = thickness / 2;
  const inset = gap / 2;
  const size = cellSize - gap;
  const corner = rounded ? cellSize / 4 : 0;

  const bodyPath = useDerivedValue(() => {
    'worklet';
    const t = clamp01((clock.value - start.value) / duration.value);
    if (tube) {
      return buildTubePath(from.value, to.value, t, origin, cellSize);
    }
    return buildSegmentsPath(
      from.value,
      to.value,
      t,
      1,
      to.value.length,
      origin,
      cellSize,
      inset,
      size,
      corner,
    );
  });

  const headPath = useDerivedValue(() => {
    'worklet';
    const t = clamp01((clock.value - start.value) / duration.value);
    if (tube) {
      return buildHeadPath(
        from.value,
        to.value,
        t,
        origin,
        cellSize,
        headRadius,
        rounded,
      );
    }
    return buildSegmentsPath(
      from.value,
      to.value,
      t,
      0,
      1,
      origin,
      cellSize,
      inset,
      size,
      corner,
    );
  });

  return (
    <>
      {tube ? (
        <Path
          path={bodyPath}
          color={bodyColor}
          style="stroke"
          strokeWidth={thickness}
          strokeJoin={rounded ? 'round' : 'bevel'}
          strokeCap={rounded ? 'round' : 'square'}
        />
      ) : (
        <Path path={bodyPath} color={bodyColor} />
      )}
      <Path path={headPath} color={headColor} />
    </>
  );
}
