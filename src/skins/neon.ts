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
  boardOrganic: true,
  boardBackdrop: true,
  cellGap: 2,
  cellShape: 'rounded',
  snakeHead: '#00FFFF',
  snakeBody: '#0A8A8A',
  // Wrapped segments: independent, squeezing, tapered (like every skin now).
  snakeRender: 'tube',
  foodColor: '#FF2EC4',
  foodShape: 'circle',
  bonusColor: '#FFE600', // electric yellow, contrasts the magenta food
  bonusShape: 'square',
  obstacleColor: '#6A4BA6', // muted purple wall on the near-black field
  // Synthwave chrome: indigo-black layered panels with electric-cyan glow —
  // the closest to the "premium arcade hardware" brand look.
  ui: {
    isLight: false,
    surface: '#0B0B12',
    surfaceRaised: '#141422',
    border: '#2A2A4A',
    textPrimary: '#EDEDF7',
    textSecondary: '#8C8CB4',
    accent: '#00FFFF',
    onAccent: '#001416',
    danger: '#FF3B5C',
    scrim: 'rgba(4, 4, 14, 0.76)',
  },
};
