import type {
  Board,
  LeaderboardEntry,
  LeaderboardPort,
} from './LeaderboardPort';
import type { AuthUser } from './AuthPort';

/**
 * One stored leaderboard document: a single user's best on a board. The real
 * Firestore layout is a collection per board (`leaderboards/${modeId}:${wall}`)
 * holding one doc per user keyed by uid.
 */
export interface FirestoreScoreDoc {
  uid: string;
  displayName: string;
  score: number;
}

/**
 * The minimal Firestore surface this adapter consumes, injected for testability
 * (see firebaseAuth.ts for the rationale). Production wiring builds it from the
 * modular SDK: getDoc(doc(db, path, uid)), setDoc(...), getDocs(query(
 * collection(db, path), orderBy('score','desc'), limit(n))), and an
 * aggregate count query for ranking. `getTop` MUST return docs ordered desc.
 */
export interface FirebaseFirestoreSdk {
  getDoc(boardPath: string, uid: string): Promise<FirestoreScoreDoc | null>;
  setDoc(boardPath: string, doc: FirestoreScoreDoc): Promise<void>;
  getTop(boardPath: string, limit: number): Promise<FirestoreScoreDoc[]>;
  /** Count of docs on the board with a strictly higher score (for ranking). */
  countAbove(boardPath: string, score: number): Promise<number>;
}

const boardPath = (board: Board): string =>
  `leaderboards/${board.modeId}:${board.wall}`;

const displayNameFor = (user: AuthUser): string =>
  user.displayName ?? 'Anonymous';

/**
 * Firebase-backed LeaderboardPort with offline-safe error handling (EH-14/15/16):
 *  - getTopScores / getUserBest RESOLVE with [] / null on any SDK error (never
 *    reject into the UI); getTopScores also returns the last successful list
 *    from an in-memory cache when available.
 *  - submitScore REJECTS on failure — the submission service (step 44) owns
 *    retry/queue — and writes only when the new score beats the stored best.
 *
 * Server-side Firestore security rules (score validation, rate limiting,
 * one-doc-per-user) are required infrastructure outside the app.
 */
export function createFirebaseLeaderboard(
  sdk: FirebaseFirestoreSdk,
): LeaderboardPort {
  // Last successful top list per board path, returned on a later read failure.
  const topCache = new Map<string, LeaderboardEntry[]>();

  return {
    async submitScore(board, user, score): Promise<void> {
      const path = boardPath(board);
      const existing = await sdk.getDoc(path, user.uid);
      if (!existing || score > existing.score) {
        await sdk.setDoc(path, {
          uid: user.uid,
          displayName: displayNameFor(user),
          score,
        });
      }
    },

    async getTopScores(board, limit): Promise<LeaderboardEntry[]> {
      const path = boardPath(board);
      try {
        const docs = await sdk.getTop(path, limit);
        const entries = docs.map((d, i) => ({ ...d, rank: i + 1 }));
        topCache.set(path, entries);
        return entries;
      } catch {
        return topCache.get(path) ?? [];
      }
    },

    async getUserBest(board, uid): Promise<LeaderboardEntry | null> {
      const path = boardPath(board);
      try {
        const doc = await sdk.getDoc(path, uid);
        if (doc === null) {
          return null;
        }
        const above = await sdk.countAbove(path, doc.score);
        return { ...doc, rank: above + 1 };
      } catch {
        return null;
      }
    },
  };
}
