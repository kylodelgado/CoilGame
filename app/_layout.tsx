import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppProviders } from '../src/screens/AppProviders';

/**
 * Root layout: mounts app-wide providers (gesture root, skin) once and kicks off
 * async store hydration on launch. Portrait is locked at the config level via
 * app.json ("orientation": "portrait"). Win/Loss are in-screen overlays on the
 * game route, not separate routes.
 */
export default function RootLayout() {
  return (
    <AppProviders>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="game" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="win" options={{ presentation: 'modal' }} />
        <Stack.Screen name="loss" options={{ presentation: 'modal' }} />
      </Stack>
    </AppProviders>
  );
}
