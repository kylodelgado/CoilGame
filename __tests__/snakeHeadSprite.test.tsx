import { act, render } from '@testing-library/react-native';
import { DynamicLayer } from '../src/render/DynamicLayer';
import { Snake3DBody } from '../src/render/Snake3DBody';
import {
  computeSpine,
  meshFromSpine,
  tubeFromSpine,
} from '../src/render/snakeRibbon';
import { pickFrame, SnakeHeadSprite } from '../src/render/SnakeHeadSprite';
import { SkinProvider } from '../src/skins/SkinProvider';
import { useSettingsStore } from '../src/state/useSettingsStore';
import type { SnakeGlide } from '../src/render/useSnakeGlide';
import type { Cell, GridSpec } from '../src/engine/types';

// Skia + Reanimated are stubbed globally in jest.setup.js.

const GRID: GridSpec = {
  columns: 16,
  rows: 20,
  cellSize: 18,
  originX: 6,
  originY: 40,
};

const snake = (n: number): Cell[] =>
  Array.from({ length: n }, (_, i) => ({ x: 5 - i, y: 5 }));

const wrap = (node: React.ReactElement) =>
  render(<SkinProvider>{node}</SkinProvider>);

/** Minimal stand-in for the shared-value glide state. */
const makeGlide = (cells: Cell[]): SnakeGlide =>
  ({
    clock: { value: 0 },
    from: { value: cells },
    to: { value: cells },
    start: { value: 0 },
    duration: { value: 150 },
  }) as unknown as SnakeGlide;

const glide = makeGlide(snake(3));

describe('SnakeHeadSprite frame selection', () => {
  it('rests on frame 0 outside a chomp and outside the flick window', () => {
    expect(pickFrame(1000, -10_000)).toBe(0);
  });

  it('opens to the widest gape partway into a chomp, then closes back', () => {
    // CHOMP_MS is 420 and the opening phase is the first 35% of it.
    const peak = pickFrame(0.35 * 420, 0);
    expect(peak).toBe(5);
    expect(pickFrame(0, 0)).toBe(0);
    expect(pickFrame(419, 0)).toBe(0);
  });

  it('never selects a frame outside the exported set', () => {
    for (let t = 0; t < 6000; t += 7) {
      const f = pickFrame(t, 1000);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(8);
    }
  });

  it('flicks the tongue while idle, using the flick frames', () => {
    // FLICK_PERIOD 2400, FLICK_MS 620 -> the window ends the period, and the
    // flick peaks halfway through it.
    const mid = 2400 - 620 / 2;
    expect(pickFrame(mid, -10_000)).toBeGreaterThan(5);
  });

  it('a chomp overrides the idle flick', () => {
    const mid = 2400 - 620 / 2;
    expect(pickFrame(mid, mid)).toBe(0); // chomp just started -> mouth shut
    expect(pickFrame(mid + 0.35 * 420, mid)).toBe(5);
  });
});

describe('continuous body spine', () => {
  const trace = (cells: Cell[]) =>
    computeSpine(cells, cells, 1, { x: 0, y: 0 }, 20);

  it('traces one unbroken run for a contiguous snake', () => {
    const sp = trace(snake(6));
    expect(sp.runStart).toEqual([0]);
    expect(sp.runEnd[0]).toBe(sp.xs.length - 1);
    // Endpoints plus SPINE_K samples for each of the 4 interior cells.
    expect(sp.xs.length).toBeGreaterThan(6);
  });

  it('splits into separate runs across a PORTAL wrap', () => {
    // A jump from x=0 to x=15 is a wrap, not a step.
    const wrapped: Cell[] = [
      { x: 1, y: 5 },
      { x: 0, y: 5 },
      { x: 15, y: 5 },
      { x: 14, y: 5 },
    ];
    const sp = trace(wrapped);
    expect(sp.runStart.length).toBe(2);
    // Nothing streaks across the board: each run stays on its own side.
    for (let r = 0; r < 2; r++) {
      const span = sp.xs[sp.runEnd[r]] - sp.xs[sp.runStart[r]];
      expect(Math.abs(span)).toBeLessThan(20 * 3);
    }
  });

  it('narrows at BOTH ends — under the head and out to the tail tip', () => {
    const sp = trace(snake(12));
    const head = sp.wf[0];
    const mid = sp.wf[Math.floor(sp.wf.length / 2)];
    const tail = sp.wf[sp.wf.length - 1];
    expect(head).toBeLessThan(0.45); // hidden under the head sprite
    expect(mid).toBeCloseTo(1, 1);
    expect(tail).toBeLessThan(0.5);
    expect(tail).toBeLessThan(mid);
  });

  it('keeps unit-length frames so the offsets stay the intended width', () => {
    const sp = trace(snake(8));
    for (let k = 0; k < sp.xs.length; k++) {
      expect(Math.hypot(sp.nxs[k], sp.nys[k])).toBeCloseTo(1, 5);
      expect(Math.hypot(sp.txs[k], sp.tys[k])).toBeCloseTo(1, 5);
    }
  });

  it('builds exactly one closed outline per run, and nothing when empty', () => {
    const one = tubeFromSpine(trace(snake(5)), 9, 1) as unknown as {
      ops: { op: string }[];
    };
    expect(one.ops.filter((o) => o.op === 'moveTo')).toHaveLength(1);
    expect(one.ops.filter((o) => o.op === 'close')).toHaveLength(1);

    const wrapped: Cell[] = [
      { x: 1, y: 5 },
      { x: 0, y: 5 },
      { x: 15, y: 5 },
      { x: 14, y: 5 },
    ];
    const two = tubeFromSpine(trace(wrapped), 9, 1) as unknown as {
      ops: { op: string }[];
    };
    expect(two.ops.filter((o) => o.op === 'close')).toHaveLength(2);

    const empty = tubeFromSpine(trace([]), 9, 1) as unknown as {
      isEmpty(): boolean;
    };
    expect(empty.isEmpty()).toBe(true);
  });

  it('runs the tail past the last cell so it ends in a point', () => {
    const sp = trace(snake(10));
    expect(sp.wf[sp.wf.length - 1]).toBeCloseTo(0, 3);
    // The extension continues beyond the last cell centre.
    const lastCellX = 0 + (5 - 9 + 0.5) * 20;
    expect(sp.xs[sp.xs.length - 1]).toBeLessThan(lastCellX);
  });

  it('accumulates arc length monotonically, without jumping across a wrap', () => {
    const wrapped: Cell[] = [
      { x: 1, y: 5 },
      { x: 0, y: 5 },
      { x: 15, y: 5 },
      { x: 14, y: 5 },
    ];
    const sp = trace(wrapped);
    for (let k = 1; k < sp.arc.length; k++) {
      expect(sp.arc[k]).toBeGreaterThanOrEqual(sp.arc[k - 1]);
    }
    // The 15-cell portal jump must not be counted as body length.
    expect(sp.arc[sp.arc.length - 1]).toBeLessThan(20 * 6);
  });

  it('builds a strip of two vertices per sample with edge-to-edge UVs', () => {
    const sp = trace(snake(6));
    const { verts, uvs } = meshFromSpine(sp, 9, 192, 384, 40);
    expect(verts).toHaveLength(uvs.length);
    expect(verts.length).toBe((sp.runEnd[0] - sp.runStart[0] + 1) * 2);
    // U alternates between the texture's two edges; V never runs backwards.
    for (let k = 0; k < uvs.length; k += 2) {
      expect(uvs[k].x).toBe(0);
      expect(uvs[k + 1].x).toBe(192);
      expect(uvs[k + 1].y).toBeCloseTo(uvs[k].y, 6);
    }
  });

  it('stitches runs with duplicate vertices so one strip spans a wrap', () => {
    const wrapped: Cell[] = [
      { x: 1, y: 5 },
      { x: 0, y: 5 },
      { x: 15, y: 5 },
      { x: 14, y: 5 },
    ];
    const sp = trace(wrapped);
    const { verts } = meshFromSpine(sp, 9, 192, 384, 40);
    const perRun = sp.runStart.map((s, r) => (sp.runEnd[r] - s + 1) * 2);
    // Two extra (degenerate) vertices bridge the two runs.
    expect(verts.length).toBe(perRun[0] + perRun[1] + 2);
  });

  it('emits no mesh at all for an empty snake', () => {
    const { verts, uvs } = meshFromSpine(trace([]), 9, 192, 384, 40);
    expect(verts).toHaveLength(0);
    expect(uvs).toHaveLength(0);
  });

  it('survives a single-cell snake by capping it as a disc', () => {
    const sp = trace([{ x: 3, y: 3 }]);
    expect(sp.runStart).toEqual([0]);
    expect(sp.runEnd).toEqual([0]);
    const path = tubeFromSpine(sp, 9, 1) as unknown as { ops: { op: string }[] };
    expect(path.ops.map((o) => o.op)).toEqual(['addCircle']);
  });
});

describe('SnakeHeadSprite mounting', () => {
  it('mounts standalone', () => {
    expect(() =>
      wrap(
        <SnakeHeadSprite
          glide={glide}
          cellSize={GRID.cellSize}
          origin={{ x: GRID.originX, y: GRID.originY }}
          length={3}
        />,
      ),
    ).not.toThrow();
  });

  it('mounts with an empty snake without crashing', () => {
    const empty = makeGlide([]);
    expect(() =>
      wrap(
        <SnakeHeadSprite
          glide={empty}
          cellSize={GRID.cellSize}
          origin={{ x: 0, y: 0 }}
          length={0}
        />,
      ),
    ).not.toThrow();
  });

  it('Snake3DBody mounts, including with an empty snake', () => {
    expect(() =>
      wrap(
        <Snake3DBody
          glide={glide}
          cellSize={GRID.cellSize}
          origin={{ x: GRID.originX, y: GRID.originY }}
          glow={0.8}
        />,
      ),
    ).not.toThrow();
    expect(() =>
      wrap(
        <Snake3DBody
          glide={makeGlide([])}
          cellSize={GRID.cellSize}
          origin={{ x: 0, y: 0 }}
          glow={0}
        />,
      ),
    ).not.toThrow();
  });

  it("DynamicLayer draws the sprite head when the effect is 'sprite'", () => {
    act(() => useSettingsStore.setState({ snakeEffect: 'sprite' }));
    try {
      expect(() =>
        wrap(
          <DynamicLayer gridSpec={GRID} snake={snake(4)} food={{ x: 1, y: 1 }} />,
        ),
      ).not.toThrow();
    } finally {
      act(() => useSettingsStore.setState({ snakeEffect: 'gloss' }));
    }
  });
});
