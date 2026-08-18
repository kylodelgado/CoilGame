import { useEffect, type ReactNode } from 'react';
import { AppState, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SkinProvider } from '../skins/SkinProvider';
import { createAsyncStorageAdapter } from '../services/asyncStorageAdapter';
import type { StoragePort } from '../services/StoragePort';
import { appAds } from '../services/adsInstance';
import { appMusic } from '../services/musicInstance';
import { appSound } from '../services/soundInstance';
import { useSettingsStore } from '../state/useSettingsStore';
import { useScoresStore } from '../state/useScoresStore';
import { useEntitlementsStore } from '../state/useEntitlementsStore';

interface AppProvidersProps {
  children: ReactNode;
  /** Inject a StoragePort (tests); defaults to the AsyncStorage adapter. */
  storage?: StoragePort;
}

/**
 * App-wide providers, mounted once at the root: the gesture root and the skin
 * provider. On mount it injects a StoragePort and kicks off async store
 * hydration — the stores already render their defaults, so this does not block
 * first paint (NFR-3) — then warms the runtime services: SFX preload, ad SDK
 * init (mock or real), and the ambient music bed, which mirrors the Settings
 * music toggle and pauses whenever the app leaves the foreground.
 */
export function AppProviders({ children, storage }: AppProvidersProps) {
  useEffect(() => {
    const port = storage ?? createAsyncStorageAdapter();
    // Fire-and-forget: defaults are already on screen; values fill in async.
    void useSettingsStore.getState().hydrate(port);
    void useScoresStore.getState().hydrate(port);
    void useEntitlementsStore.getState().hydrate();
    void appAds.initialize().catch(() => undefined);
    void appSound.preload().catch(() => undefined);
  }, [storage]);

  // Music lifecycle: play while (enabled && app active). Every call below is
  // a guarded no-op when the audio native module isn't present.
  useEffect(() => {
    const apply = (): void => {
      const enabled = useSettingsStore.getState().musicEnabled;
      appMusic.setEnabled(enabled);
      const active = AppState.currentState === 'active';
      if (enabled && active) {
        appMusic.playTheme();
      } else {
        appMusic.stop();
      }
    };
    apply();
    const unsubscribeStore = useSettingsStore.subscribe((state, prev) => {
      if (state.musicEnabled !== prev.musicEnabled) {
        apply();
      }
    });
    const appStateSub = AppState.addEventListener('change', apply);
    return () => {
      unsubscribeStore();
      appStateSub.remove();
      appMusic.stop();
    };
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <SkinProvider>{children}</SkinProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
