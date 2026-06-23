import { Text } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { AppProviders } from '../src/screens/AppProviders';
import { HomeScreen } from '../src/screens/HomeScreen';
import { useSettingsStore } from '../src/state/useSettingsStore';
import { useScoresStore } from '../src/state/useScoresStore';
import type { StoragePort } from '../src/services/StoragePort';

const mockPush = jest.fn();
const mockRouter = { push: mockPush, replace: jest.fn(), back: jest.fn() };

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({}),
  Stack: Object.assign(() => null, { Screen: () => null }),
  Link: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));

function makeMockStorage(): jest.Mocked<StoragePort> {
  return {
    getSettings: jest.fn(() =>
      Promise.resolve({
        presetId: 'STANDARD' as const,
        wallBehavior: 'SOLID' as const,
        soundEnabled: true,
        hapticsEnabled: true,
      }),
    ),
    setSettings: jest.fn((_s) => Promise.resolve()),
    getScores: jest.fn(() => Promise.resolve({ bestSolid: 0, bestPortal: 0 })),
    setScores: jest.fn((_s) => Promise.resolve()),
    resetScores: jest.fn(() => Promise.resolve()),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('navigation scaffold', () => {
  it('renders the Home stub without crashing inside the providers', () => {
    render(
      <AppProviders storage={makeMockStorage()}>
        <HomeScreen />
      </AppProviders>,
    );
    expect(screen.getByText('Coil')).toBeOnTheScreen();
  });

  it('navigates toward the game route when Play is pressed', () => {
    render(
      <AppProviders storage={makeMockStorage()}>
        <HomeScreen />
      </AppProviders>,
    );
    fireEvent.press(screen.getByTestId('play-button'));
    expect(mockPush).toHaveBeenCalledTimes(1);
    const arg = mockPush.mock.calls[0][0];
    expect(arg.pathname).toBe('/game');
    expect(arg.params).toEqual({ presetId: 'STANDARD', wall: 'SOLID' });
  });

  it('navigates to settings when the gear is pressed', () => {
    render(
      <AppProviders storage={makeMockStorage()}>
        <HomeScreen />
      </AppProviders>,
    );
    fireEvent.press(screen.getByTestId('settings-button'));
    expect(mockPush).toHaveBeenCalledWith('/settings');
  });

  it('triggers store hydration with a StoragePort on mount (NFR-3)', () => {
    const storage = makeMockStorage();
    const settingsHydrate = jest
      .spyOn(useSettingsStore.getState(), 'hydrate')
      .mockResolvedValue();
    const scoresHydrate = jest
      .spyOn(useScoresStore.getState(), 'hydrate')
      .mockResolvedValue();

    render(
      <AppProviders storage={storage}>
        <Text>child</Text>
      </AppProviders>,
    );

    expect(settingsHydrate).toHaveBeenCalledWith(storage);
    expect(scoresHydrate).toHaveBeenCalledWith(storage);

    settingsHydrate.mockRestore();
    scoresHydrate.mockRestore();
  });
});
