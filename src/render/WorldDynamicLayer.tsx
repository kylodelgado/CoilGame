import { StyleSheet } from 'react-native';
import {
  Canvas,
  Circle,
  Rect,
  RoundedRect,
} from '@shopify/react-native-skia';
import type { Cell } from '../engine/types';
import { useSkin } from '../skins/SkinProvider';
import { worldToScreen, type Viewport } from './camera';

interface WorldDynamicLayerProps {
  viewport: Viewport;
  cellSize: number;
  gridOrigin: { x: number; y: number };
  /** All actor positions in WORLD coordinates. */
  snake: Cell[];
  food: Cell | null;
  bonusFood?: Cell | null;
  obstacles?: Cell[];
}

/**
 * Dynamic layer for GPS mode: the snake, food, bonus, and obstacles drawn at
 * their WORLD positions translated into the viewport via worldToScreen. Entities
 * outside the visible window are skipped entirely (the HUD arrow handles
 * off-screen food). A pure projection reading only the active skin. (chunk M)
 */
export function WorldDynamicLayer({
  viewport,
  cellSize,
  gridOrigin,
  snake,
  food,
  bonusFood = null,
  obstacles = [],
}: WorldDynamicLayerProps) {
  const skin = useSkin();
  const corner = skin.cellShape === 'rounded' ? cellSize / 4 : 0;
  const inset = skin.cellGap / 2;
  const size = cellSize - skin.cellGap;

  // Draw a filled cell at a world position, or nothing when off-screen.
  const cellNode = (cell: Cell, color: string, key: string) => {
    const p = worldToScreen(cell, viewport, cellSize, gridOrigin);
    if (!p.onScreen) {
      return null;
    }
    const x = p.x + inset;
    const y = p.y + inset;
    return skin.cellShape === 'rounded' ? (
      <RoundedRect key={key} x={x} y={y} width={size} height={size} r={corner} color={color} />
    ) : (
      <Rect key={key} x={x} y={y} width={size} height={size} color={color} />
    );
  };

  // Draw a pickup honoring its skin shape, or nothing when off-screen.
  const pickupNode = (
    cell: Cell,
    color: string,
    shape: 'square' | 'circle',
    key: string,
  ) => {
    const p = worldToScreen(cell, viewport, cellSize, gridOrigin);
    if (!p.onScreen) {
      return null;
    }
    if (shape === 'circle') {
      return (
        <Circle
          key={key}
          cx={p.x + cellSize / 2}
          cy={p.y + cellSize / 2}
          r={size / 2}
          color={color}
        />
      );
    }
    return cellNode(cell, color, key);
  };

  return (
    <Canvas style={StyleSheet.absoluteFill}>
      {obstacles.map((cell, i) => cellNode(cell, skin.obstacleColor, `o${i}`))}
      {snake.map((cell, i) =>
        cellNode(cell, i === 0 ? skin.snakeHead : skin.snakeBody, `s${i}`),
      )}
      {food !== null && pickupNode(food, skin.foodColor, skin.foodShape, 'food')}
      {bonusFood != null &&
        pickupNode(bonusFood, skin.bonusColor, skin.bonusShape, 'bonus')}
    </Canvas>
  );
}
