import * as Haptics from 'expo-haptics';
import { createExpoHaptics } from '../src/services/HapticsPort';
import { createSilentSound, type SoundEvent } from '../src/services/SoundPort';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
}));

const mockHaptics = Haptics as jest.Mocked<typeof Haptics>;

beforeEach(() => {
  jest.clearAllMocks();
  mockHaptics.impactAsync.mockResolvedValue();
  mockHaptics.notificationAsync.mockResolvedValue();
});

describe('createExpoHaptics (EH-9)', () => {
  it('invokes the expected expo-haptics API on success', () => {
    const haptics = createExpoHaptics();
    haptics.eat();
    expect(mockHaptics.impactAsync).toHaveBeenCalledWith(
      Haptics.ImpactFeedbackStyle.Light,
    );

    haptics.death();
    expect(mockHaptics.notificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Error,
    );
  });

  it('does not throw when the underlying module throws synchronously', () => {
    mockHaptics.impactAsync.mockImplementation(() => {
      throw new Error('haptics unsupported');
    });
    mockHaptics.notificationAsync.mockImplementation(() => {
      throw new Error('haptics unsupported');
    });
    const haptics = createExpoHaptics();
    expect(() => haptics.eat()).not.toThrow();
    expect(() => haptics.death()).not.toThrow();
  });

  it('does not surface a rejected promise from the underlying module', async () => {
    mockHaptics.impactAsync.mockRejectedValueOnce(new Error('async fail'));
    mockHaptics.notificationAsync.mockRejectedValueOnce(new Error('async fail'));
    const haptics = createExpoHaptics();
    expect(() => haptics.eat()).not.toThrow();
    expect(() => haptics.death()).not.toThrow();
    // Let microtasks flush; an unhandled rejection would fail the test run.
    await Promise.resolve();
    await Promise.resolve();
  });
});

describe('createSilentSound (EH-10)', () => {
  const events: SoundEvent[] = [
    'ATE_FOOD',
    'ATE_BONUS',
    'DIED',
    'WON',
    'GOT_POWERUP',
    'EFFECT_EXPIRED',
    'UI_TAP',
    'COUNTDOWN_TICK',
    'GO',
    'REVIVE',
  ];

  it('play() does not throw for any SoundEvent', () => {
    const sound = createSilentSound();
    for (const event of events) {
      expect(() => sound.play(event)).not.toThrow();
    }
  });

  it('preload() resolves without throwing', async () => {
    const sound = createSilentSound();
    await expect(sound.preload()).resolves.toBeUndefined();
  });
});
