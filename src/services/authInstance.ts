import { createInMemoryAuth, type AuthPort } from './AuthPort';

/**
 * App-wide AuthPort singleton, shared by the account UI, the leaderboard, and
 * the score submitter so they observe one identity. In-memory for now (anonymous
 * and email/password work locally); swap to createFirebaseAuth(...) built from
 * readFirebaseConfig() at the composition root once Firebase is wired.
 */
export const appAuth: AuthPort = createInMemoryAuth();
