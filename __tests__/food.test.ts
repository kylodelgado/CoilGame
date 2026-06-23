import { spawnFood } from '../src/engine/food';
import { createSeededRandom } from '../src/services/RandomPort';
import type { Cell, GameConfig, GameState, GridSpec } from '../src/engine/types';

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
    bonus: { enabled: false, spawnEveryTicks: 60, lifetimeTicks: 25, points: 50 },
  };
}

function makeState(snake: Cell[]): GameState {
  return {
    status: 'RUNNING',
    snake,
    direction: 'RIGHT',
    inputQueue: [],
    food: null,
    score: 0,
    foodEaten: 0,
    tickMs: 200,
    bonusFood: null,
    bonusRemaining: 0,
    ticksUntilBonus: Infinity,
  };
}

const key = (c: Cell) => `${c.x},${c.y}`;

describe('spawnFood (FR-F2, EH-8)', () => {
  it('never places food on a snake cell across many seeds and layouts', () => {
    const grid = makeGrid(8, 8);
    const config = makeConfig(grid);
    const layouts: Cell[][] = [
      [
        { x: 3, y: 3 },
        { x: 2, y: 3 },
        { x: 1, y: 3 },
      ],
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
        { x: 4, y: 0 },
      ],
      [
        { x: 7, y: 7 },
        { x: 7, y: 6 },
        { x: 7, y: 5 },
      ],
    ];
    for (const snake of layouts) {
      const occupied = new Set(snake.map(key));
      const state = makeState(snake);
      for (let seed = 0; seed < 200; seed++) {
        const food = spawnFood(state, config, createSeededRandom(seed));
        expect(food).not.toBeNull();
        expect(occupied.has(key(food as Cell))).toBe(false);
      }
    }
  });

  it('always returns a cell within grid bounds', () => {
    const grid = makeGrid(12, 9);
    const config = makeConfig(grid);
    const state = makeState([
      { x: 5, y: 4 },
      { x: 4, y: 4 },
      { x: 3, y: 4 },
    ]);
    for (let seed = 0; seed < 300; seed++) {
      const food = spawnFood(state, config, createSeededRandom(seed)) as Cell;
      expect(food.x).toBeGreaterThanOrEqual(0);
      expect(food.x).toBeLessThan(grid.columns);
      expect(food.y).toBeGreaterThanOrEqual(0);
      expect(food.y).toBeLessThan(grid.rows);
    }
  });

  it('returns the single remaining empty cell when only one is free', () => {
    const grid = makeGrid(2, 2);
    const config = makeConfig(grid);
    // Fill 3 of 4 cells; leave (1,1) empty.
    const snake: Cell[] = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ];
    const state = makeState(snake);
    for (let seed = 0; seed < 20; seed++) {
      const food = spawnFood(state, config, createSeededRandom(seed));
      expect(food).toEqual({ x: 1, y: 1 });
    }
  });

  it('returns null when the snake covers every cell (win signal)', () => {
    const grid = makeGrid(3, 2);
    const config = makeConfig(grid);
    const snake: Cell[] = [];
    for (let y = 0; y < grid.rows; y++) {
      for (let x = 0; x < grid.columns; x++) {
        snake.push({ x, y });
      }
    }
    const state = makeState(snake);
    expect(spawnFood(state, config, createSeededRandom(1))).toBeNull();
  });

  it('is deterministic for the same seed and state', () => {
    const grid = makeGrid(10, 10);
    const config = makeConfig(grid);
    const state = makeState([
      { x: 1, y: 1 },
      { x: 1, y: 2 },
    ]);
    const a = spawnFood(state, config, createSeededRandom(777));
    const b = spawnFood(state, config, createSeededRandom(777));
    expect(a).toEqual(b);
  });
});
