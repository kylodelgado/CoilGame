import { createMockAds, type AdsPort } from './AdsPort';
import { createAdmobAds } from './admobAds';

/**
 * App-wide AdsPort singleton (same pattern as appAuth/appSound). The real
 * AdMob adapter activates by itself once react-native-google-mobile-ads is
 * installed AND app.json gains an `extra.admob` block; until then the factory
 * returns null and the succeed-always mock keeps the full game flow playable.
 * No code changes are needed to go live — see docs/MONETIZATION.md.
 */
const realAds = createAdmobAds();

/** 'real' when the AdMob SDK + config are present, else 'mock'. */
export const adsMode: 'mock' | 'real' = realAds !== null ? 'real' : 'mock';

export const appAds: AdsPort = realAds ?? createMockAds();
