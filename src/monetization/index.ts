// Monetization UI layer: the end-screen banner slot and the hooks that
// encapsulate the interstitial cadence and the once-per-run revive offer.
// The underlying ports/adapters live in src/services (AdsPort, PurchasesPort,
// adsInstance, purchasesInstance); the pure revive rule is src/engine/revive.
export * from './AdBanner';
export * from './useInterstitialGate';
export * from './useRevive';
