import { LinearGradient, Path, Shadow, Skia, vec } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import type { SnakeEffect } from '../engine/types';
import { darken, lighten, mix, toRgb, withAlpha } from './color';
import { clamp01 } from './interpolate';
import {
  buildScales,
  buildSegmentsPath,
  buildShimmer,
  buildTaperedGroup,
  GROUP_BODY,
  GROUP_HEAD,
  GROUP_TAIL,
} from './snakeRibbon';
import type { SnakeGlide } from './useSnakeGlide';

interface AnimatedSnakeProps {
  /** Shared glide state (clock + endpoints + timing) from useSnakeGlide. */
  glide: SnakeGlide;
  cellSize: number;
  origin: { x: number; y: number };
  gap: number;
  rounded: boolean;
  /** 'tube' = wrapped independent segments; 'segments' = axis-aligned retro. */
  render: 'tube' | 'segments';
  /** Body texture/effect (temporary, switchable in Settings). */
  effect: SnakeEffect;
  /** Visible board height (px) for the top-lit gloss gradient. */
  boardHeight: number;
  /** Speed fraction 0→1; the snake heats up and glows brighter as it climbs. */
  glow: number;
  headColor: string;
  bodyColor: string;
}

/** When the speed glow starts ramping in (fraction of the speed range). */
const GLOW_START = 0.3;

/**
 * Continuous-glide snake renderer. The body is a chain of independent segments
 * that wrap around corners (see buildTaperedGroup/appendSmoothRibbon); the
 * trailing segments taper in width and shade into a darker tail; and a
 * switchable body effect (gloss/scales/outline/shimmer) overlays on top. All
 * geometry rebuilds every frame on the UI thread via the glide's Reanimated
 * clock; colors/shades are derived on the JS thread. A pure projection of the
 * glide state. (smooth movement + texture)
 */
export function AnimatedSnake({
  glide,
  cellSize,
  origin,
  gap,
  rounded,
  render,
  effect,
  boardHeight,
  glow,
  headColor,
  bodyColor,
}: AnimatedSnakeProps) {
  const { clock, from, to, start, duration } = glide;
  const wrapped = render === 'tube';
  const segGap = wrapped ? Math.max(gap, cellSize * 0.12) : gap;
  const inset = gap / 2;
  const size = cellSize - gap;
  const corner = rounded ? cellSize / 4 : 0;

  // Speed glow: ramps in past GLOW_START. Its halo PULSES — breathing in and out
  // via the clock — with the pulse growing stronger and faster as speed climbs,
  // and heating from the head color toward hot orange. (dynamic speed glow)
  const glowAmt = Math.max(0, Math.min(1, (glow - GLOW_START) / (1 - GLOW_START)));
  const hot = toRgb(mix(headColor, '#FF5A1A', glowAmt));
  // Angular speed of the pulse (rad/ms): faster near top speed.
  const glowOmega = (2 * Math.PI) / (900 - 520 * glowAmt);

  // Derived shades (JS thread).
  const tailColor = darken(bodyColor, 0.34);
  const outlineBody = darken(bodyColor, 0.55);
  const outlineHead = darken(headColor, 0.5);
  const outlineTail = darken(tailColor, 0.5);
  const scaleColor = darken(bodyColor, 0.32);
  const shimmerColor = withAlpha(lighten(bodyColor, 0.75), 0.5);
  const gy0 = origin.y;
  const gy1 = origin.y + boardHeight;

  const headPath = useDerivedValue(() => {
    'worklet';
    const t = clamp01((clock.value - start.value) / duration.value);
    return wrapped
      ? buildTaperedGroup(from.value, to.value, t, origin, cellSize, segGap, rounded, GROUP_HEAD)
      : buildSegmentsPath(from.value, to.value, t, 0, 1, origin, cellSize, inset, size, corner);
  });

  const bodyPath = useDerivedValue(() => {
    'worklet';
    const t = clamp01((clock.value - start.value) / duration.value);
    return wrapped
      ? buildTaperedGroup(from.value, to.value, t, origin, cellSize, segGap, rounded, GROUP_BODY)
      : buildSegmentsPath(from.value, to.value, t, 1, to.value.length, origin, cellSize, inset, size, corner);
  });

  const tailPath = useDerivedValue(() => {
    'worklet';
    const t = clamp01((clock.value - start.value) / duration.value);
    return wrapped
      ? buildTaperedGroup(from.value, to.value, t, origin, cellSize, segGap, rounded, GROUP_TAIL)
      : Skia.Path.Make();
  });

  const fxPath = useDerivedValue(() => {
    'worklet';
    const t = clamp01((clock.value - start.value) / duration.value);
    if (wrapped && effect === 'scales') {
      return buildScales(from.value, to.value, t, origin, cellSize, segGap);
    }
    if (wrapped && effect === 'shimmer') {
      return buildShimmer(from.value, to.value, t, clock.value, origin, cellSize, segGap, rounded);
    }
    return Skia.Path.Make();
  });

  // Pulsing glow halo (UI thread): blur + alpha breathe via the clock, scaled by
  // glowAmt so it fades to nothing at low speed and pulses hard near top speed.
  const glowBlur = useDerivedValue(() => {
    'worklet';
    if (glowAmt <= 0.01) {
      return 0;
    }
    const pulse = 0.5 + 0.5 * Math.sin(clock.value * glowOmega);
    return glowAmt * cellSize * (0.25 + 0.7 * pulse);
  });
  const glowColor = useDerivedValue(() => {
    'worklet';
    const pulse = 0.5 + 0.5 * Math.sin(clock.value * glowOmega);
    const a = 0.9 * glowAmt * pulse;
    return `rgba(${hot.r}, ${hot.g}, ${hot.b}, ${a})`;
  });
  const glowNode =
    glowAmt > 0.01 ? (
      <Shadow dx={0} dy={0} blur={glowBlur} color={glowColor} />
    ) : null;

  // Segments (retro) mode: plain body + head (glow still applies), no taper/fx.
  if (!wrapped) {
    return (
      <>
        <Path path={bodyPath} color={bodyColor}>
          {glowNode}
        </Path>
        <Path path={headPath} color={headColor}>
          {glowNode}
        </Path>
      </>
    );
  }

  const fill = (
    p: ReturnType<typeof useDerivedValue<ReturnType<typeof Skia.Path.Make>>>,
    color: string,
    key: string,
  ) => {
    if (effect === 'gloss') {
      return (
        <Path key={key} path={p}>
          {glowNode}
          <LinearGradient
            start={vec(0, gy0)}
            end={vec(0, gy1)}
            colors={[lighten(color, 0.45), color, darken(color, 0.32)]}
          />
        </Path>
      );
    }
    return (
      <Path key={key} path={p} color={color}>
        {glowNode}
      </Path>
    );
  };

  const outlineWidth = Math.max(1.5, cellSize * 0.07);

  return (
    <>
      {fill(bodyPath, bodyColor, 'body')}
      {fill(tailPath, tailColor, 'tail')}
      {fill(headPath, headColor, 'head')}

      {effect === 'outline' && (
        <>
          <Path path={bodyPath} color={outlineBody} style="stroke" strokeWidth={outlineWidth} strokeJoin="round" />
          <Path path={tailPath} color={outlineTail} style="stroke" strokeWidth={outlineWidth} strokeJoin="round" />
          <Path path={headPath} color={outlineHead} style="stroke" strokeWidth={outlineWidth} strokeJoin="round" />
        </>
      )}

      {effect === 'scales' && (
        <Path
          path={fxPath}
          color={scaleColor}
          style="stroke"
          strokeWidth={Math.max(1, cellSize * 0.06)}
          strokeJoin="round"
          strokeCap="round"
        />
      )}

      {effect === 'shimmer' && <Path path={fxPath} color={shimmerColor} />}
    </>
  );
}
