import { computeNextHead, resolveWall } from './movement';
import type { Cell, Direction, GameConfig, GameState } from './types';

/**
 * Pure revive rule for the rewarded-ad "Revive" flow. Given a LOST state,
 * produce a state the player can resume from:
 *
 *   - the snake is truncated to max(3, floor(len/2)) cells, keeping the HEAD;
 *   - if the head cannot continue from where it died (the fatal cell ahead is
 *     a solid wall, body, or obstacle in every heading), the whole truncated
 *     snake is relocated so the head sits on the nearest safe cell — one with
 *     at least 2 free forward cells in some heading — searched outward from
 *     the death position in a fixed ring order (deterministic, no RNG);
 *   - direction points along the chosen safe heading; the input queue is
 *     cleared; status becomes 'TAP_TO_START' so play resumes on tap;
 *   - score / foodEaten / tickMs (and all other run state) are preserved; the
 *     food is untouched unless the relocated snake now covers it, in which
 *     case the food moves to the nearest free cell (again deterministic).
 *
 * Total and pure: never throws, never mutates the input, and returns the
 * input state UNCHANGED when it is not LOST or when no safe placement exists
 * (grid nearly full) — callers treat an unchanged result as revive-unavailable.
 */

/** The snake never revives shorter than this many cells. */
export const MIN_REVIVE_LENGTH = 3;

/** How many free cells straight ahead a safe heading must have. */
const REQUIRED_FORWARD_CELLS = 2;

/** Fixed tie-break order for headings (after the preferred direction). */
const DIRECTION_ORDER: readonly Direction[] = ['UP', 'RIGHT', 'DOWN', 'LEFT'];

const OPPOSITE: Record<Direction, Direction> = {
  UP: 'DOWN',
  DOWN: 'UP',
  LEFT: 'RIGHT',
  RIGHT: 'LEFT',
};

/** The preferred direction first, then the fixed order (deduplicated). */
function headingOrder(preferred: Direction): Direction[] {
  return [preferred, ...DIRECTION_ORDER.filter((d) => d !== preferred)];
}

/**
 * The REQUIRED_FORWARD_CELLS cells straight ahead of `head` along `dir`, wall
 * behavior respected (PORTAL wraps; SOLID returns null when the run of cells
 * leaves the grid). Cells must be distinct from each other and from the head
 * (tiny PORTAL grids can wrap back onto themselves).
 */
function forwardCells(
  head: Cell,
  dir: Direction,
  config: GameConfig,
): Cell[] | null {
  const cells: Cell[] = [];
  const seen = new Set<string>([`${head.x},${head.y}`]);
  let current = head;
  for (let i = 0; i < REQUIRED_FORWARD_CELLS; i++) {
    const resolved = resolveWall(
      computeNextHead(current, dir),
      config.grid,
      config.wallBehavior,
    );
    if (resolved.kind === 'OUT_OF_BOUNDS') {
      return null;
    }
    const cellKey = `${resolved.cell.x},${resolved.cell.y}`;
    if (seen.has(cellKey)) {
      return null;
    }
    seen.add(cellKey);
    cells.push(resolved.cell);
    current = resolved.cell;
  }
  return cells;
}

/**
 * Find a heading from `head` whose next REQUIRED_FORWARD_CELLS cells are all
 * free of `blocked` keys. Tries `preferred` first, then the fixed order.
 */
function findSafeHeading(
  head: Cell,
  preferred: Direction,
  blocked: ReadonlySet<number>,
  config: GameConfig,
): Direction | null {
  const { columns } = config.grid;
  for (const dir of headingOrder(preferred)) {
    const ahead = forwardCells(head, dir, config);
    if (ahead === null) {
      continue;
    }
    if (ahead.every((c) => !blocked.has(c.y * columns + c.x))) {
      return dir;
    }
  }
  return null;
}

/**
 * Lay a `length`-cell body starting at `head` (heading `dir`), trailing away
 * from the heading. Each segment takes the first free neighbor of the previous
 * one — straight behind first, then the fixed order — never entering
 * obstacles, already-laid cells, or the reserved forward cells. Returns null
 * when the body cannot fit at this placement. Deterministic; greedy on
 * purpose (simple, total, and good enough — a failed lay just advances the
 * ring search to the next candidate).
 */
function layBody(
  head: Cell,
  dir: Direction,
  length: number,
  obstacles: ReadonlySet<number>,
  reserved: ReadonlySet<number>,
  config: GameConfig,
): Cell[] | null {
  const { columns } = config.grid;
  const keyOf = (c: Cell): number => c.y * columns + c.x;

  const body: Cell[] = [head];
  const used = new Set<number>([keyOf(head)]);
  const growthOrder = headingOrder(OPPOSITE[dir]);

  for (let i = 1; i < length; i++) {
    const prev = body[i - 1];
    let placed = false;
    for (const candidate of growthOrder) {
      const resolved = resolveWall(
        computeNextHead(prev, candidate),
        config.grid,
        config.wallBehavior,
      );
      if (resolved.kind === 'OUT_OF_BOUNDS') {
        continue;
      }
      const k = keyOf(resolved.cell);
      if (used.has(k) || obstacles.has(k) || reserved.has(k)) {
        continue;
      }
      body.push(resolved.cell);
      used.add(k);
      placed = true;
      break;
    }
    if (!placed) {
      return null;
    }
  }
  return body;
}

/**
 * Enumerate grid cells by increasing Chebyshev ring distance from `origin`
 * (r = 0, 1, 2, ...), each ring scanned top-to-bottom then left-to-right.
 * Deterministic "nearest first" order for relocation and food conflicts.
 */
function* ringCells(origin: Cell, config: GameConfig): Generator<Cell> {
  const { columns, rows } = config.grid;
  const maxR = columns + rows;
  for (let r = 0; r <= maxR; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) {
          continue;
        }
        const x = origin.x + dx;
        const y = origin.y + dy;
        if (x < 0 || x >= columns || y < 0 || y >= rows) {
          continue;
        }
        yield { x, y };
      }
    }
  }
}

/**
 * Resolve a food/snake overlap after relocation: keep the food unless a snake
 * cell now covers it, in which case move it to the nearest free cell (ring
 * order from its current position). If the grid is so full that no free cell
 * exists, the food is left as-is (the surrounding revive would normally have
 * failed first). Never spawns randomness — respawn is NOT needed here.
 */
function resolveFood(
  food: Cell | null,
  snake: readonly Cell[],
  state: GameState,
  config: GameConfig,
): Cell | null {
  if (food === null) {
    return null;
  }
  const { columns } = config.grid;
  const keyOf = (c: Cell): number => c.y * columns + c.x;
  const taken = new Set<number>(snake.map(keyOf));
  if (!taken.has(keyOf(food))) {
    return food;
  }
  for (const o of state.obstacles) {
    taken.add(keyOf(o));
  }
  if (state.bonusFood !== null) {
    taken.add(keyOf(state.bonusFood));
  }
  for (const cell of ringCells(food, config)) {
    if (!taken.has(keyOf(cell))) {
      return cell;
    }
  }
  return food;
}

/** Assemble the revived state from a placed snake + heading. */
function finish(
  state: GameState,
  config: GameConfig,
  snake: Cell[],
  direction: Direction,
): GameState {
  return {
    ...state,
    status: 'TAP_TO_START',
    snake,
    direction,
    inputQueue: [],
    food: resolveFood(state.food, snake, state, config),
  };
}

/**
 * Revive a LOST run. See the module doc for the full rule set. Returns the
 * input state unchanged (same reference) when reviving is not possible.
 */
export function revive(state: GameState, config: GameConfig): GameState {
  if (state.status !== 'LOST' || state.snake.length === 0) {
    return state;
  }

  const { columns } = config.grid;
  const keyOf = (c: Cell): number => c.y * columns + c.x;

  // 1. Truncate to max(3, floor(len/2)) keeping the head end (never longer
  //    than the snake actually is).
  const keep = Math.min(
    state.snake.length,
    Math.max(MIN_REVIVE_LENGTH, Math.floor(state.snake.length / 2)),
  );
  const truncated = state.snake.slice(0, keep);

  const obstacleKeys = new Set<number>(state.obstacles.map(keyOf));

  // 2. Prefer staying in place: on a death the snake never actually entered
  //    the fatal cell (tick leaves it at its last live position), so the head
  //    cell itself is normally fine — the question is whether ANY heading has
  //    two free cells ahead of the truncated body. If so, keep the body where
  //    it is and just point the snake down that heading.
  const head = truncated[0];
  if (!obstacleKeys.has(keyOf(head))) {
    const blocked = new Set<number>(obstacleKeys);
    for (const c of truncated) {
      blocked.add(keyOf(c));
    }
    const heading = findSafeHeading(head, state.direction, blocked, config);
    if (heading !== null) {
      return finish(state, config, truncated, heading);
    }
  }

  // 3. Relocate: search outward from the death position for the nearest cell
  //    where the head has a safe heading AND the truncated body fits.
  for (const candidate of ringCells(head, config)) {
    if (obstacleKeys.has(keyOf(candidate))) {
      continue;
    }
    for (const dir of headingOrder(state.direction)) {
      const ahead = forwardCells(candidate, dir, config);
      if (
        ahead === null ||
        ahead.some((c) => obstacleKeys.has(keyOf(c)))
      ) {
        continue;
      }
      const reserved = new Set<number>(ahead.map(keyOf));
      const body = layBody(
        candidate,
        dir,
        truncated.length,
        obstacleKeys,
        reserved,
        config,
      );
      if (body !== null) {
        return finish(state, config, body, dir);
      }
    }
  }

  // 4. Grid (nearly) full: no safe placement anywhere. Unchanged input state
  //    is the caller's signal that revive is unavailable.
  return state;
}
