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
        skinId: 'greenOnBlack' as const,
        controlScheme: 'SWIPE' as const,
        modeId: 'CLASSIC' as const,
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

describe('useScoresStore (mode×wall keyed, Prompt 40)', () => {
  it('records a higher score as a new best keyed by mode:wall and persists', () => {
    const storage = makeMockStorage();
    void useScoresStore.getState().hydrate(storage);

    const result = useScoresStore.getState().recordRun('CLASSIC', 'SOLID', 120);

    expect(result).toEqual({ isNewBest: true });
    expect(useScoresStore.getState().getBest('CLASSIC', 'SOLID')).toBe(120);
    expect(storage.setScores).toHaveBeenCalledWith({
      bests: { 'CLASSIC:SOLID': 120 },
    });
  });

  it('does not update or persist when the score is below the current best', async () => {
    const storage = makeMockStorage({ bests: { 'CLASSIC:SOLID': 200 } });
    await useScoresStore.getState().hydrate(storage);
    storage.setScores.mockClear();

    const result = useScoresStore.getState().recordRun('CLASSIC', 'SOLID', 150);

    expect(result).toEqual({ isNewBest: false });
    expect(useScoresStore.getState().getBest('CLASSIC', 'SOLID')).toBe(200);
    expect(storage.setScores).not.toHaveBeenCalled();
  });

  it('does not treat an equal score as a new best', () => {
    useScoresStore.setState({
      bests: { 'CLASSIC:SOLID': 100 },
      hydrated: true,
    });

    const result = useScoresStore.getState().recordRun('CLASSIC', 'SOLID', 100);

    expect(result).toEqual({ isNewBest: false });
    expect(useScoresStore.getState().getBest('CLASSIC', 'SOLID')).toBe(100);
  });

  it('keys each mode×wall board independently', async () => {
    const storage = makeMockStorage();
    await useScoresStore.getState().hydrate(storage);

    useScoresStore.getState().recordRun('CLASSIC', 'SOLID', 50);
    useScoresStore.getState().recordRun('DYNAMIC_WALLS', 'SOLID', 80);

    // CLASSIC:SOLID and DYNAMIC_WALLS:SOLID are independent.
    expect(useScoresStore.getState().getBest('CLASSIC', 'SOLID')).toBe(50);
    expect(useScoresStore.getState().getBest('DYNAMIC_WALLS', 'SOLID')).toBe(80);
    expect(useScoresStore.getState().getBest('CLASSIC', 'PORTAL')).toBe(0);

    // A DYNAMIC_WALLS run does not affect the CLASSIC best.
    expect(
      useScoresStore.getState().recordRun('DYNAMIC_WALLS', 'SOLID', 70),
    ).toEqual({ isNewBest: false });
    expect(useScoresStore.getState().getBest('CLASSIC', 'SOLID')).toBe(50);
  });

  it('getBest returns 0 for an unseen board', () => {
    useScoresStore.setState({ bests: {}, hydrated: true });
    expect(useScoresStore.getState().getBest('DYNAMIC_WALLS', 'PORTAL')).toBe(0);
  });

  it('keeps the in-memory best even if setScores rejects (EH-3)', async () => {
    const storage = makeMockStorage();
    await useScoresStore.getState().hydrate(storage);
    storage.setScores.mockRejectedValueOnce(new Error('write failed'));

    let result: { isNewBest: boolean } | undefined;
    expect(() => {
      result = useScoresStore.getState().recordRun('CLASSIC', 'PORTAL', 99);
    }).not.toThrow();

    expect(result).toEqual({ isNewBest: true });
    expect(useScoresStore.getState().getBest('CLASSIC', 'PORTAL')).toBe(99);
    await Promise.resolve();
    await Promise.resolve();
    expect(useScoresStore.getState().getBest('CLASSIC', 'PORTAL')).toBe(99);
  });

  it('reset clears all bests and calls storage.resetScores', async () => {
    const storage = makeMockStorage({
      bests: { 'CLASSIC:SOLID': 300, 'DYNAMIC_WALLS:PORTAL': 200 },
    });
    await useScoresStore.getState().hydrate(storage);

    await useScoresStore.getState().reset(storage);

    expect(useScoresStore.getState().bests).toEqual({});
    expect(storage.resetScores).toHaveBeenCalledTimes(1);
  });

  it('hydrate loads the persisted bests and sets hydrated true', async () => {
    const storage = makeMockStorage({
      bests: { 'CLASSIC:SOLID': 42, 'CLASSIC:PORTAL': 17 },
    });

    expect(useScoresStore.getState().hydrated).toBe(false);
    await useScoresStore.getState().hydrate(storage);

    expect(useScoresStore.getState().getBest('CLASSIC', 'SOLID')).toBe(42);
    expect(useScoresStore.getState().getBest('CLASSIC', 'PORTAL')).toBe(17);
    expect(useScoresStore.getState().hydrated).toBe(true);
  });
});
