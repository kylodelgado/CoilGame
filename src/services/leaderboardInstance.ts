import {
  createInMemoryLeaderboard,
  type LeaderboardPort,
} from './LeaderboardPort';

/**
 * App-wide LeaderboardPort singleton, shared by the leaderboard screen and the
 * score submitter. In-memory for now; swap to createFirebaseLeaderboard(...) at
 * the composition root once Firebase is wired.
 */
export const appLeaderboard: LeaderboardPort = createInMemoryLeaderboard();
