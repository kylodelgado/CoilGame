import { computeSpeedMultiplier, computeTickMs } from '../src/engine/speed';

describe('computeTickMs (FR-S2, exponential approach)', () => {
  const base = 200;
  const min = 90;
  const accel = 5;

  it('returns baseTickMs when no food has been eaten', () => {
    expect(computeTickMs(base, min, accel, 0)).toBe(base);
  });

  it('starts with roughly the accel slope (first food ≈ base - accel)', () => {
    // exp(-accel/range) ≈ 1 - accel/range to first order, so tick(1) ≈ base-accel.
    expect(computeTickMs(base, min, accel, 1)).toBeCloseTo(base - accel, 0);
  });

  it('approaches minTickMs gradually and never drops below it', () => {
    // Large counts get arbitrarily close to min without snapping to it early.
    expect(computeTickMs(base, min, accel, 100000)).toBeCloseTo(min, 5);
    for (let eaten = 0; eaten <= 200; eaten++) {
      expect(computeTickMs(base, min, accel, eaten)).toBeGreaterThanOrEqual(min);
    }
    // Still strictly above min at a moderate count (no hard floor yet).
    expect(computeTickMs(base, min, accel, 20)).toBeGreaterThan(min);
  });

  it('collapses to min when base equals min (degenerate range)', () => {
    expect(computeTickMs(90, 90, 5, 0)).toBe(90);
    expect(computeTickMs(90, 90, 5, 10)).toBe(90);
  });

  it('is monotonically non-increasing over increasing foodEaten', () => {
    let prev = Infinity;
    for (let eaten = 0; eaten <= 80; eaten++) {
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

  it('approaches baseTickMs/minTickMs at top speed', () => {
    const top = computeTickMs(base, min, 5, 100000); // ≈ min
    expect(computeSpeedMultiplier(base, top)).toBeCloseTo(base / min, 3);
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
