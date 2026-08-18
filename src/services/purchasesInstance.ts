import { useEntitlementsStore } from '../state/useEntitlementsStore';
import { adsMode } from './adsInstance';
import { createMockPurchases, type PurchasesPort } from './PurchasesPort';
import { createIapPurchases } from './iapPurchases';

/**
 * App-wide PurchasesPort singleton (same pattern as appAuth/appSound). The
 * real expo-iap adapter activates by itself once expo-iap is installed AND
 * app.json gains an `extra.iap` block; until then the factory returns null and
 * the succeed-always mock keeps the full purchase flow playable. No code
 * changes are needed to go live — see docs/MONETIZATION.md.
 */
const realPurchases = createIapPurchases();

/** 'real' when the expo-iap SDK + config are present, else 'mock'. */
export const purchasesMode: 'mock' | 'real' =
  realPurchases !== null ? 'real' : 'mock';

export const appPurchases: PurchasesPort = realPurchases ?? createMockPurchases();

/**
 * Which monetization stack the build is running, for display (e.g. a Settings
 * footer or the Store screen's fine print). 'real' as soon as EITHER ads or
 * purchases resolved a real adapter; 'mock' only when everything is mocked.
 */
export function getMonetizationMode(): 'mock' | 'real' {
  return adsMode === 'real' || purchasesMode === 'real' ? 'real' : 'mock';
}

/**
 * Convenience for the Settings/Store screens (contract with the design agent):
 * restore purchases through the app-wide port, granting premium when
 * coil.premium comes back. Resolves with the restored product ids ([] when
 * nothing was found or the store errored) — never rejects.
 */
export function restorePurchases(): Promise<string[]> {
  return useEntitlementsStore.getState().restore(appPurchases);
}
