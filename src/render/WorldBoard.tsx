import { memo } from 'react';
import { StyleSheet } from 'react-native';
import { Canvas, Fill, Group, Rect, RoundedRect } from '@shopify/react-native-skia';
import { useSkin } from '../skins/SkinProvider';
import type { Viewport } from './camera';

interface WorldBoardProps {
  viewport: Viewport;
  cellSize: number;
  /** Pixel origin of the viewport on screen. */
  gridOrigin: { x: number; y: number };
}

/**
 * Static board layer for GPS mode: the background fill plus (optionally) grid
 * lines for just the cells inside the visible window. Unlike Board it draws the
 * fixed-size viewport grid (cols×rows), not the whole world, so the cost stays
 * bounded regardless of world size. A pure projection of viewport + skin. (chunk M)
 */
function WorldBoardComponent({ viewport, cellSize, gridOrigin }: WorldBoardProps) {
  const skin = useSkin();
  const corner = skin.cellShape === 'rounded' ? cellSize / 4 : 0;
  const inset = skin.cellGap / 2;
  const size = cellSize - skin.cellGap;

  const cells: React.ReactNode[] = [];
  if (skin.gridLine !== null) {
    for (let row = 0; row < viewport.rows; row++) {
      for (let col = 0; col < viewport.cols; col++) {
        const x = gridOrigin.x + col * cellSize + inset;
        const y = gridOrigin.y + row * cellSize + inset;
        const key = `${col},${row}`;
        cells.push(
          skin.cellShape === 'rounded' ? (
            <RoundedRect
              key={key}
              x={x}
              y={y}
              width={size}
              height={size}
              r={corner}
              color={skin.gridLine}
              style="stroke"
              strokeWidth={1}
            />
          ) : (
            <Rect
              key={key}
              x={x}
              y={y}
              width={size}
              height={size}
              color={skin.gridLine}
              style="stroke"
              strokeWidth={1}
            />
          ),
        );
      }
    }
  }

  return (
    <Canvas style={StyleSheet.absoluteFill}>
      <Fill color={skin.background} />
      <Group>{cells}</Group>
    </Canvas>
  );
}

export const WorldBoard = memo(WorldBoardComponent);
