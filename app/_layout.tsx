import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { AppProviders } from '../src/screens/AppProviders';
import { DISPLAY_FONT_FAMILY, setDisplayFontLoaded, useTheme } from '../src/ui';

/**
 * The vendored display face (Audiowide, OFL — license at
 * assets/fonts/OFL-Audiowide.txt). The require is try-guarded so a missing
 * binary (fresh checkout, jest) degrades to an empty map: useFonts resolves
 * immediately and every title simply keeps the system font.
 */
const DISPLAY_FONT_MAP: Record<string, number> = (() => {
  const map: Record<string, number> = {};
  try {
    map[DISPLAY_FONT_FAMILY] = require('../assets/fonts/Audiowide-Regular.ttf');
  } catch {
    // No binary — the map stays empty and titles keep the system font.
  }
  return map;
})();

/**
 * Load the display font WITHOUT blocking first paint: no splash-holding, no
 * gating of children — screens render with the system font and restyle via
 * the ui font store the moment the face is ready. Load errors just leave the
 * store unset (system font forever), never a crash.
 */
function useDisplayFont(): void {
  const [loaded, error] = useFonts(DISPLAY_FONT_MAP);
  useEffect(() => {
    setDisplayFontLoaded(
      loaded && error == null && DISPLAY_FONT_FAMILY in DISPLAY_FONT_MAP,
    );
  }, [loaded, error]);
}

/**
 * The themed navigator: reads the active skin's ui tokens (must render inside
 * AppProviders/SkinProvider) so every stack card is painted in the skin's
 * surface color — no white/unthemed flash between screens — and the status bar
 * flips dark/light to match light skins like Pocket LCD.
 */
function ThemedStack() {
  const { ui } = useTheme();
  return (
    <>
      <StatusBar style={ui.isLight ? 'dark' : 'light'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: ui.surface },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="game" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="account" />
        <Stack.Screen name="leaderboard" />
        <Stack.Screen name="win" options={{ presentation: 'modal' }} />
        <Stack.Screen name="loss" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}

/**
 * Root layout: mounts app-wide providers (gesture root, skin) once and kicks
 * off async store hydration on launch. Portrait is locked at the config level
 * via app.json ("orientation": "portrait"). Win and Loss ARE routes — modal
 * cards over the stack — fed by the game's terminal navigation.
 */
export default function RootLayout() {
  useDisplayFont();
  return (
    <AppProviders>
      <ThemedStack />
    </AppProviders>
  );
}
