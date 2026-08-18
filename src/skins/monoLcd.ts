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
  boardOrganic: true,
  boardBackdrop: true,
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
  // LIGHT skin: the pale DMG green is the surface, so ALL text/icon tokens are
  // the dark inks — this is what keeps menus readable on the light background
  // (no #eee-on-green, no white pause glyph). Accent is the darkest ink.
  ui: {
    isLight: true,
    surface: '#9BBC0F',
    surfaceRaised: '#8BAC0F',
    border: '#306230',
    textPrimary: '#0F380F',
    textSecondary: '#2E5A2E',
    accent: '#0F380F',
    onAccent: '#9BBC0F',
    danger: '#7A2418',
    scrim: 'rgba(15, 56, 15, 0.60)',
  },
};
