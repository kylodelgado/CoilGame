import type { RandomPort } from '../services/RandomPort';
import { spawnBonus } from './food';
import type {
  ActiveEffect,
  Cell,
  GameConfig,
  GameEvent,
  GameState,
  PowerupKind,
  PowerupsConfig,
} from './types';

/**
 * Pure powerup overlay for the engine. The bonus slot is generalized: instead of
 * always being POINTS, a spawned pickup carries a `kind` drawn from the mode's
 * pool, and eating it applies that kind's effect — instant (POINTS/SLOW/SHRINK)
 * or timed (MAGNET/DOUBLE/WALL_BUSTER, tracked in state.activeEffects). This file
 * holds the small pure helpers plus `applyPowerups`, the per-tick overlay that
 * mirrors `applyBonus` but is powerup-aware. It runs only when config.powerups is
 * set, so classic play stays byte-identical. (Phase 2 powerups)
 */

const sameCell = (a: Cell, b: Cell): boolean => a.x === b.x && a.y === b.y;

/** Shared magnitudes/durations for the powerup effects; tweak play feel here. */
export const POWERUP_DEFAULTS = {
  durationTicks: { MAGNET: 40, DOUBLE: 40, WALL_BUSTER: 30 },
  slowMs: 25,
  shrinkBy: 3,
  minLength: 3,
  doubleMultiplier: 2,
  wallBusterRadius: 2,
} as const;

/**
 * Build a mode's PowerupsConfig. POINTS is weighted (listed twice) so plain
 * bonuses stay the common case. WALL_BUSTER is included only when the mode has
 * obstacles to clear, satisfying the "only where walls exist" gate.
 */
export function buildPowerups(opts: { walls: boolean }): PowerupsConfig {
  const pool: PowerupKind[] = [
    'POINTS',
    'POINTS',
    'MAGNET',
    'SLOW',
    'SHRINK',
    'DOUBLE',
  ];
  if (opts.walls) {
    pool.push('WALL_BUSTER');
  }
  return { pool, ...POWERUP_DEFAULTS };
}

/** Chebyshev (king-move) distance — the radius metric for WALL_BUSTER. */
function chebyshev(a: Cell, b: Cell): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/** Is a timed effect of this kind currently active? */
export function hasEffect(
  effects: ActiveEffect[] | undefined,
  kind: PowerupKind,
): boolean {
  return (effects ?? []).some((e) => e.kind === kind);
}

/** The score multiplier implied by the active effects (DOUBLE => doubleMultiplier). */
export function scoreMultiplier(state: GameState, config: GameConfig): number {
  if (config.powerups && hasEffect(state.activeEffects, 'DOUBLE')) {
    return config.powerups.doubleMultiplier;
  }
  return 1;
}

/** Add a timed effect at full duration, refreshing any existing one of that kind. */
export function addOrRefresh(
  effects: ActiveEffect[],
  kind: PowerupKind,
  totalTicks: number,
): ActiveEffect[] {
  const without = effects.filter((e) => e.kind !== kind);
  return [...without, { kind, remainingTicks: totalTicks, totalTicks }];
}

/**
 * Count every active effect down by one tick; drop those that hit zero. Returns
 * the surviving effects plus the kinds that expired this tick (for events).
 */
export function advanceEffects(effects: ActiveEffect[]): {
  next: ActiveEffect[];
  expired: PowerupKind[];
} {
  const next: ActiveEffect[] = [];
  const expired: PowerupKind[] = [];
  for (const e of effects) {
    const remainingTicks = e.remainingTicks - 1;
    if (remainingTicks <= 0) {
      expired.push(e.kind);
    } else {
      next.push({ ...e, remainingTicks });
    }
  }
  return { next, expired };
}

/**
 * Move the food one cell toward `head` along its dominant axis, but only onto an
 * empty cell (never the snake, an obstacle, or the head itself). Returns the
 * food unchanged when it cannot advance. Pure. (MAGNET)
 */
export function magnetStep(
  food: Cell,
  head: Cell,
  snake: Cell[],
  obstacles: Cell[],
): Cell {
  const dx = head.x - food.x;
  const dy = head.y - food.y;
  if (dx === 0 && dy === 0) {
    return food;
  }
  // Step the axis with the larger gap; ties favor horizontal.
  const stepX = Math.abs(dx) >= Math.abs(dy) ? Math.sign(dx) : 0;
  const stepY = stepX === 0 ? Math.sign(dy) : 0;
  const target: Cell = { x: food.x + stepX, y: food.y + stepY };

  const blocked =
    snake.some((c) => sameCell(c, target)) ||
    obstacles.some((c) => sameCell(c, target));
  return blocked ? food : target;
}

/** Remove every obstacle within `radius` (Chebyshev) of the head. Pure. (WALL_BUSTER) */
export function bustWalls(
  obstacles: Cell[],
  head: Cell,
  radius: number,
): Cell[] {
  return obstacles.filter((o) => chebyshev(o, head) > radius);
}

/** Apply an eaten powerup's effect to the post-move state. Pure. */
function applyEffect(
  state: GameState,
  kind: PowerupKind,
  config: GameConfig,
  pw: PowerupsConfig,
  events: GameEvent[],
): GameState {
  const effects = state.activeEffects ?? [];

  switch (kind) {
    case 'POINTS': {
      events.push('ATE_BONUS');
      return {
        ...state,
        score: state.score + config.bonus.points * scoreMultiplier(state, config),
      };
    }
    case 'SLOW': {
      events.push('GOT_POWERUP');
      return {
        ...state,
        slowMs: (state.slowMs ?? 0) + pw.slowMs,
        tickMs: state.tickMs + pw.slowMs,
      };
    }
    case 'SHRINK': {
      events.push('GOT_POWERUP');
      const keep = Math.max(pw.minLength, state.snake.length - pw.shrinkBy);
      return { ...state, snake: state.snake.slice(0, keep) };
    }
    case 'MAGNET':
    case 'DOUBLE':
    case 'WALL_BUSTER': {
      events.push('GOT_POWERUP');
      const total = pw.durationTicks[kind];
      return { ...state, activeEffects: addOrRefresh(effects, kind, total) };
    }
  }
}

/**
 * Per-tick powerup overlay, applied AFTER movement (mirrors applyBonus' order):
 *
 *   1. Advance active-effect timers; drop and announce any that expired.
 *   2. If the head landed on the pickup that existed at tick start, apply its
 *      kind's effect, clear the slot, and restart the spawn countdown.
 *   3. Otherwise tick the on-board lifetime / spawn countdown; a fresh spawn
 *      draws its kind from the pool.
 *   4. Apply continuous effects on the resulting state: MAGNET pulls the food a
 *      cell toward the head; WALL_BUSTER clears obstacles around the head.
 *
 * `pickupBanner` is reset to null up front and set to the eaten kind in step 2,
 * so it is a one-tick signal. Pure; only ever called when config.powerups is set.
 */
export function applyPowerups(
  moved: GameState,
  prev: GameState,
  nextHead: Cell,
  config: GameConfig,
  rng: RandomPort,
  events: GameEvent[],
): GameState {
  const pw = config.powerups as PowerupsConfig;
  const { spawnEveryTicks, lifetimeTicks } = config.bonus;

  // 1. Advance timers.
  const advanced = advanceEffects(moved.activeEffects ?? []);
  for (const _ of advanced.expired) {
    events.push('EFFECT_EXPIRED');
  }
  let next: GameState = {
    ...moved,
    activeEffects: advanced.next,
    pickupBanner: null,
  };

  // 2. Eat the pickup present at the START of the tick (kind from prev).
  if (prev.bonusFood !== null && sameCell(nextHead, prev.bonusFood)) {
    const kind = prev.powerupKind ?? 'POINTS';
    next = applyEffect(next, kind, config, pw, events);
    next = {
      ...next,
      bonusFood: null,
      bonusRemaining: 0,
      ticksUntilBonus: spawnEveryTicks,
      pickupBanner: kind,
    };
  } else if (next.bonusFood !== null) {
    // 3a. An on-board pickup counts down toward expiry.
    const bonusRemaining = next.bonusRemaining - 1;
    if (bonusRemaining <= 0) {
      events.push('BONUS_EXPIRED');
      next = {
        ...next,
        bonusFood: null,
        bonusRemaining: 0,
        ticksUntilBonus: spawnEveryTicks,
      };
    } else {
      next = { ...next, bonusRemaining };
    }
  } else {
    // 3b. No pickup on the board: count down to the next spawn.
    const ticksUntilBonus = next.ticksUntilBonus - 1;
    if (ticksUntilBonus > 0) {
      next = { ...next, ticksUntilBonus };
    } else {
      const cell = spawnBonus(next, config, rng);
      if (cell === null) {
        next = { ...next, ticksUntilBonus: 0 }; // no room; retry next tick
      } else {
        const kind = pw.pool[rng.nextInt(pw.pool.length)];
        next = {
          ...next,
          bonusFood: cell,
          powerupKind: kind,
          bonusRemaining: lifetimeTicks,
          ticksUntilBonus: spawnEveryTicks,
        };
      }
    }
  }

  // 4. Continuous effects on the post-resolution state.
  const head = next.snake[0];
  if (next.food !== null && hasEffect(next.activeEffects, 'MAGNET')) {
    next = {
      ...next,
      food: magnetStep(next.food, head, next.snake, next.obstacles),
    };
  }
  if (next.obstacles.length > 0 && hasEffect(next.activeEffects, 'WALL_BUSTER')) {
    next = {
      ...next,
      obstacles: bustWalls(next.obstacles, head, pw.wallBusterRadius),
    };
  }

  return next;
}
