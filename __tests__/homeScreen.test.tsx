import { render, screen, fireEvent } from '@testing-library/react-native';
import { HomeScreen } from '../src/screens/HomeScreen';
import { SkinProvider } from '../src/skins/SkinProvider';
import { useSettingsStore } from '../src/state/useSettingsStore';
import { useScoresStore } from '../src/state/useScoresStore';
import { DEFAULT_SETTINGS } from '../src/services/StoragePort';

jest.mock('@shopify/react-native-skia', () => {
  const React = require('react');
  const { View } = require('react-native');
  const passthrough =
    () =>
    ({ children }: { children?: React.ReactNode }) =>
      React.createElement(View, null, children ?? null);
  return {
    Canvas: passthrough(),
    Group: passthrough(),
    Fill: passthrough(),
    Rect: passthrough(),
    RoundedRect: passthrough(),
    Circle: passthrough(),
  };
});

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  useSettingsStore.setState({ ...DEFAULT_SETTINGS, hydrated: true });
  useScoresStore.setState({ bests: {}, hydrated: true });
});

const renderHome = () =>
  render(
    <SkinProvider>
      <HomeScreen />
    </SkinProvider>,
  );

describe('HomeScreen selection flow (FR-UI1/UI2)', () => {
  it('selecting a preset highlights it and updates the store but does NOT navigate', () => {
    renderHome();
    expect(useSettingsStore.getState().presetId).toBe('STANDARD');

    fireEvent.press(screen.getByTestId('preset-DENSE'));

    expect(useSettingsStore.getState().presetId).toBe('DENSE');
    expect(
      screen.getByTestId('preset-DENSE').props.accessibilityState.selected,
    ).toBe(true);
    expect(
      screen.getByTestId('preset-STANDARD').props.accessibilityState.selected,
    ).toBe(false);
    expect(mockPush).not.toHaveBeenCalled(); // no auto-launch
  });

  it('Play navigates to /game with the selected preset + wall', () => {
    renderHome();
    fireEvent.press(screen.getByTestId('preset-CLASSIC'));
    fireEvent.press(screen.getByTestId('wall-PORTAL'));

    fireEvent.press(screen.getByTestId('play-button'));

    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/game',
      params: { presetId: 'CLASSIC', wall: 'PORTAL', modeId: 'CLASSIC' },
    });
  });

  it('renders both high scores for the selected mode', () => {
    useScoresStore.setState({
      bests: { 'CLASSIC:SOLID': 120, 'CLASSIC:PORTAL': 80 },
      hydrated: true,
    });
    renderHome();

    expect(screen.getByTestId('best-solid')).toHaveTextContent('120');
    expect(screen.getByTestId('best-portal')).toHaveTextContent('80');
  });

  describe('mode picker (Prompt 40)', () => {
    it('selecting a mode updates the store and the shown scores follow the mode', () => {
      useScoresStore.setState({
        bests: {
          'CLASSIC:SOLID': 120,
          'CLASSIC:PORTAL': 80,
          'DYNAMIC_WALLS:SOLID': 45,
          'DYNAMIC_WALLS:PORTAL': 12,
        },
        hydrated: true,
      });
      renderHome();

      // Defaults to CLASSIC.
      expect(screen.getByTestId('best-solid')).toHaveTextContent('120');
      expect(screen.getByTestId('best-portal')).toHaveTextContent('80');

      fireEvent.press(screen.getByTestId('mode-DYNAMIC_WALLS'));

      expect(useSettingsStore.getState().modeId).toBe('DYNAMIC_WALLS');
      expect(screen.getByTestId('best-solid')).toHaveTextContent('45');
      expect(screen.getByTestId('best-portal')).toHaveTextContent('12');
      expect(
        screen.getByTestId('mode-DYNAMIC_WALLS').props.accessibilityState
          .selected,
      ).toBe(true);
    });

    it('Play passes the selected mode', () => {
      renderHome();
      fireEvent.press(screen.getByTestId('mode-DYNAMIC_WALLS'));
      fireEvent.press(screen.getByTestId('play-button'));

      expect(mockPush).toHaveBeenCalledWith({
        pathname: '/game',
        params: { presetId: 'STANDARD', wall: 'SOLID', modeId: 'DYNAMIC_WALLS' },
      });
    });
  });

  it('toggling the wall updates the settings store wallBehavior', () => {
    renderHome();
    expect(useSettingsStore.getState().wallBehavior).toBe('SOLID');

    fireEvent.press(screen.getByTestId('wall-PORTAL'));
    expect(useSettingsStore.getState().wallBehavior).toBe('PORTAL');

    fireEvent.press(screen.getByTestId('wall-SOLID'));
    expect(useSettingsStore.getState().wallBehavior).toBe('SOLID');
  });

  it('the gear navigates to /settings', () => {
    renderHome();
    fireEvent.press(screen.getByTestId('settings-button'));
    expect(mockPush).toHaveBeenCalledWith('/settings');
  });
});
