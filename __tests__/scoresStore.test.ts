import { useScoresStore } from '../src/state/useScoresStore';
import { DEFAULT_SCORES } from '../src/services/StoragePort';
import type { StoragePort } from '../src/services/StoragePort';
import type { PersistedScores } from '../src/engine/types';

function makeMockStorage(
  persisted: PersistedScores = DEFAULT_SCORES,
): jest.Mocked<StoragePort> {
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
    getScores: jest.fn((): Promise<PersistedScores> => Promise.resolve(persisted)),
    setScores: jest.fn((_s: PersistedScores): Promise<void> => Promise.resolve()),
    resetScores: jest.fn((): Promise<void> => Promise.resolve()),
  };
}

beforeEach(() => {
  useScoresStore.setState({ ...DEFAULT_SCORES, hydrated: false });
});

describe('useScoresStore (FR-SC3/4, §8.4)', () => {
  it('records a higher SOLID score as a new best and persists', () => {
    const storage = makeMockStorage();
    void useScoresStore.getState().hydrate(storage);

    const result = useScoresStore.getState().recordRun('SOLID', 120);

    expect(result).toEqual({ isNewBest: true });
    const state = useScoresStore.getState();
    expect(state.bestSolid).toBe(120);
    expect(state.bestPortal).toBe(0); // untouched
    expect(storage.setScores).toHaveBeenCalledWith({
      bestSolid: 120,
      bestPortal: 0,
    });
  });

  it('does not update or persist when the score is below the current best', async () => {
    const storage = makeMockStorage({ bestSolid: 200, bestPortal: 0 });
    await useScoresStore.getState().hydrate(storage);
    storage.setScores.mockClear();

    const result = useScoresStore.getState().recordRun('SOLID', 150);

    expect(result).toEqual({ isNewBest: false });
    expect(useScoresStore.getState().bestSolid).toBe(200);
    expect(storage.setScores).not.toHaveBeenCalled();
  });

  it('does not treat an equal score as a new best', () => {
    const storage = makeMockStorage();
    useScoresStore.setState({ bestSolid: 100, bestPortal: 0, hydrated: true });

    const result = useScoresStore.getState().recordRun('SOLID', 100);

    expect(result).toEqual({ isNewBest: false });
    expect(useScoresStore.getState().bestSolid).toBe(100);
  });

  it('tracks SOLID and PORTAL bests independently', async () => {
    const storage = makeMockStorage();
    await useScoresStore.getState().hydrate(storage);

    useScoresStore.getState().recordRun('SOLID', 50);
    useScoresStore.getState().recordRun('PORTAL', 80);

    const state = useScoresStore.getState();
    expect(state.bestSolid).toBe(50);
    expect(state.bestPortal).toBe(80);

    // A PORTAL run does not affect the SOLID best and vice versa.
    expect(useScoresStore.getState().recordRun('SOLID', 60)).toEqual({
      isNewBest: true,
    });
    expect(useScoresStore.getState().recordRun('PORTAL', 70)).toEqual({
      isNewBest: false,
    });
    expect(useScoresStore.getState().bestSolid).toBe(60);
    expect(useScoresStore.getState().bestPortal).toBe(80);
  });

  it('keeps the in-memory best even if setScores rejects (EH-3)', async () => {
    const storage = makeMockStorage();
    await useScoresStore.getState().hydrate(storage);
    storage.setScores.mockRejectedValueOnce(new Error('write failed'));

    let result: { isNewBest: boolean } | undefined;
    expect(() => {
      result = useScoresStore.getState().recordRun('PORTAL', 99);
    }).not.toThrow();

    expect(result).toEqual({ isNewBest: true });
    expect(useScoresStore.getState().bestPortal).toBe(99);
    await Promise.resolve();
    await Promise.resolve();
    expect(useScoresStore.getState().bestPortal).toBe(99);
  });

  it('reset zeroes both bests and calls storage.resetScores', async () => {
    const storage = makeMockStorage({ bestSolid: 300, bestPortal: 200 });
    await useScoresStore.getState().hydrate(storage);

    await useScoresStore.getState().reset(storage);

    const state = useScoresStore.getState();
    expect(state.bestSolid).toBe(0);
    expect(state.bestPortal).toBe(0);
    expect(storage.resetScores).toHaveBeenCalledTimes(1);
  });

  it('hydrate loads persisted values and sets hydrated true', async () => {
    const storage = makeMockStorage({ bestSolid: 42, bestPortal: 17 });

    expect(useScoresStore.getState().hydrated).toBe(false);
    await useScoresStore.getState().hydrate(storage);

    const state = useScoresStore.getState();
    expect(state.bestSolid).toBe(42);
    expect(state.bestPortal).toBe(17);
    expect(state.hydrated).toBe(true);
  });
});
