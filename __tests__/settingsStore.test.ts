import { useSettingsStore } from '../src/state/useSettingsStore';
import { DEFAULT_SETTINGS } from '../src/services/StoragePort';
import type { StoragePort } from '../src/services/StoragePort';
import type { PersistedSettings } from '../src/engine/types';

function makeMockStorage(
  persisted: PersistedSettings = DEFAULT_SETTINGS,
): jest.Mocked<StoragePort> {
  return {
    getSettings: jest.fn((): Promise<PersistedSettings> =>
      Promise.resolve(persisted),
    ),
    setSettings: jest.fn((_s: PersistedSettings): Promise<void> =>
      Promise.resolve(),
    ),
    getScores: jest.fn(() => Promise.resolve({ bests: {} })),
    setScores: jest.fn((_s) => Promise.resolve()),
    resetScores: jest.fn(() => Promise.resolve()),
  };
}

beforeEach(() => {
  // Reset the singleton store to a clean, unhydrated default.
  useSettingsStore.setState({ ...DEFAULT_SETTINGS, hydrated: false });
});

describe('useSettingsStore', () => {
  it('starts at DEFAULT_SETTINGS with hydrated=false', () => {
    const state = useSettingsStore.getState();
    expect(state.presetId).toBe(DEFAULT_SETTINGS.presetId);
    expect(state.wallBehavior).toBe(DEFAULT_SETTINGS.wallBehavior);
    expect(state.soundEnabled).toBe(DEFAULT_SETTINGS.soundEnabled);
    expect(state.hapticsEnabled).toBe(DEFAULT_SETTINGS.hapticsEnabled);
    expect(state.hydrated).toBe(false);
  });

  it('hydrate loads persisted values and flips hydrated true', async () => {
    const persisted: PersistedSettings = {
      presetId: 'DENSE',
      wallBehavior: 'PORTAL',
      soundEnabled: false,
      hapticsEnabled: false,
      skinId: 'amberCrt',
      controlScheme: 'DPAD',
      modeId: 'DYNAMIC_WALLS',
    };
    const storage = makeMockStorage(persisted);

    await useSettingsStore.getState().hydrate(storage);

    expect(storage.getSettings).toHaveBeenCalledTimes(1);
    const state = useSettingsStore.getState();
    expect(state.presetId).toBe('DENSE');
    expect(state.wallBehavior).toBe('PORTAL');
    expect(state.soundEnabled).toBe(false);
    expect(state.hapticsEnabled).toBe(false);
    expect(state.skinId).toBe('amberCrt');
    expect(state.hydrated).toBe(true);
  });

  it('setPreset updates state and persists the full settings', async () => {
    const storage = makeMockStorage();
    await useSettingsStore.getState().hydrate(storage);
    storage.setSettings.mockClear();

    useSettingsStore.getState().setPreset('CLASSIC');

    expect(useSettingsStore.getState().presetId).toBe('CLASSIC');
    expect(storage.setSettings).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      presetId: 'CLASSIC',
    });
  });

  it('setWall updates state and persists the full settings', async () => {
    const storage = makeMockStorage();
    await useSettingsStore.getState().hydrate(storage);
    storage.setSettings.mockClear();

    useSettingsStore.getState().setWall('PORTAL');

    expect(useSettingsStore.getState().wallBehavior).toBe('PORTAL');
    expect(storage.setSettings).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      wallBehavior: 'PORTAL',
    });
  });

  it('setSound updates state and persists the full settings', async () => {
    const storage = makeMockStorage();
    await useSettingsStore.getState().hydrate(storage);
    storage.setSettings.mockClear();

    useSettingsStore.getState().setSound(false);

    expect(useSettingsStore.getState().soundEnabled).toBe(false);
    expect(storage.setSettings).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      soundEnabled: false,
    });
  });

  it('setHaptics updates state and persists the full settings', async () => {
    const storage = makeMockStorage();
    await useSettingsStore.getState().hydrate(storage);
    storage.setSettings.mockClear();

    useSettingsStore.getState().setHaptics(false);

    expect(useSettingsStore.getState().hapticsEnabled).toBe(false);
    expect(storage.setSettings).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      hapticsEnabled: false,
    });
  });

  it('setSkin updates state and persists the full settings', async () => {
    const storage = makeMockStorage();
    await useSettingsStore.getState().hydrate(storage);
    storage.setSettings.mockClear();

    useSettingsStore.getState().setSkin('neon');

    expect(useSettingsStore.getState().skinId).toBe('neon');
    expect(storage.setSettings).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      skinId: 'neon',
    });
  });

  it('keeps the in-memory value when setSettings rejects (EH-2)', async () => {
    const storage = makeMockStorage();
    await useSettingsStore.getState().hydrate(storage);
    storage.setSettings.mockRejectedValueOnce(new Error('write failed'));

    expect(() => useSettingsStore.getState().setPreset('DENSE')).not.toThrow();
    expect(useSettingsStore.getState().presetId).toBe('DENSE');

    // Flush microtasks so any unhandled rejection would surface.
    await Promise.resolve();
    await Promise.resolve();
    expect(useSettingsStore.getState().presetId).toBe('DENSE');
  });

  it('keeps the in-memory skinId when setSettings rejects (EH-2)', async () => {
    const storage = makeMockStorage();
    await useSettingsStore.getState().hydrate(storage);
    storage.setSettings.mockRejectedValueOnce(new Error('write failed'));

    expect(() => useSettingsStore.getState().setSkin('monoLcd')).not.toThrow();
    expect(useSettingsStore.getState().skinId).toBe('monoLcd');

    await Promise.resolve();
    await Promise.resolve();
    expect(useSettingsStore.getState().skinId).toBe('monoLcd');
  });

  it('setControlScheme updates state and persists the full settings', async () => {
    const storage = makeMockStorage();
    await useSettingsStore.getState().hydrate(storage);
    storage.setSettings.mockClear();

    useSettingsStore.getState().setControlScheme('DPAD');

    expect(useSettingsStore.getState().controlScheme).toBe('DPAD');
    expect(storage.setSettings).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      controlScheme: 'DPAD',
    });
  });
});
