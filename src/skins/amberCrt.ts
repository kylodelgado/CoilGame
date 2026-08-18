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
  boardOrganic: true,
  boardBackdrop: true,
  cellGap: 1,
  cellShape: 'square',
  snakeHead: '#FFB000',
  snakeBody: '#A85800',
  snakeRender: 'tube',
  foodColor: '#FFCC33',
  foodShape: 'square',
  bonusColor: '#FFF3C4', // pale amber-white, brighter than the food
  bonusShape: 'circle',
  obstacleColor: '#5C3A00', // dim brown-amber wall
  // Amber phosphor chrome: warm near-black panels, ember borders, and the
  // P3-amber glow as the accent — like the menu screens of a CRT terminal.
  ui: {
    isLight: false,
    surface: '#0B0702',
    surfaceRaised: '#151006',
    border: '#3A2A0C',
    textPrimary: '#FFE9C4',
    textSecondary: '#B08A50',
    accent: '#FFB000',
    onAccent: '#1A0F00',
    danger: '#FF6B4A',
    scrim: 'rgba(10, 5, 0, 0.76)',
  },
};
