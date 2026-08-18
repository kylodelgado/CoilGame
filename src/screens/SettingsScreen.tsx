import { useMemo, useState, type ReactNode } from 'react';
import {
  Linking,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { createAsyncStorageAdapter } from '../services/asyncStorageAdapter';
import type { StoragePort } from '../services/StoragePort';
// Contract with the monetization agent: purchasesInstance exposes
// restorePurchases(): Promise<void> (or similar thenable).
import { restorePurchases } from '../services/purchasesInstance';
import { useSettingsStore } from '../state/useSettingsStore';
import { useScoresStore } from '../state/useScoresStore';
import { SkinProvider } from '../skins/SkinProvider';
import { SKIN_IDS, getSkin, type SkinId } from '../skins/registry';
import { PRESETS } from '../engine/presets';
import { PresetPreview } from '../render/PresetPreview';
import type { ControlScheme } from '../engine/types';
import {
  Chip,
  GlowButton,
  IconButton,
  Panel,
  ScreenShell,
  SectionHeader,
  useTheme,
} from '../ui';

/** Honest control names: what the gesture actually is. */
const CONTROL_OPTIONS: ReadonlyArray<readonly [ControlScheme, string]> = [
  ['SWIPE', 'Slide'],
  ['DPAD', 'D-Pad'],
  ['ANALOG', 'Joystick'],
];

/** Human names for the skins (ids stay stable for persistence/tests). */
const SKIN_NAMES: Record<SkinId, string> = {
  greenOnBlack: 'Terrarium',
  amberCrt: 'Amber CRT',
  monoLcd: 'Pocket LCD',
  neon: 'Neon',
};

const SUPPORT_EMAIL = 'brandonbay9703@gmail.com';
/** Contract with the parallel routes agent: static/legal pages. */
const SUPPORT_LINKS: ReadonlyArray<{
  testID: string;
  label: string;
  route: string;
}> = [
  { testID: 'how-to-play-link', label: 'How to Play', route: '/how-to-play' },
  { testID: 'privacy-link', label: 'Privacy Policy', route: '/legal/privacy' },
  { testID: 'terms-link', label: 'Terms of Service', route: '/legal/terms' },
  {
    testID: 'licenses-link',
    label: 'Open-Source Licenses',
    route: '/legal/licenses',
  },
];

interface SettingsScreenProps {
  /** Inject a StoragePort (tests); defaults to the AsyncStorage adapter. */
  storage?: StoragePort;
}

/**
 * Settings, sectioned: GAME (controls), APPEARANCE (skins), AUDIO & HAPTICS,
 * PROGRESS (danger-styled reset with confirm), and SUPPORT & ABOUT. Every
 * color comes from the active skin's ui block. (FR-UI5, FR-A3)
 */
export function SettingsScreen({ storage }: SettingsScreenProps = {}) {
  const router = useRouter();
  const { ui, spacing, radius, type } = useTheme();
  const resolvedStorage = useMemo(
    () => storage ?? createAsyncStorageAdapter(),
    [storage],
  );

  const soundEnabled = useSettingsStore((s) => s.soundEnabled);
  const hapticsEnabled = useSettingsStore((s) => s.hapticsEnabled);
  const skinId = useSettingsStore((s) => s.skinId);
  const controlScheme = useSettingsStore((s) => s.controlScheme);
  const setSound = useSettingsStore((s) => s.setSound);
  const setHaptics = useSettingsStore((s) => s.setHaptics);
  const setSkin = useSettingsStore((s) => s.setSkin);
  const setControlScheme = useSettingsStore((s) => s.setControlScheme);
  const musicEnabled = useSettingsStore((s) => s.musicEnabled);
  const setMusic = useSettingsStore((s) => s.setMusic);
  const resetScores = useScoresStore((s) => s.reset);

  const [confirmingReset, setConfirmingReset] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const appName = Constants.expoConfig?.name ?? 'Coil';
  const version = Constants.expoConfig?.version ?? '0.0.0';

  const switchColors = {
    trackColor: { false: ui.border, true: ui.accent },
    thumbColor: ui.surfaceRaised,
    ios_backgroundColor: ui.border,
  } as const;

  const onRestorePurchases = () => {
    setRestoring(true);
    try {
      void Promise.resolve(restorePurchases())
        .catch(() => undefined)
        .finally(() => setRestoring(false));
    } catch {
      setRestoring(false);
    }
  };

  const settingRow = (label: string, control: ReactNode) => (
    <View
      style={[
        styles.row,
        { borderBottomColor: ui.border, minHeight: 44 + spacing.sm },
      ]}
    >
      <Text style={[type.body, styles.rowLabel, { color: ui.textPrimary }]}>
        {label}
      </Text>
      {control}
    </View>
  );

  const navRow = (
    testID: string,
    label: string,
    onPress: () => void,
    accessibilityLabel?: string,
  ) => (
    <Pressable
      key={testID}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={[
        styles.row,
        { borderBottomColor: ui.border, minHeight: 44 + spacing.sm },
      ]}
    >
      <Text style={[type.body, styles.rowLabel, { color: ui.textPrimary }]}>
        {label}
      </Text>
      <Ionicons name="chevron-forward" size={18} color={ui.textSecondary} />
    </Pressable>
  );

  return (
    <ScreenShell scroll world testID="settings-screen">
      <View style={styles.header}>
        <IconButton
          testID="back-button"
          icon="chevron-back"
          accessibilityLabel="Back"
          onPress={() => router.back()}
        />
        <Text
          accessibilityRole="header"
          style={[type.title, { color: ui.textPrimary }]}
        >
          Settings
        </Text>
        {/* Spacer balances the back button so the title sits centered. */}
        <View style={styles.headerSpacer} />
      </View>

      {/* ── GAME ─────────────────────────────────────────────────────── */}
      <SectionHeader title="Game" />
      <Text style={[type.caption, { color: ui.textSecondary }]}>
        How you steer the snake.
      </Text>
      <View style={[styles.chipRow, { gap: spacing.sm, marginTop: spacing.sm }]}>
        {CONTROL_OPTIONS.map(([value, label]) => (
          <Chip
            key={value}
            testID={`control-scheme-${value}`}
            label={label}
            accessibilityLabel={`${label} controls`}
            selected={value === controlScheme}
            onPress={() => setControlScheme(value)}
            style={styles.controlChip}
          />
        ))}
      </View>

      {/* ── APPEARANCE ───────────────────────────────────────────────── */}
      <SectionHeader title="Appearance" />
      <View style={[styles.skinGrid, { gap: spacing.md }]}>
        {SKIN_IDS.map((id) => {
          const selected = id === skinId;
          const candidate = getSkin(id);
          return (
            <Pressable
              key={id}
              testID={`skin-option-${id}`}
              accessibilityRole="button"
              accessibilityLabel={`${SKIN_NAMES[id]} skin`}
              accessibilityState={{ selected }}
              onPress={() => setSkin(id)}
              style={[
                styles.skinCard,
                {
                  backgroundColor: ui.surfaceRaised,
                  borderColor: selected ? ui.accent : ui.border,
                  borderRadius: radius.lg,
                  padding: spacing.md,
                  shadowColor: ui.accent,
                  shadowOpacity: selected ? 0.35 : 0,
                },
              ]}
            >
              {/* Force the candidate skin so the swatch previews its colors. */}
              <SkinProvider skin={candidate}>
                <PresetPreview
                  preset={PRESETS.CLASSIC}
                  boxWidth={96}
                  boxHeight={56}
                  selected={selected}
                />
              </SkinProvider>
              <View style={styles.skinNameRow}>
                <Text
                  style={[
                    styles.skinName,
                    { color: selected ? ui.accent : ui.textPrimary },
                  ]}
                >
                  {SKIN_NAMES[id]}
                </Text>
                {selected && (
                  <Ionicons name="checkmark-circle" size={16} color={ui.accent} />
                )}
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* ── AUDIO & HAPTICS ──────────────────────────────────────────── */}
      <SectionHeader title="Audio & Haptics" />
      {settingRow(
        'Sound',
        <Switch
          testID="sound-toggle"
          accessibilityLabel="Sound effects"
          value={soundEnabled}
          onValueChange={(v) => setSound(v)}
          {...switchColors}
        />,
      )}
      {settingRow(
        'Music',
        <Switch
          testID="music-toggle"
          accessibilityLabel="Music"
          value={musicEnabled}
          onValueChange={(v) => setMusic(v)}
          {...switchColors}
        />,
      )}
      {settingRow(
        'Haptics',
        <Switch
          testID="haptics-toggle"
          accessibilityLabel="Haptic feedback"
          value={hapticsEnabled}
          onValueChange={(v) => setHaptics(v)}
          {...switchColors}
        />,
      )}

      {/* ── PROGRESS ─────────────────────────────────────────────────── */}
      <SectionHeader title="Progress" />
      <GlowButton
        testID="reset-button"
        label="Reset High Scores"
        variant="danger"
        onPress={() => setConfirmingReset(true)}
      />

      {/* ── SUPPORT & ABOUT ──────────────────────────────────────────── */}
      <SectionHeader title="Support & About" />
      {navRow('account-link', 'Account', () => router.push('/account'))}
      {navRow(
        'store-link',
        'Coil Premium',
        () => router.push('/store'),
        'Coil Premium — remove ads',
      )}
      {SUPPORT_LINKS.map(({ testID, label, route }) =>
        navRow(testID, label, () => router.push(route)),
      )}
      {navRow(
        'restore-purchases-button',
        restoring ? 'Restoring…' : 'Restore Purchases',
        onRestorePurchases,
        'Restore purchases',
      )}
      {navRow(
        'contact-link',
        'Contact',
        () => {
          void Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => undefined);
        },
        'Contact support by email',
      )}

      <View style={[styles.about, { marginTop: spacing.xl }]}>
        <Text style={[type.caption, { color: ui.textSecondary }]}>
          {appName} <Text testID="version">{version}</Text>
        </Text>
      </View>

      {confirmingReset && (
        <View
          testID="reset-confirm-dialog"
          accessibilityViewIsModal
          style={[styles.dialogBackdrop, { backgroundColor: ui.scrim }]}
        >
          <Panel style={{ gap: spacing.md }}>
            <Text
              accessibilityRole="header"
              style={[type.heading, { color: ui.textPrimary }]}
            >
              Reset High Scores?
            </Text>
            <Text style={[type.body, { color: ui.textSecondary }]}>
              This clears the best score on every board. This cannot be undone.
            </Text>
            <View style={[styles.dialogActions, { gap: spacing.md }]}>
              <GlowButton
                testID="reset-cancel-button"
                label="Cancel"
                variant="secondary"
                onPress={() => setConfirmingReset(false)}
                style={styles.dialogButton}
              />
              <GlowButton
                testID="reset-confirm-button"
                label="Reset"
                variant="danger"
                onPress={() => {
                  void resetScores(resolvedStorage);
                  setConfirmingReset(false);
                }}
                style={styles.dialogButton}
              />
            </View>
          </Panel>
        </View>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerSpacer: { width: 44 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap' },
  controlChip: { flexGrow: 1 },
  skinGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  skinCard: { borderWidth: 1, gap: 8, shadowOffset: { width: 0, height: 0 }, shadowRadius: 10 },
  skinNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  skinName: { fontSize: 14, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: { flexShrink: 1 },
  about: { alignItems: 'center' },
  dialogBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  dialogActions: { flexDirection: 'row', justifyContent: 'flex-end' },
  dialogButton: { flexGrow: 1 },
});
