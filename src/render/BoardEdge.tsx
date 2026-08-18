import {
  Group,
  LinearGradient,
  Rect,
  vec,
} from '@shopify/react-native-skia';
import { mix, withAlpha } from './color';

/** Wall behavior the edge treatment communicates. */
export type WallBehavior = 'SOLID' | 'PORTAL';

/**
 * The warm tone SOLID's rim line leans toward: renderers have no theme access,
 * so the danger-ish red lives here and is mixed with the skin's obstacleColor.
 */
const SOLID_EDGE_WARM = '#FF5A48';

/** How far (fraction of obstacleColor → warm) the SOLID rim line is mixed. */
const SOLID_EDGE_MIX = 0.65;

interface BoardEdgeProps {
  /** Board rect in pixels (the playfield, not the whole canvas). */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Cell size drives the inner-shadow depth so density scales the effect. */
  cellSize: number;
  wall: WallBehavior;
  /** skin.obstacleColor — the SOLID rim line mixes this toward warmth. */
  obstacleColor: string;
  /** skin.snakeHead — the PORTAL glow color. */
  headColor: string;
}

/**
 * Board rim treatment that tells the player what the edge DOES before they hit
 * it. SOLID: an inner shadow (edge-dark gradients ~cellSize*0.6 deep) around
 * the whole rim plus a thin warm line — the edge reads heavy, like the wall it
 * is. PORTAL: a soft glow band in the snake's own head color — the edge reads
 * open, suggesting pass-through. Drawn INSIDE a Board/WorldBoard canvas, so it
 * takes plain color props rather than reading hooks/context. (wall edge)
 */
export function BoardEdge({
  x,
  y,
  width,
  height,
  cellSize,
  wall,
  obstacleColor,
  headColor,
}: BoardEdgeProps) {
  if (wall === 'SOLID') {
    const depth = Math.min(cellSize * 0.6, width / 2, height / 2);
    const dark = withAlpha('#000000', 0.38);
    const clear = withAlpha('#000000', 0);
    const line = mix(obstacleColor, SOLID_EDGE_WARM, SOLID_EDGE_MIX);
    return (
      <Group>
        {/* Inner shadow: one edge-dark gradient per side, fading inward. */}
        <Rect testID="edge-shadow-top" x={x} y={y} width={width} height={depth}>
          <LinearGradient
            start={vec(x, y)}
            end={vec(x, y + depth)}
            colors={[dark, clear]}
          />
        </Rect>
        <Rect testID="edge-shadow-bottom" x={x} y={y + height - depth} width={width} height={depth}>
          <LinearGradient
            start={vec(x, y + height)}
            end={vec(x, y + height - depth)}
            colors={[dark, clear]}
          />
        </Rect>
        <Rect testID="edge-shadow-left" x={x} y={y} width={depth} height={height}>
          <LinearGradient
            start={vec(x, y)}
            end={vec(x + depth, y)}
            colors={[dark, clear]}
          />
        </Rect>
        <Rect testID="edge-shadow-right" x={x + width - depth} y={y} width={depth} height={height}>
          <LinearGradient
            start={vec(x + width, y)}
            end={vec(x + width - depth, y)}
            colors={[dark, clear]}
          />
        </Rect>
        {/* Thin warm rim line, fully inside the board (stroke is centered). */}
        <Rect
          testID="edge-solid-line"
          x={x + 0.75}
          y={y + 0.75}
          width={width - 1.5}
          height={height - 1.5}
          color={line}
          style="stroke"
          strokeWidth={1.5}
        />
      </Group>
    );
  }

  // PORTAL: a soft pass-through glow in the snake's head color. The halo is
  // built from concentric strokes that fade outward rather than a Blur node:
  // a Blur child attaches an image filter to the enclosing layer, which washed
  // the whole playfield rather than just the rim.
  const halo = [
    { inset: 7, w: 10, a: 0.06 },
    { inset: 5, w: 7, a: 0.1 },
    { inset: 3, w: 5, a: 0.16 },
  ];
  return (
    <Group>
      {halo.map((h, i) => (
        <Rect
          key={`halo${i}`}
          testID={i === 0 ? 'edge-portal-glow' : undefined}
          x={x + h.inset}
          y={y + h.inset}
          width={width - h.inset * 2}
          height={height - h.inset * 2}
          color={withAlpha(headColor, h.a)}
          style="stroke"
          strokeWidth={h.w}
        />
      ))}
      <Rect
        testID="edge-portal-band"
        x={x + 1.5}
        y={y + 1.5}
        width={width - 3}
        height={height - 3}
        color={withAlpha(headColor, 0.4)}
        style="stroke"
        strokeWidth={3}
      />
    </Group>
  );
}
