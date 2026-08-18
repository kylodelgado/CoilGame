/**
 * AsyncStorage-persistent implementations of AuthPort and LeaderboardPort —
 * the app's OFFLINE mode. Semantics mirror the in-memory fakes (AuthPort.ts /
 * LeaderboardPort.ts) exactly, plus a fire-and-forget save after every state
 * change and a lazy hydrate before the first read, so accounts and the local
 * leaderboard survive relaunch. When Firebase is configured these are not used
 * (see firebaseSdk.ts).
 *
 * NOTE: the credential registry lives in device-local storage in plain form.
 * This is acceptable for the offline stub ONLY because it never leaves the
 * device and secures nothing but a local scoreboard; production accounts run
 * on Firebase Auth (passwords never stored by the app). Storage failures are
 * swallowed (EH-2): the session stays correct in memory.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AuthPort, AuthUser } from './AuthPort';
import type {
  Board,
  LeaderboardEntry,
  LeaderboardPort,
} from './LeaderboardPort';

export const LOCAL_AUTH_KEY = 'coil.localauth.v1';
export const LOCAL_BOARD_KEY = 'coil.localboard.v1';

interface AuthBlob {
  current: AuthUser | null;
  anonCounter: number;
  credentials: Array<{ email: string; password: string; user: AuthUser }>;
}

interface BoardRecord {
  uid: string;
  displayName: string;
  score: number;
}

type BoardBlob = Record<string, Record<string, BoardRecord>>;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isAuthUser(v: unknown): v is AuthUser {
  return (
    isRecord(v) &&
    typeof v.uid === 'string' &&
    (v.displayName === null || typeof v.displayName === 'string') &&
    typeof v.isAnonymous === 'boolean'
  );
}

/** Persistent AuthPort mirroring createInMemoryAuth's behavior. */
export function createPersistentLocalAuth(
  storage: Pick<typeof AsyncStorage, 'getItem' | 'setItem'> = AsyncStorage,
): AuthPort {
  let current: AuthUser | null = null;
  let anonCounter = 0;
  const listeners = new Set<(user: AuthUser | null) => void>();
  const credentials = new Map<
    string,
    { password: string; user: AuthUser }
  >();

  let loaded: Promise<void> | null = null;
  const ensureLoaded = (): Promise<void> => {
    if (loaded === null) {
      loaded = (async () => {
        try {
          const raw = await storage.getItem(LOCAL_AUTH_KEY);
          if (raw === null) {
            return;
          }
          const blob = JSON.parse(raw) as unknown;
          if (!isRecord(blob)) {
            return;
          }
          if (isAuthUser(blob.current) || blob.current === null) {
            current = (blob.current as AuthUser | null) ?? null;
          }
          if (
            typeof blob.anonCounter === 'number' &&
            Number.isInteger(blob.anonCounter) &&
            blob.anonCounter >= 0
          ) {
            anonCounter = blob.anonCounter;
          }
          if (Array.isArray(blob.credentials)) {
            for (const c of blob.credentials) {
              if (
                isRecord(c) &&
                typeof c.email === 'string' &&
                typeof c.password === 'string' &&
                isAuthUser(c.user)
              ) {
                credentials.set(c.email, {
                  password: c.password,
                  user: c.user,
                });
              }
            }
          }
          if (current !== null) {
            listeners.forEach((cb) => cb(current));
          }
        } catch {
          // Corrupt blob → fresh state. (EH-1)
        }
      })();
    }
    return loaded;
  };
  // Begin hydrating immediately so getCurrentUser converges fast.
  void ensureLoaded();

  const save = (): void => {
    const blob: AuthBlob = {
      current,
      anonCounter,
      credentials: [...credentials.entries()].map(([email, r]) => ({
        email,
        password: r.password,
        user: r.user,
      })),
    };
    storage.setItem(LOCAL_AUTH_KEY, JSON.stringify(blob)).catch(() => undefined);
  };

  const setCurrent = (user: AuthUser | null): void => {
    current = user;
    listeners.forEach((cb) => cb(current));
    save();
  };

  return {
    getCurrentUser(): AuthUser | null {
      return current;
    },

    onAuthChange(cb): () => void {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },

    async signInAnonymously(): Promise<AuthUser> {
      await ensureLoaded();
      anonCounter += 1;
      const user: AuthUser = {
        uid: `anon-${anonCounter}`,
        displayName: null,
        isAnonymous: true,
      };
      setCurrent(user);
      return user;
    },

    async signUp(email, password, displayName): Promise<AuthUser> {
      await ensureLoaded();
      if (credentials.has(email)) {
        throw new Error('email already in use');
      }
      const user: AuthUser = {
        uid: `user-${email}`,
        displayName,
        isAnonymous: false,
      };
      credentials.set(email, { password, user });
      setCurrent(user);
      return user;
    },

    async signIn(email, password): Promise<AuthUser> {
      await ensureLoaded();
      const record = credentials.get(email);
      if (!record || record.password !== password) {
        throw new Error('invalid email or password');
      }
      setCurrent(record.user);
      return record.user;
    },

    async signOut(): Promise<void> {
      await ensureLoaded();
      setCurrent(null);
    },

    async deleteAccount(): Promise<void> {
      await ensureLoaded();
      if (current !== null) {
        for (const [email, record] of credentials) {
          if (record.user.uid === current.uid) {
            credentials.delete(email);
          }
        }
      }
      setCurrent(null);
    },
  };
}

/** Persistent LeaderboardPort mirroring createInMemoryLeaderboard. */
export function createPersistentLocalLeaderboard(
  storage: Pick<typeof AsyncStorage, 'getItem' | 'setItem'> = AsyncStorage,
): LeaderboardPort {
  const boards = new Map<string, Map<string, BoardRecord>>();

  let loaded: Promise<void> | null = null;
  const ensureLoaded = (): Promise<void> => {
    if (loaded === null) {
      loaded = (async () => {
        try {
          const raw = await storage.getItem(LOCAL_BOARD_KEY);
          if (raw === null) {
            return;
          }
          const blob = JSON.parse(raw) as unknown;
          if (!isRecord(blob)) {
            return;
          }
          for (const [key, recs] of Object.entries(blob as BoardBlob)) {
            if (!isRecord(recs)) {
              continue;
            }
            const map = new Map<string, BoardRecord>();
            for (const [uid, r] of Object.entries(recs)) {
              if (
                isRecord(r) &&
                typeof r.uid === 'string' &&
                typeof r.displayName === 'string' &&
                typeof r.score === 'number' &&
                Number.isInteger(r.score) &&
                r.score >= 0
              ) {
                map.set(uid, {
                  uid: r.uid,
                  displayName: r.displayName,
                  score: r.score,
                });
              }
            }
            boards.set(key, map);
          }
        } catch {
          // Corrupt blob → empty boards. (EH-1)
        }
      })();
    }
    return loaded;
  };
  void ensureLoaded();

  const save = (): void => {
    const blob: BoardBlob = {};
    for (const [key, map] of boards) {
      blob[key] = {};
      for (const [uid, r] of map) {
        blob[key][uid] = r;
      }
    }
    storage
      .setItem(LOCAL_BOARD_KEY, JSON.stringify(blob))
      .catch(() => undefined);
  };

  const boardKey = (board: Board): string => `${board.modeId}:${board.wall}`;

  const recordsFor = (board: Board): Map<string, BoardRecord> => {
    const key = boardKey(board);
    let map = boards.get(key);
    if (!map) {
      map = new Map();
      boards.set(key, map);
    }
    return map;
  };

  const ranked = (board: Board): LeaderboardEntry[] => {
    const sorted = [...recordsFor(board).values()].sort(
      (a, b) => b.score - a.score,
    );
    return sorted.map((r, i) => ({ ...r, rank: i + 1 }));
  };

  return {
    async submitScore(board, user, score): Promise<void> {
      await ensureLoaded();
      const map = recordsFor(board);
      const existing = map.get(user.uid);
      if (!existing || score > existing.score) {
        map.set(user.uid, {
          uid: user.uid,
          displayName: user.displayName ?? 'Anonymous',
          score,
        });
        save();
      }
    },

    async getTopScores(board, limit): Promise<LeaderboardEntry[]> {
      await ensureLoaded();
      return ranked(board).slice(0, limit);
    },

    async getUserBest(board, uid): Promise<LeaderboardEntry | null> {
      await ensureLoaded();
      return ranked(board).find((e) => e.uid === uid) ?? null;
    },
  };
}
