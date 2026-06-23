import { act, renderHook } from '@testing-library/react-native';
import { useGameLoop } from '../src/runtime/useGameLoop';
import type { GameController } from '../src/runtime/GameController';
import type { GameState } from '../src/engine/types';

interface Live {
  status: GameState['status'];
  tickMs: number;
}

function makeFake(init: Live) {
  const live: Live = { ...init };
  const step = jest.fn();
  const controller = {
    getState: (): GameState => ({
      status: live.status,
      tickMs: live.tickMs,
      snake: [],
      direction: 'RIGHT',
      inputQueue: [],
      food: null,
      score: 0,
      foodEaten: 0,
      bonusFood: null,
      bonusRemaining: 0,
      ticksUntilBonus: Infinity,
    }),
    step,
    tapToStart: jest.fn(),
    setRunning: jest.fn(),
    enqueue: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    restart: jest.fn(),
    quit: jest.fn(),
  } as unknown as GameController;
  return { controller, step, live };
}

const advance = (ms: number) =>
  act(() => {
    jest.advanceTimersByTime(ms);
  });

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('useGameLoop (§4.3, EH-7)', () => {
  it('invokes step() once per tickMs interval while RUNNING', () => {
    const { controller, step } = makeFake({ status: 'RUNNING', tickMs: 100 });
    renderHook(() => useGameLoop(controller, true));

    expect(step).not.toHaveBeenCalled();
    advance(100);
    expect(step).toHaveBeenCalledTimes(1);
    advance(100);
    expect(step).toHaveBeenCalledTimes(2);
    advance(300);
    expect(step).toHaveBeenCalledTimes(5);
  });

  it('reads tickMs fresh each step so acceleration applies immediately', () => {
    const { controller, step, live } = makeFake({
      status: 'RUNNING',
      tickMs: 100,
    });
    renderHook(() => useGameLoop(controller, true));

    // Speed up before the first interval completes; the reschedule that runs
    // right after step #1 must pick up the new, shorter delay.
    live.tickMs = 50;

    advance(100);
    expect(step).toHaveBeenCalledTimes(1); // first timer used the mounted 100ms

    // Under the old cadence step #2 would be at t=200; at the fresh 50ms it
    // fires at t=150, so a 50ms advance is enough.
    advance(50);
    expect(step).toHaveBeenCalledTimes(2);
    advance(50);
    expect(step).toHaveBeenCalledTimes(3);
  });

  it('stops scheduling when status leaves RUNNING (internal pause)', () => {
    const { controller, step, live } = makeFake({
      status: 'RUNNING',
      tickMs: 100,
    });
    // The step itself pauses the game.
    step.mockImplementation(() => {
      live.status = 'PAUSED';
    });
    renderHook(() => useGameLoop(controller, true));

    advance(100);
    expect(step).toHaveBeenCalledTimes(1);
    advance(1000);
    expect(step).toHaveBeenCalledTimes(1); // no reschedule after pause
  });

  it('stops when isRunning becomes false (no further steps)', () => {
    const { controller, step } = makeFake({ status: 'RUNNING', tickMs: 100 });
    const { rerender } = renderHook(
      (props: { isRunning: boolean }) =>
        useGameLoop(controller, props.isRunning),
      { initialProps: { isRunning: true } },
    );

    advance(100);
    expect(step).toHaveBeenCalledTimes(1);

    rerender({ isRunning: false });
    advance(1000);
    expect(step).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('never schedules while status is not RUNNING', () => {
    const { controller, step } = makeFake({
      status: 'COUNTDOWN',
      tickMs: 100,
    });
    renderHook(() => useGameLoop(controller, true));

    expect(jest.getTimerCount()).toBe(0);
    advance(1000);
    expect(step).not.toHaveBeenCalled();
  });

  it('clears the timer on unmount (no step after unmount)', () => {
    const { controller, step } = makeFake({ status: 'RUNNING', tickMs: 100 });
    const { unmount } = renderHook(() => useGameLoop(controller, true));

    advance(100);
    expect(step).toHaveBeenCalledTimes(1);

    unmount();
    expect(jest.getTimerCount()).toBe(0);
    advance(1000);
    expect(step).toHaveBeenCalledTimes(1);
  });

  it('holds the single-timer invariant across rapid isRunning toggles', () => {
    const { controller, step } = makeFake({ status: 'RUNNING', tickMs: 100 });
    const { rerender } = renderHook(
      (props: { isRunning: boolean }) =>
        useGameLoop(controller, props.isRunning),
      { initialProps: { isRunning: true } },
    );

    // Toggle repeatedly; at no point should more than one timer be pending.
    for (const isRunning of [false, true, false, true, true, false, true]) {
      rerender({ isRunning });
      expect(jest.getTimerCount()).toBeLessThanOrEqual(1);
    }

    // Settled in the running state with exactly one pending timer.
    expect(jest.getTimerCount()).toBe(1);
    advance(100);
    expect(step).toHaveBeenCalledTimes(1); // exactly one step per interval
    expect(jest.getTimerCount()).toBe(1);
  });
});
