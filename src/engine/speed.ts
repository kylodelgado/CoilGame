/**
 * Speed/acceleration curve. The tick interval eases from baseTickMs toward
 * minTickMs as food is eaten, following an exponential approach:
 *
 *   tickMs = min + (base - min) * exp(-accel * foodEaten / (base - min))
 *
 * The initial slope is exactly accelMsPerFood (so a single food still speeds you
 * up by ~that much at the start), but instead of snapping into the floor after a
 * fixed count, it approaches max speed gradually and never quite hits it — so
 * acceleration feels steady and the run never plateaus abruptly. Monotonic
 * non-increasing in foodEaten, always >= minTickMs. Pure. (FR-S2)
 */
export function computeTickMs(
  baseTickMs: number,
  minTickMs: number,
  accelMsPerFood: number,
  foodEaten: number,
): number {
  const range = baseTickMs - minTickMs;
  if (range <= 0) {
    return minTickMs;
  }
  const eased = minTickMs + range * Math.exp((-accelMsPerFood * foodEaten) / range);
  return Math.max(minTickMs, eased);
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
