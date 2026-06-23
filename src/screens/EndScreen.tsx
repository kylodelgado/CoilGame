import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { PRESETS } from '../engine';
import type { PresetId, WallBehavior } from '../engine/types';
import { useScoresStore } from '../state/useScoresStore';
import { useSkin } from '../skins/SkinProvider';

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
 * Shared end-of-run surface for Win and Loss. Shows the final score and the
 * relevant high score (Solid or Portal, matching the run's wall) as the primary
 * figures, plus secondary run stats (snake length, food eaten, time survived),
 * "New Best!" only when the run beat it, and a Win-only "Perfect!" framing.
 * Play Again replays the SAME preset + wall; Home returns home. (FR-UI4)
 */
export function EndScreen({ variant }: EndScreenProps) {
  const router = useRouter();
  const skin = useSkin();
  const params = useLocalSearchParams<{
    score?: string;
    isNewBest?: string;
    foodEaten?: string;
    length?: string;
    elapsedMs?: string;
    presetId?: string;
    wall?: string;
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

  const bestSolid = useScoresStore((s) => s.bestSolid);
  const bestPortal = useScoresStore((s) => s.bestPortal);
  const high = wall === 'SOLID' ? bestSolid : bestPortal;

  const title = variant === 'win' ? 'Perfect!' : 'Game Over';
  const subtitle =
    variant === 'win' ? 'You filled the entire grid.' : undefined;

  return (
    <View style={[styles.container, { backgroundColor: skin.background }]}>
      <Text style={[styles.title, { color: skin.snakeHead }]}>{title}</Text>
      {subtitle !== undefined && (
        <Text style={styles.subtitle}>{subtitle}</Text>
      )}

      {isNewBest && (
        <Text testID="new-best" style={[styles.newBest, { color: skin.foodColor }]}>
          New Best!
        </Text>
      )}

      <View style={styles.stats}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Score</Text>
          <Text testID="final-score" style={[styles.statValue, { color: skin.snakeHead }]}>
            {score}
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>
            Best · {wall === 'SOLID' ? 'Solid' : 'Portal'}
          </Text>
          <Text testID="high-score" style={[styles.statValue, { color: skin.snakeBody }]}>
            {high}
          </Text>
        </View>
      </View>

      <View style={styles.secondaryStats}>
        <View style={styles.secondaryItem}>
          <Text style={styles.secondaryLabel}>Length</Text>
          <Text testID="stat-length" style={styles.secondaryValue}>
            {length}
          </Text>
        </View>
        <View style={styles.secondaryItem}>
          <Text style={styles.secondaryLabel}>Food</Text>
          <Text testID="stat-food" style={styles.secondaryValue}>
            {foodEaten}
          </Text>
        </View>
        <View style={styles.secondaryItem}>
          <Text style={styles.secondaryLabel}>Time</Text>
          <Text testID="stat-time" style={styles.secondaryValue}>
            {formatTime(elapsedMs)}
          </Text>
        </View>
      </View>

      <Pressable
        testID="play-again-button"
        accessibilityRole="button"
        onPress={() =>
          router.replace({
            pathname: '/game',
            params: { presetId, wall },
          })
        }
        style={styles.primaryButton}
      >
        <Text style={styles.primaryLabel}>Play Again</Text>
      </Pressable>

      <Pressable
        testID="home-button"
        accessibilityRole="button"
        onPress={() => router.replace('/')}
        style={styles.button}
      >
        <Text style={styles.label}>Home</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 32,
  },
  title: { fontSize: 44, fontWeight: '800' },
  subtitle: { color: '#aaa', fontSize: 16 },
  newBest: { fontSize: 22, fontWeight: '700', letterSpacing: 1 },
  stats: { flexDirection: 'row', gap: 48, marginVertical: 16 },
  statItem: { alignItems: 'center' },
  statLabel: { color: '#888', fontSize: 13, letterSpacing: 1 },
  statValue: { fontSize: 36, fontWeight: '800' },
  secondaryStats: { flexDirection: 'row', gap: 32 },
  secondaryItem: { alignItems: 'center' },
  secondaryLabel: { color: '#777', fontSize: 11, letterSpacing: 1 },
  secondaryValue: { color: '#bbb', fontSize: 20, fontWeight: '700' },
  primaryButton: {
    paddingHorizontal: 56,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: '#1f6f1f',
  },
  primaryLabel: { color: '#fff', fontSize: 22, fontWeight: '700' },
  button: {
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
  },
  label: { color: '#fff', fontSize: 18, fontWeight: '600' },
});
