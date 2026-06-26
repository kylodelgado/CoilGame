import { useCallback, useMemo, useRef, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { Direction } from '../engine/types';
import { SWIPE_THRESHOLD_PX, type InputSource } from './InputSource';

/** Finger speed (px/s) needed to register a flick → a turn. */
const FLICK_VELOCITY = 520;
/** The finger must slow below this (px/s) before another flick can fire. */
const REARM_VELOCITY = 240;
/** A flick's dominant axis must beat the other by this factor (cardinal clarity). */
const FLICK_DOMINANCE = 1.2;

/**
 * Swipe InputSource. A Pan gesture covering the play area maps FLICKS to
 * Directions and pushes them to subscribers. It supports lift-free multi-turn,
 * but disambiguates real turns from incidental hand-curvature by VELOCITY rather
 * than path shape:
 *
 *  - A turn fires when the finger speed crosses FLICK_VELOCITY in a clear cardinal
 *    direction (a deliberate flick) — snappy, mid-drag, no wait for lift.
 *  - After firing it DISARMS, and only re-arms once the finger slows below
 *    REARM_VELOCITY. A smooth continuous arc never slows, so it fires once and
 *    won't keep turning; a sharp corner naturally dips in speed at the vertex, so
 *    it re-arms and the next flick lands. Distinct flicks → distinct turns.
 *
 * Velocity comes straight from the Pan event (px/s). The `threshold` param is
 * kept for API compatibility but unused by the flick model.
 *
 * With Reanimated installed, RNGH runs gesture callbacks as UI-thread worklets by
 * default. We force them back onto the JS thread with .runOnJS(true) so the plain
 * helpers and the JS listener Set work directly.
 */
export function useSwipeInput(
  threshold: number = SWIPE_THRESHOLD_PX,
): { gesture: ReturnType<typeof Gesture.Pan>; subscribe: InputSource['subscribe'] } {
  void threshold;
  const listeners = useRef(new Set<(dir: Direction) => void>()).current;
  // Whether a new flick may fire (re-armed once the finger slows between flicks).
  const armed = useRef(true);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .onBegin(() => {
          armed.current = true;
        })
        .onUpdate((e) => {
          const vx = e.velocityX;
          const vy = e.velocityY;
          const speed = Math.sqrt(vx * vx + vy * vy);

          if (!armed.current) {
            // Wait for the finger to slow between flicks before allowing another.
            if (speed < REARM_VELOCITY) {
              armed.current = true;
            }
            return;
          }
          if (speed < FLICK_VELOCITY) {
            return;
          }
          const avx = Math.abs(vx);
          const avy = Math.abs(vy);
          // Ignore ambiguous (diagonal) flicks — need a clear cardinal.
          if (Math.max(avx, avy) < Math.min(avx, avy) * FLICK_DOMINANCE) {
            return;
          }
          const dir: Direction =
            avx >= avy ? (vx > 0 ? 'RIGHT' : 'LEFT') : vy > 0 ? 'DOWN' : 'UP';
          armed.current = false;
          listeners.forEach((listener) => listener(dir));
        }),
    [listeners],
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
