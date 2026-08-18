import { useEffect, useRef } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { PRESETS } from '../engine';
import type { ModeId, PresetId, WallBehavior } from '../engine/types';
import { AdBanner } from '../monetization';
import { useScoresStore } from '../state/useScoresStore';
import {
  AnimatedNumber,
  GlowButton,
  Panel,
  ScreenShell,
  useReducedMotion,
  useTheme,
} from '../ui';

interface EndScreenProps {
  variant: 'win' | 'loss';
}

/** Format an elapsed-ms duration as m:ss (e.g. 75200 -> "1:15"). */
function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Shared end-of-run surface for Win and Loss: entrance motion, a count-up on
 * the final score, a burst "NEW BEST" treatment when the run beat the board's
 * best, secondary run stats, and the full post-run action set — Play Again
 * (same preset + wall + MODE), Home, View Leaderboard, and a native Share.
 * (FR-UI4)
 */
export function EndScreen({ variant }: EndScreenProps) {
  const router = useRouter();
  const { ui, spacing, type } = useTheme();
  const reducedMotion = useReducedMotion();
  const params = useLocalSearchParams<{
    score?: string;
    isNewBest?: string;
    foodEaten?: string;
    length?: string;
    elapsedMs?: string;
    presetId?: string;
    wall?: string;
    modeId?: string;
  }>();

  const score = Number(params.score ?? 0);
  const isNewBest = params.isNewBest === '1';
  const foodEaten = Number(params.foodEaten ?? 0);
  const length = Number(params.length ?? 0);
  const elapsedMs = Number(params.elapsedMs ?? 0);
  const wall: WallBehavior = params.wall === 'PORTAL' ? 'PORTAL' : 'SOLID';
  const presetId: PresetId =
    params.presetId && params.presetId in PRESETS
      ? (params.presetId as PresetId)
      : 'STANDARD';
  const modeId: ModeId =
    params.modeId === 'GPS'
      ? 'GPS'
      : params.modeId === 'DYNAMIC_WALLS'
        ? 'DYNAMIC_WALLS'
        : 'CLASSIC';

  // Subscribe to the bests record so the shown high score is reactive.
  const bests = useScoresStore((s) => s.bests);
  const high = bests[`${modeId}:${wall}`] ?? 0;

  const isWin = variant === 'win';
  const title = isWin ? 'Perfect!' : 'Game Over';
  const subtitle = isWin ? 'You filled the entire grid.' : undefined;

  // Entrance: fade + rise; the NEW BEST badge additionally bursts in with a
  // spring scale. All static under Reduce Motion.
  const entrance = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const burst = useRef(new Animated.Value(reducedMotion ? 1 : 0.2)).current;
  useEffect(() => {
    if (reducedMotion) {
      entrance.setValue(1);
      burst.setValue(1);
      return;
    }
    Animated.timing(entrance, {
      toValue: 1,
      duration: 380,
      useNativeDriver: true,
    }).start();
    Animated.spring(burst, {
      toValue: 1,
      speed: 10,
      bounciness: 14,
      delay: 250,
      useNativeDriver: true,
    }).start();
  }, [entrance, burst, reducedMotion]);

  // Tell screen readers about the milestone (try-guarded: never crash).
  useEffect(() => {
    if (isNewBest) {
      try {
        AccessibilityInfo.announceForAccessibility('New best score');
      } catch {
        // No announcement support — the badge still shows.
      }
    }
  }, [isNewBest]);

  const onShare = () => {
    try {
      void Share.share({ message: `I scored ${score} in Coil!` }).catch(
        () => undefined,
      );
    } catch {
      // Share sheet unavailable — quietly ignore.
    }
  };

  const entranceStyle = {
    opacity: entrance,
    transform: [
      {
        translateY: entrance.interpolate({
          inputRange: [0, 1],
          outputRange: [24, 0],
        }),
      },
    ],
  };

  return (
    <ScreenShell world contentStyle={styles.center}>
      <Animated.View style={[styles.column, entranceStyle]}>
        <Text
          accessibilityRole="header"
          style={[
            type.display,
            styles.title,
            {
              color: isWin ? ui.accent : ui.textPrimary,
              textShadowColor: ui.accent,
            },
          ]}
        >
          {title}
        </Text>
        {subtitle !== undefined && (
          <Text style={[type.body, { color: ui.textSecondary }]}>
            {subtitle}
          </Text>
        )}

        {isNewBest && (
          <Animated.View
            testID="new-best"
            accessibilityLabel="New best score"
            style={[
              styles.newBest,
              {
                borderColor: ui.accent,
                backgroundColor: ui.surfaceRaised,
                shadowColor: ui.accent,
                transform: [{ scale: burst }],
              },
            ]}
          >
            <Ionicons name="sparkles" size={16} color={ui.accent} />
            <Text style={[styles.newBestLabel, { color: ui.accent }]}>
              NEW BEST
            </Text>
            <Ionicons name="sparkles" size={16} color={ui.accent} />
          </Animated.View>
        )}

        {/* Primary figures */}
        <Panel style={[styles.scorePanel, { gap: spacing.xs }]}>
          <Text style={[type.label, { color: ui.textSecondary }]}>Score</Text>
          <AnimatedNumber
            testID="final-score"
            value={score}
            style={[type.score, styles.scoreValue, { color: ui.accent }]}
          />
          <Text style={[type.caption, { color: ui.textSecondary }]}>
            Best · {wall === 'SOLID' ? 'Solid' : 'Portal'}{' '}
            <Text
              testID="high-score"
              style={[styles.highScore, { color: ui.textPrimary }]}
            >
              {high}
            </Text>
          </Text>
        </Panel>

        {/* Run stats */}
        <View style={[styles.stats, { gap: spacing.xl }]}>
          <View style={styles.statItem}>
            <Text style={[type.label, { color: ui.textSecondary }]}>Length</Text>
            <Text
              testID="stat-length"
              style={[styles.statValue, { color: ui.textPrimary }]}
            >
              {length}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[type.label, { color: ui.textSecondary }]}>Food</Text>
            <Text
              testID="stat-food"
              style={[styles.statValue, { color: ui.textPrimary }]}
            >
              {foodEaten}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[type.label, { color: ui.textSecondary }]}>Time</Text>
            <Text
              testID="stat-time"
              style={[styles.statValue, { color: ui.textPrimary }]}
            >
              {formatTime(elapsedMs)}
            </Text>
          </View>
        </View>

        {/* Renders null for premium; truthful 60pt placeholder in mock mode. */}
        <AdBanner />

        {/* Actions */}
        <View style={[styles.actions, { gap: spacing.md }]}>
          <GlowButton
            testID="play-again-button"
            label="Play Again"
            size="lg"
            onPress={() =>
              router.replace({
                pathname: '/game',
                // Carry the FULL board identity — preset + wall + mode — so
                // Play Again replays exactly what was just played.
                params: { presetId, wall, modeId },
              })
            }
          />
          <View style={[styles.secondaryRow, { gap: spacing.md }]}>
            <GlowButton
              testID="home-button"
              label="Home"
              variant="secondary"
              onPress={() => router.replace('/')}
              style={styles.secondaryButton}
            />
            <GlowButton
              testID="view-leaderboard-button"
              label="Ranks"
              accessibilityLabel="View leaderboard"
              variant="secondary"
              onPress={() => router.push('/leaderboard')}
              style={styles.secondaryButton}
            />
            <GlowButton
              testID="share-button"
              label="Share"
              accessibilityLabel="Share your score"
              variant="secondary"
              onPress={onShare}
              style={styles.secondaryButton}
            />
          </View>
        </View>
      </Animated.View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  center: { justifyContent: 'center' },
  column: { alignItems: 'center', gap: 16 },
  title: {
    textAlign: 'center',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  newBest: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 14,
  },
  newBestLabel: { fontSize: 15, fontWeight: '900', letterSpacing: 2 },
  scorePanel: { alignItems: 'center', alignSelf: 'stretch' },
  scoreValue: { fontSize: 56 },
  highScore: { fontWeight: '800', fontVariant: ['tabular-nums'] },
  stats: { flexDirection: 'row' },
  statItem: { alignItems: 'center', gap: 2 },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  actions: { alignSelf: 'stretch', marginTop: 8 },
  secondaryRow: { flexDirection: 'row' },
  secondaryButton: { flex: 1 },
});
