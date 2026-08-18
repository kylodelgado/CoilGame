import { MIN_REVIVE_LENGTH, revive } from '../src/engine/revive';
import type {
  Cell,
  GameConfig,
  GameState,
  WallBehavior,
} from '../src/engine/types';

const makeConfig = (
  columns = 10,
  rows = 10,
  wall: WallBehavior = 'SOLID',
): GameConfig => ({
  grid: { columns, rows, cellSize: 10, originX: 0, originY: 0 },
  wallBehavior: wall,
  baseTickMs: 120,
  minTickMs: 60,
  accelMsPerFood: 2,
  pointsPerFood: 10,
  startLength: 3,
  startDirection: 'RIGHT',
  bonus: { enabled: false, spawnEveryTicks: 50, lifetimeTicks: 30, points: 50 },
});

const makeState = (over: Partial<GameState>): GameState => ({
  status: 'LOST',
  snake: [],
  direction: 'RIGHT',
  inputQueue: [],
  food: null,
  score: 0,
  foodEaten: 0,
  tickMs: 120,
  bonusFood: null,
  bonusRemaining: 0,
  ticksUntilBonus: Number.POSITIVE_INFINITY,
  obstacles: [],
  ...over,
});

/** A horizontal snake with the head at (headX, y), body trailing left. */
const rowSnake = (headX: number, y: number, length: number): Cell[] => {
  const snake: Cell[] = [];
  for (let i = 0; i < length; i++) {
    snake.push({ x: headX - i, y });
  }
  return snake;
};

const cellSet = (cells: readonly Cell[]): Set<string> =>
  new Set(cells.map((c) => `${c.x},${c.y}`));

describe('revive — status gating', () => {
  it.each(['TAP_TO_START', 'COUNTDOWN', 'RUNNING', 'PAUSED', 'WON'] as const)(
    'returns the %s state unchanged (same reference)',
    (status) => {
      const state = makeState({ status, snake: rowSnake(5, 5, 6) });
      expect(revive(state, makeConfig())).toBe(state);
    },
  );

  it('returns an empty-snake LOST state unchanged', () => {
    const state = makeState({ snake: [] });
    expect(revive(state, makeConfig())).toBe(state);
  });
});

describe('revive — truncation (keep the head end)', () => {
  it.each([
    [10, 5],
    [8, 4],
    [7, 3],
    [6, 3],
    [5, 3],
    [4, 3],
    [3, 3],
    [2, 2], // shorter than the minimum: keep what exists
  ])('a %i-cell snake revives with %i cells', (length, expected) => {
    const state = makeState({ snake: rowSnake(9, 5, length) });
    const revived = revive(state, makeConfig());
    expect(revived.snake).toHaveLength(expected);
    expect(MIN_REVIVE_LENGTH).toBe(3);
  });

  it('keeps the HEAD end: the revived body is the front of the old snake', () => {
    const state = makeState({ snake: rowSnake(9, 5, 10) });
    const revived = revive(state, makeConfig());
    expect(revived.snake).toEqual(rowSnake(9, 5, 5));
    expect(revived.snake[0]).toEqual({ x: 9, y: 5 });
  });

  it('a mid-grid death with open space ahead keeps position AND direction', () => {
    const state = makeState({ snake: rowSnake(5, 5, 6), direction: 'RIGHT' });
    const revived = revive(state, makeConfig());
    expect(revived.snake[0]).toEqual({ x: 5, y: 5 });
    expect(revived.direction).toBe('RIGHT');
    expect(revived.status).toBe('TAP_TO_START');
  });
});

describe('revive — wall death (SOLID)', () => {
  it('head at the right wall: stays in place, turned to the first safe heading', () => {
    // Died driving RIGHT into the wall at x=9. RIGHT is out of bounds; the
    // fixed order tries UP next, which has two free cells.
    const state = makeState({ snake: rowSnake(9, 5, 4), direction: 'RIGHT' });
    const revived = revive(state, makeConfig());
    expect(revived.snake).toEqual(rowSnake(9, 5, 3));
    expect(revived.direction).toBe('UP');
    expect(revived.status).toBe('TAP_TO_START');
  });

  it('cornered head with an obstacle sealing the last exit: relocates deterministically', () => {
    // Head died at (0,0) going UP; body hangs below; obstacle at (1,0) seals
    // RIGHT. No heading works in place (and no body lay fits at r<=0), so the
    // ring search relocates the snake: first success is head (1,1) facing
    // RIGHT with the body re-laid through (0,1),(0,0).
    const state = makeState({
      snake: [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: 2 },
        { x: 0, y: 3 },
      ],
      direction: 'UP',
      obstacles: [{ x: 1, y: 0 }],
    });
    const revived = revive(state, makeConfig());
    expect(revived.snake).toEqual([
      { x: 1, y: 1 },
      { x: 0, y: 1 },
      { x: 0, y: 0 },
    ]);
    expect(revived.direction).toBe('RIGHT');
    expect(revived.status).toBe('TAP_TO_START');
  });
});

describe('revive — self-collision death', () => {
  it('truncation itself frees a head boxed in by its own body', () => {
    // The head at (5,5) is surrounded by its own ring of body cells; after
    // truncation to 4 the ring is gone and RIGHT is open again.
    const state = makeState({
      snake: [
        { x: 5, y: 5 },
        { x: 5, y: 4 },
        { x: 4, y: 4 },
        { x: 4, y: 5 },
        { x: 4, y: 6 },
        { x: 5, y: 6 },
        { x: 6, y: 6 },
        { x: 6, y: 5 },
        { x: 6, y: 4 },
      ],
      direction: 'UP',
    });
    const revived = revive(state, makeConfig());
    expect(revived.snake).toEqual([
      { x: 5, y: 5 },
      { x: 5, y: 4 },
      { x: 4, y: 4 },
      { x: 4, y: 5 },
    ]);
    // Preferred UP is blocked by the kept body cell (5,4); RIGHT is the first
    // safe heading in the fixed order.
    expect(revived.direction).toBe('RIGHT');
  });
});

describe('revive — obstacle safety', () => {
  it('the revived snake and its two forward cells never touch obstacles', () => {
    const obstacles: Cell[] = [];
    // A dense obstacle field with a pocket around (7..9, 7..9).
    for (let x = 0; x < 10; x++) {
      for (let y = 0; y < 10; y++) {
        if (x >= 7 && y >= 7) {
          continue;
        }
        if ((x + y) % 2 === 0) {
          obstacles.push({ x, y });
        }
      }
    }
    const state = makeState({
      snake: rowSnake(8, 5, 8),
      direction: 'RIGHT',
      obstacles,
    });
    const revived = revive(state, makeConfig());
    const obstacleKeys = cellSet(obstacles);
    for (const cell of revived.snake) {
      expect(obstacleKeys.has(`${cell.x},${cell.y}`)).toBe(false);
    }
    expect(revived.status).toBe('TAP_TO_START');
    expect(revived.obstacles).toEqual(obstacles); // obstacles preserved
  });
});

describe('revive — food handling', () => {
  it('food not under the revived snake is untouched', () => {
    const state = makeState({
      snake: rowSnake(5, 5, 6),
      food: { x: 2, y: 2 },
    });
    const revived = revive(state, makeConfig());
    expect(revived.food).toEqual({ x: 2, y: 2 });
  });

  it('food under the relocated snake moves to the nearest free cell (deterministic)', () => {
    // Same cornered scenario as the wall-death relocation: the snake re-lays
    // onto (1,1),(0,1),(0,0). Food at (1,1) is now covered; the nearest free
    // cell scanning ring order from (1,1) — skipping snake (0,0) and the
    // obstacle (1,0) — is (2,0).
    const state = makeState({
      snake: [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: 2 },
        { x: 0, y: 3 },
      ],
      direction: 'UP',
      obstacles: [{ x: 1, y: 0 }],
      food: { x: 1, y: 1 },
    });
    const revived = revive(state, makeConfig());
    expect(revived.snake[0]).toEqual({ x: 1, y: 1 });
    expect(revived.food).toEqual({ x: 2, y: 0 });
  });

  it('null food stays null (no respawn)', () => {
    const state = makeState({ snake: rowSnake(5, 5, 6), food: null });
    expect(revive(state, makeConfig()).food).toBeNull();
  });
});

describe('revive — no safe cell anywhere', () => {
  it('returns the state unchanged on a grid with no room (caller: unavailable)', () => {
    // A 3x1 corridor entirely filled by the snake: no heading anywhere has two
    // free forward cells plus room for a 3-cell body.
    const config = makeConfig(3, 1, 'SOLID');
    const state = makeState({
      snake: [
        { x: 2, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 0 },
      ],
      direction: 'RIGHT',
    });
    expect(revive(state, config)).toBe(state);
  });

  it('never throws even on a fully obstacled grid', () => {
    const obstacles: Cell[] = [];
    for (let x = 0; x < 4; x++) {
      for (let y = 0; y < 4; y++) {
        obstacles.push({ x, y });
      }
    }
    const config = makeConfig(4, 4, 'SOLID');
    const state = makeState({
      snake: rowSnake(2, 1, 3),
      obstacles,
    });
    expect(revive(state, config)).toBe(state);
  });
});

describe('revive — PORTAL walls', () => {
  it('forward cells wrap through the portal edge, so an edge head can stay put', () => {
    const config = makeConfig(10, 10, 'PORTAL');
    // Head at the right edge heading RIGHT (a PORTAL death is body/obstacle,
    // but position-wise the forward cells wrap to x=0,1 and are free).
    const state = makeState({ snake: rowSnake(9, 5, 6), direction: 'RIGHT' });
    const revived = revive(state, config);
    expect(revived.snake[0]).toEqual({ x: 9, y: 5 });
    expect(revived.direction).toBe('RIGHT');
  });
});

describe('revive — invariants', () => {
  const scenario = (): { state: GameState; config: GameConfig } => ({
    state: makeState({
      snake: [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: 2 },
        { x: 0, y: 3 },
      ],
      direction: 'UP',
      obstacles: [{ x: 1, y: 0 }],
      food: { x: 1, y: 1 },
      inputQueue: ['LEFT', 'DOWN'],
      score: 470,
      foodEaten: 21,
      tickMs: 84,
      bonusFood: { x: 8, y: 8 },
      bonusRemaining: 12,
      ticksUntilBonus: 0,
    }),
    config: makeConfig(),
  });

  it('preserves score, foodEaten, tickMs, and the bonus slot; clears the queue', () => {
    const { state, config } = scenario();
    const revived = revive(state, config);
    expect(revived.status).toBe('TAP_TO_START');
    expect(revived.inputQueue).toEqual([]);
    expect(revived.score).toBe(470);
    expect(revived.foodEaten).toBe(21);
    expect(revived.tickMs).toBe(84);
    expect(revived.bonusFood).toEqual({ x: 8, y: 8 });
    expect(revived.bonusRemaining).toBe(12);
    expect(revived.ticksUntilBonus).toBe(0);
  });

  it('is deterministic: identical inputs give identical outputs', () => {
    const a = revive(scenario().state, scenario().config);
    const b = revive(scenario().state, scenario().config);
    expect(a).toEqual(b);
  });

  it('never mutates the input state', () => {
    const { state, config } = scenario();
    const snapshot = JSON.parse(JSON.stringify(state)) as GameState;
    revive(state, config);
    expect(state).toEqual(snapshot);
  });

  it('the revived snake is self-consistent: no duplicate cells, all in bounds', () => {
    const { state, config } = scenario();
    const revived = revive(state, config);
    const keys = revived.snake.map((c) => `${c.x},${c.y}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const cell of revived.snake) {
      expect(cell.x).toBeGreaterThanOrEqual(0);
      expect(cell.x).toBeLessThan(config.grid.columns);
      expect(cell.y).toBeGreaterThanOrEqual(0);
      expect(cell.y).toBeLessThan(config.grid.rows);
    }
    // Adjacent segments are actually adjacent (Manhattan distance 1, or a
    // portal wrap — not applicable on this SOLID board).
    for (let i = 1; i < revived.snake.length; i++) {
      const d =
        Math.abs(revived.snake[i].x - revived.snake[i - 1].x) +
        Math.abs(revived.snake[i].y - revived.snake[i - 1].y);
      expect(d).toBe(1);
    }
  });
});
