import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import {
  Canvas,
  Circle,
  Group,
  Image,
  RadialGradient,
  Rect,
  RoundedRect,
  useImage,
  vec,
} from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import type { Cell, GridSpec, PowerupKind } from '../engine/types';
import { useSkin } from '../skins/SkinProvider';
import { useSettingsStore } from '../state/useSettingsStore';
import { AnimatedSnake } from './AnimatedSnake';
import { BurstField } from './BurstField';
import { withAlpha } from './color';
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
  /** Speed fraction 0→1; drives the snake's speed glow. */
  glow?: number;
  /** Bump to snap the snake (no glide) after a restart/reset. */
  resetKey?: number | string;
}

const EMPTY_CELLS: Cell[] = [];
const EMPTY_POINTS: { x: number; y: number }[] = [];

/** Prop sprite draw sizes, as multiples of cellSize (sprites bleed past the
 * cell a little so they read as objects sitting ON the board, not tiles). */
const FOOD_SPRITE_SCALE = 1.35;
const BONUS_SPRITE_SCALE = 1.5;
const WALL_SPRITE_SCALE = 1.18;

/** Idle food pulse: scale 1.0→1.07 on a slow sine so the egg reads alive. */
const FOOD_PULSE_PERIOD_MS = 1400;
const FOOD_PULSE_AMPLITUDE = 0.035;

/**
 * Dynamic layer: the snake (head in skin.snakeHead, body in the dimmer
 * skin.snakeBody so the head reads brighter), the food, and the bonus pickup
 * (when present). Food/bonus/obstacles draw as Blender-rendered prop sprites
 * (propSprites.ts) once decoded — the egg over a foodColor under-glow, the
 * scarab/medallion over a kind-colored under-glow, mossy wall blocks — and
 * fall back to exactly the flat vector shapes while the images decode, so the
 * board is never empty. Redrawn from the passed state each render. A pure
 * projection of state — it reads the arrays but never mutates them. All
 * remaining colors come from the active skin. (EH-12/13, prop sprites)
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
  glow = 0,
  resetKey,
}: DynamicLayerProps) {
  const skin = useSkin();
  const snakeEffect = useSettingsStore((s) => s.snakeEffect);
  const glide = useSnakeGlide(snake, tickMs, resetKey);
  const corner = skin.cellShape === 'rounded' ? gridSpec.cellSize / 4 : 0;

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
    // Square pickups get generously rounded corners (softer than board cells).
    return (
      <RoundedRect
        key={key}
        x={r.x}
        y={r.y}
        width={r.width}
        height={r.height}
        r={Math.min(r.width, r.height) * 0.4}
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

  return (
    <Canvas style={StyleSheet.absoluteFill}>
      {/* Obstacles sit beneath the actors as static hazards. Sprite variant is
          a deterministic hash of the cell, so runs look varied but stable. */}
      {obstacles.map((cell, i) => {
        const r = cellRect(gridSpec, cell, skin.cellGap);
        const img = wallImgs[wallVariant(cell.x, cell.y)];
        if (!img) {
          return cellNode(r, skin.obstacleColor, `o${i}`);
        }
        const s = gridSpec.cellSize * WALL_SPRITE_SCALE;
        return (
          <Image
            key={`o${i}`}
            testID={`wall-sprite-${i}`}
            image={img}
            x={r.x + r.width / 2 - s / 2}
            y={r.y + r.height / 2 - s / 2}
            width={s}
            height={s}
            fit="contain"
          />
        );
      })}
      {/* '3d' replaces the flat renderer outright rather than layering over it. */}
      {snakeEffect === 'sprite' ? (
        <>
          <Snake3DBody
            glide={glide}
            cellSize={gridSpec.cellSize}
            origin={{ x: gridSpec.originX, y: gridSpec.originY }}
            glow={glow}
          />
          <SnakeHeadSprite
            glide={glide}
            cellSize={gridSpec.cellSize}
            origin={{ x: gridSpec.originX, y: gridSpec.originY }}
            length={snake.length}
          />
        </>
      ) : (
        <AnimatedSnake
          glide={glide}
          cellSize={gridSpec.cellSize}
          origin={{ x: gridSpec.originX, y: gridSpec.originY }}
          gap={skin.cellGap}
          rounded={/* the snake is always rounded, regardless of board cell shape */ true}
          render={skin.snakeRender}
          effect={snakeEffect}
          boardHeight={gridSpec.rows * gridSpec.cellSize}
          glow={glow}
          headColor={skin.snakeHead}
          bodyColor={skin.snakeBody}
        />
      )}
      {food !== null &&
        (() => {
          if (!foodImg) {
            // Not decoded yet: exactly the flat vector food of old.
            return pickupNode(food, skin.foodColor, skin.foodShape, 'food');
          }
          const { x: cx, y: cy } = center(food);
          const s = gridSpec.cellSize * FOOD_SPRITE_SCALE;
          return (
            <Group key="food">
              {underGlow(cx, cy, gridSpec.cellSize * 0.85, skin.foodColor, 'food-glow')}
              <Group origin={vec(cx, cy)} transform={foodPulse}>
                <Image
                  testID="food-sprite"
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
        (() => {
          const rect = cellRect(gridSpec, bonusFood, skin.cellGap);
          const cx = rect.x + rect.width / 2;
          const cy = rect.y + rect.height / 2;
          if (!bonusImg) {
            // Not decoded yet: the vector glyph path, exactly as before. The
            // screens-level despawn counter overlays this cell either way.
            return (
              <PowerupGlyph
                kind={powerupKind}
                cx={cx}
                cy={cy}
                r={Math.min(rect.width, rect.height) / 2}
                vector
              />
            );
          }
          const s = gridSpec.cellSize * BONUS_SPRITE_SCALE;
          return (
            <Group key="bonus">
              {underGlow(
                cx,
                cy,
                gridSpec.cellSize * 0.95,
                POWERUP_META[powerupKind].color,
                'bonus-glow',
              )}
              <Image
                testID="bonus-sprite"
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
