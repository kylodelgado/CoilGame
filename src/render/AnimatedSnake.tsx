import { Path, Skia } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import type { Cell } from '../engine/types';
import { clamp01, interpCell, segmentFrom } from './interpolate';
import type { SnakeGlide } from './useSnakeGlide';

/**
 * Build a Skia path of the interpolated snake over the half-open index range
 * [begin,end). Runs on the UI thread (worklet); pure given its inputs.
 */
function buildSnakePath(
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
    const f = segmentFrom(from, to[i], i);
    const c = interpCell(f, to[i], t);
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
  /** Inter-cell channel; the drawn square is inset by gap/2 on every side. */
  gap: number;
  /** Rounded vs square cells (mirrors skin.cellShape). */
  rounded: boolean;
  headColor: string;
  bodyColor: string;
}

/**
 * Continuous-glide snake renderer. The engine stays discrete (one cell/tick);
 * this draws the in-between frames by interpolating each segment from its
 * previous grid cell to its current one, rebuilding the snake as two Skia paths
 * (head + body, for their distinct colors) every frame on the UI thread via the
 * glide's Reanimated clock. One derived value per path keeps the hook count
 * fixed for any snake length. A pure projection of the glide state. (smooth
 * movement)
 */
export function AnimatedSnake({
  glide,
  cellSize,
  origin,
  gap,
  rounded,
  headColor,
  bodyColor,
}: AnimatedSnakeProps) {
  const { clock, from, to, start, duration } = glide;
  const inset = gap / 2;
  const size = cellSize - gap;
  const corner = rounded ? cellSize / 4 : 0;

  // One worklet builds a Skia path over a [begin,end) slice of the snake so the
  // head and body can be drawn in their own colors from a single code path.
  const headPath = useDerivedValue(() => {
    'worklet';
    const t = clamp01((clock.value - start.value) / duration.value);
    return buildSnakePath(
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

  const bodyPath = useDerivedValue(() => {
    'worklet';
    const t = clamp01((clock.value - start.value) / duration.value);
    return buildSnakePath(
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

  return (
    <>
      <Path path={bodyPath} color={bodyColor} />
      <Path path={headPath} color={headColor} />
    </>
  );
}
