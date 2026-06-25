import { useCallback, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import type { Direction } from '../engine/types';
import { useSkin } from '../skins/SkinProvider';
import { translationToDirection } from './InputSource';

interface AnalogInputProps {
  onDirection: (dir: Direction) => void;
}

const BASE_RADIUS = 56;
const KNOB_RADIUS = 24;
/** Travel from the anchor before a cardinal direction registers. */
const DEADZONE_PX = 22;

/**
 * Virtual-joystick InputSource: press anywhere on the board to anchor a stick,
 * then hold and drag to steer. Each frame the drag vector is quantized to a
 * cardinal direction (the same tested translationToDirection mapping) and pushed
 * continuously — so the snake follows your thumb with no per-turn gesture cost,
 * the lowest-latency control. The dedup in enqueueDirection means only direction
 * changes actually reach the engine.
 *
 * The stick base + knob are Reanimated views driven entirely on the UI thread
 * (shared values), so steering never churns React state mid-game; only the
 * one-shot direction change crosses to JS via runOnJS. (analog controls)
 */
export function AnalogInput({ onDirection }: AnalogInputProps) {
  const skin = useSkin();

  // Anchor (touch-down point) and knob offset, in view pixels — all UI-thread.
  const baseX = useSharedValue(0);
  const baseY = useSharedValue(0);
  const knobX = useSharedValue(0);
  const knobY = useSharedValue(0);
  const active = useSharedValue(0);
  // Last cardinal emitted this gesture, so we only cross to JS on a change.
  const lastDir = useSharedValue<string>('');

  const emitRef = useRef(onDirection);
  emitRef.current = onDirection;
  const emit = useCallback((dir: Direction) => emitRef.current(dir), []);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .onBegin((e) => {
          'worklet';
          baseX.value = e.x;
          baseY.value = e.y;
          knobX.value = 0;
          knobY.value = 0;
          lastDir.value = '';
          active.value = 1;
        })
        .onUpdate((e) => {
          'worklet';
          const dx = e.translationX;
          const dy = e.translationY;
          // Clamp the knob to the base radius for the visual.
          const mag = Math.sqrt(dx * dx + dy * dy);
          const k = mag > BASE_RADIUS ? BASE_RADIUS / mag : 1;
          knobX.value = dx * k;
          knobY.value = dy * k;
          // Steer: quantize to a cardinal past the deadzone, emit on change.
          const dir = translationToDirection(dx, dy, DEADZONE_PX);
          if (dir !== null && dir !== lastDir.value) {
            lastDir.value = dir;
            runOnJS(emit)(dir);
          }
        })
        .onFinalize(() => {
          'worklet';
          active.value = 0;
        }),
    [emit, baseX, baseY, knobX, knobY, active, lastDir],
  );

  const baseStyle = useAnimatedStyle(() => ({
    opacity: active.value ? 0.35 : 0,
    transform: [
      { translateX: baseX.value - BASE_RADIUS },
      { translateY: baseY.value - BASE_RADIUS },
    ],
  }));
  const knobStyle = useAnimatedStyle(() => ({
    opacity: active.value ? 0.9 : 0,
    transform: [
      { translateX: baseX.value + knobX.value - KNOB_RADIUS },
      { translateY: baseY.value + knobY.value - KNOB_RADIUS },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <View style={StyleSheet.absoluteFill} testID="analog-surface">
        <Animated.View
          pointerEvents="none"
          style={[
            styles.base,
            { borderColor: skin.snakeBody },
            baseStyle,
          ]}
        />
        <Animated.View
          pointerEvents="none"
          style={[styles.knob, { backgroundColor: skin.snakeHead }, knobStyle]}
        />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  base: {
    position: 'absolute',
    width: BASE_RADIUS * 2,
    height: BASE_RADIUS * 2,
    borderRadius: BASE_RADIUS,
    borderWidth: 2,
  },
  knob: {
    position: 'absolute',
    width: KNOB_RADIUS * 2,
    height: KNOB_RADIUS * 2,
    borderRadius: KNOB_RADIUS,
  },
});
