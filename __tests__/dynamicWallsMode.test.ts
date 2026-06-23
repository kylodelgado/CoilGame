import {
  createDynamicWallsMode,
  dynamicWallsMode,
  DYNAMIC_WALLS_TUNABLES,
} from '../src/modes/dynamicWallsMode';
import { classicMode } from '../src/modes/classicMode';
import { MODES } from '../src/modes';
import {
  PRESETS,
  computeNextHead,
  resolveWall,
} from '../src/engine';
import { createSeededRandom } from '../src/services/RandomPort';
import type { Cell, GameConfig, GameState, GridSpec } from '../src/engine/types';

function makeGrid(columns: number, rows: number): GridSpec {
  return { columns, rows, cellSize: 10, originX: 0, originY: 0 };
}

const GRID = makeGrid(12, 12);

const sameCell = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y;
const onAny = (c: Cell, cells: Cell[]) => cells.some((o) => sameCell(o, c));
const key = (c: Cell) => `${c.x},${c.y}`;

/** Predict the cell the head will enter this tick (mirrors the engine). */
function headNextCell(state: GameState, config: GameConfig): Cell | null {
  const dir =
    state.inputQueue.length > 0 ? state.inputQueue[0] : state.direction;
  const raw = computeNextHead(state.snake[0], dir);
  const wall = resolveWall(raw, config.grid, config.wallBehavior);
  return wall.kind === 'OUT_OF_BOUNDS' ? null : wall.cell;
}

describe('dynamicWallsMode (step 39)', () => {
  it('has id DYNAMIC_WALLS and is registered in MODES', () => {
    expect(dynamicWallsMode.id).toBe('DYNAMIC_WALLS');
    expect(MODES.DYNAMIC_WALLS).toBe(dynamicWallsMode);
    expect(MODES.CLASSIC).toBe(classicMode);
  });

  it('buildConfig matches the classic mapping plus bonus enabled', () => {
    for (const wall of ['SOLID', 'PORTAL'] as const) {
      const a = dynamicWallsMode.buildConfig(GRID, wall, PRESETS.STANDARD);
      const b = classicMode.buildConfig(GRID, wall, PRESETS.STANDARD);
      expect(a).toEqual(b);
      expect(a.bonus.enabled).toBe(true);
    }
  });

  it('createInitialState starts with no obstacles', () => {
    const mode = createDynamicWallsMode();
    const config = mode.buildConfig(GRID, 'PORTAL', PRESETS.STANDARD);
    const state = mode.createInitialState(config, createSeededRandom(1));
    expect(state.obstacles).toEqual([]);
  });

  it('adds obstacles on the change schedule without overlapping snake/food/bonus/each other', () => {
    const mode = createDynamicWallsMode({ changeEveryTicks: 3 });
    const config = mode.buildConfig(GRID, 'PORTAL', PRESETS.STANDARD);
    let state: GameState = {
      ...mode.createInitialState(config, createSeededRandom(1)),
      status: 'RUNNING',
    };
    const rng = createSeededRandom(99);

    // Before the first scheduled change, no obstacles.
    state = mode.tick(state, config, rng).state;
    expect(state.obstacles).toHaveLength(0);
    state = mode.tick(state, config, rng).state;
    expect(state.obstacles).toHaveLength(0);
    // Third tick is on the schedule (3 % 3 === 0): an obstacle appears.
    state = mode.tick(state, config, rng).state;
    expect(state.obstacles.length).toBeGreaterThan(0);

    // No obstacle overlaps the snake, food, bonus, or another obstacle.
    const keys = new Set<string>();
    for (const o of state.obstacles) {
      expect(onAny(o, state.snake)).toBe(false);
      if (state.food) expect(sameCell(o, state.food)).toBe(false);
      if (state.bonusFood) expect(sameCell(o, state.bonusFood)).toBe(false);
      expect(keys.has(key(o))).toBe(false); // no duplicates
      keys.add(key(o));
    }
  });

  it('never places an obstacle on the head’s next cell (no instant trap)', () => {
    const mode = createDynamicWallsMode({ changeEveryTicks: 2 });
    const config = mode.buildConfig(GRID, 'PORTAL', PRESETS.STANDARD);
    let state: GameState = {
      ...mode.createInitialState(config, createSeededRandom(2)),
      status: 'RUNNING',
    };
    const rng = createSeededRandom(123);

    for (let i = 0; i < 30 && state.status === 'RUNNING'; i++) {
      const before = state.obstacles;
      const protectedCell = headNextCell(state, config);
      const next = mode.tick(state, config, rng).state;

      // Any obstacle newly added this tick must not be the cell the head entered.
      const beforeKeys = new Set(before.map(key));
      const added = next.obstacles.filter((o) => !beforeKeys.has(key(o)));
      if (protectedCell) {
        for (const o of added) {
          expect(sameCell(o, protectedCell)).toBe(false);
        }
      }
      state = next;
    }
  });

  it('never exceeds maxObstacles (oldest relocated at the cap)', () => {
    const mode = createDynamicWallsMode({
      changeEveryTicks: 1,
      maxObstacles: 3,
      obstaclesPerChange: 1,
    });
    const config = mode.buildConfig(GRID, 'PORTAL', PRESETS.STANDARD);
    let state: GameState = {
      ...mode.createInitialState(config, createSeededRandom(3)),
      status: 'RUNNING',
    };
    const rng = createSeededRandom(7);

    for (let i = 0; i < 25 && state.status === 'RUNNING'; i++) {
      state = mode.tick(state, config, rng).state;
      expect(state.obstacles.length).toBeLessThanOrEqual(3);
    }
  });

  it('produces a deterministic obstacle sequence for a fixed seed', () => {
    const run = () => {
      const mode = createDynamicWallsMode({ changeEveryTicks: 2 });
      const config = mode.buildConfig(GRID, 'PORTAL', PRESETS.STANDARD);
      let state: GameState = {
        ...mode.createInitialState(config, createSeededRandom(5)),
        status: 'RUNNING',
      };
      const rng = createSeededRandom(2024);
      const snapshots: string[] = [];
      for (let i = 0; i < 12 && state.status === 'RUNNING'; i++) {
        state = mode.tick(state, config, rng).state;
        snapshots.push(state.obstacles.map(key).join('|'));
      }
      return snapshots;
    };
    expect(run()).toEqual(run());
  });

  it('still kills on obstacle contact (delegates stepping to the engine)', () => {
    // changeEveryTicks large so this single tick schedules no change.
    const mode = createDynamicWallsMode({ changeEveryTicks: 999 });
    const config = mode.buildConfig(makeGrid(6, 6), 'SOLID', PRESETS.STANDARD);
    const state: GameState = {
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
      obstacles: [{ x: 4, y: 3 }],
      snake: [
        { x: 3, y: 3 },
        { x: 2, y: 3 },
        { x: 1, y: 3 },
      ],
    };

    const { state: next, events } = mode.tick(state, config, createSeededRandom(1));
    expect(events).toContain('DIED');
    expect(next.status).toBe('LOST');
  });
});
