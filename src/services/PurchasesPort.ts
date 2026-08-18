import { loadEntitlements } from './entitlementsStorage';

/**
 * In-app purchase contract for Coil. Same port + adapter + mock pattern as
 * AdsPort: the expo-iap adapter (iapPurchases.ts) implements this against the
 * real store when the package and config are present; the mock below makes the
 * FULL purchase flow work today — purchases always succeed (owner instruction)
 * so the Store screen, premium gating, and restore are exercised end to end
 * with zero store setup. (Monetization)
 */

/** The single product Coil sells: a non-consumable that removes ads forever. */
export const PREMIUM_PRODUCT_ID = 'coil.premium';

export interface Product {
  id: string;
  title: string;
  description: string;
  /** Localized display price straight from store data (mock: "$2.99"). */
  priceString: string;
}

/**
 * 'purchased' = the store confirmed the sale (grant the entitlement);
 * 'cancelled' = the user backed out (no error UI needed);
 * 'failed' = a store/network error (show a retryable message).
 */
export type PurchaseResult = 'purchased' | 'cancelled' | 'failed';

export interface PurchasesPort {
  /** Idempotent store-connection startup. Resolves even on failure. */
  initialize(): Promise<void>;
  getProducts(): Promise<Product[]>;
  purchase(productId: string): Promise<PurchaseResult>;
  /** Re-derive owned product ids from the platform store; returns those ids. */
  restorePurchases(): Promise<string[]>;
}

/** The mock's catalog entry for Coil Premium. */
export const MOCK_PREMIUM_PRODUCT: Product = {
  id: PREMIUM_PRODUCT_ID,
  title: 'Coil Premium',
  description: 'Removes all ads forever and makes revives instant.',
  priceString: '$2.99',
};

/** How long the mock "talks to the store" before resolving, in milliseconds. */
export const MOCK_PURCHASE_DELAY_MS = 800;

export interface MockPurchasesOptions {
  /** Fake store round-trip duration; defaults to MOCK_PURCHASE_DELAY_MS. */
  delayMs?: number;
  /** Injectable clock (see MockAdsOptions.sleep); defaults to setTimeout. */
  sleep?: (ms: number) => Promise<void>;
  /**
   * Where restore reads previously purchased ids from. Defaults to the local
   * entitlements storage, so a mock "purchase" recorded by the entitlements
   * store round-trips through Restore exactly like a real one would.
   */
  readPurchasedIds?: () => Promise<string[]>;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const defaultReadPurchasedIds = async (): Promise<string[]> =>
  (await loadEntitlements()).purchasedIds;

/**
 * Deterministic, network-free PurchasesPort mock. Per owner instruction the
 * purchase ALWAYS succeeds (after a short fake delay) so the full premium flow
 * is playable without App Store / Play Console setup. Restore returns whatever
 * ids entitlements storage already holds — i.e. what the player "bought" in
 * earlier mock sessions.
 */
export function createMockPurchases(
  options: MockPurchasesOptions = {},
): PurchasesPort {
  const delayMs = options.delayMs ?? MOCK_PURCHASE_DELAY_MS;
  const sleep = options.sleep ?? defaultSleep;
  const readPurchasedIds = options.readPurchasedIds ?? defaultReadPurchasedIds;

  return {
    initialize(): Promise<void> {
      return Promise.resolve();
    },

    getProducts(): Promise<Product[]> {
      return Promise.resolve([{ ...MOCK_PREMIUM_PRODUCT }]);
    },

    async purchase(): Promise<PurchaseResult> {
      await sleep(delayMs);
      return 'purchased';
    },

    async restorePurchases(): Promise<string[]> {
      await sleep(delayMs);
      try {
        return await readPurchasedIds();
      } catch {
        return [];
      }
    },
  };
}
