import type { AuthPort, AuthUser } from './AuthPort';

/**
 * The minimal Firebase Auth surface this adapter consumes. Injecting it (rather
 * than importing `firebase/auth` directly) keeps the adapter pure and testable
 * with a mocked SDK, and avoids coupling the build to the Firebase package.
 *
 * Production wiring (composition root, once `firebase` is a dependency): build
 * this object from the modular SDK against an `Auth` instance created from
 * readFirebaseConfig() — e.g. signInAnonymously(auth), createUserWithEmail-
 * AndPassword(auth, ...), updateProfile(user, { displayName }),
 * signInWithEmailAndPassword(auth, ...), signOut(auth), onAuthStateChanged(auth).
 */
export interface FirebaseUserLike {
  uid: string;
  displayName: string | null;
  isAnonymous: boolean;
}

export interface FirebaseAuthSdk {
  /** The current Firebase user, or null when signed out. */
  currentUser: FirebaseUserLike | null;
  onAuthStateChanged(cb: (user: FirebaseUserLike | null) => void): () => void;
  signInAnonymously(): Promise<{ user: FirebaseUserLike }>;
  createUser(
    email: string,
    password: string,
  ): Promise<{ user: FirebaseUserLike }>;
  updateDisplayName(user: FirebaseUserLike, displayName: string): Promise<void>;
  signInWithPassword(
    email: string,
    password: string,
  ): Promise<{ user: FirebaseUserLike }>;
  signOut(): Promise<void>;
}

const toAuthUser = (u: FirebaseUserLike): AuthUser => ({
  uid: u.uid,
  displayName: u.displayName,
  isAnonymous: u.isAnonymous,
});

/**
 * Firebase-backed AuthPort. Maps Firebase users to AuthUser and wraps the SDK
 * listener. Auth errors propagate as rejections the UI can show as messages
 * (EH-16); since the adapter holds no local auth state, a failed call leaves the
 * user in their prior (SDK) state.
 */
export function createFirebaseAuth(sdk: FirebaseAuthSdk): AuthPort {
  return {
    getCurrentUser(): AuthUser | null {
      return sdk.currentUser ? toAuthUser(sdk.currentUser) : null;
    },

    onAuthChange(cb): () => void {
      return sdk.onAuthStateChanged((u) => cb(u ? toAuthUser(u) : null));
    },

    async signInAnonymously(): Promise<AuthUser> {
      const { user } = await sdk.signInAnonymously();
      return toAuthUser(user);
    },

    async signUp(email, password, displayName): Promise<AuthUser> {
      const { user } = await sdk.createUser(email, password);
      await sdk.updateDisplayName(user, displayName);
      return { uid: user.uid, displayName, isAnonymous: false };
    },

    async signIn(email, password): Promise<AuthUser> {
      const { user } = await sdk.signInWithPassword(email, password);
      return toAuthUser(user);
    },

    signOut(): Promise<void> {
      return sdk.signOut();
    },
  };
}
