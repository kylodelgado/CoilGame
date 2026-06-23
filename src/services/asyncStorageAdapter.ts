import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PersistedScores, PersistedSettings } from '../engine/types';
import {
  DEFAULT_SCORES,
  DEFAULT_SETTINGS,
  SCORES_KEY,
  SCORES_KEY_V1,
  SETTINGS_KEY,
  migrateScores,
  validateScores,
  validateSettings,
  type StoragePort,
} from './StoragePort';

/**
 * Read a JSON value from a key and run it through a validator. Never throws into
 * the caller: any read or parse failure degrades to the provided default. The
 * validator additionally sanitizes malformed-but-parseable data. (§8, EH-1)
 */
async function readValidated<T>(
  key: string,
  validate: (raw: unknown) => T,
  fallback: T,
): Promise<T> {
  try {
    const stored = await AsyncStorage.getItem(key);
    if (stored === null) {
      return fallback;
    }
    return validate(JSON.parse(stored));
  } catch {
    return fallback;
  }
}

/**
 * Concrete AsyncStorage-backed StoragePort. Serializes to the versioned keys and
 * validates on read so the rest of the app never sees malformed data. Reads
 * never throw; writes may reject and let the rejection propagate so the store
 * layer can decide on retry / in-memory fallback. (§8)
 */
export function createAsyncStorageAdapter(): StoragePort {
  return {
    getSettings(): Promise<PersistedSettings> {
      return readValidated(SETTINGS_KEY, validateSettings, DEFAULT_SETTINGS);
    },

    setSettings(s: PersistedSettings): Promise<void> {
      return AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    },

    async getScores(): Promise<PersistedScores> {
      try {
        // Prefer the current v2 record.
        const v2 = await AsyncStorage.getItem(SCORES_KEY);
        if (v2 !== null) {
          return validateScores(JSON.parse(v2));
        }
        // No v2 yet: migrate a legacy v1 blob forward (and persist it), if any.
        const v1 = await AsyncStorage.getItem(SCORES_KEY_V1);
        if (v1 !== null) {
          const migrated = migrateScores(JSON.parse(v1));
          try {
            await AsyncStorage.setItem(SCORES_KEY, JSON.stringify(migrated));
          } catch {
            // Best-effort write-back; returning the migrated value still works.
          }
          return migrated;
        }
        return { ...DEFAULT_SCORES };
      } catch {
        return { ...DEFAULT_SCORES };
      }
    },

    setScores(s: PersistedScores): Promise<void> {
      return AsyncStorage.setItem(SCORES_KEY, JSON.stringify(s));
    },

    resetScores(): Promise<void> {
      return AsyncStorage.setItem(SCORES_KEY, JSON.stringify(DEFAULT_SCORES));
    },
  };
}
