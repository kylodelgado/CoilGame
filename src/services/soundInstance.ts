import type { SoundPort } from './SoundPort';
import { createExpoSound } from './soundAdapter';
import { useSettingsStore } from '../state/useSettingsStore';

/**
 * The app-wide SoundPort singleton. Screens and providers import this instead
 * of constructing their own adapter, so the whole app shares one player pool.
 *
 * Backed by expo-audio; self-falls-back to the silent implementation when the
 * native module is unavailable (e.g. a dev client from before the audio
 * phase), so importing and calling this is always safe.
 */
export const appSound: SoundPort = createExpoSound();

/**
 * Convenience for UI chrome: fire the standard tap blip, honoring the Sound
 * toggle (the same gate the game controller applies to gameplay SFX).
 */
export function playUi(): void {
  if (useSettingsStore.getState().soundEnabled) {
    appSound.play('UI_TAP');
  }
}
