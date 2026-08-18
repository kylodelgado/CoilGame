import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { AdsPort, InterstitialResult, RewardedResult } from './AdsPort';

/**
 * AdMob adapter for AdsPort, targeting react-native-google-mobile-ads — which
 * is intentionally NOT a dependency today. The module is resolved dynamically
 * (see `loadAdmobModule`) so Metro/jest never hard-fail on the missing package;
 * until the owner installs it AND adds `extra.admob` to app.json,
 * `createAdmobAds()` returns null and the app runs on the mock (adsInstance.ts).
 *
 * Go-live is config-only — no code changes here. See docs/MONETIZATION.md.
 *
 * iOS ATT note: on iOS 14.5+ Apple requires App Tracking Transparency consent
 * before serving personalized ads. The react-native-google-mobile-ads config
 * plugin adds NSUserTrackingUsageDescription (set `userTrackingUsageDescription`
 * in the app.json plugin block) and the SDK's UMP consent flow
 * (MobileAds().initialize() + AdsConsent) should be requested before the first
 * ad load. Until consent is granted we request non-personalized ads only
 * (requestNonPersonalizedAdsOnly: true below), which is always compliant.
 */

export interface AdmobConfig {
  appIdIos: string;
  appIdAndroid: string;
  bannerId: string;
  interstitialId: string;
  rewardedId: string;
}

/**
 * Google's OFFICIAL public test ad-unit ids (safe to ship in source — they are
 * published by Google for exactly this purpose). Used whenever the owner has
 * created the `extra.admob` block but left an id blank, so a half-configured
 * build shows Google test ads instead of crashing or going silent.
 * https://developers.google.com/admob/android/test-ads
 * https://developers.google.com/admob/ios/test-ads
 */
export const ADMOB_TEST_IDS = {
  banner: Platform.select({
    ios: 'ca-app-pub-3940256099942544/2934735716',
    default: 'ca-app-pub-3940256099942544/6300978111',
  }) as string,
  interstitial: Platform.select({
    ios: 'ca-app-pub-3940256099942544/4411468910',
    default: 'ca-app-pub-3940256099942544/1033173712',
  }) as string,
  rewarded: Platform.select({
    ios: 'ca-app-pub-3940256099942544/1712485313',
    default: 'ca-app-pub-3940256099942544/5224354917',
  }) as string,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const stringOr = (value: unknown, fallback: string): string =>
  typeof value === 'string' && value.length > 0 ? value : fallback;

/**
 * Read the AdMob config from expo-constants `extra.admob`. Returns null when
 * the block is absent entirely (ads stay mocked); when the block EXISTS but
 * individual unit ids are blank, Google's official test ids fill in so the
 * owner can smoke-test real SDK plumbing before pasting production ids.
 */
export function readAdmobConfig(): AdmobConfig | null {
  const extra = Constants.expoConfig?.extra as
    | { admob?: Record<string, unknown> }
    | undefined;
  const raw = extra?.admob;
  if (!isRecord(raw)) {
    return null;
  }
  return {
    appIdIos: stringOr(raw.appIdIos, ''),
    appIdAndroid: stringOr(raw.appIdAndroid, ''),
    bannerId: stringOr(raw.bannerId, ADMOB_TEST_IDS.banner),
    interstitialId: stringOr(raw.interstitialId, ADMOB_TEST_IDS.interstitial),
    rewardedId: stringOr(raw.rewardedId, ADMOB_TEST_IDS.rewarded),
  };
}

/**
 * Resolve react-native-google-mobile-ads WITHOUT a static import. The string
 * concatenation keeps Metro's resolver from tracing the module at bundle time,
 * so the app builds and runs while the package is uninstalled; once installed,
 * the same require succeeds and the real adapter comes alive. Typed as `any`
 * internally on purpose — the package's types don't exist until it's installed.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadAdmobModule(): any | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('react-native-google' + '-mobile-ads');
  } catch {
    return null;
  }
}

let cachedModule: unknown = undefined;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getAdmobModule(): any | null {
  if (cachedModule === undefined) {
    cachedModule = loadAdmobModule();
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return cachedModule as any | null;
}

/** Load-retry backoff schedule (ms): quick retries first, then back off. */
const RETRY_BACKOFF_MS = [2_000, 4_000, 8_000, 16_000, 32_000, 60_000];

const backoffAt = (attempt: number): number =>
  RETRY_BACKOFF_MS[Math.min(attempt, RETRY_BACKOFF_MS.length - 1)];

/**
 * Real AdMob AdsPort. Returns null when the SDK package is not installed OR no
 * `extra.admob` block exists — callers (adsInstance.ts) fall back to the mock.
 *
 * Lifecycle per ad kind: create the ad object once, subscribe LOADED / ERROR /
 * CLOSED (+ EARNED_REWARD for rewarded), call load(), and re-load after every
 * close so the next show is instant. A failed load schedules a retry with
 * exponential backoff so a flaky network self-heals without hammering AdMob.
 */
export function createAdmobAds(): AdsPort | null {
  const mod = getAdmobModule();
  const config = readAdmobConfig();
  if (mod === null || config === null) {
    return null;
  }

  const { AdEventType, RewardedAdEventType, InterstitialAd, RewardedAd } = mod;

  // Until the UMP/ATT consent flow reports personalized ads are allowed,
  // request non-personalized ads only (always policy-safe).
  const requestOptions = { requestNonPersonalizedAdsOnly: true };

  let initialized = false;

  // ---- interstitial -------------------------------------------------------
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let interstitial: any = null;
  let interstitialLoaded = false;
  let interstitialAttempts = 0;

  const loadInterstitial = (): void => {
    if (interstitial === null) {
      interstitial = InterstitialAd.createForAdRequest(
        config.interstitialId,
        requestOptions,
      );
      interstitial.addAdEventListener(AdEventType.LOADED, () => {
        interstitialLoaded = true;
        interstitialAttempts = 0;
      });
      interstitial.addAdEventListener(AdEventType.ERROR, () => {
        interstitialLoaded = false;
        const delay = backoffAt(interstitialAttempts);
        interstitialAttempts += 1;
        setTimeout(() => interstitial?.load(), delay);
      });
      interstitial.addAdEventListener(AdEventType.CLOSED, () => {
        interstitialLoaded = false;
        interstitial?.load(); // preload the next one immediately
      });
    }
    interstitial.load();
  };

  // ---- rewarded -----------------------------------------------------------
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rewarded: any = null;
  let rewardedLoaded = false;
  let rewardedAttempts = 0;
  let rewardedEarned = false;
  let rewardedResolve: ((result: RewardedResult) => void) | null = null;

  const loadRewarded = (): void => {
    if (rewarded === null) {
      rewarded = RewardedAd.createForAdRequest(
        config.rewardedId,
        requestOptions,
      );
      rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
        rewardedLoaded = true;
        rewardedAttempts = 0;
      });
      rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
        rewardedEarned = true;
      });
      rewarded.addAdEventListener(AdEventType.ERROR, () => {
        rewardedLoaded = false;
        rewardedResolve?.('unavailable');
        rewardedResolve = null;
        const delay = backoffAt(rewardedAttempts);
        rewardedAttempts += 1;
        setTimeout(() => rewarded?.load(), delay);
      });
      rewarded.addAdEventListener(AdEventType.CLOSED, () => {
        rewardedLoaded = false;
        // CLOSED fires after EARNED_REWARD when the user watched through.
        rewardedResolve?.(rewardedEarned ? 'earned' : 'dismissed');
        rewardedResolve = null;
        rewarded?.load(); // preload the next one immediately
      });
    }
    rewarded.load();
  };

  return {
    async initialize(): Promise<void> {
      if (initialized) {
        return;
      }
      initialized = true;
      try {
        await mod.default().initialize();
      } catch {
        // SDK init failure: stay "initialized" so we don't loop, but ads will
        // simply never report ready — the game plays on, ad-free.
        return;
      }
      loadInterstitial();
      loadRewarded();
    },

    isReady(kind): boolean {
      return kind === 'interstitial' ? interstitialLoaded : rewardedLoaded;
    },

    showInterstitial(): Promise<InterstitialResult> {
      if (!initialized || !interstitialLoaded || interstitial === null) {
        return Promise.resolve('skipped');
      }
      return new Promise<InterstitialResult>((resolve) => {
        const unsubscribe = interstitial.addAdEventListener(
          AdEventType.CLOSED,
          () => {
            unsubscribe?.();
            resolve('shown');
          },
        );
        try {
          interstitialLoaded = false;
          interstitial.show();
        } catch {
          unsubscribe?.();
          resolve('skipped');
        }
      });
    },

    showRewarded(): Promise<RewardedResult> {
      if (!initialized || !rewardedLoaded || rewarded === null) {
        return Promise.resolve('unavailable');
      }
      return new Promise<RewardedResult>((resolve) => {
        rewardedEarned = false;
        rewardedResolve = resolve;
        try {
          rewardedLoaded = false;
          rewarded.show();
        } catch {
          rewardedResolve = null;
          resolve('unavailable');
        }
      });
    },
  };
}

export interface AdmobBanner {
  /**
   * The BannerAd component from react-native-google-mobile-ads. Typed loosely
   * because the package (and its types) are absent until installed.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Banner: any;
  /** The adaptive size constant to pass as the `size` prop. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  size: any;
  unitId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  requestOptions: any;
}

/**
 * Real banner plumbing for AdBanner.tsx: the component, the adaptive size
 * constant, and the configured unit id — or null when we're in mock mode
 * (package missing or no `extra.admob` block), in which case AdBanner renders
 * its truthful placeholder instead.
 */
export function getAdmobBanner(): AdmobBanner | null {
  const mod = getAdmobModule();
  const config = readAdmobConfig();
  if (mod === null || config === null) {
    return null;
  }
  return {
    Banner: mod.BannerAd,
    size: mod.BannerAdSize?.ANCHORED_ADAPTIVE_BANNER,
    unitId: config.bannerId,
    requestOptions: { requestNonPersonalizedAdsOnly: true },
  };
}
