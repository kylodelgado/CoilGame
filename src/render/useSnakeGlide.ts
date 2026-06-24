import { useEffect, useRef } from 'react';
import { useClock } from '@shopify/react-native-skia';
import {
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import type { Cell } from '../engine/types';

/**
 * The per-frame glide state shared between the snake renderer and the GPS
 * camera: a frame clock plus the current tick's interpolation endpoints and
 * timing, all as shared values so worklets read them without hopping to JS.
 */
export interface SnakeGlide {
  /** Monotonic frame clock (ms since mount), driven on the UI thread. */
  clock: SharedValue<number>;
  /** Cells the snake is gliding FROM this tick (head-first). */
  from: SharedValue<Cell[]>;
  /** Cells the snake is gliding TO this tick (the authoritative grid state). */
  to: SharedValue<Cell[]>;
  /** clock value at which the current tick's glide began. */
  start: SharedValue<number>;
  /** Glide duration (ms) = the current tick interval. */
  duration: SharedValue<number>;
}

/**
 * Track the snake's discrete grid state across ticks and expose it as glide
 * endpoints + timing for sub-tick interpolation. On each new tick (the snake is
 * a fresh array) it records the previous cells as the glide source and stamps
 * the start time to "now". A length change beyond a single growth step
 * (restart/reset/first frame) is treated as a snap — source = destination — so
 * the snake never streaks from a stale shape. (smooth movement)
 */
export function useSnakeGlide(
  snake: Cell[],
  tickMs: number,
  resetKey?: number | string,
): SnakeGlide {
  const clock = useClock();
  const from = useSharedValue<Cell[]>(snake);
  const to = useSharedValue<Cell[]>(snake);
  const start = useSharedValue(0);
  const duration = useSharedValue(tickMs);

  const prevRef = useRef<Cell[]>(snake);

  useEffect(() => {
    const prev = prevRef.current;
    const isStep = Math.abs(snake.length - prev.length) <= 1;
    from.value = isStep ? prev : snake;
    to.value = snake;
    duration.value = tickMs;
    start.value = clock.value;
    prevRef.current = snake;
  }, [snake, tickMs, resetKey, clock, from, to, start, duration]);

  return { clock, from, to, start, duration };
}
