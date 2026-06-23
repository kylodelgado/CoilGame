import { enqueueDirection } from '../src/engine/input';
import type { Direction, GameState } from '../src/engine/types';

function makeState(
  direction: Direction,
  inputQueue: Direction[] = [],
): GameState {
  return {
    status: 'RUNNING',
    snake: [
      { x: 3, y: 3 },
      { x: 2, y: 3 },
      { x: 1, y: 3 },
    ],
    direction,
    inputQueue,
    food: null,
    score: 0,
    foodEaten: 0,
    tickMs: 200,
  };
}

describe('enqueueDirection (FR-C2, FR-C3)', () => {
  it('ignores a direction opposite the committed heading', () => {
    const state = makeState('RIGHT');
    expect(enqueueDirection(state, 'LEFT')).toBe(state);
  });

  it('ignores a direction opposite the LAST QUEUED direction', () => {
    // Heading RIGHT, queue [UP]; DOWN is opposite UP => ignored.
    const state = makeState('RIGHT', ['UP']);
    expect(enqueueDirection(state, 'DOWN')).toBe(state);
  });

  it('ignores a duplicate of the reference direction (heading)', () => {
    const state = makeState('RIGHT');
    expect(enqueueDirection(state, 'RIGHT')).toBe(state);
  });

  it('ignores a duplicate of the reference direction (last queued)', () => {
    const state = makeState('RIGHT', ['UP']);
    expect(enqueueDirection(state, 'UP')).toBe(state);
  });

  it('caps the queue at length 2, dropping a third legal input', () => {
    // Heading RIGHT, queue [UP, LEFT] (both legal). DOWN is legal vs LEFT,
    // but the queue is full, so it is dropped.
    const state = makeState('RIGHT', ['UP', 'LEFT']);
    expect(enqueueDirection(state, 'DOWN')).toBe(state);
  });

  it('chains a double-swipe: RIGHT, enqueue UP then LEFT => [UP, LEFT]', () => {
    const start = makeState('RIGHT');
    const afterUp = enqueueDirection(start, 'UP');
    expect(afterUp.inputQueue).toEqual(['UP']);
    const afterLeft = enqueueDirection(afterUp, 'LEFT');
    expect(afterLeft.inputQueue).toEqual(['UP', 'LEFT']);
  });

  it('accepts a first legal turn onto the queue', () => {
    const state = makeState('RIGHT');
    const next = enqueueDirection(state, 'UP');
    expect(next.inputQueue).toEqual(['UP']);
  });

  it('never mutates the input state object or its queue', () => {
    const queue: Direction[] = ['UP'];
    const state = makeState('RIGHT', queue);
    const snapshot = { ...state, inputQueue: [...queue] };
    const next = enqueueDirection(state, 'LEFT');

    // Original untouched.
    expect(state).toEqual(snapshot);
    expect(state.inputQueue).toBe(queue);
    expect(queue).toEqual(['UP']);
    // A new object and a new array were returned.
    expect(next).not.toBe(state);
    expect(next.inputQueue).not.toBe(state.inputQueue);
  });
});
