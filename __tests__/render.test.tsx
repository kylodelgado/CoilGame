import { render } from '@testing-library/react-native';
import * as Skia from '@shopify/react-native-skia';
import { Board } from '../src/render/Board';
import { DynamicLayer } from '../src/render/DynamicLayer';
import { mix, withAlpha } from '../src/render/color';
import { SkinProvider } from '../src/skins/SkinProvider';
import { greenOnBlack } from '../src/skins/greenOnBlack';
import type { Cell, GridSpec } from '../src/engine/types';

// Skia + Reanimated are stubbed globally in jest.setup.js (plain Views plus
// inert useClock/Skia/worklet hooks) so these mount-only trees render without
// CanvasKit — no per-file mock needed. The stubbed useImage returns a decoded
// stand-in, so prop-sprite branches render by default; tests spy it to null to
// exercise the vector fallbacks.

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

// Prop sprites draw at fixed multiples of cellSize, which is how these tests
// pick each prop's <Image> out of the other sprite draws (snake head etc.).
const FOOD_W = GRID.cellSize * 1.35;
const BONUS_W = GRID.cellSize * 1.5;
const WALL_W = GRID.cellSize * 1.18;

/**
 * The stubbed Skia elements forward their geometry as data-* props (see
 * jest.setup.js), so a drawn sprite is found by testID and measured from the
 * rendered tree — the component captured its own `Image` import at module
 * load, so a spy installed later could never see the call.
 */
const spriteWidth = (node: { props: Record<string, unknown> } | null) =>
  node === null ? null : (node.props['data-width'] as number);

describe('DynamicLayer prop sprites (prop sprites)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    (Skia as unknown as { __setImagesDecoded(v: boolean): void }).__setImagesDecoded(true);
  });

  it('draws the food as the egg sprite (~1.35× cellSize) once decoded', () => {
    const { queryByTestId } = wrap(
      <DynamicLayer gridSpec={GRID} snake={makeSnake(3)} food={{ x: 8, y: 8 }} />,
    );
    expect(spriteWidth(queryByTestId('food-sprite'))).toBeCloseTo(FOOD_W);
  });

  it('falls back to the vector food while the sprite decodes', () => {
    (Skia as unknown as { __setImagesDecoded(v: boolean): void }).__setImagesDecoded(false);
    const { queryByTestId } = wrap(
      <DynamicLayer gridSpec={GRID} snake={makeSnake(3)} food={{ x: 8, y: 8 }} />,
    );
    expect(queryByTestId('food-sprite')).toBeNull();
  });

  it('draws the POINTS bonus as the scarab sprite (~1.5× cellSize)', () => {
    const { queryByTestId } = wrap(
      <DynamicLayer
        gridSpec={GRID}
        snake={makeSnake(3)}
        food={null}
        bonusFood={{ x: 2, y: 2 }}
        powerupKind="POINTS"
      />,
    );
    expect(spriteWidth(queryByTestId('bonus-sprite'))).toBeCloseTo(BONUS_W);
  });

  it('draws a non-POINTS pickup as its medallion sprite (~1.5× cellSize)', () => {
    const { queryByTestId } = wrap(
      <DynamicLayer
        gridSpec={GRID}
        snake={makeSnake(3)}
        food={null}
        bonusFood={{ x: 2, y: 2 }}
        powerupKind="MAGNET"
      />,
    );
    expect(spriteWidth(queryByTestId('bonus-sprite'))).toBeCloseTo(BONUS_W);
  });

  it('falls back to the vector glyph while the pickup sprite decodes', () => {
    (Skia as unknown as { __setImagesDecoded(v: boolean): void }).__setImagesDecoded(false);
    const { queryByTestId } = wrap(
      <DynamicLayer
        gridSpec={GRID}
        snake={makeSnake(3)}
        food={null}
        bonusFood={{ x: 2, y: 2 }}
        powerupKind="MAGNET"
      />,
    );
    expect(queryByTestId('bonus-sprite')).toBeNull();
    // The vector glyph stands in — forced, so it draws no sprite either.
    expect(queryByTestId('powerup-sprite-MAGNET')).toBeNull();
  });

  it('draws one wall sprite (~1.18× cellSize) per obstacle cell', () => {
    const { queryByTestId } = wrap(
      <DynamicLayer
        gridSpec={GRID}
        snake={makeSnake(3)}
        food={null}
        obstacles={[
          { x: 1, y: 1 },
          { x: 2, y: 2 },
          { x: 3, y: 3 },
        ]}
      />,
    );
    const walls = [0, 1, 2].map((i) => queryByTestId(`wall-sprite-${i}`));
    expect(walls.filter(Boolean)).toHaveLength(3);
    walls.forEach((w) => expect(spriteWidth(w)).toBeCloseTo(WALL_W));
  });

  it('falls back to flat obstacle cells while the wall sprites decode', () => {
    (Skia as unknown as { __setImagesDecoded(v: boolean): void }).__setImagesDecoded(false);
    const { queryByTestId } = wrap(
      <DynamicLayer
        gridSpec={GRID}
        snake={makeSnake(3)}
        food={null}
        obstacles={[{ x: 1, y: 1 }]}
      />,
    );
    expect(queryByTestId('wall-sprite-0')).toBeNull();
  });
});

describe('Board edge treatment (wall edge)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const EDGE_IDS = [
    'edge-shadow-top',
    'edge-shadow-bottom',
    'edge-shadow-left',
    'edge-shadow-right',
    'edge-solid-line',
    'edge-portal-glow',
    'edge-portal-band',
  ];

  it('draws no edge treatment by default (wall undefined)', () => {
    const { queryByTestId } = wrap(<Board gridSpec={GRID} />);
    EDGE_IDS.forEach((id) => expect(queryByTestId(id)).toBeNull());
  });

  it('SOLID: inner shadow on all four sides plus the thin warm rim line', () => {
    const { queryByTestId } = wrap(<Board gridSpec={GRID} wall="SOLID" />);
    ['top', 'bottom', 'left', 'right'].forEach((side) =>
      expect(queryByTestId(`edge-shadow-${side}`)).not.toBeNull(),
    );
    // The rim line mixes skin.obstacleColor 65% toward the warm red.
    const line = queryByTestId('edge-solid-line');
    expect(line).not.toBeNull();
    expect(line!.props['data-color']).toBe(
      mix(greenOnBlack.obstacleColor, '#FF5A48', 0.65),
    );
    // No portal treatment on a solid board.
    expect(queryByTestId('edge-portal-glow')).toBeNull();
  });

  it('PORTAL: a blurred glow band in the skin head color, no inner shadow', () => {
    const { queryByTestId } = wrap(<Board gridSpec={GRID} wall="PORTAL" />);
    expect(queryByTestId('edge-portal-glow')).not.toBeNull();
    expect(queryByTestId('edge-portal-band')).not.toBeNull();
    // Glow takes the snake's head color, so the edge reads as "yours".
    expect(queryByTestId('edge-portal-band')!.props['data-color']).toBe(
      withAlpha(greenOnBlack.snakeHead, 0.4),
    );
    expect(queryByTestId('edge-shadow-top')).toBeNull();
    expect(queryByTestId('edge-solid-line')).toBeNull();
  });
});
