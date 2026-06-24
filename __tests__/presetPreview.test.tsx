import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { PresetPreview } from '../src/render/PresetPreview';
import { SkinProvider } from '../src/skins/SkinProvider';
import { PRESETS, computeGrid } from '../src/engine';

// Skia + Reanimated are stubbed globally in jest.setup.js (incl. useClock and the
// worklet hooks the smooth-snake renderer uses); no per-file mock needed.

const BOX_W = 120;
const BOX_H = 160;

const wrap = (node: React.ReactElement) =>
  render(<SkinProvider>{node}</SkinProvider>);

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
