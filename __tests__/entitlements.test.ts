import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_ENTITLEMENTS,
  ENTITLEMENTS_KEY,
  loadEntitlements,
  saveEntitlements,
  validateEntitlements,
} from '../src/services/entitlementsStorage';
import { PREMIUM_PRODUCT_ID, type PurchasesPort } from '../src/services/PurchasesPort';
import { useEntitlementsStore } from '../src/state/useEntitlementsStore';

const flushAsync = (): Promise<void> =>
  new Promise((resolve) => {
    setImmediate(resolve);
  });

const makeFakePort = (restoredIds: string[] | Error): PurchasesPort => ({
  initialize: () => Promise.resolve(),
  getProducts: () => Promise.resolve([]),
  purchase: () => Promise.resolve('purchased'),
  restorePurchases: () =>
    restoredIds instanceof Error
      ? Promise.reject(restoredIds)
      : Promise.resolve(restoredIds),
});

beforeEach(async () => {
  await AsyncStorage.clear();
  useEntitlementsStore.setState({
    premium: false,
    purchasedIds: [],
    hydrated: false,
  });
});

describe('validateEntitlements (pure, total)', () => {
  it('passes a valid record through unchanged', () => {
    expect(
      validateEntitlements({ premium: true, purchasedIds: ['coil.premium'] }),
    ).toEqual({ premium: true, purchasedIds: ['coil.premium'] });
  });

  it('falls back to defaults for any non-object input', () => {
    for (const raw of [null, undefined, 42, 'premium', true, [1, 2]]) {
      expect(validateEntitlements(raw)).toEqual(DEFAULT_ENTITLEMENTS);
    }
  });

  it('coerces a malformed premium flag to false', () => {
    expect(validateEntitlements({ premium: 'yes', purchasedIds: [] })).toEqual({
      premium: false,
      purchasedIds: [],
    });
    expect(validateEntitlements({ purchasedIds: [] }).premium).toBe(false);
  });

  it('drops non-string and empty entries from purchasedIds', () => {
    expect(
      validateEntitlements({
        premium: true,
        purchasedIds: ['coil.premium', 42, null, '', { id: 'x' }, 'other'],
      }),
    ).toEqual({ premium: true, purchasedIds: ['coil.premium', 'other'] });
  });

  it('treats a non-array purchasedIds as empty', () => {
    expect(
      validateEntitlements({ premium: true, purchasedIds: 'coil.premium' }),
    ).toEqual({ premium: true, purchasedIds: [] });
  });

  it('never returns a shared mutable default', () => {
    const a = validateEntitlements(null);
    const b = validateEntitlements(null);
    a.purchasedIds.push('mutated');
    expect(b.purchasedIds).toEqual([]);
    expect(DEFAULT_ENTITLEMENTS.purchasedIds).toEqual([]);
  });
});

describe('entitlements storage (load/save)', () => {
  it('loads defaults when nothing is stored', async () => {
    await expect(loadEntitlements()).resolves.toEqual(DEFAULT_ENTITLEMENTS);
  });

  it('round-trips a saved value', async () => {
    await saveEntitlements({ premium: true, purchasedIds: [PREMIUM_PRODUCT_ID] });
    await expect(loadEntitlements()).resolves.toEqual({
      premium: true,
      purchasedIds: [PREMIUM_PRODUCT_ID],
    });
  });

  it('degrades corrupt JSON to defaults without throwing', async () => {
    await AsyncStorage.setItem(ENTITLEMENTS_KEY, '{not json');
    await expect(loadEntitlements()).resolves.toEqual(DEFAULT_ENTITLEMENTS);
  });

  it('sanitizes parseable-but-malformed data', async () => {
    await AsyncStorage.setItem(
      ENTITLEMENTS_KEY,
      JSON.stringify({ premium: 1, purchasedIds: ['ok', 7] }),
    );
    await expect(loadEntitlements()).resolves.toEqual({
      premium: false,
      purchasedIds: ['ok'],
    });
  });

  it('uses the versioned key', () => {
    expect(ENTITLEMENTS_KEY).toBe('coil.entitlements.v1');
  });
});

describe('useEntitlementsStore', () => {
  it('hydrates from storage', async () => {
    await saveEntitlements({ premium: true, purchasedIds: [PREMIUM_PRODUCT_ID] });
    expect(useEntitlementsStore.getState().hydrated).toBe(false);
    await useEntitlementsStore.getState().hydrate();
    const state = useEntitlementsStore.getState();
    expect(state.hydrated).toBe(true);
    expect(state.premium).toBe(true);
    expect(state.purchasedIds).toEqual([PREMIUM_PRODUCT_ID]);
  });

  it('hydrates to defaults on a fresh install', async () => {
    await useEntitlementsStore.getState().hydrate();
    const state = useEntitlementsStore.getState();
    expect(state.hydrated).toBe(true);
    expect(state.premium).toBe(false);
  });

  it('grantPremium updates memory immediately and persists fire-and-forget', async () => {
    useEntitlementsStore.getState().grantPremium();
    // In memory immediately (synchronous).
    expect(useEntitlementsStore.getState().premium).toBe(true);
    expect(useEntitlementsStore.getState().purchasedIds).toEqual([
      PREMIUM_PRODUCT_ID,
    ]);
    // Persisted shortly after.
    await flushAsync();
    await expect(loadEntitlements()).resolves.toEqual({
      premium: true,
      purchasedIds: [PREMIUM_PRODUCT_ID],
    });
  });

  it('grantPremium is idempotent — no duplicate product ids', async () => {
    useEntitlementsStore.getState().grantPremium();
    useEntitlementsStore.getState().grantPremium();
    expect(useEntitlementsStore.getState().purchasedIds).toEqual([
      PREMIUM_PRODUCT_ID,
    ]);
  });

  it('restore grants premium when the port returns coil.premium', async () => {
    const ids = await useEntitlementsStore
      .getState()
      .restore(makeFakePort([PREMIUM_PRODUCT_ID]));
    expect(ids).toEqual([PREMIUM_PRODUCT_ID]);
    expect(useEntitlementsStore.getState().premium).toBe(true);
    await flushAsync();
    await expect(loadEntitlements()).resolves.toMatchObject({ premium: true });
  });

  it('restore leaves a free player free when nothing relevant comes back', async () => {
    const ids = await useEntitlementsStore
      .getState()
      .restore(makeFakePort(['some.other.product']));
    expect(ids).toEqual(['some.other.product']);
    expect(useEntitlementsStore.getState().premium).toBe(false);
  });

  it('restore never throws — a failing port resolves to []', async () => {
    const ids = await useEntitlementsStore
      .getState()
      .restore(makeFakePort(new Error('store down')));
    expect(ids).toEqual([]);
    expect(useEntitlementsStore.getState().premium).toBe(false);
  });
});
