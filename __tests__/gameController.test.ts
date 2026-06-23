import { createGameController } from '../src/runtime/GameController';
import { classicMode } from '../src/modes/classicMode';
import { PRESETS, START_LENGTH } from '../src/engine';
import { createSeededRandom } from '../src/services/RandomPort';
import type { Mode } from '../src/modes/Mode';
import type {
  Cell,
  GameConfig,
  GameState,
  GridSpec,
  TickResult,
} from '../src/engine/types';

const GRID: GridSpec = {
  columns: 8,
  rows: 8,
  cellSize: 10,
  originX: 0,
  originY: 0,
};

function realConfig(wall: 'SOLID' | 'PORTAL' = 'SOLID'): GameConfig {
  return classicMode.buildConfig(GRID, wall, PRESETS.STANDARD);
}

function makeState(over: Partial<GameState> & { snake: Cell[] }): GameState {
  return {
    status: 'TAP_TO_START',
    direction: 'RIGHT',
    inputQueue: [],
    food: null,
    score: 0,
    foodEaten: 0,
    tickMs: 200,
    ...over,
  };
}

function makeMocks() {
  return {
    haptics: { eat: jest.fn(), death: jest.fn() },
    sound: { play: jest.fn(), preload: jest.fn(() => Promise.resolve()) },
    recordRun: jest.fn(() => ({ isNewBest: false })),
    onState: jest.fn(),
    onTerminal: jest.fn(),
  };
}

/** A mode whose tick returns scripted results, for forcing engine events. */
function scriptedMode(initial: GameState, results: TickResult[]): Mode {
  let i = 0;
  return {
    id: 'MOCK',
    buildConfig: () => realConfig(),
    createInitialState: () => initial,
    tick: () => results[Math.min(i++, results.length - 1)],
  };
}

describe('createGameController (runtime glue)', () => {
  it('routes enqueue through the engine (committed direction changes next step)', () => {
    const m = makeMocks();
    const controller = createGameController({
      mode: classicMode,
      config: realConfig(),
      rng: createSeededRandom(1),
      isHapticsEnabled: () => true,
      isSoundEnabled: () => true,
      ...m,
    });

    controller.tapToStart();
    controller.setRunning();
    expect(controller.getState().direction).toBe('RIGHT');

    controller.enqueue('UP');
    controller.step();
    expect(controller.getState().direction).toBe('UP');
  });

  it('step advances state and calls onState', () => {
    const m = makeMocks();
    const controller = createGameController({
      mode: classicMode,
      config: realConfig(),
      rng: createSeededRandom(2),
      isHapticsEnabled: () => true,
      isSoundEnabled: () => true,
      ...m,
    });
    controller.tapToStart();
    controller.setRunning();
    const before = controller.getState().snake[0];

    controller.step();

    const after = controller.getState().snake[0];
    expect(after).not.toEqual(before);
    expect(m.onState).toHaveBeenCalledWith(controller.getState());
  });

  it('does not advance when not RUNNING', () => {
    const m = makeMocks();
    const controller = createGameController({
      mode: classicMode,
      config: realConfig(),
      rng: createSeededRandom(2),
      isHapticsEnabled: () => true,
      isSoundEnabled: () => true,
      ...m,
    });
    const before = controller.getState();
    controller.step(); // still TAP_TO_START
    expect(controller.getState()).toEqual(before);
    expect(m.onState).not.toHaveBeenCalled();
  });

  it('ATE_FOOD: fires haptics.eat only when enabled, always plays sound', () => {
    const initial = makeState({
      snake: [
        { x: 2, y: 2 },
        { x: 1, y: 2 },
      ],
    });
    const ateResult: TickResult = {
      state: { ...initial, status: 'RUNNING', score: 10, foodEaten: 1 },
      events: ['ATE_FOOD'],
    };

    // Enabled.
    const on = makeMocks();
    const c1 = createGameController({
      mode: scriptedMode(initial, [ateResult]),
      config: realConfig(),
      rng: createSeededRandom(1),
      isHapticsEnabled: () => true,
      isSoundEnabled: () => true,
      ...on,
    });
    c1.tapToStart();
    c1.setRunning();
    c1.step();
    expect(on.haptics.eat).toHaveBeenCalledTimes(1);
    expect(on.sound.play).toHaveBeenCalledWith('ATE_FOOD');

    // Disabled.
    const off = makeMocks();
    const c2 = createGameController({
      mode: scriptedMode(initial, [ateResult]),
      config: realConfig(),
      rng: createSeededRandom(1),
      isHapticsEnabled: () => false,
      isSoundEnabled: () => true,
      ...off,
    });
    c2.tapToStart();
    c2.setRunning();
    c2.step();
    expect(off.haptics.eat).not.toHaveBeenCalled();
    expect(off.sound.play).toHaveBeenCalledWith('ATE_FOOD');
  });

  it('reaching LOST records the run once and calls onTerminal with the score', () => {
    const initial = makeState({ snake: [{ x: 2, y: 2 }] });
    const lostResult: TickResult = {
      state: { ...initial, status: 'LOST', score: 70 },
      events: ['DIED'],
    };
    const m = makeMocks();
    m.recordRun.mockReturnValue({ isNewBest: true });

    const controller = createGameController({
      mode: scriptedMode(initial, [lostResult]),
      config: realConfig('SOLID'),
      rng: createSeededRandom(1),
      isHapticsEnabled: () => true,
      isSoundEnabled: () => true,
      ...m,
    });
    controller.tapToStart();
    controller.setRunning();
    controller.step();
    controller.step(); // already terminal — must not record again

    expect(m.haptics.death).toHaveBeenCalledTimes(1);
    expect(m.sound.play).toHaveBeenCalledWith('DIED');
    expect(m.recordRun).toHaveBeenCalledTimes(1);
    expect(m.recordRun).toHaveBeenCalledWith('SOLID', 70);
    expect(m.onTerminal).toHaveBeenCalledTimes(1);
    expect(m.onTerminal).toHaveBeenCalledWith(controller.getState(), true);
  });

  it('reaching WON records the run once and plays the win sound', () => {
    const initial = makeState({ snake: [{ x: 2, y: 2 }] });
    const wonResult: TickResult = {
      state: { ...initial, status: 'WON', score: 360, food: null },
      events: ['ATE_FOOD', 'WON'],
    };
    const m = makeMocks();
    m.recordRun.mockReturnValue({ isNewBest: true });

    const controller = createGameController({
      mode: scriptedMode(initial, [wonResult]),
      config: realConfig('PORTAL'),
      rng: createSeededRandom(1),
      isHapticsEnabled: () => true,
      isSoundEnabled: () => true,
      ...m,
    });
    controller.tapToStart();
    controller.setRunning();
    controller.step();

    expect(m.sound.play).toHaveBeenCalledWith('WON');
    expect(m.recordRun).toHaveBeenCalledTimes(1);
    expect(m.recordRun).toHaveBeenCalledWith('PORTAL', 360);
    expect(m.onTerminal).toHaveBeenCalledWith(controller.getState(), true);
  });

  it('quit() does not record the run even mid-game (FR-P6)', () => {
    const initial = makeState({ snake: [{ x: 2, y: 2 }] });
    const lostResult: TickResult = {
      state: { ...initial, status: 'LOST', score: 50 },
      events: ['DIED'],
    };
    const m = makeMocks();
    const controller = createGameController({
      mode: scriptedMode(initial, [lostResult]),
      config: realConfig(),
      rng: createSeededRandom(1),
      isHapticsEnabled: () => true,
      isSoundEnabled: () => true,
      ...m,
    });
    controller.tapToStart();
    controller.setRunning();
    controller.quit();
    controller.step(); // must be inert after quit

    expect(m.recordRun).not.toHaveBeenCalled();
    expect(m.onTerminal).not.toHaveBeenCalled();
  });

  it('tapToStart -> COUNTDOWN without moving; setRunning -> RUNNING', () => {
    const m = makeMocks();
    const controller = createGameController({
      mode: classicMode,
      config: realConfig(),
      rng: createSeededRandom(3),
      isHapticsEnabled: () => true,
      isSoundEnabled: () => true,
      ...m,
    });
    const snakeBefore = controller.getState().snake;

    controller.tapToStart();
    expect(controller.getState().status).toBe('COUNTDOWN');
    expect(controller.getState().snake).toEqual(snakeBefore); // no motion

    controller.setRunning();
    expect(controller.getState().status).toBe('RUNNING');
  });

  it('restart() returns a fresh TAP_TO_START with the same config', () => {
    const m = makeMocks();
    const controller = createGameController({
      mode: classicMode,
      config: realConfig(),
      rng: createSeededRandom(4),
      isHapticsEnabled: () => true,
      isSoundEnabled: () => true,
      ...m,
    });
    controller.tapToStart();
    controller.setRunning();
    controller.step();
    controller.step();

    controller.restart();

    const state = controller.getState();
    expect(state.status).toBe('TAP_TO_START');
    expect(state.snake).toHaveLength(START_LENGTH);
    expect(state.score).toBe(0);
    expect(state.foodEaten).toBe(0);
  });
});
