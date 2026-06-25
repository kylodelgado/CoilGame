import { BackHandler } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { GameScreen } from '../src/screens/GameScreen';
import { SkinProvider } from '../src/skins/SkinProvider';
import { useScoresStore } from '../src/state/useScoresStore';
import { useSettingsStore } from '../src/state/useSettingsStore';
import { DEFAULT_SETTINGS } from '../src/services/StoragePort';
import { createSeededRandom } from '../src/services/RandomPort';
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
    // Speed starts at the base pace: exactly 1.0× before any acceleration.
    expect(screen.getByTestId('speed-hud')).toHaveTextContent('1.0×');

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

  it('submits the score to the leaderboard on terminal without blocking navigation (Prompt 44)', () => {
    const submit = jest.fn();
    const mode = scriptedMode([
      { state: baseState({ status: 'LOST', score: 50 }), events: ['DIED'] },
    ]);
    render(
      <SkinProvider>
        <GameScreen mode={mode} submitter={{ submit }} />
      </SkinProvider>,
    );
    startRunning();
    advance(100);

    // Navigation (local flow) happened...
    expect(mockReplace).toHaveBeenCalledTimes(1);
    // ...and the fire-and-forget submission was dispatched for this board.
    expect(submit).toHaveBeenCalledWith({ modeId: 'CLASSIC', wall: 'SOLID' }, 50);
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

    it('with controlScheme ANALOG, the joystick surface is rendered (no D-pad)', () => {
      useSettingsStore.setState({ controlScheme: 'ANALOG' });
      const mode = scriptedMode([
        { state: baseState({ status: 'RUNNING', snake: SNAKE }), events: [] },
      ]);
      renderGame(mode);
      startRunning();

      expect(screen.getByTestId('analog-surface')).toBeTruthy();
      expect(screen.queryByTestId('dpad-up')).toBeNull();
    });
  });

  describe('powerup pickup despawn counter', () => {
    it('shows whole seconds left above an on-board pickup', () => {
      const mode = scriptedMode([
        {
          state: baseState({
            status: 'RUNNING',
            snake: SNAKE,
            bonusFood: { x: 2, y: 2 },
            bonusRemaining: 20,
            tickMs: 200,
          }),
          events: [],
        },
      ]);
      renderGame(mode);
      startRunning();
      advance(200); // one tick → projection now carries the pickup

      // 20 ticks × 200ms = 4000ms ⇒ 4 seconds.
      expect(screen.getByTestId('pickup-timer')).toHaveTextContent('4');
    });

    it('shows no counter when no pickup is on the board', () => {
      const mode = scriptedMode([
        { state: baseState({ status: 'RUNNING', snake: SNAKE }), events: [] },
      ]);
      renderGame(mode);
      startRunning();
      advance(100);

      expect(screen.queryByTestId('pickup-timer')).toBeNull();
    });
  });

  describe('Dynamic Walls routing (Prompt 41)', () => {
    it('routes through dynamicWallsMode and records the run under the DYNAMIC_WALLS key', () => {
      useSettingsStore.setState({ modeId: 'DYNAMIC_WALLS' });
      const recordSpy = jest.spyOn(useScoresStore.getState(), 'recordRun');

      // No `mode` prop: the screen selects the real mode from MODES[modeId].
      render(
        <SkinProvider>
          <GameScreen rng={createSeededRandom(1)} />
        </SkinProvider>,
      );
      startRunning();
      // The snake runs straight into the solid wall and dies (terminal).
      advance(10000);

      expect(mockReplace).toHaveBeenCalled();
      const nav = mockReplace.mock.calls[0][0];
      expect(nav.pathname).toBe('/loss');
      expect(nav.params.modeId).toBe('DYNAMIC_WALLS');
      // Scoring is keyed by the active mode.
      expect(recordSpy).toHaveBeenCalledWith(
        'DYNAMIC_WALLS',
        'SOLID',
        expect.any(Number),
      );

      recordSpy.mockRestore();
    });
  });

  describe('GPS routing (Prompt 50)', () => {
    const GPS_WORLD = { worldColumns: 60, worldRows: 60, cellSize: 12 };

    // A scripted GPS mode: world-based config + a world-centered initial state.
    function scriptedGpsMode(
      results: TickResult[],
      initial: GameState,
    ): Mode & { tick: jest.Mock } {
      let i = 0;
      const tick = jest.fn(() => results[Math.min(i++, results.length - 1)]);
      return {
        id: 'GPS',
        buildConfig: () => ({ ...CONFIG, world: GPS_WORLD }),
        createInitialState: () => initial,
        tick,
      };
    }

    it('renders the world/camera + HUD arrow path and records under the GPS key', () => {
      useSettingsStore.setState({ modeId: 'GPS' });
      const recordSpy = jest.spyOn(useScoresStore.getState(), 'recordRun');
      const submit = jest.fn();

      const gpsInitial = baseState({
        status: 'TAP_TO_START',
        snake: [
          { x: 30, y: 30 },
          { x: 29, y: 30 },
          { x: 28, y: 30 },
        ],
        food: { x: 55, y: 30 }, // far off-screen => HUD arrow visible
      });
      const mode = scriptedGpsMode(
        [
          {
            state: baseState({
              status: 'LOST',
              score: 70,
              snake: [{ x: 31, y: 30 }],
              food: { x: 55, y: 30 },
            }),
            events: ['DIED'],
          },
        ],
        gpsInitial,
      );

      render(
        <SkinProvider>
          <GameScreen mode={mode} submitter={{ submit }} />
        </SkinProvider>,
      );

      // The GPS HUD arrow proves the world/camera render path is active.
      expect(screen.getByTestId('gps-arrow')).toBeOnTheScreen();

      startRunning();
      advance(100); // one tick -> terminal LOST

      expect(recordSpy).toHaveBeenCalledWith('GPS', 'SOLID', expect.any(Number));
      expect(submit).toHaveBeenCalledWith({ modeId: 'GPS', wall: 'SOLID' }, 70);
      const nav = mockReplace.mock.calls[0][0];
      expect(nav.params.modeId).toBe('GPS');

      recordSpy.mockRestore();
    });
  });
});
