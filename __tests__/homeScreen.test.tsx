import { render, screen, fireEvent } from '@testing-library/react-native';
import { HomeScreen } from '../src/screens/HomeScreen';
import { SkinProvider } from '../src/skins/SkinProvider';
import { useSettingsStore } from '../src/state/useSettingsStore';
import { useScoresStore } from '../src/state/useScoresStore';
import { DEFAULT_SETTINGS } from '../src/services/StoragePort';

// Skia + Reanimated + vector icons are stubbed globally in jest.setup.js.

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

  it('shows the best for the CURRENT mode×wall board, following the wall toggle', () => {
    useScoresStore.setState({
      bests: { 'CLASSIC:SOLID': 120, 'CLASSIC:PORTAL': 80 },
      hydrated: true,
    });
    renderHome();

    // Defaults: CLASSIC + SOLID.
    expect(screen.getByTestId('best-score')).toHaveTextContent('120');

    fireEvent.press(screen.getByTestId('wall-PORTAL'));
    expect(screen.getByTestId('best-score')).toHaveTextContent('80');
  });

  describe('mode picker (Prompt 40)', () => {
    it('selecting a mode updates the store and the shown best follows the mode', () => {
      useScoresStore.setState({
        bests: {
          'CLASSIC:SOLID': 120,
          'DYNAMIC_WALLS:SOLID': 45,
        },
        hydrated: true,
      });
      renderHome();

      // Defaults to CLASSIC.
      expect(screen.getByTestId('best-score')).toHaveTextContent('120');

      fireEvent.press(screen.getByTestId('mode-DYNAMIC_WALLS'));

      expect(useSettingsStore.getState().modeId).toBe('DYNAMIC_WALLS');
      expect(screen.getByTestId('best-score')).toHaveTextContent('45');
      expect(
        screen.getByTestId('mode-DYNAMIC_WALLS').props.accessibilityState
          .selected,
      ).toBe(true);
    });

    it('mode cards carry a one-line rules blurb', () => {
      renderHome();
      expect(
        screen.getByText('Eat, grow, don’t bite yourself'),
      ).toBeOnTheScreen();
      expect(
        screen.getByText('Walls build themselves mid-run'),
      ).toBeOnTheScreen();
      expect(
        screen.getByText('A vast world beyond the screen — follow the arrow'),
      ).toBeOnTheScreen();
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

  it('the trophy navigates to /leaderboard (Prompt 46)', () => {
    renderHome();
    fireEvent.press(screen.getByTestId('leaderboard-button'));
    expect(mockPush).toHaveBeenCalledWith('/leaderboard');
  });

  it('renders the COIL wordmark', () => {
    renderHome();
    expect(screen.getByText('COIL')).toBeOnTheScreen();
  });

  it('renders the key-art hero and the world backdrop layers', () => {
    renderHome();
    expect(screen.getByTestId('home-hero')).toBeOnTheScreen();
    expect(screen.getByTestId('shell-world-backdrop')).toBeOnTheScreen();
    expect(screen.getByTestId('shell-world-scrim')).toBeOnTheScreen();
  });
});
