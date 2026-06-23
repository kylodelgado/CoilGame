import type { RandomPort } from '../services/RandomPort';
import { createInitialState } from './createInitialState';
import { tick } from './tick';
import type {
  GameConfig,
  GameState,
  GridSpec,
  TickResult,
  WorldSpec,
} from './types';

/**
 * The world model for GPS mode. A world-based config keeps `grid` as the small
 * on-screen viewport but adds a `world` WorldSpec describing the full play area.
 * These helpers run the existing pure engine over a WORLD-sized grid, so all the
 * movement / collision / spawn / win rules are reused unchanged — only the bounds
 * grow. Fixed-board modes (no `world`) are entirely untouched. (chunk M)
 */

/** A GridSpec spanning the entire world (origin 0,0). */
export function worldGrid(spec: WorldSpec): GridSpec {
  return {
    columns: spec.worldColumns,
    rows: spec.worldRows,
    cellSize: spec.cellSize,
    originX: 0,
    originY: 0,
  };
}

/**
 * The effective engine config for stepping: when `world` is set the engine runs
 * over the world-sized grid; otherwise the config is used as-is (fixed board).
 */
function engineConfig(config: GameConfig): GameConfig {
  return config.world ? { ...config, grid: worldGrid(config.world) } : config;
}

/**
 * Build a starting GameState in WORLD coordinates: the snake is centered in the
 * world and the first food is spawned anywhere within it (possibly off-screen).
 * Delegates to the engine's createInitialState over the world grid.
 */
export function createWorldInitialState(
  config: GameConfig,
  rng: RandomPort,
): GameState {
  return createInitialState(engineConfig(config), rng);
}

/**
 * One world step. A thin wrapper that delegates to the engine `tick` over the
 * world grid, so movement, eating/growth, obstacle collision, bonus, and the
 * SOLID/PORTAL world-bound behavior all match the fixed engine exactly.
 */
export function worldTick(
  state: GameState,
  config: GameConfig,
  rng: RandomPort,
): TickResult {
  return tick(state, engineConfig(config), rng);
}
