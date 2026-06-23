import Constants from 'expo-constants';

/**
 * Firebase project configuration, read from the Expo app config's `extra.firebase`
 * (set via env at build time — never hardcode secrets in source). Required keys:
 *
 *   apiKey, authDomain, projectId, appId
 *
 * Example app.config.js:
 *   extra: { firebase: {
 *     apiKey: process.env.FIREBASE_API_KEY,
 *     authDomain: process.env.FIREBASE_AUTH_DOMAIN,
 *     projectId: process.env.FIREBASE_PROJECT_ID,
 *     appId: process.env.FIREBASE_APP_ID,
 *   } }
 *
 * Note: a Firebase Web API key is a public client identifier, not a secret —
 * access is enforced by server-side Firestore security rules, which are required
 * infrastructure outside this app.
 */
export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  storageBucket?: string;
  messagingSenderId?: string;
}

const REQUIRED_KEYS = ['apiKey', 'authDomain', 'projectId', 'appId'] as const;

/**
 * Read and validate the Firebase config from expo-constants. Returns null when
 * the config is absent or incomplete, so callers can degrade to local-only play
 * instead of crashing.
 */
export function readFirebaseConfig(): FirebaseConfig | null {
  const extra = Constants.expoConfig?.extra as
    | { firebase?: Record<string, unknown> }
    | undefined;
  const raw = extra?.firebase;
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  for (const key of REQUIRED_KEYS) {
    if (typeof raw[key] !== 'string' || (raw[key] as string).length === 0) {
      return null;
    }
  }
  return raw as unknown as FirebaseConfig;
}
