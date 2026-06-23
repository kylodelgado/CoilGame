import type { Cell, WorldSpec } from '../engine/types';

/** The visible window of the world: its top-left world cell plus its extent. */
export interface Viewport {
  originCol: number;
  originRow: number;
  cols: number;
  rows: number;
}

/** Pixel position of a world cell within the viewport, plus an on-screen flag. */
export interface ScreenPoint {
  x: number;
  y: number;
  onScreen: boolean;
}

const clamp = (value: number, max: number): number =>
  Math.max(0, Math.min(max, value));

/**
 * The visible window centered on the head, clamped to world bounds so the camera
 * never shows beyond the edges. When the world is smaller than the viewport the
 * origin pins to 0 (the whole world is visible). Pure. (chunk M camera)
 */
export function computeViewport(
  head: Cell,
  world: WorldSpec,
  viewportCols: number,
  viewportRows: number,
): Viewport {
  const maxCol = Math.max(0, world.worldColumns - viewportCols);
  const maxRow = Math.max(0, world.worldRows - viewportRows);
  return {
    originCol: clamp(head.x - Math.floor(viewportCols / 2), maxCol),
    originRow: clamp(head.y - Math.floor(viewportRows / 2), maxRow),
    cols: viewportCols,
    rows: viewportRows,
  };
}

/**
 * Translate a WORLD cell to its on-screen pixel position within the viewport.
 * onScreen is false when the cell lies outside the half-open visible window
 * [origin, origin+extent); callers skip drawing those (the HUD arrow, step 49,
 * points toward off-screen food). Pure.
 */
export function worldToScreen(
  worldCell: Cell,
  viewport: Viewport,
  cellSize: number,
  gridOrigin: { x: number; y: number },
): ScreenPoint {
  const localCol = worldCell.x - viewport.originCol;
  const localRow = worldCell.y - viewport.originRow;
  const onScreen =
    localCol >= 0 &&
    localCol < viewport.cols &&
    localRow >= 0 &&
    localRow < viewport.rows;
  return {
    x: gridOrigin.x + localCol * cellSize,
    y: gridOrigin.y + localRow * cellSize,
    onScreen,
  };
}
