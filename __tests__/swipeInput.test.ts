import {
  translationToDirection,
  SWIPE_THRESHOLD_PX,
} from '../src/input/InputSource';

describe('translationToDirection (FR-C1/C4)', () => {
  it('maps clear cardinal swipes to the correct Direction', () => {
    expect(translationToDirection(50, 0)).toBe('RIGHT');
    expect(translationToDirection(-50, 0)).toBe('LEFT');
    expect(translationToDirection(0, 50)).toBe('DOWN'); // y grows downward
    expect(translationToDirection(0, -50)).toBe('UP');
  });

  it('returns null for sub-threshold movement', () => {
    expect(translationToDirection(10, 5)).toBeNull();
    expect(translationToDirection(0, 0)).toBeNull();
    expect(translationToDirection(29, 29)).toBeNull(); // both below 30
  });

  it('picks the dominant axis on a diagonal', () => {
    expect(translationToDirection(40, 15)).toBe('RIGHT');
    expect(translationToDirection(15, 40)).toBe('DOWN');
    expect(translationToDirection(-40, -15)).toBe('LEFT');
    expect(translationToDirection(-15, -40)).toBe('UP');
  });

  it('registers at exactly the threshold (>= threshold)', () => {
    expect(translationToDirection(SWIPE_THRESHOLD_PX, 0)).toBe('RIGHT');
    expect(translationToDirection(0, SWIPE_THRESHOLD_PX)).toBe('DOWN');
    expect(translationToDirection(-SWIPE_THRESHOLD_PX, 0)).toBe('LEFT');
    expect(translationToDirection(0, -SWIPE_THRESHOLD_PX)).toBe('UP');
    // Just under the threshold does not register.
    expect(translationToDirection(SWIPE_THRESHOLD_PX - 1, 0)).toBeNull();
  });

  it('honors a custom threshold', () => {
    expect(translationToDirection(15, 0, 10)).toBe('RIGHT');
    expect(translationToDirection(15, 0, 20)).toBeNull();
  });

  it('treats an equal-magnitude diagonal as horizontal (defined tie-break)', () => {
    expect(translationToDirection(40, 40)).toBe('RIGHT');
    expect(translationToDirection(-40, 40)).toBe('LEFT');
  });
});
