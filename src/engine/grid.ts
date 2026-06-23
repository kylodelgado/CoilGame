import type { GridSpec } from './types';

export const MIN_COLUMNS = 6;
export const MIN_ROWS = 6;

/**
 * Compute a square-celled grid that fills the available width without
 * exceeding the play area, enforcing minimum dimensions. Pure: identical
 * inputs always yield identical output. Powers both the play grid and the
 * home-screen previews. (FR-G1, EH-4)
 */
export function computeGrid(
  screenWidth: number,
  playAreaHeight: number,
  targetColumns: number,
): GridSpec {
  const rawCell = Math.floor(screenWidth / targetColumns);
  const cellSize = Math.max(rawCell, 1);

  const columns = Math.max(MIN_COLUMNS, Math.floor(screenWidth / cellSize));
  const rows = Math.max(MIN_ROWS, Math.floor(playAreaHeight / cellSize));

  const gridPxWidth = columns * cellSize;
  const gridPxHeight = rows * cellSize;

  const originX = Math.floor((screenWidth - gridPxWidth) / 2);
  const originY = Math.floor((playAreaHeight - gridPxHeight) / 2);

  return { columns, rows, cellSize, originX, originY };
}
