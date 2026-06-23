import { render, screen, fireEvent } from '@testing-library/react-native';
import { SettingsScreen } from '../src/screens/SettingsScreen';
import { SkinProvider } from '../src/skins/SkinProvider';
import { useSettingsStore } from '../src/state/useSettingsStore';
import { useScoresStore } from '../src/state/useScoresStore';
import { DEFAULT_SETTINGS } from '../src/services/StoragePort';
import type { StoragePort } from '../src/services/StoragePort';
import { SKIN_IDS } from '../src/skins/registry';

const mockBack = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: mockBack }),
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { name: 'Coil', version: '1.2.3' } },
}));

function makeMockStorage(): jest.Mocked<StoragePort> {
  return {
    getSettings: jest.fn(() => Promise.resolve({ ...DEFAULT_SETTINGS })),
    setSettings: jest.fn((_s) => Promise.resolve()),
    getScores: jest.fn(() => Promise.resolve({ bests: {} })),
    setScores: jest.fn((_s) => Promise.resolve()),
    resetScores: jest.fn(() => Promise.resolve()),
  };
}

let storage: jest.Mocked<StoragePort>;

beforeEach(async () => {
  jest.clearAllMocks();
  storage = makeMockStorage();
  useSettingsStore.setState({ ...DEFAULT_SETTINGS, hydrated: false });
  useScoresStore.setState({ bests: {}, hydrated: false });
  // Wire the settings store's persistence to our mock storage.
  await useSettingsStore.getState().hydrate(storage);
  storage.setSettings.mockClear();
});

const renderSettings = () =>
  render(
    <SkinProvider>
      <SettingsScreen storage={storage} />
    </SkinProvider>,
  );

describe('SettingsScreen (FR-UI5, FR-A3)', () => {
  it('toggling Sound updates the store and persists', () => {
    renderSettings();
    expect(useSettingsStore.getState().soundEnabled).toBe(true);

    fireEvent(screen.getByTestId('sound-toggle'), 'valueChange', false);

    expect(useSettingsStore.getState().soundEnabled).toBe(false);
    expect(storage.setSettings).toHaveBeenCalledWith(
      expect.objectContaining({ soundEnabled: false }),
    );
  });

  it('toggling Haptics updates the store and persists, independently of Sound', () => {
    renderSettings();
    fireEvent(screen.getByTestId('haptics-toggle'), 'valueChange', false);

    expect(useSettingsStore.getState().hapticsEnabled).toBe(false);
    expect(useSettingsStore.getState().soundEnabled).toBe(true); // untouched
    expect(storage.setSettings).toHaveBeenCalledWith(
      expect.objectContaining({ hapticsEnabled: false, soundEnabled: true }),
    );
  });

  it('Reset requires confirmation; confirming calls scores.reset', () => {
    const resetSpy = jest
      .spyOn(useScoresStore.getState(), 'reset')
      .mockResolvedValue();
    renderSettings();

    // No dialog initially.
    expect(screen.queryByTestId('reset-confirm-dialog')).toBeNull();

    fireEvent.press(screen.getByTestId('reset-button'));
    expect(screen.getByTestId('reset-confirm-dialog')).toBeOnTheScreen();
    expect(resetSpy).not.toHaveBeenCalled(); // not yet

    fireEvent.press(screen.getByTestId('reset-confirm-button'));
    expect(resetSpy).toHaveBeenCalledWith(storage);

    resetSpy.mockRestore();
  });

  it('cancelling the reset dialog does not reset', () => {
    const resetSpy = jest
      .spyOn(useScoresStore.getState(), 'reset')
      .mockResolvedValue();
    renderSettings();

    fireEvent.press(screen.getByTestId('reset-button'));
    fireEvent.press(screen.getByTestId('reset-cancel-button'));

    expect(resetSpy).not.toHaveBeenCalled();
    expect(screen.queryByTestId('reset-confirm-dialog')).toBeNull();

    resetSpy.mockRestore();
  });

  it('renders the app version', () => {
    renderSettings();
    expect(screen.getByTestId('version')).toHaveTextContent('1.2.3');
  });

  it('has a back affordance to Home', () => {
    renderSettings();
    fireEvent.press(screen.getByTestId('back-button'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('the Account row navigates to /account (Prompt 45)', () => {
    renderSettings();
    fireEvent.press(screen.getByTestId('account-link'));
    expect(mockPush).toHaveBeenCalledWith('/account');
  });

  describe('Skin picker (Prompt 33)', () => {
    it('shows one option per SKIN_IDS', () => {
      renderSettings();
      for (const id of SKIN_IDS) {
        expect(screen.getByTestId(`skin-option-${id}`)).toBeOnTheScreen();
      }
    });

    it('tapping an option calls setSkin and persists that id', () => {
      renderSettings();
      fireEvent.press(screen.getByTestId('skin-option-neon'));

      expect(useSettingsStore.getState().skinId).toBe('neon');
      expect(storage.setSettings).toHaveBeenCalledWith(
        expect.objectContaining({ skinId: 'neon' }),
      );
    });

    it('reflects the selected skin', () => {
      renderSettings();
      fireEvent.press(screen.getByTestId('skin-option-amberCrt'));

      expect(
        screen.getByTestId('skin-option-amberCrt').props.accessibilityState,
      ).toEqual(expect.objectContaining({ selected: true }));
      expect(
        screen.getByTestId('skin-option-neon').props.accessibilityState,
      ).toEqual(expect.objectContaining({ selected: false }));
    });
  });

  describe('Controls toggle (Prompt 36)', () => {
    it('defaults to Swipe selected', () => {
      renderSettings();
      expect(
        screen.getByTestId('control-scheme-SWIPE').props.accessibilityState,
      ).toEqual(expect.objectContaining({ selected: true }));
      expect(
        screen.getByTestId('control-scheme-DPAD').props.accessibilityState,
      ).toEqual(expect.objectContaining({ selected: false }));
    });

    it('selecting D-pad updates the store and persists', () => {
      renderSettings();
      fireEvent.press(screen.getByTestId('control-scheme-DPAD'));

      expect(useSettingsStore.getState().controlScheme).toBe('DPAD');
      expect(storage.setSettings).toHaveBeenCalledWith(
        expect.objectContaining({ controlScheme: 'DPAD' }),
      );
      expect(
        screen.getByTestId('control-scheme-DPAD').props.accessibilityState,
      ).toEqual(expect.objectContaining({ selected: true }));
    });
  });
});
