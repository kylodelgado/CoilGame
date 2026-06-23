/**
 * Authentication contract for Coil's online features. Kept separate from
 * StoragePort (local persistence): identity and local bests are different
 * concerns. A Firebase adapter implements this in step 43; the in-memory fake
 * below makes all downstream logic (submission, screens, gating) testable
 * without a network. (Chunk K)
 */
export interface AuthUser {
  uid: string;
  displayName: string | null;
  isAnonymous: boolean;
}

export interface AuthPort {
  getCurrentUser(): AuthUser | null;
  /** Subscribe to auth-state changes; returns an unsubscribe function. */
  onAuthChange(cb: (user: AuthUser | null) => void): () => void;
  signInAnonymously(): Promise<AuthUser>;
  signUp(email: string, password: string, displayName: string): Promise<AuthUser>;
  signIn(email: string, password: string): Promise<AuthUser>;
  signOut(): Promise<void>;
}

/**
 * Deterministic, network-free AuthPort fake. Maintains a current user, a set of
 * listeners (notified on every state change), and an in-memory credential
 * registry so signUp/signIn round-trip. Anonymous uids use a monotonic counter
 * (no Date.now/Math.random), so behavior is reproducible in tests.
 */
export function createInMemoryAuth(): AuthPort {
  let current: AuthUser | null = null;
  let anonCounter = 0;
  const listeners = new Set<(user: AuthUser | null) => void>();
  const credentials = new Map<
    string,
    { password: string; user: AuthUser }
  >();

  const setCurrent = (user: AuthUser | null): void => {
    current = user;
    listeners.forEach((cb) => cb(current));
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

    signInAnonymously(): Promise<AuthUser> {
      anonCounter += 1;
      const user: AuthUser = {
        uid: `anon-${anonCounter}`,
        displayName: null,
        isAnonymous: true,
      };
      setCurrent(user);
      return Promise.resolve(user);
    },

    signUp(email, password, displayName): Promise<AuthUser> {
      if (credentials.has(email)) {
        return Promise.reject(new Error('email already in use'));
      }
      const user: AuthUser = {
        uid: `user-${email}`,
        displayName,
        isAnonymous: false,
      };
      credentials.set(email, { password, user });
      setCurrent(user);
      return Promise.resolve(user);
    },

    signIn(email, password): Promise<AuthUser> {
      const record = credentials.get(email);
      if (!record || record.password !== password) {
        return Promise.reject(new Error('invalid email or password'));
      }
      setCurrent(record.user);
      return Promise.resolve(record.user);
    },

    signOut(): Promise<void> {
      setCurrent(null);
      return Promise.resolve();
    },
  };
}
