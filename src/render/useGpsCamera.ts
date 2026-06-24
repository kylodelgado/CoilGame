import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import type { Transforms3d } from '@shopify/react-native-skia';
import type { WorldSpec } from '../engine/types';
import { clamp01, interpCell } from './interpolate';
import type { Viewport } from './camera';
import type { SnakeGlide } from './useSnakeGlide';

/**
 * A smoothly-panning GPS camera. Where the per-tick viewport snaps the window to
 * the integer head, this derives a CONTINUOUS window origin from the
 * interpolated head and exposes it as a Skia translate transform — so the world
 * (grid + entities + snake) pans beneath a head that stays centered, instead of
 * the head sliding a cell forward then snapping back each tick. The origin is
 * clamped to world bounds exactly like computeViewport so the camera never
 * reveals beyond the edges. Runs per frame on the UI thread. (smooth GPS)
 */
export function useGpsCamera(
  glide: SnakeGlide,
  viewport: Viewport,
  world: WorldSpec,
  cellSize: number,
): SharedValue<Transforms3d> {
  const { clock, from, to, start, duration } = glide;
  return useDerivedValue<Transforms3d>(() => {
    'worklet';
    const dest = to.value;
    if (dest.length === 0) {
      return [{ translateX: 0 }, { translateY: 0 }];
    }
    const t = clamp01((clock.value - start.value) / duration.value);
    const src = from.value;
    const head = interpCell(src.length > 0 ? src[0] : dest[0], dest[0], t);

    const maxCol = Math.max(0, world.worldColumns - viewport.cols);
    const maxRow = Math.max(0, world.worldRows - viewport.rows);
    const clamp = (v: number, max: number) =>
      v < 0 ? 0 : v > max ? max : v;
    const originCol = clamp(head.x - Math.floor(viewport.cols / 2), maxCol);
    const originRow = clamp(head.y - Math.floor(viewport.rows / 2), maxRow);

    return [
      { translateX: -originCol * cellSize },
      { translateY: -originRow * cellSize },
    ];
  });
}
