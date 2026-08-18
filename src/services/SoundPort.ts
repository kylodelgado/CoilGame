/**
 * Every sound the app can make. A superset of the engine's GameEvent names
 * (minus BONUS_EXPIRED, which is deliberately silent) plus UI/ceremony cues
 * that never originate from the engine.
 */
export type SoundEvent =
  | 'ATE_FOOD'
  | 'ATE_BONUS'
  | 'DIED'
  | 'WON'
  | 'GOT_POWERUP'
  | 'EFFECT_EXPIRED'
  | 'UI_TAP'
  | 'COUNTDOWN_TICK'
  | 'GO'
  | 'REVIVE';

/** Sound effects keyed by sound event. Implementations must never throw. */
export interface SoundPort {
  play(event: SoundEvent): void;
  preload(): Promise<void>;
  /** Master SFX volume 0..1. Optional; adapters without mixing may omit it. */
  setVolume?(v: number): void;
}

/**
 * Silent no-op SoundPort. play() and preload() exist and never throw — even
 * with missing assets — so callers can invoke them unconditionally. Also the
 * fallback when the expo-audio native module is unavailable. (EH-10)
 */
export function createSilentSound(): SoundPort {
  return {
    play(_event: SoundEvent): void {
      // Intentionally silent.
    },
    preload(): Promise<void> {
      return Promise.resolve();
    },
    setVolume(_v: number): void {
      // Nothing to mix.
    },
  };
}
