import { useCallback, useRef, useState } from 'react';
import type { AdsPort } from '../services/AdsPort';
import { appAds } from '../services/adsInstance';
import { useEntitlementsStore } from '../state/useEntitlementsStore';

/**
 * The rewarded-ad "Revive" offer for the loss flow. Encapsulates the revenue
 * rules: ONE revive per run; free players watch a rewarded ad (revive only on
 * 'earned'); premium players revive instantly with no ad — but still only once
 * per run. This hook only answers "did the player earn a revive?" — actually
 * resurrecting the snake is the pure engine rule src/engine/revive.ts, applied
 * by the caller when offerRevive() resolves true.
 *
 * The caller identifies the current run with `runKey` (any value that changes
 * when a new run starts — e.g. a run id or start timestamp). Changing the key
 * re-arms the offer; a consumed key stays consumed even across re-renders.
 */

export interface UseReviveDeps {
  /** AdsPort override (tests); defaults to the app-wide singleton. */
  ads?: AdsPort;
}

export interface ReviveOffer {
  /** True while this run's single revive is still available. */
  canRevive: boolean;
  /**
   * Run the revive flow: premium resolves true immediately; otherwise shows
   * the rewarded ad and resolves true only on 'earned'. The offer is consumed
   * ONLY on success — a dismissed or unavailable ad leaves it available so a
   * load hiccup never burns the player's one revive. Never rejects.
   */
  offerRevive(): Promise<boolean>;
}

export function useRevive(
  runKey: string | number,
  deps: UseReviveDeps = {},
): ReviveOffer {
  const { ads = appAds } = deps;

  // The run key whose revive has been consumed (null = none yet). Stored in
  // state so consumption re-renders the caller; compared against the current
  // runKey so a NEW run automatically re-arms without an explicit reset call.
  const [consumedKey, setConsumedKey] = useState<string | number | null>(null);
  const canRevive = consumedKey !== runKey;

  // Guard against double-taps: one offer in flight at a time.
  const inFlight = useRef(false);

  const offerRevive = useCallback(async (): Promise<boolean> => {
    if (consumedKey === runKey || inFlight.current) {
      return false;
    }
    inFlight.current = true;
    try {
      // Premium shortcut: instant revive, no ad — still consumes the run's one.
      if (useEntitlementsStore.getState().premium) {
        setConsumedKey(runKey);
        return true;
      }
      const result = await ads.showRewarded();
      if (result === 'earned') {
        setConsumedKey(runKey);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      inFlight.current = false;
    }
  }, [ads, consumedKey, runKey]);

  return { canRevive, offerRevive };
}
