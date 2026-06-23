import type { AuthPort, AuthUser } from './AuthPort';
import type { Board, LeaderboardPort } from './LeaderboardPort';

/** Cap on the best-effort retry queue so a long offline streak can't grow it unbounded. */
const MAX_QUEUE = 20;

export interface ScoreSubmitter {
  /** Fire-and-forget leaderboard submission; never throws, never blocks. */
  submit(board: Board, score: number): void;
}

interface QueuedSubmission {
  board: Board;
  user: AuthUser;
  score: number;
}

/**
 * Offline-safe leaderboard submission for the terminal flow (EH-14). It runs
 * AFTER local recordRun + the terminal dispatch and must never gate navigation:
 *  - No current user => no-op (local-only play stays first-class).
 *  - Otherwise submit fire-and-forget, swallowing rejections.
 *  - Failed submissions are queued (capped, best-effort) and retried on the next
 *    submit, so a score earned offline can still land once connectivity returns.
 */
export function createScoreSubmitter(deps: {
  auth: AuthPort;
  leaderboard: LeaderboardPort;
}): ScoreSubmitter {
  const { auth, leaderboard } = deps;
  const queue: QueuedSubmission[] = [];

  const attempt = (item: QueuedSubmission): void => {
    leaderboard.submitScore(item.board, item.user, item.score).catch(() => {
      // Swallow: never surface a submission failure to the UI. Requeue for a
      // later best-effort retry, dropping the oldest if we are at the cap.
      if (queue.length >= MAX_QUEUE) {
        queue.shift();
      }
      queue.push(item);
    });
  };

  const flush = (): void => {
    if (queue.length === 0) {
      return;
    }
    const pending = queue.splice(0, queue.length);
    for (const item of pending) {
      attempt(item);
    }
  };

  return {
    submit(board, score): void {
      const user = auth.getCurrentUser();
      if (user === null) {
        return; // local-only; nothing to submit
      }
      flush(); // best-effort retry of earlier failures first
      attempt({ board, user, score });
    },
  };
}
