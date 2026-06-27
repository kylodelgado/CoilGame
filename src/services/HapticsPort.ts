import * as Haptics from 'expo-haptics';

/** Tactile feedback for key game moments. Implementations must never crash. */
export interface HapticsPort {
  eat(): void;
  death(): void;
  /** A crisp tick when a direction input is registered (d-pad/steer feedback). */
  turn?(): void;
}

/**
 * Swallow both synchronous throws and async rejections so an unsupported device
 * (or any expo-haptics error) degrades to a silent no-op. (EH-9)
 */
function safe(run: () => Promise<unknown>): void {
  try {
    run().catch(() => undefined);
  } catch {
    // Synchronous failure (e.g. module unavailable) — ignore.
  }
}

/**
 * expo-haptics-backed HapticsPort. eat() is a light impact; death() a heavier
 * error notification. Every call is guarded, so this never throws. Toggle gating
 * is the controller's responsibility, not this layer's.
 */
export function createExpoHaptics(): HapticsPort {
  return {
    eat(): void {
      safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
    },
    death(): void {
      safe(() =>
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
      );
    },
    turn(): void {
      safe(() => Haptics.selectionAsync());
    },
  };
}
