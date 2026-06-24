import { memo } from 'react';
import { StyleSheet } from 'react-native';
import { Canvas, Fill } from '@shopify/react-native-skia';
import { useSkin } from '../skins/SkinProvider';
import type { Viewport } from './camera';

interface WorldBoardProps {
  viewport: Viewport;
  cellSize: number;
  /** Pixel origin of the viewport on screen. */
  gridOrigin: { x: number; y: number };
}

/**
 * Background fill layer for GPS mode. The grid lines themselves now live in
 * WorldDynamicLayer's camera group so they pan smoothly with the world; this
 * layer just paints the skin background beneath them. Props are kept for a
 * stable call site and possible future static board chrome. A pure projection
 * of the active skin. (smooth GPS)
 */
function WorldBoardComponent(_props: WorldBoardProps) {
  const skin = useSkin();
  return (
    <Canvas style={StyleSheet.absoluteFill}>
      <Fill color={skin.background} />
    </Canvas>
  );
}

export const WorldBoard = memo(WorldBoardComponent);
