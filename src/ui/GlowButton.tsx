import { useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { playUi } from '../services/soundInstance';
import { MIN_TOUCH, useTheme } from './theme';
import { useReducedMotion } from './useReducedMotion';

export type GlowButtonVariant = 'primary' | 'secondary' | 'danger';

interface GlowButtonProps {
  label: string;
  onPress: () => void;
  variant?: GlowButtonVariant;
  /** lg = the marquee PLAY treatment (bigger type, stronger glow). */
  size?: 'md' | 'lg';
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * The app's button: a luminous-bordered slab that glows in the active skin's
 * accent. Primary fills with the accent, secondary is a raised dark panel,
 * danger reads destructive. Presses scale down subtly (skipped entirely under
 * Reduce Motion). Always at least 44pt tall.
 */
export function GlowButton({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  testID,
  accessibilityLabel,
  accessibilityHint,
  style,
}: GlowButtonProps) {
  const { ui, radius, spacing, displayFontFamily } = useTheme();
  const reducedMotion = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (value: number) => {
    if (reducedMotion) {
      return;
    }
    Animated.spring(scale, {
      toValue: value,
      speed: 40,
      bounciness: 4,
      useNativeDriver: true,
    }).start();
  };

  const palette: ViewStyle & { labelColor: string } = (() => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: ui.accent,
          borderColor: ui.accent,
          shadowColor: ui.accent,
          labelColor: ui.onAccent,
        };
      case 'danger':
        return {
          backgroundColor: ui.danger,
          borderColor: ui.danger,
          shadowColor: ui.danger,
          // Light skins: pale surface ink on the dark danger fill; dark skins:
          // near-white primary text. Both directions stay readable.
          labelColor: ui.isLight ? ui.surface : ui.textPrimary,
        };
      case 'secondary':
      default:
        return {
          backgroundColor: ui.surfaceRaised,
          borderColor: ui.border,
          shadowColor: ui.accent,
          labelColor: ui.textPrimary,
        };
    }
  })();

  const isLarge = size === 'lg';

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => {
          playUi();
          onPress();
        }}
        onPressIn={() => animateTo(0.96)}
        onPressOut={() => animateTo(1)}
        style={[
          styles.base,
          {
            minHeight: MIN_TOUCH,
            borderRadius: isLarge ? radius.lg : radius.md,
            paddingVertical: isLarge ? spacing.lg : spacing.md,
            paddingHorizontal: isLarge ? spacing.xxl : spacing.xl,
            backgroundColor: palette.backgroundColor,
            borderColor: palette.borderColor,
            shadowColor: palette.shadowColor,
            shadowOpacity: variant === 'secondary' ? 0.18 : 0.55,
            shadowRadius: isLarge ? 18 : 10,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
      >
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={[
            styles.label,
            {
              color: palette.labelColor,
              fontSize: isLarge ? 22 : 16,
              letterSpacing: isLarge ? 3 : 1,
            },
            // The marquee (lg) label — PLAY — wears the game's display face
            // once loaded; regular buttons keep the system font.
            isLarge &&
              displayFontFamily !== undefined && {
                fontFamily: displayFontFamily,
                fontWeight: '400' as const,
              },
          ]}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  label: {
    fontWeight: '800',
    textTransform: 'uppercase',
  },
});
