import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Live "Reduce Motion" flag. Every animation in the design system (entrance
 * slides, pulses, count-ups, pressed-scale) checks this and collapses to a
 * static presentation when the user has motion reduction on. Defaults to false
 * until the async query resolves; all platform calls are try-guarded so a
 * missing native module (tests, web) can never crash a screen.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    try {
      void AccessibilityInfo.isReduceMotionEnabled()
        .then((v) => {
          // Only update when it differs from the default, so the async query
          // is a no-op re-render (and act()-silent in tests) for most users.
          if (mounted && Boolean(v)) {
            setReduced(true);
          }
        })
        .catch(() => undefined);
    } catch {
      // Platform without the API — keep animations on.
    }

    let subscription: { remove(): void } | null = null;
    try {
      subscription = AccessibilityInfo.addEventListener(
        'reduceMotionChanged',
        (v) => setReduced(Boolean(v)),
      );
    } catch {
      subscription = null;
    }

    return () => {
      mounted = false;
      try {
        subscription?.remove();
      } catch {
        // Already torn down.
      }
    };
  }, []);

  return reduced;
}
