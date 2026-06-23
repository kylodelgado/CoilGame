import { useEffect, useRef } from 'react';
import type { GameController } from './GameController';

/**
 * Self-rescheduling, single-timer scheduler that drives controller.step() while
 * the game is RUNNING. It reads the CURRENT tickMs each step so acceleration
 * applies immediately, keeps exactly one timer in a ref (clearing before every
 * schedule and on unmount), and never schedules unless the status is RUNNING.
 * No per-tick React state churn. (§4.3, EH-7)
 */
export function useGameLoop(
  controller: GameController,
  isRunning: boolean,
): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clear = (): void => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const scheduleNext = (): void => {
      // Single-timer invariant: drop any existing timer before scheduling.
      clear();
      const { tickMs } = controller.getState();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        controller.step();
        // Read status fresh: only continue while still RUNNING.
        if (controller.getState().status === 'RUNNING') {
          scheduleNext();
        }
      }, tickMs);
    };

    if (isRunning && controller.getState().status === 'RUNNING') {
      scheduleNext();
    }

    return clear;
  }, [controller, isRunning]);
}
