import { useEffect, useRef } from 'react';
import { Path, Skia, useClock } from '@shopify/react-native-skia';
import { useDerivedValue, useSharedValue } from 'react-native-reanimated';

interface BurstFieldProps {
  /**
   * Pixel centers to burst. Treated as a one-shot batch: whenever this array
   * reference changes to a non-empty value, a fresh burst spawns at each point.
   * Pass a new array only on the frame the effect should fire (e.g. derived from
   * a one-tick engine signal), and a stable empty array otherwise.
   */
  spawns: { x: number; y: number }[];
  /** Particle color. */
  color: string;
  /** Base particle size in pixels (particles shrink from this to 0). */
  size: number;
}

const DURATION_MS = 450;
const PARTICLES = 6;
const MAX_BURSTS = 64; // safety cap so the field never grows unbounded

/**
 * A fire-and-forget particle burst layer for Skia. Each spawn point throws a ring
 * of small squares outward that shrink and fade over DURATION_MS, on the UI
 * thread via the shared frame clock — a cheap "shatter" used for wall destruction
 * and powerup pickups. Returns Skia nodes (no Canvas) so it can be embedded in an
 * existing canvas or camera group and inherit its transform. (powerup effects)
 */
export function BurstField({ spawns, color, size }: BurstFieldProps) {
  const clock = useClock();
  const bursts = useSharedValue<{ x: number; y: number; t0: number }[]>([]);
  const prevSpawns = useRef(spawns);

  useEffect(() => {
    if (spawns === prevSpawns.current) {
      return;
    }
    prevSpawns.current = spawns;
    if (spawns.length === 0) {
      return;
    }
    const now = clock.value;
    const live = bursts.value.filter((b) => now - b.t0 < DURATION_MS);
    const fresh = spawns.map((s) => ({ x: s.x, y: s.y, t0: now }));
    bursts.value = [...live, ...fresh].slice(-MAX_BURSTS);
  }, [spawns, clock, bursts]);

  const path = useDerivedValue(() => {
    'worklet';
    const p = Skia.Path.Make();
    const now = clock.value;
    for (const b of bursts.value) {
      const t = (now - b.t0) / DURATION_MS;
      if (t < 0 || t >= 1) {
        continue;
      }
      const dist = t * size * 2;
      const s = size * (1 - t);
      // Deterministic per-burst jitter so particles don't all align.
      const seed = b.x * 0.7 + b.y * 1.3;
      for (let k = 0; k < PARTICLES; k++) {
        const angle = (k / PARTICLES) * Math.PI * 2 + seed;
        const cx = b.x + Math.cos(angle) * dist;
        const cy = b.y + Math.sin(angle) * dist;
        p.addRect(Skia.XYWHRect(cx - s / 2, cy - s / 2, s, s));
      }
    }
    return p;
  });

  return <Path path={path} color={color} />;
}
