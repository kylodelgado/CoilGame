import {
  createInitialState,
  tick,
  POINTS_PER_FOOD,
  START_DIRECTION,
  START_LENGTH,
} from '../engine';
import type { Mode } from './Mode';

// Bonus-food tunables for classic play. A bonus appears every
// BONUS_SPAWN_EVERY_TICKS ticks, lingers BONUS_LIFETIME_TICKS ticks, and is
// worth BONUS_POINTS (well above a normal food) without growing the snake.
const BONUS_SPAWN_EVERY_TICKS = 60;
const BONUS_LIFETIME_TICKS = 25;
const BONUS_POINTS = 50;

/**
 * The MVP mode. buildConfig folds the chosen preset + wall + computed grid into
 * a GameConfig; createInitialState and tick delegate straight to the engine —
 * no game logic is reimplemented here.
 */
export const classicMode: Mode = {
  id: 'CLASSIC',

  buildConfig(grid, wall, preset) {
    return {
      grid,
      wallBehavior: wall,
      baseTickMs: preset.baseTickMs,
      minTickMs: preset.minTickMs,
      accelMsPerFood: preset.accelMsPerFood,
      pointsPerFood: POINTS_PER_FOOD,
      startLength: START_LENGTH,
      startDirection: START_DIRECTION,
      bonus: {
        enabled: true,
        spawnEveryTicks: BONUS_SPAWN_EVERY_TICKS,
        lifetimeTicks: BONUS_LIFETIME_TICKS,
        points: BONUS_POINTS,
      },
    };
  },

  createInitialState(config, rng) {
    return createInitialState(config, rng);
  },

  tick(state, config, rng) {
    return tick(state, config, rng);
  },
};
