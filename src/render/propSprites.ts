import type { PowerupKind } from '../engine/types';

/**
 * Blender-rendered prop sprites for the game board, mapped in the style of
 * boardBackdrops.ts so renderers ask "which asset?" in exactly one place. All
 * assets are 256px top-down WebP renders with alpha, lit to match the snake
 * sprites. Callers decode via useImage and keep the flat vector shape as the
 * not-yet-decoded fallback, so a slow decode never leaves a hole on the board.
 * (prop sprites)
 */

const FOOD = require('../../assets/board/props/food.webp');
const BONUS = require('../../assets/board/props/bonus.webp');
const ARROW = require('../../assets/board/props/arrow.webp');

// Stone medallions with the kind's glowing symbol + ring, colored to
// POWERUP_META. Note the naming seam: WALL_BUSTER → pu_wallbuster.webp.
const POWERUPS: Record<PowerupKind, number> = {
  POINTS: require('../../assets/board/props/pu_points.webp'),
  MAGNET: require('../../assets/board/props/pu_magnet.webp'),
  SLOW: require('../../assets/board/props/pu_slow.webp'),
  SHRINK: require('../../assets/board/props/pu_shrink.webp'),
  DOUBLE: require('../../assets/board/props/pu_double.webp'),
  WALL_BUSTER: require('../../assets/board/props/pu_wallbuster.webp'),
};

/** Three mossy stone silhouettes so runs of wall don't tile visibly. */
const WALLS: [number, number, number] = [
  require('../../assets/board/props/wall_a.webp'),
  require('../../assets/board/props/wall_b.webp'),
  require('../../assets/board/props/wall_c.webp'),
];

export type WallVariant = 0 | 1 | 2;

/** The luminous egg drawn for regular food. */
export function getFoodSprite(): number {
  return FOOD;
}

/** The golden scarab beetle — the classic POINTS bonus pickup. */
export function getBonusSprite(): number {
  return BONUS;
}

/** The stone medallion for a powerup kind (POINTS included, for HUD use). */
export function getPowerupSprite(kind: PowerupKind): number {
  return POWERUPS[kind];
}

/** One of the three wall-block silhouettes. */
export function getWallSprite(variant: WallVariant): number {
  return WALLS[variant];
}

/** The magenta compass needle; its white-hot tip points UP in image space. */
export function getArrowSprite(): number {
  return ARROW;
}

/**
 * Deterministic wall-sprite variant for a grid cell: a small integer hash of
 * (x, y) so a run of wall looks varied but every cell keeps the SAME variant
 * frame to frame (and across re-renders — nothing about it is random).
 */
export function wallVariant(x: number, y: number): WallVariant {
  let h = Math.imul(x | 0, 0x9e3779b1) ^ Math.imul(y | 0, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return ((h >>> 0) % 3) as WallVariant;
}
