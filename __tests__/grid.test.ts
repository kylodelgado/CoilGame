import { computeGrid, MIN_COLUMNS, MIN_ROWS } from '../src/engine/grid';

describe('computeGrid (FR-G1, EH-4)', () => {
  it('produces square cells with cellSize >= 1', () => {
    const grid = computeGrid(390, 780, 16);
    // A single cellSize drives both axes — squareness is structural.
    expect(grid.cellSize).toBeGreaterThanOrEqual(1);
    expect(Number.isInteger(grid.cellSize)).toBe(true);
  });

  it('fills the width on a normal phone (390x780, target 16)', () => {
    const grid = computeGrid(390, 780, 16);
    const used = grid.columns * grid.cellSize;
    expect(used).toBeLessThanOrEqual(390);
    // Leftover is less than one cell — i.e. we packed as many columns as fit.
    expect(390 - used).toBeLessThan(grid.cellSize);
  });

  it('derives rows from playAreaHeight without exceeding it', () => {
    const grid = computeGrid(390, 780, 16);
    expect(grid.rows * grid.cellSize).toBeLessThanOrEqual(780);
    expect(780 - grid.rows * grid.cellSize).toBeLessThan(grid.cellSize);
  });

  it('clamps a tiny/degenerate screen to the minimums and never returns 0', () => {
    const grid = computeGrid(30, 30, 24);
    expect(grid.cellSize).toBeGreaterThanOrEqual(1);
    expect(grid.columns).toBeGreaterThanOrEqual(MIN_COLUMNS);
    expect(grid.rows).toBeGreaterThanOrEqual(MIN_ROWS);
    expect(grid.columns).toBeGreaterThan(0);
    expect(grid.rows).toBeGreaterThan(0);
  });

  it('centers the grid with non-negative, floored origins', () => {
    const screenWidth = 390;
    const playAreaHeight = 780;
    const grid = computeGrid(screenWidth, playAreaHeight, 16);
    expect(grid.originX).toBeGreaterThanOrEqual(0);
    expect(grid.originY).toBeGreaterThanOrEqual(0);
    expect(grid.originX).toBe(
      Math.floor((screenWidth - grid.columns * grid.cellSize) / 2),
    );
    expect(grid.originY).toBe(
      Math.floor((playAreaHeight - grid.rows * grid.cellSize) / 2),
    );
  });

  it('yields a smaller cellSize for a larger targetColumns at the same width', () => {
    const coarse = computeGrid(390, 780, 8);
    const fine = computeGrid(390, 780, 24);
    expect(fine.cellSize).toBeLessThan(coarse.cellSize);
  });

  it('is pure — identical inputs produce identical output', () => {
    expect(computeGrid(390, 780, 16)).toEqual(computeGrid(390, 780, 16));
  });
});
