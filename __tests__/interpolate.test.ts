import {
  clamp01,
  interpCell,
  isWrap,
  lerp,
  segmentFrom,
} from '../src/render/interpolate';
import type { Cell } from '../src/engine/types';

describe('lerp / clamp01', () => {
  it('lerps linearly between endpoints', () => {
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
    expect(lerp(2, 6, 0.5)).toBe(4);
  });

  it('clamps t into [0,1]', () => {
    expect(clamp01(-0.3)).toBe(0);
    expect(clamp01(0.4)).toBe(0.4);
    expect(clamp01(1.7)).toBe(1);
  });
});

describe('segmentFrom', () => {
  const prev: Cell[] = [
    { x: 5, y: 5 }, // head
    { x: 4, y: 5 },
    { x: 3, y: 5 }, // tail
  ];

  it('maps each index to the cell it occupied last tick', () => {
    expect(segmentFrom(prev, { x: 6, y: 5 }, 0)).toEqual({ x: 5, y: 5 });
    expect(segmentFrom(prev, { x: 5, y: 5 }, 1)).toEqual({ x: 4, y: 5 });
  });

  it('emerges a grown tail segment from the old tail (stays put)', () => {
    // The snake grew: new index 3 has no prev[3]; it starts at the old tail.
    expect(segmentFrom(prev, { x: 3, y: 5 }, 3)).toEqual({ x: 3, y: 5 });
  });

  it('is a no-op glide when there is no previous frame', () => {
    const to = { x: 7, y: 2 };
    expect(segmentFrom([], to, 0)).toBe(to);
  });
});

describe('isWrap', () => {
  it('flags edge-to-edge jumps as wraps', () => {
    expect(isWrap({ x: 0, y: 3 }, { x: 9, y: 3 })).toBe(true);
    expect(isWrap({ x: 4, y: 9 }, { x: 4, y: 0 })).toBe(true);
  });

  it('treats adjacent steps as non-wraps', () => {
    expect(isWrap({ x: 4, y: 3 }, { x: 5, y: 3 })).toBe(false);
    expect(isWrap({ x: 4, y: 3 }, { x: 4, y: 3 })).toBe(false);
  });
});

describe('interpCell', () => {
  it('lerps a normal adjacent step', () => {
    expect(interpCell({ x: 4, y: 3 }, { x: 5, y: 3 }, 0.5)).toEqual({
      x: 4.5,
      y: 3,
    });
  });

  it('snaps a wrap to the source before midpoint and the dest after', () => {
    const from = { x: 0, y: 3 };
    const to = { x: 9, y: 3 };
    expect(interpCell(from, to, 0.25)).toEqual({ x: 0, y: 3 });
    expect(interpCell(from, to, 0.75)).toEqual({ x: 9, y: 3 });
  });
});
