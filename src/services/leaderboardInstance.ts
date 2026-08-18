import type { LeaderboardPort } from './LeaderboardPort';
import { buildFirebasePorts } from './firebaseSdk';
import { createPersistentLocalLeaderboard } from './localPersistence';

/**
 * App-wide LeaderboardPort singleton, shared by the leaderboard screen and the
 * score submitter. Firebase/Firestore-backed when `extra.firebase` is
 * configured (firebaseSdk.ts); otherwise a device-local persistent board, so
 * scores survive relaunch even fully offline.
 */
export const appLeaderboard: LeaderboardPort =
  buildFirebasePorts()?.leaderboard ?? createPersistentLocalLeaderboard();
