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

/**
 * The player-facing speed multiplier: how fast the snake moves now relative to
 * its starting pace. 1.0 at baseTickMs, rising as the tick interval shrinks and
 * naturally capping at baseTickMs/minTickMs (tickMs is already clamped). Pure.
 */
export function computeSpeedMultiplier(
  baseTickMs: number,
  tickMs: number,
): number {
  return baseTickMs / tickMs;
}
