import { BackHandler } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { GameScreen } from '../src/screens/GameScreen';
import { SkinProvider } from '../src/skins/SkinProvider';
import { useScoresStore } from '../src/state/useScoresStore';
import { useSettingsStore } from '../src/state/useSettingsStore';
import { DEFAULT_SETTINGS } from '../src/services/StoragePort';
import type { Mode } from '../src/modes/Mode';
import type { Cell, GameConfig, GameState, TickResult } from '../src/engine/types';

const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: mockBack }),
  useLocalSearchParams: () => ({ presetId: 'STANDARD', wall: 'SOLID' }),
}));

const CONFIG: GameConfig = {
  grid: { columns: 10, rows: 10, cellSize: 12, originX: 0, originY: 0 },
  wallBehavior: 'SOLID',
  baseTickMs: 100,
  minTickMs: 100,
  accelMsPerFood: 4,
  pointsPerFood: 10,
  startLength: 3,
  startDirection: 'RIGHT',
  bonus: { enabled: false, spawnEveryTicks: 60, lifetimeTicks: 25, points: 50 },
};

const SNAKE: Cell[] = [
  { x: 5, y: 5 },
  { x: 4, y: 5 },
  { x: 3, y: 5 },
];

function baseState(over: Partial<GameState> = {}): GameState {
  return {
    status: 'TAP_TO_START',
    direction: 'RIGHT',
    inputQueue: [],
    food: { x: 7, y: 7 },
    score: 0,
    foodEaten: 0,
    tickMs: 100,
    snake: SNAKE,
    bonusFood: null,
    bonusRemaining: 0,
    ticksUntilBonus: Infinity,
    obstacles: [],
    ...over,
  };
}

/** A Mode with a jest.fn tick returning scripted results, for forcing events. */
function scriptedMode(results: TickResult[]): Mode & { tick: jest.Mock } {
  let i = 0;
  const tick = jest.fn(() => results[Math.min(i++, results.length - 1)]);
  return {
    id: 'MOCK',
    buildConfig: () => CONFIG,
    createInitialState: () => baseState(),
    tick,
  };
}

const advance = (ms: number) =>
  act(() => {
    jest.advanceTimersByTime(ms);
  });

const renderGame = (mode: Mode) =>
  render(
    <SkinProvider>
      <GameScreen mode={mode} />
    </SkinProvider>,
  );

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  useSettingsStore.setState({ ...DEFAULT_SETTINGS, hydrated: true });
  useScoresStore.setState({ bests: {}, hydrated: true });
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

// Drive the screen from TAP_TO_START to RUNNING.
function startRunning() {
  fireEvent.press(screen.getByTestId('tap-to-start-overlay'));
  advance(3000); // countdown 3..2..1 -> setRunning
}

describe('GameScreen integration', () => {
  it('mounts in TAP_TO_START with the board and a tap moves to COUNTDOWN', () => {
    renderGame(scriptedMode([{ state: baseState({ status: 'RUNNING' }), events: [] }]));

    expect(screen.getByTestId('game-board')).toBeOnTheScreen();
    expect(screen.getByTestId('tap-to-start-overlay')).toBeOnTheScreen();
    expect(screen.getByTestId('score-hud')).toHaveTextContent('0');

    fireEvent.press(screen.getByTestId('tap-to-start-overlay'));
    expect(screen.getByTestId('countdown-overlay')).toBeOnTheScreen();
    expect(screen.queryByTestId('tap-to-start-overlay')).toBeNull();
  });

  it('transitions to RUNNING after the 3s countdown and the loop begins', () => {
    const mode = scriptedMode([
      { state: baseState({ status: 'RUNNING', snake: SNAKE }), events: [] },
    ]);
    renderGame(mode);
    startRunning();

    expect(screen.queryByTestId('countdown-overlay')).toBeNull();
    expect(mode.tick).not.toHaveBeenCalled();

    advance(100);
    expect(mode.tick).toHaveBeenCalledTimes(1);
    advance(300);
    expect(mode.tick).toHaveBeenCalledTimes(4);
  });

  it('updates the score HUD when an eat event advances the score', () => {
    const mode = scriptedMode([
      {
        state: baseState({ status: 'RUNNING', score: 10, foodEaten: 1 }),
        events: ['ATE_FOOD'],
      },
    ]);
    renderGame(mode);
    startRunning();

    advance(100);
    expect(screen.getByTestId('score-hud')).toHaveTextContent('10');
  });

  it('pauses on the pause button and the loop stops advancing', () => {
    const mode = scriptedMode([
      { state: baseState({ status: 'RUNNING' }), events: [] },
    ]);
    renderGame(mode);
    startRunning();

    advance(100);
    expect(mode.tick).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByTestId('pause-button'));
    expect(screen.getByTestId('pause-overlay')).toBeOnTheScreen();

    advance(1000);
    expect(mode.tick).toHaveBeenCalledTimes(1); // no further ticks
  });

  it('intercepts Android back to open the pause overlay without popping', () => {
    let backHandler: () => boolean = () => false;
    const spy = jest
      .spyOn(BackHandler, 'addEventListener')
      .mockImplementation(((_event: string, cb: () => boolean) => {
        backHandler = cb;
        return { remove: jest.fn() };
      }) as unknown as typeof BackHandler.addEventListener);

    const mode = scriptedMode([
      { state: baseState({ status: 'RUNNING' }), events: [] },
    ]);
    renderGame(mode);
    startRunning();

    let handled = false;
    act(() => {
      handled = backHandler();
    });

    expect(handled).toBe(true); // back consumed
    expect(mockBack).not.toHaveBeenCalled(); // route not popped
    expect(screen.getByTestId('pause-overlay')).toBeOnTheScreen();

    spy.mockRestore();
  });

  it('navigates to /loss on a terminal LOST with score and isNewBest', () => {
    const mode = scriptedMode([
      {
        state: baseState({ status: 'LOST', score: 50 }),
        events: ['DIED'],
      },
    ]);
    renderGame(mode);
    startRunning();

    advance(100);

    expect(mockReplace).toHaveBeenCalledTimes(1);
    const arg = mockReplace.mock.calls[0][0];
    expect(arg.pathname).toBe('/loss');
    expect(arg.params.score).toBe('50');
    expect(arg.params.isNewBest).toBe('1'); // 50 > best 0
  });

  it('navigates to /win on a terminal WON', () => {
    const mode = scriptedMode([
      {
        state: baseState({ status: 'WON', score: 360, food: null }),
        events: ['ATE_FOOD', 'WON'],
      },
    ]);
    renderGame(mode);
    startRunning();

    advance(100);

    expect(mockReplace).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/win' }),
    );
  });

  describe('control scheme (Prompt 36)', () => {
    it('with controlScheme DPAD, a D-pad press enqueues a Direction into the engine', () => {
      useSettingsStore.setState({ controlScheme: 'DPAD' });
      const mode = scriptedMode([
        { state: baseState({ status: 'RUNNING', snake: SNAKE }), events: [] },
      ]);
      renderGame(mode);
      startRunning();

      // The D-pad lives in the chrome below the board.
      fireEvent.press(screen.getByTestId('dpad-up'));
      advance(100); // one tick consumes the queued direction

      expect(mode.tick).toHaveBeenCalled();
      // The controller enqueued 'UP' before the tick that just ran.
      expect(mode.tick.mock.calls[0][0].inputQueue).toContain('UP');
    });

    it('with controlScheme SWIPE, the D-pad is not rendered (swipe path used)', () => {
      useSettingsStore.setState({ controlScheme: 'SWIPE' });
      const mode = scriptedMode([
        { state: baseState({ status: 'RUNNING', snake: SNAKE }), events: [] },
      ]);
      renderGame(mode);
      startRunning();

      expect(screen.queryByTestId('dpad-up')).toBeNull();
    });
  });
});
