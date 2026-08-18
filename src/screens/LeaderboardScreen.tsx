import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
import {
  Chip,
  IconButton,
  MEDALS,
  ScreenShell,
  useTheme,
} from '../ui';

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
 * Leaderboard: top scores for a selected mode×wall board, as a FlatList with
 * pull-to-refresh. Reads are offline-safe (resolve []/null), so the screen
 * renders loading / empty / list states without ever crashing. Top-3 rows get
 * medal accents; the current user's row is highlighted (border + label, never
 * color alone), and their best is pinned below when outside the top N.
 * Anonymous/local play stays first-class: the public board always shows, with
 * a gentle sign-in prompt when signed out. (Chunk K)
 */
export function LeaderboardScreen({
  leaderboard = appLeaderboard,
  auth = appAuth,
}: LeaderboardScreenProps = {}) {
  const router = useRouter();
  const { ui, spacing, radius, type } = useTheme();

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
  const [refreshing, setRefreshing] = useState(false);
  const reqRef = useRef(0);

  const uid = user?.uid ?? null;
  const load = useCallback(
    async (options: { silent?: boolean } = {}) => {
      const req = ++reqRef.current;
      if (!options.silent) {
        setEntries(null); // full reload: show the loading state
      }
      const [top, best] = await Promise.all([
        leaderboard.getTopScores(board, TOP_N),
        uid ? leaderboard.getUserBest(board, uid) : Promise.resolve(null),
      ]);
      if (req !== reqRef.current) {
        return; // a newer board/refresh superseded this read
      }
      setEntries(top);
      setUserBest(best);
    },
    [leaderboard, board, uid],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Pull-to-refresh keeps the list on screen while re-querying.
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load({ silent: true }).finally(() => setRefreshing(false));
  }, [load]);

  const loading = entries === null;
  const isEmpty = entries !== null && entries.length === 0;
  const inTop =
    userBest !== null && (entries?.some((e) => e.uid === userBest.uid) ?? false);
  const showPinned = uid !== null && userBest !== null && !inTop;

  const renderRow = (e: LeaderboardEntry, pinned: boolean) => {
    const isSelf = e.uid === uid;
    const medal = !pinned && e.rank >= 1 && e.rank <= 3 ? MEDALS[e.rank - 1] : null;
    return (
      <View
        key={pinned ? 'pinned' : e.uid}
        testID={pinned ? 'lb-pinned' : `lb-entry-${e.uid}`}
        accessible
        accessibilityLabel={`Rank ${e.rank}, ${e.displayName}, ${e.score} points${
          isSelf ? ', you' : ''
        }`}
        accessibilityState={{ selected: isSelf }}
        style={[
          styles.row,
          {
            backgroundColor: ui.surfaceRaised,
            borderRadius: radius.md,
            borderColor: isSelf ? ui.accent : medal ?? ui.border,
            borderWidth: isSelf || medal ? 1.5 : 1,
          },
        ]}
      >
        <View style={styles.rankSlot}>
          {medal !== null ? (
            <Ionicons name="medal" size={18} color={medal} />
          ) : (
            <Text style={[styles.rank, { color: ui.textSecondary }]}>
              {e.rank}
            </Text>
          )}
        </View>
        <Text
          numberOfLines={1}
          style={[
            styles.name,
            { color: isSelf ? ui.accent : ui.textPrimary },
          ]}
        >
          {e.displayName}
          {isSelf ? '  (you)' : ''}
        </Text>
        <Text style={[styles.score, { color: medal ?? ui.textPrimary }]}>
          {e.score}
        </Text>
      </View>
    );
  };

  return (
    <ScreenShell world contentStyle={{ gap: spacing.md }}>
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
          Leaderboard
        </Text>
        <IconButton
          testID="lb-refresh"
          icon="refresh"
          accessibilityLabel="Refresh"
          onPress={() => void load()}
        />
      </View>

      <View style={{ gap: spacing.sm }}>
        <View style={[styles.selectorRow, { gap: spacing.sm }]}>
          {MODES.map(([id, label]) => (
            <Chip
              key={id}
              testID={`lb-mode-${id}`}
              label={label}
              accessibilityLabel={`${label} mode board`}
              selected={board.modeId === id}
              onPress={() => setBoard((b) => ({ ...b, modeId: id }))}
            />
          ))}
        </View>
        <View style={[styles.selectorRow, { gap: spacing.sm }]}>
          {WALLS.map(([w, label]) => (
            <Chip
              key={w}
              testID={`lb-wall-${w}`}
              label={label}
              accessibilityLabel={`${label} walls board`}
              selected={board.wall === w}
              onPress={() => setBoard((b) => ({ ...b, wall: w }))}
            />
          ))}
        </View>
      </View>

      {loading && (
        <Text
          testID="lb-loading"
          style={[type.body, styles.statusText, { color: ui.textSecondary }]}
        >
          Loading…
        </Text>
      )}

      {isEmpty && (
        <Text
          testID="lb-empty"
          style={[type.body, styles.statusText, { color: ui.textSecondary }]}
        >
          No scores yet — be the first!
        </Text>
      )}

      {!loading && !isEmpty && (
        <FlatList
          testID="lb-list"
          data={entries ?? []}
          keyExtractor={(e) => e.uid}
          renderItem={({ item }) => renderRow(item, false)}
          contentContainerStyle={[styles.list, { gap: spacing.sm }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={ui.accent}
              colors={[ui.accent]}
              progressBackgroundColor={ui.surfaceRaised}
            />
          }
        />
      )}

      {showPinned && (
        <View style={styles.pinnedWrap}>
          <Text style={[type.label, { color: ui.textSecondary }]}>
            Your best
          </Text>
          {renderRow(userBest!, true)}
        </View>
      )}

      {user === null && (
        <Pressable
          testID="lb-signin-prompt"
          accessibilityRole="button"
          accessibilityLabel="Sign in to compete on the leaderboard"
          onPress={() => router.push('/account')}
          style={[
            styles.signinPrompt,
            {
              borderColor: ui.border,
              borderRadius: radius.md,
              backgroundColor: ui.surfaceRaised,
            },
          ]}
        >
          <Text style={[styles.signinText, { color: ui.accent }]}>
            Sign in to compete on the leaderboard
          </Text>
        </Pressable>
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
  selectorRow: { flexDirection: 'row', flexWrap: 'wrap' },
  statusText: { textAlign: 'center', marginTop: 32 },
  list: { paddingVertical: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  rankSlot: { width: 28, alignItems: 'center' },
  rank: {
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  name: { flex: 1, fontSize: 16, fontWeight: '600' },
  score: {
    fontSize: 16,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  pinnedWrap: { gap: 4 },
  signinPrompt: {
    marginTop: 'auto',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  signinText: { fontSize: 15, fontWeight: '700' },
});
