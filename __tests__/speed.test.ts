import { computeSpeedMultiplier, computeTickMs } from '../src/engine/speed';

describe('computeTickMs (FR-S2)', () => {
  const base = 200;
  const min = 90;
  const accel = 4;

  it('returns baseTickMs when no food has been eaten', () => {
    expect(computeTickMs(base, min, accel, 0)).toBe(base);
  });

  it('reduces tickMs by accelMsPerFood for each food until the floor', () => {
    expect(computeTickMs(base, min, accel, 1)).toBe(base - accel);
    expect(computeTickMs(base, min, accel, 2)).toBe(base - 2 * accel);
    expect(computeTickMs(base, min, accel, 5)).toBe(base - 5 * accel);
  });

  it('clamps to exactly minTickMs and never lower', () => {
    // The unclamped value reaches min at foodEaten = (base - min) / accel.
    const atFloor = (base - min) / accel; // (200 - 90) / 4 = 27.5
    const past = Math.ceil(atFloor) + 50;
    expect(computeTickMs(base, min, accel, past)).toBe(min);
    // A huge count stays clamped, never below the floor.
    expect(computeTickMs(base, min, accel, 100000)).toBe(min);
  });

  it('lands exactly on minTickMs when the curve meets the floor cleanly', () => {
    // base - accel * n == min  =>  n = (base - min) / accel must be integral.
    // Use base 130, min 90, accel 4 => n = 10.
    expect(computeTickMs(130, 90, 4, 10)).toBe(90);
    expect(computeTickMs(130, 90, 4, 9)).toBe(94);
    expect(computeTickMs(130, 90, 4, 11)).toBe(90);
  });

  it('is monotonically non-increasing over increasing foodEaten', () => {
    let prev = Infinity;
    for (let eaten = 0; eaten <= 60; eaten++) {
      const tick = computeTickMs(base, min, accel, eaten);
      expect(tick).toBeLessThanOrEqual(prev);
      expect(tick).toBeGreaterThanOrEqual(min);
      prev = tick;
    }
  });
});

describe('computeSpeedMultiplier', () => {
  const base = 220;
  const min = 110;

  it('is exactly 1.0 at the starting pace', () => {
    expect(computeSpeedMultiplier(base, base)).toBe(1);
  });

  it('rises as the tick interval shrinks', () => {
    expect(computeSpeedMultiplier(base, 200)).toBeCloseTo(1.1, 5);
    expect(computeSpeedMultiplier(base, 110)).toBe(2); // base/min
  });

  it('tracks the clamp: caps at baseTickMs/minTickMs at top speed', () => {
    const top = computeTickMs(base, min, 4, 100000); // == min
    expect(computeSpeedMultiplier(base, top)).toBe(base / min);
  });

  it('is monotonically non-decreasing as tickMs falls toward min', () => {
    let prev = 0;
    for (let tick = base; tick >= min; tick -= 4) {
      const mult = computeSpeedMultiplier(base, tick);
      expect(mult).toBeGreaterThanOrEqual(prev);
      prev = mult;
    }
  });
});
