import { createInitialState } from '../src/engine/createInitialState';
import { createSeededRandom } from '../src/services/RandomPort';
import type { Cell, GameConfig, GridSpec } from '../src/engine/types';

function makeGrid(columns: number, rows: number): GridSpec {
  return { columns, rows, cellSize: 10, originX: 0, originY: 0 };
}

function makeConfig(grid: GridSpec): GameConfig {
  return {
    grid,
    wallBehavior: 'SOLID',
    baseTickMs: 200,
    minTickMs: 90,
    accelMsPerFood: 4,
    pointsPerFood: 10,
    startLength: 3,
    startDirection: 'RIGHT',
  };
}

const key = (c: Cell) => `${c.x},${c.y}`;

describe('createInitialState (FR-D4, FR-F1/2)', () => {
  const grid = makeGrid(16, 20);
  const config = makeConfig(grid);

  it('places a snake of startLength with all cells in bounds', () => {
    const state = createInitialState(config, createSeededRandom(1));
    expect(state.snake).toHaveLength(config.startLength);
    for (const c of state.snake) {
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.x).toBeLessThan(grid.columns);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeLessThan(grid.rows);
    }
  });

  it('has the head as the rightmost of three contiguous horizontal cells', () => {
    const state = createInitialState(config, createSeededRandom(1));
    const [head, mid, tail] = state.snake;
    // Same row.
    expect(head.y).toBe(mid.y);
    expect(mid.y).toBe(tail.y);
    // Contiguous, decreasing x away from the head (head is rightmost).
    expect(head.x).toBe(mid.x + 1);
    expect(mid.x).toBe(tail.x + 1);
    expect(head.x).toBeGreaterThan(mid.x);
    expect(mid.x).toBeGreaterThan(tail.x);
  });

  it('centers the snake head near grid center', () => {
    const state = createInitialState(config, createSeededRandom(1));
    const head = state.snake[0];
    expect(head.x).toBe(Math.floor(grid.columns / 2));
    expect(head.y).toBe(Math.floor(grid.rows / 2));
  });

  it('initializes direction, queue, score, foodEaten and tickMs', () => {
    const state = createInitialState(config, createSeededRandom(1));
    expect(state.direction).toBe('RIGHT');
    expect(state.inputQueue).toEqual([]);
    expect(state.score).toBe(0);
    expect(state.foodEaten).toBe(0);
    expect(state.tickMs).toBe(config.baseTickMs);
  });

  it('spawns non-null food that is not on the snake', () => {
    const occupiedFreeSeeds = [1, 2, 3, 42, 777];
    for (const seed of occupiedFreeSeeds) {
      const state = createInitialState(config, createSeededRandom(seed));
      expect(state.food).not.toBeNull();
      const occupied = new Set(state.snake.map(key));
      expect(occupied.has(key(state.food as Cell))).toBe(false);
    }
  });

  it('starts in TAP_TO_START', () => {
    const state = createInitialState(config, createSeededRandom(1));
    expect(state.status).toBe('TAP_TO_START');
  });
});
