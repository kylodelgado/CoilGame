import { useEffect, useRef, useState } from 'react';

interface UseCountdownOpts {
  active: boolean;
  seconds?: number;
  onComplete: () => void;
}

/**
 * A 3-second (by default) resume/start countdown. When `active` becomes true it
 * counts down once per second and calls onComplete at 0. If `active` goes false
 * mid-count (e.g. the app is backgrounded so status leaves COUNTDOWN), the timer
 * is cancelled and the count resets. Single timer in a ref, cleared on unmount.
 * (FR-P4, EH-6)
 */
export function useCountdown(opts: UseCountdownOpts): { remaining: number } {
  const { active, seconds = 3, onComplete } = opts;
  const [remaining, setRemaining] = useState(seconds);

  // Always invoke the latest onComplete without re-arming the timer.
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const clear = (): void => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };

    if (!active) {
      clear();
      setRemaining(seconds);
      return clear;
    }

    setRemaining(seconds);
    timerRef.current = setInterval(() => {
      setRemaining((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          clear();
          onCompleteRef.current();
          return 0;
        }
        return next;
      });
    }, 1000);

    return clear;
  }, [active, seconds]);

  return { remaining };
}
