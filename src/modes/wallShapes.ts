import type { Cell, GridSpec } from '../engine/types';
import type { RandomPort } from '../services/RandomPort';

/**
 * Multi-cell obstacle shapes for Dynamic Walls. A template is a list of cell
 * offsets (always including the origin); a placed obstacle is a template rotated
 * by a quarter-turn and anchored at a grid cell. Pure geometry — no game state —
 * so it is cheap and unit-testable; dynamicWallsMode uses it to evolve the
 * obstacle set into lines/Ls/squares instead of lone squares. (dynamic walls)
 */

export type ShapeTemplate = ReadonlyArray<Cell>;

/** The shape catalog. Single stays in so small/fallback placements are possible. */
export const SHAPE_TEMPLATES: readonly ShapeTemplate[] = [
  [{ x: 0, y: 0 }], // single
  [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
  ], // domino
  [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
  ], // I-tromino (line of 3)
  [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
  ], // L-tromino
  [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
  ], // 2x2 square
  [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 3, y: 0 },
  ], // line of 4
];

/** Rotate one offset a quarter-turn `times` (0..3): (x,y) -> (-y, x). */
function rotateOffset(cell: Cell, times: number): Cell {
  let { x, y } = cell;
  const t = ((times % 4) + 4) % 4;
  for (let i = 0; i < t; i++) {
    const nx = -y;
    const ny = x;
    x = nx;
    y = ny;
  }
  return { x, y };
}

/** Absolute cells of a template rotated by `rotation` and anchored at `anchor`. */
export function shapeCells(
  anchor: Cell,
  template: ShapeTemplate,
  rotation: number,
): Cell[] {
  return template.map((off) => {
    const r = rotateOffset(off, rotation);
    return { x: anchor.x + r.x, y: anchor.y + r.y };
  });
}

/**
 * Every anchor at which the rotated template lands fully in-bounds and on cells
 * that are not in `blocked` (encoded as y*columns+x). The set of fair placements.
 */
export function validAnchors(
  template: ShapeTemplate,
  rotation: number,
  blocked: Set<number>,
  grid: GridSpec,
): Cell[] {
  const { columns, rows } = grid;
  const anchors: Cell[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      const cells = shapeCells({ x, y }, template, rotation);
      const fits = cells.every(
        (c) =>
          c.x >= 0 &&
          c.x < columns &&
          c.y >= 0 &&
          c.y < rows &&
          !blocked.has(c.y * columns + c.x),
      );
      if (fits) {
        anchors.push({ x, y });
      }
    }
  }
  return anchors;
}

/**
 * Choose and place one obstacle shape on fair cells: pick a random template +
 * rotation, and if it has no fair anchor fall back to the single cell (which
 * fits wherever any empty cell remains). Returns the placed cells, or [] when
 * the board has no room at all. Deterministic via the injected rng. (dynamic walls)
 */
export function placeShape(
  blocked: Set<number>,
  grid: GridSpec,
  rng: RandomPort,
): Cell[] {
  const template = SHAPE_TEMPLATES[rng.nextInt(SHAPE_TEMPLATES.length)];
  const rotation = rng.nextInt(4);

  let anchors = validAnchors(template, rotation, blocked, grid);
  if (anchors.length === 0) {
    // Fall back to a single cell so a near-full board still gets a hazard.
    anchors = validAnchors(SHAPE_TEMPLATES[0], 0, blocked, grid);
    if (anchors.length === 0) {
      return [];
    }
    return shapeCells(anchors[rng.nextInt(anchors.length)], SHAPE_TEMPLATES[0], 0);
  }

  return shapeCells(anchors[rng.nextInt(anchors.length)], template, rotation);
}
