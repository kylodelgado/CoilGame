import type { Skin } from './Skin';

/**
 * The MVP skin: classic green-on-black. The head (#7CFC00, bright "lawn green")
 * reads visibly brighter than the dimmer body (#2E8B22) so the player can always
 * find it; food is green, cells are square with a small gap, and grid lines are
 * a faint dark green. Delivered through the skin system so Phase 2 skins need no
 * renderer changes. (FR-A4/A5)
 */
export const greenOnBlack: Skin = {
  id: 'greenOnBlack',
  background: '#000000',
  gridLine: '#0A1F0A',
  cellGap: 1,
  cellShape: 'square',
  snakeHead: '#7CFC00',
  snakeBody: '#2E8B22',
  snakeRender: 'tube',
  foodColor: '#39FF14',
  foodShape: 'square',
  bonusColor: '#FFD300', // bright golden yellow, pops against the green palette
  bonusShape: 'circle',
  obstacleColor: '#555555', // neutral grey wall, clearly not snake or food
};
