import { foodPointer } from '../src/render/foodPointer';
import { computeViewport } from '../src/render/camera';
import type { Cell, WorldSpec } from '../src/engine/types';

const WORLD: WorldSpec = { worldColumns: 40, worldRows: 40, cellSize: 10 };
const HEAD: Cell = { x: 20, y: 20 };
// Window centered on the head: cols/rows 12 => x in [14,26), y in [14,26).
const viewport = computeViewport(HEAD, WORLD, 12, 12);

const HALF_PI = Math.PI / 2;

describe('foodPointer (GPS HUD angle math)', () => {
  it('is hidden when the food is inside the viewport', () => {
    const inside: Cell = { x: 22, y: 21 };
    expect(foodPointer(HEAD, inside, viewport).visible).toBe(false);
  });

  describe('cardinal off-screen food (0=right, +pi/2=down, screen y grows down)', () => {
    it('points right (0) when food is directly right and off-screen', () => {
      const p = foodPointer(HEAD, { x: 32, y: 20 }, viewport);
      expect(p.visible).toBe(true);
      expect(p.angleRad).toBeCloseTo(0);
    });

    it('points down (+pi/2) when food is directly below and off-screen', () => {
      const p = foodPointer(HEAD, { x: 20, y: 32 }, viewport);
      expect(p.visible).toBe(true);
      expect(p.angleRad).toBeCloseTo(HALF_PI);
    });

    it('points left (pi) when food is directly left and off-screen', () => {
      const p = foodPointer(HEAD, { x: 6, y: 20 }, viewport);
      expect(p.visible).toBe(true);
      expect(Math.abs(p.angleRad)).toBeCloseTo(Math.PI); // +pi or -pi
    });

    it('points up (-pi/2) when food is directly above and off-screen', () => {
      const p = foodPointer(HEAD, { x: 20, y: 6 }, viewport);
      expect(p.visible).toBe(true);
      expect(p.angleRad).toBeCloseTo(-HALF_PI);
    });
  });

  it('yields a down-right quadrant angle for diagonal off-screen food', () => {
    const p = foodPointer(HEAD, { x: 35, y: 35 }, viewport);
    expect(p.visible).toBe(true);
    expect(p.angleRad).toBeCloseTo(Math.PI / 4); // equal dx,dy down-right
    expect(p.angleRad).toBeGreaterThan(0);
    expect(p.angleRad).toBeLessThan(HALF_PI);
  });

  it('yields an up-left quadrant angle for diagonal off-screen food', () => {
    const p = foodPointer(HEAD, { x: 5, y: 5 }, viewport);
    expect(p.visible).toBe(true);
    // up-left: dx<0, dy<0 => angle in (-pi, -pi/2)
    expect(p.angleRad).toBeLessThan(-HALF_PI);
    expect(p.angleRad).toBeGreaterThan(-Math.PI);
  });
});
