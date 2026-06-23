import { StyleSheet, View } from 'react-native';
import { computeGrid } from '../engine';
import type { Cell, Preset } from '../engine/types';
import { useSkin } from '../skins/SkinProvider';
import { Board } from './Board';
import { DynamicLayer } from './DynamicLayer';

interface PresetPreviewProps {
  preset: Preset;
  boxWidth: number;
  boxHeight: number;
  selected: boolean;
}

/**
 * A miniature, accurate board preview for the home screen. It reuses the very
 * same computeGrid and skin tokens (via Board/DynamicLayer) scaled into a small
 * box, so a denser preset visibly shows more, smaller cells. The selected state
 * is shown with a skin-colored border highlight. (home preview)
 */
export function PresetPreview({
  preset,
  boxWidth,
  boxHeight,
  selected,
}: PresetPreviewProps) {
  const skin = useSkin();
  const grid = computeGrid(boxWidth, boxHeight, preset.targetColumns);

  // A short, representative sample: a 3-cell snake near center and one food.
  const cx = Math.floor(grid.columns / 2);
  const cy = Math.floor(grid.rows / 2);
  const snake: Cell[] = [
    { x: cx, y: cy },
    { x: cx - 1, y: cy },
    { x: cx - 2, y: cy },
  ];
  const food: Cell = { x: Math.min(grid.columns - 1, cx + 1), y: Math.max(0, cy - 1) };

  return (
    <View
      testID="preset-preview"
      accessibilityState={{ selected }}
      style={[
        styles.box,
        {
          width: boxWidth,
          height: boxHeight,
          borderColor: selected ? skin.snakeHead : 'transparent',
        },
      ]}
    >
      <Board gridSpec={grid} />
      <DynamicLayer gridSpec={grid} snake={snake} food={food} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
});
