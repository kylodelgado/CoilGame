import {
  createInitialState,
  enqueueDirection,
  tick,
  type Cell,
  type Direction,
  type GameConfig,
  type GameState,
  type GridSpec,
} from '../src/engine';
import { createSeededRandom } from '../src/services/RandomPort';

// A hand-made tiny grid. 4x4 is small enough to fill quickly and admits a
// simple Hamiltonian cycle (a closed tour visiting every cell exactly once).
const GRID: GridSpec = {
  columns: 4,
  rows: 4,
  cellSize: 10,
  originX: 0,
  originY: 0,
};

function makeConfig(): GameConfig {
  return {
    grid: GRID,
    wallBehavior: 'SOLID',
    baseTickMs: 200,
    minTickMs: 90,
    accelMsPerFood: 4,
    pointsPerFood: 10,
    startLength: 3,
    startDirection: 'RIGHT',
    bonus: { enabled: false, spawnEveryTicks: 60, lifetimeTicks: 25, points: 50 },
  };
}

// A Hamiltonian cycle over the 4x4 grid (column 0 is the return spine).
// Consecutive entries are grid-adjacent and the last wraps to the first.
// A snake that always steps to its cycle-successor never self-collides and
// visits every cell each lap — so it eats every food and ultimately fills
// the board, guaranteeing a deterministic WIN regardless of food placement.
const CYCLE: Cell[] = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 2, y: 0 },
  { x: 3, y: 0 },
  { x: 3, y: 1 },
  { x: 2, y: 1 },
  { x: 1, y: 1 },
  { x: 1, y: 2 },
  { x: 2, y: 2 },
  { x: 3, y: 2 },
  { x: 3, y: 3 },
  { x: 2, y: 3 },
  { x: 1, y: 3 },
  { x: 0, y: 3 },
  { x: 0, y: 2 },
  { x: 0, y: 1 },
];

const key = (c: Cell) => `${c.x},${c.y}`;
const CYCLE_INDEX = new Map(CYCLE.map((c, i) => [key(c), i]));

function dirBetween(from: Cell, to: Cell): Direction {
  if (to.x === from.x + 1) return 'RIGHT';
  if (to.x === from.x - 1) return 'LEFT';
  if (to.y === from.y + 1) return 'DOWN';
  if (to.y === from.y - 1) return 'UP';
  throw new Error(`cells not adjacent: ${key(from)} -> ${key(to)}`);
}

function nextCycleDir(head: Cell): Direction {
  const i = CYCLE_INDEX.get(key(head));
  if (i === undefined) throw new Error(`head off cycle: ${key(head)}`);
  const target = CYCLE[(i + 1) % CYCLE.length];
  return dirBetween(head, target);
}

function assertAliveInvariants(
  state: GameState,
  config: GameConfig,
  prevTickMs: number,
): void {
  // Scoring and growth track foodEaten exactly.
  expect(state.score).toBe(state.foodEaten * config.pointsPerFood);
  expect(state.snake).toHaveLength(config.startLength + state.foodEaten);

  // No self-overlap while alive.
  const keys = state.snake.map(key);
  expect(new Set(keys).size).toBe(keys.length);

  // Food (when present) is never on the snake.
  if (state.food !== null) {
    expect(new Set(keys).has(key(state.food))).toBe(false);
  }

  // Speed is monotonically non-increasing and clamped at the floor.
  expect(state.tickMs).toBeLessThanOrEqual(prevTickMs);
  expect(state.tickMs).toBeGreaterThanOrEqual(config.minTickMs);
}

describe('engine integration — scripted full game', () => {
  it('plays a fixed-seed game to a real WON, holding all invariants', () => {
    const config = makeConfig();
    const rng = createSeededRandom(20240601);

    let state: GameState = createInitialState(config, rng);
    expect(state.status).toBe('TAP_TO_START');

    // Transition to RUNNING.
    state = { ...state, status: 'RUNNING' };

    let prevTickMs = state.tickMs;
    let steps = 0;
    const maxSteps = GRID.columns * GRID.rows * 20; // generous safety cap

    while (state.status === 'RUNNING' && steps < maxSteps) {
      const dir = nextCycleDir(state.snake[0]);
      state = enqueueDirection(state, dir);
      const result = tick(state, config, rng);
      state = result.state;

      // 'DIED' must never occur on this guaranteed-safe tour.
      expect(result.events).not.toContain('DIED');

      if (state.status === 'RUNNING' || state.status === 'WON') {
        assertAliveInvariants(state, config, prevTickMs);
      }
      prevTickMs = state.tickMs;
      steps += 1;
    }

    expect(state.status).toBe('WON');
    expect(state.food).toBeNull();
    expect(state.snake).toHaveLength(GRID.columns * GRID.rows);
    expect(state.foodEaten).toBe(GRID.columns * GRID.rows - config.startLength);
    expect(state.score).toBe(state.foodEaten * config.pointsPerFood);
  });

  it('plays a short game that ends in LOST by driving into a SOLID wall', () => {
    const config = makeConfig();
    const rng = createSeededRandom(7);

    let state: GameState = createInitialState(config, rng);
    state = { ...state, status: 'RUNNING' };

    // Head starts at center pointing RIGHT; keep going RIGHT into the wall.
    let died = false;
    let steps = 0;
    while (state.status === 'RUNNING' && steps < 10) {
      state = enqueueDirection(state, 'RIGHT');
      const result = tick(state, config, rng);
      state = result.state;
      if (result.events.includes('DIED')) {
        died = true;
        break;
      }
      steps += 1;
    }

    expect(died).toBe(true);
    expect(state.status).toBe('LOST');
  });
});
