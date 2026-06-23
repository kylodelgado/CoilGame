import type { Skin } from './Skin';

/**
 * Neon skin: bright synthwave accents on a near-black background (#0B0B12). The
 * head is electric cyan (#00FFFF) over a dimmer teal body (#0A8A8A) so it pops;
 * food is hot magenta (#FF2EC4) drawn as a circle. Grid lines are a deep indigo.
 * All tokens are documented hex values. (Prompt 31)
 */
export const neon: Skin = {
  id: 'neon',
  background: '#0B0B12',
  gridLine: '#1A1A33',
  cellGap: 1,
  cellShape: 'rounded',
  snakeHead: '#00FFFF',
  snakeBody: '#0A8A8A',
  foodColor: '#FF2EC4',
  foodShape: 'circle',
  bonusColor: '#FFE600', // electric yellow, contrasts the magenta food
  bonusShape: 'square',
  obstacleColor: '#6A4BA6', // muted purple wall on the near-black field
};
