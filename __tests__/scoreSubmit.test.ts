import { createScoreSubmitter } from '../src/services/submitScoreOnTerminal';
import { createInMemoryAuth } from '../src/services/AuthPort';
import { createInMemoryLeaderboard } from '../src/services/LeaderboardPort';
import type { Board, LeaderboardPort } from '../src/services/LeaderboardPort';

const SOLID: Board = { modeId: 'CLASSIC', wall: 'SOLID' };
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('createScoreSubmitter (offline-safe, fire-and-forget)', () => {
  it('does nothing and does not throw when there is no current user', () => {
    const auth = createInMemoryAuth();
    const leaderboard = createInMemoryLeaderboard();
    const spy = jest.spyOn(leaderboard, 'submitScore');
    const submitter = createScoreSubmitter({ auth, leaderboard });

    expect(() => submitter.submit(SOLID, 100)).not.toThrow();
    expect(spy).not.toHaveBeenCalled();
  });

  it('submits with the right board, user, and score when signed in', async () => {
    const auth = createInMemoryAuth();
    const leaderboard = createInMemoryLeaderboard();
    const spy = jest.spyOn(leaderboard, 'submitScore');
    const user = await auth.signUp('a@b.com', 'pw', 'Ada');
    const submitter = createScoreSubmitter({ auth, leaderboard });

    submitter.submit(SOLID, 120);
    expect(spy).toHaveBeenCalledWith(SOLID, user, 120);
  });

  it('swallows a rejecting submitScore (never throws out of submit)', async () => {
    const auth = createInMemoryAuth();
    await auth.signInAnonymously();
    const leaderboard = {
      submitScore: jest.fn(() => Promise.reject(new Error('offline'))),
      getTopScores: jest.fn(),
      getUserBest: jest.fn(),
    } as unknown as LeaderboardPort;
    const submitter = createScoreSubmitter({ auth, leaderboard });

    expect(() => submitter.submit(SOLID, 50)).not.toThrow();
    await flush(); // a swallowed rejection must not surface as unhandled
  });

  it('is fire-and-forget: returns before submission settles', async () => {
    const auth = createInMemoryAuth();
    await auth.signInAnonymously();
    let resolveIt: () => void = () => undefined;
    const pending = new Promise<void>((r) => {
      resolveIt = () => r();
    });
    const leaderboard = {
      submitScore: jest.fn(() => pending),
      getTopScores: jest.fn(),
      getUserBest: jest.fn(),
    } as unknown as LeaderboardPort;
    const submitter = createScoreSubmitter({ auth, leaderboard });

    submitter.submit(SOLID, 50); // must return synchronously, not await
    expect(leaderboard.submitScore).toHaveBeenCalledTimes(1);
    resolveIt();
    await flush();
  });

  it('best-effort retries a queued failed submit on the next submit', async () => {
    const auth = createInMemoryAuth();
    await auth.signInAnonymously();
    const submitScore = jest
      .fn()
      .mockRejectedValueOnce(new Error('offline')) // first fails -> queued
      .mockResolvedValue(undefined);
    const leaderboard = {
      submitScore,
      getTopScores: jest.fn(),
      getUserBest: jest.fn(),
    } as unknown as LeaderboardPort;
    const submitter = createScoreSubmitter({ auth, leaderboard });

    submitter.submit(SOLID, 50);
    await flush(); // let the failed submit requeue
    expect(submitScore).toHaveBeenCalledTimes(1);

    submitter.submit(SOLID, 60); // flushes the queued 50, then submits 60
    await flush();
    expect(submitScore).toHaveBeenCalledTimes(3);
  });
});
