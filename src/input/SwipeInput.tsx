import { useCallback, useMemo, useRef, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { Direction } from '../engine/types';
import {
  SWIPE_THRESHOLD_PX,
  translationToDirection,
  type InputSource,
} from './InputSource';

/**
 * Swipe InputSource. A Pan gesture covering the play area maps each completed
 * swipe to a Direction via the pure translationToDirection helper and pushes it
 * to subscribers. The gesture object is returned for attachment; subscribe is
 * the InputSource seam (a D-pad can implement the same contract in Phase 2).
 *
 * RNGH runs these callbacks on the JS thread (no worklets here), so listeners
 * are notified directly.
 */
export function useSwipeInput(
  threshold: number = SWIPE_THRESHOLD_PX,
): { gesture: ReturnType<typeof Gesture.Pan>; subscribe: InputSource['subscribe'] } {
  const listeners = useRef(new Set<(dir: Direction) => void>()).current;

  const gesture = useMemo(
    () =>
      Gesture.Pan().onEnd((e) => {
        const dir = translationToDirection(
          e.translationX,
          e.translationY,
          threshold,
        );
        if (dir !== null) {
          listeners.forEach((listener) => listener(dir));
        }
      }),
    [listeners, threshold],
  );

  const subscribe = useCallback<InputSource['subscribe']>(
    (onDirection) => {
      listeners.add(onDirection);
      return () => {
        listeners.delete(onDirection);
      };
    },
    [listeners],
  );

  return { gesture, subscribe };
}

interface SwipeInputProps {
  onDirection: (dir: Direction) => void;
  threshold?: number;
  children?: ReactNode;
}

/**
 * Convenience adapter: a full-area swipe surface that forwards each detected
 * Direction to onDirection (the GameScreen wires this to controller.enqueue).
 */
export function SwipeInput({
  onDirection,
  threshold,
  children,
}: SwipeInputProps) {
  const { gesture, subscribe } = useSwipeInput(threshold);

  // Bridge the InputSource to the onDirection callback for the lifetime of the
  // component without re-creating the gesture.
  const ref = useRef(onDirection);
  ref.current = onDirection;
  useMemo(() => subscribe((dir) => ref.current(dir)), [subscribe]);

  return (
    <GestureDetector gesture={gesture}>
      <View style={StyleSheet.absoluteFill}>{children}</View>
    </GestureDetector>
  );
}
