import type { Skin } from './Skin';

/**
 * The MVP skin: classic green-on-black. The head (#7CFC00, bright "lawn green")
 * reads visibly brighter than the dimmer body (#2E8B22) so the player can always
 * find it; food is green and cells are square with a small gap. Delivered
 * through the skin system so Phase 2 skins need no renderer changes. (FR-A4/A5)
 *
 * The board is the organic treatment rather than ruled lines: a near-black
 * moss ground with a soft pool of light and only faint dots marking the cell
 * intersections. gridLine is kept for renderers that still stroke cells (the
 * GPS world board), but the main board reads as an environment, not graph
 * paper.
 */
export const greenOnBlack: Skin = {
  id: 'greenOnBlack',
  background: '#060D08',
  gridLine: '#0A1F0A',
  gridStyle: 'dots',
  boardOrganic: true,
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
