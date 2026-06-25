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
 * Swipe InputSource. A Pan gesture covering the play area maps swipes to a
 * Direction via the pure translationToDirection helper and pushes them to
 * subscribers. The turn fires the instant travel crosses the threshold DURING the
 * drag (not on finger-lift), then re-anchors so a continued drag can chain a
 * second turn — this removes the lift latency that made fast play feel laggy. The
 * gesture object is returned for attachment; subscribe is the InputSource seam.
 *
 * With Reanimated installed, RNGH runs gesture callbacks as UI-thread worklets
 * by default. We force them back onto the JS thread with .runOnJS(true) so the
 * plain translationToDirection helper and the JS listener Set work directly.
 */
export function useSwipeInput(
  threshold: number = SWIPE_THRESHOLD_PX,
): { gesture: ReturnType<typeof Gesture.Pan>; subscribe: InputSource['subscribe'] } {
  const listeners = useRef(new Set<(dir: Direction) => void>()).current;
  // Translation (since gesture start) at which we last emitted a turn; deltas are
  // measured from here so each fresh threshold of travel chains another turn.
  const anchor = useRef({ x: 0, y: 0 });

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .onBegin(() => {
          anchor.current = { x: 0, y: 0 };
        })
        .onUpdate((e) => {
          const dir = translationToDirection(
            e.translationX - anchor.current.x,
            e.translationY - anchor.current.y,
            threshold,
          );
          if (dir !== null) {
            anchor.current = { x: e.translationX, y: e.translationY };
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
