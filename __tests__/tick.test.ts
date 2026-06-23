import { tick } from '../src/engine/tick';
import { createSeededRandom } from '../src/services/RandomPort';
import type {
  Cell,
  Direction,
  GameConfig,
  GameState,
  GridSpec,
  WallBehavior,
} from '../src/engine/types';

function makeGrid(columns: number, rows: number): GridSpec {
  return { columns, rows, cellSize: 10, originX: 0, originY: 0 };
}

function makeConfig(
  grid: GridSpec,
  wallBehavior: WallBehavior = 'SOLID',
): GameConfig {
  return {
    grid,
    wallBehavior,
    baseTickMs: 200,
    minTickMs: 90,
    accelMsPerFood: 4,
    pointsPerFood: 10,
    startLength: 3,
    startDirection: 'RIGHT',
    bonus: { enabled: false, spawnEveryTicks: 60, lifetimeTicks: 25, points: 50 },
  };
}

function makeState(over: Partial<GameState> & { snake: Cell[] }): GameState {
  return {
    status: 'RUNNING',
    direction: 'RIGHT',
    inputQueue: [],
    food: null,
    score: 0,
    foodEaten: 0,
    tickMs: 200,
    bonusFood: null,
    bonusRemaining: 0,
    // Finite sentinel (not Infinity) so JSON-clone snapshots round-trip; these
    // tests run with bonus disabled, so the engine never reads this value.
    ticksUntilBonus: Number.MAX_SAFE_INTEGER,
    obstacles: [],
    ...over,
  };
}

const rng = () => createSeededRandom(123);
const key = (c: Cell) => `${c.x},${c.y}`;

describe('tick (FR-S1, FR-D1/2/3, FR-F3/4, FR-SC1)', () => {
  it('commits a queued direction before moving, head advances one cell', () => {
    const config = makeConfig(makeGrid(8, 8));
    const state = makeState({
      snake: [
        { x: 3, y: 3 },
        { x: 2, y: 3 },
        { x: 1, y: 3 },
      ],
      direction: 'RIGHT',
      inputQueue: ['UP'],
      food: { x: 7, y: 7 },
    });
    const { state: next } = tick(state, config, rng());
    expect(next.direction).toBe('UP');
    expect(next.inputQueue).toEqual([]);
    expect(next.snake[0]).toEqual({ x: 3, y: 2 });
  });

  it('keeps length constant on a non-eating tick (tail pops, head advances)', () => {
    const config = makeConfig(makeGrid(8, 8));
    const state = makeState({
      snake: [
        { x: 3, y: 3 },
        { x: 2, y: 3 },
        { x: 1, y: 3 },
      ],
      food: { x: 6, y: 6 },
    });
    const { state: next, events } = tick(state, config, rng());
    expect(next.snake).toHaveLength(3);
    expect(next.snake[0]).toEqual({ x: 4, y: 3 });
    expect(next.snake).not.toContainEqual({ x: 1, y: 3 }); // old tail gone
    expect(events).toEqual([]);
  });

  it('eats: grows by one, score += 10, foodEaten++, respawns food, speeds up', () => {
    const config = makeConfig(makeGrid(8, 8));
    const state = makeState({
      snake: [
        { x: 3, y: 3 },
        { x: 2, y: 3 },
        { x: 1, y: 3 },
      ],
      food: { x: 4, y: 3 },
    });
    const { state: next, events } = tick(state, config, rng());
    expect(next.snake).toHaveLength(4);
    expect(next.snake[0]).toEqual({ x: 4, y: 3 });
    expect(next.score).toBe(10);
    expect(next.foodEaten).toBe(1);
    expect(next.tickMs).toBe(196); // 200 - 4*1
    expect(next.tickMs).toBeLessThan(state.tickMs);
    expect(next.food).not.toBeNull();
    const occupied = new Set(next.snake.map(key));
    expect(occupied.has(key(next.food as Cell))).toBe(false);
    expect(events).toEqual(['ATE_FOOD']);
  });

  it('tail-follow is SAFE: moving into the cell the tail vacates does not kill', () => {
    const config = makeConfig(makeGrid(4, 4));
    // Square loop; head (0,0) moving DOWN lands on the tail (0,1) it vacates.
    const state = makeState({
      snake: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ],
      direction: 'DOWN',
      food: { x: 3, y: 3 },
    });
    const { state: next, events } = tick(state, config, rng());
    expect(events).toEqual([]);
    expect(next.status).toBe('RUNNING');
    expect(next.snake[0]).toEqual({ x: 0, y: 1 });
    expect(next.snake).toHaveLength(4);
  });

  it('self-collision into the body IS fatal', () => {
    const config = makeConfig(makeGrid(5, 5));
    // Head (1,1) moving DOWN into (1,2), a mid-body cell (not the tail).
    const state = makeState({
      snake: [
        { x: 1, y: 1 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 1 },
        { x: 2, y: 2 },
        { x: 1, y: 2 },
        { x: 0, y: 2 },
        { x: 0, y: 1 },
      ],
      direction: 'DOWN',
      food: { x: 4, y: 4 },
    });
    const { state: next, events } = tick(state, config, rng());
    expect(events).toEqual(['DIED']);
    expect(next.status).toBe('LOST');
  });

  describe('SOLID walls: stepping off an edge is fatal', () => {
    const config = makeConfig(makeGrid(5, 5), 'SOLID');
    const cases: { dir: Direction; snake: Cell[] }[] = [
      {
        dir: 'LEFT',
        snake: [
          { x: 0, y: 2 },
          { x: 1, y: 2 },
          { x: 2, y: 2 },
        ],
      },
      {
        dir: 'RIGHT',
        snake: [
          { x: 4, y: 2 },
          { x: 3, y: 2 },
          { x: 2, y: 2 },
        ],
      },
      {
        dir: 'UP',
        snake: [
          { x: 2, y: 0 },
          { x: 2, y: 1 },
          { x: 2, y: 2 },
        ],
      },
      {
        dir: 'DOWN',
        snake: [
          { x: 2, y: 4 },
          { x: 2, y: 3 },
          { x: 2, y: 2 },
        ],
      },
    ];
    it.each(cases)('dies stepping $dir off the edge', ({ dir, snake }) => {
      const state = makeState({ snake, direction: dir, food: { x: 0, y: 0 } });
      const { state: next, events } = tick(state, config, rng());
      expect(events).toEqual(['DIED']);
      expect(next.status).toBe('LOST');
    });
  });

  describe('PORTAL walls: wrapping an edge keeps the snake alive', () => {
    const config = makeConfig(makeGrid(5, 5), 'PORTAL');
    const cases: { dir: Direction; snake: Cell[]; head: Cell }[] = [
      {
        dir: 'LEFT',
        snake: [
          { x: 0, y: 2 },
          { x: 1, y: 2 },
          { x: 2, y: 2 },
        ],
        head: { x: 4, y: 2 },
      },
      {
        dir: 'RIGHT',
        snake: [
          { x: 4, y: 2 },
          { x: 3, y: 2 },
          { x: 2, y: 2 },
        ],
        head: { x: 0, y: 2 },
      },
      {
        dir: 'UP',
        snake: [
          { x: 2, y: 0 },
          { x: 2, y: 1 },
          { x: 2, y: 2 },
        ],
        head: { x: 2, y: 4 },
      },
      {
        dir: 'DOWN',
        snake: [
          { x: 2, y: 4 },
          { x: 2, y: 3 },
          { x: 2, y: 2 },
        ],
        head: { x: 2, y: 0 },
      },
    ];
    it.each(cases)('wraps $dir and survives', ({ dir, snake, head }) => {
      const state = makeState({ snake, direction: dir, food: { x: 0, y: 0 } });
      const { state: next, events } = tick(state, config, rng());
      expect(events).toEqual([]);
      expect(next.status).toBe('RUNNING');
      expect(next.snake[0]).toEqual(head);
    });
  });

  it('wins when the final food fills the grid (spawnFood returns null)', () => {
    const config = makeConfig(makeGrid(3, 2)); // 6 cells
    // 5-cell snake; head (1,1) moves RIGHT onto food (2,1), filling the board.
    const state = makeState({
      snake: [
        { x: 1, y: 1 },
        { x: 0, y: 1 },
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ],
      direction: 'RIGHT',
      food: { x: 2, y: 1 },
    });
    const { state: next, events } = tick(state, config, rng());
    expect(next.status).toBe('WON');
    expect(events).toContain('WON');
    expect(events).toContain('ATE_FOOD');
    expect(next.snake).toHaveLength(6);
    expect(next.food).toBeNull();
  });

  it('never lets tickMs drop below minTickMs after many foods', () => {
    const config = makeConfig(makeGrid(20, 20));
    const state = makeState({
      snake: [
        { x: 3, y: 3 },
        { x: 2, y: 3 },
        { x: 1, y: 3 },
      ],
      food: { x: 4, y: 3 },
      foodEaten: 100, // already well past the floor
    });
    const { state: next } = tick(state, config, rng());
    expect(next.foodEaten).toBe(101);
    expect(next.tickMs).toBe(config.minTickMs); // clamped, not 200 - 404
  });

  it('does nothing meaningful when not RUNNING', () => {
    const config = makeConfig(makeGrid(8, 8));
    const state = makeState({
      snake: [
        { x: 3, y: 3 },
        { x: 2, y: 3 },
      ],
      status: 'PAUSED',
      food: { x: 4, y: 3 },
    });
    const { state: next, events } = tick(state, config, rng());
    expect(events).toEqual([]);
    expect(next.snake).toEqual(state.snake);
    expect(next.status).toBe('PAUSED');
  });

  it('never mutates the input GameState', () => {
    const config = makeConfig(makeGrid(8, 8));
    const snake = [
      { x: 3, y: 3 },
      { x: 2, y: 3 },
      { x: 1, y: 3 },
    ];
    const state = makeState({
      snake,
      direction: 'RIGHT',
      inputQueue: ['UP'],
      food: { x: 4, y: 3 },
    });
    const snapshot = JSON.parse(JSON.stringify(state));
    tick(state, config, rng());
    expect(state).toEqual(snapshot);
    expect(state.snake).toBe(snake); // same array reference, untouched
  });
});
