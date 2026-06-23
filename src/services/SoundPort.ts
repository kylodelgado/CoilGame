import type { GameEvent } from '../engine/types';

/** Sound effects keyed by game event. Wired now; real SFX land in Phase 2. */
export interface SoundPort {
  play(event: GameEvent): void;
  preload(): Promise<void>;
}

/**
 * Silent, wired no-op SoundPort for the MVP. play() and preload() exist and
 * never throw — even with missing assets — so the controller can call them
 * unconditionally. This is the seam where real SFX drop in later. (EH-10)
 */
export function createSilentSound(): SoundPort {
  return {
    play(_event: GameEvent): void {
      // Intentionally silent in the MVP.
    },
    preload(): Promise<void> {
      return Promise.resolve();
    },
  };
}
