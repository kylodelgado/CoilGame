# Coil — Build Checklist (`todo.md`)

A thorough, step-by-step checklist for building the *Coil* Snake MVP using `Coil_Build_Blueprint_and_Prompts.md`. Work top to bottom. Each numbered step corresponds to one prompt in the blueprint.

## How to use
- Do the steps **in order**. Do not start a step while the test suite is red.
- The checkboxes under each step are the things easy to get wrong — they double as a coverage list.
- A step is **Done** only when: tests are green · `tsc --noEmit` is clean · the new code is wired in (no orphans) · it's committed.

## Standing rules for every step
- [ ] Write the tests **first** (they should fail before you implement).
- [ ] Implement the minimum to pass; keep TypeScript **strict** happy.
- [ ] Run `npx tsc --noEmit` → clean.
- [ ] Run the test suite in CI mode (`npm test`, non-watch) → green.
- [ ] Wire the new module into the system per the prompt's final instruction.
- [ ] Commit (one commit per step), e.g. `feat(engine): step 10 — tick`.

---

## Phase 0 — Foundation

### Step 1 — Project scaffold & test harness
**Files:** Expo project root, `tsconfig.json`, `app.json`/`app.config`, `__tests__/harness.test.ts`, `/src/*` folders, `/app`
- [ ] Expo (managed) + TypeScript project initialized, expo-router configured.
- [ ] `tsconfig` has `"strict": true` and the project typechecks.
- [ ] Orientation locked to **portrait** at config level.
- [ ] Jest (jest-expo preset) + `@testing-library/react-native` installed and configured.
- [ ] `npm test` (CI/no-watch) and `npm run test:watch` scripts exist.
- [ ] Folder structure created: `engine, runtime, render, input, modes, skins, services, state, screens` + `/app` + `/__tests__`.
- [ ] Trivial `1 + 1 === 2` test passes (harness proven).
- [ ] **Done:** green · typecheck clean · committed.

### Step 2 — Core domain types & preset constants
**Files:** `/src/engine/types.ts`, `/src/engine/presets.ts`, `__tests__/presets.test.ts`
- [ ] `types.ts` exports all spec types: `Direction, WallBehavior, PresetId, GameStatus, Cell, GridSpec, Preset, GameConfig, GameState, PersistedSettings, PersistedScores, GameEvent, TickResult`.
- [ ] `types.ts` is **types only** (no runtime code).
- [ ] `presets.ts` exports `PRESETS` (CLASSIC/STANDARD/DENSE) + `POINTS_PER_FOOD = 10`, `START_LENGTH = 3`, `START_DIRECTION = 'RIGHT'`.
- [ ] Tests: every preset has `minTickMs < baseTickMs`, `accelMsPerFood > 0`, `targetColumns >= 6`; `POINTS_PER_FOOD === 10`.
- [ ] **Done:** green · typecheck clean · committed.

---

## Phase 1 — Pure engine (no React)

### Step 3 — Grid sizing (`computeGrid`)
**Files:** `/src/engine/grid.ts`, `__tests__/grid.test.ts`
- [ ] Exports `MIN_COLUMNS = 6`, `MIN_ROWS = 6`, `computeGrid(screenWidth, playAreaHeight, targetColumns): GridSpec`.
- [ ] Test: cells are square; `cellSize >= 1`.
- [ ] Test: fills width (leftover `< cellSize`).
- [ ] Test: rows never exceed `playAreaHeight`.
- [ ] Test: tiny screen clamps to MIN_COLUMNS/MIN_ROWS (never 0). *(EH-4)*
- [ ] Test: `originX`/`originY` non-negative and centered.
- [ ] Test: larger `targetColumns` → smaller `cellSize`.
- [ ] **Done:** green · typecheck clean · committed.

### Step 4 — Seedable `RandomPort`
**Files:** `/src/services/RandomPort.ts`, `__tests__/random.test.ts`
- [ ] Exports `RandomPort` interface (`next()`, `nextInt(maxExclusive)`), `createSeededRandom(seed)`, `createMathRandom()`.
- [ ] Test: same seed → identical sequence.
- [ ] Test: different seeds → different sequences.
- [ ] Test: `nextInt(n)` always in `[0, n)`; `createMathRandom().next()` in `[0, 1)`.
- [ ] **Done:** green · typecheck clean · committed.

### Step 5 — Speed curve (`computeTickMs`)
**Files:** `/src/engine/speed.ts`, `__tests__/speed.test.ts`
- [ ] Exports `computeTickMs(base, min, accel, foodEaten)`.
- [ ] Test: `foodEaten = 0` → `base`.
- [ ] Test: decreases by `accel` per food.
- [ ] Test: clamps at exactly `min`, never lower.
- [ ] Test: monotonic non-increasing. *(FR-S2)*
- [ ] **Done:** green · typecheck clean · committed.

### Step 6 — Food spawning (`spawnFood`)
**Files:** `/src/engine/food.ts`, `__tests__/food.test.ts`
- [ ] Exports `spawnFood(state, config, rng): Cell | null` using **empty-cell enumeration** (no guess-and-retry).
- [ ] Test: never on a snake cell (many seeds / layouts).
- [ ] Test: always in bounds.
- [ ] Test: one-empty-cell grid returns that exact cell.
- [ ] Test: fully occupied grid returns `null`. *(EH-8 / FR-F4)*
- [ ] Test: deterministic with seeded rng.
- [ ] **Done:** green · typecheck clean · committed.

### Step 7 — Input queue (`enqueueDirection`)
**Files:** `/src/engine/input.ts`, `__tests__/input.test.ts`
- [ ] Exports `enqueueDirection(state, dir): GameState` (immutable).
- [ ] Test: reversal vs committed heading ignored. *(FR-C2)*
- [ ] Test: reversal vs **last queued** direction ignored.
- [ ] Test: duplicate of reference ignored (no-op guard).
- [ ] Test: queue caps at 2; third dropped. *(FR-C3)*
- [ ] Test: chain RIGHT → UP → LEFT both accepted (queue `[UP, LEFT]`).
- [ ] Test: input state never mutated.
- [ ] **Done:** green · typecheck clean · committed.

### Step 8 — Initial state (`createInitialState`)
**Files:** `/src/engine/createInitialState.ts`, `__tests__/createInitialState.test.ts`
- [ ] Exports `createInitialState(config, rng): GameState`.
- [ ] Test: snake length `startLength`, all in bounds.
- [ ] Test: head is rightmost of 3 contiguous horizontal cells; `snake[0]` is head. *(FR-D4)*
- [ ] Test: centered; `direction = 'RIGHT'`; queue empty; score 0; foodEaten 0; `tickMs = baseTickMs`.
- [ ] Test: food non-null and not on snake.
- [ ] Test: `status = 'TAP_TO_START'`.
- [ ] **Done:** green · typecheck clean · committed.

### Step 9 — Movement helpers (`computeNextHead` + wall resolution)
**Files:** `/src/engine/movement.ts`, `__tests__/movement.test.ts`
- [ ] Exports `computeNextHead(head, dir)` and `resolveWall(rawHead, grid, wall): WallResult`.
- [ ] Test: head moves one cell in each of 4 directions.
- [ ] Test: PORTAL wraps on each of the 4 edges (negatives handled). *(FR-D2/M2)*
- [ ] Test: SOLID flags OUT_OF_BOUNDS off each edge; IN_BOUNDS interior.
- [ ] **Done:** green · typecheck clean · committed.

### Step 10 — The `tick` (full step + events) ⚠️ highest-risk
**Files:** `/src/engine/tick.ts`, `__tests__/tick.test.ts`
- [ ] Exports `tick(state, config, rng): TickResult` (reuses movement/speed/food).
- [ ] Test: queued direction committed before move; head advances one cell.
- [ ] Test: non-eating tick keeps length constant (tail pops).
- [ ] Test: eating grows by 1, `+10` score, `foodEaten++`, new food spawns, `tickMs` decreases.
- [ ] Test: **tail-follow is safe** (head into vacated tail cell does not kill). *(FR-D3)*
- [ ] Test: self-collision into body is fatal (`DIED`/`LOST`). *(FR-D1)*
- [ ] Test: SOLID out-of-bounds → `DIED`/`LOST` on each edge. *(FR-D2)*
- [ ] Test: PORTAL wraps and survives on each edge.
- [ ] Test: full-grid fill → `WON` + `spawnFood` returned `null`. *(FR-F4/EH-8)*
- [ ] Test: `tickMs` never below `minTickMs`.
- [ ] Test: events array exact (`['ATE_FOOD']`, `['DIED']`, includes `'WON'`).
- [ ] Test: input state never mutated.
- [ ] **Done:** green · typecheck clean · committed.

### Step 11 — Engine barrel + scripted full-game integration
**Files:** `/src/engine/index.ts`, `__tests__/engine.integration.test.ts`
- [ ] `index.ts` re-exports the public engine API.
- [ ] Integration: tiny grid + seeded rng; scripted run reaches several eats and a `WON`.
- [ ] Asserts throughout: `score === foodEaten * 10`; `length === startLength + foodEaten`; no self-overlap while alive; food never on snake; `tickMs` non-increasing & `>= minTickMs`.
- [ ] Asserts a second scripted run ends in `LOST` (wall, SOLID) with `DIED`.
- [ ] ✅ **Engine ruleset complete and proven without UI.**
- [ ] **Done:** green · typecheck clean · committed.

---

## Phase 2 — Infrastructure (interfaces + adapters)

### Step 12 — `StoragePort` + defaults + pure validators
**Files:** `/src/services/StoragePort.ts`, `__tests__/storageValidation.test.ts`
- [ ] Exports `StoragePort` interface, `DEFAULT_SETTINGS`, `DEFAULT_SCORES`, `SETTINGS_KEY = 'coil.settings.v1'`, `SCORES_KEY = 'coil.scores.v1'`, `validateSettings`, `validateScores`.
- [ ] Test: well-formed settings/scores pass through unchanged.
- [ ] Test: missing keys / wrong types / bad enums fall back field-by-field. *(EH-1)*
- [ ] Test: negative / NaN / non-integer scores → 0.
- [ ] Test: null/string/array input → full defaults; validators never throw.
- [ ] **Done:** green · typecheck clean · committed.

### Step 13 — AsyncStorage adapter
**Files:** `/src/services/asyncStorageAdapter.ts`, `__tests__/asyncStorageAdapter.test.ts`
- [ ] Exports `createAsyncStorageAdapter(): StoragePort` (installs `@react-native-async-storage/async-storage`).
- [ ] Test (mocked storage): round-trip settings and scores → identical objects.
- [ ] Test: corrupt JSON → defaults, no throw.
- [ ] Test: missing key → defaults.
- [ ] Test: bad enum / negative score persisted → sanitized on read.
- [ ] Test: `resetScores` writes `DEFAULT_SCORES`.
- [ ] Reads never throw into caller.
- [ ] **Done:** green · typecheck clean · committed.

### Step 14 — `HapticsPort` + `SoundPort`
**Files:** `/src/services/HapticsPort.ts`, `/src/services/SoundPort.ts`, `__tests__/ports.test.ts`
- [ ] `HapticsPort` (`eat`, `death`) + `createExpoHaptics()` with try/catch around every call. *(EH-9)*
- [ ] `SoundPort` (`play`, `preload`) + `createSilentSound()` no-op. *(EH-10)*
- [ ] Test: haptics calls never throw even when expo-haptics mock throws.
- [ ] Test: haptics invoke expo-haptics when the mock succeeds.
- [ ] Test: silent sound `play`/`preload` never throw for any `GameEvent`.
- [ ] No toggle logic here (controller gates it).
- [ ] **Done:** green · typecheck clean · committed.

---

## Phase 3 — State, skin, mode

### Step 15 — Settings store (Zustand + storage)
**Files:** `/src/state/useSettingsStore.ts`, `__tests__/settingsStore.test.ts`
- [ ] State `{ presetId, wallBehavior, soundEnabled, hapticsEnabled, hydrated }`; actions `hydrate, setPreset, setWall, setSound, setHaptics`.
- [ ] Renders `DEFAULT_SETTINGS` before hydrate (`hydrated=false`). *(NFR-3)*
- [ ] Test: hydrate loads persisted values, flips `hydrated`.
- [ ] Test: each setter updates state + calls `storage.setSettings`.
- [ ] Test: rejected `setSettings` doesn't throw; in-memory value kept. *(EH-2)*
- [ ] StoragePort injected (mockable); no direct AsyncStorage import.
- [ ] **Done:** green · typecheck clean · committed.

### Step 16 — Scores store (Zustand + record-run logic)
**Files:** `/src/state/useScoresStore.ts`, `__tests__/scoresStore.test.ts`
- [ ] State `{ bestSolid, bestPortal, hydrated }`; actions `hydrate, recordRun(wall, score), reset`.
- [ ] Test: higher SOLID score updates `bestSolid` only, returns `isNewBest: true`, persists. *(FR-SC3)*
- [ ] Test: below-best score updates nothing, returns `isNewBest: false`.
- [ ] Test: SOLID/PORTAL tracked independently.
- [ ] Test: in-memory best updates even if `setScores` rejects. *(EH-3)*
- [ ] Test: `reset` zeroes both + calls `resetScores`.
- [ ] Forfeits/quits never call `recordRun` (caller contract). *(FR-SC4)*
- [ ] **Done:** green · typecheck clean · committed.

### Step 17 — Skin system
**Files:** `/src/skins/Skin.ts`, `/src/skins/greenOnBlack.ts`, `/src/skins/SkinProvider.tsx`, `__tests__/skin.test.tsx`
- [ ] `Skin` interface (`background, gridLine, cellGap, cellShape, snakeHead, snakeBody, foodColor, foodShape`).
- [ ] `greenOnBlack` skin: black bg, head brighter than body, square cells + small gap, faint/no grid lines. *(FR-A4/A5)*
- [ ] `SkinProvider` + `useSkin()` hook defaulting to `greenOnBlack`.
- [ ] Test: `useSkin` returns tokens inside provider.
- [ ] Test: `snakeHead !== snakeBody` (head brighter).
- [ ] **Done:** green · typecheck clean · committed.

### Step 18 — `Mode` + `classicMode`
**Files:** `/src/modes/Mode.ts`, `/src/modes/classicMode.ts`, `__tests__/classicMode.test.ts`
- [ ] `Mode` interface (`buildConfig, createInitialState, tick`).
- [ ] `classicMode` builds `GameConfig` from grid + wall + preset; delegates rules to engine.
- [ ] Test: `buildConfig` maps preset tunables + wall; `pointsPerFood 10`, `startLength 3`, `startDirection 'RIGHT'`.
- [ ] Test: `createInitialState`/`tick` match engine output (delegation, not reimplementation).
- [ ] **Done:** green · typecheck clean · committed.

---

## Phase 4 — Runtime glue (React)

### Step 19 — `GameController` ⚠️ high-risk
**Files:** `/src/runtime/GameController.ts`, `__tests__/gameController.test.ts`
- [ ] `createGameController(deps)` with `getState, tapToStart, setRunning, enqueue, step, pause, resume, restart, quit`.
- [ ] Authoritative state in a **ref/closure**, not React state.
- [ ] Test: `enqueue` routes to engine (committed direction changes next step).
- [ ] Test: `step` advances state + calls `onState`.
- [ ] Test: `ATE_FOOD` fires `haptics.eat` only when enabled (both branches); always `sound.play('ATE_FOOD')`.
- [ ] Test: reaching `LOST`/`WON` calls `recordRun` once + `onTerminal` with score & isNewBest.
- [ ] Test: `quit()` does **not** call `recordRun`. *(FR-P6)*
- [ ] Test: `tapToStart` → COUNTDOWN (no motion); `setRunning` → RUNNING; `restart` → fresh TAP_TO_START.
- [ ] **Done:** green · typecheck clean · committed.

### Step 20 — `useGameLoop` ⚠️ high-risk
**Files:** `/src/runtime/useGameLoop.ts`, `__tests__/useGameLoop.test.tsx`
- [ ] Self-rescheduling `setTimeout` reading **current** `tickMs` each step; timer id in a ref.
- [ ] Clears before scheduling and on unmount; only schedules while RUNNING.
- [ ] Test (fake timers): advancing `tickMs` invokes `step()` once per interval.
- [ ] Test: changed `tickMs` shortens/lengthens the next delay (accel applies immediately).
- [ ] Test: PAUSED / `isRunning=false` stops further `step()`.
- [ ] Test: unmount clears timer (no `step()` after).
- [ ] Test: single-timer invariant holds under rapid toggles. *(EH-7)*
- [ ] **Done:** green · typecheck clean · committed.

### Step 21 — `useAppStatePause` + `useCountdown`
**Files:** `/src/runtime/useAppStatePause.ts`, `/src/runtime/useCountdown.ts`, `__tests__/useAppStatePause.test.tsx`, `__tests__/useCountdown.test.tsx`
- [ ] `useAppStatePause`: background/inactive while RUNNING → `controller.pause()`; unsubscribe on unmount. *(FR-P2)*
- [ ] `useCountdown`: 3→2→1 then `onComplete`; cancels if `active` flips false; single timer cleared on unmount. *(FR-P4/EH-6)*
- [ ] Test: background while RUNNING calls `pause`; while PAUSED does nothing.
- [ ] Test: countdown completes → `onComplete`; cancel mid-count → `onComplete` NOT called.
- [ ] **Done:** green · typecheck clean · committed.

---

## Phase 5 — Rendering & gestures

### Step 22 — `Board` + `DynamicLayer` (Skia)
**Files:** `/src/render/Board.tsx`, `/src/render/DynamicLayer.tsx`, `__tests__/render.test.tsx` (installs `@shopify/react-native-skia`)
- [ ] `Board` draws static grid (bg, gridlines/null, cellGap, cellShape) from `gridSpec` + skin; memoizable.
- [ ] `DynamicLayer` draws snake (head brighter) + food from passed state each render.
- [ ] All visuals via `useSkin` — **no hard-coded colors**.
- [ ] Test: both mount without crashing inside `SkinProvider`.
- [ ] Test: handles `food === null` and varying snake lengths.
- [ ] Test: rendering does not mutate passed state (frozen snake array).
- [ ] **Done:** green · typecheck clean · committed.

### Step 23 — `SwipeInput` + `InputSource`
**Files:** `/src/input/InputSource.ts`, `/src/input/SwipeInput.tsx`, `__tests__/swipeInput.test.ts` (installs `react-native-gesture-handler`)
- [ ] `InputSource` interface (`subscribe`), `SWIPE_THRESHOLD_PX = 30`, pure `translationToDirection(dx, dy, threshold)`.
- [ ] `SwipeInput` wraps a Pan gesture and emits `Direction` to the GameScreen; satisfies `InputSource`.
- [ ] Test: clear right/left/up/down map correctly.
- [ ] Test: sub-threshold → `null`. *(FR-C4)*
- [ ] Test: diagonal picks dominant axis.
- [ ] Test: exactly-at-threshold registers (`>=`).
- [ ] **Done:** green · typecheck clean · committed.

### Step 24 — `PresetPreview`
**Files:** `/src/render/PresetPreview.tsx`, `__tests__/presetPreview.test.tsx`
- [ ] Reuses `computeGrid` + `useSkin` scaled into a box; shows sample snake + food; `selected` highlight.
- [ ] Test: renders for CLASSIC/STANDARD/DENSE.
- [ ] Test: DENSE columns > CLASSIC columns at same box size (density reflected). *(FR-G4)*
- [ ] Test: selected styling differs from unselected.
- [ ] **Done:** green · typecheck clean · committed.

---

## Phase 6 — Screens & wiring

### Step 25 — Router scaffold, providers & portrait lock
**Files:** `/app/_layout.tsx`, `/app/index.tsx`, `/app/game.tsx`, `/app/settings.tsx`, `__tests__/navigation.test.tsx`
- [ ] Root wraps app in `GestureHandlerRootView` + `SkinProvider`.
- [ ] On mount: inject AsyncStorage adapter into both stores + call `hydrate()` (defaults first, async). *(NFR-3)*
- [ ] Portrait enforced; stack routes `index/game/settings` (+ win/loss choice).
- [ ] **DECISION recorded:** Win/Loss as routes vs overlays; preset via params vs store.
- [ ] Test: Home stub renders; Play affordance navigates; hydration triggered on mount.
- [ ] **Done:** green · typecheck clean · committed.

### Step 26 — `HomeScreen` (selection flow)
**Files:** `/src/screens/HomeScreen.tsx`, `__tests__/homeScreen.test.tsx`
- [ ] 3 `PresetPreview`s; selecting highlights + updates store but **does not navigate**. *(FR-UI2)*
- [ ] Solid/Portal wall toggle bound to store; both high scores shown. *(FR-UI1)*
- [ ] Play navigates to `/game` with selected preset + wall; gear → `/settings`.
- [ ] Test: select highlights, no navigation; Play navigates with params; scores render; wall toggle updates store.
- [ ] **Done:** green · typecheck clean · committed.

### Step 27 — `GameScreen` (full composition) ⚠️ central integration
**Files:** `/src/screens/GameScreen.tsx`, `__tests__/gameScreen.test.tsx`
- [ ] Computes grid from `useWindowDimensions` + safe-area; rebuilds on dimension change.
- [ ] Builds config via `classicMode`; creates `GameController` with all injected deps (rng, haptics, sound, toggles, recordRun, onState, onTerminal).
- [ ] Wires `useGameLoop` + `useAppStatePause` + `useCountdown`.
- [ ] Renders `Board` + `DynamicLayer` + score HUD + corner pause button; `SwipeInput` overlay → `enqueue`.
- [ ] Tap-to-start overlay (status TAP_TO_START); countdown overlay (3·2·1); board stays visible. *(FR-P5/D5)*
- [ ] Android hardware back intercepts → pause/quit (no silent forfeit). *(EH-11)*
- [ ] On terminal → navigate to Win/Loss with score + isNewBest + settings.
- [ ] Test: tap → COUNTDOWN; countdown done → RUNNING + loop advances; eating updates HUD; pause stops loop; back opens pause (no pop); terminal navigates.
- [ ] **Done:** green · typecheck clean · committed.

### Step 28 — `PauseOverlay` + `WinScreen` + `LossScreen`
**Files:** `/src/screens/PauseOverlay.tsx`, `/src/screens/WinScreen.tsx`, `/src/screens/LossScreen.tsx`, `__tests__/endScreens.test.tsx`
- [ ] Pause actions: Resume → `resume` (countdown); Restart → `restart`; Quit → `quit` + Home, **no score saved**. *(FR-P3/P6)*
- [ ] Win/Loss show final score + relevant high score; "New Best!" only when `isNewBest`. *(FR-UI4)*
- [ ] Win shows "Perfect!" framing; Play Again reuses same preset + wall; Home returns.
- [ ] Test: pause actions call correct controller methods; Quit doesn't `recordRun`.
- [ ] Test: final + high score render; "New Best!" both branches; Play Again same settings.
- [ ] **Done:** green · typecheck clean · committed.

### Step 29 — `SettingsScreen`
**Files:** `/src/screens/SettingsScreen.tsx`, `__tests__/settingsScreen.test.tsx`
- [ ] Independent Sound + Haptics toggles (persist via store). *(FR-A3/UI5)*
- [ ] Reset High Scores behind a **confirm dialog** → `reset`; Cancel no-ops.
- [ ] About/version (from expo-constants); back to Home.
- [ ] Test: toggles update + persist independently; reset requires confirm then clears both; version renders.
- [ ] **Done:** green · typecheck clean · committed.

### Step 30 — Final integration & acceptance pass
**Files:** glue + `__tests__/acceptance.test.tsx` + `PROGRESS.md` + (optional) Maestro flow
- [ ] Root providers + hydration + portrait confirmed; full nav graph works.
- [ ] All 3 presets × {Solid, Portal} (6 combos) launch and play; correct wall-specific best updates.
- [ ] Relaunch round-trip: settings (preset + wall + toggles) and both high scores restored; corrupt/missing → defaults, no crash.
- [ ] Haptics gated by toggle end-to-end; silent sound invoked without errors.
- [ ] Lifecycle: auto-pause, 3s countdown, countdown-cancel-on-background, Android back → pause/quit verified.
- [ ] **Dead-code sweep:** every module imported and used (engine via controller, ports via controller/stores, skin via renderers, InputSource via SwipeInput, Mode via GameScreen).
- [ ] Optional Maestro smoke: home → play → die → play again → home.
- [ ] DoD + FR/EH coverage checklist produced.
- [ ] **Done:** green · typecheck clean · committed.

---

## Definition of Done (spec §12) — verify before shipping
- [ ] 1. All FR-* in §3 implemented and passing their mapped tests.
- [ ] 2. All six preset×wall combos playable end-to-end (tap → play → win/loss → again/home).
- [ ] 3. High scores persist per wall behavior, survive relaunch; reset works behind confirm.
- [ ] 4. Last-used settings persist and restore on relaunch.
- [ ] 5. Pause (manual + auto) and 3s resume countdown correct; no double-timer/desync.
- [ ] 6. Haptics fire on eat/death (when enabled); audio service wired + silent without errors.
- [ ] 7. Single green-on-black skin renders **through** the skin system; head brighter than body.
- [ ] 8. No crashes across §11.3 lifecycle scenarios; corrupt/missing storage → defaults.
- [ ] 9. Dense preset meets the performance bar on a low-end device.
- [ ] 10. Builds install and run on both Android and iOS via Expo.

## Functional requirement coverage (tick when verified by a test/screen)
- [ ] Grid: FR-G1 · FR-G2 · FR-G3 · FR-G4
- [ ] Controls: FR-C1 · FR-C2 · FR-C3 · FR-C4 · FR-C5
- [ ] Speed: FR-S1 · FR-S2 · FR-S3
- [ ] Mode/Walls: FR-M1 · FR-M2
- [ ] Scoring: FR-SC1 · FR-SC2 · FR-SC3 · FR-SC4
- [ ] Food: FR-F1 · FR-F2 · FR-F3 · FR-F4
- [ ] Death/Start: FR-D1 · FR-D2 · FR-D3 · FR-D4 · FR-D5
- [ ] Pause: FR-P1 · FR-P2 · FR-P3 · FR-P4 · FR-P5 · FR-P6
- [ ] Screens: FR-UI1 · FR-UI2 · FR-UI3 · FR-UI4 · FR-UI5
- [ ] Audio/Haptics/Skin: FR-A1 · FR-A2 · FR-A3 · FR-A4 · FR-A5
- [ ] Persistence: FR-PS1 · FR-PS2 · FR-PS3

## Error-handling coverage (spec §9)
- [ ] EH-1 corrupt storage → defaults
- [ ] EH-2 storage write fails → in-memory kept
- [ ] EH-3 high-score write fails mid-session → "New Best!" still shown, persist later
- [ ] EH-4 degenerate grid clamped
- [ ] EH-5 gesture noise / 30px threshold + guards
- [ ] EH-6 background during COUNTDOWN cancels, stays PAUSED
- [ ] EH-7 single-timer invariant
- [ ] EH-8 food spawn on near-full grid (enumeration; null = win)
- [ ] EH-9 haptics unsupported → no-op
- [ ] EH-10 audio asset missing → guarded no-op
- [ ] EH-11 Android back → pause/quit, no silent forfeit
- [ ] EH-12 Skia surface lost → re-render static layer
- [ ] EH-13 state/render desync → engine is source of truth

## Phase-2 hooks present (architecture accommodates)
- [ ] `InputSource` lets a D-pad drop in without touching the engine.
- [ ] `Mode` lets dynamic-walls / GPS modes drop in.
- [ ] `Skin` + provider lets new skins + selection UI drop in.
- [ ] `SoundPort` trigger points let real SFX/music swap in.
- [ ] `StoragePort` lets a Firebase/composite adapter drop in.
- [ ] Versioned keys (`.v1`) leave a migration path.

## Manual QA matrix (spec §11.3) — on device
- [ ] Small + large phone, each OS; one notch/safe-area device.
- [ ] All 6 preset×wall combos playable and correct.
- [ ] Win path achievable on Classic; "Perfect!" shows.
- [ ] Lifecycle: background mid-run, incoming call, lock/unlock, app switch — all auto-pause + resume.
- [ ] Android hardware back never silently forfeits.
- [ ] Haptics fire on eat/death when enabled; silent when disabled.
- [ ] Force-quit + relaunch restores settings + high scores.
- [ ] Sound toggle present/functional; no crashes from silent audio.