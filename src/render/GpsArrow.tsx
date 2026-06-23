import { StyleSheet, Text, View } from 'react-native';
import type { Cell } from '../engine/types';
import { useSkin } from '../skins/SkinProvider';
import { foodPointer } from './foodPointer';
import type { Viewport } from './camera';

interface GpsArrowProps {
  /** Head and food in WORLD coordinates; food null hides the arrow. */
  head: Cell;
  food: Cell | null;
  viewport: Viewport;
}

/**
 * GPS HUD arrow: points toward the food while it is off-screen, hidden once the
 * food is within the viewport. Rotated by the foodPointer angle (screen
 * convention) and colored from the skin's food color so it reads as "food is
 * that way". A pure projection of head/food/viewport + skin. (chunk M, step 49)
 */
export function GpsArrow({ head, food, viewport }: GpsArrowProps) {
  const skin = useSkin();
  if (food === null) {
    return null;
  }
  const { visible, angleRad } = foodPointer(head, food, viewport);
  if (!visible) {
    return null;
  }

  return (
    <View testID="gps-arrow" pointerEvents="none" style={styles.container}>
      <Text
        style={[
          styles.glyph,
          { color: skin.foodColor, transform: [{ rotate: `${angleRad}rad` }] },
        ]}
      >
        ➤
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: { fontSize: 36, fontWeight: '900' },
});
