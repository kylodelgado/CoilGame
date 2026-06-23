import type { Direction, GameState } from './types';

const OPPOSITE: Record<Direction, Direction> = {
  UP: 'DOWN',
  DOWN: 'UP',
  LEFT: 'RIGHT',
  RIGHT: 'LEFT',
};

const MAX_QUEUE = 2;

/**
 * Queue a turn for the next ticks. The reference direction is the LAST queued
 * input (or the committed heading if the queue is empty) so that fast
 * double-swipes chain instead of folding back on themselves. Drops illegal
 * reversals, no-op repeats, and inputs beyond the 2-deep cap. Pure: returns the
 * same state reference when nothing changes, otherwise a fresh state with a
 * fresh queue array. (FR-C2, FR-C3)
 */
export function enqueueDirection(state: GameState, dir: Direction): GameState {
  const { inputQueue, direction } = state;

  // Resolve against the last queued direction, not just the heading.
  const reference =
    inputQueue.length > 0 ? inputQueue[inputQueue.length - 1] : direction;

  // Reversal guard and no-op guard.
  if (dir === OPPOSITE[reference] || dir === reference) {
    return state;
  }

  // Queue cap: drop inputs once two turns are already buffered.
  if (inputQueue.length >= MAX_QUEUE) {
    return state;
  }

  return { ...state, inputQueue: [...inputQueue, dir] };
}
