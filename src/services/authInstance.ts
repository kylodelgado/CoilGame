import type { AuthPort } from './AuthPort';
import { buildFirebasePorts } from './firebaseSdk';
import { createPersistentLocalAuth } from './localPersistence';

/**
 * App-wide AuthPort singleton, shared by the account UI, the leaderboard, and
 * the score submitter so they observe one identity. Firebase-backed when
 * `extra.firebase` is configured (firebaseSdk.ts); otherwise a device-local
 * persistent implementation, so accounts survive relaunch even fully offline.
 */
export const appAuth: AuthPort =
  buildFirebasePorts()?.auth ?? createPersistentLocalAuth();
