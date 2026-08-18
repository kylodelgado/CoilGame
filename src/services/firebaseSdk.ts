/**
 * Firebase composition root. When `extra.firebase` is configured in the app
 * config (see firebaseConfig.ts), this module initializes the Firebase JS SDK
 * and adapts it onto the app's AuthPort/LeaderboardPort seams via the tested
 * adapters in firebaseAuth.ts / firebaseLeaderboard.ts. When the config is
 * absent it returns null and the app runs on the persistent local ports
 * (localPersistence.ts) — fully offline, nothing crashes, nothing networks.
 *
 * OWNER: to go live, add your Firebase web-app config to app.json:
 *   "extra": { "firebase": {
 *     "apiKey": "...", "authDomain": "...", "projectId": "...", "appId": "..."
 *   } }
 * then create Firestore + Auth (Email/Password + Anonymous) in the console and
 * deploy security rules (see docs/DEPLOYMENT.md).
 */
import type { AuthPort } from './AuthPort';
import type { LeaderboardPort } from './LeaderboardPort';
import { createFirebaseAuth, type FirebaseAuthSdk } from './firebaseAuth';
import {
  createFirebaseLeaderboard,
  type FirebaseFirestoreSdk,
  type FirestoreScoreDoc,
} from './firebaseLeaderboard';
import { readFirebaseConfig } from './firebaseConfig';

export interface FirebasePorts {
  auth: AuthPort;
  leaderboard: LeaderboardPort;
}

let cached: FirebasePorts | null | undefined;

/**
 * Build (once) the Firebase-backed ports, or null when unconfigured/failed.
 * All firebase imports happen lazily inside so an unconfigured app never
 * executes SDK setup, and any init failure degrades to local-only play.
 */
export function buildFirebasePorts(): FirebasePorts | null {
  if (cached !== undefined) {
    return cached;
  }
  const config = readFirebaseConfig();
  if (config === null) {
    cached = null;
    return cached;
  }
  try {
    /* eslint-disable @typescript-eslint/no-var-requires */
    const appMod = require('firebase/app');
    const authMod = require('firebase/auth');
    const fsMod = require('firebase/firestore');
    /* eslint-enable @typescript-eslint/no-var-requires */

    const app =
      appMod.getApps().length > 0
        ? appMod.getApp()
        : appMod.initializeApp(config);

    // React Native persistence (AsyncStorage) so sign-in survives relaunch;
    // fall back to default persistence if the RN entrypoint isn't available.
    let auth: unknown;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const AsyncStorage =
        require('@react-native-async-storage/async-storage').default;
      auth = authMod.initializeAuth(app, {
        persistence: authMod.getReactNativePersistence(AsyncStorage),
      });
    } catch {
      auth = authMod.getAuth(app);
    }
    const db = fsMod.getFirestore(app);

    const authSdk: FirebaseAuthSdk = {
      get currentUser() {
        return (auth as { currentUser: FirebaseAuthSdk['currentUser'] })
          .currentUser;
      },
      onAuthStateChanged(cb) {
        return authMod.onAuthStateChanged(auth, cb) as () => void;
      },
      signInAnonymously: () => authMod.signInAnonymously(auth),
      createUser: (email: string, password: string) =>
        authMod.createUserWithEmailAndPassword(auth, email, password),
      updateDisplayName: (user: unknown, displayName: string) =>
        authMod.updateProfile(user, { displayName }),
      signInWithPassword: (email: string, password: string) =>
        authMod.signInWithEmailAndPassword(auth, email, password),
      signOut: () => authMod.signOut(auth),
    };

    const fsSdk: FirebaseFirestoreSdk = {
      async getDoc(boardPath: string, uid: string) {
        const snap = await fsMod.getDoc(fsMod.doc(db, boardPath, uid));
        return snap.exists() ? (snap.data() as FirestoreScoreDoc) : null;
      },
      async setDoc(boardPath: string, docData: FirestoreScoreDoc) {
        await fsMod.setDoc(fsMod.doc(db, boardPath, docData.uid), docData);
      },
      async getTop(boardPath: string, limitN: number) {
        const q = fsMod.query(
          fsMod.collection(db, boardPath),
          fsMod.orderBy('score', 'desc'),
          fsMod.limit(limitN),
        );
        const snaps = await fsMod.getDocs(q);
        const docs: FirestoreScoreDoc[] = [];
        snaps.forEach((d: { data(): FirestoreScoreDoc }) =>
          docs.push(d.data()),
        );
        return docs;
      },
      async countAbove(boardPath: string, score: number) {
        const q = fsMod.query(
          fsMod.collection(db, boardPath),
          fsMod.where('score', '>', score),
        );
        const snap = await fsMod.getCountFromServer(q);
        return snap.data().count as number;
      },
    };

    const baseAuth = createFirebaseAuth(authSdk);
    const portsAuth: AuthPort = {
      ...baseAuth,
      // App Store 5.1.1(v): in-app account deletion. Firebase may require a
      // recent sign-in; surface its error to the UI, which offers re-auth.
      async deleteAccount(): Promise<void> {
        const user = (auth as { currentUser: { delete(): Promise<void> } | null })
          .currentUser;
        if (user) {
          await user.delete();
        }
      },
    };

    cached = {
      auth: portsAuth,
      leaderboard: createFirebaseLeaderboard(fsSdk),
    };
  } catch {
    // Any init failure (bad config, missing native pieces) → local-only play.
    cached = null;
  }
  return cached;
}
