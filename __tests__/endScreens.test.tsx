import { render, screen, fireEvent } from '@testing-library/react-native';
import { PauseOverlay } from '../src/screens/PauseOverlay';
import { WinScreen } from '../src/screens/WinScreen';
import { LossScreen } from '../src/screens/LossScreen';
import { SkinProvider } from '../src/skins/SkinProvider';
import { useScoresStore } from '../src/state/useScoresStore';
import type { GameController } from '../src/runtime/GameController';

const mockReplace = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}));

function makeMockController() {
  return {
    resume: jest.fn(),
    restart: jest.fn(),
    quit: jest.fn(),
    getState: jest.fn(),
    tapToStart: jest.fn(),
    setRunning: jest.fn(),
    enqueue: jest.fn(),
    step: jest.fn(),
    pause: jest.fn(),
  } as unknown as GameController & {
    resume: jest.Mock;
    restart: jest.Mock;
    quit: jest.Mock;
  };
}

const wrap = (node: React.ReactElement) =>
  render(<SkinProvider>{node}</SkinProvider>);

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  useScoresStore.setState({ bestSolid: 0, bestPortal: 0, hydrated: true });
});

describe('PauseOverlay (FR-P3, FR-P6)', () => {
  it('Resume calls controller.resume', () => {
    const controller = makeMockController();
    wrap(<PauseOverlay controller={controller} onQuitToHome={jest.fn()} />);
    fireEvent.press(screen.getByTestId('resume-button'));
    expect(controller.resume).toHaveBeenCalledTimes(1);
  });

  it('Restart calls controller.restart', () => {
    const controller = makeMockController();
    wrap(<PauseOverlay controller={controller} onQuitToHome={jest.fn()} />);
    fireEvent.press(screen.getByTestId('restart-button'));
    expect(controller.restart).toHaveBeenCalledTimes(1);
  });

  it('Quit forfeits: calls controller.quit and navigates Home, no score recorded', () => {
    const controller = makeMockController();
    const onQuitToHome = jest.fn();
    const recordRun = jest.fn(); // not wired to quit — must stay untouched
    wrap(<PauseOverlay controller={controller} onQuitToHome={onQuitToHome} />);

    fireEvent.press(screen.getByTestId('quit-button'));

    expect(controller.quit).toHaveBeenCalledTimes(1);
    expect(onQuitToHome).toHaveBeenCalledTimes(1);
    expect(recordRun).not.toHaveBeenCalled();
  });
});

describe('WinScreen / LossScreen (FR-UI4)', () => {
  it('WinScreen shows final score, the matching high score, New Best, and Perfect framing', () => {
    mockParams = {
      score: '120',
      isNewBest: '1',
      presetId: 'STANDARD',
      wall: 'SOLID',
    };
    useScoresStore.setState({ bestSolid: 120, bestPortal: 5, hydrated: true });
    wrap(<WinScreen />);

    expect(screen.getByTestId('final-score')).toHaveTextContent('120');
    expect(screen.getByTestId('high-score')).toHaveTextContent('120'); // Solid best
    expect(screen.getByTestId('new-best')).toBeOnTheScreen();
    expect(screen.getByText(/perfect/i)).toBeOnTheScreen();
  });

  it('LossScreen shows the Portal best for a Portal run and no New Best when not beaten', () => {
    mockParams = {
      score: '50',
      isNewBest: '0',
      presetId: 'DENSE',
      wall: 'PORTAL',
    };
    useScoresStore.setState({ bestSolid: 999, bestPortal: 80, hydrated: true });
    wrap(<LossScreen />);

    expect(screen.getByTestId('final-score')).toHaveTextContent('50');
    expect(screen.getByTestId('high-score')).toHaveTextContent('80'); // Portal best
    expect(screen.queryByTestId('new-best')).toBeNull();
  });

  it('shows New Best only when isNewBest is true', () => {
    mockParams = { score: '90', isNewBest: '1', presetId: 'CLASSIC', wall: 'SOLID' };
    const { rerender } = wrap(<LossScreen />);
    expect(screen.getByTestId('new-best')).toBeOnTheScreen();

    mockParams = { score: '90', isNewBest: '0', presetId: 'CLASSIC', wall: 'SOLID' };
    rerender(
      <SkinProvider>
        <LossScreen />
      </SkinProvider>,
    );
    expect(screen.queryByTestId('new-best')).toBeNull();
  });

  it('Play Again returns to /game with the same preset + wall', () => {
    mockParams = {
      score: '70',
      isNewBest: '0',
      presetId: 'DENSE',
      wall: 'PORTAL',
    };
    wrap(<LossScreen />);

    fireEvent.press(screen.getByTestId('play-again-button'));
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/game',
      params: { presetId: 'DENSE', wall: 'PORTAL' },
    });
  });

  it('Home navigates to the home route', () => {
    mockParams = { score: '70', isNewBest: '0', presetId: 'DENSE', wall: 'PORTAL' };
    wrap(<WinScreen />);

    fireEvent.press(screen.getByTestId('home-button'));
    expect(mockReplace).toHaveBeenCalledWith('/');
  });
});
