import {
  SHAPE_TEMPLATES,
  placeShape,
  shapeCells,
  validAnchors,
} from '../src/modes/wallShapes';
import { createSeededRandom } from '../src/services/RandomPort';
import type { Cell, GridSpec } from '../src/engine/types';

const grid: GridSpec = {
  columns: 12,
  rows: 12,
  cellSize: 10,
  originX: 0,
  originY: 0,
};
const key = (c: Cell) => `${c.x},${c.y}`;

describe('shapeCells', () => {
  it('anchors a template and applies the offsets', () => {
    const domino = SHAPE_TEMPLATES[1];
    expect(shapeCells({ x: 3, y: 4 }, domino, 0)).toEqual([
      { x: 3, y: 4 },
      { x: 4, y: 4 },
    ]);
  });

  it('rotates a quarter-turn: a horizontal line becomes vertical', () => {
    const line3 = SHAPE_TEMPLATES[2]; // (0,0),(1,0),(2,0)
    const rotated = shapeCells({ x: 5, y: 5 }, line3, 1); // (x,y)->(-y,x)
    // Offsets become (0,0),(0,1),(0,2) -> a vertical run.
    const xs = new Set(rotated.map((c) => c.x));
    expect(xs.size).toBe(1);
    expect(rotated).toHaveLength(3);
  });
});

describe('validAnchors', () => {
  it('keeps a 2x2 square fully in-bounds (no anchor on the last row/col)', () => {
    const square = SHAPE_TEMPLATES[4];
    const anchors = validAnchors(square, 0, new Set(), grid);
    // A 2x2 at rotation 0 needs x+1<cols and y+1<rows.
    expect(anchors.every((a) => a.x <= grid.columns - 2 && a.y <= grid.rows - 2)).toBe(
      true,
    );
    expect(anchors).toContainEqual({ x: 0, y: 0 });
    expect(anchors).not.toContainEqual({ x: 11, y: 11 });
  });

  it('excludes anchors whose cells fall on blocked squares', () => {
    const domino = SHAPE_TEMPLATES[1];
    const blocked = new Set([4 * grid.columns + 4]); // (4,4) blocked
    const anchors = validAnchors(domino, 0, blocked, grid);
    // (3,4) would cover (3,4)+(4,4) -> blocked; (4,4) covers (4,4) -> blocked.
    expect(anchors).not.toContainEqual({ x: 3, y: 4 });
    expect(anchors).not.toContainEqual({ x: 4, y: 4 });
  });
});

describe('placeShape', () => {
  it('returns a connected, in-bounds, unblocked group of cells', () => {
    const rng = createSeededRandom(42);
    const blocked = new Set<number>();
    const cells = placeShape(blocked, grid, rng);
    expect(cells.length).toBeGreaterThan(0);
    for (const c of cells) {
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.x).toBeLessThan(grid.columns);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeLessThan(grid.rows);
      expect(blocked.has(c.y * grid.columns + c.x)).toBe(false);
    }
    // Cells are distinct.
    expect(new Set(cells.map(key)).size).toBe(cells.length);
  });

  it('falls back to a single cell when no multi-cell shape fits', () => {
    // Block everything except one isolated cell — only a single can be placed.
    const blocked = new Set<number>();
    for (let y = 0; y < grid.rows; y++) {
      for (let x = 0; x < grid.columns; x++) {
        if (!(x === 5 && y === 5)) {
          blocked.add(y * grid.columns + x);
        }
      }
    }
    const cells = placeShape(blocked, grid, createSeededRandom(1));
    expect(cells).toEqual([{ x: 5, y: 5 }]);
  });

  it('returns [] when the board is full', () => {
    const blocked = new Set<number>();
    for (let i = 0; i < grid.columns * grid.rows; i++) blocked.add(i);
    expect(placeShape(blocked, grid, createSeededRandom(1))).toEqual([]);
  });

  it('is deterministic for a fixed seed', () => {
    const run = () => placeShape(new Set(), grid, createSeededRandom(2024)).map(key);
    expect(run()).toEqual(run());
  });
});
