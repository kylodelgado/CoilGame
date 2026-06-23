import { tick } from '../src/engine/tick';
import { spawnFood, spawnBonus } from '../src/engine/food';
import { createSeededRandom } from '../src/services/RandomPort';
import type {
  Cell,
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
  bonus: Partial<GameConfig['bonus']> = {},
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
    bonus: {
      enabled: false,
      spawnEveryTicks: 60,
      lifetimeTicks: 25,
      points: 50,
      ...bonus,
    },
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
    ticksUntilBonus: Number.MAX_SAFE_INTEGER,
    obstacles: [],
    ...over,
  };
}

const rng = () => createSeededRandom(7);
const sameCell = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y;
const onAny = (c: Cell, cells: Cell[]) => cells.some((o) => sameCell(o, c));

describe('engine obstacles (step 38)', () => {
  describe('empty obstacles => classic behavior is byte-identical', () => {
    it('a scripted run is unchanged and obstacles stays empty', () => {
      const config = makeConfig(makeGrid(10, 10));
      let state = makeState({
        snake: [
          { x: 3, y: 5 },
          { x: 2, y: 5 },
          { x: 1, y: 5 },
        ],
        food: { x: 4, y: 5 }, // eaten on the first tick
      });

      for (let i = 0; i < 8; i++) {
        const { state: next } = tick(state, config, rng());
        expect(next.obstacles).toEqual([]);
        state = next;
      }
      expect(state.foodEaten).toBe(1);
      expect(state.score).toBe(10);
      expect(state.snake).toHaveLength(4);
    });
  });

  describe('collision with an obstacle kills', () => {
    it('SOLID: head entering an obstacle => DIED / LOST', () => {
      const config = makeConfig(makeGrid(6, 6), 'SOLID');
      const state = makeState({
        snake: [
          { x: 3, y: 3 },
          { x: 2, y: 3 },
          { x: 1, y: 3 },
        ],
        direction: 'RIGHT',
        obstacles: [{ x: 4, y: 3 }],
      });

      const { state: next, events } = tick(state, config, rng());
      expect(events).toContain('DIED');
      expect(next.status).toBe('LOST');
    });

    it('PORTAL: head entering an obstacle => DIED / LOST', () => {
      const config = makeConfig(makeGrid(6, 6), 'PORTAL');
      const state = makeState({
        snake: [
          { x: 3, y: 3 },
          { x: 2, y: 3 },
          { x: 1, y: 3 },
        ],
        direction: 'RIGHT',
        obstacles: [{ x: 4, y: 3 }],
      });

      const { state: next, events } = tick(state, config, rng());
      expect(events).toContain('DIED');
      expect(next.status).toBe('LOST');
    });

    it('PORTAL: wrapping into an obstacle on the far edge => LOST', () => {
      const config = makeConfig(makeGrid(5, 5), 'PORTAL');
      const state = makeState({
        snake: [
          { x: 4, y: 2 },
          { x: 3, y: 2 },
          { x: 2, y: 2 },
        ],
        direction: 'RIGHT', // wraps x:4 -> x:0
        obstacles: [{ x: 0, y: 2 }],
      });

      const { state: next, events } = tick(state, config, rng());
      expect(events).toContain('DIED');
      expect(next.status).toBe('LOST');
    });
  });

  describe('spawns avoid obstacles', () => {
    it('food and bonus never land on an obstacle (many seeds)', () => {
      const grid = makeGrid(5, 5);
      const config = makeConfig(grid, 'SOLID', { enabled: true });
      const obstacles: Cell[] = [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
        { x: 4, y: 0 },
        { x: 0, y: 1 },
        { x: 4, y: 1 },
      ];
      const state = makeState({
        snake: [
          { x: 2, y: 2 },
          { x: 1, y: 2 },
        ],
        food: { x: 3, y: 3 },
        obstacles,
      });

      for (let seed = 0; seed < 100; seed++) {
        const food = spawnFood(state, config, createSeededRandom(seed));
        const bonus = spawnBonus(state, config, createSeededRandom(seed));
        if (food) {
          expect(onAny(food, obstacles)).toBe(false);
          expect(onAny(food, state.snake)).toBe(false);
        }
        if (bonus) {
          expect(onAny(bonus, obstacles)).toBe(false);
          expect(onAny(bonus, state.snake)).toBe(false);
          // Bonus also never lands on the regular food.
          expect(sameCell(bonus, state.food!)).toBe(false);
        }
      }
    });
  });

  describe('win condition accounts for obstacles', () => {
    it('reaches WON when only obstacle cells remain after eating the last food', () => {
      // 3-cell corridor: one obstacle, snake of 1, food on the last free cell.
      const config = makeConfig(makeGrid(3, 1), 'SOLID');
      const state = makeState({
        snake: [{ x: 1, y: 0 }],
        direction: 'RIGHT',
        food: { x: 2, y: 0 },
        obstacles: [{ x: 0, y: 0 }],
      });

      const { state: next, events } = tick(state, config, rng());
      expect(events).toContain('ATE_FOOD');
      expect(events).toContain('WON');
      expect(next.status).toBe('WON');
      // spawnFood returned null: snake (2) + obstacle (1) fills the 3-cell grid.
      expect(spawnFood(next, config, rng())).toBeNull();
    });
  });

  describe('purity', () => {
    it('never mutates the input state (obstacles array included)', () => {
      const config = makeConfig(makeGrid(8, 8));
      const obstacles = [
        { x: 5, y: 5 },
        { x: 6, y: 6 },
      ];
      const state = makeState({
        snake: [
          { x: 3, y: 3 },
          { x: 2, y: 3 },
          { x: 1, y: 3 },
        ],
        food: { x: 4, y: 3 },
        obstacles,
      });
      const snapshot = JSON.parse(JSON.stringify(state)) as GameState;

      tick(state, config, rng());

      expect(state).toEqual(snapshot);
      expect(state.obstacles).toBe(obstacles); // same reference, untouched
    });
  });
});
