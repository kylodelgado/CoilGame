import {
  createInMemoryLeaderboard,
  type Board,
} from '../src/services/LeaderboardPort';
import type { AuthUser } from '../src/services/AuthPort';

const user = (uid: string, displayName: string | null): AuthUser => ({
  uid,
  displayName,
  isAnonymous: displayName === null,
});

const SOLID: Board = { modeId: 'CLASSIC', wall: 'SOLID' };
const PORTAL: Board = { modeId: 'CLASSIC', wall: 'PORTAL' };
const DW_SOLID: Board = { modeId: 'DYNAMIC_WALLS', wall: 'SOLID' };

describe('createInMemoryLeaderboard (in-memory fake)', () => {
  it('keeps only a user’s best per board', async () => {
    const lb = createInMemoryLeaderboard();
    const ada = user('u1', 'Ada');

    await lb.submitScore(SOLID, ada, 100);
    await lb.submitScore(SOLID, ada, 50); // lower — ignored
    await lb.submitScore(SOLID, ada, 150); // higher — kept

    const best = await lb.getUserBest(SOLID, 'u1');
    expect(best?.score).toBe(150);
    const top = await lb.getTopScores(SOLID, 10);
    expect(top).toHaveLength(1);
    expect(top[0].score).toBe(150);
  });

  it('getTopScores returns descending, limited, with correct 1-based ranks', async () => {
    const lb = createInMemoryLeaderboard();
    await lb.submitScore(SOLID, user('u1', 'Ada'), 100);
    await lb.submitScore(SOLID, user('u2', 'Bo'), 300);
    await lb.submitScore(SOLID, user('u3', 'Cy'), 200);

    const top = await lb.getTopScores(SOLID, 2);
    expect(top.map((e) => [e.displayName, e.score, e.rank])).toEqual([
      ['Bo', 300, 1],
      ['Cy', 200, 2],
    ]);
  });

  it('keeps boards independent across mode and wall', async () => {
    const lb = createInMemoryLeaderboard();
    const ada = user('u1', 'Ada');
    await lb.submitScore(SOLID, ada, 100);
    await lb.submitScore(PORTAL, ada, 40);
    await lb.submitScore(DW_SOLID, ada, 70);

    expect((await lb.getUserBest(SOLID, 'u1'))?.score).toBe(100);
    expect((await lb.getUserBest(PORTAL, 'u1'))?.score).toBe(40);
    expect((await lb.getUserBest(DW_SOLID, 'u1'))?.score).toBe(70);
    // A board with no submissions is empty.
    expect(await lb.getTopScores({ modeId: 'DYNAMIC_WALLS', wall: 'PORTAL' }, 10)).toEqual([]);
  });

  it('getUserBest returns the entry with its true rank, or null when absent', async () => {
    const lb = createInMemoryLeaderboard();
    await lb.submitScore(SOLID, user('u1', 'Ada'), 100);
    await lb.submitScore(SOLID, user('u2', 'Bo'), 300);

    const ada = await lb.getUserBest(SOLID, 'u1');
    expect(ada).toEqual({ uid: 'u1', displayName: 'Ada', score: 100, rank: 2 });
    expect(await lb.getUserBest(SOLID, 'nobody')).toBeNull();
  });

  it('stores a display name for anonymous users', async () => {
    const lb = createInMemoryLeaderboard();
    await lb.submitScore(SOLID, user('anon-1', null), 10);
    const top = await lb.getTopScores(SOLID, 10);
    expect(typeof top[0].displayName).toBe('string');
    expect(top[0].displayName.length).toBeGreaterThan(0);
  });
});
