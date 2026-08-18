import { Circle, Group, Image, Path, Rect, useImage } from '@shopify/react-native-skia';
import type { PowerupKind } from '../engine/types';
import { POWERUP_META } from './powerupMeta';
import { getPowerupSprite } from './propSprites';

interface PowerupGlyphProps {
  kind: PowerupKind;
  /** Center of the glyph in pixels. */
  cx: number;
  cy: number;
  /** Half-extent of the glyph (roughly the pickup radius) in pixels. */
  r: number;
  /**
   * Override the kind's default accent color (defaults to POWERUP_META).
   * Applies to the VECTOR glyph only — the sprite is pre-colored art, so
   * callers needing a custom color should also pass `vector`.
   */
  color?: string;
  /** Force the legacy vector glyph even when the sprite has decoded. */
  vector?: boolean;
}

/**
 * The medallion sprite fills ~78% of its 256px frame, so overdraw the image
 * box slightly to make the visible disc match the old glyph's 2r footprint —
 * this is what keeps the sprite legible at HUD-chip sizes too.
 */
const SPRITE_OVERSCALE = 1.28;

/**
 * The on-board icon for a powerup pickup: the Blender-rendered stone-medallion
 * sprite for the kind (propSprites.ts), drawn to fill the glyph's 2r footprint.
 * The original vector shape (from POWERUP_META's glyph token) remains as the
 * not-yet-decoded fallback and can be forced with the `vector` prop, so HUD
 * chips and the board pickup upgrade together without ever drawing nothing.
 * Vector shapes use SVG path strings rather than imperative path building so
 * they stay declarative and render under the test Skia stub. (Phase 2 powerups)
 */
export function PowerupGlyph({
  kind,
  cx,
  cy,
  r,
  color,
  vector = false,
}: PowerupGlyphProps) {
  const meta = POWERUP_META[kind];
  const c = color ?? meta.color;
  // Hook runs unconditionally to keep hook order stable across mode flips.
  const sprite = useImage(vector ? null : getPowerupSprite(kind));

  if (!vector && sprite) {
    const s = 2 * r * SPRITE_OVERSCALE;
    return (
      <Image
        testID={`powerup-sprite-${kind}`}
        image={sprite}
        x={cx - s / 2}
        y={cy - s / 2}
        width={s}
        height={s}
        fit="contain"
      />
    );
  }

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
