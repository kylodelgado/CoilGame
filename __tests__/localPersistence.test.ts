/**
 * Persistent local AuthPort/LeaderboardPort (offline mode): fake-storage
 * round-trips, corrupt-blob resilience, and semantic parity with the
 * in-memory fakes they mirror.
 */
import {
  createPersistentLocalAuth,
  createPersistentLocalLeaderboard,
  LOCAL_AUTH_KEY,
  LOCAL_BOARD_KEY,
} from '../src/services/localPersistence';
import type { Board } from '../src/services/LeaderboardPort';

function makeFakeStorage(initial: Record<string, string> = {}) {
  const data = new Map<string, string>(Object.entries(initial));
  return {
    data,
    getItem: jest.fn((k: string) => Promise.resolve(data.get(k) ?? null)),
    setItem: jest.fn((k: string, v: string) => {
      data.set(k, v);
      return Promise.resolve();
    }),
  };
}

const BOARD: Board = { modeId: 'CLASSIC', wall: 'SOLID' };

describe('createPersistentLocalAuth', () => {
  it('persists sign-up and restores the session in a new instance', async () => {
    const storage = makeFakeStorage();
    const auth = createPersistentLocalAuth(storage);
    await auth.signUp('a@b.c', 'hunter22', 'Ada');

    const restored = createPersistentLocalAuth(storage);
    // Wait for lazy hydration via an async method.
    await restored.signOut();
    const again = await restored.signIn('a@b.c', 'hunter22');
    expect(again.displayName).toBe('Ada');
  });

  it('restores the signed-in user and notifies listeners on hydrate', async () => {
    const storage = makeFakeStorage();
    const auth = createPersistentLocalAuth(storage);
    await auth.signInAnonymously();

    const restored = createPersistentLocalAuth(storage);
    const seen: Array<string | null> = [];
    restored.onAuthChange((u) => seen.push(u?.uid ?? null));
    // Drain microtasks so hydration completes.
    await new Promise((r) => setTimeout(r, 0));
    expect(restored.getCurrentUser()?.uid).toBe('anon-1');
    expect(seen).toContain('anon-1');
  });

  it('deleteAccount removes the credential permanently across instances', async () => {
    const storage = makeFakeStorage();
    const auth = createPersistentLocalAuth(storage);
    await auth.signUp('x@y.z', 'password9', 'Xan');
    await auth.deleteAccount?.();

    const restored = createPersistentLocalAuth(storage);
    await expect(restored.signIn('x@y.z', 'password9')).rejects.toThrow(
      'invalid email or password',
    );
  });

  it('corrupt stored blob degrades to fresh state without throwing', async () => {
    const storage = makeFakeStorage({ [LOCAL_AUTH_KEY]: '{not json' });
    const auth = createPersistentLocalAuth(storage);
    const user = await auth.signInAnonymously();
    expect(user.uid).toBe('anon-1');
  });

  it('anon counter continues across instances (no uid reuse)', async () => {
    const storage = makeFakeStorage();
    const a1 = createPersistentLocalAuth(storage);
    await a1.signInAnonymously();
    const a2 = createPersistentLocalAuth(storage);
    const u2 = await a2.signInAnonymously();
    expect(u2.uid).toBe('anon-2');
  });
});

describe('createPersistentLocalLeaderboard', () => {
  const USER = { uid: 'u1', displayName: 'Ada', isAnonymous: false };

  it('persists submitted scores and restores them in a new instance', async () => {
    const storage = makeFakeStorage();
    const lb = createPersistentLocalLeaderboard(storage);
    await lb.submitScore(BOARD, USER, 120);

    const restored = createPersistentLocalLeaderboard(storage);
    const top = await restored.getTopScores(BOARD, 10);
    expect(top).toEqual([
      { uid: 'u1', displayName: 'Ada', score: 120, rank: 1 },
    ]);
  });

  it('keeps only each user best and ranks descending', async () => {
    const storage = makeFakeStorage();
    const lb = createPersistentLocalLeaderboard(storage);
    await lb.submitScore(BOARD, USER, 120);
    await lb.submitScore(BOARD, USER, 90); // lower — ignored
    await lb.submitScore(
      BOARD,
      { uid: 'u2', displayName: null, isAnonymous: true },
      150,
    );
    const top = await lb.getTopScores(BOARD, 10);
    expect(top.map((e) => [e.uid, e.score, e.rank])).toEqual([
      ['u2', 150, 1],
      ['u1', 120, 2],
    ]);
    expect(top[0].displayName).toBe('Anonymous');
  });

  it('boards are independent and getUserBest finds the right row', async () => {
    const storage = makeFakeStorage();
    const lb = createPersistentLocalLeaderboard(storage);
    const other: Board = { modeId: 'GPS', wall: 'PORTAL' };
    await lb.submitScore(BOARD, USER, 100);
    await lb.submitScore(other, USER, 300);
    expect((await lb.getUserBest(BOARD, 'u1'))?.score).toBe(100);
    expect((await lb.getUserBest(other, 'u1'))?.score).toBe(300);
    expect(await lb.getUserBest(BOARD, 'nobody')).toBeNull();
  });

  it('corrupt stored blob degrades to empty boards without throwing', async () => {
    const storage = makeFakeStorage({ [LOCAL_BOARD_KEY]: '[[[' });
    const lb = createPersistentLocalLeaderboard(storage);
    expect(await lb.getTopScores(BOARD, 5)).toEqual([]);
  });
});
