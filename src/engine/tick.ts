import type { RandomPort } from '../services/RandomPort';
import { spawnFood, spawnBonus } from './food';
import { computeNextHead, resolveWall } from './movement';
import { applyPowerups, scoreMultiplier } from './powerups';
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
 * Bonus lifecycle overlay, applied AFTER movement so the order is well-defined:
 *
 *   1. Move (handled by tick): the head advances and may eat regular food.
 *   2. Eat bonus: if the head landed on the bonus that existed at tick start,
 *      award points (no growth) and clear it.
 *   3. Otherwise advance the bonus timers on the post-move state:
 *        - an active bonus counts down and expires (BONUS_EXPIRED) at 0;
 *        - with no bonus, the spawn countdown ticks and spawns when due.
 *
 * The spawn countdown is paused while a bonus is on the board, and restarts
 * (= spawnEveryTicks) whenever a bonus is eaten or expires. Pure: never mutates
 * `moved` or `prev`; pushes any bonus events onto the shared `events` array.
 * Only ever called when config.bonus.enabled, so disabled play is untouched.
 */
function applyBonus(
  moved: GameState,
  prev: GameState,
  nextHead: Cell,
  config: GameConfig,
  rng: RandomPort,
  events: GameEvent[],
): GameState {
  const { spawnEveryTicks, lifetimeTicks, points } = config.bonus;

  // 2. Eating uses the bonus present at the START of the tick, so a bonus on its
  //    final tick of life is still eatable rather than vanishing under the head.
  if (prev.bonusFood !== null && sameCell(nextHead, prev.bonusFood)) {
    events.push('ATE_BONUS');
    return {
      ...moved,
      score: moved.score + points,
      bonusFood: null,
      bonusRemaining: 0,
      ticksUntilBonus: spawnEveryTicks,
    };
  }

  // 3a. An active bonus counts down toward expiry.
  if (moved.bonusFood !== null) {
    const bonusRemaining = moved.bonusRemaining - 1;
    if (bonusRemaining <= 0) {
      events.push('BONUS_EXPIRED');
      return {
        ...moved,
        bonusFood: null,
        bonusRemaining: 0,
        ticksUntilBonus: spawnEveryTicks,
      };
    }
    return { ...moved, bonusRemaining };
  }

  // 3b. No bonus on the board: count down to the next spawn.
  const ticksUntilBonus = moved.ticksUntilBonus - 1;
  if (ticksUntilBonus > 0) {
    return { ...moved, ticksUntilBonus };
  }

  const cell = spawnBonus(moved, config, rng);
  if (cell === null) {
    // Near-full grid: no room this tick. Stay "due" and retry next tick.
    return { ...moved, ticksUntilBonus: 0 };
  }
  return {
    ...moved,
    bonusFood: cell,
    bonusRemaining: lifetimeTicks,
    ticksUntilBonus: spawnEveryTicks,
  };
}

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
  //    this same tick, so that cell is safe to enter. Obstacles are treated like
  //    body cells — always blocking, never vacated — so a head entering one dies
  //    in BOTH wall behaviors (the check runs after wall resolution).
  const lastIndex = state.snake.length - 1;
  const occupied = new Set<number>();
  state.snake.forEach((c, i) => {
    if (!willGrow && i === lastIndex) {
      return;
    }
    occupied.add(cellIndex(c));
  });
  for (const o of state.obstacles) {
    occupied.add(cellIndex(o));
  }
  if (occupied.has(cellIndex(nextHead))) {
    return {
      state: { ...state, direction, inputQueue, status: 'LOST' },
      events: ['DIED'],
    };
  }

  // 6. Move: head advances; tail is kept on growth, dropped otherwise.
  const events: GameEvent[] = [];

  // Build the post-movement state; the bonus overlay (step 8) is layered on top.
  let moved: GameState;

  if (!willGrow) {
    const snake = [nextHead, ...state.snake.slice(0, lastIndex)];
    moved = { ...state, snake, direction, inputQueue };
  } else {
    const snake = [nextHead, ...state.snake];
    const foodEaten = state.foodEaten + 1;
    // Score gains scale with an active DOUBLE; permanent SLOW raises the floor.
    // Both are no-ops without config.powerups, so classic scoring is unchanged.
    const score =
      state.score + config.pointsPerFood * scoreMultiplier(state, config);
    const tickMs =
      computeTickMs(
        config.baseTickMs,
        config.minTickMs,
        config.accelMsPerFood,
        foodEaten,
      ) + (state.slowMs ?? 0);
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
      moved = { ...grown, food: null, status: 'WON' };
    } else {
      moved = { ...grown, food: nextFood };
    }
  }

  // 8. Pickup overlay. The powerup-aware overlay subsumes the bonus slot (POINTS
  //    is just one kind) and adds effects; it runs only when a mode opts in via
  //    config.powerups. Otherwise the classic bonus overlay applies, or nothing.
  if (config.powerups) {
    return {
      state: applyPowerups(moved, state, nextHead, config, rng, events),
      events,
    };
  }
  if (!config.bonus.enabled) {
    return { state: moved, events };
  }
  return {
    state: applyBonus(moved, state, nextHead, config, rng, events),
    events,
  };
}
