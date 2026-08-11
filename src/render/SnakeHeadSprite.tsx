import { Group, Image, useImage } from '@shopify/react-native-skia';
import { useEffect } from 'react';
import { useDerivedValue, useSharedValue } from 'react-native-reanimated';
import type { Cell } from '../engine/types';
import { clamp01, interpCell, segmentFrom } from './interpolate';
import type { SnakeGlide } from './useSnakeGlide';

/**
 * How many grid cells wide the rendered sprite frame is. Must match
 * `head.span_cells` in assets/snake/snake.json — the Blender export renders the
 * head centred in an orthographic frame this many cells across.
 */
const HEAD_SPAN = 2.6;

/**
 * Shift the sprite back along its heading by this many cells so the SNOUT TIP,
 * not the sprite centre, lands on the leading edge of the head cell. Without it
 * the head visually overshoots its own cell by most of a cell, which reads
 * wrong the moment the snake dies against a wall.
 */
const NOSE_OFFSET = 0.26;

/** Bite animation length (ms) and the fraction of it spent opening. */
const CHOMP_MS = 420;
const CHOMP_OPEN = 0.35;

/** Idle tongue flick: one flick at the end of every period. */
const FLICK_PERIOD = 2400;
const FLICK_MS = 620;

/** Frames 0-5 are the gape clip; 6-8 are flick frames 1-3. */
const GAPE_LAST = 5;

/**
 * Pick a frame index for the current time.
 *
 * A chomp overrides everything while it plays; otherwise the head idles with a
 * periodic tongue flick. Flick frame 0 is deliberately omitted — the exporter
 * renders it in the same rest pose as gape frame 0, so index 0 serves both and
 * the two clips can cut into each other without a pop.
 */
export function pickFrame(clock: number, chompStart: number): number {
  'worklet';
  const dt = clock - chompStart;
  if (dt >= 0 && dt < CHOMP_MS) {
    const u = dt / CHOMP_MS;
    const openness =
      u < CHOMP_OPEN ? u / CHOMP_OPEN : 1 - (u - CHOMP_OPEN) / (1 - CHOMP_OPEN);
    return Math.round(clamp01(openness) * GAPE_LAST);
  }
  const p = clock % FLICK_PERIOD;
  const into = p - (FLICK_PERIOD - FLICK_MS);
  if (into > 0) {
    const u = into / FLICK_MS;
    const tri = u < 0.5 ? u / 0.5 : (1 - u) / 0.5;
    const k = Math.round(clamp01(tri) * 3);
    return k === 0 ? 0 : GAPE_LAST + k;
  }
  return 0;
}

interface SnakeHeadSpriteProps {
  /** Shared glide state (clock + endpoints + timing) from useSnakeGlide. */
  glide: SnakeGlide;
  cellSize: number;
  origin: { x: number; y: number };
  /** Snake length; a increase triggers the bite animation. */
  length: number;
}

/**
 * Pre-rendered 3D snake head drawn over the procedural body.
 *
 * The frames come from a straight-down orthographic render in Blender (see
 * art/snakekit.py), which is what makes ONE sprite set enough: nothing in the
 * shading is locked to a heading, so the sprite is simply rotated to face
 * wherever the snake is going rather than needing a set per direction.
 *
 * Position and rotation are derived on the UI thread from the same glide clock
 * the body uses, so the head stays welded to the neck between ticks.
 */
export function SnakeHeadSprite({
  glide,
  cellSize,
  origin,
  length,
}: SnakeHeadSpriteProps) {
  const { clock, from, to, start, duration } = glide;

  const frames = [
    useImage(require('../../assets/snake/head_gape_0.png')),
    useImage(require('../../assets/snake/head_gape_1.png')),
    useImage(require('../../assets/snake/head_gape_2.png')),
    useImage(require('../../assets/snake/head_gape_3.png')),
    useImage(require('../../assets/snake/head_gape_4.png')),
    useImage(require('../../assets/snake/head_gape_5.png')),
    useImage(require('../../assets/snake/head_flick_1.png')),
    useImage(require('../../assets/snake/head_flick_2.png')),
    useImage(require('../../assets/snake/head_flick_3.png')),
  ];

  // Start a chomp whenever the snake grows — i.e. whenever it ate something.
  const chompStart = useSharedValue(-CHOMP_MS);
  const prevLen = useSharedValue(length);
  useEffect(() => {
    if (length > prevLen.value) {
      chompStart.value = clock.value;
    }
    prevLen.value = length;
  }, [length, chompStart, prevLen, clock]);

  const size = HEAD_SPAN * cellSize;

  const transform = useDerivedValue(() => {
    'worklet';
    const t = clamp01((clock.value - start.value) / duration.value);
    const cells = to.value;
    const n = cells.length;
    if (n === 0) {
      return [{ translateX: -9999 }, { translateY: -9999 }, { rotate: 0 }];
    }
    const px = (i: number) => {
      const c = interpCell(segmentFrom(from.value, cells[i], i), cells[i], t);
      return [
        origin.x + (c.x + 0.5) * cellSize,
        origin.y + (c.y + 0.5) * cellSize,
      ];
    };
    const [hx, hy] = px(0);

    // Heading = head minus the segment behind it. A PORTAL wrap puts that
    // segment on the far side of the board, so ignore it and keep the last
    // sane facing rather than spinning the head as the snake wraps.
    let dx = 0;
    let dy = -1;
    if (n > 1) {
      const [bx, by] = px(1);
      const vx = hx - bx;
      const vy = hy - by;
      const lim = cellSize * 1.5;
      if (vx * vx + vy * vy <= lim * lim && (vx !== 0 || vy !== 0)) {
        dx = vx;
        dy = vy;
      }
    }
    return [
      { translateX: hx },
      { translateY: hy },
      // The sprite is authored pointing UP (world +Y == image up), and screen
      // Y grows downward, so a heading of atan2 needs a quarter turn added.
      { rotate: Math.atan2(dy, dx) + Math.PI / 2 },
    ];
  });

  const image = useDerivedValue(() => {
    'worklet';
    return frames[pickFrame(clock.value, chompStart.value)] ?? frames[0];
  });

  // Nothing to draw until the atlas has decoded; the procedural head shows
  // through underneath in the meantime.
  if (!frames[0]) {
    return null;
  }

  return (
    <Group transform={transform}>
      <Image
        image={image}
        x={-size / 2}
        y={-size / 2 + NOSE_OFFSET * cellSize}
        width={size}
        height={size}
        fit="contain"
      />
    </Group>
  );
}
