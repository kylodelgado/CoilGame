import { create } from 'zustand';
import {
  loadEntitlements,
  saveEntitlements,
  type PersistedEntitlements,
} from '../services/entitlementsStorage';
import {
  PREMIUM_PRODUCT_ID,
  type PurchasesPort,
} from '../services/PurchasesPort';

interface EntitlementsState {
  /** True once coil.premium is owned: no ads anywhere, revives without ads. */
  premium: boolean;
  /** Every product id known to be purchased (source for mock restore). */
  purchasedIds: string[];
  hydrated: boolean;

  hydrate(): Promise<void>;
  /**
   * Grant Coil Premium (called after a confirmed purchase or restore). Updates
   * in memory immediately and persists fire-and-forget; a rejected write is
   * swallowed and the in-memory value is kept (same contract as recordRun).
   */
  grantPremium(): void;
  /**
   * Restore purchases through the given port: asks the store for owned product
   * ids, grants premium when coil.premium is among them, and returns the ids
   * so the UI can report "restored" vs "nothing to restore". Never throws.
   */
  restore(purchases: PurchasesPort): Promise<string[]>;
}

/**
 * Entitlements store: the app-wide answer to "is this player premium?".
 * Hydrates from the local entitlements cache at launch (so ad gates are right
 * from the first frame after hydration) and persists every grant through
 * entitlementsStorage. The platform store remains the source of truth —
 * restore() re-derives the cache from it. (Monetization)
 */
export const useEntitlementsStore = create<EntitlementsState>((set, get) => ({
  premium: false,
  purchasedIds: [],
  hydrated: false,

  async hydrate(): Promise<void> {
    const loaded = await loadEntitlements();
    set({
      premium: loaded.premium,
      purchasedIds: loaded.purchasedIds,
      hydrated: true,
    });
  },

  grantPremium(): void {
    const ids = get().purchasedIds;
    const purchasedIds = ids.includes(PREMIUM_PRODUCT_ID)
      ? ids
      : [...ids, PREMIUM_PRODUCT_ID];
    set({ premium: true, purchasedIds });
    const payload: PersistedEntitlements = { premium: true, purchasedIds };
    saveEntitlements(payload).catch(() => undefined);
  },

  async restore(purchases: PurchasesPort): Promise<string[]> {
    let ids: string[];
    try {
      ids = await purchases.restorePurchases();
    } catch {
      return [];
    }
    if (ids.includes(PREMIUM_PRODUCT_ID)) {
      get().grantPremium();
    }
    return ids;
  },
}));
