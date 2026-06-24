import { Circle, Group, Path, Rect } from '@shopify/react-native-skia';
import type { PowerupKind } from '../engine/types';
import { POWERUP_META } from './powerupMeta';

interface PowerupGlyphProps {
  kind: PowerupKind;
  /** Center of the glyph in pixels. */
  cx: number;
  cy: number;
  /** Half-extent of the glyph (roughly the pickup radius) in pixels. */
  r: number;
  /** Override the kind's default accent color (defaults to POWERUP_META). */
  color?: string;
}

/**
 * The on-board icon for a powerup pickup: a simple Skia shape per kind drawn from
 * POWERUP_META's glyph token (no art assets yet — just shapes the player learns).
 * Shapes use SVG path strings rather than imperative path building so they stay
 * declarative and render under the test Skia stub. (Phase 2 powerups)
 */
export function PowerupGlyph({ kind, cx, cy, r, color }: PowerupGlyphProps) {
  const meta = POWERUP_META[kind];
  const c = color ?? meta.color;

  switch (meta.glyph) {
    case 'circle':
      return <Circle cx={cx} cy={cy} r={r} color={c} />;

    case 'diamond':
      return (
        <Path
          path={`M ${cx} ${cy - r} L ${cx + r} ${cy} L ${cx} ${cy + r} L ${cx - r} ${cy} Z`}
          color={c}
        />
      );

    case 'triangle-down':
      return (
        <Path
          path={`M ${cx - r} ${cy - r} L ${cx + r} ${cy - r} L ${cx} ${cy + r} Z`}
          color={c}
        />
      );

    case 'square-min': {
      // A small filled square (about half size) — "make it smaller".
      const s = r;
      return <Rect x={cx - s / 2} y={cy - s / 2} width={s} height={s} color={c} />;
    }

    case 'cross': {
      // A plus sign — "break through".
      const t = r * 0.4;
      return (
        <Group>
          <Rect x={cx - r} y={cy - t} width={2 * r} height={2 * t} color={c} />
          <Rect x={cx - t} y={cy - r} width={2 * t} height={2 * r} color={c} />
        </Group>
      );
    }

    case 'horseshoe': {
      // A "U" magnet: two poles joined by a bottom arc, stroked thick.
      const sw = Math.max(2, r * 0.5);
      return (
        <Path
          path={`M ${cx - r} ${cy - r} L ${cx - r} ${cy} A ${r} ${r} 0 0 0 ${cx + r} ${cy} L ${cx + r} ${cy - r}`}
          color={c}
          style="stroke"
          strokeWidth={sw}
          strokeCap="round"
        />
      );
    }
  }
}
