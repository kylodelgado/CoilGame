import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  MOCK_PURCHASE_DELAY_MS,
  PREMIUM_PRODUCT_ID,
  createMockPurchases,
} from '../src/services/PurchasesPort';
import { createIapPurchases, readIapConfig } from '../src/services/iapPurchases';
import { saveEntitlements } from '../src/services/entitlementsStorage';
import {
  appPurchases,
  getMonetizationMode,
  purchasesMode,
  restorePurchases,
} from '../src/services/purchasesInstance';
import { adsMode, appAds } from '../src/services/adsInstance';
import { useEntitlementsStore } from '../src/state/useEntitlementsStore';

// Controllable expo-constants (see adsPort.test.ts).
let mockExtra: Record<string, unknown> | undefined;
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    get expoConfig() {
      return { extra: mockExtra };
    },
  },
}));

const immediate = (): Promise<void> => Promise.resolve();

beforeEach(async () => {
  mockExtra = undefined;
  await AsyncStorage.clear();
  useEntitlementsStore.setState({
    premium: false,
    purchasedIds: [],
    hydrated: false,
  });
});

describe('createMockPurchases', () => {
  it('getProducts returns the coil.premium product at $2.99', async () => {
    const purchases = createMockPurchases({ sleep: immediate });
    await purchases.initialize();
    const products = await purchases.getProducts();
    expect(products).toHaveLength(1);
    expect(products[0]).toEqual({
      id: PREMIUM_PRODUCT_ID,
      title: 'Coil Premium',
      description: expect.any(String),
      priceString: '$2.99',
    });
    expect(PREMIUM_PRODUCT_ID).toBe('coil.premium');
  });

  it('purchase ALWAYS succeeds after the mock delay (owner instruction)', async () => {
    const waits: number[] = [];
    const purchases = createMockPurchases({
      sleep: (ms) => {
        waits.push(ms);
        return Promise.resolve();
      },
    });
    await expect(purchases.purchase(PREMIUM_PRODUCT_ID)).resolves.toBe(
      'purchased',
    );
    await expect(purchases.purchase('anything.else')).resolves.toBe('purchased');
    expect(waits).toEqual([MOCK_PURCHASE_DELAY_MS, MOCK_PURCHASE_DELAY_MS]);
    expect(MOCK_PURCHASE_DELAY_MS).toBe(800);
  });

  it('uses a real 800ms timer by default', async () => {
    jest.useFakeTimers();
    try {
      const purchases = createMockPurchases();
      let result: string | undefined;
      const pending = purchases.purchase(PREMIUM_PRODUCT_ID).then((r) => {
        result = r;
      });
      jest.advanceTimersByTime(MOCK_PURCHASE_DELAY_MS - 1);
      await Promise.resolve();
      await Promise.resolve();
      expect(result).toBeUndefined();
      jest.advanceTimersByTime(1);
      await pending;
      expect(result).toBe('purchased');
    } finally {
      jest.useRealTimers();
    }
  });

  it('restorePurchases returns ids from the injected reader', async () => {
    const purchases = createMockPurchases({
      sleep: immediate,
      readPurchasedIds: () => Promise.resolve(['coil.premium', 'other.thing']),
    });
    await expect(purchases.restorePurchases()).resolves.toEqual([
      'coil.premium',
      'other.thing',
    ]);
  });

  it('restorePurchases degrades to [] when the reader throws', async () => {
    const purchases = createMockPurchases({
      sleep: immediate,
      readPurchasedIds: () => Promise.reject(new Error('corrupt')),
    });
    await expect(purchases.restorePurchases()).resolves.toEqual([]);
  });

  it('by default restore round-trips through entitlements storage', async () => {
    await saveEntitlements({ premium: true, purchasedIds: [PREMIUM_PRODUCT_ID] });
    const purchases = createMockPurchases({ sleep: immediate });
    await expect(purchases.restorePurchases()).resolves.toEqual([
      PREMIUM_PRODUCT_ID,
    ]);
  });
});

describe('createIapPurchases (real adapter gating)', () => {
  it('returns null when the expo-iap package is absent, even with config', () => {
    mockExtra = { iap: { premiumProductId: 'coil.premium' } };
    expect(createIapPurchases()).toBeNull();
  });

  it('readIapConfig is null without an extra.iap block', () => {
    mockExtra = undefined;
    expect(readIapConfig()).toBeNull();
    mockExtra = {};
    expect(readIapConfig()).toBeNull();
  });

  it('an empty extra.iap block defaults the product id to coil.premium', () => {
    mockExtra = { iap: {} };
    expect(readIapConfig()).toEqual({ premiumProductId: PREMIUM_PRODUCT_ID });
    mockExtra = { iap: { premiumProductId: 'custom.id' } };
    expect(readIapConfig()).toEqual({ premiumProductId: 'custom.id' });
  });
});

describe('singletons (adsInstance / purchasesInstance)', () => {
  it('run in mock mode today — no SDKs installed, no config present', () => {
    expect(adsMode).toBe('mock');
    expect(purchasesMode).toBe('mock');
    expect(getMonetizationMode()).toBe('mock');
    expect(appAds).toBeDefined();
    expect(appPurchases).toBeDefined();
  });

  it('the app-wide mock purchase flow succeeds end to end', async () => {
    await appPurchases.initialize();
    const products = await appPurchases.getProducts();
    expect(products[0]?.id).toBe(PREMIUM_PRODUCT_ID);
    await expect(appPurchases.purchase(PREMIUM_PRODUCT_ID)).resolves.toBe(
      'purchased',
    );
  }, 15_000);

  it('restorePurchases() convenience grants premium when coil.premium is owned', async () => {
    await saveEntitlements({ premium: true, purchasedIds: [PREMIUM_PRODUCT_ID] });
    const ids = await restorePurchases();
    expect(ids).toContain(PREMIUM_PRODUCT_ID);
    expect(useEntitlementsStore.getState().premium).toBe(true);
  }, 15_000);

  it('restorePurchases() finds nothing on a fresh install and stays free', async () => {
    const ids = await restorePurchases();
    expect(ids).toEqual([]);
    expect(useEntitlementsStore.getState().premium).toBe(false);
  }, 15_000);
});
