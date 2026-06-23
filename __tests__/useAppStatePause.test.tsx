import { AppState, type AppStateStatus } from 'react-native';
import { renderHook } from '@testing-library/react-native';
import { useAppStatePause } from '../src/runtime/useAppStatePause';
import type { GameController } from '../src/runtime/GameController';
import type { GameState } from '../src/engine/types';

function makeFake(status: GameState['status']) {
  const live = { status };
  const pause = jest.fn();
  const controller = {
    getState: (): GameState => ({
      status: live.status,
      tickMs: 200,
      snake: [],
      direction: 'RIGHT',
      inputQueue: [],
      food: null,
      score: 0,
      foodEaten: 0,
      bonusFood: null,
      bonusRemaining: 0,
      ticksUntilBonus: Infinity,
      obstacles: [],
    }),
    pause,
    tapToStart: jest.fn(),
    setRunning: jest.fn(),
    enqueue: jest.fn(),
    step: jest.fn(),
    resume: jest.fn(),
    restart: jest.fn(),
    quit: jest.fn(),
  } as unknown as GameController;
  return { controller, pause, live };
}

describe('useAppStatePause (FR-P2)', () => {
  let handler: (s: AppStateStatus) => void;
  let remove: jest.Mock;

  beforeEach(() => {
    remove = jest.fn();
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_event: string, cb: (s: AppStateStatus) => void) => {
        handler = cb;
        return { remove } as ReturnType<typeof AppState.addEventListener>;
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('pauses when backgrounded while RUNNING', () => {
    const { controller, pause } = makeFake('RUNNING');
    renderHook(() => useAppStatePause(controller));

    handler('background');
    expect(pause).toHaveBeenCalledTimes(1);
  });

  it('pauses when going inactive while RUNNING', () => {
    const { controller, pause } = makeFake('RUNNING');
    renderHook(() => useAppStatePause(controller));

    handler('inactive');
    expect(pause).toHaveBeenCalledTimes(1);
  });

  it('does nothing when backgrounded while not RUNNING', () => {
    const { controller, pause } = makeFake('PAUSED');
    renderHook(() => useAppStatePause(controller));

    handler('background');
    expect(pause).not.toHaveBeenCalled();
  });

  it('does nothing when returning to the foreground (active)', () => {
    const { controller, pause } = makeFake('RUNNING');
    renderHook(() => useAppStatePause(controller));

    handler('active');
    expect(pause).not.toHaveBeenCalled();
  });

  it('unsubscribes on unmount', () => {
    const { controller } = makeFake('RUNNING');
    const { unmount } = renderHook(() => useAppStatePause(controller));

    unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
