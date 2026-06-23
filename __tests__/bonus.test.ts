import { tick } from '../src/engine/tick';
import { spawnBonus, BONUS_DISABLED } from '../src/engine/food';
import { createSeededRandom } from '../src/services/RandomPort';
import type {
  Cell,
  GameConfig,
  GameState,
  GridSpec,
} from '../src/engine/types';

function makeGrid(columns: number, rows: number): GridSpec {
  return { columns, rows, cellSize: 10, originX: 0, originY: 0 };
}

function makeConfig(
  grid: GridSpec,
  bonus: Partial<GameConfig['bonus']> = {},
): GameConfig {
  return {
    grid,
    wallBehavior: 'SOLID',
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
    ticksUntilBonus: BONUS_DISABLED,
    ...over,
  };
}

const rng = () => createSeededRandom(123);
const sameCell = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y;

describe('bonus food (engine extension, step 34)', () => {
  describe('disabled => classic behavior is byte-identical', () => {
    it('never spawns a bonus, emits no bonus events, and leaves bonus fields untouched', () => {
      const config = makeConfig(makeGrid(10, 10)); // bonus disabled
      // Snake near the left moving right; food placed where the head will eat it.
      let state = makeState({
        snake: [
          { x: 3, y: 5 },
          { x: 2, y: 5 },
          { x: 1, y: 5 },
        ],
        food: { x: 4, y: 5 },
        ticksUntilBonus: BONUS_DISABLED,
      });

      for (let i = 0; i < 12; i++) {
        const { state: next, events } = tick(state, config, rng());
        expect(events).not.toContain('ATE_BONUS');
        expect(events).not.toContain('BONUS_EXPIRED');
        expect(next.bonusFood).toBeNull();
        expect(next.bonusRemaining).toBe(0);
        expect(next.ticksUntilBonus).toBe(BONUS_DISABLED);
        state = next;
      }

      // Classic outcome still holds: the food was eaten and scored once.
      expect(state.foodEaten).toBe(1);
      expect(state.score).toBe(10);
      expect(state.snake).toHaveLength(4);
    });
  });

  describe('spawning', () => {
    it('spawns a bonus after exactly spawnEveryTicks, never on the snake or food', () => {
      const spawnEveryTicks = 3;
      const config = makeConfig(makeGrid(12, 12), {
        enabled: true,
        spawnEveryTicks,
        lifetimeTicks: 10,
      });
      // Open run with food far away so the snake never eats nor dies.
      let state = makeState({
        snake: [
          { x: 2, y: 6 },
          { x: 1, y: 6 },
          { x: 0, y: 6 },
        ],
        food: { x: 0, y: 0 },
        ticksUntilBonus: spawnEveryTicks,
      });

      for (let t = 1; t <= spawnEveryTicks; t++) {
        const { state: next } = tick(state, config, rng());
        if (t < spawnEveryTicks) {
          expect(next.bonusFood).toBeNull();
        } else {
          expect(next.bonusFood).not.toBeNull();
          // Never on the snake or the regular food.
          const onSnake = next.snake.some((c) => sameCell(c, next.bonusFood!));
          expect(onSnake).toBe(false);
          expect(sameCell(next.bonusFood!, next.food!)).toBe(false);
          expect(next.bonusRemaining).toBe(10);
        }
        state = next;
      }
    });
  });

  describe('expiry', () => {
    it('an uneaten bonus expires after exactly lifetimeTicks, clearing it and emitting BONUS_EXPIRED', () => {
      const lifetimeTicks = 4;
      const config = makeConfig(makeGrid(12, 12), {
        enabled: true,
        spawnEveryTicks: 60,
        lifetimeTicks,
      });
      // Start with a bonus already on the board, far from the snake's path.
      let state = makeState({
        snake: [
          { x: 2, y: 6 },
          { x: 1, y: 6 },
          { x: 0, y: 6 },
        ],
        food: { x: 0, y: 0 },
        bonusFood: { x: 8, y: 2 },
        bonusRemaining: lifetimeTicks,
        ticksUntilBonus: 60,
      });

      const expiredOn: number[] = [];
      for (let t = 1; t <= lifetimeTicks; t++) {
        const { state: next, events } = tick(state, config, rng());
        if (t < lifetimeTicks) {
          expect(next.bonusFood).not.toBeNull();
          expect(events).not.toContain('BONUS_EXPIRED');
        } else {
          expect(events).toContain('BONUS_EXPIRED');
          expect(next.bonusFood).toBeNull();
          expect(next.bonusRemaining).toBe(0);
          // Spawn countdown restarts after despawn.
          expect(next.ticksUntilBonus).toBe(60);
          expiredOn.push(t);
        }
        state = next;
      }
      expect(expiredOn).toEqual([lifetimeTicks]);
    });
  });

  describe('eating', () => {
    it('eating a bonus adds points, does NOT grow, emits ATE_BONUS, and clears it', () => {
      const config = makeConfig(makeGrid(12, 12), {
        enabled: true,
        points: 50,
        spawnEveryTicks: 60,
        lifetimeTicks: 10,
      });
      const state = makeState({
        snake: [
          { x: 5, y: 5 },
          { x: 4, y: 5 },
          { x: 3, y: 5 },
        ],
        direction: 'RIGHT',
        food: { x: 0, y: 0 }, // not in the path
        bonusFood: { x: 6, y: 5 }, // directly ahead of the head
        bonusRemaining: 5,
        ticksUntilBonus: 60,
      });

      const { state: next, events } = tick(state, config, rng());

      expect(events).toContain('ATE_BONUS');
      expect(events).not.toContain('ATE_FOOD');
      expect(next.score).toBe(50);
      expect(next.snake).toHaveLength(3); // no growth from a bonus
      expect(next.snake[0]).toEqual({ x: 6, y: 5 });
      expect(next.bonusFood).toBeNull();
      expect(next.bonusRemaining).toBe(0);
      expect(next.ticksUntilBonus).toBe(60);
    });
  });

  describe('regular food is unaffected by bonus', () => {
    it('still grows by one and scores pointsPerFood', () => {
      const config = makeConfig(makeGrid(12, 12), {
        enabled: true,
        points: 50,
        spawnEveryTicks: 60,
        lifetimeTicks: 10,
      });
      const state = makeState({
        snake: [
          { x: 5, y: 5 },
          { x: 4, y: 5 },
          { x: 3, y: 5 },
        ],
        food: { x: 6, y: 5 }, // directly ahead
        ticksUntilBonus: 60,
      });

      const { state: next, events } = tick(state, config, rng());

      expect(events).toContain('ATE_FOOD');
      expect(events).not.toContain('ATE_BONUS');
      expect(next.snake).toHaveLength(4);
      expect(next.score).toBe(10);
      expect(next.foodEaten).toBe(1);
    });
  });

  describe('near-full grid', () => {
    it('spawnBonus returns null when no empty cell exists', () => {
      // A 1x2 grid fully occupied by snake + food.
      const config = makeConfig(makeGrid(1, 2), { enabled: true });
      const state = makeState({
        snake: [{ x: 0, y: 0 }],
        food: { x: 0, y: 1 },
      });
      expect(spawnBonus(state, config, rng())).toBeNull();
    });

    it('tick skips the bonus spawn (no crash) when the grid is full', () => {
      // 3-cell corridor; the head eats the last cell and fills the grid (WON),
      // so the due bonus spawn finds no empty cell and is skipped.
      const config = makeConfig(makeGrid(3, 1), {
        enabled: true,
        spawnEveryTicks: 1,
      });
      const state = makeState({
        snake: [
          { x: 1, y: 0 },
          { x: 0, y: 0 },
        ],
        direction: 'RIGHT',
        food: { x: 2, y: 0 },
        ticksUntilBonus: 1, // spawn is due this tick
      });

      const { state: next, events } = tick(state, config, rng());

      expect(next.bonusFood).toBeNull(); // skipped, no room
      expect(events).not.toContain('ATE_BONUS');
      expect(next.status).toBe('WON');
    });
  });

  describe('purity', () => {
    it('never mutates the input state', () => {
      const config = makeConfig(makeGrid(12, 12), {
        enabled: true,
        spawnEveryTicks: 1,
        lifetimeTicks: 5,
      });
      const state = makeState({
        snake: [
          { x: 5, y: 5 },
          { x: 4, y: 5 },
          { x: 3, y: 5 },
        ],
        food: { x: 0, y: 0 },
        ticksUntilBonus: 1,
      });
      const snapshot = JSON.parse(JSON.stringify(state)) as GameState;

      tick(state, config, rng());

      expect(state).toEqual(snapshot);
    });
  });
});
