import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { PresetPreview } from '../src/render/PresetPreview';
import { SkinProvider } from '../src/skins/SkinProvider';
import { PRESETS, computeGrid } from '../src/engine';
import { greenOnBlack } from '../src/skins/greenOnBlack';
import { neon } from '../src/skins/neon';
import type { Skin } from '../src/skins/Skin';

// Skia + Reanimated are stubbed globally in jest.setup.js (incl. useClock and the
// worklet hooks the smooth-snake renderer uses); no per-file mock needed.

const BOX_W = 120;
const BOX_H = 160;

const wrap = (node: React.ReactElement, skin?: Skin) =>
  render(<SkinProvider skin={skin}>{node}</SkinProvider>);

describe('PresetPreview', () => {
  it.each(['CLASSIC', 'STANDARD', 'DENSE'] as const)(
    'renders without crashing for %s',
    (id) => {
      expect(() =>
        wrap(
          <PresetPreview
            preset={PRESETS[id]}
            boxWidth={BOX_W}
            boxHeight={BOX_H}
            selected={false}
          />,
        ),
      ).not.toThrow();
    },
  );

  it('defaults to the cheap STATIC preview (no live board mounted)', () => {
    wrap(
      <PresetPreview
        preset={PRESETS.STANDARD}
        boxWidth={BOX_W}
        boxHeight={BOX_H}
        selected={false}
      />,
    );
    expect(screen.getByTestId('preset-preview-static')).toBeTruthy();
    expect(screen.queryByTestId('preset-preview-live')).toBeNull();
  });

  it('live={false} is the same static branch as the default', () => {
    wrap(
      <PresetPreview
        preset={PRESETS.STANDARD}
        boxWidth={BOX_W}
        boxHeight={BOX_H}
        selected={false}
        live={false}
      />,
    );
    expect(screen.getByTestId('preset-preview-static')).toBeTruthy();
    expect(screen.queryByTestId('preset-preview-live')).toBeNull();
  });

  it('live={true} mounts the full Board + DynamicLayer preview', () => {
    wrap(
      <PresetPreview
        preset={PRESETS.STANDARD}
        boxWidth={BOX_W}
        boxHeight={BOX_H}
        selected={false}
        live={true}
      />,
    );
    expect(screen.getByTestId('preset-preview-live')).toBeTruthy();
    expect(screen.queryByTestId('preset-preview-static')).toBeNull();
  });

  describe('static preview skin branches', () => {
    const preview = (
      <PresetPreview
        preset={PRESETS.STANDARD}
        boxWidth={BOX_W}
        boxHeight={BOX_H}
        selected={false}
      />
    );

    it('renders the organic + dots skin (greenOnBlack) statically', () => {
      expect(() => wrap(preview, greenOnBlack)).not.toThrow();
    });

    it('renders a ruled-lines skin (neon) statically', () => {
      expect(() => wrap(preview, neon)).not.toThrow();
    });

    it("renders a gridStyle 'none' skin statically", () => {
      const bare: Skin = { ...greenOnBlack, gridStyle: 'none' };
      expect(() => wrap(preview, bare)).not.toThrow();
    });

    it('renders a square-food skin statically', () => {
      const squareFood: Skin = { ...neon, foodShape: 'square' };
      expect(() => wrap(preview, squareFood)).not.toThrow();
    });
  });

  it('reflects density: DENSE yields more columns than CLASSIC at the same box', () => {
    const classic = computeGrid(BOX_W, BOX_H, PRESETS.CLASSIC.targetColumns);
    const dense = computeGrid(BOX_W, BOX_H, PRESETS.DENSE.targetColumns);
    expect(dense.columns).toBeGreaterThan(classic.columns);
  });

  it('styles the selected state differently from unselected', () => {
    const { rerender } = wrap(
      <PresetPreview
        preset={PRESETS.STANDARD}
        boxWidth={BOX_W}
        boxHeight={BOX_H}
        selected={false}
      />,
    );
    const unselected = screen.getByTestId('preset-preview');
    expect(unselected.props.accessibilityState.selected).toBe(false);
    const unselStyle = StyleSheet.flatten(unselected.props.style);

    rerender(
      <SkinProvider>
        <PresetPreview
          preset={PRESETS.STANDARD}
          boxWidth={BOX_W}
          boxHeight={BOX_H}
          selected={true}
        />
      </SkinProvider>,
    );
    const selected = screen.getByTestId('preset-preview');
    expect(selected.props.accessibilityState.selected).toBe(true);
    const selStyle = StyleSheet.flatten(selected.props.style);

    expect(selStyle.borderColor).not.toBe(unselStyle.borderColor);
  });
});
