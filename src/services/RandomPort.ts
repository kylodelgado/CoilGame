/**
 * Injectable source of randomness for the engine. Randomness is never called
 * directly inside game logic — it is passed in via this port so that tests can
 * supply a deterministic, seedable generator while production uses Math.random.
 */
export interface RandomPort {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [0, maxExclusive). Returns 0 when maxExclusive <= 0. */
  nextInt(maxExclusive: number): number;
}

function makePort(next: () => number): RandomPort {
  return {
    next,
    nextInt(maxExclusive: number): number {
      if (maxExclusive <= 0) {
        return 0;
      }
      return Math.floor(next() * maxExclusive);
    },
  };
}

/**
 * Deterministic PRNG (mulberry32): identical seed => identical sequence.
 * This is the generator every later engine test injects.
 */
export function createSeededRandom(seed: number): RandomPort {
  // mulberry32 — keep internal state as an unsigned 32-bit integer.
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return makePort(next);
}

/** Production randomness backed by Math.random. */
export function createMathRandom(): RandomPort {
  return makePort(() => Math.random());
}
