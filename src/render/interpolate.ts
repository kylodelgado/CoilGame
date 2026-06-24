import type { Cell } from '../engine/types';

/**
 * Pure sub-tick interpolation math for the snake's continuous glide. The engine
 * stays discrete (one cell per tick); these helpers project the in-between
 * frames so the render layer can draw the snake sliding from its previous grid
 * position to its current one. No React/Skia here — just numbers — so it is
 * cheap, unit-testable, and safe to call from a Reanimated worklet.
 */

/** Linear interpolation. */
export function lerp(a: number, b: number, t: number): number {
  'worklet';
  return a + (b - a) * t;
}

/** Clamp t into the unit interval (frames can briefly overshoot a tick). */
export function clamp01(t: number): number {
  'worklet';
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

/**
 * The cell a rendered segment glides FROM for snake index `i`.
 *
 * On a normal move newSnake[i] === oldSnake[i-1], so visually each index slides
 * one slot toward the head: index i travels oldSnake[i] -> newSnake[i]. When the
 * snake grew this tick there is no oldSnake[i] for the new tail index, so it
 * emerges from the old tail (the last previous cell) — i.e. it stays put while
 * the rest of the body pulls forward. Returns `to` itself when there is no
 * previous frame (first tick / reset), yielding a no-op glide.
 */
export function segmentFrom(prev: Cell[], to: Cell, i: number): Cell {
  'worklet';
  if (prev.length === 0) {
    return to;
  }
  return i < prev.length ? prev[i] : prev[prev.length - 1];
}

/**
 * Is the step from `from` to `to` a PORTAL wrap (an edge-to-edge jump of more
 * than one cell on either axis)? Such a step must be snapped, not lerped, or the
 * segment would streak straight across the board instead of wrapping.
 */
export function isWrap(from: Cell, to: Cell): boolean {
  'worklet';
  return Math.abs(to.x - from.x) > 1 || Math.abs(to.y - from.y) > 1;
}

/**
 * The interpolated (possibly fractional) cell position for a segment at glide
 * fraction `t`. Wrapping steps snap to the destination once past the tick's
 * midpoint so the segment reappears on the far edge rather than sliding across.
 */
export function interpCell(from: Cell, to: Cell, t: number): { x: number; y: number } {
  'worklet';
  if (isWrap(from, to)) {
    return t < 0.5 ? { x: from.x, y: from.y } : { x: to.x, y: to.y };
  }
  return { x: lerp(from.x, to.x, t), y: lerp(from.y, to.y, t) };
}
