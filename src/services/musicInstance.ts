import { loadExpoAudio } from './soundAdapter';

/**
 * Ambient theme music controller. Loops assets/audio/theme_loop.wav via
 * expo-audio with the same defensive posture as the SFX adapter: if the
 * native module is missing every call is a silent no-op, and all player
 * calls are guarded. Not wired into providers here — screens/providers
 * import { appMusic } and drive it. (integration happens downstream)
 */

const THEME_SOURCE: number = require('../../assets/audio/theme_loop.wav');

/** Quiet bed under the SFX. */
const THEME_VOLUME = 0.35;
/** While ducked (e.g. pause overlay, end screens) the bed drops further. */
const DUCKED_VOLUME = 0.12;

export interface MusicState {
  /** The user-facing music toggle (Settings musicEnabled). */
  enabled: boolean;
  /** Whether the app currently wants the theme audible (playTheme vs stop). */
  playing: boolean;
  /** Whether the bed is ducked under an overlay. */
  ducked: boolean;
}

export interface MusicController {
  /** Start (or resume) the looping theme, if enabled. */
  playTheme(): void;
  /** Stop the theme and rewind to the top. */
  stop(): void;
  /** Mirror of the Settings musicEnabled toggle; false pauses immediately. */
  setEnabled(on: boolean): void;
  /** Lower the bed under overlays without stopping it. */
  duck(on: boolean): void;
  getState(): MusicState;
}

interface ThemePlayerLike {
  play(): void;
  pause(): void;
  seekTo(seconds: number): Promise<void>;
  volume: number;
  loop: boolean;
}

function createMusicController(): MusicController {
  const state: MusicState = { enabled: true, playing: false, ducked: false };
  let player: ThemePlayerLike | null = null;
  let triedCreate = false;

  // Lazily create the looping player on first actual playback need.
  const ensurePlayer = (): ThemePlayerLike | null => {
    if (player !== null || triedCreate) {
      return player;
    }
    triedCreate = true;
    const audio = loadExpoAudio();
    if (audio === null) {
      return null;
    }
    try {
      const p = audio.createAudioPlayer(THEME_SOURCE) as ThemePlayerLike;
      p.loop = true;
      p.volume = THEME_VOLUME;
      player = p;
    } catch {
      player = null;
    }
    return player;
  };

  // Reconcile the player with the current desired state. Never throws.
  const sync = (): void => {
    try {
      const shouldPlay = state.enabled && state.playing;
      const p = shouldPlay ? ensurePlayer() : player;
      if (p === null || p === undefined) {
        return;
      }
      p.volume = state.ducked ? DUCKED_VOLUME : THEME_VOLUME;
      if (shouldPlay) {
        p.play();
      } else {
        p.pause();
      }
    } catch {
      // Music must never take the app down.
    }
  };

  return {
    playTheme(): void {
      state.playing = true;
      sync();
    },

    stop(): void {
      state.playing = false;
      sync();
      try {
        player?.seekTo(0).catch(() => undefined);
      } catch {
        // Ignore — the next playTheme() simply resumes wherever it can.
      }
    },

    setEnabled(on: boolean): void {
      state.enabled = on;
      sync();
    },

    duck(on: boolean): void {
      state.ducked = on;
      sync();
    },

    getState(): MusicState {
      return { ...state };
    },
  };
}

/** The app-wide music singleton. */
export const appMusic: MusicController = createMusicController();
