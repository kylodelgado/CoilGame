import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStorageAdapter } from '../src/services/asyncStorageAdapter';
import {
  DEFAULT_SCORES,
  DEFAULT_SETTINGS,
  SCORES_KEY,
  SCORES_KEY_V1,
  SETTINGS_KEY,
} from '../src/services/StoragePort';
import type { PersistedScores, PersistedSettings } from '../src/engine/types';

jest.mock('@react-native-async-storage/async-storage', () => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) =>
      Promise.resolve(key in store ? store[key] : null),
    ),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
      return Promise.resolve();
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
      return Promise.resolve();
    }),
    __setRaw: (key: string, value: string) => {
      store[key] = value;
    },
    __reset: () => {
      store = {};
    },
  };
});

// Typed handle to the mock's test helpers.
const mock = AsyncStorage as unknown as {
  getItem: jest.Mock;
  setItem: jest.Mock;
  __setRaw: (key: string, value: string) => void;
  __reset: () => void;
};

beforeEach(() => {
  mock.__reset();
  jest.clearAllMocks();
});

describe('createAsyncStorageAdapter (§8)', () => {
  it('round-trips settings', async () => {
    const adapter = createAsyncStorageAdapter();
    const settings: PersistedSettings = {
      presetId: 'DENSE',
      wallBehavior: 'PORTAL',
      soundEnabled: false,
      hapticsEnabled: true,
      skinId: 'amberCrt',
      controlScheme: 'DPAD',
      modeId: 'DYNAMIC_WALLS',
    };
    await adapter.setSettings(settings);
    await expect(adapter.getSettings()).resolves.toEqual(settings);
    expect(mock.setItem).toHaveBeenCalledWith(
      SETTINGS_KEY,
      JSON.stringify(settings),
    );
  });

  it('round-trips scores', async () => {
    const adapter = createAsyncStorageAdapter();
    const scores: PersistedScores = {
      bests: { 'CLASSIC:SOLID': 150, 'DYNAMIC_WALLS:PORTAL': 90 },
    };
    await adapter.setScores(scores);
    await expect(adapter.getScores()).resolves.toEqual(scores);
    expect(mock.setItem).toHaveBeenCalledWith(
      SCORES_KEY,
      JSON.stringify(scores),
    );
  });

  it('returns defaults (no throw) when stored JSON is corrupt', async () => {
    const adapter = createAsyncStorageAdapter();
    mock.__setRaw(SETTINGS_KEY, '{not valid json');
    mock.__setRaw(SCORES_KEY, '<<<garbage>>>');
    await expect(adapter.getSettings()).resolves.toEqual(DEFAULT_SETTINGS);
    await expect(adapter.getScores()).resolves.toEqual(DEFAULT_SCORES);
  });

  it('returns defaults when keys are missing', async () => {
    const adapter = createAsyncStorageAdapter();
    await expect(adapter.getSettings()).resolves.toEqual(DEFAULT_SETTINGS);
    await expect(adapter.getScores()).resolves.toEqual(DEFAULT_SCORES);
  });

  it('sanitizes out-of-set enums and bad scores via the validators', async () => {
    const adapter = createAsyncStorageAdapter();
    mock.__setRaw(
      SETTINGS_KEY,
      JSON.stringify({
        presetId: 'HUGE',
        wallBehavior: 'PORTAL',
        soundEnabled: 'nope',
        hapticsEnabled: false,
      }),
    );
    mock.__setRaw(
      SCORES_KEY,
      JSON.stringify({ bests: { 'CLASSIC:SOLID': -5, 'CLASSIC:PORTAL': 40 } }),
    );

    await expect(adapter.getSettings()).resolves.toEqual({
      presetId: DEFAULT_SETTINGS.presetId,
      wallBehavior: 'PORTAL',
      soundEnabled: DEFAULT_SETTINGS.soundEnabled,
      hapticsEnabled: false,
      skinId: DEFAULT_SETTINGS.skinId,
      controlScheme: DEFAULT_SETTINGS.controlScheme,
      modeId: DEFAULT_SETTINGS.modeId,
    });
    // The invalid entry is dropped; the valid one survives.
    await expect(adapter.getScores()).resolves.toEqual({
      bests: { 'CLASSIC:PORTAL': 40 },
    });
  });

  it('resetScores writes DEFAULT_SCORES', async () => {
    const adapter = createAsyncStorageAdapter();
    await adapter.setScores({ bests: { 'CLASSIC:SOLID': 99 } });
    await adapter.resetScores();
    expect(mock.setItem).toHaveBeenLastCalledWith(
      SCORES_KEY,
      JSON.stringify(DEFAULT_SCORES),
    );
    await expect(adapter.getScores()).resolves.toEqual(DEFAULT_SCORES);
  });

  it('returns defaults (no throw) when a read rejects', async () => {
    const adapter = createAsyncStorageAdapter();
    mock.getItem.mockRejectedValueOnce(new Error('disk failure'));
    await expect(adapter.getSettings()).resolves.toEqual(DEFAULT_SETTINGS);
  });

  describe('scores v1 -> v2 migration (Prompt 40)', () => {
    it('migrates a legacy v1 blob, persists v2, and returns the migrated record', async () => {
      const adapter = createAsyncStorageAdapter();
      mock.__setRaw(
        SCORES_KEY_V1,
        JSON.stringify({ bestSolid: 120, bestPortal: 80 }),
      );

      await expect(adapter.getScores()).resolves.toEqual({
        bests: { 'CLASSIC:SOLID': 120, 'CLASSIC:PORTAL': 80 },
      });
      // The migrated v2 record is written back to the v2 key.
      expect(mock.setItem).toHaveBeenCalledWith(
        SCORES_KEY,
        JSON.stringify({ bests: { 'CLASSIC:SOLID': 120, 'CLASSIC:PORTAL': 80 } }),
      );
    });

    it('reads v2 directly when present (no migration)', async () => {
      const adapter = createAsyncStorageAdapter();
      mock.__setRaw(SCORES_KEY_V1, JSON.stringify({ bestSolid: 5, bestPortal: 5 }));
      mock.__setRaw(
        SCORES_KEY,
        JSON.stringify({ bests: { 'DYNAMIC_WALLS:SOLID': 200 } }),
      );

      await expect(adapter.getScores()).resolves.toEqual({
        bests: { 'DYNAMIC_WALLS:SOLID': 200 },
      });
    });

    it('returns defaults (no throw) when only a corrupt v1 blob exists', async () => {
      const adapter = createAsyncStorageAdapter();
      mock.__setRaw(SCORES_KEY_V1, '<<<not json>>>');
      await expect(adapter.getScores()).resolves.toEqual(DEFAULT_SCORES);
    });
  });
});
