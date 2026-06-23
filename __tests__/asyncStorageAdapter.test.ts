import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStorageAdapter } from '../src/services/asyncStorageAdapter';
import {
  DEFAULT_SCORES,
  DEFAULT_SETTINGS,
  SCORES_KEY,
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
    const scores: PersistedScores = { bestSolid: 150, bestPortal: 90 };
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
      JSON.stringify({ bestSolid: -5, bestPortal: 3.5 }),
    );

    await expect(adapter.getSettings()).resolves.toEqual({
      presetId: DEFAULT_SETTINGS.presetId,
      wallBehavior: 'PORTAL',
      soundEnabled: DEFAULT_SETTINGS.soundEnabled,
      hapticsEnabled: false,
    });
    await expect(adapter.getScores()).resolves.toEqual({
      bestSolid: 0,
      bestPortal: 0,
    });
  });

  it('resetScores writes DEFAULT_SCORES', async () => {
    const adapter = createAsyncStorageAdapter();
    await adapter.setScores({ bestSolid: 99, bestPortal: 42 });
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
});
