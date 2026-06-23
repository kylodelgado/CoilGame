import {
  createWorldInitialState,
  worldTick,
  worldGrid,
} from '../src/engine/world';
import { createInitialState } from '../src/engine/createInitialState';
import { createSeededRandom } from '../src/services/RandomPort';
import type {
  Cell,
  GameConfig,
  GridSpec,
  WallBehavior,
  WorldSpec,
} from '../src/engine/types';

const WORLD: WorldSpec = { worldColumns: 40, worldRows: 40, cellSize: 10 };
// A viewport much smaller than the world — the engine must use the WORLD bounds.
const VIEWPORT: GridSpec = {
  columns: 12,
  rows: 12,
  cellSize: 10,
  originX: 0,
  originY: 0,
};

function makeConfig(
  over: Partial<GameConfig> = {},
  wallBehavior: WallBehavior = 'SOLID',
): GameConfig {
  return {
    grid: VIEWPORT,
    world: WORLD,
    wallBehavior,
    baseTickMs: 200,
    minTickMs: 90,
    accelMsPerFood: 4,
    pointsPerFood: 10,
    startLength: 3,
    startDirection: 'RIGHT',
    bonus: { enabled: false, spawnEveryTicks: 60, lifetimeTicks: 25, points: 50 },
    ...over,
  };
}

const inWorld = (c: Cell) =>
  c.x >= 0 && c.x < WORLD.worldColumns && c.y >= 0 && c.y < WORLD.worldRows;
const sameCell = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y;

describe('world model (step 47)', () => {
  describe('worldGrid', () => {
    it('spans the whole world from the WorldSpec', () => {
      expect(worldGrid(WORLD)).toEqual({
        columns: 40,
        rows: 40,
        cellSize: 10,
        originX: 0,
        originY: 0,
      });
    });
  });

  describe('createWorldInitialState', () => {
    it('places a valid snake near world center, in world bounds', () => {
      const state = createWorldInitialState(makeConfig(), createSeededRandom(1));
      expect(state.snake).toHaveLength(3);
      for (const c of state.snake) {
        expect(inWorld(c)).toBe(true);
      }
      // Head near the world center (rightmost of the horizontal start snake).
      const head = state.snake[0];
      expect(head.x).toBe(Math.floor(WORLD.worldColumns / 2));
      expect(head.y).toBe(Math.floor(WORLD.worldRows / 2));
    });

    it('spawns food somewhere in the world, never on the snake (many seeds)', () => {
      for (let seed = 0; seed < 80; seed++) {
        const state = createWorldInitialState(
          makeConfig(),
          createSeededRandom(seed),
        );
        expect(state.food).not.toBeNull();
        expect(inWorld(state.food as Cell)).toBe(true);
        expect(state.snake.some((c) => sameCell(c, state.food as Cell))).toBe(
          false,
        );
      }
    });

    it('can place food far from the snake (off the would-be viewport)', () => {
      // Across many seeds at least one food lands well outside a 12x12 window
      // centered on the head — proving food may be off-screen.
      let sawFar = false;
      for (let seed = 0; seed < 80 && !sawFar; seed++) {
        const state = createWorldInitialState(
          makeConfig(),
          createSeededRandom(seed),
        );
        const head = state.snake[0];
        const food = state.food as Cell;
        if (Math.abs(food.x - head.x) > 6 || Math.abs(food.y - head.y) > 6) {
          sawFar = true;
        }
      }
      expect(sawFar).toBe(true);
    });

    it('falls back to config.grid when no world is set (fixed-board parity)', () => {
      const fixed = makeConfig({ world: undefined });
      const viaWorld = createWorldInitialState(fixed, createSeededRandom(3));
      const viaEngine = createInitialState(fixed, createSeededRandom(3));
      expect(viaWorld).toEqual(viaEngine);
    });
  });

  describe('worldTick: same rules as the fixed engine', () => {
    it('advances, eats, and grows over the world', () => {
      const config = makeConfig();
      const cx = Math.floor(WORLD.worldColumns / 2);
      const cy = Math.floor(WORLD.worldRows / 2);
      const state = {
        ...createWorldInitialState(config, createSeededRandom(1)),
        status: 'RUNNING' as const,
        direction: 'RIGHT' as const,
        food: { x: cx + 1, y: cy }, // directly ahead of the head
      };

      const { state: next, events } = worldTick(
        state,
        config,
        createSeededRandom(1),
      );
      expect(events).toContain('ATE_FOOD');
      expect(next.snake).toHaveLength(4);
      expect(next.snake[0]).toEqual({ x: cx + 1, y: cy });
      expect(next.score).toBe(10);
      expect(inWorld(next.food as Cell)).toBe(true);
    });

    it('respawned food never lands on an obstacle (world spawn exclusion)', () => {
      const config = makeConfig();
      const cx = Math.floor(WORLD.worldColumns / 2);
      const cy = Math.floor(WORLD.worldRows / 2);
      const obstacles: Cell[] = [
        { x: cx + 2, y: cy },
        { x: cx + 3, y: cy },
        { x: cx, y: cy + 1 },
      ];
      const state = {
        ...createWorldInitialState(config, createSeededRandom(1)),
        status: 'RUNNING' as const,
        direction: 'RIGHT' as const,
        food: { x: cx + 1, y: cy },
        obstacles,
      };
      for (let seed = 0; seed < 50; seed++) {
        const { state: next } = worldTick(state, config, createSeededRandom(seed));
        if (next.food) {
          expect(obstacles.some((o) => sameCell(o, next.food as Cell))).toBe(
            false,
          );
        }
      }
    });
  });

  describe('world wall behavior', () => {
    it('SOLID: the snake dies at the world edge', () => {
      const config = makeConfig({}, 'SOLID');
      const edge = WORLD.worldColumns - 1;
      const state = {
        ...createWorldInitialState(config, createSeededRandom(1)),
        status: 'RUNNING' as const,
        direction: 'RIGHT' as const,
        food: null,
        snake: [
          { x: edge, y: 5 },
          { x: edge - 1, y: 5 },
          { x: edge - 2, y: 5 },
        ],
      };
      const { state: next, events } = worldTick(
        state,
        config,
        createSeededRandom(1),
      );
      expect(events).toContain('DIED');
      expect(next.status).toBe('LOST');
    });

    it('PORTAL: the snake wraps around the world edge', () => {
      const config = makeConfig({}, 'PORTAL');
      const edge = WORLD.worldColumns - 1;
      const state = {
        ...createWorldInitialState(config, createSeededRandom(1)),
        status: 'RUNNING' as const,
        direction: 'RIGHT' as const,
        food: null,
        snake: [
          { x: edge, y: 5 },
          { x: edge - 1, y: 5 },
          { x: edge - 2, y: 5 },
        ],
      };
      const { state: next, events } = worldTick(
        state,
        config,
        createSeededRandom(1),
      );
      expect(events).not.toContain('DIED');
      expect(next.status).toBe('RUNNING');
      expect(next.snake[0]).toEqual({ x: 0, y: 5 }); // wrapped to the far edge
    });
  });
});
