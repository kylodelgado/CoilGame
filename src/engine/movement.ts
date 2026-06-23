import type { Cell, Direction, GridSpec, WallBehavior } from './types';

/** Raw next head one cell in the given direction. May be out of bounds. (FR-D2) */
export function computeNextHead(head: Cell, dir: Direction): Cell {
  switch (dir) {
    case 'UP':
      return { x: head.x, y: head.y - 1 };
    case 'DOWN':
      return { x: head.x, y: head.y + 1 };
    case 'LEFT':
      return { x: head.x - 1, y: head.y };
    case 'RIGHT':
      return { x: head.x + 1, y: head.y };
  }
}

export type WallResult =
  | { kind: 'IN_BOUNDS'; cell: Cell }
  | { kind: 'OUT_OF_BOUNDS' };

/** Euclidean modulo: result has the sign of the divisor, so negatives wrap. */
function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/**
 * Resolve a raw head against the grid edges per wall behavior.
 * PORTAL wraps around (negatives handled); SOLID reports OUT_OF_BOUNDS when the
 * raw head leaves [0,columns) x [0,rows). Pure; does not mutate inputs. (FR-M2)
 */
export function resolveWall(
  rawHead: Cell,
  grid: GridSpec,
  wall: WallBehavior,
): WallResult {
  if (wall === 'PORTAL') {
    return {
      kind: 'IN_BOUNDS',
      cell: {
        x: mod(rawHead.x, grid.columns),
        y: mod(rawHead.y, grid.rows),
      },
    };
  }

  const inBounds =
    rawHead.x >= 0 &&
    rawHead.x < grid.columns &&
    rawHead.y >= 0 &&
    rawHead.y < grid.rows;

  return inBounds
    ? { kind: 'IN_BOUNDS', cell: { x: rawHead.x, y: rawHead.y } }
    : { kind: 'OUT_OF_BOUNDS' };
}
