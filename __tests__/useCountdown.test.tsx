import { act, renderHook } from '@testing-library/react-native';
import { useCountdown } from '../src/runtime/useCountdown';

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

describe('useCountdown (FR-P4, EH-6)', () => {
  it('counts 3 -> 2 -> 1 and calls onComplete at 0', () => {
    const onComplete = jest.fn();
    const { result } = renderHook(() =>
      useCountdown({ active: true, onComplete }),
    );

    expect(result.current.remaining).toBe(3);
    advance(1000);
    expect(result.current.remaining).toBe(2);
    advance(1000);
    expect(result.current.remaining).toBe(1);
    expect(onComplete).not.toHaveBeenCalled();
    advance(1000);
    expect(result.current.remaining).toBe(0);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('honors a custom seconds value', () => {
    const onComplete = jest.fn();
    const { result } = renderHook(() =>
      useCountdown({ active: true, seconds: 2, onComplete }),
    );
    expect(result.current.remaining).toBe(2);
    advance(2000);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('cancels and resets when active flips to false mid-count (EH-6)', () => {
    const onComplete = jest.fn();
    const { result, rerender } = renderHook(
      (props: { active: boolean }) =>
        useCountdown({ active: props.active, onComplete }),
      { initialProps: { active: true } },
    );

    advance(1000);
    expect(result.current.remaining).toBe(2);

    // App backgrounded: status leaves COUNTDOWN -> active false.
    rerender({ active: false });
    expect(result.current.remaining).toBe(3); // reset

    advance(5000);
    expect(onComplete).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('does not run while inactive', () => {
    const onComplete = jest.fn();
    const { result } = renderHook(() =>
      useCountdown({ active: false, onComplete }),
    );
    expect(result.current.remaining).toBe(3);
    advance(5000);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('clears the timer on unmount', () => {
    const onComplete = jest.fn();
    const { unmount } = renderHook(() =>
      useCountdown({ active: true, onComplete }),
    );
    advance(1000);
    unmount();
    expect(jest.getTimerCount()).toBe(0);
    advance(5000);
    expect(onComplete).not.toHaveBeenCalled();
  });
});
