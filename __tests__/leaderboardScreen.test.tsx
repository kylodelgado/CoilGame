import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { LeaderboardScreen } from '../src/screens/LeaderboardScreen';
import { SkinProvider } from '../src/skins/SkinProvider';
import { useAuthStore } from '../src/state/useAuthStore';
import { useSettingsStore } from '../src/state/useSettingsStore';
import { DEFAULT_SETTINGS } from '../src/services/StoragePort';
import { createInMemoryAuth } from '../src/services/AuthPort';
import type {
  Board,
  LeaderboardEntry,
  LeaderboardPort,
} from '../src/services/LeaderboardPort';
import type { AuthPort } from '../src/services/AuthPort';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}));

const entry = (
  uid: string,
  displayName: string,
  score: number,
  rank: number,
): LeaderboardEntry => ({ uid, displayName, score, rank });

interface FakeLeaderboard extends LeaderboardPort {
  getTopScores: jest.Mock;
  getUserBest: jest.Mock;
}

function makeLeaderboard(
  top: LeaderboardEntry[] = [],
  userBest: LeaderboardEntry | null = null,
): FakeLeaderboard {
  return {
    submitScore: jest.fn(() => Promise.resolve()),
    getTopScores: jest.fn(() => Promise.resolve(top)),
    getUserBest: jest.fn(() => Promise.resolve(userBest)),
  };
}

const renderBoard = (leaderboard: LeaderboardPort, auth?: AuthPort) =>
  render(
    <SkinProvider>
      <LeaderboardScreen
        leaderboard={leaderboard}
        auth={auth ?? createInMemoryAuth()}
      />
    </SkinProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({ user: null, loading: false, error: null });
  useSettingsStore.setState({ ...DEFAULT_SETTINGS, hydrated: true });
});

describe('LeaderboardScreen', () => {
  it('renders a ranked list from getTopScores', async () => {
    const lb = makeLeaderboard([
      entry('u2', 'Bo', 300, 1),
      entry('u3', 'Cy', 200, 2),
    ]);
    renderBoard(lb);

    expect(await screen.findByTestId('lb-list')).toBeOnTheScreen();
    expect(screen.getByTestId('lb-entry-u2')).toHaveTextContent(/Bo/);
    expect(screen.getByTestId('lb-entry-u2')).toHaveTextContent(/300/);
    expect(screen.getByTestId('lb-entry-u3')).toHaveTextContent(/200/);
  });

  it('shows a loading state before resolution and an empty state on []', async () => {
    let resolveTop: (v: LeaderboardEntry[]) => void = () => undefined;
    const lb = makeLeaderboard();
    lb.getTopScores.mockReturnValueOnce(
      new Promise<LeaderboardEntry[]>((r) => {
        resolveTop = r;
      }),
    );
    renderBoard(lb);

    // Pending: loading is shown.
    expect(screen.getByTestId('lb-loading')).toBeOnTheScreen();

    await act(async () => {
      resolveTop([]);
    });

    // Resolved empty: distinct empty copy, no list.
    expect(await screen.findByTestId('lb-empty')).toBeOnTheScreen();
    expect(screen.queryByTestId('lb-list')).toBeNull();
  });

  it('highlights the current user’s entry when they are in the top N', async () => {
    const auth = createInMemoryAuth();
    const me = await auth.signUp('a@b.com', 'pw', 'Ada');
    const lb = makeLeaderboard(
      [entry('u2', 'Bo', 300, 1), entry(me.uid, 'Ada', 250, 2)],
      entry(me.uid, 'Ada', 250, 2),
    );
    renderBoard(lb, auth);

    const selfRow = await screen.findByTestId(`lb-entry-${me.uid}`);
    expect(selfRow.props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    );
    expect(screen.queryByTestId('lb-pinned')).toBeNull(); // already in top N
  });

  it('pins the user’s best below when it is outside the top N', async () => {
    const auth = createInMemoryAuth();
    const me = await auth.signUp('a@b.com', 'pw', 'Ada');
    const lb = makeLeaderboard(
      [entry('u2', 'Bo', 300, 1), entry('u3', 'Cy', 200, 2)],
      entry(me.uid, 'Ada', 40, 9), // not among the top entries
    );
    renderBoard(lb, auth);

    const pinned = await screen.findByTestId('lb-pinned');
    expect(pinned).toHaveTextContent(/Ada/);
    expect(pinned).toHaveTextContent(/40/);
  });

  it('re-queries with the new mode/wall when the board changes', async () => {
    const lb = makeLeaderboard([entry('u2', 'Bo', 300, 1)]);
    renderBoard(lb);
    await screen.findByTestId('lb-list');

    fireEvent.press(screen.getByTestId('lb-mode-DYNAMIC_WALLS'));

    await waitFor(() => {
      expect(lb.getTopScores).toHaveBeenCalledWith(
        expect.objectContaining<Board>({
          modeId: 'DYNAMIC_WALLS',
          wall: 'SOLID',
        }),
        expect.any(Number),
      );
    });

    fireEvent.press(screen.getByTestId('lb-wall-PORTAL'));
    await waitFor(() => {
      expect(lb.getTopScores).toHaveBeenCalledWith(
        expect.objectContaining<Board>({
          modeId: 'DYNAMIC_WALLS',
          wall: 'PORTAL',
        }),
        expect.any(Number),
      );
    });
  });

  it('signed-out shows the public board plus a sign-in prompt', async () => {
    const lb = makeLeaderboard([entry('u2', 'Bo', 300, 1)]);
    renderBoard(lb); // anonymous in-memory auth: no current user

    expect(await screen.findByTestId('lb-list')).toBeOnTheScreen();
    const prompt = screen.getByTestId('lb-signin-prompt');
    fireEvent.press(prompt);
    expect(mockPush).toHaveBeenCalledWith('/account');
    expect(lb.getUserBest).not.toHaveBeenCalled(); // no uid to query
  });

  it('refresh re-queries the current board', async () => {
    const lb = makeLeaderboard([entry('u2', 'Bo', 300, 1)]);
    renderBoard(lb);
    await screen.findByTestId('lb-list');
    const initialCalls = lb.getTopScores.mock.calls.length;

    fireEvent.press(screen.getByTestId('lb-refresh'));
    await waitFor(() => {
      expect(lb.getTopScores.mock.calls.length).toBeGreaterThan(initialCalls);
    });
  });
});
