import { memo } from 'react';
import { StyleSheet } from 'react-native';
import {
  Canvas,
  Fill,
  FractalNoise,
  Group,
  Image,
  Points,
  RadialGradient,
  Rect,
  RoundedRect,
  useImage,
  vec,
} from '@shopify/react-native-skia';
import type { GridSpec } from '../engine/types';
import { useSkin } from '../skins/SkinProvider';
import { darken, mix, withAlpha } from './color';
import { cellRect } from './geometry';

interface BoardProps {
  gridSpec: GridSpec;
}

/**
 * Static board layer: the background plus the grid treatment the skin asks
 * for. Depends only on gridSpec + skin, so it is memoized and redraws only
 * when the board is resized or the skin changes — keeping the Dense preset
 * cheap. All colors/shapes/gaps come from the active skin; nothing is
 * hard-coded. A pure projection: it never touches game state. (EH-12/13)
 *
 * With `boardOrganic` the flat fill becomes an environment: a soft pool of
 * light in the middle of the board (tinted faintly toward the snake's own
 * color so the palette stays coherent), falling off to darker edges, with a
 * whisper of noise grain so large flat areas don't band. The grid then only
 * needs to be a hint — `gridStyle: 'dots'` marks the interior intersections
 * and nothing else, which keeps cells aimable without ruling the board into
 * graph paper.
 */
function BoardComponent({ gridSpec }: BoardProps) {
  const skin = useSkin();
  const { columns, rows, cellSize, originX, originY } = gridSpec;
  const corner = skin.cellShape === 'rounded' ? cellSize / 4 : 0;
  const gridStyle = skin.gridStyle ?? (skin.gridLine !== null ? 'lines' : 'none');
  const boardW = columns * cellSize;
  const boardH = rows * cellSize;
  // Decoded lazily; until then the boardOrganic gradient below stands in.
  const backdrop = useImage(require('../../assets/board/backdrop.png'));
  const showBackdrop = Boolean(skin.boardBackdrop && backdrop);

  const cells: React.ReactNode[] = [];
  if (gridStyle === 'lines' && skin.gridLine !== null) {
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < columns; x++) {
        const r = cellRect(gridSpec, { x, y }, skin.cellGap);
        const key = `${x},${y}`;
        cells.push(
          skin.cellShape === 'rounded' ? (
            <RoundedRect
              key={key}
              x={r.x}
              y={r.y}
              width={r.width}
              height={r.height}
              r={corner}
              color={skin.gridLine}
              style="stroke"
              strokeWidth={1}
            />
          ) : (
            <Rect
              key={key}
              x={r.x}
              y={r.y}
              width={r.width}
              height={r.height}
              color={skin.gridLine}
              style="stroke"
              strokeWidth={1}
            />
          ),
        );
      }
    }
  }

  // Interior intersections only: dots on the outer border would just trace
  // the board's edge back in and reintroduce the frame the style removes.
  const dots: { x: number; y: number }[] = [];
  if (gridStyle === 'dots') {
    for (let y = 1; y < rows; y++) {
      for (let x = 1; x < columns; x++) {
        dots.push(vec(originX + x * cellSize, originY + y * cellSize));
      }
    }
  }

  return (
    <Canvas style={StyleSheet.absoluteFill}>
      <Fill color={skin.background} />
      {showBackdrop && (
        /* The Blender-rendered ground: pool of light and vignette are baked
           into the image, so nothing else needs compositing on top of it. */
        <Image
          image={backdrop}
          x={originX}
          y={originY}
          width={boardW}
          height={boardH}
          fit="cover"
        />
      )}
      {skin.boardOrganic && !showBackdrop && (
        <>
          {/* Pool of light: centre tinted toward the snake's color, edges
              pulled darker than the base so the board has depth before
              anything moves on it. */}
          <Rect x={originX} y={originY} width={boardW} height={boardH}>
            <RadialGradient
              c={vec(originX + boardW / 2, originY + boardH / 2)}
              r={Math.max(boardW, boardH) * 0.72}
              colors={[
                mix(skin.background, skin.snakeBody, 0.14),
                mix(skin.background, skin.snakeBody, 0.05),
                darken(skin.background, 0.35),
              ]}
              positions={[0, 0.55, 1]}
            />
          </Rect>
          {/* Grain kills the banding a smooth gradient gets on OLED blacks;
              at this opacity it reads as texture, not noise. */}
          <Group opacity={0.05}>
            <Rect x={originX} y={originY} width={boardW} height={boardH}>
              <FractalNoise freqX={0.9} freqY={0.9} octaves={2} />
            </Rect>
          </Group>
        </>
      )}
      {gridStyle === 'lines' && <Group>{cells}</Group>}
      {gridStyle === 'dots' && dots.length > 0 && (
        <Points
          points={dots}
          mode="points"
          color={withAlpha(mix(skin.snakeBody, skin.background, 0.45), 0.5)}
          style="stroke"
          strokeWidth={Math.max(1.5, cellSize * 0.07)}
          strokeCap="round"
        />
      )}
    </Canvas>
  );
}

export const Board = memo(BoardComponent);
