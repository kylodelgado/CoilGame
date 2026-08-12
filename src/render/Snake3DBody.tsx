import {
  Blur,
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
const TEX_CELLS = 3.0;

/** Fallbacks used for the one frame before the texture finishes decoding. */
const TEX_W = 256;
const TEX_H = 768;

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
const RIM = '#0C1816';
/** Dorsal green, for the speed glow's hot mix and the pre-decode fallback. */
const DORSAL = '#6AC189';

/** When the speed glow starts ramping in (fraction of the speed range). */
const GLOW_START = 0.3;

/**
 * Undulation: lateral offset in cells, wavelength in cells, and tailward waves
 * per second, at rest and flat out.
 *
 * Amplitude is deliberately small. The snake has to keep reading as something
 * that occupies grid cells — the player aims it at food a cell at a time — so
 * the wave is there to make the body look driven rather than to actually move
 * it off its line. Past about a tenth of a cell it stops looking like muscle
 * and starts looking like the renderer is out of sync with the grid.
 */
const WAVE_AMP_SLOW = 0.055;
const WAVE_AMP_FAST = 0.10;
const WAVE_LEN_SLOW = 4.2;
const WAVE_LEN_FAST = 3.2;
const WAVE_HZ_SLOW = 0.55;
const WAVE_HZ_FAST = 1.7;
/** Peak muscle swell, as a fraction of body width. */
const WAVE_SWELL = 0.055;

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

  // The snake works harder the faster it goes: a longer, lazier wave when it is
  // crawling, tightening and quickening as it winds up. Tying this to the same
  // `glow` fraction that drives the heat glow means the body's motion and its
  // colour escalate together instead of drifting apart.
  const amp = WAVE_AMP_SLOW + (WAVE_AMP_FAST - WAVE_AMP_SLOW) * glow;
  const wavelength = WAVE_LEN_SLOW + (WAVE_LEN_FAST - WAVE_LEN_SLOW) * glow;
  const hz = WAVE_HZ_SLOW + (WAVE_HZ_FAST - WAVE_HZ_SLOW) * glow;

  // Trace the centreline ONCE per frame; the outline and the mesh share it.
  const spine = useDerivedValue<Spine>(() => {
    'worklet';
    const t = clamp01((clock.value - start.value) / duration.value);
    return computeSpine(from.value, to.value, t, origin, cellSize, {
      clock: clock.value,
      amp,
      wavelength,
      hz,
      swell: WAVE_SWELL,
    });
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
      {/* Contact shadow. Offset down-right and blurred, drawn beneath
          everything else, so the body sits ON the board instead of being
          painted onto it. It is the cheapest depth cue available here and it
          does more for the 3D read than any amount of shading on the tube. */}
      <Path
        path={outline}
        color="rgba(0, 0, 0, 0.34)"
        transform={[
          { translateX: cellSize * 0.10 },
          { translateY: cellSize * 0.13 },
        ]}
      >
        <Blur blur={cellSize * 0.11} />
      </Path>
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
            /* REPEAT, not mirror: every layer of the strip is periodic over the
               tile, so it already joins seamlessly. Mirroring would flip the
               scales' overlap direction on alternate tiles, pointing the skin
               backwards down half the snake. */
            ty="repeat"
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
