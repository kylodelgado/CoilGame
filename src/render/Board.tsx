import { memo } from 'react';
import { StyleSheet } from 'react-native';
import { Canvas, Fill, Group, Rect, RoundedRect } from '@shopify/react-native-skia';
import type { GridSpec } from '../engine/types';
import { useSkin } from '../skins/SkinProvider';
import { cellRect } from './geometry';

interface BoardProps {
  gridSpec: GridSpec;
}

/**
 * Static board layer: the background fill plus (optionally) per-cell grid lines.
 * Depends only on gridSpec + skin, so it is memoized and redraws only when the
 * board is resized or the skin changes — keeping the Dense preset cheap. All
 * colors/shapes/gaps come from the active skin; nothing is hard-coded. A pure
 * projection: it never touches game state. (EH-12/13)
 */
function BoardComponent({ gridSpec }: BoardProps) {
  const skin = useSkin();
  const { columns, rows } = gridSpec;
  const corner = skin.cellShape === 'rounded' ? gridSpec.cellSize / 4 : 0;

  const cells: React.ReactNode[] = [];
  if (skin.gridLine !== null) {
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

  return (
    <Canvas style={StyleSheet.absoluteFill}>
      <Fill color={skin.background} />
      <Group>{cells}</Group>
    </Canvas>
  );
}

export const Board = memo(BoardComponent);
