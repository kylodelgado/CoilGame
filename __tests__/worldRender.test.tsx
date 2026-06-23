import { render } from '@testing-library/react-native';
import { WorldBoard } from '../src/render/WorldBoard';
import { WorldDynamicLayer } from '../src/render/WorldDynamicLayer';
import { SkinProvider } from '../src/skins/SkinProvider';
import { computeViewport } from '../src/render/camera';
import type { Cell, WorldSpec } from '../src/engine/types';

jest.mock('@shopify/react-native-skia', () => {
  const React = require('react');
  const { View } = require('react-native');
  const passthrough =
    () =>
    ({ children }: { children?: React.ReactNode }) =>
      React.createElement(View, null, children ?? null);
  return {
    Canvas: passthrough(),
    Group: passthrough(),
    Fill: passthrough(),
    Rect: passthrough(),
    RoundedRect: passthrough(),
    Circle: passthrough(),
  };
});

const WORLD: WorldSpec = { worldColumns: 40, worldRows: 40, cellSize: 12 };
const viewport = computeViewport({ x: 20, y: 20 }, WORLD, 12, 12);
const origin = { x: 6, y: 40 };

const wrap = (node: React.ReactElement) =>
  render(<SkinProvider>{node}</SkinProvider>);

describe('GPS world rendering', () => {
  it('WorldBoard mounts for a representative world + viewport', () => {
    expect(() =>
      wrap(
        <WorldBoard viewport={viewport} cellSize={WORLD.cellSize} gridOrigin={origin} />,
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
          cellSize={WORLD.cellSize}
          gridOrigin={origin}
          snake={[{ x: 20, y: 20 }]}
          food={null}
        />,
      ),
    ).not.toThrow();
  });
});
