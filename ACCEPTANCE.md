# Coil — Acceptance & Verification (Step 30)

Final integration pass. **No new game logic** — wiring verification, persistence,
gating, dead-code sweep, and a Definition-of-Done mapping.

- **Suite:** 31 test files · 203 tests · all green.
- **Typecheck:** `tsc --noEmit` clean (TypeScript strict).
- **Build/run:** Expo SDK 56 managed workflow; portrait-locked via `app.json`.
  Launch with `npx expo start` → iOS (`i`) / Android (`a`).

## 1. Entry, providers & navigation graph
- Root layout mounts `GestureHandlerRootView` + `SafeAreaProvider` + `SkinProvider`
  once and hydrates both stores on launch (defaults first, async) —
  [AppProviders.tsx](src/screens/AppProviders.tsx), verified by
  [navigation.test.tsx](__tests__/navigation.test.tsx).
- Portrait enforced at config level — [app.json](app.json) `"orientation": "portrait"`.
- Graph: Home→Game (tap→countdown→play→win/loss)→Play Again/Home, and Home↔Settings —
  [navigation.test.tsx](__tests__/navigation.test.tsx),
  [homeScreen.test.tsx](__tests__/homeScreen.test.tsx),
  [gameScreen.test.tsx](__tests__/gameScreen.test.tsx),
  [endScreens.test.tsx](__tests__/endScreens.test.tsx),
  [acceptance.test.tsx](__tests__/acceptance.test.tsx) (full loop).

## 2. Six preset × wall combinations
All of {CLASSIC, STANDARD, DENSE} × {SOLID, PORTAL} launch a valid game and score
the correct wall-specific best — [acceptance.test.tsx](__tests__/acceptance.test.tsx).

## 3. Persistence across relaunch
Re-create + re-hydrate stores from the same storage restores preset + wall +
toggles and both bests; corrupt/missing data degrades to defaults with no crash —
[acceptance.test.tsx](__tests__/acceptance.test.tsx),
[storageValidation.test.tsx](__tests__/storageValidation.test.ts),
[asyncStorageAdapter.test.tsx](__tests__/asyncStorageAdapter.test.ts).

## 4. Side-effect gating end to end
Haptics fire on eat/death only when the Haptics toggle is on; the silent sound
service is always invoked without error — [acceptance.test.tsx](__tests__/acceptance.test.tsx),
[gameController.test.tsx](__tests__/gameController.test.ts),
[ports.test.tsx](__tests__/ports.test.ts).

## 5. Lifecycle
Auto-pause on background, 3s resume countdown, countdown cancel on background,
Android back → pause (no silent forfeit) —
[useAppStatePause.test.tsx](__tests__/useAppStatePause.test.tsx),
[useCountdown.test.tsx](__tests__/useCountdown.test.tsx),
[gameScreen.test.tsx](__tests__/gameScreen.test.tsx).

## 6. Dead-code sweep
Reachability analysis from the six `app/` entrypoints: **0 orphans**. Every module
is wired — engine via `classicMode`/`GameController`, ports via controller/stores,
skin via renderers, `InputSource` via `SwipeInput` in `GameScreen`, `Mode` via
`GameScreen`.

## 7. E2E smoke
Optional Maestro flow home→play→die→play again→home — [.maestro/smoke.yaml](.maestro/smoke.yaml).

---

## Definition of Done (1–10)

| # | Item | Satisfied by |
|---|------|-------------|
| 1 | Booting Expo app, portrait, strict TS | app.json, tsconfig, `npx expo start` |
| 2 | Pure engine fully tested | engine/* + engine.integration.test |
| 3 | Deterministic, seeded engine | RandomPort + all engine tests |
| 4 | Persistence with corruption safety | StoragePort + asyncStorageAdapter + validation tests |
| 5 | Settings + scores stores | settingsStore / scoresStore tests |
| 6 | Skinned rendering (Skia) | Board/DynamicLayer/PresetPreview + render tests |
| 7 | Controller + single-timer loop | gameController / useGameLoop tests |
| 8 | Lifecycle (pause/countdown/back) | useAppStatePause / useCountdown / gameScreen tests |
| 9 | All screens wired | navigation / homeScreen / gameScreen / endScreens / settingsScreen |
| 10 | Acceptance: combos, relaunch, gating, full loop | acceptance.test.tsx |

## Functional / Error-handling coverage

| ID | Where |
|----|-------|
| FR-G1 (grid) | grid.test |
| FR-S1/S2 (tick, speed) | tick.test, speed.test |
| FR-D1/2/3/4 (movement, init) | tick.test, movement.test, createInitialState.test |
| FR-F1/2/3/4 (food/eat/win) | food.test, tick.test, engine.integration |
| FR-C1/2/3/4 (input/swipe) | input.test, swipeInput.test |
| FR-M2 (walls) | movement.test, tick.test |
| FR-SC1/3/4 (scoring/bests) | tick.test, scoresStore.test |
| FR-A3/4/5 (skin/settings) | skin.test, settingsScreen.test |
| FR-P2/3/4/5/6 (lifecycle/forfeit) | useAppStatePause, useCountdown, gameScreen, endScreens |
| FR-UI1/2/4/5 (screens) | homeScreen, endScreens, settingsScreen |
| EH-1 (corrupt data) | storageValidation, asyncStorageAdapter |
| EH-2/3 (write-failure resilience) | settingsStore, scoresStore |
| EH-4 (degenerate grid) | grid.test |
| EH-6 (countdown cancel) | useCountdown.test |
| EH-7 (single timer) | useGameLoop.test |
| EH-8 (full-grid spawn → win) | food.test, tick.test |
| EH-9/10 (haptics/sound safety) | ports.test |
| EH-11 (Android back) | gameScreen.test |
| EH-12/13 (render is pure projection) | render.test |

## Open Tuning Items (left at starting values)
- Preset tunables (`baseTickMs`/`minTickMs`/`accelMsPerFood`/`targetColumns`) —
  [presets.ts](src/engine/presets.ts).
- `SWIPE_THRESHOLD_PX = 30` — [InputSource.ts](src/input/InputSource.ts).
- Countdown = 3s; score bar height = 64px — [GameScreen.tsx](src/screens/GameScreen.tsx).
- Skin palette (`greenOnBlack`) — [greenOnBlack.ts](src/skins/greenOnBlack.ts).
