import { StyleSheet } from 'react-native';
import { Canvas, Circle, Rect, RoundedRect } from '@shopify/react-native-skia';
import type { Cell, GridSpec } from '../engine/types';
import { useSkin } from '../skins/SkinProvider';
import { cellRect, type PixelRect } from './geometry';

interface DynamicLayerProps {
  gridSpec: GridSpec;
  snake: Cell[];
  food: Cell | null;
}

/**
 * Dynamic layer: the snake (head in skin.snakeHead, body in the dimmer
 * skin.snakeBody so the head reads brighter) and the food, redrawn from the
 * passed state each render. A pure projection of state — it reads the array but
 * never mutates it. All visuals come from the active skin. (EH-12/13)
 */
export function DynamicLayer({ gridSpec, snake, food }: DynamicLayerProps) {
  const skin = useSkin();
  const corner = skin.cellShape === 'rounded' ? gridSpec.cellSize / 4 : 0;

  const cellNode = (r: PixelRect, color: string, key: string) =>
    skin.cellShape === 'rounded' ? (
      <RoundedRect
        key={key}
        x={r.x}
        y={r.y}
        width={r.width}
        height={r.height}
        r={corner}
        color={color}
      />
    ) : (
      <Rect
        key={key}
        x={r.x}
        y={r.y}
        width={r.width}
        height={r.height}
        color={color}
      />
    );

  return (
    <Canvas style={StyleSheet.absoluteFill}>
      {snake.map((cell, i) =>
        cellNode(
          cellRect(gridSpec, cell, skin.cellGap),
          i === 0 ? skin.snakeHead : skin.snakeBody,
          `s${i}`,
        ),
      )}
      {food !== null &&
        (() => {
          const r = cellRect(gridSpec, food, skin.cellGap);
          if (skin.foodShape === 'circle') {
            return (
              <Circle
                cx={r.x + r.width / 2}
                cy={r.y + r.height / 2}
                r={Math.min(r.width, r.height) / 2}
                color={skin.foodColor}
              />
            );
          }
          return cellNode(r, skin.foodColor, 'food');
        })()}
    </Canvas>
  );
}
