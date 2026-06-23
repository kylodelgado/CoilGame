import { create } from 'zustand';
import type { AuthPort, AuthUser } from '../services/AuthPort';

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;

  /** Wire an AuthPort and follow its auth-state; returns an unsubscribe. */
  hydrate(auth: AuthPort): () => void;
  signUp(email: string, password: string, displayName: string): Promise<void>;
  signIn(email: string, password: string): Promise<void>;
  signInAnonymously(): Promise<void>;
  signOut(): Promise<void>;
}

/** The AuthPort injected at hydrate time; actions delegate through it. */
let authRef: AuthPort | null = null;

type SetState = (partial: Partial<AuthState>) => void;

/**
 * Run an auth action with loading/error bookkeeping. Errors are captured as a
 * message (never rethrown) so the UI can render them inline rather than crash;
 * the user field updates through the onAuthChange subscription. (EH-16)
 */
async function run(set: SetState, fn: () => Promise<unknown>): Promise<void> {
  set({ loading: true, error: null });
  try {
    await fn();
    set({ loading: false });
  } catch (e) {
    set({
      loading: false,
      error: e instanceof Error ? e.message : 'Something went wrong',
    });
  }
}

/**
 * Auth store: the app-wide source of truth for the current user. Hydrated from
 * an AuthPort's onAuthChange so any sign-in/out (from any screen) is reflected
 * everywhere. Anonymous/local play stays first-class — being signed out is a
 * valid, non-error state.
 */
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,
  error: null,

  hydrate(auth: AuthPort): () => void {
    authRef = auth;
    set({ user: auth.getCurrentUser() });
    return auth.onAuthChange((user) => set({ user }));
  },

  signUp(email, password, displayName): Promise<void> {
    return run(set, () => authRef!.signUp(email, password, displayName));
  },

  signIn(email, password): Promise<void> {
    return run(set, () => authRef!.signIn(email, password));
  },

  signInAnonymously(): Promise<void> {
    return run(set, () => authRef!.signInAnonymously());
  },

  signOut(): Promise<void> {
    return run(set, () => authRef!.signOut());
  },
}));
