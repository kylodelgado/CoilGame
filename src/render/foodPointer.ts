import type { Cell } from '../engine/types';
import type { Viewport } from './camera';

export interface FoodPointer {
  /** False when the food is inside the viewport (no arrow needed). */
  visible: boolean;
  /**
   * Direction from the head to the food, in SCREEN convention: y grows downward,
   * 0 rad = right, and the angle increases clockwise (so +pi/2 = down, pi = left,
   * -pi/2 = up). Meaningless when visible is false.
   */
  angleRad: number;
}

/** Is the world cell inside the viewport's half-open window? */
function inViewport(cell: Cell, viewport: Viewport): boolean {
  return (
    cell.x >= viewport.originCol &&
    cell.x < viewport.originCol + viewport.cols &&
    cell.y >= viewport.originRow &&
    cell.y < viewport.originRow + viewport.rows
  );
}

/**
 * The GPS HUD pointer toward the food. Hidden (visible=false) when the food is
 * on-screen; otherwise the angle from head to food using the documented screen
 * convention. Pure. (chunk M, step 49)
 */
export function foodPointer(
  head: Cell,
  food: Cell,
  viewport: Viewport,
): FoodPointer {
  if (inViewport(food, viewport)) {
    return { visible: false, angleRad: 0 };
  }
  // Screen coords: y down. atan2(dy, dx) gives 0=right, +pi/2=down, increasing
  // clockwise — exactly the documented convention.
  const angleRad = Math.atan2(food.y - head.y, food.x - head.x);
  return { visible: true, angleRad };
}
