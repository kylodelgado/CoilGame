import {
  createFirebaseAuth,
  type FirebaseAuthSdk,
  type FirebaseUserLike,
} from '../src/services/firebaseAuth';
import {
  createFirebaseLeaderboard,
  type FirebaseFirestoreSdk,
  type FirestoreScoreDoc,
} from '../src/services/firebaseLeaderboard';
import type { AuthUser } from '../src/services/AuthPort';
import type { Board } from '../src/services/LeaderboardPort';

const SOLID: Board = { modeId: 'CLASSIC', wall: 'SOLID' };

// ── Auth ────────────────────────────────────────────────────────────────────
function makeAuthSdk(): FirebaseAuthSdk & {
  emit(user: FirebaseUserLike | null): void;
} {
  let listener: ((u: FirebaseUserLike | null) => void) | null = null;
  return {
    currentUser: null,
    onAuthStateChanged: jest.fn((cb) => {
      listener = cb;
      return () => {
        listener = null;
      };
    }),
    signInAnonymously: jest.fn(() =>
      Promise.resolve({
        user: { uid: 'a1', displayName: null, isAnonymous: true },
      }),
    ),
    createUser: jest.fn(() =>
      Promise.resolve({
        user: { uid: 'u1', displayName: null, isAnonymous: false },
      }),
    ),
    updateDisplayName: jest.fn(() => Promise.resolve()),
    signInWithPassword: jest.fn(() =>
      Promise.resolve({
        user: { uid: 'u1', displayName: 'Ada', isAnonymous: false },
      }),
    ),
    signOut: jest.fn(() => Promise.resolve()),
    emit(user) {
      listener?.(user);
    },
  };
}

describe('createFirebaseAuth (mapped + offline-safe)', () => {
  it('maps anonymous, signUp, and signIn results to AuthUser', async () => {
    const sdk = makeAuthSdk();
    const auth = createFirebaseAuth(sdk);

    await expect(auth.signInAnonymously()).resolves.toEqual<AuthUser>({
      uid: 'a1',
      displayName: null,
      isAnonymous: true,
    });

    await expect(auth.signUp('a@b.com', 'pw', 'Ada')).resolves.toEqual<AuthUser>(
      { uid: 'u1', displayName: 'Ada', isAnonymous: false },
    );
    expect(sdk.updateDisplayName).toHaveBeenCalled();

    await expect(auth.signIn('a@b.com', 'pw')).resolves.toEqual<AuthUser>({
      uid: 'u1',
      displayName: 'Ada',
      isAnonymous: false,
    });
  });

  it('forwards mapped auth-state changes and unsubscribes', () => {
    const sdk = makeAuthSdk();
    const auth = createFirebaseAuth(sdk);
    const seen: Array<AuthUser | null> = [];
    const unsub = auth.onAuthChange((u) => seen.push(u));

    sdk.emit({ uid: 'x', displayName: 'X', isAnonymous: false });
    sdk.emit(null);
    expect(seen).toEqual([
      { uid: 'x', displayName: 'X', isAnonymous: false },
      null,
    ]);

    unsub();
    sdk.emit({ uid: 'y', displayName: 'Y', isAnonymous: false });
    expect(seen).toHaveLength(2); // no further deliveries
  });

  it('getCurrentUser maps the SDK current user (or null)', () => {
    const sdk = makeAuthSdk();
    const auth = createFirebaseAuth(sdk);
    expect(auth.getCurrentUser()).toBeNull();

    sdk.currentUser = { uid: 'z', displayName: null, isAnonymous: true };
    expect(auth.getCurrentUser()).toEqual({
      uid: 'z',
      displayName: null,
      isAnonymous: true,
    });
  });

  it('surfaces auth errors as rejections without crashing the module', async () => {
    const sdk = makeAuthSdk();
    sdk.signInWithPassword = jest.fn(() =>
      Promise.reject(new Error('auth/wrong-password')),
    );
    const auth = createFirebaseAuth(sdk);

    await expect(auth.signIn('a@b.com', 'bad')).rejects.toThrow(
      'auth/wrong-password',
    );
    // The adapter is still usable afterward.
    await expect(auth.signInAnonymously()).resolves.toMatchObject({
      isAnonymous: true,
    });
  });
});

// ── Leaderboard ───────────────────────────────────────────────────────────────
function makeFirestoreSdk(
  docs: FirestoreScoreDoc[] = [],
): FirebaseFirestoreSdk & { written: FirestoreScoreDoc[] } {
  const written: FirestoreScoreDoc[] = [];
  const byUid = new Map(docs.map((d) => [d.uid, d]));
  return {
    written,
    getDoc: jest.fn((_path: string, uid: string) =>
      Promise.resolve(byUid.get(uid) ?? null),
    ),
    setDoc: jest.fn((_path: string, doc: FirestoreScoreDoc) => {
      written.push(doc);
      byUid.set(doc.uid, doc);
      return Promise.resolve();
    }),
    getTop: jest.fn((_path: string, limit: number) =>
      Promise.resolve(
        [...byUid.values()].sort((a, b) => b.score - a.score).slice(0, limit),
      ),
    ),
    countAbove: jest.fn((_path: string, score: number) =>
      Promise.resolve(
        [...byUid.values()].filter((d) => d.score > score).length,
      ),
    ),
  };
}

const user = (uid: string, displayName: string | null): AuthUser => ({
  uid,
  displayName,
  isAnonymous: displayName === null,
});

describe('createFirebaseLeaderboard (offline-safe reads)', () => {
  it('submitScore writes only when the new score beats the stored best', async () => {
    const sdk = makeFirestoreSdk([
      { uid: 'u1', displayName: 'Ada', score: 100 },
    ]);
    const lb = createFirebaseLeaderboard(sdk);

    await lb.submitScore(SOLID, user('u1', 'Ada'), 50); // lower
    expect(sdk.setDoc).not.toHaveBeenCalled();

    await lb.submitScore(SOLID, user('u1', 'Ada'), 150); // higher
    expect(sdk.setDoc).toHaveBeenCalledTimes(1);
    expect(sdk.written[0]).toEqual({ uid: 'u1', displayName: 'Ada', score: 150 });

    // A brand-new user always writes.
    await lb.submitScore(SOLID, user('u2', 'Bo'), 10);
    expect(sdk.written.at(-1)).toEqual({ uid: 'u2', displayName: 'Bo', score: 10 });
  });

  it('submitScore rejects on SDK failure (the submitter owns retry)', async () => {
    const sdk = makeFirestoreSdk();
    sdk.getDoc = jest.fn(() => Promise.reject(new Error('offline')));
    const lb = createFirebaseLeaderboard(sdk);

    await expect(lb.submitScore(SOLID, user('u1', 'Ada'), 10)).rejects.toThrow(
      'offline',
    );
  });

  it('getTopScores returns ranked, limited, descending entries', async () => {
    const sdk = makeFirestoreSdk([
      { uid: 'u1', displayName: 'Ada', score: 100 },
      { uid: 'u2', displayName: 'Bo', score: 300 },
      { uid: 'u3', displayName: 'Cy', score: 200 },
    ]);
    const lb = createFirebaseLeaderboard(sdk);

    const top = await lb.getTopScores(SOLID, 2);
    expect(top).toEqual([
      { uid: 'u2', displayName: 'Bo', score: 300, rank: 1 },
      { uid: 'u3', displayName: 'Cy', score: 200, rank: 2 },
    ]);
  });

  it('getUserBest returns the entry with its rank, or null when absent', async () => {
    const sdk = makeFirestoreSdk([
      { uid: 'u1', displayName: 'Ada', score: 100 },
      { uid: 'u2', displayName: 'Bo', score: 300 },
    ]);
    const lb = createFirebaseLeaderboard(sdk);

    await expect(lb.getUserBest(SOLID, 'u1')).resolves.toEqual({
      uid: 'u1',
      displayName: 'Ada',
      score: 100,
      rank: 2,
    });
    await expect(lb.getUserBest(SOLID, 'nobody')).resolves.toBeNull();
  });

  it('reads resolve offline-safe: [] / null on SDK error, never reject', async () => {
    const sdk = makeFirestoreSdk();
    sdk.getTop = jest.fn(() => Promise.reject(new Error('offline')));
    sdk.getDoc = jest.fn(() => Promise.reject(new Error('offline')));
    const lb = createFirebaseLeaderboard(sdk);

    await expect(lb.getTopScores(SOLID, 10)).resolves.toEqual([]);
    await expect(lb.getUserBest(SOLID, 'u1')).resolves.toBeNull();
  });

  it('returns the last successful top list on a later read failure (in-memory cache)', async () => {
    const sdk = makeFirestoreSdk([
      { uid: 'u2', displayName: 'Bo', score: 300 },
    ]);
    const lb = createFirebaseLeaderboard(sdk);

    const first = await lb.getTopScores(SOLID, 10);
    expect(first).toHaveLength(1);

    sdk.getTop = jest.fn(() => Promise.reject(new Error('offline')));
    await expect(lb.getTopScores(SOLID, 10)).resolves.toEqual(first);
  });
});
