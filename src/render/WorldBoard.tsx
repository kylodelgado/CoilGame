import { memo } from 'react';
import { StyleSheet } from 'react-native';
import {
  Canvas,
  Fill,
  FractalNoise,
  Group,
  Image,
  RadialGradient,
  Rect,
  useImage,
  vec,
} from '@shopify/react-native-skia';
import { useSkin } from '../skins/SkinProvider';
import { getBoardBackdropSource } from './boardBackdrops';
import { BoardEdge, type WallBehavior } from './BoardEdge';
import { darken, mix } from './color';
import type { Viewport } from './camera';

interface WorldBoardProps {
  viewport: Viewport;
  cellSize: number;
  /** Pixel origin of the viewport on screen. */
  gridOrigin: { x: number; y: number };
  /**
   * Wall behavior of the current mode, rendered as a rim treatment around the
   * viewport (screen-locked, like the backdrop) so the mode's edge rule reads
   * ambiently in GPS play too: SOLID = inner shadow + thin warm line, PORTAL =
   * soft head-color glow. Undefined (the default) draws none. (wall edge)
   */
  wall?: WallBehavior;
}

/**
 * Background layer for GPS mode: the skin background plus the same ground
 * treatment the classic Board gets — the pre-rendered backdrop image when the
 * skin asks for it (boardBackdrop), with the boardOrganic radial-light
 * gradient standing in while the image decodes (and standing alone for skins
 * with no mapped backdrop). The grid and actors live in WorldDynamicLayer's
 * camera group above this. A pure projection of the active skin. (smooth GPS)
 *
 * ANCHORING: the backdrop/gradient is locked to the VIEWPORT RECT (screen
 * space), not to world coordinates. The smooth camera pan is a per-frame
 * worklet transform inside WorldDynamicLayer's canvas, which this static
 * layer cannot share; anchoring to the snapped per-tick viewport instead
 * would make the image jump a whole cell every tick. Screen-locking is also
 * what reads best here: the backdrop's content is lighting (pool of light +
 * vignette baked in), and because the GPS camera keeps the head centered, a
 * viewport-fixed pool of light stays centered on the action — the same
 * "light where play happens" the classic board has.
 */
function WorldBoardComponent({ viewport, cellSize, gridOrigin, wall }: WorldBoardProps) {
  const skin = useSkin();
  const width = viewport.cols * cellSize;
  const height = viewport.rows * cellSize;
  const { x, y } = gridOrigin;
  // Which backdrop this skin uses (null = none mapped → organic fallback only).
  const backdropSource = getBoardBackdropSource(skin.id);
  // Decoded lazily; until then the boardOrganic gradient below stands in.
  const backdrop = useImage(backdropSource);
  const showBackdrop = Boolean(
    skin.boardBackdrop && backdropSource !== null && backdrop,
  );

  return (
    <Canvas style={StyleSheet.absoluteFill}>
      <Fill color={skin.background} />
      {showBackdrop && (
        /* The Blender-rendered ground: pool of light and vignette are baked
           into the image, so nothing else needs compositing on top of it. */
        <Image image={backdrop} x={x} y={y} width={width} height={height} fit="cover" />
      )}
      {skin.boardOrganic && !showBackdrop && (
        <>
          {/* Pool of light: centre tinted toward the snake's color, edges
              pulled darker than the base — mirrors Board's organic treatment
              so classic and GPS read as the same game. */}
          <Rect x={x} y={y} width={width} height={height}>
            <RadialGradient
              c={vec(x + width / 2, y + height / 2)}
              r={Math.max(width, height) * 0.72}
              colors={[
                mix(skin.background, skin.snakeBody, 0.14),
                mix(skin.background, skin.snakeBody, 0.05),
                darken(skin.background, 0.35),
              ]}
              positions={[0, 0.55, 1]}
            />
          </Rect>
          {/* Grain kills the banding a smooth gradient gets on OLED blacks. */}
          <Group opacity={0.05}>
            <Rect x={x} y={y} width={width} height={height}>
              <FractalNoise freqX={0.9} freqY={0.9} octaves={2} />
            </Rect>
          </Group>
        </>
      )}
      {wall !== undefined && (
        /* Rim last, over the backdrop, so the edge cue always reads. */
        <BoardEdge
          x={x}
          y={y}
          width={width}
          height={height}
          cellSize={cellSize}
          wall={wall}
          obstacleColor={skin.obstacleColor}
          headColor={skin.snakeHead}
        />
      )}
    </Canvas>
  );
}

export const WorldBoard = memo(WorldBoardComponent);
