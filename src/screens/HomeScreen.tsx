import { useEffect, useRef } from 'react';
import {
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PRESETS } from '../engine';
import type { ModeId, PresetId, WallBehavior } from '../engine/types';
import { PresetPreview } from '../render/PresetPreview';
import { useSettingsStore } from '../state/useSettingsStore';
import { useScoresStore } from '../state/useScoresStore';
import {
  Chip,
  GlowButton,
  IconButton,
  ScreenShell,
  useReducedMotion,
  useTheme,
  withAlpha,
} from '../ui';

const PRESET_ORDER: PresetId[] = ['CLASSIC', 'STANDARD', 'DENSE'];
const WALLS: ReadonlyArray<readonly [WallBehavior, string]> = [
  ['SOLID', 'Solid'],
  ['PORTAL', 'Portal'],
];
/** Mode cards: name + one-line rules blurb. */
const MODE_OPTIONS: ReadonlyArray<readonly [ModeId, string, string]> = [
  ['CLASSIC', 'Classic', 'Eat, grow, don’t bite yourself'],
  ['DYNAMIC_WALLS', 'Dynamic Walls', 'Walls build themselves mid-run'],
  ['GPS', 'GPS', 'A vast world beyond the screen — follow the arrow'],
];
/** Mode emblems: pre-rendered props keyed by mode id (Home owns this map). */
const MODE_EMBLEMS: Record<ModeId, number> = {
  CLASSIC: require('../../assets/board/props/emblem_classic.webp'),
  DYNAMIC_WALLS: require('../../assets/board/props/emblem_walls.webp'),
  GPS: require('../../assets/board/props/emblem_gps.webp'),
};
/** Menu key art: the coiled snake, head raised (1200×700, transparent). */
const HERO_ART = require('../../assets/board/props/hero.webp');
const HERO_ASPECT = 700 / 1200;

const PREVIEW_W = 92;
const PREVIEW_H = 116;
/** First-launch flag: once set, the How-to-Play intro never auto-opens again. */
export const ONBOARDED_KEY = 'coil.onboarded.v1';
/** Contract with the render agent: PresetPreview accepts live={false} for a
 * static-cheap preview. Spread so the prop is optional until it lands. */
const STATIC_PREVIEW: { live?: boolean } = { live: false };

/**
 * Home experience and the FR-UI2 flow rule: selecting a mode/preset highlights
 * it and updates the store but does NOT launch; the wall toggle is independent;
 * only Play launches, carrying the selected preset + wall + mode to /game.
 * Shows the best score for the CURRENT mode×wall board. (FR-UI1/UI2)
 */
export function HomeScreen() {
  const router = useRouter();
  const { ui, spacing, radius, type } = useTheme();
  const reducedMotion = useReducedMotion();
  const { width } = useWindowDimensions();

  // First-run onboarding: open How to Play once, ever. The flag write is
  // fire-and-forget and failures are swallowed — a storage hiccup must never
  // block the home screen, and re-showing once is harmless. (EH-2)
  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(ONBOARDED_KEY)
      .then((seen) => {
        if (seen === null && !cancelled) {
          AsyncStorage.setItem(ONBOARDED_KEY, '1').catch(() => undefined);
          router.push('/how-to-play');
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const presetId = useSettingsStore((s) => s.presetId);
  const wallBehavior = useSettingsStore((s) => s.wallBehavior);
  const modeId = useSettingsStore((s) => s.modeId);
  const setPreset = useSettingsStore((s) => s.setPreset);
  const setWall = useSettingsStore((s) => s.setWall);
  const setMode = useSettingsStore((s) => s.setMode);

  // The prominent best is the CURRENT mode×wall board's.
  const bests = useScoresStore((s) => s.bests);
  const best = bests[`${modeId}:${wallBehavior}`] ?? 0;

  // Entrance: a single fade+rise over the whole content column. Under Reduce
  // Motion the screen simply appears.
  const entrance = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  useEffect(() => {
    if (reducedMotion) {
      entrance.setValue(1);
      return;
    }
    Animated.timing(entrance, {
      toValue: 1,
      duration: 360,
      useNativeDriver: true,
    }).start();
  }, [entrance, reducedMotion]);
  const entranceStyle = {
    opacity: entrance,
    transform: [
      {
        translateY: entrance.interpolate({
          inputRange: [0, 1],
          outputRange: [16, 0],
        }),
      },
    ],
  };

  // Key-art hero: slides in from the right a beat behind the content column
  // (parallax-ish) and settles at 0.9 opacity. Static under Reduce Motion.
  const heroIn = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  useEffect(() => {
    if (reducedMotion) {
      heroIn.setValue(1);
      return;
    }
    Animated.timing(heroIn, {
      toValue: 1,
      duration: 560,
      delay: 80,
      useNativeDriver: true,
    }).start();
  }, [heroIn, reducedMotion]);

  // Sized against the window: ~78% of the screen width stays visible while
  // the art bleeds off the right edge.
  const heroWidth = width * 0.92;
  const heroStyle = {
    width: heroWidth,
    height: heroWidth * HERO_ASPECT,
    right: -width * 0.14,
    opacity: heroIn.interpolate({ inputRange: [0, 1], outputRange: [0, 0.9] }),
    transform: [
      {
        translateX: heroIn.interpolate({
          inputRange: [0, 1],
          outputRange: [36, 0],
        }),
      },
    ],
  };
  // A soft wash over the hero keeps the wordmark and cards legible on top of
  // it — light skins lighten (surface tint), dark skins deepen (scrim ink).
  const heroScrim = ui.isLight
    ? withAlpha(ui.surface, 0.35)
    : withAlpha(ui.scrim, 0.35);

  const modeLabel =
    MODE_OPTIONS.find(([id]) => id === modeId)?.[1] ?? 'Classic';
  const wallLabel = wallBehavior === 'SOLID' ? 'Solid' : 'Portal';

  return (
    <ScreenShell world>
      {/* Key art: the coiled snake looms over the header, bleeding off the
          right edge, under a soft wash so the wordmark/cards stay legible. */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Animated.Image
          testID="home-hero"
          source={HERO_ART}
          resizeMode="contain"
          accessible={false}
          style={[styles.hero, heroStyle]}
        />
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: heroScrim }]}
        />
      </View>
      <Animated.View style={[styles.column, entranceStyle]}>
        {/* Header band: actions ride the top edge, the wordmark settles onto
            the key art below them with its glow. */}
        <View style={styles.header}>
          <Text
            accessibilityRole="header"
            style={[
              type.display,
              styles.wordmark,
              { color: ui.textPrimary, textShadowColor: ui.accent },
            ]}
          >
            COIL
          </Text>
          <View style={styles.headerActions}>
            <IconButton
              testID="leaderboard-button"
              icon="trophy-outline"
              accessibilityLabel="Leaderboard"
              onPress={() => router.push('/leaderboard')}
            />
            <IconButton
              testID="settings-button"
              icon="settings-outline"
              accessibilityLabel="Settings"
              onPress={() => router.push('/settings')}
            />
          </View>
        </View>

        {/* Best for the current board */}
        <View style={styles.bestBlock}>
          <Text style={[type.label, { color: ui.textSecondary }]}>
            Best · {modeLabel} · {wallLabel}
          </Text>
          <Text
            testID="best-score"
            accessibilityLabel={`Best score ${best}`}
            style={[type.score, styles.bestValue, { color: ui.accent }]}
          >
            {best}
          </Text>
        </View>

        {/* Mode cards */}
        <View style={styles.modeStack}>
          {MODE_OPTIONS.map(([id, label, blurb]) => {
            const active = modeId === id;
            return (
              <Pressable
                key={id}
                testID={`mode-${id}`}
                accessibilityRole="button"
                accessibilityLabel={`${label} mode. ${blurb}`}
                accessibilityState={{ selected: active }}
                onPress={() => setMode(id)} // select only — never launches
                style={[
                  styles.modeCard,
                  {
                    backgroundColor: ui.surfaceRaised,
                    borderColor: active ? ui.accent : ui.border,
                    borderRadius: radius.lg,
                    padding: spacing.lg,
                    shadowColor: ui.accent,
                    shadowOpacity: active ? 0.35 : 0,
                  },
                ]}
              >
                <View style={styles.modeMain}>
                  <Image
                    source={MODE_EMBLEMS[id]}
                    resizeMode="contain"
                    accessible={false}
                    style={[
                      styles.modeEmblem,
                      {
                        opacity: active ? 1 : 0.55,
                        transform: [{ scale: active ? 1.08 : 1 }],
                      },
                    ]}
                  />
                  <View style={styles.modeText}>
                    <Text
                      style={[
                        type.heading,
                        { color: active ? ui.accent : ui.textPrimary },
                      ]}
                    >
                      {label}
                    </Text>
                    <Text
                      numberOfLines={2}
                      style={[type.caption, { color: ui.textSecondary }]}
                    >
                      {blurb}
                    </Text>
                  </View>
                </View>
                {active && (
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={ui.accent}
                  />
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Preset previews */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.presetRow, { gap: spacing.lg }]}
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
                  {...STATIC_PREVIEW}
                />
                <Text
                  style={[
                    styles.presetLabel,
                    { color: selected ? ui.accent : ui.textSecondary },
                  ]}
                >
                  {PRESETS[id].label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Wall behavior segmented control */}
        <View style={styles.wallBlock}>
          <View style={[styles.wallToggle, { gap: spacing.md }]}>
            {WALLS.map(([w, label]) => (
              <Chip
                key={w}
                testID={`wall-${w}`}
                label={label}
                accessibilityLabel={`${label} walls`}
                selected={wallBehavior === w}
                onPress={() => setWall(w)}
                style={styles.wallChip}
              />
            ))}
          </View>
          <Text style={[type.caption, styles.wallHint, { color: ui.textSecondary }]}>
            {wallBehavior === 'SOLID'
              ? 'Solid: hitting the edge ends the run.'
              : 'Portal: slip out one side, glide in the other.'}
          </Text>
        </View>

        {/* Launch */}
        <GlowButton
          testID="play-button"
          label="Play"
          accessibilityLabel="Play"
          size="lg"
          onPress={() =>
            router.push({
              pathname: '/game',
              params: { presetId, wall: wallBehavior, modeId },
            })
          }
          style={styles.play}
        />
      </Animated.View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  column: { flex: 1, justifyContent: 'space-between' },
  // Nudged down so the raised head clears the status bar / dynamic island
  // instead of being sliced by it.
  hero: { position: 'absolute', top: 18 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 116,
  },
  wordmark: {
    alignSelf: 'flex-end',
    // The display face carries wide side bearings and a soft glow; a little
    // horizontal room keeps the leading C from clipping against the edge.
    paddingHorizontal: 6,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  bestBlock: { alignItems: 'center', gap: 2 },
  bestValue: { fontSize: 40 },
  modeStack: { gap: 10 },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 10,
  },
  modeMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 1,
  },
  modeEmblem: { width: 48, height: 48 },
  modeText: { gap: 2, flexShrink: 1 },
  presetRow: { paddingHorizontal: 4, alignItems: 'flex-start' },
  presetItem: { alignItems: 'center', gap: 6 },
  presetLabel: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  wallBlock: { alignItems: 'center', gap: 6 },
  wallToggle: { flexDirection: 'row' },
  wallChip: { minWidth: 120 },
  wallHint: { textAlign: 'center' },
  play: { width: '100%' },
});
