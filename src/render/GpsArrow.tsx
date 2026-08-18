import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { Cell } from '../engine/types';
import { useSkin } from '../skins/SkinProvider';
import { foodPointer } from './foodPointer';
import { getArrowSprite } from './propSprites';
import type { Viewport } from './camera';

interface GpsArrowProps {
  /** Head and food in WORLD coordinates; food null hides the arrow. */
  head: Cell;
  food: Cell | null;
  viewport: Viewport;
}

/**
 * Rendered size of the compass-needle sprite: ~2.2× the 36pt glyph box the
 * vector arrow occupied, so the pre-rendered needle reads at a glance.
 */
const ARROW_SPRITE_SIZE = 79;

/**
 * Rotation for the arrow sprite. foodPointer's angleRad uses the SCREEN
 * convention (0 = right, +pi/2 = down, clockwise positive), which is exactly
 * how RN `rotate` transforms turn. The sprite's needle points UP in image
 * space, though — a quarter turn shy of the convention's 0-points-right — so
 * add +pi/2 to map "up" onto "right" before applying the pointer angle.
 */
export function arrowSpriteRotation(angleRad: number): number {
  return angleRad + Math.PI / 2;
}

/**
 * GPS HUD arrow: points toward the food while it is off-screen, hidden once the
 * food is within the viewport. Drawn as the Blender-rendered compass needle
 * (magenta, white-hot tip) rotated by the foodPointer angle; if the sprite
 * fails to load, the original skin-colored vector glyph stands in so the cue
 * never disappears. A pure projection of head/food/viewport + skin. (chunk M,
 * step 49; prop sprites)
 */
export function GpsArrow({ head, food, viewport }: GpsArrowProps) {
  const skin = useSkin();
  const [spriteFailed, setSpriteFailed] = useState(false);
  if (food === null) {
    return null;
  }
  const { visible, angleRad } = foodPointer(head, food, viewport);
  if (!visible) {
    return null;
  }

  return (
    <View testID="gps-arrow" pointerEvents="none" style={styles.container}>
      {spriteFailed ? (
        <Text
          style={[
            styles.glyph,
            { color: skin.foodColor, transform: [{ rotate: `${angleRad}rad` }] },
          ]}
        >
          ➤
        </Text>
      ) : (
        <Image
          testID="gps-arrow-sprite"
          source={getArrowSprite()}
          onError={() => setSpriteFailed(true)}
          resizeMode="contain"
          style={[
            styles.sprite,
            { transform: [{ rotate: `${arrowSpriteRotation(angleRad)}rad` }] },
          ]}
        />
      )}
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
  sprite: { width: ARROW_SPRITE_SIZE, height: ARROW_SPRITE_SIZE },
});
