import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PRESETS } from '../engine';
import type { ModeId, PresetId, WallBehavior } from '../engine/types';
import { PresetPreview } from '../render/PresetPreview';
import { useSettingsStore } from '../state/useSettingsStore';
import { useScoresStore } from '../state/useScoresStore';
import { useSkin } from '../skins/SkinProvider';

const PRESET_ORDER: PresetId[] = ['CLASSIC', 'STANDARD', 'DENSE'];
const WALLS: WallBehavior[] = ['SOLID', 'PORTAL'];
const MODE_OPTIONS: ReadonlyArray<readonly [ModeId, string]> = [
  ['CLASSIC', 'Classic'],
  ['DYNAMIC_WALLS', 'Dynamic Walls'],
];
const PREVIEW_W = 100;
const PREVIEW_H = 130;

/**
 * Home experience and the FR-UI2 flow rule: selecting a preset highlights it and
 * updates the store but does NOT launch; the wall toggle is independent; only
 * Play launches, carrying the selected preset + wall to /game. Shows both high
 * scores. (FR-UI1/UI2)
 */
export function HomeScreen() {
  const router = useRouter();
  const skin = useSkin();

  const presetId = useSettingsStore((s) => s.presetId);
  const wallBehavior = useSettingsStore((s) => s.wallBehavior);
  const modeId = useSettingsStore((s) => s.modeId);
  const setPreset = useSettingsStore((s) => s.setPreset);
  const setWall = useSettingsStore((s) => s.setWall);
  const setMode = useSettingsStore((s) => s.setMode);

  // Scores are keyed by mode×wall; the shown bests follow the selected mode.
  const bests = useScoresStore((s) => s.bests);
  const bestSolid = bests[`${modeId}:SOLID`] ?? 0;
  const bestPortal = bests[`${modeId}:PORTAL`] ?? 0;

  return (
    <View style={[styles.container, { backgroundColor: skin.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: skin.snakeHead }]}>Coil</Text>
        <Pressable
          testID="settings-button"
          accessibilityRole="button"
          accessibilityLabel="Settings"
          onPress={() => router.push('/settings')}
        >
          <Text style={[styles.gear, { color: skin.snakeBody }]}>⚙</Text>
        </Pressable>
      </View>

      <View style={styles.scores}>
        <View style={styles.scoreItem}>
          <Text style={styles.scoreLabel}>Best · Solid</Text>
          <Text testID="best-solid" style={[styles.scoreValue, { color: skin.snakeHead }]}>
            {bestSolid}
          </Text>
        </View>
        <View style={styles.scoreItem}>
          <Text style={styles.scoreLabel}>Best · Portal</Text>
          <Text testID="best-portal" style={[styles.scoreValue, { color: skin.snakeHead }]}>
            {bestPortal}
          </Text>
        </View>
      </View>

      <View style={styles.modeToggle}>
        {MODE_OPTIONS.map(([id, label]) => {
          const active = modeId === id;
          return (
            <Pressable
              key={id}
              testID={`mode-${id}`}
              accessibilityRole="button"
              accessibilityLabel={`${label} mode`}
              accessibilityState={{ selected: active }}
              onPress={() => setMode(id)}
              style={[
                styles.modeOption,
                active && { borderColor: skin.snakeHead },
              ]}
            >
              <Text
                style={[
                  styles.modeLabel,
                  { color: active ? skin.snakeHead : skin.snakeBody },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.presetRow}
      >
        {PRESET_ORDER.map((id) => {
          const selected = presetId === id;
          return (
            <Pressable
              key={id}
              testID={`preset-${id}`}
              accessibilityRole="button"
              accessibilityLabel={`${PRESETS[id].label} preset`}
              accessibilityState={{ selected }}
              onPress={() => setPreset(id)} // select only — does not launch
              style={styles.presetItem}
            >
              <PresetPreview
                preset={PRESETS[id]}
                boxWidth={PREVIEW_W}
                boxHeight={PREVIEW_H}
                selected={selected}
              />
              <Text
                style={[
                  styles.presetLabel,
                  { color: selected ? skin.snakeHead : skin.snakeBody },
                ]}
              >
                {PRESETS[id].label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.wallToggle}>
        {WALLS.map((w) => {
          const active = wallBehavior === w;
          return (
            <Pressable
              key={w}
              testID={`wall-${w}`}
              accessibilityRole="button"
              accessibilityLabel={`${w === 'SOLID' ? 'Solid' : 'Portal'} walls`}
              accessibilityState={{ selected: active }}
              onPress={() => setWall(w)}
              style={[
                styles.wallOption,
                active && { borderColor: skin.snakeHead },
              ]}
            >
              <Text
                style={[
                  styles.wallLabel,
                  { color: active ? skin.snakeHead : skin.snakeBody },
                ]}
              >
                {w === 'SOLID' ? 'Solid' : 'Portal'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        testID="play-button"
        accessibilityRole="button"
        accessibilityLabel="Play"
        style={styles.playButton}
        onPress={() =>
          router.push({
            pathname: '/game',
            params: { presetId, wall: wallBehavior, modeId },
          })
        }
      >
        <Text style={styles.playLabel}>Play</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 64,
    paddingBottom: 48,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 48, fontWeight: '800', letterSpacing: 4 },
  gear: { fontSize: 28 },
  scores: {
    flexDirection: 'row',
    gap: 40,
  },
  scoreItem: { alignItems: 'center' },
  scoreLabel: { color: '#888', fontSize: 13, letterSpacing: 1 },
  scoreValue: { fontSize: 28, fontWeight: '700' },
  modeToggle: { flexDirection: 'row', gap: 12 },
  modeOption: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: '#141414',
  },
  modeLabel: { fontSize: 15, fontWeight: '600' },
  presetRow: { gap: 16, paddingHorizontal: 8 },
  presetItem: { alignItems: 'center', gap: 8 },
  presetLabel: { fontSize: 14, fontWeight: '600' },
  wallToggle: { flexDirection: 'row', gap: 12 },
  wallOption: {
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: '#141414',
  },
  wallLabel: { fontSize: 16, fontWeight: '600' },
  playButton: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 18,
    borderRadius: 14,
    backgroundColor: '#1a1a1a',
  },
  playLabel: { color: '#fff', fontSize: 24, fontWeight: '700' },
});
