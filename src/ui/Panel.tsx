import type { ReactNode } from 'react';
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from './theme';

interface PanelProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /** Accent-glow edge treatment (selected cards, marquee panels). */
  glow?: boolean;
}

/**
 * A raised dark panel with the design system's 1px luminous border — the
 * building block of every "premium arcade hardware" surface.
 */
export function Panel({ children, style, testID, glow = false }: PanelProps) {
  const { ui, radius, spacing } = useTheme();
  return (
    <View
      testID={testID}
      style={[
        styles.base,
        {
          backgroundColor: ui.surfaceRaised,
          borderColor: glow ? ui.accent : ui.border,
          borderRadius: radius.lg,
          padding: spacing.lg,
          shadowColor: ui.accent,
          shadowOpacity: glow ? 0.35 : 0,
          shadowRadius: 12,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    shadowOffset: { width: 0, height: 0 },
  },
});
