import type { Cell, GridSpec } from '../engine/types';

export interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Project a grid Cell to its pixel rect: top-left at
 * (originX + x*cellSize, originY + y*cellSize), inset on every side by half the
 * cell gap so adjacent cells leave a `gap`-px channel between them.
 */
export function cellRect(grid: GridSpec, cell: Cell, gap: number): PixelRect {
  const inset = gap / 2;
  return {
    x: grid.originX + cell.x * grid.cellSize + inset,
    y: grid.originY + cell.y * grid.cellSize + inset,
    width: grid.cellSize - gap,
    height: grid.cellSize - gap,
  };
}
