import { fireEvent, render, renderHook, screen } from '@testing-library/react-native';
import {
  DpadInput,
  useDpadInput,
  buttonToDirection,
  type DpadButton,
} from '../src/input/DpadInput';
import type { Direction } from '../src/engine/types';

const buttons: DpadButton[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];

describe('buttonToDirection (pure mapping)', () => {
  it('maps each arrow button to its Direction', () => {
    expect(buttonToDirection('UP')).toBe<Direction>('UP');
    expect(buttonToDirection('DOWN')).toBe<Direction>('DOWN');
    expect(buttonToDirection('LEFT')).toBe<Direction>('LEFT');
    expect(buttonToDirection('RIGHT')).toBe<Direction>('RIGHT');
  });
});

describe('DpadInput component', () => {
  it('each arrow press emits the correct Direction via onDirection', () => {
    const onDirection = jest.fn();
    render(<DpadInput onDirection={onDirection} />);

    for (const b of buttons) {
      fireEvent.press(screen.getByTestId(`dpad-${b.toLowerCase()}`));
    }

    expect(onDirection.mock.calls.map((c) => c[0])).toEqual([
      'UP',
      'DOWN',
      'LEFT',
      'RIGHT',
    ]);
  });
});

describe('useDpadInput (InputSource subscribe pattern)', () => {
  it('delivers a pressed Direction to a subscriber and stops after unsubscribe', () => {
    const { result } = renderHook(() => useDpadInput());
    const received: Direction[] = [];

    const unsubscribe = result.current.subscribe((d) => received.push(d));

    result.current.press('LEFT');
    result.current.press('UP');
    expect(received).toEqual(['LEFT', 'UP']);

    unsubscribe();
    result.current.press('DOWN');
    expect(received).toEqual(['LEFT', 'UP']); // no further delivery
  });

  it('fans out to multiple subscribers independently', () => {
    const { result } = renderHook(() => useDpadInput());
    const a: Direction[] = [];
    const b: Direction[] = [];
    const unsubA = result.current.subscribe((d) => a.push(d));
    result.current.subscribe((d) => b.push(d));

    result.current.press('RIGHT');
    expect(a).toEqual(['RIGHT']);
    expect(b).toEqual(['RIGHT']);

    unsubA();
    result.current.press('UP');
    expect(a).toEqual(['RIGHT']); // unsubscribed
    expect(b).toEqual(['RIGHT', 'UP']);
  });
});
