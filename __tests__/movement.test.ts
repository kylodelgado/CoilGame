import { computeNextHead, resolveWall } from '../src/engine/movement';
import type { Cell, GridSpec } from '../src/engine/types';

const grid: GridSpec = {
  columns: 10,
  rows: 8,
  cellSize: 10,
  originX: 0,
  originY: 0,
};

describe('computeNextHead (FR-D2)', () => {
  const head: Cell = { x: 5, y: 4 };

  it('moves one cell in each direction', () => {
    expect(computeNextHead(head, 'UP')).toEqual({ x: 5, y: 3 });
    expect(computeNextHead(head, 'DOWN')).toEqual({ x: 5, y: 5 });
    expect(computeNextHead(head, 'LEFT')).toEqual({ x: 4, y: 4 });
    expect(computeNextHead(head, 'RIGHT')).toEqual({ x: 6, y: 4 });
  });

  it('does not mutate the input head', () => {
    const original: Cell = { x: 5, y: 4 };
    computeNextHead(original, 'UP');
    expect(original).toEqual({ x: 5, y: 4 });
  });
});

describe('resolveWall PORTAL (FR-M2)', () => {
  it('wraps across each of the four edges', () => {
    // Left edge: x = -1 -> columns - 1.
    expect(resolveWall({ x: -1, y: 3 }, grid, 'PORTAL')).toEqual({
      kind: 'IN_BOUNDS',
      cell: { x: grid.columns - 1, y: 3 },
    });
    // Right edge: x = columns -> 0.
    expect(resolveWall({ x: grid.columns, y: 3 }, grid, 'PORTAL')).toEqual({
      kind: 'IN_BOUNDS',
      cell: { x: 0, y: 3 },
    });
    // Top edge: y = -1 -> rows - 1.
    expect(resolveWall({ x: 4, y: -1 }, grid, 'PORTAL')).toEqual({
      kind: 'IN_BOUNDS',
      cell: { x: 4, y: grid.rows - 1 },
    });
    // Bottom edge: y = rows -> 0.
    expect(resolveWall({ x: 4, y: grid.rows }, grid, 'PORTAL')).toEqual({
      kind: 'IN_BOUNDS',
      cell: { x: 4, y: 0 },
    });
  });

  it('leaves an interior cell unchanged', () => {
    expect(resolveWall({ x: 5, y: 4 }, grid, 'PORTAL')).toEqual({
      kind: 'IN_BOUNDS',
      cell: { x: 5, y: 4 },
    });
  });
});

describe('resolveWall SOLID (FR-M2)', () => {
  it('flags OUT_OF_BOUNDS stepping off each of the four edges', () => {
    expect(resolveWall({ x: -1, y: 3 }, grid, 'SOLID')).toEqual({
      kind: 'OUT_OF_BOUNDS',
    });
    expect(resolveWall({ x: grid.columns, y: 3 }, grid, 'SOLID')).toEqual({
      kind: 'OUT_OF_BOUNDS',
    });
    expect(resolveWall({ x: 4, y: -1 }, grid, 'SOLID')).toEqual({
      kind: 'OUT_OF_BOUNDS',
    });
    expect(resolveWall({ x: 4, y: grid.rows }, grid, 'SOLID')).toEqual({
      kind: 'OUT_OF_BOUNDS',
    });
  });

  it('returns IN_BOUNDS for an interior step', () => {
    expect(resolveWall({ x: 0, y: 0 }, grid, 'SOLID')).toEqual({
      kind: 'IN_BOUNDS',
      cell: { x: 0, y: 0 },
    });
    expect(
      resolveWall({ x: grid.columns - 1, y: grid.rows - 1 }, grid, 'SOLID'),
    ).toEqual({
      kind: 'IN_BOUNDS',
      cell: { x: grid.columns - 1, y: grid.rows - 1 },
    });
  });
});
