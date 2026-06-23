/**
 * Speed/acceleration curve. The tick interval shrinks by accelMsPerFood for
 * every food eaten, clamped so it never drops below minTickMs. Monotonic
 * non-increasing in foodEaten. Pure, no side effects. (FR-S2)
 */
export function computeTickMs(
  baseTickMs: number,
  minTickMs: number,
  accelMsPerFood: number,
  foodEaten: number,
): number {
  return Math.max(minTickMs, baseTickMs - accelMsPerFood * foodEaten);
}
