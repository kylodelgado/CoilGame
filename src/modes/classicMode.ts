import {
  createInitialState,
  tick,
  POINTS_PER_FOOD,
  START_DIRECTION,
  START_LENGTH,
} from '../engine';
import type { Mode } from './Mode';

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
    };
  },

  createInitialState(config, rng) {
    return createInitialState(config, rng);
  },

  tick(state, config, rng) {
    return tick(state, config, rng);
  },
};
