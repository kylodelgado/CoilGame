import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Local persistence for purchase entitlements (currently just Coil Premium).
 * Same discipline as StoragePort/asyncStorageAdapter: a versioned key, a pure
 * validate-with-defaults safety net so corrupt or missing data degrades to
 * "not premium" instead of crashing, reads that never throw, and writes whose
 * rejections the store layer swallows (fire-and-forget). The platform store
 * (StoreKit / Play Billing) remains the source of truth — Restore Purchases
 * always re-derives this cache from it. (Monetization)
 */

export const ENTITLEMENTS_KEY = 'coil.entitlements.v1';

export interface PersistedEntitlements {
  /** True once coil.premium is owned: removes all ads, free revives. */
  premium: boolean;
  /** Every product id ever purchased (restore round-trips through this). */
  purchasedIds: string[];
}

export const DEFAULT_ENTITLEMENTS: PersistedEntitlements = {
  premium: false,
  purchasedIds: [],
};

/** Narrow to a plain (non-null, non-array) object for safe property access. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Coerce arbitrary persisted data into valid PersistedEntitlements, falling
 * back to defaults for any invalid or missing field. Non-string entries in
 * purchasedIds are dropped. Pure and total — never throws for any input.
 */
export function validateEntitlements(raw: unknown): PersistedEntitlements {
  if (!isRecord(raw)) {
    return { ...DEFAULT_ENTITLEMENTS, purchasedIds: [] };
  }
  const purchasedIds = Array.isArray(raw.purchasedIds)
    ? raw.purchasedIds.filter(
        (id): id is string => typeof id === 'string' && id.length > 0,
      )
    : [];
  return {
    premium:
      typeof raw.premium === 'boolean'
        ? raw.premium
        : DEFAULT_ENTITLEMENTS.premium,
    purchasedIds,
  };
}

/**
 * Read entitlements from AsyncStorage. Never throws into the caller: any read
 * or parse failure degrades to the defaults, and parseable-but-malformed data
 * is sanitized by the validator.
 */
export async function loadEntitlements(): Promise<PersistedEntitlements> {
  try {
    const stored = await AsyncStorage.getItem(ENTITLEMENTS_KEY);
    if (stored === null) {
      return { ...DEFAULT_ENTITLEMENTS, purchasedIds: [] };
    }
    return validateEntitlements(JSON.parse(stored));
  } catch {
    return { ...DEFAULT_ENTITLEMENTS, purchasedIds: [] };
  }
}

/**
 * Persist entitlements. May reject; the store layer persists fire-and-forget
 * and keeps its in-memory value on failure (same contract as setScores).
 */
export function saveEntitlements(e: PersistedEntitlements): Promise<void> {
  return AsyncStorage.setItem(ENTITLEMENTS_KEY, JSON.stringify(e));
}
