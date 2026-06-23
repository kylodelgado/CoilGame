import type { RandomPort } from '../services/RandomPort';
import type { Cell, GameConfig, GameState } from './types';

/**
 * Spawn a new food cell on an empty square, chosen uniformly at random via the
 * injected RandomPort. Enumerates the empty set rather than guess-and-retry, so
 * it stays O(cells) and terminates even on a near-full grid. Returns null when
 * no empty cell remains — the win signal consumed by `tick`. (FR-F2, EH-8)
 */
export function spawnFood(
  state: GameState,
  config: GameConfig,
  rng: RandomPort,
): Cell | null {
  const { columns, rows } = config.grid;

  const occupied = new Set(state.snake.map((c) => c.y * columns + c.x));

  const empty: Cell[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      if (!occupied.has(y * columns + x)) {
        empty.push({ x, y });
      }
    }
  }

  if (empty.length === 0) {
    return null;
  }

  return empty[rng.nextInt(empty.length)];
}
