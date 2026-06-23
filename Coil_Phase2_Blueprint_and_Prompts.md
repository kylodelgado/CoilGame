# Coil — Phase 2 Blueprint & TDD Code-Generation Prompts

A continuation of the MVP build plan, in the same style and discipline. It adds the deferred features the MVP was architected for, using the four seams (`InputSource`, `Mode`, `Skin`, `StoragePort`) plus two new ports introduced here (`AuthPort`, `LeaderboardPort`). Every prompt is test-driven, builds on the prior one, and ends by wiring its output into the running app so nothing is orphaned. **Sound is intentionally excluded from this phase per the product owner.**

Step numbering continues from the MVP (which ended at step 30), so commits, branches, and the todo stay on one sequence.

---

## How to use this document

1. Read the **Phase 2 orientation** and **Recommended sequencing** first.
2. Work the **Prompts** in sequence within a chunk. Each is in a `text` code block — paste it into your codegen LLM as-is.
3. Each prompt assumes everything from the MVP (steps 1–30) and all prior phase-2 steps exists and passes.
4. After each prompt, run the suite. A step is "done" only when its tests are green, `tsc --noEmit` is clean, the new code is wired in, and it's committed.

The same honesty rule applies: **if a step produces code that nothing tests and nothing calls, it isn't finished.**

---

## 1. Phase 2 orientation

### 1.1 What we're adding (and which seam it rides)

| Chunk | Feature | Primary seam(s) | Risk |
|-------|---------|-----------------|------|
| **H** | More skins + skin selection UI | `Skin` (+ a small additive `PersistedSettings` field) | Low |
| **I** | Bonus food | **Engine** (pure) + `Skin` token | Medium (pure-engine change) |
| **J** | Dynamic Walls mode | `Mode` + **Engine** obstacle support + scores migration | High (engine + persistence shape change) |
| **K** | Firebase auth + online leaderboards | new `AuthPort`, `LeaderboardPort` | High (network, async, offline) |
| **L** | D-pad + extended end-screen stats | `InputSource` + small engine tracking | Low |
| **M** | GPS / off-screen mode | `Mode` + a new world/viewport rendering model | Highest (own milestone) |

### 1.2 Two new architectural notes the seams don't fully cover

The MVP seams make most of this cheap, but two features need genuine inner-layer extensions, not just a new implementation of an existing interface — call these out so they're not mistaken for drop-ins:

- **Bonus food and Dynamic Walls both extend `GameState`.** Bonus food adds a `bonusFood`/timer field; Dynamic Walls adds an `obstacles` field. The `Mode` seam routes *which* rules run, but the **pure engine's state shape and collision/spawn logic** must grow to know about bonus food and obstacles. Keep classic behavior byte-identical when those fields are empty/disabled (regression-guard it).
- **Adding a second mode changes the scoring key space.** The MVP stores a flat `{ bestSolid, bestPortal }`. A second mode makes that ambiguous, so scores migrate from `coil.scores.v1` (flat) to `coil.scores.v2` (a `bests` record keyed `MODE:WALL`). This is the migration the versioned keys were designed for. By contrast, the additive `PersistedSettings` fields (`skinId`, `modeId`, `controlScheme`) stay on `coil.settings.v1` because the existing per-field validator already defaults missing fields — additive fields need no key bump; a shape change does.

### 1.3 New ports (introduced with their first consumer, like the MVP)

- **`AuthPort`** — `signInAnonymously`, `signUp`, `signIn`, `signOut`, `getCurrentUser`, `onAuthChange`. MVP-of-phase-2 impl: a Firebase adapter; an in-memory fake for tests.
- **`LeaderboardPort`** — `submitScore`, `getTopScores`, `getUserBest`. Firebase adapter + in-memory fake. Kept **separate** from `StoragePort` (local persistence) on purpose: local bests and global ranking are different concerns. `StoragePort` can still gain a remote-sync adapter later without entangling leaderboards.

### 1.4 Recommended sequencing

Do **H → I → L** first: they are low-risk, high-feel wins that don't touch persistence shape or the network, and they make the game feel more finished. Then **J** (depth, but it migrates scores) and **K** (the social bet). Treat **M (GPS)** as its own milestone after the rest is stable — it introduces a world-larger-than-screen rendering model that is materially different from the fixed-board renderer and deserves a dedicated pass.

---

## 2. Chunks → steps

**Chunk H — Skins & selection**
31. Skin registry + additional skins.
32. Persist skin selection (additive `skinId` + validator + store).
33. Skin-driven provider + Settings skin picker.

**Chunk I — Bonus food**
34. Engine: bonus food (state, spawn/expiry, scoring, event).
35. Render bonus + dispatch event + wire into config.

**Chunk L — Polish (cheap; safe to slot here)**
36. D-pad `InputSource` + control-scheme setting.
37. Extended end-screen stats (length, time, food).

**Chunk J — Dynamic Walls mode**
38. Engine obstacle support (state + collision + spawn exclusion).
39. `dynamicWallsMode` (obstacle scheduling) + registry.
40. Mode selection on Home + scores migration to v2 (`MODE:WALL`).
41. Render obstacles + wire `dynamicWallsMode` into the Game screen.

**Chunk K — Firebase auth + online leaderboards**
42. `AuthPort` + `LeaderboardPort` interfaces + in-memory fakes.
43. Firebase adapters (auth + leaderboard) with offline-safe error handling.
44. Offline-safe score submission on terminal.
45. Auth UI (sign up / in / anonymous / out) + auth-state gating.
46. Leaderboard screen (top N per mode×wall) + states.

**Chunk M — GPS / off-screen mode (own milestone)**
47. World model (world larger than viewport; world coords).
48. Camera/viewport transform + visible-window rendering.
49. GPS HUD arrow (off-screen food pointer).
50. `gpsMode` + wiring into mode routing, scoring, and leaderboards.

---

## 3. The Prompts

Test-first is mandatory in every step. Each prompt assumes all earlier steps exist and pass.

---

### Prompt 31 — Skin registry + additional skins

Context: The MVP shipped one skin *through* the skin system. Now we add more skins and a registry so a selection UI and the validator have a single source of truth. No rendering changes are needed because `Board`/`DynamicLayer`/`PresetPreview` already read every token from `useSkin`.

```text
Add a skin registry and several new skins to Coil. Renderers already consume tokens via useSkin, so this step adds data only — no renderer changes. Write the registry tests first, then implement.

Files:
- /src/skins/<newSkins>.ts — add at least THREE new Skin objects beyond greenOnBlack, each a complete Skin (all tokens present), visually distinct, and each with snakeHead visibly brighter than snakeBody. Suggested: 'amberCrt' (amber-on-black CRT), 'monoLcd' (dark-on-grey Game Boy LCD), 'neon' (bright accents on near-black). Pick real, documented hex values.
- /src/skins/registry.ts — export:
    type SkinId = 'greenOnBlack' | 'amberCrt' | 'monoLcd' | 'neon';
    const SKIN_IDS: readonly SkinId[];
    const SKINS: Record<SkinId, Skin>;
    function getSkin(id: SkinId): Skin;   // total: unknown id falls back to greenOnBlack
- Update /src/skins/index.ts to export the registry surface.

Tests (__tests__/skinRegistry.test.ts):
- SKIN_IDS and SKINS have identical key sets; every entry's id matches its key.
- Every skin has all required Skin fields with correct types.
- For every skin, snakeHead !== snakeBody.
- getSkin(validId) returns that skin; getSkin('nope' as SkinId) returns greenOnBlack (total fallback).

Constraints: data + registry only; do not modify renderers. greenOnBlack remains the default. Keep all colors as documented hex strings.
```

---

### Prompt 32 — Persist skin selection (additive settings field)

Context: Selection must survive relaunch. Because the existing `validateSettings` defaults missing fields, adding `skinId` is backward-compatible and needs **no key bump** — old `coil.settings.v1` blobs simply inherit the default skin. Validate against `SKIN_IDS` from the registry.

```text
Extend Coil's persisted settings with a skinId, validated against the skin registry, and add a store setter. The settings key stays 'coil.settings.v1' because this is an ADDITIVE field handled by the existing per-field validator. Tests first.

Changes:
1. /src/engine/types.ts — add `skinId: SkinId` to PersistedSettings. (Import SkinId from the skins registry, or define SkinId in types and have the registry import it — pick one and keep it consistent.)
2. /src/services/StoragePort.ts:
   - DEFAULT_SETTINGS.skinId = 'greenOnBlack'.
   - validateSettings: accept skinId only if it is in SKIN_IDS, else fall back to DEFAULT_SETTINGS.skinId. Keep all existing field validation unchanged.
   - Do NOT change SETTINGS_KEY.
3. /src/state/useSettingsStore.ts — add `skinId` to state (init from DEFAULT_SETTINGS) and a `setSkin(id: SkinId)` action that updates state and persists the full PersistedSettings (fire-and-forget; keep in-memory on reject, EH-2).

Tests:
- (__tests__/storageValidation.test.ts, extend) A blob with no skinId validates to the default skinId; a blob with an unknown skinId falls back to default; a valid skinId passes through. Existing settings cases still pass.
- (__tests__/settingsStore.test.ts, extend) setSkin updates state and calls storage.setSettings with the expected skinId; a rejected write does not throw and keeps the in-memory value.

Constraints: additive only; no settings-key migration; backward compatible with existing stored blobs.
```

---

### Prompt 33 — Skin-driven provider + Settings skin picker

Context: The provider currently defaults to `greenOnBlack`. Make the active skin follow the settings store, then add a picker to the Settings screen that reuses `PresetPreview`'s mini-board approach as a swatch.

```text
Drive Coil's active skin from the settings store and add a skin picker to the Settings screen. Renderers still read useSkin, so they update automatically. Tests first.

Changes:
1. /src/skins/SkinProvider.tsx — the provider's value resolves from the settings store's skinId via getSkin(skinId), defaulting to greenOnBlack before hydration. useSkin keeps the same signature.
2. /src/screens/SettingsScreen.tsx — add a "Skin" section that renders a swatch per SKIN_IDS (reuse the PresetPreview/mini-board rendering, or a small shared cell-drawing helper, rendered under each candidate skin so the swatch previews that skin's colors). Selecting one calls setSkin and shows a selected highlight.

Tests:
- (__tests__/skinProvider.test.tsx) useSkin returns the skin matching the store's skinId; changing skinId in the store flips the value returned to consumers.
- (__tests__/settingsScreen.test.tsx, extend) The picker shows one option per SKIN_IDS; tapping one calls setSkin with that id and reflects selection.

Constraints: no renderer changes; the picker persists via setSkin; pre-hydration default is greenOnBlack.
```

---

### Prompt 34 — Engine: bonus food (state, spawn/expiry, scoring, event)

Context: The first pure-engine extension of phase 2 and the highest-risk step in chunks H–L. Bonus food appears periodically, lives for a limited number of ticks, awards extra points, and (classic behavior) does **not** grow the snake. Keep classic behavior identical when bonus is disabled. Deterministic via the injected RNG.

```text
Extend the Coil engine with bonus food: a periodically-spawning, time-limited high-value pickup that does NOT grow the snake. It must be pure, deterministic via the injected RandomPort, and a no-op when disabled so classic play is unchanged. Write the full test matrix FIRST, then implement.

Type changes (/src/engine/types.ts):
- GameState: add `bonusFood: Cell | null` and `bonusRemaining: number` (ticks until the current bonus expires; 0 when none) and `ticksUntilBonus: number` (countdown to the next spawn).
- GameConfig: add `bonus: { enabled: boolean; spawnEveryTicks: number; lifetimeTicks: number; points: number } `.
- GameEvent: add 'ATE_BONUS' and 'BONUS_EXPIRED'.

createInitialState: initialize bonusFood = null, bonusRemaining = 0, ticksUntilBonus = config.bonus.enabled ? config.bonus.spawnEveryTicks : Infinity-equivalent sentinel (use a large number or a disabled flag — define clearly).

spawnFood (food.ts): when computing empty cells, EXCLUDE the bonusFood cell too (food and bonus never overlap, EH-19).

tick (tick.ts), bonus rules (only when config.bonus.enabled):
1. If a bonus is active, decrement bonusRemaining; on reaching 0, clear bonusFood and emit 'BONUS_EXPIRED'.
2. Else decrement ticksUntilBonus; on reaching 0, spawn a bonus on an empty cell (excluding snake, regular food, and—later—obstacles), set bonusRemaining = lifetimeTicks, reset ticksUntilBonus = spawnEveryTicks. If no empty cell exists, skip spawning this tick.
3. Eating: if nextHead equals bonusFood, award config.bonus.points (score += points), clear bonusFood, emit 'ATE_BONUS', and DO NOT grow (no length change from a bonus). Eating regular food is unchanged.
4. Bonus logic must run in a defined order relative to movement; document it and test it. The input GameState is never mutated.

Tests (__tests__/bonus.test.ts) with a seeded rng and hand-built states:
- With bonus disabled, tick output is identical to pre-bonus behavior (regression: same snake/score/food across a scripted run).
- A bonus spawns after exactly spawnEveryTicks and never on the snake or the regular food.
- An uneaten bonus expires after exactly lifetimeTicks, clearing bonusFood and emitting 'BONUS_EXPIRED'.
- Eating a bonus adds config.bonus.points, does NOT change snake length, emits 'ATE_BONUS', and clears bonusFood.
- Regular food still grows by one and scores pointsPerFood (unaffected by bonus).
- Near-full grid: bonus spawn is skipped (no crash) when no empty cell exists.
- Input state is never mutated.

Constraints: pure, deterministic, immutable. Classic (bonus.enabled=false) behavior must be byte-identical to before.
```

---

### Prompt 35 — Render bonus + dispatch event + enable in config

Context: Draw the bonus when present (new skin token), have the controller dispatch the new events (haptics on bonus; sound is out of scope this phase), and enable bonus in the classic config so it actually appears in play.

```text
Surface Coil's bonus food: a skin token, rendering, controller event dispatch (haptics only — no sound this phase), and enabling it in the classic config. Tests first.

Changes:
1. /src/skins/Skin.ts — add `bonusColor: string` and `bonusShape: 'square' | 'circle'`. Add these tokens to EVERY skin in the registry (and greenOnBlack). Update the skin registry tests to assert the new fields exist on all skins.
2. /src/render/DynamicLayer.tsx — when food/bonus are passed, also draw bonusFood (when non-null) using skin.bonusColor/bonusShape, distinct from regular food. Keep it a pure projection (no state mutation). Pass bonusFood through from the GameScreen's projection state.
3. /src/runtime/GameController.ts — on 'ATE_BONUS', if isHapticsEnabled() call haptics.eat() (reuse the eat haptic, or add haptics.bonus() if you extend HapticsPort — if so, wrap in try/catch like the others, EH-9). 'BONUS_EXPIRED' has no side effect. Do NOT call sound (out of scope). Score already updated in state.
4. classicMode.buildConfig (/src/modes/classicMode.ts) — set config.bonus = { enabled: true, spawnEveryTicks: <tunable, e.g. 60>, lifetimeTicks: <e.g. 25>, points: <e.g. 50> }. Keep these as named tunables.
5. GameScreen projection — include bonusFood in the minimal React state pushed via onState so DynamicLayer can draw it.

Tests:
- (__tests__/skinRegistry.test.ts, extend) every skin defines bonusColor/bonusShape.
- (__tests__/render.test.tsx, extend) DynamicLayer renders with a bonusFood cell and with bonusFood === null without crashing.
- (__tests__/gameController.test.ts, extend) 'ATE_BONUS' triggers the haptic only when haptics enabled (both branches); 'BONUS_EXPIRED' triggers nothing; neither calls sound.

Constraints: bonus is a tunable in classicMode; rendering stays a pure projection; no sound wiring.
```

---

### Prompt 36 — D-pad InputSource + control-scheme setting

Context: The `InputSource` seam was built for exactly this. Add an on-screen D-pad implementation and a persisted control-scheme setting; the Game screen picks the input source from the setting. The MVP's swipe stays the default.

```text
Add an on-screen D-pad to Coil behind the existing InputSource seam, plus a persisted control-scheme setting. Swipe remains the default. Tests first.

Changes:
1. /src/engine/types.ts — add `controlScheme: 'SWIPE' | 'DPAD'` to PersistedSettings.
2. /src/services/StoragePort.ts — DEFAULT_SETTINGS.controlScheme = 'SWIPE'; validateSettings accepts only 'SWIPE'|'DPAD' else default (additive; settings key stays v1).
3. /src/state/useSettingsStore.ts — add controlScheme to state + setControlScheme(s) action (persist; keep in-memory on reject).
4. /src/input/DpadInput.tsx — a component implementing InputSource (subscribe pattern): renders four arrow buttons; pressing one emits the corresponding Direction to subscribers. Pure mapping (button -> Direction) extracted as a tiny tested function if helpful.
5. /src/screens/SettingsScreen.tsx — add a "Controls" toggle (Swipe / D-pad) bound to controlScheme.
6. /src/screens/GameScreen.tsx — choose the InputSource by controlScheme: SwipeInput overlay for 'SWIPE', DpadInput for 'DPAD'. Both forward Direction to controller.enqueue. The D-pad must not occupy so much space that it breaks the grid layout — place it in the existing safe-area chrome below the board.

Tests:
- (__tests__/dpadInput.test.tsx) each arrow press emits the correct Direction to a subscriber; unsubscribing stops delivery.
- (__tests__/storageValidation.test.ts / settingsStore.test.ts, extend) controlScheme validates/persists; missing -> 'SWIPE'.
- (__tests__/gameScreen.test.tsx, extend) with controlScheme 'DPAD', a D-pad press enqueues a Direction; with 'SWIPE', the swipe path is used.

Constraints: reuse InputSource; swipe is default; D-pad lives in chrome, not over the grid.
```

---

### Prompt 37 — Extended end-screen stats

Context: The MVP deferred stats beyond score. Add lightweight run tracking (length, food eaten, time survived) to the terminal flow and show it on Win/Loss. `foodEaten` already exists; length is derivable; time comes from the controller.

```text
Add extended end-of-run stats to Coil: snake length, food eaten, and time survived, shown on the Win and Loss screens. Tests first.

Changes:
1. Time tracking: in /src/runtime/GameController.ts, track elapsed run time (accumulate from a monotonic clock between setRunning and terminal, pausing the accumulation while not RUNNING). Expose the final elapsed ms on the terminal payload. Inject the clock (a () => number) so tests are deterministic.
2. Terminal payload: extend onTerminal to include { score, isNewBest, foodEaten, length, elapsedMs } (length = snake.length, foodEaten from state).
3. /src/screens/WinScreen.tsx and /src/screens/LossScreen.tsx — display foodEaten, final length, and a formatted time alongside score and high score. Score and high score remain primary; stats are secondary.

Tests:
- (__tests__/gameController.test.ts, extend) elapsed time accumulates only while RUNNING (advance the injected clock across pause/resume and assert paused time is excluded); terminal payload includes foodEaten, length, elapsedMs.
- (__tests__/endScreens.test.tsx, extend) Win/Loss render the stats; score + high score still render; "New Best!" branch unchanged.

Constraints: inject the clock for determinism; pause excludes paused time; stats are secondary to score.
```

---

### Prompt 38 — Engine obstacle support

Context: Dynamic Walls needs obstacle cells the snake can die on and that spawns must avoid. This is a pure-engine extension. Keep classic byte-identical when `obstacles` is empty.

```text
Extend the Coil engine with obstacle cells: static-per-tick blocked cells that kill on contact and are excluded from food/bonus spawning. Pure, deterministic, and a no-op when obstacles is empty. Tests first.

Type changes (/src/engine/types.ts):
- GameState: add `obstacles: Cell[]` (cells currently blocked).
- (GameConfig needs no obstacle tunables here; placement schedule lives in the mode, step 39.)

Engine changes:
- createInitialState: obstacles = [] by default.
- spawnFood (food.ts): exclude obstacle cells from the empty set (food never on an obstacle, EH-18/19). Bonus spawning (tick) likewise excludes obstacles.
- tick (tick.ts): treat obstacle cells like body cells for collision — if nextHead is an obstacle cell, emit 'DIED' / status 'LOST'. Apply this in BOTH wall behaviors. Tail-follow logic is unaffected by obstacles (obstacles don't move within tick()).
- Win check: a full grid is columns*rows MINUS obstacle cells; winning means no empty non-obstacle cell remains (spawnFood returns null). Adjust the fill/win condition to account for obstacles.

Tests (__tests__/obstacles.test.ts) seeded rng, hand-built states:
- With obstacles = [], all engine outputs are identical to pre-obstacle behavior (regression across a scripted run).
- Head moving into an obstacle => 'DIED' / 'LOST', in both SOLID and PORTAL.
- Food and bonus never spawn on an obstacle (many seeds).
- Win condition accounts for obstacles: a grid whose only empty non-obstacle cells get filled reaches 'WON' with spawnFood null.
- Input state never mutated.

Constraints: pure; classic (obstacles empty) byte-identical; obstacles are read-only within a single tick (the mode mutates them between ticks).
```

---

### Prompt 39 — dynamicWallsMode (obstacle scheduling)

Context: A new `Mode` whose `tick` evolves the obstacle set on a schedule, then delegates the step to the engine. All placement is deterministic via the injected RNG and must never trap the player unfairly on spawn.

```text
Implement dynamicWallsMode for Coil: a Mode that periodically adds/moves obstacles, then delegates the actual step to the engine. Placement is deterministic via the injected RandomPort and must avoid unfair instant-trap spawns. Tests first.

File: /src/modes/dynamicWallsMode.ts
Export const dynamicWallsMode: Mode where:
- id = 'DYNAMIC_WALLS'.
- buildConfig: same as classicMode's mapping, plus bonus enabled (reuse classic tunables), plus dynamic-walls tunables carried via a mode-local constant (not necessarily in GameConfig): { changeEveryTicks, maxObstacles, obstaclesPerChange }.
- createInitialState: delegate to engine createInitialState, then (optionally) seed 0 obstacles; ensure obstacles = [].
- tick: BEFORE delegating to engine.tick, on the change schedule (every changeEveryTicks ticks), mutate a NEW obstacles array (immutably) by adding/relocating up to obstaclesPerChange cells, subject to ALL of:
    * never place an obstacle on the snake, the food, the bonus, or an existing obstacle;
    * never place an obstacle on the cell the head will enter THIS tick (no instant trap, EH-18);
    * cap total at maxObstacles (relocate oldest when at cap);
    * choose cells via rng for determinism.
  Then call engine.tick with the updated obstacles in state and return its TickResult (carrying the new obstacles forward). Do not reimplement movement/collision — the engine already kills on obstacle contact (step 38).

Register dynamicWallsMode in /src/modes/index.ts alongside classicMode (e.g., a MODES record keyed by ModeId).

Tests (__tests__/dynamicWallsMode.test.ts) with a seeded rng:
- buildConfig matches classic mapping plus bonus enabled.
- Obstacles appear on the schedule and never overlap snake/food/bonus/each other.
- An obstacle is never placed on the head's next cell for the current tick (no instant trap).
- Obstacle count never exceeds maxObstacles.
- With a fixed seed, the obstacle sequence is deterministic.
- The step still kills on obstacle contact (delegation to engine verified).

Constraints: immutable updates; delegate stepping to the engine; deterministic placement; fair-spawn guarantees enforced and tested.
```

---

### Prompt 40 — Mode selection on Home + scores migration to v2

Context: A second mode makes the flat score keys ambiguous, so this step migrates scores to a `MODE:WALL` record (the migration the versioned keys were designed for) and adds a mode picker to Home. `PersistedSettings.modeId` is additive (settings key stays v1).

```text
Add mode selection to Coil and migrate high scores to a mode-aware shape. Settings gains an additive modeId (key stays v1); scores move from flat v1 to a keyed record at v2 with a lossless migration. Tests first.

Type + persistence changes:
1. /src/engine/types.ts:
   - ModeId = 'CLASSIC' | 'DYNAMIC_WALLS'  (GPS added in chunk M).
   - PersistedSettings: add `modeId: ModeId`.
   - Replace PersistedScores flat shape with: `{ bests: Record<string, number> }` where keys are `${ModeId}:${WallBehavior}` (e.g., 'CLASSIC:SOLID').
2. /src/services/StoragePort.ts:
   - DEFAULT_SETTINGS.modeId = 'CLASSIC'; validateSettings accepts only valid ModeId else default (additive; SETTINGS_KEY stays 'coil.settings.v1').
   - SCORES_KEY_V1 = 'coil.scores.v1' (old), SCORES_KEY = 'coil.scores.v2' (new).
   - DEFAULT_SCORES = { bests: {} }.
   - validateScores: accept a bests record of string->non-negative-integer; drop invalid entries; non-object => { bests: {} }.
   - Add migrateScores(rawV1: unknown): PersistedScores — map a valid v1 { bestSolid, bestPortal } to { bests: { 'CLASSIC:SOLID': bestSolid, 'CLASSIC:PORTAL': bestPortal } } (only non-zero entries needed). Total and idempotent (EH-17).
3. /src/services/asyncStorageAdapter.ts — getScores reads v2; if absent, attempt to read+migrate v1, write the migrated v2, and return it; if neither exists, defaults. Never throw on read.
4. /src/state/useScoresStore.ts — state holds the bests record (+ hydrated). recordRun(modeId, wall, score) compares/updates bests[`${modeId}:${wall}`]; returns { isNewBest }. Add a selector getBest(modeId, wall). reset clears bests.
5. /src/state/useSettingsStore.ts — add modeId + setMode(id) (persist).
6. /src/screens/HomeScreen.tsx — add a Mode picker (Classic / Dynamic Walls). The displayed high scores now reflect the selected mode + wall (use getBest). Play passes modeId too.

Tests:
- (__tests__/storageValidation.test.ts, extend) validateScores accepts a clean bests record, drops bad entries, defaults on garbage; migrateScores maps v1 flat to the v2 record and is idempotent; modeId validates/defaults.
- (__tests__/asyncStorageAdapter.test.ts, extend) reading with only v1 present migrates to v2 (and persists v2); v2 present is read directly; neither => defaults; corrupt => defaults, no throw.
- (__tests__/scoresStore.test.ts, extend) recordRun keys by mode:wall; CLASSIC:SOLID and DYNAMIC_WALLS:SOLID are independent; getBest returns the right value; reset clears.
- (__tests__/homeScreen.test.tsx, extend) mode picker updates the store and the shown high scores follow selected mode+wall; Play passes modeId+preset+wall.

Constraints: settings additive (v1); scores migrated (v2) losslessly and idempotently; recordRun callers must pass modeId (update GameController/GameScreen accordingly in step 41).
```

---

### Prompt 41 — Render obstacles + wire dynamicWallsMode into the Game screen

Context: Draw obstacles (new skin token) and route the Game screen through the selected mode so Dynamic Walls is actually playable, recording scores under its `MODE:WALL` key.

```text
Make Dynamic Walls playable end to end in Coil: render obstacles, and route the Game screen through the selected mode with mode-aware scoring. Tests first.

Changes:
1. /src/skins/Skin.ts — add `obstacleColor: string`; add it to every skin + greenOnBlack; extend skin registry tests.
2. /src/render — draw obstacles from gridSpec + state. Put them in DynamicLayer (they change between ticks) or a dedicated ObstacleLayer; either way read skin.obstacleColor and stay a pure projection. Pass obstacles through the GameScreen projection state.
3. /src/modes/index.ts — ensure MODES maps 'CLASSIC' -> classicMode and 'DYNAMIC_WALLS' -> dynamicWallsMode.
4. /src/screens/GameScreen.tsx:
   - Select the mode from the chosen modeId (params/store) via MODES.
   - Build config and controller using that mode (mode.buildConfig / createGameController with mode).
   - Pass obstacles into the projection state pushed via onState so they render.
   - recordRun must now be called with modeId (thread modeId into the controller's terminal handling so it calls recordRun(modeId, wall, score)).
5. /src/runtime/GameController.ts — accept modeId (or read config.modeId) and call recordRun(modeId, config.wallBehavior, score) on terminal. Update existing controller tests accordingly.

Tests:
- (__tests__/render.test.tsx, extend) obstacles render without crashing; empty obstacles render unchanged.
- (__tests__/gameScreen.test.tsx, extend) selecting DYNAMIC_WALLS routes through dynamicWallsMode; obstacles appear over time; reaching terminal records under the DYNAMIC_WALLS key.
- (__tests__/gameController.test.ts, extend) recordRun is called with the active modeId on terminal.

Constraints: reuse the mode/engine; rendering stays a pure projection; scoring keyed by mode+wall.
```

---

### Prompt 42 — AuthPort + LeaderboardPort interfaces + in-memory fakes

Context: Begin the social chunk by defining the two ports and pure, network-free fakes so all downstream logic (submission, screens, gating) is testable without Firebase. Kept separate from `StoragePort`.

```text
Create the AuthPort and LeaderboardPort contracts for Coil with in-memory fakes for tests. No Firebase yet. These are separate from StoragePort (local persistence). Write fake tests first.

File: /src/services/AuthPort.ts
Export:
  interface AuthUser { uid: string; displayName: string | null; isAnonymous: boolean; }
  interface AuthPort {
    getCurrentUser(): AuthUser | null;
    onAuthChange(cb: (user: AuthUser | null) => void): () => void;  // returns unsubscribe
    signInAnonymously(): Promise<AuthUser>;
    signUp(email: string, password: string, displayName: string): Promise<AuthUser>;
    signIn(email: string, password: string): Promise<AuthUser>;
    signOut(): Promise<void>;
  }
  function createInMemoryAuth(): AuthPort;   // deterministic fake: maintains a user + listeners

File: /src/services/LeaderboardPort.ts
Export:
  interface LeaderboardEntry { uid: string; displayName: string; score: number; rank: number; }
  type Board = { modeId: ModeId; wall: WallBehavior };
  interface LeaderboardPort {
    submitScore(board: Board, user: AuthUser, score: number): Promise<void>;
    getTopScores(board: Board, limit: number): Promise<LeaderboardEntry[]>;
    getUserBest(board: Board, uid: string): Promise<LeaderboardEntry | null>;
  }
  function createInMemoryLeaderboard(): LeaderboardPort;  // keeps a per-board sorted list; keeps each user's best only

Tests:
- (__tests__/authFake.test.ts) signInAnonymously yields an anonymous user; signUp/signIn yield a named user; onAuthChange fires on changes and unsubscribes; getCurrentUser reflects state; signOut clears.
- (__tests__/leaderboardFake.test.ts) submitScore keeps only a user's best per board; getTopScores returns descending, limited, with correct ranks; boards are independent across mode/wall; getUserBest returns the user's entry or null.

Constraints: pure/in-memory, deterministic; ports are independent of StoragePort. No Firebase imports here.
```

---

### Prompt 43 — Firebase adapters (auth + leaderboard) with offline-safe error handling

Context: The real implementations, behind the same interfaces. The non-negotiable requirement is that network/auth failures degrade gracefully — reads return empty/cached and never crash; the rest of the app keeps working offline.

```text
Implement Firebase-backed AuthPort and LeaderboardPort for Coil, satisfying the interfaces from step 42, with offline-safe error handling. Tests first against a mocked Firebase SDK.

Files:
- /src/services/firebaseAuth.ts — createFirebaseAuth(): AuthPort using Firebase Auth (email/password + anonymous). Map Firebase users to AuthUser. onAuthChange wraps the SDK listener.
- /src/services/firebaseLeaderboard.ts — createFirebaseLeaderboard(): LeaderboardPort using Firestore (or Realtime DB). A board is a collection/path keyed by `${modeId}:${wall}`; store one document per user holding their best score + displayName; getTopScores queries ordered-desc with a limit and assigns ranks client-side; submitScore writes only if the new score beats the stored best.
- App config: read Firebase config from app config / env (expo-constants extra); document required keys. Do not hardcode secrets in source.

Error handling (EH-14/15/16):
- getTopScores / getUserBest: on network/SDK error, RESOLVE with an empty array / null (never reject into the UI). Optionally cache the last successful top list in memory and return it on failure.
- submitScore: on failure, REJECT (the submission service in step 44 owns retry/queue) — but it must never be called on a path that blocks the terminal UI.
- Auth methods: surface auth errors as rejections the UI can show as messages; a failure to reach Firebase leaves the user in their prior (e.g., anonymous/none) state.

Tests (__tests__/firebaseAdapters.test.ts) with the Firebase SDK mocked:
- Auth: signUp/signIn/anonymous map to AuthUser; onAuthChange fires; signOut clears; a thrown SDK error becomes a rejected promise (auth) without crashing the module.
- Leaderboard: submitScore writes only when beating the stored best; getTopScores returns ranked, limited, descending; a thrown SDK error in getTopScores/getUserBest resolves to []/null (no throw).

Constraints: same interfaces as the fakes; reads are offline-safe (never throw into UI); no secrets in source; document required config keys and that server-side Firestore security rules (score validation/rate limiting) are required infra outside the app.
```

---

### Prompt 44 — Offline-safe score submission on terminal

Context: On a completed run, submit the score to the leaderboard if the user is signed in and the network allows — without ever blocking or breaking the existing local-score/terminal flow.

```text
Add offline-safe leaderboard submission to Coil's terminal flow. Local high scores and the Win/Loss navigation must be completely unaffected by submission success or failure. Tests first.

File: /src/services/submitScoreOnTerminal.ts (or a small runtime hook)
Export a function/service:
  createScoreSubmitter(deps: { auth: AuthPort; leaderboard: LeaderboardPort }): {
    submit(board: Board, score: number): void;   // fire-and-forget, never throws
  }
Behavior (EH-14):
- If there is no current user, do nothing (local-only).
- Otherwise call leaderboard.submitScore(board, user, score) and swallow rejections (log in __DEV__ only). Optionally keep a tiny in-memory retry queue that flushes on the next submit or auth change; if you add it, cap it and make it best-effort.
- This is called AFTER local recordRun and AFTER the terminal payload is dispatched — it must not gate navigation.

Wire-in: in /src/screens/GameScreen.tsx (or the controller's onTerminal handler), after recordRun + onTerminal, call submit({ modeId, wall }, score). Never await it on the UI path.

Tests (__tests__/scoreSubmit.test.ts) with fake auth + fake leaderboard:
- With no user, submit does nothing and does not throw.
- With a user, submit calls leaderboard.submitScore with the right board + score.
- A rejecting leaderboard.submitScore does not throw out of submit (swallowed).
- submit is fire-and-forget: the terminal/local flow is not blocked (assert recordRun/onTerminal happen regardless of submission outcome).

Constraints: fire-and-forget; never blocks or breaks local scoring/navigation; reuse the ports.
```

---

### Prompt 45 — Auth UI (sign up / in / anonymous / out) + auth-state gating

Context: Give players an identity for the leaderboard. Keep it optional — anonymous and fully-local play must remain first-class. Surface auth errors as messages, not crashes.

```text
Add authentication UI to Coil and gate leaderboard features behind auth state, keeping anonymous/local play first-class. Tests first.

Files:
- /src/state/useAuthStore.ts (or a provider) — holds AuthUser | null, hydrated from AuthPort.onAuthChange; exposes signUp/signIn/signInAnonymously/signOut that delegate to the injected AuthPort and expose loading/error state.
- /src/screens/AccountScreen.tsx (route /account) — forms for sign up and sign in, a "Continue anonymously" action, current-user display, and sign out. Auth errors render as inline messages (from rejected promises), never crashes.
- Settings/Home entry point — a way to reach /account (e.g., a profile icon on Home or a Settings row).

Gating:
- Leaderboard submission already no-ops without a user (step 44).
- The Leaderboard screen (step 46) is reachable regardless, but prompts to sign in to appear on the board / submit.

Tests (__tests__/authUi.test.tsx) with a fake AuthPort:
- Sign up / sign in success updates the auth store and shows the user.
- A rejected sign in renders an error message and leaves the user signed out.
- Continue anonymously yields an anonymous user.
- Sign out clears the user.

Constraints: anonymous/local play remains fully functional; auth errors are messages, not crashes; AuthPort injected for tests.
```

---

### Prompt 46 — Leaderboard screen (top N per mode×wall) + states

Context: The payoff screen. Show the top scores for a selected board with proper loading / empty / error / offline states, refresh, and the user's own entry highlighted.

```text
Implement the Coil Leaderboard screen: top scores for a selected mode×wall board, with loading/empty/error states, refresh, and the current user's entry highlighted. Tests first.

File: /src/screens/LeaderboardScreen.tsx (route /leaderboard), reachable from Home.
Behavior:
- A board selector for mode (Classic / Dynamic Walls) and wall (Solid / Portal), defaulting to the player's current selection.
- On mount / board change / refresh: call leaderboard.getTopScores(board, N) and (if signed in) getUserBest(board, uid). Because reads are offline-safe (resolve []/null), handle:
    * loading state while the promise is pending;
    * empty state when [] returns (distinguish "no scores yet" copy);
    * the list otherwise, ranked, with the current user's row highlighted; if the user's best isn't in the top N, show it pinned below.
- A pull-to-refresh or refresh button.
- If not signed in, show a gentle prompt to sign in to compete (links to /account), but still show the public top N.

Tests (__tests__/leaderboardScreen.test.tsx) with a fake LeaderboardPort + fake auth:
- Renders a ranked list from getTopScores.
- Shows the loading state before resolution and the empty state on [].
- Highlights the current user's entry; pins user-best below when outside top N.
- Changing the board re-queries with the new mode/wall.
- Signed-out shows the public board plus a sign-in prompt.

Constraints: reads are offline-safe (no error crash; empty/loading/list states); reuse the ports; board keyed by mode+wall.
```

---

### Prompt 47 — World model (world larger than viewport)

Context: Begin the GPS milestone. The off-screen mode needs a world bigger than the visible board, with snake/food in world coordinates and food allowed off-screen. Keep it pure and separate from the fixed-board path so existing modes are untouched.

```text
Introduce a world model for Coil's GPS mode: a play world larger than the on-screen viewport, with entities in world coordinates. This is pure and must not affect existing fixed-board modes. Tests first.

Type/engine changes (kept additive and isolated):
- /src/engine/types.ts — add WorldSpec { worldColumns: number; worldRows: number; cellSize: number } and allow a GameConfig variant carrying a WorldSpec for world-based modes (e.g., an optional `world?: WorldSpec`). GameState gains nothing mandatory for fixed modes; world modes use the same snake/food/obstacles in WORLD coordinates.
- /src/engine/world.ts — pure helpers: createWorldInitialState(config, rng) placing the snake near world center; food/bonus/obstacle spawning over the WORLD (reuse enumeration, excluding occupied/world-bounds). Wall behavior in GPS: define explicitly (recommend SOLID world bounds; PORTAL optional) and test it.

Tests (__tests__/world.test.ts) seeded rng:
- World init places a valid snake in world bounds near center; food spawns somewhere in the world (possibly far from the snake).
- Spawning never lands on snake/obstacles; respects world bounds.
- A step in the world advances/eats/grows with the same rules as the fixed engine (reuse tick where possible; if a world tick wrapper is needed, keep it delegating).
- Existing fixed-board modes are unaffected (regression: classic/dynamic tests still green).

Constraints: pure; additive; existing modes untouched; world wall behavior defined and tested.
```

---

### Prompt 48 — Camera/viewport transform + visible-window rendering

Context: Render only the window of the world around the snake's head, with a world→screen transform. This is the rendering departure from the fixed board.

```text
Implement Coil's GPS camera: a viewport that follows the snake's head through the larger world, rendering only the visible window. Tests first for the pure transform.

Files:
- /src/render/camera.ts — pure helpers:
    computeViewport(headWorldCell, worldSpec, viewportCols, viewportRows): { originCol, originRow } — the top-left world cell of the visible window, clamped to world bounds so the camera doesn't show beyond the edges.
    worldToScreen(worldCell, viewport, cellSize, gridOrigin): { x, y } — pixel position of a world cell within the viewport, or a flag if off-screen.
- /src/render/WorldBoard.tsx + /src/render/WorldDynamicLayer.tsx — like Board/DynamicLayer but draw only cells within the viewport, translating world cells via worldToScreen and reading skin tokens. Entities outside the viewport are skipped (the HUD arrow in step 49 handles off-screen food).

Tests (__tests__/camera.test.ts):
- computeViewport centers on the head in open world and clamps at each world edge (head near a corner shows a corner-aligned window, never out of bounds).
- worldToScreen maps an in-view world cell to the right pixel and flags an out-of-view cell as off-screen.
- (__tests__/worldRender.test.tsx) WorldBoard/WorldDynamicLayer mount without crashing for a representative world + viewport; off-screen entities are not drawn.

Constraints: transforms are pure and tested; renderers stay pure projections reading the skin; camera clamps at world bounds.
```

---

### Prompt 49 — GPS HUD arrow (off-screen food pointer)

Context: The signature GPS element — a pointer toward food when it's outside the viewport, hidden when food is visible.

```text
Implement Coil's GPS HUD arrow that points toward the food when it is off-screen. Pure angle math first, then the component. Tests first.

Files:
- /src/render/gpsArrow.ts — pure helper:
    foodPointer(headWorldCell, foodWorldCell, viewport, viewportCols, viewportRows): { visible: boolean; angleRad: number } — visible=false when the food cell is inside the current viewport (no arrow needed); otherwise visible=true with the angle from the head to the food (screen convention: y grows downward; define 0 rad = right, increasing clockwise; document it).
- /src/render/GpsArrow.tsx — renders a pointer at the screen edge / near the head rotated by angleRad when visible, hidden otherwise, using a skin-derived color.

Tests (__tests__/gpsArrow.test.ts):
- When food is within the viewport, visible=false.
- When food is directly right/left/up/down of the head and off-screen, angleRad matches the documented convention for each.
- A diagonal off-screen food yields the expected quadrant angle.

Constraints: angle math pure and fully tested; component hides the arrow when food is visible; color from the skin.
```

---

### Prompt 50 — gpsMode + wiring into mode routing, scoring, and leaderboards

Context: Assemble GPS into a real, selectable mode: world init, camera-following render, the HUD arrow, obstacles (reuse), mode selection, and `MODE:WALL` scoring/leaderboards. This is the capstone of the GPS milestone.

```text
Implement gpsMode for Coil and wire the GPS experience end to end: world model + camera render + HUD arrow + obstacles + mode selection + scoring/leaderboard under its MODE:WALL key. Tests first.

Changes:
1. /src/engine/types.ts — extend ModeId to include 'GPS'.
2. /src/modes/gpsMode.ts — a Mode with id 'GPS' that: buildConfig produces a world-based GameConfig (WorldSpec sized larger than any viewport; bonus enabled; reuse obstacle scheduling from dynamicWallsMode if desired, in world coords); createInitialState uses the world init; tick evolves obstacles (optional) and delegates stepping to the world/engine tick. Register in MODES.
3. Home mode picker — add 'GPS' (Classic / Dynamic Walls / GPS). Validate modeId 'GPS' in settings (still additive on settings v1).
4. /src/screens/GameScreen.tsx — when modeId is 'GPS': compute the viewport from device dimensions, render WorldBoard + WorldDynamicLayer (camera follows head) + GpsArrow, keep SwipeInput/D-pad, run the same loop/lifecycle/countdown, and on terminal record under 'GPS':wall and submit to the leaderboard like other modes.
5. Scoring/leaderboard — getBest, recordRun, and the leaderboard board all already key by ModeId:WallBehavior, so GPS slots in; confirm Home/end-screen/leaderboard show GPS boards.

Tests:
- (__tests__/gpsMode.test.ts) buildConfig yields a world config larger than a sample viewport; createInitialState/tick delegate to world/engine (deterministic with a seed); obstacles (if enabled) obey the fair-spawn rules.
- (__tests__/gameScreen.test.tsx, extend) selecting GPS renders the world/camera path and the HUD arrow appears when food is off-screen; terminal records under the GPS key and submits to the leaderboard.

Constraints: reuse world/camera/arrow/obstacle pieces; GPS is just another Mode + render path; scoring/leaderboard keyed by mode+wall; existing modes unaffected.
```

---

## 4. Dependency map (quick reference)

```
H Skins
  31 skin registry ◄── (MVP 17)
  32 settings.skinId ◄── 31, (MVP 12,15)
  33 skin-driven provider + picker ◄── 31,32, (MVP 17,29)

I Bonus food
  34 engine bonus ◄── (MVP 6,10)
  35 render+dispatch+enable ◄── 34, (MVP 17,19,18,22,27)

L Polish
  36 D-pad + control setting ◄── (MVP 12,15,23,27)
  37 end-screen stats ◄── (MVP 19,28)

J Dynamic Walls
  38 engine obstacles ◄── 34(order)/(MVP 6,10)
  39 dynamicWallsMode ◄── 38, (MVP 18)
  40 mode select + scores v2 migration ◄── 39, (MVP 12,13,16,26)
  41 render obstacles + wire mode ◄── 38,39,40, (MVP 22,27,19)

K Auth + leaderboards
  42 AuthPort+LeaderboardPort + fakes ◄── (MVP 2)
  43 Firebase adapters ◄── 42
  44 submit-on-terminal ◄── 42, (MVP 27,19)
  45 auth UI + gating ◄── 42, (MVP 25,29)
  46 leaderboard screen ◄── 42,45,40, (MVP 25)

M GPS (own milestone)
  47 world model ◄── (MVP 6,8,10)
  48 camera/viewport ◄── 47, (MVP 22)
  49 GPS HUD arrow ◄── 47,48
  50 gpsMode + wiring ◄── 47,48,49,40,41,44,46
```

Every arrow points to earlier steps (MVP or phase 2). No step depends on anything built later, so each prompt can assume its predecessors exist and stay green.
