import type { RandomPort } from '../services/RandomPort';
import { spawnFood } from './food';
import { computeNextHead, resolveWall } from './movement';
import { computeTickMs } from './speed';
import type {
  Cell,
  GameConfig,
  GameEvent,
  GameState,
  TickResult,
} from './types';

const sameCell = (a: Cell, b: Cell): boolean => a.x === b.x && a.y === b.y;

/**
 * One logical step of the game. Composes direction commit, movement, wall
 * resolution, tail-follow self-collision, eating + speed-up + food respawn, and
 * win detection, returning the new state and the events that occurred this tick.
 * Pure and deterministic given the injected rng; never mutates the input state.
 * Only does meaningful work while RUNNING. (FR-S1, FR-D1/2/3, FR-F3/4, FR-SC1, §7.3)
 */
export function tick(
  state: GameState,
  config: GameConfig,
  rng: RandomPort,
): TickResult {
  if (state.status !== 'RUNNING') {
    return { state, events: [] };
  }

  const { columns } = config.grid;
  const cellIndex = (c: Cell): number => c.y * columns + c.x;

  // 1. Commit the next queued direction (if any) before moving.
  const direction =
    state.inputQueue.length > 0 ? state.inputQueue[0] : state.direction;
  const inputQueue = state.inputQueue.slice(1);

  const head = state.snake[0];
  const rawHead = computeNextHead(head, direction);

  // 2-3. Resolve the head against the walls.
  const wall = resolveWall(rawHead, config.grid, config.wallBehavior);
  if (wall.kind === 'OUT_OF_BOUNDS') {
    return {
      state: { ...state, direction, inputQueue, status: 'LOST' },
      events: ['DIED'],
    };
  }
  const nextHead = wall.cell;

  // 4. Will this move eat the food (and therefore grow)?
  const willGrow = state.food !== null && sameCell(nextHead, state.food);

  // 5. Self-collision with tail-follow: a non-growing snake vacates its tail
  //    this same tick, so that cell is safe to enter.
  const lastIndex = state.snake.length - 1;
  const occupied = new Set<number>();
  state.snake.forEach((c, i) => {
    if (!willGrow && i === lastIndex) {
      return;
    }
    occupied.add(cellIndex(c));
  });
  if (occupied.has(cellIndex(nextHead))) {
    return {
      state: { ...state, direction, inputQueue, status: 'LOST' },
      events: ['DIED'],
    };
  }

  // 6. Move: head advances; tail is kept on growth, dropped otherwise.
  const events: GameEvent[] = [];

  if (!willGrow) {
    const snake = [nextHead, ...state.snake.slice(0, lastIndex)];
    return {
      state: { ...state, snake, direction, inputQueue },
      events,
    };
  }

  const snake = [nextHead, ...state.snake];
  const foodEaten = state.foodEaten + 1;
  const score = state.score + config.pointsPerFood;
  const tickMs = computeTickMs(
    config.baseTickMs,
    config.minTickMs,
    config.accelMsPerFood,
    foodEaten,
  );
  events.push('ATE_FOOD');

  const grown: GameState = {
    ...state,
    snake,
    direction,
    inputQueue,
    score,
    foodEaten,
    tickMs,
    food: null,
  };

  // 7. Respawn food; a null result means the snake fills the grid — a win.
  const nextFood = spawnFood(grown, config, rng);
  if (nextFood === null) {
    events.push('WON');
    return { state: { ...grown, food: null, status: 'WON' }, events };
  }

  return { state: { ...grown, food: nextFood }, events };
}
