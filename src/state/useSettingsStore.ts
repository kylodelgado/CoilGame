import { create } from 'zustand';
import type { PersistedSettings, PresetId, WallBehavior } from '../engine/types';
import type { SkinId } from '../skins/registry';
import { DEFAULT_SETTINGS, type StoragePort } from '../services/StoragePort';

interface SettingsState {
  presetId: PresetId;
  wallBehavior: WallBehavior;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  skinId: SkinId;
  hydrated: boolean;

  hydrate(storage: StoragePort): Promise<void>;
  setPreset(p: PresetId): void;
  setWall(w: WallBehavior): void;
  setSound(on: boolean): void;
  setHaptics(on: boolean): void;
  setSkin(id: SkinId): void;
}

/** The StoragePort injected at hydrate time; setters persist through it. */
let storageRef: StoragePort | null = null;

/** Extract the persistable slice of the current state. */
function toPersisted(state: SettingsState): PersistedSettings {
  return {
    presetId: state.presetId,
    wallBehavior: state.wallBehavior,
    soundEnabled: state.soundEnabled,
    hapticsEnabled: state.hapticsEnabled,
    skinId: state.skinId,
  };
}

/**
 * Settings store: renders DEFAULT_SETTINGS immediately (NFR-3) and hydrates
 * asynchronously through an injected StoragePort. Every setter updates state
 * synchronously then fire-and-forget persists the full settings; a rejected
 * write is swallowed and the in-memory value is kept. (EH-2)
 */
export const useSettingsStore = create<SettingsState>((set, get) => {
  // Persist the current full settings; never blocks, never throws.
  const persist = (): void => {
    storageRef?.setSettings(toPersisted(get())).catch(() => undefined);
  };

  return {
    ...DEFAULT_SETTINGS,
    hydrated: false,

    async hydrate(storage: StoragePort): Promise<void> {
      storageRef = storage;
      const loaded = await storage.getSettings();
      set({ ...loaded, hydrated: true });
    },

    setPreset(p: PresetId): void {
      set({ presetId: p });
      persist();
    },

    setWall(w: WallBehavior): void {
      set({ wallBehavior: w });
      persist();
    },

    setSound(on: boolean): void {
      set({ soundEnabled: on });
      persist();
    },

    setHaptics(on: boolean): void {
      set({ hapticsEnabled: on });
      persist();
    },

    setSkin(id: SkinId): void {
      set({ skinId: id });
      persist();
    },
  };
});
