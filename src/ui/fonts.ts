import { useSyncExternalStore } from 'react';

/**
 * Display-font readiness store. The vendored title face (Audiowide, OFL —
 * assets/fonts/Audiowide-Regular.ttf) is loaded by app/_layout without
 * blocking first paint: every themed surface renders immediately with the
 * system font, and the moment the file finishes decoding this tiny module
 * store flips, useTheme re-resolves, and titles snap to the game face.
 *
 * Deliberately NOT expo-font-aware: jest and any environment where the binary
 * is missing simply never flip the flag and keep the system-font styling.
 */

/** The family name the root layout registers the vendored TTF under. */
export const DISPLAY_FONT_FAMILY = 'Audiowide';

let loaded = false;
const listeners = new Set<() => void>();

/** Flip (or reset) display-font readiness; notifies useTheme subscribers. */
export function setDisplayFontLoaded(value: boolean): void {
  if (loaded === value) {
    return;
  }
  loaded = value;
  for (const listener of [...listeners]) {
    listener();
  }
}

/** Snapshot read (non-reactive) — mainly for tests/diagnostics. */
export function isDisplayFontLoaded(): boolean {
  return loaded;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * The loaded display family, or undefined while the font is unavailable
 * (still loading, download failed, jest). Undefined means "style with the
 * system font" — components must always spread it as an optional override.
 */
export function useDisplayFontFamily(): string | undefined {
  return useSyncExternalStore(
    subscribe,
    () => (loaded ? DISPLAY_FONT_FAMILY : undefined),
    () => undefined,
  );
}
