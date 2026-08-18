import type { SoundEvent, SoundPort } from './SoundPort';
import { createSilentSound } from './SoundPort';

/**
 * expo-audio-backed SoundPort.
 *
 * The currently-installed dev client may not include the expo-audio NATIVE
 * module (it activates on the next native build), so everything here is
 * defensive: the module is resolved inside try/catch (the JS package always
 * bundles — it's in node_modules — but evaluating it throws when the native
 * side is missing), and every player call is guarded so a failure degrades to
 * silence instead of a crash. (EH-10)
 */

/** The slice of expo-audio's AudioPlayer this adapter relies on. */
interface PlayerLike {
  play(): void;
  pause(): void;
  seekTo(seconds: number): Promise<void>;
  volume: number;
  loop: boolean;
  remove(): void;
}

interface ExpoAudioModule {
  createAudioPlayer(source: number): PlayerLike;
  setAudioModeAsync?(mode: Record<string, unknown>): Promise<void>;
}

/**
 * Static asset map — literal require() calls so Metro bundles every WAV.
 * Under Metro these resolve to numeric asset ids; under jest-expo, to stubs.
 */
const SFX_SOURCES: Record<SoundEvent, number> = {
  ATE_FOOD: require('../../assets/audio/eat.wav'),
  ATE_BONUS: require('../../assets/audio/bonus.wav'),
  DIED: require('../../assets/audio/death.wav'),
  WON: require('../../assets/audio/win.wav'),
  GOT_POWERUP: require('../../assets/audio/powerup.wav'),
  EFFECT_EXPIRED: require('../../assets/audio/expire.wav'),
  UI_TAP: require('../../assets/audio/tap.wav'),
  COUNTDOWN_TICK: require('../../assets/audio/tick.wav'),
  GO: require('../../assets/audio/go.wav'),
  REVIVE: require('../../assets/audio/revive.wav'),
};

const SFX_EVENTS = Object.keys(SFX_SOURCES) as SoundEvent[];

/** Players per event, so a rapid retrigger overlaps instead of cutting off. */
const POOL_SIZE = 2;

const DEFAULT_SFX_VOLUME = 0.9;

let warned = false;

/**
 * Resolve expo-audio, tolerating a missing native module. Returns null when
 * the module can't be loaded or lacks the API we need.
 */
export function loadExpoAudio(): ExpoAudioModule | null {
  try {
    // Literal specifier: Metro can only bundle static requires, and the
    // package is installed, so this always resolves at build time. The
    // try/catch absorbs the runtime throw when the NATIVE module is absent
    // (e.g. a dev client built before expo-audio was added).
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod: unknown = require('expo-audio');
    if (
      typeof mod === 'object' &&
      mod !== null &&
      typeof (mod as ExpoAudioModule).createAudioPlayer === 'function'
    ) {
      return mod as ExpoAudioModule;
    }
  } catch {
    // Fall through to null.
  }
  if (__DEV__ && !warned) {
    warned = true;
    // eslint-disable-next-line no-console
    console.warn(
      '[sound] expo-audio native module unavailable — sound is disabled ' +
        'until the next native build.',
    );
  }
  return null;
}

/**
 * Create the real SoundPort. Falls back to the silent implementation when
 * expo-audio is unavailable; individual playback failures are swallowed.
 */
export function createExpoSound(): SoundPort {
  const audio = loadExpoAudio();
  if (audio === null) {
    return createSilentSound();
  }

  interface Pool {
    players: PlayerLike[];
    next: number;
  }
  const pools = new Map<SoundEvent, Pool>();
  let volume = DEFAULT_SFX_VOLUME;
  let created = false;

  // Build the per-event player pools once; safe to call repeatedly.
  const ensurePools = (): void => {
    if (created) {
      return;
    }
    created = true;
    for (const event of SFX_EVENTS) {
      const players: PlayerLike[] = [];
      for (let i = 0; i < POOL_SIZE; i += 1) {
        try {
          const player = audio.createAudioPlayer(SFX_SOURCES[event]);
          player.volume = volume;
          players.push(player);
        } catch {
          // Native side refused — this slot stays empty; play() copes.
        }
      }
      pools.set(event, { players, next: 0 });
    }
  };

  return {
    play(event: SoundEvent): void {
      try {
        ensurePools();
        const pool = pools.get(event);
        if (!pool || pool.players.length === 0) {
          return;
        }
        const player = pool.players[pool.next];
        pool.next = (pool.next + 1) % pool.players.length;
        player.seekTo(0).catch(() => undefined);
        player.play();
      } catch {
        // Never let audio take down the game loop.
      }
    },

    async preload(): Promise<void> {
      try {
        // Games conventionally sound with the ringer off once the user has
        // explicitly enabled sound; the Settings toggle stays the master gate.
        await audio.setAudioModeAsync?.({ playsInSilentMode: true });
      } catch {
        // Cosmetic — ignore.
      }
      try {
        ensurePools();
      } catch {
        // Degrade silently.
      }
    },

    setVolume(v: number): void {
      volume = Math.min(1, Math.max(0, v));
      for (const pool of pools.values()) {
        for (const player of pool.players) {
          try {
            player.volume = volume;
          } catch {
            // Ignore — the next successful call will re-sync.
          }
        }
      }
    },
  };
}
