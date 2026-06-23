import type { ModeId, WallBehavior } from '../engine/types';
import type { AuthUser } from './AuthPort';

/**
 * Online leaderboard contract. Kept separate from StoragePort (local bests) and
 * AuthPort on purpose: local persistence, identity, and global ranking are
 * different concerns. A Firebase adapter implements this in step 43; the
 * in-memory fake below keeps a per-board sorted list (each user's best only) so
 * the submission service and screens are testable without a network. (Chunk K)
 */
export interface LeaderboardEntry {
  uid: string;
  displayName: string;
  score: number;
  rank: number;
}

/** A leaderboard board is one mode×wall combination. */
export type Board = { modeId: ModeId; wall: WallBehavior };

export interface LeaderboardPort {
  submitScore(board: Board, user: AuthUser, score: number): Promise<void>;
  getTopScores(board: Board, limit: number): Promise<LeaderboardEntry[]>;
  getUserBest(board: Board, uid: string): Promise<LeaderboardEntry | null>;
}

/** A user's record on a board, before ranks are assigned. */
interface BoardRecord {
  uid: string;
  displayName: string;
  score: number;
}

const boardKey = (board: Board): string => `${board.modeId}:${board.wall}`;
const displayNameFor = (user: AuthUser): string =>
  user.displayName ?? 'Anonymous';

/**
 * Deterministic, network-free LeaderboardPort fake. Each board is a uid -> best
 * record map; reads sort descending and assign 1-based ranks client-side, just
 * like the real Firestore adapter will. Boards are independent.
 */
export function createInMemoryLeaderboard(): LeaderboardPort {
  const boards = new Map<string, Map<string, BoardRecord>>();

  const recordsFor = (board: Board): Map<string, BoardRecord> => {
    const key = boardKey(board);
    let map = boards.get(key);
    if (!map) {
      map = new Map();
      boards.set(key, map);
    }
    return map;
  };

  /** Descending by score; ties keep insertion order (stable sort). */
  const ranked = (board: Board): LeaderboardEntry[] => {
    const sorted = [...recordsFor(board).values()].sort(
      (a, b) => b.score - a.score,
    );
    return sorted.map((r, i) => ({ ...r, rank: i + 1 }));
  };

  return {
    submitScore(board, user, score): Promise<void> {
      const map = recordsFor(board);
      const existing = map.get(user.uid);
      if (!existing || score > existing.score) {
        map.set(user.uid, {
          uid: user.uid,
          displayName: displayNameFor(user),
          score,
        });
      }
      return Promise.resolve();
    },

    getTopScores(board, limit): Promise<LeaderboardEntry[]> {
      return Promise.resolve(ranked(board).slice(0, limit));
    },

    getUserBest(board, uid): Promise<LeaderboardEntry | null> {
      const entry = ranked(board).find((e) => e.uid === uid);
      return Promise.resolve(entry ?? null);
    },
  };
}
