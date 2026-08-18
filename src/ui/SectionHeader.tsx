import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from './theme';

interface SectionHeaderProps {
  title: string;
  testID?: string;
}

/**
 * All-caps micro-label with a hairline rule — separates the sections of a
 * settings-style screen. Announced as a header to screen readers.
 */
export function SectionHeader({ title, testID }: SectionHeaderProps) {
  const { ui, spacing, type, displayFontFamily } = useTheme();
  return (
    <View
      testID={testID}
      style={[styles.row, { marginTop: spacing.xl, marginBottom: spacing.sm }]}
    >
      <Text
        accessibilityRole="header"
        style={[
          type.label,
          { color: ui.textSecondary },
          // Section headers speak in the game's display face when it's ready
          // (single 400 weight — drop the synthetic-heavy system weight).
          displayFontFamily !== undefined && {
            fontFamily: displayFontFamily,
            fontWeight: '400' as const,
          },
        ]}
      >
        {title}
      </Text>
      <View style={[styles.rule, { backgroundColor: ui.border }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
});
