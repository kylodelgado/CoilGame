import { Path, Skia } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import type { Cell } from '../engine/types';
import { clamp01, interpCell, segmentFrom } from './interpolate';
import type { SnakeGlide } from './useSnakeGlide';

/**
 * Build the snake body as a single polyline through the interpolated centers of
 * its cells, head-first. Drawn STROKED (thick, with round/bevel joins) this reads
 * as one continuous tube that flows around corners — instead of a chain of
 * separate squares that visibly jump at turns. The path breaks (moveTo) whenever
 * two consecutive drawn points are far apart in pixels, which happens on a PORTAL
 * wrap, so the tube never streaks across the board. UI-thread worklet; pure.
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
  // A real step covers ~1 cell; anything bigger is a wrap/snap → break the tube.
  const breakSq = (cellSize * 1.5) * (cellSize * 1.5);
  let prevX = 0;
  let prevY = 0;
  let started = false;
  for (let i = 0; i < to.length; i++) {
    const c = interpCell(segmentFrom(from, to[i], i), to[i], t);
    const x = origin.x + (c.x + 0.5) * cellSize;
    const y = origin.y + (c.y + 0.5) * cellSize;
    if (!started) {
      path.moveTo(x, y);
      started = true;
    } else {
      const dx = x - prevX;
      const dy = y - prevY;
      if (dx * dx + dy * dy > breakSq) {
        path.moveTo(x, y);
      } else {
        path.lineTo(x, y);
      }
    }
    prevX = x;
    prevY = y;
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
