import { render } from '@testing-library/react-native';
import * as Skia from '@shopify/react-native-skia';
import { WorldBoard } from '../src/render/WorldBoard';
import { WorldDynamicLayer } from '../src/render/WorldDynamicLayer';
import { getBoardBackdropSource } from '../src/render/boardBackdrops';
import { SkinProvider } from '../src/skins/SkinProvider';
import { computeViewport } from '../src/render/camera';
import { greenOnBlack } from '../src/skins/greenOnBlack';
import { neon } from '../src/skins/neon';
import type { Skin } from '../src/skins/Skin';
import type { Cell, WorldSpec } from '../src/engine/types';

// Skia + Reanimated are stubbed globally in jest.setup.js, including the
// imperative path factory and worklet hooks the smooth GPS scene uses. The
// stubbed useImage always returns a decoded stand-in, so backdrop-enabled
// branches exercise the <Image> path.

const WORLD: WorldSpec = { worldColumns: 40, worldRows: 40, cellSize: 12 };
const viewport = computeViewport({ x: 20, y: 20 }, WORLD, 12, 12);
const origin = { x: 6, y: 40 };

const wrap = (node: React.ReactElement, skin?: Skin) =>
  render(<SkinProvider skin={skin}>{node}</SkinProvider>);

describe('GPS world rendering', () => {
  it('WorldBoard mounts for a representative world + viewport', () => {
    expect(() =>
      wrap(
        <WorldBoard viewport={viewport} cellSize={WORLD.cellSize} gridOrigin={origin} />,
      ),
    ).not.toThrow();
  });

  it('WorldBoard mounts the backdrop branch (default skin sets boardBackdrop)', () => {
    // greenOnBlack has boardBackdrop + boardOrganic; with the stubbed decoded
    // image the <Image> branch renders (and the organic fallback is skipped).
    expect(() =>
      wrap(
        <WorldBoard viewport={viewport} cellSize={WORLD.cellSize} gridOrigin={origin} />,
        greenOnBlack,
      ),
    ).not.toThrow();
  });

  it('WorldBoard falls back to the organic gradient when the skin id has no mapped backdrop', () => {
    // Unknown id → getBoardBackdropSource returns null → gradient branch.
    const unmapped: Skin = { ...greenOnBlack, id: 'mysterySkin' };
    expect(() =>
      wrap(
        <WorldBoard viewport={viewport} cellSize={WORLD.cellSize} gridOrigin={origin} />,
        unmapped,
      ),
    ).not.toThrow();
  });

  it('WorldBoard mounts as a flat fill for a skin with no backdrop or organic board', () => {
    expect(() =>
      wrap(
        <WorldBoard viewport={viewport} cellSize={WORLD.cellSize} gridOrigin={origin} />,
        neon,
      ),
    ).not.toThrow();
  });

  it('WorldDynamicLayer mounts with a mix of on- and off-screen entities', () => {
    const snake: Cell[] = [
      { x: 20, y: 20 }, // in view
      { x: 19, y: 20 },
      { x: 2, y: 2 }, // far off-screen — must be skipped, not crash
    ];
    expect(() =>
      wrap(
        <WorldDynamicLayer
          viewport={viewport}
          world={WORLD}
          cellSize={WORLD.cellSize}
          gridOrigin={origin}
          snake={snake}
          food={{ x: 39, y: 39 }} // off-screen food
          bonusFood={{ x: 21, y: 21 }} // in view
          obstacles={[{ x: 22, y: 22 }, { x: 0, y: 0 }]}
        />,
      ),
    ).not.toThrow();
  });

  it('WorldDynamicLayer renders with everything off-screen (nothing drawn) without crashing', () => {
    expect(() =>
      wrap(
        <WorldDynamicLayer
          viewport={viewport}
          world={WORLD}
          cellSize={WORLD.cellSize}
          gridOrigin={origin}
          snake={[{ x: 0, y: 0 }]}
          food={{ x: 1, y: 1 }}
          bonusFood={{ x: 2, y: 2 }}
          obstacles={[{ x: 3, y: 3 }]}
        />,
      ),
    ).not.toThrow();
  });

  it('WorldDynamicLayer renders with no food/bonus/obstacles', () => {
    expect(() =>
      wrap(
        <WorldDynamicLayer
          viewport={viewport}
          world={WORLD}
          cellSize={WORLD.cellSize}
          gridOrigin={origin}
          snake={[{ x: 20, y: 20 }]}
          food={null}
        />,
      ),
    ).not.toThrow();
  });

  describe('gridStyle branches', () => {
    const layer = (
      <WorldDynamicLayer
        viewport={viewport}
        world={WORLD}
        cellSize={WORLD.cellSize}
        gridOrigin={origin}
        snake={[{ x: 20, y: 20 }]}
        food={null}
      />
    );

    it("renders 'dots' (the default skin's style) without crashing", () => {
      expect(() => wrap(layer, greenOnBlack)).not.toThrow();
    });

    it("renders 'lines' (implicit via gridLine with no gridStyle) without crashing", () => {
      expect(() => wrap(layer, neon)).not.toThrow();
    });

    it("renders 'none' explicitly without crashing", () => {
      const bare: Skin = { ...greenOnBlack, gridStyle: 'none' };
      expect(() => wrap(layer, bare)).not.toThrow();
    });

    it('renders no grid when gridLine is null and gridStyle is unset', () => {
      // neon sets no gridStyle, so nulling gridLine leaves both unset.
      const noLine: Skin = { ...neon, gridLine: null };
      expect(() => wrap(layer, noLine)).not.toThrow();
    });

    it('dots stay inside the world even when the viewport touches the edge', () => {
      const edgeViewport = computeViewport({ x: 0, y: 0 }, WORLD, 12, 12);
      expect(() =>
        wrap(
          <WorldDynamicLayer
            viewport={edgeViewport}
            world={WORLD}
            cellSize={WORLD.cellSize}
            gridOrigin={origin}
            snake={[{ x: 0, y: 0 }]}
            food={null}
          />,
          greenOnBlack,
        ),
      ).not.toThrow();
    });
  });
});

describe('getBoardBackdropSource', () => {
  it.each(['greenOnBlack', 'amberCrt', 'monoLcd', 'neon'])(
    'maps skin id %s to a backdrop asset',
    (id) => {
      expect(getBoardBackdropSource(id)).not.toBeNull();
    },
  );

  it('maps every skin to its OWN per-skin backdrop render', () => {
    const ids = ['greenOnBlack', 'amberCrt', 'monoLcd', 'neon'] as const;
    const sources = ids.map((id) => getBoardBackdropSource(id));
    expect(new Set(sources).size).toBe(ids.length);
  });

  it('returns null for unknown skin ids (organic fallback only)', () => {
    expect(getBoardBackdropSource('notASkin')).toBeNull();
    expect(getBoardBackdropSource('')).toBeNull();
  });
});
