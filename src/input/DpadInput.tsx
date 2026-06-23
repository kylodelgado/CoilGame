import { useCallback, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Direction } from '../engine/types';
import { useSkin } from '../skins/SkinProvider';
import type { InputSource } from './InputSource';

/**
 * The four D-pad buttons. They happen to share their names with Direction, but
 * the mapping is kept explicit (and tested) so the button layer and the engine
 * vocabulary can diverge later without surprises.
 */
export type DpadButton = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

/** Pure button -> Direction mapping. */
export function buttonToDirection(button: DpadButton): Direction {
  return button;
}

/**
 * D-pad InputSource hook, mirroring useSwipeInput: maintains a listener Set,
 * exposes subscribe (the InputSource seam) and press (invoked by the buttons),
 * so a pressed button fans the mapped Direction out to every subscriber.
 */
export function useDpadInput(): {
  subscribe: InputSource['subscribe'];
  press: (button: DpadButton) => void;
} {
  const listeners = useRef(new Set<(dir: Direction) => void>()).current;

  const subscribe = useCallback<InputSource['subscribe']>(
    (onDirection) => {
      listeners.add(onDirection);
      return () => {
        listeners.delete(onDirection);
      };
    },
    [listeners],
  );

  const press = useCallback(
    (button: DpadButton) => {
      const dir = buttonToDirection(button);
      listeners.forEach((listener) => listener(dir));
    },
    [listeners],
  );

  return { subscribe, press };
}

interface DpadInputProps {
  onDirection: (dir: Direction) => void;
}

const GLYPH: Record<DpadButton, string> = {
  UP: '▲',
  DOWN: '▼',
  LEFT: '◀',
  RIGHT: '▶',
};

/**
 * On-screen D-pad: four arrow buttons laid out in a cross. Pressing one forwards
 * the mapped Direction to onDirection (the GameScreen wires this to
 * controller.enqueue), through the same InputSource subscribe seam as swipes.
 * Lives in the chrome below the board, never over the grid.
 */
export function DpadInput({ onDirection }: DpadInputProps) {
  const skin = useSkin();
  const { subscribe, press } = useDpadInput();

  // Bridge the InputSource to onDirection for the component's lifetime without
  // re-subscribing on every render.
  const ref = useRef(onDirection);
  ref.current = onDirection;
  useMemo(() => subscribe((dir) => ref.current(dir)), [subscribe]);

  const button = (b: DpadButton) => (
    <Pressable
      testID={`dpad-${b.toLowerCase()}`}
      accessibilityRole="button"
      accessibilityLabel={`Move ${b.toLowerCase()}`}
      onPress={() => press(b)}
      style={[styles.button, { borderColor: skin.snakeBody }]}
    >
      <Text style={[styles.glyph, { color: skin.snakeHead }]}>{GLYPH[b]}</Text>
    </Pressable>
  );

  return (
    <View testID="dpad" style={styles.pad}>
      <View style={styles.row}>{button('UP')}</View>
      <View style={styles.row}>
        {button('LEFT')}
        <View style={styles.spacer} />
        {button('RIGHT')}
      </View>
      <View style={styles.row}>{button('DOWN')}</View>
    </View>
  );
}

const BUTTON_SIZE = 56;

const styles = StyleSheet.create({
  pad: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  spacer: { width: BUTTON_SIZE },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: { fontSize: 22, fontWeight: '700' },
});
