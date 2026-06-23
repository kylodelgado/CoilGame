/**
 * Visual design tokens for the board and its actors. Renderers read every color
 * and shape decision from the active Skin (via useSkin) — no hard-coded colors —
 * so new skins drop in for Phase 2 with zero rendering changes. (FR-A4/A5)
 */
export interface Skin {
  id: string;
  /** Board background color. */
  background: string;
  /** Grid line color, or null for no grid lines. */
  gridLine: string | null;
  /** Pixel gap between adjacent cells. */
  cellGap: number;
  cellShape: 'square' | 'rounded';
  /** Snake head color — brighter than the body so it stays locatable. */
  snakeHead: string;
  snakeBody: string;
  foodColor: string;
  foodShape: 'square' | 'circle';
  /** Bonus pickup color — distinct from foodColor so it reads as special. */
  bonusColor: string;
  bonusShape: 'square' | 'circle';
  /** Dynamic-walls obstacle color — reads as a hazard, distinct from the snake. */
  obstacleColor: string;
}
