import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { ModeId, WallBehavior } from '../engine/types';
import type { AuthPort } from '../services/AuthPort';
import type {
  Board,
  LeaderboardEntry,
  LeaderboardPort,
} from '../services/LeaderboardPort';
import { appAuth } from '../services/authInstance';
import { appLeaderboard } from '../services/leaderboardInstance';
import { useAuthStore } from '../state/useAuthStore';
import { useSettingsStore } from '../state/useSettingsStore';
import { useSkin } from '../skins/SkinProvider';

const TOP_N = 20;

const MODES: ReadonlyArray<readonly [ModeId, string]> = [
  ['CLASSIC', 'Classic'],
  ['DYNAMIC_WALLS', 'Dynamic Walls'],
  ['GPS', 'GPS'],
];
const WALLS: ReadonlyArray<readonly [WallBehavior, string]> = [
  ['SOLID', 'Solid'],
  ['PORTAL', 'Portal'],
];

interface LeaderboardScreenProps {
  /** Inject ports (tests); default to the shared app singletons. */
  leaderboard?: LeaderboardPort;
  auth?: AuthPort;
}

/**
 * Leaderboard: top scores for a selected mode×wall board. Reads are offline-safe
 * (resolve []/null), so the screen renders loading / empty / list states without
 * ever crashing. The current user's row is highlighted, and their best is pinned
 * below when outside the top N. Anonymous/local play stays first-class: the
 * public board always shows, with a gentle sign-in prompt when signed out. (Chunk K)
 */
export function LeaderboardScreen({
  leaderboard = appLeaderboard,
  auth = appAuth,
}: LeaderboardScreenProps = {}) {
  const router = useRouter();
  const skin = useSkin();

  const user = useAuthStore((s) => s.user);
  useEffect(() => useAuthStore.getState().hydrate(auth), [auth]);

  const storeMode = useSettingsStore((s) => s.modeId);
  const storeWall = useSettingsStore((s) => s.wallBehavior);
  const [board, setBoard] = useState<Board>({
    modeId: storeMode,
    wall: storeWall,
  });

  // entries === null means "loading"; [] means "no scores yet".
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [userBest, setUserBest] = useState<LeaderboardEntry | null>(null);
  const reqRef = useRef(0);

  const uid = user?.uid ?? null;
  const load = useCallback(async () => {
    const req = ++reqRef.current;
    setEntries(null);
    const [top, best] = await Promise.all([
      leaderboard.getTopScores(board, TOP_N),
      uid ? leaderboard.getUserBest(board, uid) : Promise.resolve(null),
    ]);
    if (req !== reqRef.current) {
      return; // a newer board/refresh superseded this read
    }
    setEntries(top);
    setUserBest(best);
  }, [leaderboard, board, uid]);

  useEffect(() => {
    void load();
  }, [load]);

  const loading = entries === null;
  const isEmpty = entries !== null && entries.length === 0;
  const inTop =
    userBest !== null && (entries?.some((e) => e.uid === userBest.uid) ?? false);
  const showPinned = uid !== null && userBest !== null && !inTop;

  const renderRow = (e: LeaderboardEntry, pinned: boolean) => {
    const isSelf = e.uid === uid;
    return (
      <View
        key={pinned ? 'pinned' : e.uid}
        testID={pinned ? 'lb-pinned' : `lb-entry-${e.uid}`}
        accessibilityState={{ selected: isSelf }}
        style={[
          styles.row,
          isSelf && { borderColor: skin.snakeHead, borderWidth: 1 },
        ]}
      >
        <Text style={[styles.rank, { color: skin.snakeBody }]}>{e.rank}</Text>
        <Text style={[styles.name, { color: isSelf ? skin.snakeHead : '#ddd' }]}>
          {e.displayName}
        </Text>
        <Text style={[styles.score, { color: skin.snakeHead }]}>{e.score}</Text>
      </View>
    );
  };

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
        <Text style={[styles.title, { color: skin.snakeHead }]}>Leaderboard</Text>
        <Pressable
          testID="lb-refresh"
          accessibilityRole="button"
          accessibilityLabel="Refresh"
          onPress={() => void load()}
        >
          <Text style={[styles.refresh, { color: skin.snakeBody }]}>↻</Text>
        </Pressable>
      </View>

      <View style={styles.selectors}>
        <View style={styles.selectorRow}>
          {MODES.map(([id, label]) => {
            const active = board.modeId === id;
            return (
              <Pressable
                key={id}
                testID={`lb-mode-${id}`}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setBoard((b) => ({ ...b, modeId: id }))}
                style={[styles.chip, active && { borderColor: skin.snakeHead }]}
              >
                <Text style={[styles.chipLabel, active && { color: skin.snakeHead }]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.selectorRow}>
          {WALLS.map(([w, label]) => {
            const active = board.wall === w;
            return (
              <Pressable
                key={w}
                testID={`lb-wall-${w}`}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setBoard((b) => ({ ...b, wall: w }))}
                style={[styles.chip, active && { borderColor: skin.snakeHead }]}
              >
                <Text style={[styles.chipLabel, active && { color: skin.snakeHead }]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {loading && (
        <Text testID="lb-loading" style={styles.statusText}>
          Loading…
        </Text>
      )}

      {isEmpty && (
        <Text testID="lb-empty" style={styles.statusText}>
          No scores yet — be the first!
        </Text>
      )}

      {!loading && !isEmpty && (
        <ScrollView testID="lb-list" contentContainerStyle={styles.list}>
          {entries!.map((e) => renderRow(e, false))}
        </ScrollView>
      )}

      {showPinned && (
        <View style={styles.pinnedWrap}>
          <Text style={styles.pinnedLabel}>Your best</Text>
          {renderRow(userBest!, true)}
        </View>
      )}

      {user === null && (
        <Pressable
          testID="lb-signin-prompt"
          accessibilityRole="button"
          onPress={() => router.push('/account')}
          style={styles.signinPrompt}
        >
          <Text style={[styles.signinText, { color: skin.snakeHead }]}>
            Sign in to compete on the leaderboard
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 64, paddingHorizontal: 20, gap: 12 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  back: { fontSize: 18 },
  title: { fontSize: 24, fontWeight: '800' },
  refresh: { fontSize: 24 },
  selectors: { gap: 8 },
  selectorRow: { flexDirection: 'row', gap: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333',
    backgroundColor: '#141414',
  },
  chipLabel: { color: '#aaa', fontSize: 14, fontWeight: '600' },
  statusText: { color: '#888', fontSize: 16, textAlign: 'center', marginTop: 32 },
  list: { gap: 6, paddingVertical: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#161616',
    borderColor: 'transparent',
    gap: 12,
  },
  rank: { width: 28, fontSize: 15, fontWeight: '700' },
  name: { flex: 1, fontSize: 16, fontWeight: '600' },
  score: { fontSize: 16, fontWeight: '800' },
  pinnedWrap: { gap: 4 },
  pinnedLabel: { color: '#888', fontSize: 12, letterSpacing: 1, marginLeft: 4 },
  signinPrompt: {
    marginTop: 'auto',
    marginBottom: 24,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'center',
  },
  signinText: { fontSize: 15, fontWeight: '600' },
});
