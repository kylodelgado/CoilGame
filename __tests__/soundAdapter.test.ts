/**
 * Tests for the expo-audio SoundPort adapter, the music controller, and the
 * app-wide singletons. expo-audio is mocked with a switchable behavior so the
 * missing-native-module path (the currently-installed dev client) is provable:
 * the adapter must fall back to silence and never throw.
 */

type MockPlayer = {
  play: jest.Mock;
  pause: jest.Mock;
  seekTo: jest.Mock;
  volume: number;
  loop: boolean;
  remove: jest.Mock;
};

let mockMode: 'ok' | 'throw-require' | 'throw-create' = 'ok';
const mockPlayers: MockPlayer[] = [];
const mockSetAudioModeAsync = jest.fn((_mode: unknown) => Promise.resolve());
const mockCreateAudioPlayer = jest.fn((_source: unknown): MockPlayer => {
  if (mockMode === 'throw-create') {
    throw new Error('native AudioModule missing');
  }
  const player: MockPlayer = {
    play: jest.fn(),
    pause: jest.fn(),
    seekTo: jest.fn(() => Promise.resolve()),
    volume: 1,
    loop: false,
    remove: jest.fn(),
  };
  mockPlayers.push(player);
  return player;
});

jest.mock('expo-audio', () => {
  if (mockMode === 'throw-require') {
    // Simulates evaluating expo-audio's JS when the NATIVE module is absent
    // (a dev client built before expo-audio was installed).
    throw new Error("Cannot find native module 'ExpoAudio'");
  }
  return {
    createAudioPlayer: (source: unknown) => mockCreateAudioPlayer(source),
    setAudioModeAsync: (mode: unknown) => mockSetAudioModeAsync(mode),
  };
});

/** Fresh copies of the modules under test (resets pools + one-shot warn). */
function loadSound() {
  let mod!: typeof import('../src/services/soundAdapter');
  jest.isolateModules(() => {
    mod = require('../src/services/soundAdapter');
  });
  return mod;
}

function loadMusic() {
  let mod!: typeof import('../src/services/musicInstance');
  jest.isolateModules(() => {
    mod = require('../src/services/musicInstance');
  });
  return mod;
}

function loadInstance() {
  let mod!: typeof import('../src/services/soundInstance');
  jest.isolateModules(() => {
    mod = require('../src/services/soundInstance');
  });
  return mod;
}

let warnSpy: jest.SpyInstance;

beforeEach(() => {
  mockMode = 'ok';
  mockPlayers.length = 0;
  mockCreateAudioPlayer.mockClear();
  mockSetAudioModeAsync.mockClear();
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  warnSpy.mockRestore();
});

describe('createExpoSound — missing native module (silent fallback)', () => {
  it('never throws: play/preload/setVolume are safe no-ops', async () => {
    mockMode = 'throw-require';
    const { createExpoSound } = loadSound();
    const sound = createExpoSound();

    expect(() => sound.play('ATE_FOOD')).not.toThrow();
    expect(() => sound.play('UI_TAP')).not.toThrow();
    expect(() => sound.setVolume?.(0.5)).not.toThrow();
    await expect(sound.preload()).resolves.toBeUndefined();
    expect(mockCreateAudioPlayer).not.toHaveBeenCalled();
  });

  it('warns exactly once in __DEV__, even across repeated creation', () => {
    mockMode = 'throw-require';
    const { createExpoSound } = loadSound();
    createExpoSound();
    createExpoSound();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0][0])).toContain('expo-audio');
  });

  it('stays silent (but alive) when player creation itself throws', () => {
    mockMode = 'throw-create';
    const { createExpoSound } = loadSound();
    const sound = createExpoSound();
    expect(() => sound.play('DIED')).not.toThrow();
    expect(() => sound.play('DIED')).not.toThrow();
  });
});

describe('createExpoSound — native module available', () => {
  it('preload builds a pool of 2 players per event and sets the audio mode', async () => {
    const { createExpoSound } = loadSound();
    const sound = createExpoSound();
    await sound.preload();

    // 10 SoundEvents x 2 pooled players.
    expect(mockCreateAudioPlayer).toHaveBeenCalledTimes(20);
    expect(mockSetAudioModeAsync).toHaveBeenCalledWith({
      playsInSilentMode: true,
    });
  });

  it('play seeks to 0 then plays, alternating pooled players for overlap', async () => {
    const { createExpoSound } = loadSound();
    const sound = createExpoSound();
    await sound.preload();

    // ATE_FOOD is the first declared event, so its pool is players 0 and 1.
    const [a, b] = mockPlayers;
    sound.play('ATE_FOOD');
    expect(a.seekTo).toHaveBeenCalledWith(0);
    expect(a.play).toHaveBeenCalledTimes(1);

    sound.play('ATE_FOOD'); // rapid retrigger -> second pooled player
    expect(b.play).toHaveBeenCalledTimes(1);

    sound.play('ATE_FOOD'); // round-robin wraps
    expect(a.play).toHaveBeenCalledTimes(2);
  });

  it('play() lazily builds the pools when preload was never called', () => {
    const { createExpoSound } = loadSound();
    const sound = createExpoSound();
    sound.play('UI_TAP');
    expect(mockCreateAudioPlayer).toHaveBeenCalledTimes(20);
    expect(mockPlayers.some((p) => p.play.mock.calls.length > 0)).toBe(true);
  });

  it('setVolume clamps to 0..1 and applies to every pooled player', async () => {
    const { createExpoSound } = loadSound();
    const sound = createExpoSound();
    await sound.preload();

    sound.setVolume?.(0.5);
    expect(mockPlayers.every((p) => p.volume === 0.5)).toBe(true);
    sound.setVolume?.(7);
    expect(mockPlayers.every((p) => p.volume === 1)).toBe(true);
    sound.setVolume?.(-3);
    expect(mockPlayers.every((p) => p.volume === 0)).toBe(true);
  });
});

describe('appMusic (musicInstance)', () => {
  it('playTheme creates one looping player at the bed volume and plays it', () => {
    const { appMusic } = loadMusic();
    appMusic.playTheme();

    expect(mockCreateAudioPlayer).toHaveBeenCalledTimes(1);
    const p = mockPlayers[0];
    expect(p.loop).toBe(true);
    expect(p.volume).toBeCloseTo(0.35);
    expect(p.play).toHaveBeenCalledTimes(1);
    expect(appMusic.getState()).toEqual({
      enabled: true,
      playing: true,
      ducked: false,
    });
  });

  it('duck lowers the bed and un-duck restores it', () => {
    const { appMusic } = loadMusic();
    appMusic.playTheme();
    const p = mockPlayers[0];

    appMusic.duck(true);
    expect(p.volume).toBeCloseTo(0.12);
    expect(appMusic.getState().ducked).toBe(true);

    appMusic.duck(false);
    expect(p.volume).toBeCloseTo(0.35);
  });

  it('setEnabled(false) pauses; re-enabling resumes a requested theme', () => {
    const { appMusic } = loadMusic();
    appMusic.playTheme();
    const p = mockPlayers[0];

    appMusic.setEnabled(false);
    expect(p.pause).toHaveBeenCalledTimes(1);
    expect(appMusic.getState().enabled).toBe(false);

    appMusic.setEnabled(true);
    expect(p.play).toHaveBeenCalledTimes(2);
  });

  it('stop pauses and rewinds to the top', () => {
    const { appMusic } = loadMusic();
    appMusic.playTheme();
    const p = mockPlayers[0];

    appMusic.stop();
    expect(p.pause).toHaveBeenCalledTimes(1);
    expect(p.seekTo).toHaveBeenCalledWith(0);
    expect(appMusic.getState().playing).toBe(false);
  });

  it('does not create a player while disabled, and never throws without the native module', () => {
    const first = loadMusic();
    first.appMusic.setEnabled(false);
    first.appMusic.playTheme();
    expect(mockCreateAudioPlayer).not.toHaveBeenCalled();

    mockMode = 'throw-require';
    const { appMusic } = loadMusic();
    expect(() => {
      appMusic.playTheme();
      appMusic.duck(true);
      appMusic.setEnabled(false);
      appMusic.stop();
    }).not.toThrow();
    expect(appMusic.getState().playing).toBe(false);
  });
});

describe('appSound singleton + playUi', () => {
  it('playUi fires UI_TAP through the shared adapter', () => {
    const { playUi } = loadInstance();
    playUi();
    // Pools were built and some player received play().
    expect(mockCreateAudioPlayer).toHaveBeenCalled();
    expect(mockPlayers.some((p) => p.play.mock.calls.length > 0)).toBe(true);
  });

  it('is safe to import and use when the native module is missing', () => {
    mockMode = 'throw-require';
    const { appSound, playUi } = loadInstance();
    expect(() => playUi()).not.toThrow();
    expect(() => appSound.play('WON')).not.toThrow();
  });
});
