import { StyleSheet } from 'react-native';
import {
  Canvas,
  Circle,
  Group,
  Rect,
  RoundedRect,
} from '@shopify/react-native-skia';
import type { Cell, PowerupKind, WorldSpec } from '../engine/types';
import { useSkin } from '../skins/SkinProvider';
import { AnimatedSnake } from './AnimatedSnake';
import { PowerupGlyph } from './PowerupGlyph';
import type { Viewport } from './camera';
import { useGpsCamera } from './useGpsCamera';
import { useSnakeGlide } from './useSnakeGlide';

interface WorldDynamicLayerProps {
  viewport: Viewport;
  world: WorldSpec;
  cellSize: number;
  gridOrigin: { x: number; y: number };
  /** All actor positions in WORLD coordinates. */
  snake: Cell[];
  food: Cell | null;
  bonusFood?: Cell | null;
  /** Kind of the pickup in bonusFood; defaults to POINTS (the classic bonus). */
  powerupKind?: PowerupKind;
  obstacles?: Cell[];
  /** Current tick interval (ms); the snake/camera sub-tick glide duration. */
  tickMs?: number;
}

/**
 * The GPS scene: the world grid, obstacles, food/bonus, and the gliding snake,
 * all drawn at ABSOLUTE world-pixel coordinates inside one camera <Group> whose
 * translate is the smooth, head-following pan (useGpsCamera). Because grid and
 * actors share that single transform they pan together in lockstep, so the world
 * slides smoothly beneath a centered head instead of snapping each tick. The
 * grid is drawn one cell beyond the viewport on each side (overscan) so no edge
 * is exposed mid-pan; cost stays bounded by the viewport, not the world. The
 * background fill is the separate WorldBoard layer beneath this. (smooth GPS)
 */
export function WorldDynamicLayer({
  viewport,
  world,
  cellSize,
  gridOrigin,
  snake,
  food,
  bonusFood = null,
  powerupKind = 'POINTS',
  obstacles = [],
  tickMs = 150,
}: WorldDynamicLayerProps) {
  const skin = useSkin();
  const glide = useSnakeGlide(snake, tickMs);
  const camera = useGpsCamera(glide, viewport, world, cellSize);

  const corner = skin.cellShape === 'rounded' ? cellSize / 4 : 0;
  const inset = skin.cellGap / 2;
  const size = cellSize - skin.cellGap;

  // Absolute world-pixel position of a cell's top-left (camera applies the pan).
  const px = (worldCol: number) => gridOrigin.x + worldCol * cellSize + inset;
  const py = (worldRow: number) => gridOrigin.y + worldRow * cellSize + inset;

  // Is a world cell within the (slightly padded) visible window? Static actors
  // outside it are skipped so a large world stays cheap.
  const inWindow = (cell: Cell): boolean =>
    cell.x >= viewport.originCol - 1 &&
    cell.x <= viewport.originCol + viewport.cols + 1 &&
    cell.y >= viewport.originRow - 1 &&
    cell.y <= viewport.originRow + viewport.rows + 1;

  const filledCell = (cell: Cell, color: string, key: string) =>
    skin.cellShape === 'rounded' ? (
      <RoundedRect
        key={key}
        x={px(cell.x)}
        y={py(cell.y)}
        width={size}
        height={size}
        r={corner}
        color={color}
      />
    ) : (
      <Rect key={key} x={px(cell.x)} y={py(cell.y)} width={size} height={size} color={color} />
    );

  const pickup = (
    cell: Cell,
    color: string,
    shape: 'square' | 'circle',
    key: string,
  ) => {
    if (shape === 'circle') {
      return (
        <Circle
          key={key}
          cx={gridOrigin.x + cell.x * cellSize + cellSize / 2}
          cy={gridOrigin.y + cell.y * cellSize + cellSize / 2}
          r={size / 2}
          color={color}
        />
      );
    }
    return filledCell(cell, color, key);
  };

  // Overscanned grid lines: world cells spanning [origin-1, origin+extent+1],
  // clamped to world bounds, so a sub-cell pan never reveals an undrawn edge.
  const gridCells: React.ReactNode[] = [];
  if (skin.gridLine !== null) {
    const colStart = Math.max(0, viewport.originCol - 1);
    const colEnd = Math.min(world.worldColumns - 1, viewport.originCol + viewport.cols + 1);
    const rowStart = Math.max(0, viewport.originRow - 1);
    const rowEnd = Math.min(world.worldRows - 1, viewport.originRow + viewport.rows + 1);
    for (let row = rowStart; row <= rowEnd; row++) {
      for (let col = colStart; col <= colEnd; col++) {
        const key = `g${col},${row}`;
        gridCells.push(
          skin.cellShape === 'rounded' ? (
            <RoundedRect
              key={key}
              x={px(col)}
              y={py(row)}
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
              x={px(col)}
              y={py(row)}
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
      <Group transform={camera}>
        {gridCells}
        {obstacles
          .filter(inWindow)
          .map((cell, i) => filledCell(cell, skin.obstacleColor, `o${i}`))}
        {food !== null &&
          inWindow(food) &&
          pickup(food, skin.foodColor, skin.foodShape, 'food')}
        {bonusFood != null && inWindow(bonusFood) && (
          <PowerupGlyph
            kind={powerupKind}
            cx={gridOrigin.x + bonusFood.x * cellSize + cellSize / 2}
            cy={gridOrigin.y + bonusFood.y * cellSize + cellSize / 2}
            r={size / 2}
          />
        )}
        <AnimatedSnake
          glide={glide}
          cellSize={cellSize}
          origin={gridOrigin}
          gap={skin.cellGap}
          rounded={skin.cellShape === 'rounded'}
          headColor={skin.snakeHead}
          bodyColor={skin.snakeBody}
        />
      </Group>
    </Canvas>
  );
}
