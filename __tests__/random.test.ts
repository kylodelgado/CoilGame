import {
  createSeededRandom,
  createMathRandom,
} from '../src/services/RandomPort';

describe('createSeededRandom', () => {
  it('produces an identical next() sequence for the same seed across instances', () => {
    const a = createSeededRandom(12345);
    const b = createSeededRandom(12345);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = createSeededRandom(1);
    const b = createSeededRandom(2);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });

  it('keeps next() within [0, 1)', () => {
    const r = createSeededRandom(99);
    for (let i = 0; i < 1000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('nextInt(n) returns an integer in [0, n) for several n', () => {
    const r = createSeededRandom(7);
    for (const n of [1, 2, 5, 10, 64, 1000]) {
      for (let i = 0; i < 500; i++) {
        const v = r.nextInt(n);
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(n);
      }
    }
  });

  it('nextInt returns 0 for n <= 0', () => {
    const r = createSeededRandom(3);
    expect(r.nextInt(0)).toBe(0);
    expect(r.nextInt(-5)).toBe(0);
  });

  it('nextInt equals floor(next() * n) for a parallel-seeded source', () => {
    const intSource = createSeededRandom(42);
    const floatSource = createSeededRandom(42);
    for (const n of [3, 7, 100]) {
      expect(intSource.nextInt(n)).toBe(Math.floor(floatSource.next() * n));
    }
  });
});

describe('createMathRandom', () => {
  it('keeps next() within [0, 1) over many draws', () => {
    const r = createMathRandom();
    for (let i = 0; i < 1000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('nextInt(n) stays within [0, n)', () => {
    const r = createMathRandom();
    for (let i = 0; i < 1000; i++) {
      const v = r.nextInt(10);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(10);
    }
  });
});
