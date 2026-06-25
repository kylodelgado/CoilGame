import type { Skin } from './Skin';

/**
 * Dark-on-grey Game Boy LCD skin, using the classic DMG green-grey palette
 * (lightest #9BBC0F, light #8BAC0F, dark #306230, darkest #0F380F). The board is
 * the pale LCD green; the snake head is the darkest ink (#0F380F) over a slightly
 * lighter body (#306230) so the head still reads darker/denser; food uses the
 * mid dark (#306230) as a circle. All tokens are documented hex values. (Prompt 31)
 */
export const monoLcd: Skin = {
  id: 'monoLcd',
  background: '#9BBC0F',
  gridLine: '#8BAC0F',
  cellGap: 1,
  cellShape: 'square',
  snakeHead: '#0F380F',
  snakeBody: '#306230',
  snakeRender: 'tube',
  foodColor: '#0F380F',
  foodShape: 'circle',
  bonusColor: '#306230', // mid green ring, distinct from the darkest-ink food
  bonusShape: 'square',
  obstacleColor: '#5A7A3A', // muted olive wall against the pale LCD green
};
