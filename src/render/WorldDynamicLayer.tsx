import { StyleSheet } from 'react-native';
import {
  Canvas,
  Circle,
  Group,
  Image,
  Points,
  RadialGradient,
  Rect,
  RoundedRect,
  useImage,
  vec,
} from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { useDerivedValue } from 'react-native-reanimated';
import type { Cell, PowerupKind, WorldSpec } from '../engine/types';
import { useSkin } from '../skins/SkinProvider';
import { useSettingsStore } from '../state/useSettingsStore';
import { AnimatedSnake } from './AnimatedSnake';
import { BurstField } from './BurstField';
import { mix, withAlpha } from './color';
import { PowerupGlyph } from './PowerupGlyph';
import { POWERUP_META } from './powerupMeta';
import {
  getBonusSprite,
  getFoodSprite,
  getPowerupSprite,
  getWallSprite,
  wallVariant,
} from './propSprites';
import { Snake3DBody } from './Snake3DBody';
import { SnakeHeadSprite } from './SnakeHeadSprite';
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
  /** Cells smashed by WALL_BUSTER this tick; bursts a destruction effect. */
  bustedCells?: Cell[];
  /** Kind grabbed this tick (one-shot); bursts a pickup effect at the head. */
  pickupBanner?: PowerupKind | null;
  /** Speed fraction 0→1; drives the snake's speed glow. */
  glow?: number;
  /** Current tick interval (ms); the snake/camera sub-tick glide duration. */
  tickMs?: number;
}

const EMPTY_CELLS: Cell[] = [];
const EMPTY_POINTS: { x: number; y: number }[] = [];

/** Prop sprite draw sizes, as multiples of cellSize — kept identical to the
 * classic DynamicLayer so both modes read as one game. */
const FOOD_SPRITE_SCALE = 1.35;
const BONUS_SPRITE_SCALE = 1.5;
const WALL_SPRITE_SCALE = 1.18;

/** Idle food pulse: scale 1.0→1.07 on a slow sine so the egg reads alive. */
const FOOD_PULSE_PERIOD_MS = 1400;
const FOOD_PULSE_AMPLITUDE = 0.035;

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
  bustedCells = EMPTY_CELLS,
  pickupBanner = null,
  glow = 0,
  tickMs = 150,
}: WorldDynamicLayerProps) {
  const skin = useSkin();
  const snakeEffect = useSettingsStore((s) => s.snakeEffect);
  const glide = useSnakeGlide(snake, tickMs);
  const camera = useGpsCamera(glide, viewport, world, cellSize);

  // Prop sprites (null until decoded → vector fallbacks below stand in).
  const foodImg = useImage(getFoodSprite());
  const bonusImg = useImage(
    bonusFood != null
      ? powerupKind === 'POINTS'
        ? getBonusSprite()
        : getPowerupSprite(powerupKind)
      : null,
  );
  const wallImgs = [
    useImage(getWallSprite(0)),
    useImage(getWallSprite(1)),
    useImage(getWallSprite(2)),
  ];

  // Subtle idle pulse for the food, driven by the glide's frame clock (the
  // clock this layer already runs for the snake — no extra timer). Guarded so
  // a missing clock simply freezes the scale at rest instead of crashing.
  const clock = glide.clock;
  const foodPulse = useDerivedValue(() => {
    'worklet';
    const now = clock ? clock.value : 0;
    const phase = (now / FOOD_PULSE_PERIOD_MS) * 2 * Math.PI;
    return [
      { scale: 1 + FOOD_PULSE_AMPLITUDE + FOOD_PULSE_AMPLITUDE * Math.sin(phase) },
    ];
  });

  const corner = skin.cellShape === 'rounded' ? cellSize / 4 : 0;
  const inset = skin.cellGap / 2;
  const size = cellSize - skin.cellGap;

  // Absolute world-pixel position of a cell's top-left (camera applies the pan).
  const px = (worldCol: number) => gridOrigin.x + worldCol * cellSize + inset;
  const py = (worldRow: number) => gridOrigin.y + worldRow * cellSize + inset;
  // Absolute world-pixel center of a cell (for effect spawns; camera pans them).
  const center = (cell: Cell) => ({
    x: gridOrigin.x + cell.x * cellSize + cellSize / 2,
    y: gridOrigin.y + cell.y * cellSize + cellSize / 2,
  });
  const bustSpawns = useMemo(
    () => bustedCells.map(center),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bustedCells],
  );
  const headCell = snake[0];
  const pickupSpawns = useMemo(
    () => (pickupBanner != null && headCell ? [center(headCell)] : EMPTY_POINTS),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pickupBanner, headCell],
  );

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
    // Square pickups get generously rounded corners (softer than board cells).
    return (
      <RoundedRect
        key={key}
        x={px(cell.x)}
        y={py(cell.y)}
        width={size}
        height={size}
        r={size * 0.4}
        color={color}
      />
    );
  };

  // Soft radial under-glow beneath a prop sprite: keeps each skin's color
  // identity (and the colorblind hue cue) under the pre-rendered art.
  const underGlow = (cx: number, cy: number, r: number, color: string, key: string) => (
    <Circle key={key} cx={cx} cy={cy} r={r}>
      <RadialGradient
        c={vec(cx, cy)}
        r={r}
        colors={[withAlpha(color, 0.5), withAlpha(color, 0)]}
      />
    </Circle>
  );

  // How the grid reads — same default rule as Board so classic and GPS match:
  // explicit gridStyle wins, else 'lines' when a gridLine color exists.
  const gridStyle = skin.gridStyle ?? (skin.gridLine !== null ? 'lines' : 'none');

  // Overscanned grid lines: world cells spanning [origin-1, origin+extent+1],
  // clamped to world bounds, so a sub-cell pan never reveals an undrawn edge.
  const gridCells: React.ReactNode[] = [];
  if (gridStyle === 'lines' && skin.gridLine !== null) {
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

  // 'dots' marks only INTERIOR world intersections — like Board, dots on the
  // outer world border would just trace the edge back in. Overscanned one cell
  // like the lines (intersections [origin-1, origin+extent+2]) and clamped to
  // the world interior, so cost stays bounded by the viewport.
  const gridDots: { x: number; y: number }[] = [];
  if (gridStyle === 'dots') {
    const colStart = Math.max(1, viewport.originCol - 1);
    const colEnd = Math.min(world.worldColumns - 1, viewport.originCol + viewport.cols + 2);
    const rowStart = Math.max(1, viewport.originRow - 1);
    const rowEnd = Math.min(world.worldRows - 1, viewport.originRow + viewport.rows + 2);
    for (let row = rowStart; row <= rowEnd; row++) {
      for (let col = colStart; col <= colEnd; col++) {
        gridDots.push(vec(gridOrigin.x + col * cellSize, gridOrigin.y + row * cellSize));
      }
    }
  }

  return (
    <Canvas style={StyleSheet.absoluteFill}>
      <Group transform={camera}>
        {gridCells}
        {gridStyle === 'dots' && gridDots.length > 0 && (
          /* Styled identically to Board's dots so both paths read as one game. */
          <Points
            points={gridDots}
            mode="points"
            color={withAlpha(mix(skin.snakeBody, skin.background, 0.45), 0.5)}
            style="stroke"
            strokeWidth={Math.max(1.5, cellSize * 0.07)}
            strokeCap="round"
          />
        )}
        {/* Obstacles: mossy wall sprites (deterministic per-cell variant), or
            the flat cell while the sprite decodes. Only in-viewport cells draw. */}
        {obstacles.filter(inWindow).map((cell, i) => {
          const img = wallImgs[wallVariant(cell.x, cell.y)];
          if (!img) {
            return filledCell(cell, skin.obstacleColor, `o${i}`);
          }
          const s = cellSize * WALL_SPRITE_SCALE;
          const { x: cx, y: cy } = center(cell);
          return (
            <Image
              key={`o${i}`}
              image={img}
              x={cx - s / 2}
              y={cy - s / 2}
              width={s}
              height={s}
              fit="contain"
            />
          );
        })}
        {food !== null &&
          inWindow(food) &&
          (() => {
            if (!foodImg) {
              // Not decoded yet: exactly the flat vector food of old.
              return pickup(food, skin.foodColor, skin.foodShape, 'food');
            }
            const { x: cx, y: cy } = center(food);
            const s = cellSize * FOOD_SPRITE_SCALE;
            return (
              <Group key="food">
                {underGlow(cx, cy, cellSize * 0.85, skin.foodColor, 'food-glow')}
                <Group origin={vec(cx, cy)} transform={foodPulse}>
                  <Image
                    image={foodImg}
                    x={cx - s / 2}
                    y={cy - s / 2}
                    width={s}
                    height={s}
                    fit="contain"
                  />
                </Group>
              </Group>
            );
          })()}
        {bonusFood != null &&
          inWindow(bonusFood) &&
          (() => {
            const cx = gridOrigin.x + bonusFood.x * cellSize + cellSize / 2;
            const cy = gridOrigin.y + bonusFood.y * cellSize + cellSize / 2;
            if (!bonusImg) {
              // Not decoded yet: the vector glyph path, exactly as before.
              return (
                <PowerupGlyph
                  kind={powerupKind}
                  cx={cx}
                  cy={cy}
                  r={size / 2}
                  vector
                />
              );
            }
            const s = cellSize * BONUS_SPRITE_SCALE;
            return (
              <Group key="bonus">
                {underGlow(
                  cx,
                  cy,
                  cellSize * 0.95,
                  POWERUP_META[powerupKind].color,
                  'bonus-glow',
                )}
                <Image
                  image={bonusImg}
                  x={cx - s / 2}
                  y={cy - s / 2}
                  width={s}
                  height={s}
                  fit="contain"
                />
              </Group>
            );
          })()}
        {/* '3d' replaces the flat renderer outright rather than layering over it. */}
        {snakeEffect === 'sprite' ? (
          <>
            <Snake3DBody
              glide={glide}
              cellSize={cellSize}
              origin={gridOrigin}
              glow={glow}
            />
            <SnakeHeadSprite
              glide={glide}
              cellSize={cellSize}
              origin={gridOrigin}
              length={snake.length}
            />
          </>
        ) : (
          <AnimatedSnake
            glide={glide}
            cellSize={cellSize}
            origin={gridOrigin}
            gap={skin.cellGap}
            rounded={/* the snake is always rounded, regardless of board cell shape */ true}
            render={skin.snakeRender}
            effect={snakeEffect}
            boardHeight={viewport.rows * cellSize}
            glow={glow}
            headColor={skin.snakeHead}
            bodyColor={skin.snakeBody}
          />
        )}
        {/* Effects live inside the camera group so they pan with the world. */}
        <BurstField
          spawns={bustSpawns}
          color={POWERUP_META.WALL_BUSTER.color}
          size={cellSize / 3}
        />
        <BurstField
          spawns={pickupSpawns}
          color={pickupBanner ? POWERUP_META[pickupBanner].color : '#fff'}
          size={cellSize / 3}
        />
      </Group>
    </Canvas>
  );
}
