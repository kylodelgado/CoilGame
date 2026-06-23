import { createGpsMode, gpsMode } from '../src/modes/gpsMode';
import { MODES } from '../src/modes';
import { PRESETS } from '../src/engine';
import { createSeededRandom } from '../src/services/RandomPort';
import type { Cell, GameState, GridSpec } from '../src/engine/types';

const VIEWPORT: GridSpec = {
  columns: 12,
  rows: 12,
  cellSize: 14,
  originX: 0,
  originY: 0,
};

const sameCell = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y;
const key = (c: Cell) => `${c.x},${c.y}`;

describe('gpsMode (step 50)', () => {
  it('has id GPS and is registered in MODES', () => {
    expect(gpsMode.id).toBe('GPS');
    expect(MODES.GPS).toBe(gpsMode);
  });

  it('buildConfig produces a world larger than the viewport, with bonus enabled', () => {
    const config = gpsMode.buildConfig(VIEWPORT, 'SOLID', PRESETS.STANDARD);
    expect(config.world).toBeDefined();
    expect(config.world!.worldColumns).toBeGreaterThan(VIEWPORT.columns);
    expect(config.world!.worldRows).toBeGreaterThan(VIEWPORT.rows);
    // The on-screen grid stays the viewport; the world cell size matches it.
    expect(config.grid).toEqual(VIEWPORT);
    expect(config.world!.cellSize).toBe(VIEWPORT.cellSize);
    expect(config.bonus.enabled).toBe(true);
  });

  it('createInitialState centers the snake in the world, food in world bounds', () => {
    const mode = createGpsMode();
    const config = mode.buildConfig(VIEWPORT, 'SOLID', PRESETS.STANDARD);
    const state = mode.createInitialState(config, createSeededRandom(1));
    const world = config.world!;

    expect(state.snake[0]).toEqual({
      x: Math.floor(world.worldColumns / 2),
      y: Math.floor(world.worldRows / 2),
    });
    expect(state.obstacles).toEqual([]);
    expect(state.food).not.toBeNull();
    const f = state.food as Cell;
    expect(f.x).toBeGreaterThanOrEqual(0);
    expect(f.x).toBeLessThan(world.worldColumns);
    expect(f.y).toBeGreaterThanOrEqual(0);
    expect(f.y).toBeLessThan(world.worldRows);
  });

  it('createInitialState/tick are deterministic for a fixed seed', () => {
    const runOnce = () => {
      const mode = createGpsMode();
      const config = mode.buildConfig(VIEWPORT, 'PORTAL', PRESETS.STANDARD);
      let state: GameState = {
        ...mode.createInitialState(config, createSeededRandom(5)),
        status: 'RUNNING',
      };
      const rng = createSeededRandom(2024);
      const frames: string[] = [];
      for (let i = 0; i < 25 && state.status === 'RUNNING'; i++) {
        state = mode.tick(state, config, rng).state;
        frames.push(
          `${state.snake.map(key).join('|')}#${state.obstacles.map(key).join('|')}`,
        );
      }
      return frames;
    };
    expect(runOnce()).toEqual(runOnce());
  });

  it('evolves obstacles over time within world bounds, never on the snake/food (fair-spawn)', () => {
    const mode = createGpsMode();
    const config = mode.buildConfig(VIEWPORT, 'PORTAL', PRESETS.STANDARD);
    const world = config.world!;
    let state: GameState = {
      ...mode.createInitialState(config, createSeededRandom(3)),
      status: 'RUNNING',
    };
    const rng = createSeededRandom(99);

    let sawObstacle = false;
    for (let i = 0; i < 80 && state.status === 'RUNNING'; i++) {
      state = mode.tick(state, config, rng).state;
      for (const o of state.obstacles) {
        sawObstacle = true;
        // Within world bounds.
        expect(o.x).toBeGreaterThanOrEqual(0);
        expect(o.x).toBeLessThan(world.worldColumns);
        expect(o.y).toBeGreaterThanOrEqual(0);
        expect(o.y).toBeLessThan(world.worldRows);
        // Never on the snake or food.
        expect(state.snake.some((c) => sameCell(c, o))).toBe(false);
        if (state.food) expect(sameCell(o, state.food)).toBe(false);
      }
    }
    expect(sawObstacle).toBe(true); // obstacles did appear on schedule
  });

  it('steps the snake forward over the world (delegates to the engine)', () => {
    const mode = createGpsMode();
    const config = mode.buildConfig(VIEWPORT, 'PORTAL', PRESETS.STANDARD);
    const cx = Math.floor(config.world!.worldColumns / 2);
    const cy = Math.floor(config.world!.worldRows / 2);
    const state: GameState = {
      ...mode.createInitialState(config, createSeededRandom(1)),
      status: 'RUNNING',
      direction: 'RIGHT',
      food: null,
    };
    const { state: next } = mode.tick(state, config, createSeededRandom(1));
    expect(next.snake[0]).toEqual({ x: cx + 1, y: cy });
  });
});
