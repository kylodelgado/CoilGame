import { act, renderHook } from '@testing-library/react-native';
import {
  INTERSTITIAL_EVERY_N_GAME_OVERS,
  INTERSTITIAL_MIN_INTERVAL_MS,
  MOCK_AD_DELAY_MS,
  createMockAds,
  shouldShowInterstitial,
  type AdsPort,
} from '../src/services/AdsPort';
import {
  ADMOB_TEST_IDS,
  createAdmobAds,
  getAdmobBanner,
  readAdmobConfig,
} from '../src/services/admobAds';
import {
  resetInterstitialGateForTests,
  useInterstitialGate,
} from '../src/monetization/useInterstitialGate';
import { useRevive } from '../src/monetization/useRevive';
import { useEntitlementsStore } from '../src/state/useEntitlementsStore';

// Controllable expo-constants: tests flip `mockExtra` to simulate the presence
// or absence of the app.json `extra` blocks that gate the real adapters.
let mockExtra: Record<string, unknown> | undefined;
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    get expoConfig() {
      return { extra: mockExtra };
    },
  },
}));

/** An AdsPort test double with scriptable results and call recording. */
function makeFakeAds(overrides: Partial<AdsPort> = {}): AdsPort & {
  showInterstitial: jest.Mock;
  showRewarded: jest.Mock;
} {
  return {
    initialize: jest.fn().mockResolvedValue(undefined),
    isReady: jest.fn().mockReturnValue(true),
    showInterstitial: jest.fn().mockResolvedValue('shown'),
    showRewarded: jest.fn().mockResolvedValue('earned'),
    ...overrides,
  } as AdsPort & { showInterstitial: jest.Mock; showRewarded: jest.Mock };
}

beforeEach(() => {
  mockExtra = undefined;
  resetInterstitialGateForTests();
  useEntitlementsStore.setState({
    premium: false,
    purchasedIds: [],
    hydrated: true,
  });
});

describe('shouldShowInterstitial (pure cadence rule)', () => {
  it('never shown yet: true exactly on every 3rd game over', () => {
    const expected = [false, false, true, false, false, true, false, false, true];
    for (let count = 1; count <= 9; count++) {
      expect(shouldShowInterstitial(count, null, 1_000_000)).toBe(
        expected[count - 1],
      );
    }
  });

  it('respects the 90s cooldown on an otherwise-eligible count', () => {
    const shownAt = 100_000;
    // One ms short of the cooldown: blocked.
    expect(
      shouldShowInterstitial(
        3,
        shownAt,
        shownAt + INTERSTITIAL_MIN_INTERVAL_MS - 1,
      ),
    ).toBe(false);
    // Exactly at the cooldown boundary: allowed.
    expect(
      shouldShowInterstitial(3, shownAt, shownAt + INTERSTITIAL_MIN_INTERVAL_MS),
    ).toBe(true);
    // Well past: allowed.
    expect(shouldShowInterstitial(6, shownAt, shownAt + 10 * 60_000)).toBe(true);
  });

  it('cooldown never rescues a non-multiple count', () => {
    expect(shouldShowInterstitial(4, null, 0)).toBe(false);
    expect(shouldShowInterstitial(5, 0, 10 * 60_000)).toBe(false);
  });

  it('is total: malformed counts return false instead of throwing', () => {
    expect(shouldShowInterstitial(0, null, 0)).toBe(false);
    expect(shouldShowInterstitial(-3, null, 0)).toBe(false);
    expect(shouldShowInterstitial(2.5, null, 0)).toBe(false);
    expect(shouldShowInterstitial(Number.NaN, null, 0)).toBe(false);
    expect(shouldShowInterstitial(Number.POSITIVE_INFINITY, null, 0)).toBe(false);
  });

  it('exposes the tunables the docs point at', () => {
    expect(INTERSTITIAL_EVERY_N_GAME_OVERS).toBe(3);
    expect(INTERSTITIAL_MIN_INTERVAL_MS).toBe(90_000);
  });
});

describe('createMockAds', () => {
  it('interstitial resolves "shown" and rewarded resolves "earned" (injected clock)', async () => {
    const waits: number[] = [];
    const ads = createMockAds({
      sleep: (ms) => {
        waits.push(ms);
        return Promise.resolve();
      },
    });
    await ads.initialize();
    await expect(ads.showInterstitial()).resolves.toBe('shown');
    await expect(ads.showRewarded()).resolves.toBe('earned');
    expect(waits).toEqual([MOCK_AD_DELAY_MS, MOCK_AD_DELAY_MS]);
  });

  it('honors a custom delayMs through the injected clock', async () => {
    const waits: number[] = [];
    const ads = createMockAds({
      delayMs: 50,
      sleep: (ms) => {
        waits.push(ms);
        return Promise.resolve();
      },
    });
    await ads.showInterstitial();
    expect(waits).toEqual([50]);
  });

  it('isReady is false before initialize and true after (both kinds)', async () => {
    const ads = createMockAds({ sleep: () => Promise.resolve() });
    expect(ads.isReady('interstitial')).toBe(false);
    expect(ads.isReady('rewarded')).toBe(false);
    await ads.initialize();
    expect(ads.isReady('interstitial')).toBe(true);
    expect(ads.isReady('rewarded')).toBe(true);
  });

  it('show* self-initializes so a missed startup call cannot dead-end the flow', async () => {
    const ads = createMockAds({ sleep: () => Promise.resolve() });
    await expect(ads.showRewarded()).resolves.toBe('earned');
    expect(ads.isReady('rewarded')).toBe(true);
  });

  it('uses a real 600ms timer by default', async () => {
    jest.useFakeTimers();
    try {
      const ads = createMockAds();
      let result: string | undefined;
      const pending = ads.showInterstitial().then((r) => {
        result = r;
      });
      jest.advanceTimersByTime(MOCK_AD_DELAY_MS - 1);
      await Promise.resolve();
      await Promise.resolve();
      expect(result).toBeUndefined();
      jest.advanceTimersByTime(1);
      await pending;
      expect(result).toBe('shown');
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('createAdmobAds (real adapter gating)', () => {
  it('returns null when the SDK package is absent, even with full config', () => {
    mockExtra = {
      admob: {
        appIdIos: 'ca-app-pub-1~1',
        appIdAndroid: 'ca-app-pub-1~2',
        bannerId: 'ca-app-pub-1/1',
        interstitialId: 'ca-app-pub-1/2',
        rewardedId: 'ca-app-pub-1/3',
      },
    };
    expect(createAdmobAds()).toBeNull();
    expect(getAdmobBanner()).toBeNull();
  });

  it('readAdmobConfig is null without an extra.admob block', () => {
    mockExtra = undefined;
    expect(readAdmobConfig()).toBeNull();
    mockExtra = {};
    expect(readAdmobConfig()).toBeNull();
    mockExtra = { admob: 'not-an-object' };
    expect(readAdmobConfig()).toBeNull();
  });

  it('fills blank unit ids with Google official test ids when the block exists', () => {
    mockExtra = { admob: {} };
    const config = readAdmobConfig();
    expect(config).not.toBeNull();
    expect(config?.bannerId).toBe(ADMOB_TEST_IDS.banner);
    expect(config?.interstitialId).toBe(ADMOB_TEST_IDS.interstitial);
    expect(config?.rewardedId).toBe(ADMOB_TEST_IDS.rewarded);
  });

  it('keeps explicit unit ids when provided', () => {
    mockExtra = {
      admob: { bannerId: 'ca-app-pub-9/9', interstitialId: '', rewardedId: 'x' },
    };
    const config = readAdmobConfig();
    expect(config?.bannerId).toBe('ca-app-pub-9/9');
    expect(config?.interstitialId).toBe(ADMOB_TEST_IDS.interstitial);
    expect(config?.rewardedId).toBe('x');
  });
});

describe('useInterstitialGate', () => {
  const showAfterLosses = async (
    gate: { maybeShowAfterGameOver(): Promise<void> },
    losses: number,
  ): Promise<void> => {
    for (let i = 0; i < losses; i++) {
      await act(async () => {
        await gate.maybeShowAfterGameOver();
      });
    }
  };

  it('shows on the 3rd game over, not the 1st or 2nd', async () => {
    const ads = makeFakeAds();
    const { result } = renderHook(() =>
      useInterstitialGate({ ads, now: () => 0 }),
    );
    await showAfterLosses(result.current, 2);
    expect(ads.showInterstitial).not.toHaveBeenCalled();
    await showAfterLosses(result.current, 1);
    expect(ads.showInterstitial).toHaveBeenCalledTimes(1);
  });

  it('enforces the 90s cooldown across multiples, then shows when it elapses', async () => {
    let t = 0;
    const ads = makeFakeAds();
    const { result } = renderHook(() =>
      useInterstitialGate({ ads, now: () => t }),
    );

    await showAfterLosses(result.current, 3); // 3rd loss at t=0 → shown
    expect(ads.showInterstitial).toHaveBeenCalledTimes(1);

    t = 30_000; // 6th loss inside the cooldown → suppressed
    await showAfterLosses(result.current, 3);
    expect(ads.showInterstitial).toHaveBeenCalledTimes(1);

    t = 30_000 + INTERSTITIAL_MIN_INTERVAL_MS; // 9th loss, cooldown elapsed
    await showAfterLosses(result.current, 3);
    expect(ads.showInterstitial).toHaveBeenCalledTimes(2);
  });

  it('never shows anything to premium players', async () => {
    useEntitlementsStore.setState({ premium: true });
    const ads = makeFakeAds();
    const { result } = renderHook(() =>
      useInterstitialGate({ ads, now: () => 0 }),
    );
    await showAfterLosses(result.current, 9);
    expect(ads.showInterstitial).not.toHaveBeenCalled();
  });

  it('a skipped show does not stamp the cooldown — the next multiple retries', async () => {
    const ads = makeFakeAds();
    ads.showInterstitial
      .mockResolvedValueOnce('skipped')
      .mockResolvedValue('shown');
    const { result } = renderHook(() =>
      useInterstitialGate({ ads, now: () => 0 }),
    );
    await showAfterLosses(result.current, 3); // attempt, skipped, no stamp
    await showAfterLosses(result.current, 3); // 6th at the SAME instant: retries
    expect(ads.showInterstitial).toHaveBeenCalledTimes(2);
  });

  it('an ads failure never breaks the loss flow', async () => {
    const ads = makeFakeAds();
    ads.showInterstitial.mockRejectedValue(new Error('no fill'));
    const { result } = renderHook(() =>
      useInterstitialGate({ ads, now: () => 0 }),
    );
    await expect(showAfterLosses(result.current, 3)).resolves.toBeUndefined();
  });

  it('initializes the ads port on mount so an ad is preloaded', () => {
    const ads = makeFakeAds();
    renderHook(() => useInterstitialGate({ ads }));
    expect(ads.initialize).toHaveBeenCalled();
  });
});

describe('useRevive', () => {
  it('earned rewarded ad revives once, then the offer is consumed for the run', async () => {
    const ads = makeFakeAds();
    const { result } = renderHook(
      ({ runKey }: { runKey: string }) => useRevive(runKey, { ads }),
      { initialProps: { runKey: 'run-1' } },
    );
    expect(result.current.canRevive).toBe(true);

    let revived = false;
    await act(async () => {
      revived = await result.current.offerRevive();
    });
    expect(revived).toBe(true);
    expect(ads.showRewarded).toHaveBeenCalledTimes(1);
    expect(result.current.canRevive).toBe(false);

    // A second offer in the same run is refused without showing another ad.
    await act(async () => {
      revived = await result.current.offerRevive();
    });
    expect(revived).toBe(false);
    expect(ads.showRewarded).toHaveBeenCalledTimes(1);
  });

  it('a new run key re-arms the offer', async () => {
    const ads = makeFakeAds();
    const { result, rerender } = renderHook(
      ({ runKey }: { runKey: string }) => useRevive(runKey, { ads }),
      { initialProps: { runKey: 'run-1' } },
    );
    await act(async () => {
      await result.current.offerRevive();
    });
    expect(result.current.canRevive).toBe(false);

    rerender({ runKey: 'run-2' });
    expect(result.current.canRevive).toBe(true);
  });

  it('a dismissed or unavailable ad does NOT burn the run’s revive', async () => {
    const ads = makeFakeAds();
    ads.showRewarded
      .mockResolvedValueOnce('dismissed')
      .mockResolvedValueOnce('unavailable')
      .mockResolvedValue('earned');
    const { result } = renderHook(() => useRevive('run-1', { ads }));

    let revived = true;
    await act(async () => {
      revived = await result.current.offerRevive();
    });
    expect(revived).toBe(false);
    expect(result.current.canRevive).toBe(true);

    await act(async () => {
      revived = await result.current.offerRevive();
    });
    expect(revived).toBe(false);
    expect(result.current.canRevive).toBe(true);

    await act(async () => {
      revived = await result.current.offerRevive();
    });
    expect(revived).toBe(true);
    expect(result.current.canRevive).toBe(false);
  });

  it('premium revives instantly without an ad — still once per run', async () => {
    useEntitlementsStore.setState({ premium: true });
    const ads = makeFakeAds();
    const { result } = renderHook(() => useRevive('run-1', { ads }));

    let revived = false;
    await act(async () => {
      revived = await result.current.offerRevive();
    });
    expect(revived).toBe(true);
    expect(ads.showRewarded).not.toHaveBeenCalled();
    expect(result.current.canRevive).toBe(false);

    await act(async () => {
      revived = await result.current.offerRevive();
    });
    expect(revived).toBe(false);
  });

  it('an ads error resolves false instead of throwing', async () => {
    const ads = makeFakeAds();
    ads.showRewarded.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useRevive('run-1', { ads }));
    let revived = true;
    await act(async () => {
      revived = await result.current.offerRevive();
    });
    expect(revived).toBe(false);
    expect(result.current.canRevive).toBe(true);
  });
});
