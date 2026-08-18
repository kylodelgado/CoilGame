import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { InfoContent } from '../legal/InfoContent';
import { ScreenShell, useTheme } from '../ui';

interface InfoScreenProps {
  content: InfoContent;
}

/**
 * The one renderer for every structured info document (privacy policy, terms,
 * how-to-play, licenses). Takes the shared InfoContent shape and lays it out
 * on the game's world backdrop (ScreenShell world) with the display-font
 * title in the skin's accent, section headings, and generously line-spaced
 * body text — every color from the active skin's ui block. The back button
 * stays pinned above the scroll and clears a 44pt touch target.
 */
export function InfoScreen({ content }: InfoScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { ui, spacing, type } = useTheme();

  return (
    <ScreenShell world contentStyle={styles.shell}>
      <Pressable
        testID="info-back"
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={8}
        onPress={() => router.back()}
        style={styles.back}
      >
        <Text style={[styles.backGlyph, { color: ui.accent }]}>‹</Text>
        <Text style={[styles.backLabel, { color: ui.accent }]}>Back</Text>
      </Pressable>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}
        showsVerticalScrollIndicator={false}
      >
        <Text
          testID="info-title"
          accessibilityRole="header"
          style={[
            type.title,
            styles.title,
            { color: ui.accent, textShadowColor: ui.accent },
          ]}
        >
          {content.title}
        </Text>
        {content.effectiveDate !== undefined && (
          <Text
            style={[
              type.caption,
              { color: ui.textSecondary, marginBottom: spacing.sm },
            ]}
          >
            Effective {content.effectiveDate}
          </Text>
        )}

        {content.sections.map((section) => (
          <View key={section.heading} style={{ marginTop: spacing.xl }}>
            <Text
              accessibilityRole="header"
              style={[
                type.heading,
                { color: ui.textPrimary, marginBottom: spacing.sm },
              ]}
            >
              {section.heading}
            </Text>
            {section.paragraphs.map((paragraph, i) => (
              <Text
                key={i}
                style={[
                  type.body,
                  { color: ui.textPrimary, marginBottom: spacing.sm },
                ]}
              >
                {paragraph}
              </Text>
            ))}
          </View>
        ))}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  // The shell already pads for safe areas; tuck the back row against the top.
  shell: { paddingBottom: 0 },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    minWidth: 44,
    minHeight: 44,
  },
  backGlyph: { fontSize: 28, lineHeight: 30, marginRight: 6 },
  backLabel: { fontSize: 17, fontWeight: '600' },
  scroll: { flex: 1 },
  title: {
    marginBottom: 4,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
});
