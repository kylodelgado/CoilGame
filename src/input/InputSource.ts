import type { Direction } from '../engine/types';

/**
 * A source of Direction input. Implementations push Direction events to
 * subscribers; subscribe returns an unsubscribe function. This is the seam that
 * lets a D-pad replace swipes in Phase 2 without touching the GameScreen.
 */
export interface InputSource {
  subscribe(onDirection: (dir: Direction) => void): () => void;
}

/** Minimum travel (px) for a swipe to count as a turn. */
export const SWIPE_THRESHOLD_PX = 30;

/**
 * Pure swipe-to-Direction mapping. Returns null when the larger axis travels
 * less than `threshold`; otherwise picks the dominant axis (ties go horizontal)
 * and maps sign to a Direction, with y growing downward. All the turn logic that
 * matters lives here so it is unit-testable without gestures. (FR-C1/C4)
 */
export function translationToDirection(
  dx: number,
  dy: number,
  threshold: number = SWIPE_THRESHOLD_PX,
): Direction | null {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) {
    return null;
  }
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx > 0 ? 'RIGHT' : 'LEFT';
  }
  return dy > 0 ? 'DOWN' : 'UP';
}
