import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PersistedScores, PersistedSettings } from '../engine/types';
import {
  DEFAULT_SCORES,
  DEFAULT_SETTINGS,
  SCORES_KEY,
  SETTINGS_KEY,
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

    getScores(): Promise<PersistedScores> {
      return readValidated(SCORES_KEY, validateScores, DEFAULT_SCORES);
    },

    setScores(s: PersistedScores): Promise<void> {
      return AsyncStorage.setItem(SCORES_KEY, JSON.stringify(s));
    },

    resetScores(): Promise<void> {
      return AsyncStorage.setItem(SCORES_KEY, JSON.stringify(DEFAULT_SCORES));
    },
  };
}
