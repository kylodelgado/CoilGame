/**
 * Advertising contract for Coil. Mirrors AuthPort's port + adapter + fake
 * pattern: the AdMob adapter (admobAds.ts) implements this against
 * react-native-google-mobile-ads when the package and config are present; the
 * mock below keeps the FULL game flow playable today — every ad "succeeds" so
 * downstream logic (interstitial gate, revive) is exercised end to end without
 * a network, an SDK, or API keys. (Monetization)
 */

export type AdKind = 'interstitial' | 'rewarded';

/** 'shown' = an ad was actually displayed; 'skipped' = no fill / not ready. */
export type InterstitialResult = 'shown' | 'skipped';

/**
 * 'earned' = user watched through and earned the reward; 'dismissed' = user
 * closed early (no reward); 'unavailable' = nothing loaded to show.
 */
export type RewardedResult = 'earned' | 'dismissed' | 'unavailable';

export interface AdsPort {
  /** Idempotent SDK startup. Resolves even on failure — ads then stay unready. */
  initialize(): Promise<void>;
  isReady(kind: AdKind): boolean;
  showInterstitial(): Promise<InterstitialResult>;
  showRewarded(): Promise<RewardedResult>;
}

/** Show an interstitial only after every Nth game over. (Revenue rule) */
export const INTERSTITIAL_EVERY_N_GAME_OVERS = 3;

/** Minimum quiet period between two interstitials, in milliseconds. */
export const INTERSTITIAL_MIN_INTERVAL_MS = 90_000;

/**
 * PURE frequency-cap rule for the game-over interstitial: show only when the
 * loss count has reached a positive multiple of INTERSTITIAL_EVERY_N_GAME_OVERS
 * (3rd, 6th, 9th, ... loss) AND at least INTERSTITIAL_MIN_INTERVAL_MS has
 * passed since the last show (lastShownAt === null means never shown).
 * Total — malformed counts (non-integers, <= 0) simply return false. Callers
 * layer the premium gate on top; this function is only the cadence.
 */
export function shouldShowInterstitial(
  gameOverCount: number,
  lastShownAt: number | null,
  now: number,
): boolean {
  if (!Number.isInteger(gameOverCount) || gameOverCount <= 0) {
    return false;
  }
  if (gameOverCount % INTERSTITIAL_EVERY_N_GAME_OVERS !== 0) {
    return false;
  }
  if (lastShownAt === null) {
    return true;
  }
  return now - lastShownAt >= INTERSTITIAL_MIN_INTERVAL_MS;
}

/** How long the mock "plays" an ad before resolving, in milliseconds. */
export const MOCK_AD_DELAY_MS = 600;

export interface MockAdsOptions {
  /** Fake ad-play duration; defaults to MOCK_AD_DELAY_MS. */
  delayMs?: number;
  /**
   * Injectable clock: how the mock waits. Defaults to setTimeout. Tests inject
   * an immediate resolver (or capture the ms) to avoid real/fake timers.
   */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Deterministic, network-free AdsPort mock. Per owner instruction the mock
 * flows SUCCEED: the interstitial always reports 'shown' and the rewarded ad
 * always reports 'earned' (each after a short fake delay), so the entire game
 * — including revive — is playable with zero ad config. show* calls lazily
 * self-initialize so a missed startup call can never dead-end the mock flow;
 * isReady still honestly reports pre-initialize state.
 */
export function createMockAds(options: MockAdsOptions = {}): AdsPort {
  const delayMs = options.delayMs ?? MOCK_AD_DELAY_MS;
  const sleep = options.sleep ?? defaultSleep;
  let initialized = false;

  return {
    initialize(): Promise<void> {
      initialized = true;
      return Promise.resolve();
    },

    isReady(): boolean {
      // Both kinds are always "loaded" once the mock is initialized.
      return initialized;
    },

    async showInterstitial(): Promise<InterstitialResult> {
      initialized = true;
      await sleep(delayMs);
      return 'shown';
    },

    async showRewarded(): Promise<RewardedResult> {
      initialized = true;
      await sleep(delayMs);
      return 'earned';
    },
  };
}
