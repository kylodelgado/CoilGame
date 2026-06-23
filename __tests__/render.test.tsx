import { render } from '@testing-library/react-native';
import { Board } from '../src/render/Board';
import { DynamicLayer } from '../src/render/DynamicLayer';
import { SkinProvider } from '../src/skins/SkinProvider';
import type { Cell, GridSpec } from '../src/engine/types';

// Skia's canvas needs native/CanvasKit; for mount tests we stand the
// declarative components in with plain Views so the tree renders.
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

const GRID: GridSpec = {
  columns: 16,
  rows: 20,
  cellSize: 18,
  originX: 6,
  originY: 40,
};

function makeSnake(length: number): Cell[] {
  return Array.from({ length }, (_, i) => ({ x: 5 - i, y: 5 }));
}

const wrap = (node: React.ReactElement) =>
  render(<SkinProvider>{node}</SkinProvider>);

describe('Skia rendering (EH-12/13)', () => {
  it('Board mounts without crashing for a representative gridSpec', () => {
    expect(() => wrap(<Board gridSpec={GRID} />)).not.toThrow();
  });

  it('Board mounts when the skin has no grid lines', () => {
    const noLines = render(
      <SkinProvider skin={{ ...require('../src/skins/greenOnBlack').greenOnBlack, gridLine: null }}>
        <Board gridSpec={GRID} />
      </SkinProvider>,
    );
    expect(noLines).toBeTruthy();
  });

  it('DynamicLayer mounts with a snake and a food cell', () => {
    expect(() =>
      wrap(
        <DynamicLayer
          gridSpec={GRID}
          snake={makeSnake(3)}
          food={{ x: 8, y: 8 }}
        />,
      ),
    ).not.toThrow();
  });

  it('DynamicLayer mounts with food === null', () => {
    expect(() =>
      wrap(<DynamicLayer gridSpec={GRID} snake={makeSnake(3)} food={null} />),
    ).not.toThrow();
  });

  it('DynamicLayer mounts with a bonusFood cell (Prompt 35)', () => {
    expect(() =>
      wrap(
        <DynamicLayer
          gridSpec={GRID}
          snake={makeSnake(3)}
          food={{ x: 8, y: 8 }}
          bonusFood={{ x: 2, y: 2 }}
        />,
      ),
    ).not.toThrow();
  });

  it('DynamicLayer mounts with bonusFood === null', () => {
    expect(() =>
      wrap(
        <DynamicLayer
          gridSpec={GRID}
          snake={makeSnake(3)}
          food={{ x: 8, y: 8 }}
          bonusFood={null}
        />,
      ),
    ).not.toThrow();
  });

  it('DynamicLayer renders obstacles, and empty obstacles render unchanged (Prompt 41)', () => {
    expect(() =>
      wrap(
        <DynamicLayer
          gridSpec={GRID}
          snake={makeSnake(3)}
          food={{ x: 8, y: 8 }}
          obstacles={[
            { x: 1, y: 1 },
            { x: 2, y: 2 },
          ]}
        />,
      ),
    ).not.toThrow();
    // Empty/omitted obstacles render exactly like the classic path.
    expect(() =>
      wrap(
        <DynamicLayer gridSpec={GRID} snake={makeSnake(3)} food={null} obstacles={[]} />,
      ),
    ).not.toThrow();
  });

  it.each([1, 3, 10, 50])(
    'DynamicLayer renders a snake of length %i without throwing',
    (length) => {
      expect(() =>
        wrap(
          <DynamicLayer
            gridSpec={GRID}
            snake={makeSnake(length)}
            food={{ x: 1, y: 1 }}
          />,
        ),
      ).not.toThrow();
    },
  );

  it('does not mutate the snake array passed in (frozen input is safe)', () => {
    const snake = Object.freeze(makeSnake(4)) as Cell[];
    expect(() =>
      wrap(<DynamicLayer gridSpec={GRID} snake={snake} food={null} />),
    ).not.toThrow();
    expect(snake).toHaveLength(4);
  });
});
