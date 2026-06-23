import { StyleSheet } from 'react-native';
import { Canvas, Circle, Rect, RoundedRect } from '@shopify/react-native-skia';
import type { Cell, GridSpec } from '../engine/types';
import { useSkin } from '../skins/SkinProvider';
import { cellRect, type PixelRect } from './geometry';

interface DynamicLayerProps {
  gridSpec: GridSpec;
  snake: Cell[];
  food: Cell | null;
  /** Active bonus pickup, or null/undefined when none is on the board. */
  bonusFood?: Cell | null;
  /** Dynamic-walls obstacle cells; empty/undefined for modes without them. */
  obstacles?: Cell[];
}

/**
 * Dynamic layer: the snake (head in skin.snakeHead, body in the dimmer
 * skin.snakeBody so the head reads brighter), the food, and the bonus pickup
 * (when present) drawn in skin.bonusColor/bonusShape so it reads distinct from
 * regular food. Redrawn from the passed state each render. A pure projection of
 * state — it reads the arrays but never mutates them. All visuals come from the
 * active skin. (EH-12/13)
 */
export function DynamicLayer({
  gridSpec,
  snake,
  food,
  bonusFood = null,
  obstacles = [],
}: DynamicLayerProps) {
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

  // Draw a pickup (food or bonus) honoring its skin shape token.
  const pickupNode = (
    cell: Cell,
    color: string,
    shape: 'square' | 'circle',
    key: string,
  ) => {
    const r = cellRect(gridSpec, cell, skin.cellGap);
    if (shape === 'circle') {
      return (
        <Circle
          key={key}
          cx={r.x + r.width / 2}
          cy={r.y + r.height / 2}
          r={Math.min(r.width, r.height) / 2}
          color={color}
        />
      );
    }
    return cellNode(r, color, key);
  };

  return (
    <Canvas style={StyleSheet.absoluteFill}>
      {/* Obstacles sit beneath the actors as static hazards. */}
      {obstacles.map((cell, i) =>
        cellNode(
          cellRect(gridSpec, cell, skin.cellGap),
          skin.obstacleColor,
          `o${i}`,
        ),
      )}
      {snake.map((cell, i) =>
        cellNode(
          cellRect(gridSpec, cell, skin.cellGap),
          i === 0 ? skin.snakeHead : skin.snakeBody,
          `s${i}`,
        ),
      )}
      {food !== null &&
        pickupNode(food, skin.foodColor, skin.foodShape, 'food')}
      {bonusFood != null &&
        pickupNode(bonusFood, skin.bonusColor, skin.bonusShape, 'bonus')}
    </Canvas>
  );
}
