import { useEffect, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SkinProvider } from '../skins/SkinProvider';
import { createAsyncStorageAdapter } from '../services/asyncStorageAdapter';
import type { StoragePort } from '../services/StoragePort';
import { useSettingsStore } from '../state/useSettingsStore';
import { useScoresStore } from '../state/useScoresStore';

interface AppProvidersProps {
  children: ReactNode;
  /** Inject a StoragePort (tests); defaults to the AsyncStorage adapter. */
  storage?: StoragePort;
}

/**
 * App-wide providers, mounted once at the root: the gesture root and the skin
 * provider. On mount it injects a StoragePort and kicks off async store
 * hydration — the stores already render their defaults, so this does not block
 * first paint. (NFR-3)
 */
export function AppProviders({ children, storage }: AppProvidersProps) {
  useEffect(() => {
    const port = storage ?? createAsyncStorageAdapter();
    // Fire-and-forget: defaults are already on screen; values fill in async.
    void useSettingsStore.getState().hydrate(port);
    void useScoresStore.getState().hydrate(port);
  }, [storage]);

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
