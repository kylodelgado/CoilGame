import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { playUi } from '../services/soundInstance';
import { MIN_TOUCH, useTheme } from './theme';

interface IconButtonProps {
  /** Ionicons glyph name (the app's only icon set — never emoji). */
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  /** Required: icons alone say nothing to a screen reader. */
  accessibilityLabel: string;
  size?: number;
  /** Defaults to the theme's secondary text color. */
  color?: string;
  testID?: string;
}

/**
 * A themed icon-only button with a guaranteed 44pt hit area regardless of the
 * glyph size. Ionicons only — the design system bans emoji-as-icons.
 */
export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  size = 24,
  color,
  testID,
}: IconButtonProps) {
  const { ui } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => {
        playUi();
        onPress();
      }}
      hitSlop={8}
      style={({ pressed }) => [styles.base, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Ionicons name={icon} size={size} color={color ?? ui.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minWidth: MIN_TOUCH,
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
