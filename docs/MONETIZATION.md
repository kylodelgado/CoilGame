# Coil Monetization — Owner Runbook

Coil ships one monetization layer with two interchangeable backends per
concern, selected automatically at startup:

| Concern   | Port (contract)             | Real adapter                              | Mock (active today)          |
|-----------|-----------------------------|-------------------------------------------|------------------------------|
| Ads       | `src/services/AdsPort.ts`   | `src/services/admobAds.ts` (AdMob)        | `createMockAds()`            |
| Purchases | `src/services/PurchasesPort.ts` | `src/services/iapPurchases.ts` (expo-iap) | `createMockPurchases()`      |

Selection happens in `src/services/adsInstance.ts` / `purchasesInstance.ts`:

```ts
appAds       = createAdmobAds()     ?? createMockAds();
appPurchases = createIapPurchases() ?? createMockPurchases();
```

A real factory returns `null` unless **both** its npm package is installed
**and** its config block exists in `app.json` → `expo.extra`. So going live is:
install two packages, paste ids, rebuild. **Zero code changes.**

---

## (a) What runs today — mock mode

No packages installed, no `extra.admob` / `extra.iap` blocks → both factories
return `null` → the mocks run, and (per design) every flow **succeeds** so the
whole game is playable:

- **Interstitial** — after every 3rd loss (min 90s apart, never for premium):
  resolves `'shown'` after a 600 ms fake delay (no UI overlay in mock mode).
- **Banner** — win/loss screens only: `AdBanner` renders a truthful dark
  placeholder panel at the exact 60 pt adaptive-banner height ("Your ad here ·
  mock"), so end-screen layout today is identical to the real-ads layout.
- **Rewarded "Revive"** — always resolves `'earned'` after the delay, so the
  once-per-run revive is fully exercisable.
- **Purchase** — `coil.premium` at a displayed `$2.99`; always succeeds after
  800 ms. Premium is persisted locally (`coil.entitlements.v1` in
  AsyncStorage) and Restore Purchases round-trips through it.

`getMonetizationMode()` from `src/services/purchasesInstance.ts` returns
`'mock' | 'real'` for display (e.g. a Settings footer).

To reset a mock premium purchase during development: delete the app (clears
AsyncStorage) or remove the `coil.entitlements.v1` key.

---

## (b) Go live with ads (AdMob)

1. **Install the SDK** (the only ads-related dependency):

   ```sh
   npx expo install react-native-google-mobile-ads
   ```

2. **Create the AdMob apps + ad units** at https://apps.admob.com — one app per
   platform, then three ad units per app: an **anchored adaptive banner**, an
   **interstitial**, and a **rewarded** unit.

3. **Add the config-plugin block** to `app.json` → `expo.plugins` (this is what
   bakes the App IDs into Info.plist / AndroidManifest — required, or the app
   crashes at launch with the SDK installed):

   ```json
   [
     "react-native-google-mobile-ads",
     {
       "androidAppId": "ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY",
       "iosAppId": "ca-app-pub-XXXXXXXXXXXXXXXX~ZZZZZZZZZZ",
       "userTrackingUsageDescription": "This identifier will be used to deliver personalized ads to you."
     }
   ]
   ```

4. **Paste the unit ids** into `app.json` → `expo.extra.admob` (the presence of
   this block is the runtime switch that activates the real adapter):

   ```json
   {
     "expo": {
       "extra": {
         "admob": {
           "appIdIos": "ca-app-pub-XXXXXXXXXXXXXXXX~ZZZZZZZZZZ",
           "appIdAndroid": "ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY",
           "bannerId": "ca-app-pub-XXXXXXXXXXXXXXXX/BBBBBBBBBB",
           "interstitialId": "ca-app-pub-XXXXXXXXXXXXXXXX/IIIIIIIIII",
           "rewardedId": "ca-app-pub-XXXXXXXXXXXXXXXX/RRRRRRRRRR"
         }
       }
     }
   }
   ```

   Leaving any **unit id blank** (but keeping the block) makes that slot fall
   back to **Google's official test ids** — a supported half-step for testing
   real SDK plumbing without risking policy strikes on live units.

5. **Rebuild the native app** (config plugins require a fresh prebuild):

   ```sh
   npx expo prebuild --clean && npx expo run:ios   # then run:android
   ```

### iOS: ATT + consent (UMP)

- The plugin's `userTrackingUsageDescription` becomes
  `NSUserTrackingUsageDescription` in Info.plist. Suggested copy:
  *"This identifier will be used to deliver personalized ads to you."*
- Until consent is obtained, the adapter requests **non-personalized ads only**
  (`requestNonPersonalizedAdsOnly: true` in `admobAds.ts`) — always
  policy-safe. To serve personalized ads (higher eCPM), wire Google's UMP
  consent flow (`AdsConsent` from the same SDK) before the first load, and
  configure your GDPR/ATT messages in AdMob → Privacy & messaging.
- Declare ads-related data use in App Store Connect's privacy questionnaire
  (Identifiers → Device ID, used for third-party advertising).

---

## (c) Go live with IAP (Coil Premium)

1. **Create the product** — id must be exactly `coil.premium`:
   - **App Store Connect**: My Apps → Coil → Monetization → In-App Purchases →
     `+` → type **Non-Consumable** → Product ID `coil.premium` → price tier
     ($2.99) → localized display name "Coil Premium" + description → add a
     review screenshot → Save (must be "Ready to Submit" and submitted with a
     binary at least once). Also sign the Paid Applications agreement under
     Business if you never have.
   - **Play Console**: Coil → Monetize → Products → In-app products →
     Create product → Product ID `coil.premium` → name/description → price
     $2.99 → **Activate**. (Requires an APK/AAB with the BILLING permission
     uploaded to any track first — expo-iap adds the permission on build.)

2. **Install the SDK**:

   ```sh
   npx expo install expo-iap
   ```

3. **Add the runtime switch** to `app.json` → `expo.extra.iap` (the block's
   presence activates the real adapter; the id field is optional and defaults
   to `coil.premium`):

   ```json
   {
     "expo": {
       "extra": {
         "iap": {
           "premiumProductId": "coil.premium"
         }
       }
     }
   }
   ```

4. **Rebuild** (`npx expo prebuild --clean && npx expo run:ios` / `run:android`).

Price display always comes from store data (`Product.priceString`), so
regional prices are automatic. The local entitlements cache
(`coil.entitlements.v1`) is only a cache — Restore Purchases re-derives it
from the platform store on any device.

---

## (d) Testing matrix

| Stage | Ads | IAP | How |
|---|---|---|---|
| **Mock** (today) | Fake delays, always succeed, placeholder banner | Always purchases, local restore | `npm test`, simulator, no setup |
| **Test ids / sandbox** | Install SDK + plugin, keep unit ids **blank** in `extra.admob` → Google test ads render | Install expo-iap + `extra.iap`; App Store **Sandbox tester** (Settings → App Store → Sandbox Account) / Play **License testers** | Dev build on device |
| **Production** | Paste real unit ids; add your device as a test device in AdMob while verifying (untick before release!) | Product live + app released (TestFlight uses sandbox billing automatically) | Release build |

Never click your own live ads; use test ids or registered test devices.

---

## (e) Revenue-affecting rules — what's implemented and where to tune

| Rule | Value | Where |
|---|---|---|
| Interstitial cadence | every **3rd** game over (losses only, never wins) | `INTERSTITIAL_EVERY_N_GAME_OVERS` in `src/services/AdsPort.ts` |
| Interstitial cooldown | **90 s** minimum between shows | `INTERSTITIAL_MIN_INTERVAL_MS` in `src/services/AdsPort.ts` |
| No ads during gameplay | interstitial only fires from the loss flow; banner only on win/loss screens | `useInterstitialGate.maybeShowAfterGameOver` (`src/monetization/useInterstitialGate.ts`), `AdBanner` placement |
| Premium gates | premium ⇒ no interstitials, no banners, revive without ad | premium checks in `useInterstitialGate`, `AdBanner`, `useRevive` (all read `useEntitlementsStore`) |
| Revive | **once per run**; free users watch a rewarded ad (`'earned'` required); premium instant; failed ad load does **not** burn the revive | `src/monetization/useRevive.ts`; snake resurrection rule in `src/engine/revive.ts` (truncate to `max(3, len/2)`, keep head, relocate deterministically if boxed in) |
| Banner slot height | 60 pt (layout-truthful in mock mode) | `AD_BANNER_HEIGHT` in `src/monetization/AdBanner.tsx` |
| Product & price | one non-consumable `coil.premium`; display price from store (mock $2.99) | `PREMIUM_PRODUCT_ID` / `MOCK_PREMIUM_PRODUCT` in `src/services/PurchasesPort.ts` |
| Ad load retry | exponential backoff 2s → 60s cap | `RETRY_BACKOFF_MS` in `src/services/admobAds.ts` |

The interstitial counter and cooldown live in **memory only** (reset on app
restart, by design — a fresh session never opens with an ad already due).
