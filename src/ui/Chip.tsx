import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { playUi } from '../services/soundInstance';
import { MIN_TOUCH, useTheme } from './theme';

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Optional caption under the label (e.g. a control-scheme hint). */
  caption?: string;
  testID?: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  /** Extra leading content (e.g. a swatch); rendered before the label. */
  leading?: ReactNode;
}

/**
 * A selectable pill. Selection is NEVER color-only: selected chips get an
 * accent border AND a checkmark, plus accessibilityState.selected. Minimum
 * 44pt tall.
 */
export function Chip({
  label,
  selected,
  onPress,
  caption,
  testID,
  accessibilityLabel,
  style,
  leading,
}: ChipProps) {
  const { ui, radius, spacing } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      onPress={() => {
        playUi();
        onPress();
      }}
      style={[
        styles.base,
        {
          minHeight: MIN_TOUCH,
          borderRadius: radius.pill,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          backgroundColor: ui.surfaceRaised,
          borderColor: selected ? ui.accent : ui.border,
          borderWidth: selected ? 1.5 : 1,
          shadowColor: ui.accent,
          shadowOpacity: selected ? 0.4 : 0,
          shadowRadius: 8,
        },
        style,
      ]}
    >
      {leading != null && <View style={styles.leading}>{leading}</View>}
      <View style={styles.labels}>
        <Text
          style={[
            styles.label,
            { color: selected ? ui.accent : ui.textSecondary },
          ]}
        >
          {label}
        </Text>
        {caption != null && (
          <Text style={[styles.caption, { color: ui.textSecondary }]}>
            {caption}
          </Text>
        )}
      </View>
      {selected && (
        <Ionicons
          name="checkmark"
          size={14}
          color={ui.accent}
          style={styles.check}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
  },
  leading: { marginRight: 8 },
  labels: { alignItems: 'center' },
  label: { fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },
  caption: { fontSize: 11, marginTop: 1 },
  check: { marginLeft: 6 },
});
