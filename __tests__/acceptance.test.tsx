import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { HomeScreen } from '../src/screens/HomeScreen';
import { GameScreen } from '../src/screens/GameScreen';
import { LossScreen } from '../src/screens/LossScreen';
import { SkinProvider } from '../src/skins/SkinProvider';
import { createAsyncStorageAdapter } from '../src/services/asyncStorageAdapter';
import {
  DEFAULT_SCORES,
  DEFAULT_SETTINGS,
  SCORES_KEY,
  SETTINGS_KEY,
} from '../src/services/StoragePort';
import { classicMode } from '../src/modes/classicMode';
import { createGameController } from '../src/runtime/GameController';
import {
  PRESETS,
  START_LENGTH,
  computeGrid,
} from '../src/engine';
import { createSeededRandom } from '../src/services/RandomPort';
import { useSettingsStore } from '../src/state/useSettingsStore';
import { useScoresStore } from '../src/state/useScoresStore';
import type {
  Cell,
  GameConfig,
  GameState,
  PresetId,
  TickResult,
  WallBehavior,
} from '../src/engine/types';
import type { Mode } from '../src/modes/Mode';

const mockPush = jest.fn();
const mockReplace = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}));

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

function resetStores() {
  useSettingsStore.setState({ ...DEFAULT_SETTINGS, hydrated: false });
  useScoresStore.setState({ ...DEFAULT_SCORES, hydrated: false });
}

beforeEach(async () => {
  jest.clearAllMocks();
  mockParams = {};
  await AsyncStorage.clear();
  resetStores();
});

// ── 2. Six preset × wall combinations ───────────────────────────────────────
describe('acceptance: six preset × wall combinations', () => {
  const combos: { presetId: PresetId; wall: WallBehavior }[] = [];
  for (const presetId of ['CLASSIC', 'STANDARD', 'DENSE'] as PresetId[]) {
    for (const wall of ['SOLID', 'PORTAL'] as WallBehavior[]) {
      combos.push({ presetId, wall });
    }
  }

  it.each(combos)(
    '$presetId / $wall launches a valid game and scores the right best',
    ({ presetId, wall }) => {
      const grid = computeGrid(390, 780, PRESETS[presetId].targetColumns);
      const config = classicMode.buildConfig(grid, wall, PRESETS[presetId]);
      const state = classicMode.createInitialState(config, createSeededRandom(1));

      expect(state.status).toBe('TAP_TO_START');
      expect(state.snake).toHaveLength(START_LENGTH);
      expect(state.food).not.toBeNull();
      expect(config.wallBehavior).toBe(wall);

      useScoresStore.setState({ ...DEFAULT_SCORES, hydrated: true });
      const result = useScoresStore.getState().recordRun(wall, 100);
      expect(result.isNewBest).toBe(true);

      const scores = useScoresStore.getState();
      if (wall === 'SOLID') {
        expect(scores.bestSolid).toBe(100);
        expect(scores.bestPortal).toBe(0);
      } else {
        expect(scores.bestPortal).toBe(100);
        expect(scores.bestSolid).toBe(0);
      }
    },
  );
});

// ── 3. Persistence across a simulated relaunch ───────────────────────────────
describe('acceptance: persistence survives relaunch', () => {
  it('restores last-used settings and both high scores', async () => {
    // Session 1.
    const adapter1 = createAsyncStorageAdapter();
    await useSettingsStore.getState().hydrate(adapter1);
    await useScoresStore.getState().hydrate(adapter1);

    useSettingsStore.getState().setPreset('DENSE');
    useSettingsStore.getState().setWall('PORTAL');
    useSettingsStore.getState().setSound(false);
    useSettingsStore.getState().setHaptics(false);
    useScoresStore.getState().recordRun('PORTAL', 150);
    useScoresStore.getState().recordRun('SOLID', 70);
    await flush();

    // Relaunch: drop in-memory state, re-create stores from the same storage.
    resetStores();
    const adapter2 = createAsyncStorageAdapter();
    await useSettingsStore.getState().hydrate(adapter2);
    await useScoresStore.getState().hydrate(adapter2);

    const settings = useSettingsStore.getState();
    expect(settings.presetId).toBe('DENSE');
    expect(settings.wallBehavior).toBe('PORTAL');
    expect(settings.soundEnabled).toBe(false);
    expect(settings.hapticsEnabled).toBe(false);

    const scores = useScoresStore.getState();
    expect(scores.bestPortal).toBe(150);
    expect(scores.bestSolid).toBe(70);
  });

  it('degrades corrupt/missing persisted data to defaults without crashing', async () => {
    await AsyncStorage.setItem(SETTINGS_KEY, '{ not json');
    await AsyncStorage.setItem(SCORES_KEY, '<<garbage>>');

    const adapter = createAsyncStorageAdapter();
    await useSettingsStore.getState().hydrate(adapter);
    await useScoresStore.getState().hydrate(adapter);

    expect(useSettingsStore.getState()).toMatchObject(DEFAULT_SETTINGS);
    expect(useScoresStore.getState().bestSolid).toBe(0);
    expect(useScoresStore.getState().bestPortal).toBe(0);
  });
});

// ── 4. Side-effect gating end to end (settings store -> controller) ──────────
describe('acceptance: haptics gating + silent sound, end to end', () => {
  const baseSnake: Cell[] = [
    { x: 2, y: 2 },
    { x: 1, y: 2 },
  ];
  const config: GameConfig = classicMode.buildConfig(
    { columns: 8, rows: 8, cellSize: 10, originX: 0, originY: 0 },
    'SOLID',
    PRESETS.STANDARD,
  );
  const initial: GameState = {
    status: 'RUNNING',
    direction: 'RIGHT',
    inputQueue: [],
    food: null,
    score: 0,
    foodEaten: 0,
    tickMs: 100,
    snake: baseSnake,
    bonusFood: null,
    bonusRemaining: 0,
    ticksUntilBonus: Infinity,
    obstacles: [],
  };
  const ate: TickResult = {
    state: { ...initial, score: 10, foodEaten: 1 },
    events: ['ATE_FOOD'],
  };
  const mode = (): Mode => ({
    id: 'MOCK',
    buildConfig: () => config,
    createInitialState: () => initial,
    tick: () => ate,
  });

  function build(haptics: { eat: jest.Mock; death: jest.Mock }, sound: { play: jest.Mock }) {
    return createGameController({
      mode: mode(),
      config,
      rng: createSeededRandom(1),
      haptics: haptics as never,
      sound: { ...sound, preload: jest.fn(() => Promise.resolve()) } as never,
      isHapticsEnabled: () => useSettingsStore.getState().hapticsEnabled,
      isSoundEnabled: () => useSettingsStore.getState().soundEnabled,
      recordRun: () => ({ isNewBest: false }),
      onState: () => undefined,
      onTerminal: () => undefined,
    });
  }

  it('fires haptics on eat only when the toggle is on; sound is always invoked', () => {
    useSettingsStore.setState({ ...DEFAULT_SETTINGS, hapticsEnabled: true, hydrated: true });
    const haptics1 = { eat: jest.fn(), death: jest.fn() };
    const sound1 = { play: jest.fn() };
    const c1 = build(haptics1, sound1);
    c1.tapToStart();
    c1.setRunning();
    c1.step();
    expect(haptics1.eat).toHaveBeenCalledTimes(1);
    expect(sound1.play).toHaveBeenCalledWith('ATE_FOOD');

    useSettingsStore.setState({ ...DEFAULT_SETTINGS, hapticsEnabled: false, hydrated: true });
    const haptics2 = { eat: jest.fn(), death: jest.fn() };
    const sound2 = { play: jest.fn() };
    const c2 = build(haptics2, sound2);
    c2.tapToStart();
    c2.setRunning();
    c2.step();
    expect(haptics2.eat).not.toHaveBeenCalled();
    expect(sound2.play).toHaveBeenCalledWith('ATE_FOOD'); // sound always invoked
  });
});

// ── 1 + full loop: Home -> play -> terminal -> Play Again ────────────────────
describe('acceptance: full Home -> play -> terminal -> Play Again loop', () => {
  const config: GameConfig = classicMode.buildConfig(
    { columns: 8, rows: 8, cellSize: 10, originX: 0, originY: 0 },
    'PORTAL',
    PRESETS.DENSE,
  );
  const initial: GameState = {
    status: 'TAP_TO_START',
    direction: 'RIGHT',
    inputQueue: [],
    food: { x: 6, y: 6 },
    score: 0,
    foodEaten: 0,
    tickMs: 100,
    snake: [
      { x: 4, y: 4 },
      { x: 3, y: 4 },
      { x: 2, y: 4 },
    ],
    bonusFood: null,
    bonusRemaining: 0,
    ticksUntilBonus: Infinity,
    obstacles: [],
  };
  const lost: TickResult = {
    state: { ...initial, status: 'LOST', score: 80 },
    events: ['DIED'],
  };
  const terminalMode: Mode = {
    id: 'MOCK',
    buildConfig: () => config,
    createInitialState: () => initial,
    tick: () => lost,
  };

  it('threads the same preset + wall through the whole loop', () => {
    jest.useFakeTimers();

    // Home: choose DENSE + PORTAL, press Play.
    useSettingsStore.setState({
      ...DEFAULT_SETTINGS,
      presetId: 'DENSE',
      wallBehavior: 'PORTAL',
      hydrated: true,
    });
    useScoresStore.setState({ ...DEFAULT_SCORES, hydrated: true });

    const home = render(
      <SkinProvider>
        <HomeScreen />
      </SkinProvider>,
    );
    fireEvent.press(home.getByTestId('play-button'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/game',
      params: { presetId: 'DENSE', wall: 'PORTAL' },
    });
    home.unmount();

    // Game: play to a terminal LOST, which navigates to /loss with the score.
    mockParams = { presetId: 'DENSE', wall: 'PORTAL' };
    const game = render(
      <SkinProvider>
        <GameScreen mode={terminalMode} />
      </SkinProvider>,
    );
    fireEvent.press(game.getByTestId('tap-to-start-overlay'));
    act(() => {
      jest.advanceTimersByTime(3000); // countdown -> RUNNING
    });
    act(() => {
      jest.advanceTimersByTime(100); // one tick -> LOST
    });
    expect(mockReplace).toHaveBeenCalledTimes(1);
    const lossNav = mockReplace.mock.calls[0][0];
    expect(lossNav.pathname).toBe('/loss');
    expect(lossNav.params).toMatchObject({
      score: '80',
      presetId: 'DENSE',
      wall: 'PORTAL',
    });
    game.unmount();

    // Loss: Play Again returns to /game with the same preset + wall.
    mockParams = { ...lossNav.params };
    const loss = render(
      <SkinProvider>
        <LossScreen />
      </SkinProvider>,
    );
    fireEvent.press(loss.getByTestId('play-again-button'));
    expect(mockReplace).toHaveBeenLastCalledWith({
      pathname: '/game',
      params: { presetId: 'DENSE', wall: 'PORTAL' },
    });

    jest.clearAllTimers();
    jest.useRealTimers();
  });
});
