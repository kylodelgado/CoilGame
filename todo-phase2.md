# Coil — Phase 2 Build Checklist (`todo-phase2.md`)

A step-by-step checklist for building Coil's phase-2 features using `Coil_Phase2_Blueprint_and_Prompts.md`. Work top to bottom within a chunk. Each numbered step corresponds to one prompt in the phase-2 blueprint. Step numbers continue from the MVP (which ended at 30). **Sound is excluded from this phase by request.**

## How to use
- Do the steps **in order within a chunk**. Chunks H → I → L are recommended first (low risk, high feel), then J, then K; do M (GPS) as its own milestone last.
- Do not start a step while the test suite is red.
- The checkboxes under each step are the things easy to get wrong — they double as a coverage list.
- A step is **Done** only when: tests are green · `tsc --noEmit` is clean · the new code is wired in (no orphans) · it's committed.

## Standing rules for every step
- [ ] Write the tests **first** (they should fail before you implement).
- [ ] Implement the minimum to pass; keep TypeScript **strict** happy.
- [ ] Run `npx tsc --noEmit` → clean.
- [ ] Run the test suite in CI mode (`npm test`, non-watch) → green.
- [ ] Wire the new module into the system per the prompt's final instruction.
- [ ] Keep classic/fixed-board behavior **byte-identical** wherever a step adds an engine field (regression-guard it).
- [ ] Commit (one commit per step), e.g. `feat(skins): step 31 — skin registry`.

---

## Chunk H — Skins & selection

### Step 31 — Skin registry + additional skins
**Files:** `/src/skins/<newSkins>.ts`, `/src/skins/registry.ts`, `/src/skins/index.ts`, `__tests__/skinRegistry.test.ts`
- [ ] At least **three** new complete `Skin` objects beyond `greenOnBlack`, each visually distinct, each with `snakeHead` brighter than `snakeBody`.
- [ ] `registry.ts` exports `SkinId`, `SKIN_IDS`, `SKINS` (record), `getSkin(id)` (total; unknown → `greenOnBlack`).
- [ ] Test: `SKIN_IDS`/`SKINS` key sets match; each entry's `id` matches its key.
- [ ] Test: every skin has all `Skin` fields, correct types; `snakeHead !== snakeBody`.
- [ ] Test: `getSkin` returns the skin for a valid id and falls back for an unknown id.
- [ ] Renderers untouched (data-only step).
- [ ] **Done:** green · typecheck clean · committed.

### Step 32 — Persist skin selection (additive `skinId`)
**Files:** `/src/engine/types.ts`, `/src/services/StoragePort.ts`, `/src/state/useSettingsStore.ts`, extend `__tests__/storageValidation.test.ts` + `__tests__/settingsStore.test.ts`
- [ ] `PersistedSettings.skinId: SkinId`; `DEFAULT_SETTINGS.skinId = 'greenOnBlack'`.
- [ ] `validateSettings` accepts `skinId` only if in `SKIN_IDS`, else default. **`SETTINGS_KEY` stays `coil.settings.v1`** (additive).
- [ ] `setSkin(id)` action updates state + persists; in-memory kept on reject. *(EH-2)*
- [ ] Test: missing/invalid `skinId` → default; valid passes; existing settings cases still pass.
- [ ] Test: `setSkin` persists expected object; rejected write doesn't throw.
- [ ] **Done:** green · typecheck clean · committed.

### Step 33 — Skin-driven provider + Settings picker
**Files:** `/src/skins/SkinProvider.tsx`, `/src/screens/SettingsScreen.tsx`, `__tests__/skinProvider.test.tsx`, extend `__tests__/settingsScreen.test.tsx`
- [ ] Provider resolves active skin from the settings store via `getSkin(skinId)`; pre-hydration default `greenOnBlack`.
- [ ] Settings "Skin" section renders a swatch per `SKIN_IDS` (reuse mini-board), selection persists via `setSkin`.
- [ ] Test: `useSkin` returns the selected skin; changing `skinId` flips consumers' value.
- [ ] Test: picker shows one option per skin; tap calls `setSkin`; selection reflected.
- [ ] **Done:** green · typecheck clean · committed.

---

## Chunk I — Bonus food

### Step 34 — Engine: bonus food ⚠️ pure-engine change
**Files:** `/src/engine/types.ts`, `/src/engine/createInitialState.ts`, `/src/engine/food.ts`, `/src/engine/tick.ts`, `__tests__/bonus.test.ts`
- [ ] `GameState`: `bonusFood`, `bonusRemaining`, `ticksUntilBonus`. `GameConfig.bonus { enabled, spawnEveryTicks, lifetimeTicks, points }`. `GameEvent`: `'ATE_BONUS'`, `'BONUS_EXPIRED'`.
- [ ] `spawnFood` excludes the bonus cell; bonus spawn excludes snake + food. *(EH-19)*
- [ ] Bonus spawns after exactly `spawnEveryTicks`; expires after exactly `lifetimeTicks` (→ `BONUS_EXPIRED`).
- [ ] Eating bonus: `+points`, **no growth**, `ATE_BONUS`, clears bonus.
- [ ] **Regression:** with `bonus.enabled=false`, tick output identical to pre-bonus.
- [ ] Test: near-full grid skips bonus spawn (no crash); regular food still grows/scores; input never mutated.
- [ ] **Done:** green · typecheck clean · committed.

### Step 35 — Render bonus + dispatch + enable
**Files:** `/src/skins/Skin.ts` (+ all skins), `/src/render/DynamicLayer.tsx`, `/src/runtime/GameController.ts`, `/src/modes/classicMode.ts`, `/src/screens/GameScreen.tsx`, extend render/controller/registry tests
- [ ] `Skin` gains `bonusColor`, `bonusShape`; added to every skin; registry test updated.
- [ ] `DynamicLayer` draws `bonusFood` when non-null (distinct from food); pure projection; `bonusFood` threaded through GameScreen projection.
- [ ] Controller: `ATE_BONUS` → haptic only when enabled (both branches); `BONUS_EXPIRED` → no side effect; **no sound**.
- [ ] `classicMode.buildConfig` enables bonus with named tunables.
- [ ] Test: DynamicLayer renders with/without bonus; controller event branches; skins expose new tokens.
- [ ] **Done:** green · typecheck clean · committed.

---

## Chunk L — Polish (cheap)

### Step 36 — D-pad `InputSource` + control-scheme setting
**Files:** `/src/engine/types.ts`, `/src/services/StoragePort.ts`, `/src/state/useSettingsStore.ts`, `/src/input/DpadInput.tsx`, `/src/screens/SettingsScreen.tsx`, `/src/screens/GameScreen.tsx`, `__tests__/dpadInput.test.tsx`, extend storage/settings/gameScreen tests
- [ ] `PersistedSettings.controlScheme: 'SWIPE' | 'DPAD'` (default `'SWIPE'`, additive, settings stays v1).
- [ ] `DpadInput` implements `InputSource` (subscribe); arrow → `Direction`.
- [ ] Settings "Controls" toggle; GameScreen picks input by scheme; D-pad lives in chrome, **not over the grid**.
- [ ] Test: each arrow emits correct `Direction`; unsubscribe stops delivery; validation/persist; GameScreen routes by scheme.
- [ ] **Done:** green · typecheck clean · committed.

### Step 37 — Extended end-screen stats
**Files:** `/src/runtime/GameController.ts`, `/src/screens/WinScreen.tsx`, `/src/screens/LossScreen.tsx`, extend controller + endScreens tests
- [ ] Controller tracks elapsed run time via an **injected clock**, accumulating only while RUNNING (pause excluded).
- [ ] Terminal payload includes `{ score, isNewBest, foodEaten, length, elapsedMs }`.
- [ ] Win/Loss show food eaten, length, formatted time; score + high score remain primary.
- [ ] Test: paused time excluded; payload fields present; screens render stats; "New Best!" unchanged.
- [ ] **Done:** green · typecheck clean · committed.

---

## Chunk J — Dynamic Walls mode

### Step 38 — Engine obstacle support ⚠️ pure-engine change
**Files:** `/src/engine/types.ts`, `/src/engine/createInitialState.ts`, `/src/engine/food.ts`, `/src/engine/tick.ts`, `__tests__/obstacles.test.ts`
- [ ] `GameState.obstacles: Cell[]` (default `[]`).
- [ ] `spawnFood`/bonus spawn exclude obstacles. *(EH-18/19)*
- [ ] `tick`: head into obstacle → `DIED`/`LOST` in **both** wall behaviors; tail-follow unaffected.
- [ ] Win condition accounts for obstacles (full = no empty **non-obstacle** cell).
- [ ] **Regression:** with `obstacles=[]`, output identical to pre-obstacle.
- [ ] Test: obstacle death both modes; spawns avoid obstacles; win with obstacles; input never mutated.
- [ ] **Done:** green · typecheck clean · committed.

### Step 39 — `dynamicWallsMode` (obstacle scheduling)
**Files:** `/src/modes/dynamicWallsMode.ts`, `/src/modes/index.ts`, `__tests__/dynamicWallsMode.test.ts`
- [ ] Mode `id='DYNAMIC_WALLS'`; `buildConfig` = classic mapping + bonus enabled + mode-local `{ changeEveryTicks, maxObstacles, obstaclesPerChange }`.
- [ ] `tick` mutates obstacles immutably on schedule, then delegates to engine `tick`.
- [ ] Fair-spawn rules: never on snake/food/bonus/existing obstacle; **never on the head's next cell** *(EH-18)*; cap at `maxObstacles`; deterministic via rng.
- [ ] Registered in `MODES`.
- [ ] Test: schedule + no overlaps + no instant trap + cap + determinism + still kills on contact (delegation).
- [ ] **Done:** green · typecheck clean · committed.

### Step 40 — Mode selection on Home + scores migration to v2
**Files:** `/src/engine/types.ts`, `/src/services/StoragePort.ts`, `/src/services/asyncStorageAdapter.ts`, `/src/state/useScoresStore.ts`, `/src/state/useSettingsStore.ts`, `/src/screens/HomeScreen.tsx`, extend storage/adapter/scores/home tests
- [ ] `ModeId = 'CLASSIC' | 'DYNAMIC_WALLS'`; `PersistedSettings.modeId` (default `'CLASSIC'`, additive, settings v1).
- [ ] `PersistedScores` → `{ bests: Record<'MODE:WALL', number> }`; `SCORES_KEY = 'coil.scores.v2'`, `SCORES_KEY_V1` retained.
- [ ] `validateScores` for the record; `migrateScores(v1)` maps flat → `bests` (total, **idempotent**). *(EH-17)*
- [ ] Adapter: read v2; if absent, migrate v1 → write v2 → return; neither → defaults; corrupt → defaults, no throw.
- [ ] `recordRun(modeId, wall, score)` keys by `MODE:WALL`; `getBest(modeId, wall)` selector; `reset` clears.
- [ ] `setMode(id)` action; Home mode picker; shown high scores follow selected mode+wall; Play passes `modeId`.
- [ ] Test: validate/migrate/idempotent; adapter migration path; per-mode independence; home picker + score display + Play params.
- [ ] **Done:** green · typecheck clean · committed.

### Step 41 — Render obstacles + wire `dynamicWallsMode`
**Files:** `/src/skins/Skin.ts` (+ all skins), `/src/render/*`, `/src/modes/index.ts`, `/src/screens/GameScreen.tsx`, `/src/runtime/GameController.ts`, extend render/gameScreen/controller tests
- [ ] `Skin.obstacleColor` on every skin; registry test extended.
- [ ] Obstacles rendered (DynamicLayer or dedicated layer), pure projection; threaded through GameScreen state.
- [ ] `MODES` maps both modes; GameScreen selects mode by `modeId`; controller calls `recordRun(modeId, wall, score)` on terminal.
- [ ] Test: obstacles render; DYNAMIC_WALLS routes through its mode; terminal records under the DYNAMIC_WALLS key.
- [ ] **Done:** green · typecheck clean · committed.

---

## Chunk K — Firebase auth + online leaderboards

### Step 42 — `AuthPort` + `LeaderboardPort` + in-memory fakes
**Files:** `/src/services/AuthPort.ts`, `/src/services/LeaderboardPort.ts`, `__tests__/authFake.test.ts`, `__tests__/leaderboardFake.test.ts`
- [ ] `AuthPort` (`getCurrentUser`, `onAuthChange`, `signInAnonymously`, `signUp`, `signIn`, `signOut`) + `createInMemoryAuth()`.
- [ ] `LeaderboardPort` (`submitScore`, `getTopScores`, `getUserBest`) + `createInMemoryLeaderboard()`; board keyed by `mode+wall`.
- [ ] Ports independent of `StoragePort`.
- [ ] Test (auth fake): anonymous/named flows; `onAuthChange` fires + unsubscribes; `signOut` clears.
- [ ] Test (leaderboard fake): keeps user-best per board; `getTopScores` descending+limited+ranked; boards independent; `getUserBest` returns entry/null.
- [ ] **Done:** green · typecheck clean · committed.

### Step 43 — Firebase adapters (offline-safe)
**Files:** `/src/services/firebaseAuth.ts`, `/src/services/firebaseLeaderboard.ts`, app config (expo-constants extra), `__tests__/firebaseAdapters.test.ts`
- [ ] `createFirebaseAuth()` + `createFirebaseLeaderboard()` satisfy the interfaces; board path keyed `MODE:WALL`; one best doc per user.
- [ ] **Reads offline-safe:** `getTopScores`/`getUserBest` resolve `[]`/`null` on error (never reject into UI). *(EH-15)*
- [ ] `submitScore` writes only when beating stored best; may reject (submitter owns retry). *(EH-14)*
- [ ] Auth errors surface as rejections; failure leaves prior state. *(EH-16)*
- [ ] Config from env/app config; **no secrets in source**; note required Firestore security rules (server-side validation/rate-limit).
- [ ] Test (Firebase mocked): auth mapping + errors; submit-beats-best; read errors → `[]`/`null`.
- [ ] **Done:** green · typecheck clean · committed.

### Step 44 — Offline-safe submit on terminal
**Files:** `/src/services/submitScoreOnTerminal.ts`, wire in `/src/screens/GameScreen.tsx` (or controller `onTerminal`), `__tests__/scoreSubmit.test.ts`
- [ ] `createScoreSubmitter({ auth, leaderboard })` → `submit(board, score)` fire-and-forget, never throws.
- [ ] No user → no-op; user → `submitScore`; rejection swallowed (log `__DEV__` only); optional capped retry queue.
- [ ] Called **after** `recordRun` + `onTerminal`; never awaited on the UI path. *(EH-14)*
- [ ] Test: no-user no-op; user path submits right board+score; rejecting submit doesn't throw; local/terminal flow unaffected.
- [ ] **Done:** green · typecheck clean · committed.

### Step 45 — Auth UI + gating
**Files:** `/src/state/useAuthStore.ts`, `/src/screens/AccountScreen.tsx` (route `/account`), Home/Settings entry point, `__tests__/authUi.test.tsx`
- [ ] Auth store hydrates from `onAuthChange`; exposes sign up/in/anon/out + loading/error.
- [ ] Account screen: forms + "Continue anonymously" + current user + sign out; **auth errors are inline messages, not crashes**.
- [ ] Anonymous/local play remains first-class; leaderboard features gate on auth.
- [ ] Test: sign up/in success updates store; rejected sign-in shows error + stays signed out; anonymous; sign out clears.
- [ ] **Done:** green · typecheck clean · committed.

### Step 46 — Leaderboard screen
**Files:** `/src/screens/LeaderboardScreen.tsx` (route `/leaderboard`), Home entry point, `__tests__/leaderboardScreen.test.tsx`
- [ ] Board selector (mode + wall), default = current selection; `getTopScores(board, N)` + `getUserBest` when signed in.
- [ ] **States:** loading · empty (`[]`) · ranked list with current user highlighted · user-best pinned below when outside top N.
- [ ] Refresh; signed-out shows public board + sign-in prompt.
- [ ] Reads offline-safe (no crash on error). *(EH-15)*
- [ ] Test: ranked list; loading + empty states; highlight + pin; board change re-queries; signed-out prompt.
- [ ] **Done:** green · typecheck clean · committed.

---

## Chunk M — GPS / off-screen mode (own milestone, do last)

### Step 47 — World model
**Files:** `/src/engine/types.ts`, `/src/engine/world.ts`, `__tests__/world.test.ts`
- [ ] `WorldSpec`; optional `GameConfig.world`; world-based init + spawning in world coords; food may be far off-screen.
- [ ] GPS wall behavior defined explicitly (recommend SOLID world bounds) and tested.
- [ ] **Regression:** fixed-board modes unaffected.
- [ ] Test: valid world init near center; spawns avoid snake/obstacles + respect bounds; world step matches engine rules.
- [ ] **Done:** green · typecheck clean · committed.

### Step 48 — Camera/viewport + visible-window render
**Files:** `/src/render/camera.ts`, `/src/render/WorldBoard.tsx`, `/src/render/WorldDynamicLayer.tsx`, `__tests__/camera.test.ts`, `__tests__/worldRender.test.tsx`
- [ ] Pure `computeViewport` (clamped at world bounds) + `worldToScreen` (off-screen flag).
- [ ] World renderers draw only in-viewport cells via the transform, reading the skin; off-screen entities skipped.
- [ ] Test: viewport centers + clamps at edges; transform maps in-view + flags off-view; renderers mount; off-screen not drawn.
- [ ] **Done:** green · typecheck clean · committed.

### Step 49 — GPS HUD arrow
**Files:** `/src/render/gpsArrow.ts`, `/src/render/GpsArrow.tsx`, `__tests__/gpsArrow.test.ts`
- [ ] Pure `foodPointer` → `{ visible, angleRad }`; hidden when food in viewport; documented angle convention.
- [ ] Component renders rotated pointer when visible; color from skin.
- [ ] Test: hidden when in-view; right/left/up/down angles per convention; diagonal quadrant.
- [ ] **Done:** green · typecheck clean · committed.

### Step 50 — `gpsMode` + full wiring
**Files:** `/src/engine/types.ts`, `/src/modes/gpsMode.ts`, `/src/modes/index.ts`, `/src/screens/HomeScreen.tsx`, `/src/screens/GameScreen.tsx`, `__tests__/gpsMode.test.ts`, extend gameScreen tests
- [ ] `ModeId` adds `'GPS'`; `gpsMode` (world config + camera render + arrow + optional obstacles) registered in `MODES`.
- [ ] Home picker adds GPS; `modeId='GPS'` validates (settings v1 additive).
- [ ] GameScreen GPS path: viewport from device dims; WorldBoard/WorldDynamicLayer follow head; GpsArrow; same loop/lifecycle/countdown; terminal records `GPS:wall` + submits.
- [ ] Scoring/leaderboard already keyed by `mode:wall` — confirm GPS boards show on Home/end/leaderboard.
- [ ] Test: world config > viewport; delegation deterministic; GPS render + arrow when food off-screen; terminal records GPS key + submits.
- [ ] **Done:** green · typecheck clean · committed.

---

## New error-handling coverage (phase 2)
- [ ] EH-14 leaderboard **submit** failure → swallowed, fire-and-forget, never blocks terminal.
- [ ] EH-15 leaderboard **read** failure → resolves `[]`/`null`, UI shows empty/cached, no crash.
- [ ] EH-16 auth failure → message, prior state kept, local play intact.
- [ ] EH-17 scores v1→v2 migration lossless + idempotent.
- [ ] EH-18 obstacles never spawn on the head's next cell (no instant trap).
- [ ] EH-19 bonus/food/obstacles never overlap; bonus expires deterministically.

## Feature coverage (tick when verified by a test/screen)
- [ ] Skins: SKN-1 registry · SKN-2 persisted selection · SKN-3 provider+picker
- [ ] Bonus: BON-1 engine · BON-2 render/dispatch/enable
- [ ] Controls/Stats: CTRL-1 D-pad · STAT-1 end-screen stats
- [ ] Dynamic Walls: DYN-1 obstacles · DYN-2 mode · DYN-3 mode-select+scores-v2 · DYN-4 render+wire
- [ ] Social: LB-1 ports+fakes · LB-2 firebase adapters · LB-3 submit · LB-4 auth UI · LB-5 leaderboard screen
- [ ] GPS: GPS-1 world · GPS-2 camera · GPS-3 arrow · GPS-4 mode+wiring

## Regression guards (must stay green throughout)
- [ ] Classic play identical with bonus disabled and obstacles empty (engine regression suites).
- [ ] MVP six combinations (3 presets × Solid/Portal) still pass.
- [ ] Settings stays on `coil.settings.v1` (additive fields only); scores migrate cleanly to `coil.scores.v2`.
- [ ] Existing fixed-board modes unaffected by the world model.

## Phase-2 manual QA (on device)
- [ ] Each skin renders correctly across all presets; selection survives relaunch.
- [ ] Bonus food appears, times out, and scores without growing the snake.
- [ ] D-pad and swipe both playable; control choice persists; D-pad doesn't crowd the grid.
- [ ] Dynamic Walls: obstacles appear fairly (no instant traps); its high scores are separate.
- [ ] Leaderboard: submit while online; airplane-mode shows empty/cached without crashing; sign in/out works; anonymous play unaffected.
- [ ] GPS: camera follows head; arrow points to off-screen food and hides when visible; scores/leaderboard show GPS boards.
