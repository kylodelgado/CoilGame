import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { createAsyncStorageAdapter } from '../services/asyncStorageAdapter';
import type { StoragePort } from '../services/StoragePort';
import { useSettingsStore } from '../state/useSettingsStore';
import { useScoresStore } from '../state/useScoresStore';
import { useSkin, SkinProvider } from '../skins/SkinProvider';
import { SKIN_IDS, getSkin } from '../skins/registry';
import { PRESETS } from '../engine/presets';
import { PresetPreview } from '../render/PresetPreview';
import type { ControlScheme } from '../engine/types';

const CONTROL_OPTIONS: ReadonlyArray<readonly [ControlScheme, string]> = [
  ['SWIPE', 'Swipe'],
  ['DPAD', 'D-pad'],
];

interface SettingsScreenProps {
  /** Inject a StoragePort (tests); defaults to the AsyncStorage adapter. */
  storage?: StoragePort;
}

/**
 * Settings: independent Sound and Haptics toggles (persisted through the
 * settings store), a confirm-guarded high-score reset (through the scores
 * store's reset), and an About/version line. (FR-UI5, FR-A3)
 */
export function SettingsScreen({ storage }: SettingsScreenProps = {}) {
  const router = useRouter();
  const skin = useSkin();
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
  const resetScores = useScoresStore((s) => s.reset);

  const [confirmingReset, setConfirmingReset] = useState(false);

  const appName = Constants.expoConfig?.name ?? 'Coil';
  const version = Constants.expoConfig?.version ?? '0.0.0';

  return (
    <View style={[styles.container, { backgroundColor: skin.background }]}>
      <View style={styles.header}>
        <Pressable
          testID="back-button"
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
        >
          <Text style={[styles.back, { color: skin.snakeBody }]}>‹ Back</Text>
        </Pressable>
        <Text style={[styles.title, { color: skin.snakeHead }]}>Settings</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.rowLabel}>Sound</Text>
        <Switch
          testID="sound-toggle"
          value={soundEnabled}
          onValueChange={(v) => setSound(v)}
        />
      </View>

      <View style={styles.row}>
        <Text style={styles.rowLabel}>Haptics</Text>
        <Switch
          testID="haptics-toggle"
          value={hapticsEnabled}
          onValueChange={(v) => setHaptics(v)}
        />
      </View>

      <View style={styles.row}>
        <Text style={styles.rowLabel}>Controls</Text>
        <View style={styles.segment}>
          {CONTROL_OPTIONS.map(([value, label]) => {
            const selected = value === controlScheme;
            return (
              <Pressable
                key={value}
                testID={`control-scheme-${value}`}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setControlScheme(value)}
                style={[
                  styles.segmentButton,
                  selected && { borderColor: skin.snakeHead },
                ]}
              >
                <Text
                  style={[
                    styles.segmentLabel,
                    selected && { color: skin.snakeHead },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.skinSection}>
        <Text style={styles.rowLabel}>Skin</Text>
        <View style={styles.skinGrid}>
          {SKIN_IDS.map((id) => {
            const selected = id === skinId;
            return (
              <Pressable
                key={id}
                testID={`skin-option-${id}`}
                accessibilityRole="button"
                accessibilityLabel={`Skin ${id}`}
                accessibilityState={{ selected }}
                onPress={() => setSkin(id)}
                style={styles.skinOption}
              >
                {/* Force the candidate skin so the swatch previews its colors. */}
                <SkinProvider skin={getSkin(id)}>
                  <PresetPreview
                    preset={PRESETS.CLASSIC}
                    boxWidth={64}
                    boxHeight={48}
                    selected={selected}
                  />
                </SkinProvider>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Pressable
        testID="reset-button"
        accessibilityRole="button"
        onPress={() => setConfirmingReset(true)}
        style={styles.resetButton}
      >
        <Text style={styles.resetLabel}>Reset High Scores</Text>
      </Pressable>

      <View style={styles.about}>
        <Text style={styles.aboutName}>{appName}</Text>
        <Text style={styles.aboutVersion}>
          Version <Text testID="version">{version}</Text>
        </Text>
      </View>

      {confirmingReset && (
        <View testID="reset-confirm-dialog" style={styles.dialogBackdrop}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>Reset High Scores?</Text>
            <Text style={styles.dialogBody}>
              This clears both your Solid and Portal bests. This cannot be undone.
            </Text>
            <View style={styles.dialogActions}>
              <Pressable
                testID="reset-cancel-button"
                accessibilityRole="button"
                onPress={() => setConfirmingReset(false)}
                style={styles.dialogButton}
              >
                <Text style={styles.dialogButtonLabel}>Cancel</Text>
              </Pressable>
              <Pressable
                testID="reset-confirm-button"
                accessibilityRole="button"
                onPress={() => {
                  void resetScores(resolvedStorage);
                  setConfirmingReset(false);
                }}
                style={[styles.dialogButton, styles.dialogDanger]}
              >
                <Text style={styles.dialogButtonLabel}>Reset</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 64, paddingHorizontal: 24, gap: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 24 },
  back: { fontSize: 18 },
  title: { fontSize: 28, fontWeight: '800' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#222',
  },
  rowLabel: { color: '#eee', fontSize: 18 },
  segment: { flexDirection: 'row', gap: 8 },
  segmentButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  segmentLabel: { color: '#aaa', fontSize: 15, fontWeight: '600' },
  skinSection: { paddingVertical: 16, gap: 12 },
  skinGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  skinOption: { borderRadius: 8 },
  resetButton: {
    marginTop: 32,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#7a1f1f',
    alignItems: 'center',
  },
  resetLabel: { color: '#e06464', fontSize: 16, fontWeight: '600' },
  about: { marginTop: 'auto', marginBottom: 32, alignItems: 'center', gap: 4 },
  aboutName: { color: '#888', fontSize: 14, fontWeight: '600' },
  aboutVersion: { color: '#666', fontSize: 13 },
  dialogBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 32,
  },
  dialog: {
    backgroundColor: '#161616',
    borderRadius: 16,
    padding: 24,
    gap: 12,
    width: '100%',
  },
  dialogTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  dialogBody: { color: '#aaa', fontSize: 15, lineHeight: 20 },
  dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
  dialogButton: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  dialogDanger: { backgroundColor: '#7a1f1f' },
  dialogButtonLabel: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
