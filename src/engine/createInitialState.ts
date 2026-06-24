import type { RandomPort } from '../services/RandomPort';
import { spawnFood, BONUS_DISABLED } from './food';
import type { Cell, GameConfig, GameState } from './types';

/**
 * Assemble a valid starting GameState: a horizontal snake of config.startLength
 * cells centered on the grid with its head (snake[0]) as the rightmost cell and
 * pointing RIGHT, plus the first food spawned on an empty cell. Pure given rng;
 * reuses spawnFood. (FR-D4, FR-F1/2)
 */
export function createInitialState(
  config: GameConfig,
  rng: RandomPort,
): GameState {
  const { columns, rows } = config.grid;

  const headX = Math.floor(columns / 2);
  const headY = Math.floor(rows / 2);

  // Head is the rightmost cell; the body trails to its left along the row.
  const snake: Cell[] = [];
  for (let i = 0; i < config.startLength; i++) {
    snake.push({ x: headX - i, y: headY });
  }

  const base: GameState = {
    status: 'TAP_TO_START',
    snake,
    direction: config.startDirection,
    inputQueue: [],
    food: null,
    score: 0,
    foodEaten: 0,
    tickMs: config.baseTickMs,
    bonusFood: null,
    bonusRemaining: 0,
    // Countdown begins immediately when enabled; a disabled sentinel otherwise.
    ticksUntilBonus: config.bonus.enabled
      ? config.bonus.spawnEveryTicks
      : BONUS_DISABLED,
    obstacles: [],
    // Powerup state is seeded only for modes that opt in, so classic stays
    // byte-identical. (Phase 2 powerups)
    ...(config.powerups
      ? { activeEffects: [], slowMs: 0, pickupBanner: null }
      : {}),
  };

  return { ...base, food: spawnFood(base, config, rng) };
}
