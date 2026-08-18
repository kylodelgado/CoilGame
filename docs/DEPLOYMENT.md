# Coil — Deployment Runbook

Everything in the app is wired and runs today in **offline/mock mode** with no
keys. This document is the complete list of what the owner does to ship, and
exactly where each key goes. Items marked **(required)** block store
submission; everything else is optional go-live wiring.

---

## 1. What works with zero configuration

- Full gameplay: 3 modes × 3 presets × 2 wall types, powerups, bonus food.
- All 4 skins with pre-rendered Blender backdrops; full themed UI.
- Audio: 10 SFX + ambient music loop (generated in-repo: `tools/audio_gen.py`).
- Accounts + leaderboard: device-local, persistent across relaunches
  (`src/services/localPersistence.ts`). No network used.
- Monetization in mock mode: purchases always succeed (premium persists),
  rewarded revive always "earns", interstitial/banners render truthful
  placeholders. Premium hides all ads.
- Legal screens (Privacy/Terms/Licenses/How-to-Play), store listing copy in
  `store-listing/`.

## 2. Required before submission

1. **Jurisdiction (required)** — `src/legal/termsOfService.ts` has a
   `[JURISDICTION]` placeholder (Governing law). Fill it (e.g. "the courts of
   the Dominican Republic" or your preference).
2. **Hosted privacy policy URL (required)** — both stores require a URL, not
   just in-app text. Host the content of `src/legal/privacyPolicy.ts` anywhere
   public (GitHub Pages is fine) and paste the URL into App Store Connect +
   Play Console. Suggested: also add it to `store-listing/*.md` where marked.
3. **EAS project (required)** — `npx eas init` (adds `extra.eas.projectId` to
   app.json), then builds run with the profiles already defined in `eas.json`:
   - `eas build --profile production --platform ios`
   - `eas build --profile production --platform android`
   EAS manages the Android upload keystore and iOS certificates for you (this
   replaces the debug-keystore problem in the local `android/` folder — the
   local native folders are prebuild output and are NOT what ships).
4. **Store records (required)** — create the app in App Store Connect + Play
   Console with bundle id / package `com.kylo.delgado.coil`. Copy/paste
   listing text and questionnaire answers from `store-listing/apple.md` and
   `store-listing/google.md`.
5. **Version bumps** — `app.json` carries `version`, `ios.buildNumber`,
   `android.versionCode`; production builds auto-increment via
   `eas.json` (`autoIncrement: true`).

## 3. Firebase (online accounts + global leaderboard) — optional

Runs local-only until configured. To go live:

1. Create a Firebase project; enable **Auth** (Email/Password + Anonymous)
   and **Cloud Firestore**.
2. Add a Web App in Firebase and copy its config into `app.json`:
   ```json
   "extra": {
     "firebase": {
       "apiKey": "...",
       "authDomain": "...",
       "projectId": "...",
       "appId": "..."
     }
   }
   ```
   That's it — `src/services/firebaseSdk.ts` detects the block and switches
   `appAuth`/`appLeaderboard` from local to Firebase automatically. In-app
   account deletion calls Firebase `user.delete()` (App Store 5.1.1(v) ✓).
3. Deploy Firestore security rules before going live (validate score writes,
   one doc per user per board, rate-limit). Board path:
   `leaderboards/{MODE:WALL}/{uid}`. Example starting rules are in the
   comments of `src/services/firebaseLeaderboard.ts`.
4. The privacy policy already describes Firebase reality; update the App
   Privacy answers per `store-listing/apple.md` (they're written for the
   configured state).

## 4. Ads (AdMob) — optional

See `docs/MONETIZATION.md` for the full runbook. Summary:
`npx expo install react-native-google-mobile-ads` → add the plugin block with
your AdMob app ids → paste unit ids into `app.json → extra.admob` → rebuild.
Blank unit ids fall back to Google's official test ids. Until installed, the
mock layer runs (placeholder banner, auto-earn rewarded).

## 5. In-app purchase — optional

See `docs/MONETIZATION.md`. Summary: create non-consumable `coil.premium`
($2.99) in both consoles → `npx expo install expo-iap` → add
`extra.iap` → rebuild. Until then the mock purchase flow succeeds instantly
(as specified for development).

## 6. Nice-to-haves before launch

- **Crash reporting / analytics**: none installed (deliberate — zero data
  collection today). Sentry (`npx expo install @sentry/react-native`) is the
  usual choice; update the privacy policy + App Privacy answers if added.
- **Screenshots**: shot lists with captions are at the bottom of both
  `store-listing/*.md`. The four skins make good variety.
- **Localization**: all strings are inline English (single-locale v1).

## 7. Known dev-only quirks (not release issues)

- Reloading the JS bundle in the dev client while audio is mid-preload can
  segfault the dev client (Expo scheduler race). Production builds never
  reload the bundle; cold launches are clean.
- `pod install` on this machine needs a UTF-8 locale:
  `LANG=en_US.UTF-8 pod install` (only relevant for local `expo run:ios`).

## 8. Repo hygiene (optional, at your leisure)

- `repomix-output.xml` (340 KB) and `art/__pycache__/` are tracked but are
  build/debug artifacts — `git rm --cached` them and add to `.gitignore`.
- `assets/models/*.glb` (untracked, 304 KB) are referenced nowhere; keep or
  delete.
- Legacy unused assets: `assets/snake/body_normal.png`,
  `assets/snake/head_flick_0.png`, `assets/board/backdrop.png` (superseded by
  the per-skin `.webp` set) — not bundled (nothing `require()`s them), so they
  cost repo size only.
