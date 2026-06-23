import type { Skin } from './Skin';

/**
 * Amber-on-black CRT skin, evoking vintage amber phosphor monitors (P3 amber,
 * ~#FFB000). The head is a bright amber (#FFB000) over a dimmer ember body
 * (#A85800) so it stays locatable; food is a hot amber-white (#FFCC33). Grid
 * lines are a faint dark amber. All tokens are documented hex values. (Prompt 31)
 */
export const amberCrt: Skin = {
  id: 'amberCrt',
  background: '#0A0500',
  gridLine: '#1F1400',
  cellGap: 1,
  cellShape: 'square',
  snakeHead: '#FFB000',
  snakeBody: '#A85800',
  foodColor: '#FFCC33',
  foodShape: 'square',
};
