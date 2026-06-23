import type { RandomPort } from '../services/RandomPort';
import type { Cell, GameConfig, GameState } from './types';

/**
 * Sentinel for ticksUntilBonus when the bonus feature is disabled. The engine
 * never decrements it in that case, so classic play stays byte-identical.
 */
export const BONUS_DISABLED = Number.POSITIVE_INFINITY;

/**
 * Enumerate every cell not occupied by the snake, the regular food, the active
 * bonus, or any obstacle, per the requested exclusions. Shared empty-cell scan
 * used by food and bonus spawning so the two never overlap (EH-19). O(cells).
 */
function emptyCells(
  state: GameState,
  config: GameConfig,
  opts: { excludeFood: boolean; excludeBonus: boolean },
): Cell[] {
  const { columns, rows } = config.grid;

  const occupied = new Set(state.snake.map((c) => c.y * columns + c.x));
  if (opts.excludeFood && state.food !== null) {
    occupied.add(state.food.y * columns + state.food.x);
  }
  if (opts.excludeBonus && state.bonusFood !== null) {
    occupied.add(state.bonusFood.y * columns + state.bonusFood.x);
  }

  const empty: Cell[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      if (!occupied.has(y * columns + x)) {
        empty.push({ x, y });
      }
    }
  }
  return empty;
}

/**
 * Spawn a new food cell on an empty square, chosen uniformly at random via the
 * injected RandomPort. Enumerates the empty set rather than guess-and-retry, so
 * it stays O(cells) and terminates even on a near-full grid. Excludes the active
 * bonus cell so food and bonus never overlap (EH-19). Returns null when no empty
 * cell remains — the win signal consumed by `tick`. (FR-F2, EH-8)
 */
export function spawnFood(
  state: GameState,
  config: GameConfig,
  rng: RandomPort,
): Cell | null {
  const empty = emptyCells(state, config, {
    excludeFood: false,
    excludeBonus: true,
  });
  if (empty.length === 0) {
    return null;
  }
  return empty[rng.nextInt(empty.length)];
}

/**
 * Spawn a bonus pickup on an empty square, excluding the snake AND the regular
 * food so the two never collide (EH-19). Returns null when no empty cell remains
 * (near-full grid) so the caller can skip spawning this tick. Deterministic via
 * the injected RandomPort.
 */
export function spawnBonus(
  state: GameState,
  config: GameConfig,
  rng: RandomPort,
): Cell | null {
  const empty = emptyCells(state, config, {
    excludeFood: true,
    excludeBonus: true,
  });
  if (empty.length === 0) {
    return null;
  }
  return empty[rng.nextInt(empty.length)];
}
