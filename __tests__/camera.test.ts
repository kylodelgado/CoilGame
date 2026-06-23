import { computeViewport, worldToScreen } from '../src/render/camera';
import type { WorldSpec } from '../src/engine/types';

const WORLD: WorldSpec = { worldColumns: 40, worldRows: 40, cellSize: 10 };
const COLS = 12;
const ROWS = 12;

describe('computeViewport', () => {
  it('centers the window on the head in the open world', () => {
    expect(computeViewport({ x: 20, y: 20 }, WORLD, COLS, ROWS)).toEqual({
      originCol: 14, // 20 - floor(12/2)
      originRow: 14,
      cols: 12,
      rows: 12,
    });
  });

  it('clamps at the top-left edge (never negative origin)', () => {
    const v = computeViewport({ x: 0, y: 0 }, WORLD, COLS, ROWS);
    expect(v.originCol).toBe(0);
    expect(v.originRow).toBe(0);
  });

  it('clamps at the bottom-right edge (corner-aligned, never out of bounds)', () => {
    const v = computeViewport({ x: 39, y: 39 }, WORLD, COLS, ROWS);
    // max origin = worldCols - viewportCols = 28.
    expect(v.originCol).toBe(28);
    expect(v.originRow).toBe(28);
    expect(v.originCol + v.cols).toBeLessThanOrEqual(WORLD.worldColumns);
    expect(v.originRow + v.rows).toBeLessThanOrEqual(WORLD.worldRows);
  });

  it('pins to origin 0 when the world is smaller than the viewport', () => {
    const small: WorldSpec = { worldColumns: 8, worldRows: 8, cellSize: 10 };
    const v = computeViewport({ x: 4, y: 4 }, small, COLS, ROWS);
    expect(v.originCol).toBe(0);
    expect(v.originRow).toBe(0);
  });
});

describe('worldToScreen', () => {
  const viewport = { originCol: 14, originRow: 14, cols: COLS, rows: ROWS };
  const origin = { x: 0, y: 0 };

  it('maps an in-view world cell to the right pixel', () => {
    const p = worldToScreen({ x: 20, y: 20 }, viewport, WORLD.cellSize, origin);
    expect(p.onScreen).toBe(true);
    expect(p.x).toBe(60); // local col 6 * 10
    expect(p.y).toBe(60);
  });

  it('honors a non-zero grid origin offset', () => {
    const p = worldToScreen(
      { x: 14, y: 14 },
      viewport,
      WORLD.cellSize,
      { x: 5, y: 8 },
    );
    expect(p).toMatchObject({ onScreen: true, x: 5, y: 8 }); // local (0,0)
  });

  it('flags an out-of-view cell as off-screen', () => {
    expect(
      worldToScreen({ x: 5, y: 5 }, viewport, WORLD.cellSize, origin).onScreen,
    ).toBe(false);
  });

  it('treats the window as half-open [origin, origin+extent)', () => {
    // The last in-window cell is origin + extent - 1.
    expect(
      worldToScreen({ x: 25, y: 25 }, viewport, WORLD.cellSize, origin).onScreen,
    ).toBe(true);
    expect(
      worldToScreen({ x: 26, y: 26 }, viewport, WORLD.cellSize, origin).onScreen,
    ).toBe(false);
  });
});
