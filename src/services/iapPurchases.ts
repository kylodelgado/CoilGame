import Constants from 'expo-constants';
import {
  PREMIUM_PRODUCT_ID,
  type Product,
  type PurchaseResult,
  type PurchasesPort,
} from './PurchasesPort';

/**
 * expo-iap adapter for PurchasesPort, targeting the `expo-iap` package — which
 * is intentionally NOT a dependency today. Same dynamic-require-null-fallback
 * pattern as admobAds.ts: until the owner installs expo-iap AND adds
 * `extra.iap` to app.json, `createIapPurchases()` returns null and the app
 * runs on the mock (purchasesInstance.ts). Go-live is config-only — no code
 * changes here. See docs/MONETIZATION.md.
 *
 * Store setup that must exist before this adapter can return products:
 * a non-consumable product with id `coil.premium` in App Store Connect and a
 * managed in-app product with the same id in Play Console.
 */

export interface IapConfig {
  /** The premium product id; defaults to PREMIUM_PRODUCT_ID when blank. */
  premiumProductId: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Read the IAP config from expo-constants `extra.iap`. Returns null when the
 * block is absent entirely (purchases stay mocked); a present-but-empty block
 * enables the real adapter with the default product id.
 */
export function readIapConfig(): IapConfig | null {
  const extra = Constants.expoConfig?.extra as
    | { iap?: Record<string, unknown> }
    | undefined;
  const raw = extra?.iap;
  if (!isRecord(raw)) {
    return null;
  }
  const id = raw.premiumProductId;
  return {
    premiumProductId:
      typeof id === 'string' && id.length > 0 ? id : PREMIUM_PRODUCT_ID,
  };
}

/**
 * Resolve expo-iap WITHOUT a static import (string-split so Metro's resolver
 * never traces the uninstalled package). Typed as `any` internally on purpose —
 * the package's types don't exist until it's installed.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadIapModule(): any | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo' + '-iap');
  } catch {
    return null;
  }
}

let cachedModule: unknown = undefined;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getIapModule(): any | null {
  if (cachedModule === undefined) {
    cachedModule = loadIapModule();
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return cachedModule as any | null;
}

/** Map an expo-iap product record onto Coil's Product shape. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toProduct(raw: any): Product {
  return {
    id: String(raw?.id ?? raw?.productId ?? ''),
    title: String(raw?.title ?? 'Coil Premium'),
    description: String(raw?.description ?? ''),
    // expo-iap exposes the localized price as displayPrice; older
    // react-native-iap shapes call it localizedPrice.
    priceString: String(raw?.displayPrice ?? raw?.localizedPrice ?? ''),
  };
}

/**
 * Real store-backed PurchasesPort. Returns null when the expo-iap package is
 * not installed OR no `extra.iap` block exists — callers fall back to the mock.
 *
 * Flow: initConnection once; purchases resolve through the global
 * purchaseUpdated/purchaseError listeners (StoreKit/Billing deliver results
 * out-of-band, not as the requestPurchase return value); every delivered
 * purchase is acknowledged with finishTransaction(isConsumable: false) so the
 * store stops re-delivering it. Restore reads getAvailablePurchases(), which
 * on both platforms returns the user's non-consumed entitlements.
 */
export function createIapPurchases(): PurchasesPort | null {
  const mod = getIapModule();
  const config = readIapConfig();
  if (mod === null || config === null) {
    return null;
  }

  let initialized = false;
  let pendingResolve: ((result: PurchaseResult) => void) | null = null;

  const settle = (result: PurchaseResult): void => {
    pendingResolve?.(result);
    pendingResolve = null;
  };

  const ensureInitialized = async (): Promise<void> => {
    if (initialized) {
      return;
    }
    initialized = true;
    try {
      await mod.initConnection();

      // Successful purchases arrive here (including ones interrupted by an app
      // kill — the store re-delivers on next launch until finished).
      mod.purchaseUpdatedListener(async (purchase: unknown) => {
        try {
          await mod.finishTransaction({ purchase, isConsumable: false });
        } catch {
          // Best-effort ack; an unfinished transaction re-delivers next launch.
        }
        settle('purchased');
      });

      // Failures and user cancellations arrive here.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mod.purchaseErrorListener((error: any) => {
        const code = String(error?.code ?? '');
        settle(
          code === 'E_USER_CANCELLED' || code === 'user-cancelled'
            ? 'cancelled'
            : 'failed',
        );
      });
    } catch {
      // Connection failure: leave initialized=true (don't loop); calls below
      // fail soft ('failed' / empty lists) and the UI stays usable.
    }
  };

  return {
    initialize(): Promise<void> {
      return ensureInitialized();
    },

    async getProducts(): Promise<Product[]> {
      await ensureInitialized();
      try {
        const raw = await mod.fetchProducts({
          skus: [config.premiumProductId],
          type: 'in-app',
        });
        return (Array.isArray(raw) ? raw : [])
          .map(toProduct)
          .filter((p: Product) => p.id.length > 0);
      } catch {
        return [];
      }
    },

    async purchase(productId: string): Promise<PurchaseResult> {
      await ensureInitialized();
      // Only one in-flight purchase at a time; a second request while one is
      // pending fails fast instead of cross-wiring listener resolutions.
      if (pendingResolve !== null) {
        return 'failed';
      }
      return new Promise<PurchaseResult>((resolve) => {
        pendingResolve = resolve;
        Promise.resolve(
          mod.requestPurchase({
            request: {
              ios: { sku: productId },
              android: { skus: [productId] },
            },
            type: 'in-app',
          }),
        ).catch(() => {
          // Immediate rejection (e.g. store unavailable) — the listeners will
          // never fire for this attempt.
          settle('failed');
        });
      });
    },

    async restorePurchases(): Promise<string[]> {
      await ensureInitialized();
      try {
        const purchases = await mod.getAvailablePurchases();
        return (Array.isArray(purchases) ? purchases : [])
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((p: any) => String(p?.productId ?? p?.id ?? ''))
          .filter((id: string) => id.length > 0);
      } catch {
        return [];
      }
    },
  };
}
