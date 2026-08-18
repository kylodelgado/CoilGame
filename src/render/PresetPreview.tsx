import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Canvas,
  Circle,
  Fill,
  Path,
  Points,
  RadialGradient,
  Rect,
  RoundedRect,
  Skia,
  vec,
} from '@shopify/react-native-skia';
import { computeGrid } from '../engine';
import type { Cell, GridSpec, Preset } from '../engine/types';
import type { Skin } from '../skins/Skin';
import { useSkin } from '../skins/SkinProvider';
import { Board } from './Board';
import { DynamicLayer } from './DynamicLayer';
import { darken, mix, withAlpha } from './color';

interface PresetPreviewProps {
  preset: Preset;
  boxWidth: number;
  boxHeight: number;
  selected: boolean;
  /**
   * true mounts the REAL Board + DynamicLayer — pixel-faithful, but it decodes
   * the backdrop image, runs a frame clock, and mounts the full snake/effect
   * stack per preview. Default false renders a cheap static snapshot instead
   * (background + organic gradient + grid + a fixed S-curve snake + one food
   * dot, all from the same skin tokens): no clocks, no image decodes, no
   * effects. Screens rendering several previews at once rely on the default.
   */
  live?: boolean;
}

/** Clamp a cell into the grid so the fixed sample shapes fit tiny grids too. */
function clampCell(grid: GridSpec, x: number, y: number): Cell {
  return {
    x: Math.min(grid.columns - 1, Math.max(0, x)),
    y: Math.min(grid.rows - 1, Math.max(0, y)),
  };
}

/**
 * Cheap static preview: one Canvas of static geometry driven purely by grid +
 * skin tokens. It mirrors the classic board's look — organic light pool when
 * the skin has one (gradient only; the pre-rendered backdrop image is
 * deliberately NOT decoded here), grid per gridStyle, and a tube snake — so a
 * denser preset still visibly shows more, smaller cells.
 */
function StaticPreview({ grid, skin }: { grid: GridSpec; skin: Skin }) {
  const { columns, rows, cellSize, originX, originY } = grid;
  const boardW = columns * cellSize;
  const boardH = rows * cellSize;
  const gridStyle = skin.gridStyle ?? (skin.gridLine !== null ? 'lines' : 'none');

  // A fixed serpentine S through the grid center; head at the top-right end.
  // Defined in CELLS so density changes the snake's on-screen scale, which is
  // exactly the cue the preview exists to give.
  const cx = Math.floor(columns / 2);
  const cy = Math.floor(rows / 2);
  const sCurve: Cell[] = [
    clampCell(grid, cx + 1, cy - 1), // head
    clampCell(grid, cx, cy - 1),
    clampCell(grid, cx - 1, cy - 1),
    clampCell(grid, cx - 1, cy),
    clampCell(grid, cx, cy),
    clampCell(grid, cx + 1, cy),
    clampCell(grid, cx + 1, cy + 1),
    clampCell(grid, cx, cy + 1),
    clampCell(grid, cx - 1, cy + 1),
  ];
  const food = clampCell(grid, cx + 3, cy - 2);
  const center = (c: Cell) => ({
    x: originX + c.x * cellSize + cellSize / 2,
    y: originY + c.y * cellSize + cellSize / 2,
  });

  // Ruled grid as ONE stroked path (not a node per cell): at preview scale it
  // reads the same as the board's per-cell strokes at a fraction of the cost.
  const gridPath = useMemo(() => {
    const p = Skia.Path.Make();
    if (gridStyle === 'lines' && skin.gridLine !== null) {
      for (let x = 0; x <= columns; x++) {
        p.moveTo(originX + x * cellSize, originY);
        p.lineTo(originX + x * cellSize, originY + boardH);
      }
      for (let y = 0; y <= rows; y++) {
        p.moveTo(originX, originY + y * cellSize);
        p.lineTo(originX + boardW, originY + y * cellSize);
      }
    }
    return p;
  }, [gridStyle, skin.gridLine, columns, rows, cellSize, originX, originY, boardW, boardH]);

  // Interior intersections only, matching Board's dots treatment.
  const dots = useMemo(() => {
    const pts: { x: number; y: number }[] = [];
    if (gridStyle === 'dots') {
      for (let y = 1; y < rows; y++) {
        for (let x = 1; x < columns; x++) {
          pts.push(vec(originX + x * cellSize, originY + y * cellSize));
        }
      }
    }
    return pts;
  }, [gridStyle, columns, rows, cellSize, originX, originY]);

  // The snake as one rounded-stroke polyline through the S-curve cell centers.
  const snakePath = useMemo(() => {
    const p = Skia.Path.Make();
    const head = center(sCurve[0]);
    p.moveTo(head.x, head.y);
    for (let i = 1; i < sCurve.length; i++) {
      const c = center(sCurve[i]);
      p.lineTo(c.x, c.y);
    }
    return p;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, rows, cellSize, originX, originY]);

  const tube = Math.max(2, cellSize - skin.cellGap);
  const headCenter = center(sCurve[0]);
  const headR = (tube / 2) * 1.25; // slightly larger than the body tube
  const foodCenter = center(food);
  const foodSize = Math.max(2, cellSize - skin.cellGap);

  return (
    <Canvas style={StyleSheet.absoluteFill}>
      <Fill color={skin.background} />
      {skin.boardOrganic && (
        /* The organic pool of light, gradient only — no backdrop image decode
           and no noise pass; at preview size the gradient alone carries it. */
        <Rect x={originX} y={originY} width={boardW} height={boardH}>
          <RadialGradient
            c={vec(originX + boardW / 2, originY + boardH / 2)}
            r={Math.max(boardW, boardH) * 0.72}
            colors={[
              mix(skin.background, skin.snakeBody, 0.14),
              mix(skin.background, skin.snakeBody, 0.05),
              darken(skin.background, 0.35),
            ]}
            positions={[0, 0.55, 1]}
          />
        </Rect>
      )}
      {gridStyle === 'lines' && skin.gridLine !== null && (
        <Path path={gridPath} color={skin.gridLine} style="stroke" strokeWidth={1} />
      )}
      {gridStyle === 'dots' && dots.length > 0 && (
        <Points
          points={dots}
          mode="points"
          color={withAlpha(mix(skin.snakeBody, skin.background, 0.45), 0.5)}
          style="stroke"
          strokeWidth={Math.max(1.5, cellSize * 0.07)}
          strokeCap="round"
        />
      )}
      <Path
        path={snakePath}
        color={skin.snakeBody}
        style="stroke"
        strokeWidth={tube}
        strokeCap="round"
        strokeJoin="round"
      />
      {/* Head: the skin's brighter head color, slightly larger than the tube. */}
      <Circle cx={headCenter.x} cy={headCenter.y} r={headR} color={skin.snakeHead} />
      {skin.foodShape === 'circle' ? (
        <Circle cx={foodCenter.x} cy={foodCenter.y} r={foodSize / 2} color={skin.foodColor} />
      ) : (
        <RoundedRect
          x={foodCenter.x - foodSize / 2}
          y={foodCenter.y - foodSize / 2}
          width={foodSize}
          height={foodSize}
          r={foodSize * 0.4}
          color={skin.foodColor}
        />
      )}
    </Canvas>
  );
}

/**
 * A miniature, accurate board preview for the home/settings screens. It reuses
 * the very same computeGrid and skin tokens scaled into a small box, so a
 * denser preset visibly shows more, smaller cells. The selected state is shown
 * with a skin-colored border highlight. By default the preview is a STATIC
 * snapshot (see the `live` prop) so screens can mount several at once without
 * paying for clocks, image decodes, or the full effect stack. (home preview)
 */
export function PresetPreview({
  preset,
  boxWidth,
  boxHeight,
  selected,
  live = false,
}: PresetPreviewProps) {
  const skin = useSkin();
  const grid = computeGrid(boxWidth, boxHeight, preset.targetColumns);

  // A short, representative sample for the live preview: a 3-cell snake near
  // center and one food.
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
      {live ? (
        <View testID="preset-preview-live" style={StyleSheet.absoluteFill}>
          <Board gridSpec={grid} />
          <DynamicLayer gridSpec={grid} snake={snake} food={food} />
        </View>
      ) : (
        <View testID="preset-preview-static" style={StyleSheet.absoluteFill}>
          <StaticPreview grid={grid} skin={skin} />
        </View>
      )}
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
