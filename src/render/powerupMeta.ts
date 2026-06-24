import type { PowerupKind } from '../engine/types';

/** The glyph drawn for a powerup — a simple shape vocabulary, no art assets. */
export type GlyphToken =
  | 'circle'
  | 'horseshoe'
  | 'triangle-down'
  | 'square-min'
  | 'diamond'
  | 'cross';

export interface PowerupMeta {
  /** Short all-caps label for the pickup banner and HUD chip. */
  label: string;
  /** One-line "what it does", shown briefly on pickup. */
  blurb: string;
  /** Accent color for the glyph + HUD chip; distinct per kind. */
  color: string;
  /** Which shape represents this kind. */
  glyph: GlyphToken;
}

/**
 * UI metadata for each powerup kind: label, one-line explanation, accent color,
 * and the shape that stands in for an icon. The board glyphs (PowerupGlyph), the
 * active-effect HUD, and the pickup banner all read from this single table so a
 * kind looks and reads consistently everywhere. (Phase 2 powerups)
 */
export const POWERUP_META: Record<PowerupKind, PowerupMeta> = {
  POINTS: {
    label: 'BONUS',
    blurb: 'Bonus points',
    color: '#FFD54A',
    glyph: 'circle',
  },
  MAGNET: {
    label: 'MAGNET',
    blurb: 'Food comes to you',
    color: '#FF5A5A',
    glyph: 'horseshoe',
  },
  SLOW: {
    label: 'SLOW',
    blurb: 'Slower — permanently',
    color: '#4FA3FF',
    glyph: 'triangle-down',
  },
  SHRINK: {
    label: 'SHRINK',
    blurb: 'Shorter snake',
    color: '#36D399',
    glyph: 'square-min',
  },
  DOUBLE: {
    label: '2× SCORE',
    blurb: 'Double your score',
    color: '#B57BFF',
    glyph: 'diamond',
  },
  WALL_BUSTER: {
    label: 'WALL BUSTER',
    blurb: 'Smashes nearby walls',
    color: '#FF8A3D',
    glyph: 'cross',
  },
};
