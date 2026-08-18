import { useCallback, useEffect } from 'react';
import { shouldShowInterstitial, type AdsPort } from '../services/AdsPort';
import { appAds } from '../services/adsInstance';
import { useEntitlementsStore } from '../state/useEntitlementsStore';

/**
 * The game-over interstitial gate. Encapsulates every revenue rule for the
 * interstitial in one place:
 *
 *   - counts GAME OVERS (losses — wins never count and never show one);
 *   - shows only after every 3rd loss, with a minimum 90s between shows
 *     (shouldShowInterstitial — the pure, unit-tested cadence rule);
 *   - never shows anything to premium players;
 *   - never runs during gameplay: callers invoke maybeShowAfterGameOver()
 *     from the loss flow only, after the run has already ended.
 *
 * The counter and last-shown timestamp live in module memory ONLY (reset on
 * app restart, by design — a fresh session never opens with a "due" ad).
 */

let gameOverCount = 0;
let lastShownAt: number | null = null;

/** Test-only: reset the module-level counter/cooldown between tests. */
export function resetInterstitialGateForTests(): void {
  gameOverCount = 0;
  lastShownAt = null;
}

export interface InterstitialGateDeps {
  /** AdsPort override (tests); defaults to the app-wide singleton. */
  ads?: AdsPort;
  /** Clock override (tests); defaults to Date.now. */
  now?: () => number;
}

export interface InterstitialGate {
  /**
   * Record one game over and show the interstitial when the cadence says so.
   * Resolves once the ad closes (or immediately when nothing is due), so the
   * caller can await it before/after navigating without racing the overlay.
   */
  maybeShowAfterGameOver(): Promise<void>;
}

export function useInterstitialGate(
  deps: InterstitialGateDeps = {},
): InterstitialGate {
  const { ads = appAds, now = Date.now } = deps;

  // Kick the SDK/mock init once so an ad is loaded by the time a loss lands.
  useEffect(() => {
    void ads.initialize().catch(() => undefined);
  }, [ads]);

  const maybeShowAfterGameOver = useCallback(async (): Promise<void> => {
    gameOverCount += 1;

    // Premium removes all ads — count the loss (harmless) but never show.
    if (useEntitlementsStore.getState().premium) {
      return;
    }
    if (!shouldShowInterstitial(gameOverCount, lastShownAt, now())) {
      return;
    }

    try {
      const result = await ads.showInterstitial();
      if (result === 'shown') {
        lastShownAt = now();
      }
      // 'skipped' (no fill / not ready): do NOT stamp the cooldown — the next
      // eligible loss gets another chance.
    } catch {
      // An ad failure must never break the loss flow.
    }
  }, [ads, now]);

  return { maybeShowAfterGameOver };
}
