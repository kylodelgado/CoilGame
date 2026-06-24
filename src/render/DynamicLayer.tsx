import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { Canvas, Circle, Rect, RoundedRect } from '@shopify/react-native-skia';
import type { Cell, GridSpec, PowerupKind } from '../engine/types';
import { useSkin } from '../skins/SkinProvider';
import { AnimatedSnake } from './AnimatedSnake';
import { BurstField } from './BurstField';
import { PowerupGlyph } from './PowerupGlyph';
import { POWERUP_META } from './powerupMeta';
import { useSnakeGlide } from './useSnakeGlide';
import { cellRect, type PixelRect } from './geometry';

interface DynamicLayerProps {
  gridSpec: GridSpec;
  snake: Cell[];
  food: Cell | null;
  /** Current tick interval (ms); the snake's sub-tick glide duration. */
  tickMs?: number;
  /** Active bonus/powerup pickup, or null/undefined when none is on the board. */
  bonusFood?: Cell | null;
  /** Kind of the pickup in bonusFood; defaults to POINTS (the classic bonus). */
  powerupKind?: PowerupKind;
  /** Dynamic-walls obstacle cells; empty/undefined for modes without them. */
  obstacles?: Cell[];
  /** Cells smashed by WALL_BUSTER this tick; bursts a destruction effect. */
  bustedCells?: Cell[];
  /** Kind grabbed this tick (one-shot); bursts a pickup effect at the head. */
  pickupBanner?: PowerupKind | null;
  /** Bump to snap the snake (no glide) after a restart/reset. */
  resetKey?: number | string;
}

const EMPTY_CELLS: Cell[] = [];
const EMPTY_POINTS: { x: number; y: number }[] = [];

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
  tickMs = 150,
  bonusFood = null,
  powerupKind = 'POINTS',
  obstacles = [],
  bustedCells = EMPTY_CELLS,
  pickupBanner = null,
  resetKey,
}: DynamicLayerProps) {
  const skin = useSkin();
  const glide = useSnakeGlide(snake, tickMs, resetKey);
  const corner = skin.cellShape === 'rounded' ? gridSpec.cellSize / 4 : 0;

  // Pixel center of a grid cell (for effect spawns).
  const center = (cell: Cell) => {
    const r = cellRect(gridSpec, cell, skin.cellGap);
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  };
  const bustSpawns = useMemo(
    () => bustedCells.map(center),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bustedCells],
  );
  const head = snake[0];
  const pickupSpawns = useMemo(
    () => (pickupBanner != null && head ? [center(head)] : EMPTY_POINTS),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pickupBanner, head],
  );

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
      <AnimatedSnake
        glide={glide}
        cellSize={gridSpec.cellSize}
        origin={{ x: gridSpec.originX, y: gridSpec.originY }}
        gap={skin.cellGap}
        rounded={skin.cellShape === 'rounded'}
        headColor={skin.snakeHead}
        bodyColor={skin.snakeBody}
      />
      {food !== null &&
        pickupNode(food, skin.foodColor, skin.foodShape, 'food')}
      {bonusFood != null &&
        (() => {
          const rect = cellRect(gridSpec, bonusFood, skin.cellGap);
          return (
            <PowerupGlyph
              kind={powerupKind}
              cx={rect.x + rect.width / 2}
              cy={rect.y + rect.height / 2}
              r={Math.min(rect.width, rect.height) / 2}
            />
          );
        })()}
      {/* Destruction shards where WALL_BUSTER smashed walls this tick. */}
      <BurstField
        spawns={bustSpawns}
        color={POWERUP_META.WALL_BUSTER.color}
        size={gridSpec.cellSize / 3}
      />
      {/* A quick flash at the head whenever any powerup is grabbed. */}
      <BurstField
        spawns={pickupSpawns}
        color={pickupBanner ? POWERUP_META[pickupBanner].color : '#fff'}
        size={gridSpec.cellSize / 3}
      />
    </Canvas>
  );
}
