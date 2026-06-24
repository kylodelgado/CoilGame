import { buildPowerups, worldGrid } from '../engine';
import type { GameConfig } from '../engine/types';
import { classicMode } from './classicMode';
import { createDynamicWallsMode } from './dynamicWallsMode';
import type { Mode } from './Mode';

// The GPS world is much larger than any on-screen viewport, so the camera
// (chunk M render) shows a moving window of it.
const GPS_WORLD_COLUMNS = 60;
const GPS_WORLD_ROWS = 60;

/**
 * Build the engine-facing config for GPS: the same config but with `grid` set to
 * the world-sized grid, so the reused engine/obstacle logic operates in WORLD
 * coordinates while the original `grid` stays the on-screen viewport.
 */
function worldEngineConfig(config: GameConfig): GameConfig {
  return config.world ? { ...config, grid: worldGrid(config.world) } : config;
}

/**
 * Create a GPS mode instance. GPS is "Dynamic Walls over a world larger than the
 * screen": it reuses classicMode's config mapping (bonus enabled) plus a large
 * WorldSpec, and delegates init/stepping/obstacle-scheduling to a Dynamic Walls
 * instance run over the world grid — so movement, collision, bonus, and
 * fair-spawn obstacle rules are all reused unchanged. Scoring/leaderboard key by
 * ModeId:WallBehavior, so 'GPS' slots in with no scoring changes. (chunk M)
 */
export function createGpsMode(): Mode {
  // Obstacle scheduling + stepping, exercised over the world grid.
  const inner = createDynamicWallsMode();

  return {
    id: 'GPS',

    buildConfig(grid, wall, preset) {
      const base = classicMode.buildConfig(grid, wall, preset);
      return {
        ...base,
        world: {
          worldColumns: GPS_WORLD_COLUMNS,
          worldRows: GPS_WORLD_ROWS,
          cellSize: grid.cellSize,
        },
        // GPS runs Dynamic Walls over the world, so it has obstacles — the full
        // powerup pool (incl. WALL_BUSTER) applies.
        powerups: buildPowerups({ walls: true }),
      };
    },

    createInitialState(config, rng) {
      // Delegating to inner resets its obstacle schedule and centers the snake
      // in the world (the world grid spans the whole world).
      return inner.createInitialState(worldEngineConfig(config), rng);
    },

    tick(state, config, rng) {
      return inner.tick(state, worldEngineConfig(config), rng);
    },
  };
}

/** The shared singleton used by the registry and the running app. */
export const gpsMode: Mode = createGpsMode();
