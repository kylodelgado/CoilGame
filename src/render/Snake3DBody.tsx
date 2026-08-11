import {
  ImageShader,
  Path,
  Shadow,
  useImage,
  Vertices,
} from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import { mix, toRgb } from './color';
import { clamp01 } from './interpolate';
import {
  computeSpine,
  meshFromSpine,
  tubeFromSpine,
  type Spine,
} from './snakeRibbon';
import type { SnakeGlide } from './useSnakeGlide';

/**
 * Body length, in cells, covered by one tile of the strip texture. Must match
 * `body.strip.cells_long` in assets/snake/snake.json.
 */
const TEX_CELLS = 2.0;

/** Fallbacks used for the one frame before the texture finishes decoding. */
const TEX_W = 192;
const TEX_H = 384;

/**
 * Body half-width in cells. Kept just under the head sprite's neck collar
 * (0.464 cells in the Blender model) so the ribbon always tucks underneath it
 * rather than showing its edges around the jaw.
 */
const BODY_HALF_WIDTH = 0.44;

/**
 * Silhouette colour, sampled from the darkest edge of the Blender render.
 * Drawn as an antialiased path under the mesh: drawVertices has no
 * antialiasing, so without this the body's edge is visibly stair-stepped.
 */
const RIM = '#1E2F2C';
/** Dorsal green, for the speed glow's hot mix and the pre-decode fallback. */
const DORSAL = '#6AC189';

/** When the speed glow starts ramping in (fraction of the speed range). */
const GLOW_START = 0.3;

interface Snake3DBodyProps {
  /** Shared glide state (clock + endpoints + timing) from useSnakeGlide. */
  glide: SnakeGlide;
  cellSize: number;
  origin: { x: number; y: number };
  /** Speed fraction 0→1; the snake heats up and glows brighter as it climbs. */
  glow: number;
}

/**
 * Snake body, surfaced with the Blender render itself.
 *
 * The body is a triangle strip swept along the glide centreline, textured with
 * a strip cropped edge-to-edge from a rendered tube (assets/snake/body_tex.png)
 * — so the scales, the dorsal highlight and the dark flanks are the actual
 * shaded model rather than anything reconstructed in 2D. U spans the tube's
 * full width and V runs with arc length, mirror-tiled, which flows the pattern
 * down the body seamlessly without needing the texture to be periodic.
 *
 * Everything rebuilds per frame on the UI thread from the glide clock.
 */
export function Snake3DBody({
  glide,
  cellSize,
  origin,
  glow,
}: Snake3DBodyProps) {
  const { clock, from, to, start, duration } = glide;
  const tex = useImage(require('../../assets/snake/body_tex.png'));
  const baseHw = cellSize * BODY_HALF_WIDTH;
  const texW = tex ? tex.width() : TEX_W;
  const texH = tex ? tex.height() : TEX_H;

  // Trace the centreline ONCE per frame; the outline and the mesh share it.
  const spine = useDerivedValue<Spine>(() => {
    'worklet';
    const t = clamp01((clock.value - start.value) / duration.value);
    return computeSpine(from.value, to.value, t, origin, cellSize);
  });

  const outline = useDerivedValue(() => {
    'worklet';
    return tubeFromSpine(spine.value, baseHw, 1);
  });

  const mesh = useDerivedValue(() => {
    'worklet';
    return meshFromSpine(
      spine.value,
      baseHw,
      texW,
      texH,
      TEX_CELLS * cellSize,
    );
  });
  const verts = useDerivedValue(() => mesh.value.verts);
  const uvs = useDerivedValue(() => mesh.value.uvs);

  const glowAmt = Math.max(0, Math.min(1, (glow - GLOW_START) / (1 - GLOW_START)));
  const hot = toRgb(mix(DORSAL, '#FF5A1A', glowAmt));
  const glowOmega = (2 * Math.PI) / (900 - 520 * glowAmt);

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
    return `rgba(${hot.r}, ${hot.g}, ${hot.b}, ${0.9 * glowAmt * pulse})`;
  });

  return (
    <>
      <Path path={outline} color={tex ? RIM : DORSAL}>
        {glowAmt > 0.01 && (
          <Shadow dx={0} dy={0} blur={glowBlur} color={glowColor} />
        )}
      </Path>
      {tex && (
        <Vertices mode="triangleStrip" vertices={verts} textures={uvs}>
          <ImageShader
            image={tex}
            tx="clamp"
            ty="mirror"
            fit="none"
            x={0}
            y={0}
            width={texW}
            height={texH}
          />
        </Vertices>
      )}
    </>
  );
}
