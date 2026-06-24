import {
  createInitialState as engineCreateInitialState,
  tick as engineTick,
  buildPowerups,
  computeNextHead,
  resolveWall,
} from '../engine';
import type { Cell, GameConfig, GameState, TickResult } from '../engine/types';
import type { RandomPort } from '../services/RandomPort';
import { classicMode } from './classicMode';
import type { Mode } from './Mode';
import { placeShape } from './wallShapes';

/** Scheduling/placement tunables for Dynamic Walls. */
export interface DynamicWallsTunables {
  /** Evolve the obstacle set every this many RUNNING ticks. */
  changeEveryTicks: number;
  /** Hard cap on obstacle CELLS; the oldest cells are dropped past the cap. */
  maxObstacles: number;
  /** How many obstacle SHAPES to add per scheduled change. */
  obstaclesPerChange: number;
}

export const DYNAMIC_WALLS_TUNABLES: DynamicWallsTunables = {
  changeEveryTicks: 20,
  maxObstacles: 16,
  obstaclesPerChange: 1,
};

const sameCell = (a: Cell, b: Cell): boolean => a.x === b.x && a.y === b.y;

/** The cell the head will enter THIS tick, or null if it would leave a solid edge. */
function headNextCell(state: GameState, config: GameConfig): Cell | null {
  const dir =
    state.inputQueue.length > 0 ? state.inputQueue[0] : state.direction;
  const raw = computeNextHead(state.snake[0], dir);
  const wall = resolveWall(raw, config.grid, config.wallBehavior);
  return wall.kind === 'OUT_OF_BOUNDS' ? null : wall.cell;
}

/**
 * Evolve the obstacle set immutably: add obstaclesPerChange SHAPES (lines, Ls,
 * squares — see wallShapes) on fair cells chosen via rng, never overlapping the
 * snake, food, bonus, an existing obstacle, or the cell the head will enter this
 * tick (no instant trap, EH-18). Past the maxObstacles cell cap the oldest cells
 * are dropped to make room, so the hazard field keeps churning.
 */
function evolveObstacles(
  state: GameState,
  config: GameConfig,
  rng: RandomPort,
  tunables: DynamicWallsTunables,
): Cell[] {
  const { columns } = config.grid;
  const headNext = headNextCell(state, config);

  let obstacles = state.obstacles;

  for (let i = 0; i < tunables.obstaclesPerChange; i++) {
    // Cells that are off-limits for a new obstacle this iteration.
    const blocked = new Set<number>();
    const block = (c: Cell) => blocked.add(c.y * columns + c.x);
    state.snake.forEach(block);
    obstacles.forEach(block);
    if (state.food) block(state.food);
    if (state.bonusFood) block(state.bonusFood);
    if (headNext) block(headNext);

    const cells = placeShape(blocked, config.grid, rng);
    if (cells.length === 0) {
      break; // nowhere fair to place — skip the rest of this change
    }

    let next = [...obstacles, ...cells];
    if (next.length > tunables.maxObstacles) {
      // Drop the oldest cells (front of the queue) to stay within the cap.
      next = next.slice(next.length - tunables.maxObstacles);
    }
    obstacles = next;
  }

  return obstacles;
}

/**
 * Create a Dynamic Walls mode instance. The tick counter lives in this closure
 * (reset by createInitialState), so the const singleton is correct for the
 * app's single active game and tests can spin up isolated instances with custom
 * tunables. Stepping/collision are NOT reimplemented — the engine already kills
 * on obstacle contact (step 38); this mode only schedules obstacle changes.
 */
export function createDynamicWallsMode(
  overrides: Partial<DynamicWallsTunables> = {},
): Mode {
  const tunables: DynamicWallsTunables = { ...DYNAMIC_WALLS_TUNABLES, ...overrides };
  let runningTicks = 0;

  return {
    id: 'DYNAMIC_WALLS',

    buildConfig(grid, wall, preset) {
      // Classic base (incl. bonus timing), plus the full powerup pool — this is
      // the mode with obstacles, so WALL_BUSTER is enabled here. Dynamic-walls
      // scheduling tunables stay mode-local, not part of GameConfig.
      return {
        ...classicMode.buildConfig(grid, wall, preset),
        powerups: buildPowerups({ walls: true }),
      };
    },

    createInitialState(config, rng): GameState {
      runningTicks = 0;
      return { ...engineCreateInitialState(config, rng), obstacles: [] };
    },

    tick(state, config, rng): TickResult {
      // Only evolve while RUNNING; otherwise delegate the engine no-op untouched.
      if (state.status !== 'RUNNING') {
        return engineTick(state, config, rng);
      }

      runningTicks += 1;
      let stepState = state;
      if (runningTicks % tunables.changeEveryTicks === 0) {
        const obstacles = evolveObstacles(state, config, rng, tunables);
        if (obstacles !== state.obstacles) {
          stepState = { ...state, obstacles };
        }
      }

      // Delegate movement/collision/spawn to the engine; the new obstacles ride
      // forward via the engine's `...state` spread.
      return engineTick(stepState, config, rng);
    },
  };
}

/** The shared singleton used by the registry and the running app. */
export const dynamicWallsMode: Mode = createDynamicWallsMode();
