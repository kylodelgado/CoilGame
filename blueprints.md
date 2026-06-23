# Coil — Build Blueprint & TDD Code-Generation Prompts

A complete plan for building the *Coil* Snake MVP, derived from the technical specification. It moves from a high-level blueprint, to iterative chunks, to right-sized steps, and finally to a series of ready-to-paste prompts for a code-generation LLM. Every prompt is test-driven, builds on the prior one, and ends by wiring its output into the existing system so nothing is left orphaned.

---

## How to use this document

1. Read the **Blueprint** and **Architecture build order** so you understand *why* the steps are ordered the way they are.
2. Work the **Prompts** in sequence. Each one is in a `text` code block — paste it into your codegen LLM as-is.
3. Do not skip ahead. Each prompt assumes the artifacts (files, types, tests) created by the previous prompts already exist and pass.
4. After each prompt, run the test suite. A step is "done" only when its tests are green and the project still builds. Do not start the next prompt with a red suite.

A short rule that keeps the whole thing honest: **if a step produces code that nothing tests and nothing calls, it isn't finished.** Every step is exercised by its own tests, and the screen-building steps integrate the lower-layer pieces into something the user can actually run.

---

## 1. Blueprint

### 1.1 What we're building

A retro Snake game (Android + iOS, Expo managed, TypeScript strict, portrait-only, fully offline) whose defining traits are an aspect-ratio-adaptive grid with three density presets, a Solid/Portal wall toggle scored separately, and a polished single "Classic" mode. The architectural bet is that **all game correctness lives in a pure, framework-agnostic engine** that is deterministic given an injected RNG, so the bug-prone logic (collision, wrap, tail-follow, food spawning, win detection) is unit-tested in plain Jest with no device.

### 1.2 The four layers and the dependency rule

```
UI Layer            screens, components, navigation, gesture handling
Runtime Layer       game-loop scheduler, app-state listeners, store wiring, services, skin provider
Engine Layer        PURE: tick, collisions, food, scoring, speed, input queue, grid sizing
Infrastructure      interfaces + adapters: StoragePort, SoundPort, HapticsPort, RandomPort
```

Outer layers depend on inner layers, never the reverse. We build **inner-out**: Infrastructure interfaces and the pure Engine first (cheap to test, no React), then the Runtime glue that drives the engine, then the UI that renders it.

### 1.3 The four seams that keep Phase 2 cheap

`InputSource` (swipe now, D-pad later), `Mode` (classic now, dynamic-walls/GPS later), `Skin` (green-on-black now, more later), and `StoragePort` (AsyncStorage now, Firebase later). The MVP must define and *use* these interfaces, not just gesture at them — the MVP skin ships *through* the skin system, the swipe input implements `InputSource`, etc.

### 1.4 Architecture build order (why the steps are sequenced as they are)

1. **Scaffold + test harness** — prove Jest/RNTL run before writing logic.
2. **Types + preset constants** — the shared vocabulary every layer imports.
3. **Pure engine, bottom-up** — `grid` → `RandomPort` → `speed` → `food` → `input` → `createInitialState` → movement helpers → `tick` → barrel + a scripted full-game integration test. After this, the entire game *rules* are done and proven without React.
4. **Infrastructure adapters** — `StoragePort` + validation, the AsyncStorage adapter, the haptics/sound ports.
5. **State + presentation infra** — Zustand settings/scores stores wired to storage, the skin system, the `Mode`/`classicMode` config builder.
6. **Runtime glue** — `GameController` (authoritative state in a ref, side-effect dispatch), `useGameLoop` (single-timer scheduler), `useAppStatePause` + countdown.
7. **Rendering + input** — Skia `Board`/`DynamicLayer`, `SwipeInput` (+`InputSource`), `PresetPreview`.
8. **Screens + navigation** — router scaffold, Home, Game (the big integration), Pause/Win/Loss, Settings, then a final end-to-end wiring/acceptance pass.

The crux of testing risk is concentrated in step group 3 (the engine) and the `GameController`/`useGameLoop` timer logic in group 6 — those get the heaviest test specifications.

---

## 2. Round 1 — Iterative chunks

Coarse, each a few days of work, each independently verifiable:

- **Chunk A — Project foundation.** Expo app boots, TypeScript strict, Jest + RNTL configured, folder structure laid out, CI-runnable test command, one trivial passing test.
- **Chunk B — Pure engine.** Grid sizing, seedable RNG, speed curve, food spawning, input queue, initial state, movement + tick, all unit-tested to near-complete coverage; a scripted game plays to a win deterministically.
- **Chunk C — Infrastructure & persistence.** `StoragePort` contract + defaults + validators, AsyncStorage adapter (round-trip + corrupt fallback), haptics/sound ports that no-op safely.
- **Chunk D — State, skin, mode.** Settings and scores Zustand stores hydrating from and persisting to storage; the skin system with the green-on-black skin; the `Mode` interface and `classicMode` config builder.
- **Chunk E — Runtime loop.** `GameController` binding engine + services + stores with correct side-effect dispatch; `useGameLoop` single-timer scheduler honoring live `tickMs`; `useAppStatePause` + the 3-second countdown.
- **Chunk F — Rendering & gestures.** Skia static-grid + dynamic snake/food layers reading skin tokens; swipe-to-Direction with the 30px threshold implementing `InputSource`; home-screen preset previews.
- **Chunk G — Screens & wiring.** Navigation, Home (selection flow), Game (full composition), Pause/Win/Loss, Settings, and a final acceptance pass against the Definition of Done.

---

## 3. Round 2 — Small steps

Breaking each chunk into right-sized, individually testable steps. These map 1:1 to the prompts in section 5.

**Chunk A**
1. Scaffold + test harness.
2. Core types + preset constants.

**Chunk B (pure engine)**
3. `computeGrid` (grid sizing).
4. `RandomPort` (seedable RNG).
5. `computeTickMs` (speed curve).
6. `spawnFood` (empty-cell enumeration).
7. `enqueueDirection` (input queue + guards).
8. `createInitialState`.
9. Movement helpers (`computeNextHead`, wall resolution).
10. `tick` (full step with events).
11. Engine barrel + scripted full-game integration test.

**Chunk C (infrastructure)**
12. `StoragePort` interface + defaults + pure validators.
13. AsyncStorage adapter.
14. `HapticsPort` + `SoundPort` (+ silent/guarded impls).

**Chunk D (state, skin, mode)**
15. Settings store (Zustand + storage).
16. Scores store (Zustand + storage + record-run logic).
17. Skin system (`Skin` + `greenOnBlack` + provider/hook).
18. `Mode` interface + `classicMode` config builder.

**Chunk E (runtime)**
19. `GameController` (state ref + side-effect dispatch).
20. `useGameLoop` (single-timer scheduler).
21. `useAppStatePause` + countdown controller.

**Chunk F (rendering & gestures)**
22. `Board` + `DynamicLayer` (Skia).
23. `SwipeInput` + `InputSource`.
24. `PresetPreview`.

**Chunk G (screens & wiring)**
25. Router scaffold + providers + portrait lock.
26. `HomeScreen` (selection flow).
27. `GameScreen` (full composition + lifecycle + back handling).
28. `PauseOverlay` + `WinScreen` + `LossScreen`.
29. `SettingsScreen`.
30. Final integration & acceptance pass.

---

## 4. Right-sizing review

A pass to confirm the steps are neither too big nor too small.

- **Why not fewer/bigger steps?** The two highest-risk areas — the engine `tick` and the loop timer — each get a dedicated step with an exhaustive test list rather than being folded into a "build the engine" or "build the game screen" mega-step. Folding them in is exactly where subtle bugs (tail-follow, double-timers, accel-not-applied) slip through untested. They stay isolated.
- **Why not more/smaller steps?** Trivially small units (defining a single `type`, a one-line constant) are grouped into their natural cohesive step (e.g., all core types + the preset table together) so we don't waste a full TDD cycle on something with no behavior to test.
- **Movement helpers split from `tick`:** `computeNextHead` and wall resolution are pure and tiny, but pulling them out lets `tick`'s step focus its tests purely on orchestration (grow/pop, collision, eat, win, events) against already-trusted primitives. This is a deliberate safety split, not over-decomposition.
- **Interfaces introduced with their first consumer/implementer:** to avoid orphaned code, each port/interface is created in the same step as the thing that implements or consumes it and is exercised by that step's tests — never defined in a vacuum steps ahead of use.
- **The final step is a capstone, not new features:** step 30 only wires, verifies the six preset×wall combinations, confirms persistence survives relaunch, and checks the Definition of Done — it introduces no logic that wasn't already built and tested.

Conclusion: 30 steps, each ending green and integrated, with the engine and timer logic carrying the heaviest test load. This is the right granularity for "safe to implement with strong testing, big enough to move forward."

---

## 5. The Prompts

Each prompt is self-contained for pasting, but assumes everything from prior prompts exists and passes. Test-first is mandatory in every step.

---

### Prompt 1 — Project scaffold & test harness

Context: Stand up the Expo app and prove the test tooling runs before any game logic exists. Nothing here is game-specific; it's the ground everything else stands on.

```text
You are building "Coil", a React Native Snake game using Expo (managed workflow), TypeScript in strict mode, and expo-router. This first step creates the project skeleton and a working test harness. Write the test/config first where possible, and end with a single trivial passing test that proves the harness runs.

Tasks:
1. Initialize an Expo (managed) TypeScript project configured for expo-router. Enable TypeScript "strict": true in tsconfig.
2. Lock orientation to portrait at the config level (app.json/app.config: "orientation": "portrait").
3. Install and configure the testing stack:
   - Jest (via jest-expo preset) for fast, device-free unit tests.
   - @testing-library/react-native (RNTL) for component tests.
   - Add an "npm test" script that runs Jest in CI mode (no watch) and a "test:watch" script.
4. Create this empty folder structure under /src exactly (empty index files or placeholders where needed so imports resolve later):
   /src/engine, /src/runtime, /src/render, /src/input, /src/modes, /src/skins, /src/services, /src/state, /src/screens
   and an /app directory for expo-router routes.
5. Add a __tests__ directory at the repo root.
6. Write one trivial test (e.g., __tests__/harness.test.ts) asserting 1 + 1 === 2, purely to confirm Jest is wired. Make it pass.

Constraints:
- TypeScript strict mode must be on and the project must typecheck.
- Do not add game logic yet.
- Provide the exact commands to install dependencies and run tests, and the final file tree.

Deliverable: a booting Expo project, green "npm test", and a printed file tree.
```

---

### Prompt 2 — Core domain types & preset constants

Context: Define the shared vocabulary from the spec's data model. Type-only modules have little to test directly, so we also introduce the concrete preset table and assert its invariants — giving this step real, verifiable behavior.

```text
Add the core domain types and the preset constant table for Coil. These types are imported by every later layer, so get the names and shapes exactly right. Write a small test for the preset constants first, then implement.

1. Create /src/engine/types.ts exporting EXACTLY these types:

   type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
   type WallBehavior = 'SOLID' | 'PORTAL';
   type PresetId = 'CLASSIC' | 'STANDARD' | 'DENSE';
   type GameStatus = 'TAP_TO_START' | 'COUNTDOWN' | 'RUNNING' | 'PAUSED' | 'WON' | 'LOST';
   interface Cell { x: number; y: number; }            // x = column 0..cols-1, y = row 0..rows-1
   interface GridSpec { columns: number; rows: number; cellSize: number; originX: number; originY: number; }
   interface Preset { id: PresetId; label: string; targetColumns: number; baseTickMs: number; minTickMs: number; accelMsPerFood: number; }
   interface GameConfig { grid: GridSpec; wallBehavior: WallBehavior; baseTickMs: number; minTickMs: number; accelMsPerFood: number; pointsPerFood: number; startLength: number; startDirection: Direction; }
   interface GameState { status: GameStatus; snake: Cell[]; direction: Direction; inputQueue: Direction[]; food: Cell | null; score: number; foodEaten: number; tickMs: number; }
   interface PersistedSettings { presetId: PresetId; wallBehavior: WallBehavior; soundEnabled: boolean; hapticsEnabled: boolean; }
   interface PersistedScores { bestSolid: number; bestPortal: number; }
   type GameEvent = 'ATE_FOOD' | 'DIED' | 'WON';
   interface TickResult { state: GameState; events: GameEvent[]; }
   (snake index 0 is the head.)

2. Create /src/engine/presets.ts exporting a PRESETS record keyed by PresetId, each a Preset. Use these tunable starting values:
   - CLASSIC:  targetColumns 10, baseTickMs 220, minTickMs 110, accelMsPerFood 4, label 'Classic'
   - STANDARD: targetColumns 16, baseTickMs 200, minTickMs 90,  accelMsPerFood 4, label 'Standard'
   - DENSE:    targetColumns 24, baseTickMs 180, minTickMs 70,  accelMsPerFood 3, label 'Dense'
   Also export POINTS_PER_FOOD = 10, START_LENGTH = 3, START_DIRECTION: Direction = 'RIGHT'.

3. Tests (__tests__/presets.test.ts): for every preset, assert minTickMs < baseTickMs, accelMsPerFood > 0, targetColumns >= 6, and that ids/labels line up. Assert POINTS_PER_FOOD === 10.

Constraints: types only in types.ts (no runtime code there); everything must typecheck under strict. Do not implement any algorithms yet.
```

---

### Prompt 3 — Grid sizing algorithm

Context: The first pure engine function. It's isolated, has no dependencies, and the spec gives an exact reference implementation plus minimum clamps — an ideal first TDD target. Powers both the play grid and the home previews.

```text
Implement the grid sizing algorithm for Coil as a pure function. Write the tests first from the cases below, then implement to satisfy them.

File: /src/engine/grid.ts
Export:
  const MIN_COLUMNS = 6;
  const MIN_ROWS = 6;
  function computeGrid(screenWidth: number, playAreaHeight: number, targetColumns: number): GridSpec;

Algorithm (square cells, fill width, never exceed play area, enforce minimums):
1. rawCell = floor(screenWidth / targetColumns); cellSize = max(rawCell, 1).
2. columns = max(MIN_COLUMNS, floor(screenWidth / cellSize)).
3. rows    = max(MIN_ROWS, floor(playAreaHeight / cellSize)).
4. gridPxWidth = columns * cellSize; gridPxHeight = rows * cellSize.
5. originX = floor((screenWidth - gridPxWidth) / 2); originY = floor((playAreaHeight - gridPxHeight) / 2).
6. return { columns, rows, cellSize, originX, originY }.

Tests (__tests__/grid.test.ts) — validate FR-G1 and EH-4:
- Cells are square (single cellSize used for both axes) and cellSize >= 1.
- A normal phone size (e.g., 390x780, target 16) fills width: columns * cellSize <= 390 and the leftover < cellSize.
- rows derived from playAreaHeight, never exceeding it (rows * cellSize <= playAreaHeight).
- Tiny/degenerate screen (e.g., 30x30, target 24) clamps to MIN_COLUMNS/MIN_ROWS and never returns 0 columns/rows.
- originX and originY are non-negative and center the grid (leftover px split, floored).
- Larger targetColumns yields a smaller cellSize for the same width.

Constraints: pure function, no React, no globals. Same inputs always produce the same output.
```

---

### Prompt 4 — Seedable RandomPort

Context: The engine must be deterministic in tests, which means randomness is injected, not called directly. This port is consumed by `spawnFood` and `createInitialState` next, so it's introduced right before its first use.

```text
Create the RandomPort abstraction for Coil: an injectable source of randomness with a deterministic, seedable implementation for tests and a Math.random-backed implementation for production. Write determinism tests first.

File: /src/services/RandomPort.ts
Export:
  interface RandomPort {
    next(): number;            // float in [0, 1)
    nextInt(maxExclusive: number): number;  // integer in [0, maxExclusive)
  }
  function createSeededRandom(seed: number): RandomPort;   // deterministic (e.g., mulberry32)
  function createMathRandom(): RandomPort;                 // wraps Math.random

Implementation notes:
- createSeededRandom must be a pure PRNG (mulberry32 or similar): identical seed => identical sequence.
- nextInt(n) must return Math.floor(next() * n) and must be in [0, n) for n >= 1; define behavior for n <= 0 as returning 0.

Tests (__tests__/random.test.ts):
- Same seed produces an identical sequence of next() values across two instances.
- Different seeds produce different sequences (with very high probability over, say, 20 draws).
- nextInt(n) always returns an integer in [0, n) over many draws for several n.
- createMathRandom().next() stays within [0, 1) over many draws.

Constraints: no React. The seeded generator is the one all later engine tests will inject.
```

---

### Prompt 5 — Speed curve (computeTickMs)

Context: A tiny, pure, monotonic function that controls acceleration. Small but worth isolating so its clamp behavior is independently proven before `tick` depends on it.

```text
Implement the speed/acceleration curve for Coil as a pure function. Tests first.

File: /src/engine/speed.ts
Export:
  function computeTickMs(baseTickMs: number, minTickMs: number, accelMsPerFood: number, foodEaten: number): number;

Definition: tickMs = max(minTickMs, baseTickMs - accelMsPerFood * foodEaten).
The result is monotonic non-increasing in foodEaten and clamped at minTickMs.

Tests (__tests__/speed.test.ts) — validate FR-S2:
- foodEaten = 0 returns baseTickMs.
- Each additional food reduces tickMs by accelMsPerFood until the floor.
- Once the computed value would drop below minTickMs, it is clamped to exactly minTickMs and never lower.
- The sequence over increasing foodEaten is monotonically non-increasing.

Constraints: pure, no side effects.
```

---

### Prompt 6 — Food spawning (spawnFood)

Context: Pure, RNG-injected, and the spec is emphatic about enumerating empty cells rather than guess-and-retry (which loops forever on a near-full grid). Returning `null` is the win signal consumed by `tick`.

```text
Implement food spawning for Coil as a pure function that takes an injected RandomPort. Write tests first, including the near-full-grid and full-grid cases.

File: /src/engine/food.ts
Export:
  function spawnFood(state: GameState, config: GameConfig, rng: RandomPort): Cell | null;

Algorithm (FR-F2, EH-8):
1. Enumerate ALL grid cells from config.grid (columns x rows).
2. Subtract the cells currently occupied by state.snake to get the empty set.
3. If the empty set is empty, return null (this is the win signal — never loop guessing).
4. Otherwise pick one empty cell uniformly using rng.nextInt(emptyCount).

Tests (__tests__/food.test.ts):
- Spawned food is never on a snake cell, verified across many seeds and several snake layouts.
- Spawned food is always within grid bounds.
- On a grid where only one cell is empty, that exact cell is returned.
- On a fully occupied grid (snake covers every cell), returns null.
- With a seeded RNG, the result is deterministic (same seed + state => same cell).

Constraints: O(cells), pure, deterministic given the injected rng. No retry loops.
```

---

### Prompt 7 — Input queue (enqueueDirection)

Context: Pure input handling with three guards. The subtle requirement is resolving against the *last queued* direction (not just the committed heading) so fast double-swipes chain instead of folding back. This is a classic Snake bug; lock it with tests.

```text
Implement the input queue logic for Coil as a pure function. Tests first, and make sure the double-swipe chain case is covered.

File: /src/engine/input.ts
Export:
  function enqueueDirection(state: GameState, dir: Direction): GameState;

Rules (FR-C2, FR-C3):
1. Reference direction = last entry of state.inputQueue if non-empty, else state.direction.
2. Reversal guard: if dir is the exact opposite of the reference, return state unchanged.
3. No-op guard: if dir equals the reference, return state unchanged.
4. Otherwise return a NEW state with dir pushed onto inputQueue, capped at length 2 (if already length 2, return state unchanged / drop the input).
Opposites: UP<->DOWN, LEFT<->RIGHT.

Tests (__tests__/input.test.ts):
- A direction opposite the committed heading is ignored.
- A direction opposite the LAST QUEUED direction is ignored (heading RIGHT, queue [UP], then DOWN is ignored).
- A duplicate of the reference direction is ignored.
- Queue caps at 2: a third distinct legal input is dropped.
- Double-swipe chain: heading RIGHT, enqueue UP then LEFT — both are accepted (LEFT is legal vs UP), final queue is [UP, LEFT].
- The function never mutates the input state object (returns a new object/array; original unchanged).

Constraints: pure, immutable updates only.
```

---

### Prompt 8 — Initial state (createInitialState)

Context: The first composition step — it assembles a valid starting `GameState` using the grid and `spawnFood`. After this we have a board we can place but not yet move.

```text
Implement createInitialState for Coil, composing the grid and food spawn into a valid starting GameState. Tests first.

File: /src/engine/createInitialState.ts
Export:
  function createInitialState(config: GameConfig, rng: RandomPort): GameState;

Behavior (FR-D4, FR-F1/2):
- Place a 3-cell (config.startLength) snake horizontally near grid center, head pointing RIGHT, where the head is the RIGHTMOST of the three cells and snake[0] is the head. Choose center using floor(columns/2), floor(rows/2).
- direction = config.startDirection ('RIGHT'), inputQueue = [], score = 0, foodEaten = 0, tickMs = config.baseTickMs.
- Spawn the first food via spawnFood on an empty cell (guaranteed empty given a normal grid).
- status = 'TAP_TO_START'.

Tests (__tests__/createInitialState.test.ts):
- snake.length === startLength and all cells are within bounds.
- snake[0] (head) is the rightmost of the three contiguous horizontal cells, and the three are adjacent in a row.
- The snake is centered (head near floor(columns/2), floor(rows/2)).
- direction === 'RIGHT', inputQueue is empty, score 0, foodEaten 0, tickMs === baseTickMs.
- food is non-null and not on any snake cell.
- status === 'TAP_TO_START'.

Constraints: pure given rng; reuse spawnFood and the types. No React.
```

---

### Prompt 9 — Movement helpers (computeNextHead + wall resolution)

Context: Two small pure primitives that `tick` will orchestrate. Splitting them out lets `tick`'s tests focus on game rules against already-trusted geometry. Covers both wall behaviors.

```text
Implement the movement primitives for Coil that tick will build on. Tests first; cover all four directions and all four edges for both wall behaviors.

File: /src/engine/movement.ts
Export:
  function computeNextHead(head: Cell, dir: Direction): Cell;   // raw next cell, may be out of bounds
  type WallResult = { kind: 'IN_BOUNDS'; cell: Cell } | { kind: 'OUT_OF_BOUNDS' };
  function resolveWall(rawHead: Cell, grid: GridSpec, wall: WallBehavior): WallResult;

Behavior:
- computeNextHead: UP => y-1, DOWN => y+1, LEFT => x-1, RIGHT => x+1.
- resolveWall, PORTAL: wrap x modulo grid.columns and y modulo grid.rows (handle negatives correctly), return IN_BOUNDS with the wrapped cell.
- resolveWall, SOLID: if rawHead is outside [0,columns) x [0,rows), return OUT_OF_BOUNDS; else IN_BOUNDS with rawHead.

Tests (__tests__/movement.test.ts) — validate FR-D2/M2:
- computeNextHead moves one cell in each of the four directions.
- PORTAL wraps on each of the four edges (e.g., x = -1 -> columns-1; x = columns -> 0; same for y).
- SOLID flags OUT_OF_BOUNDS when stepping off each of the four edges, and IN_BOUNDS for an interior step.

Constraints: pure. No mutation of inputs.
```

---

### Prompt 10 — The tick (full step with events)

Context: The heart of the engine and the highest-value test surface in the project. It composes movement, the tail-follow collision rule, eating, speed recompute, food respawn, and win detection, and returns an events array the runtime will consume. This step gets the most exhaustive test list.

```text
Implement the core tick for Coil: one logical step of the game, pure and deterministic given an injected RandomPort, returning the new state plus an events array. This is the most important function in the codebase — write the full test matrix below FIRST, then implement.

File: /src/engine/tick.ts
Export:
  function tick(state: GameState, config: GameConfig, rng: RandomPort): TickResult;  // { state, events }

Reuse computeNextHead, resolveWall (movement.ts), computeTickMs (speed.ts), and spawnFood (food.ts).

Algorithm (FR-S1, FR-D1/2/3, FR-F3/4, FR-SC1, §7.3) — only runs meaningfully when status is RUNNING:
1. Commit direction: if inputQueue is non-empty, shift its first entry into direction.
2. rawHead = computeNextHead(head, direction).
3. Wall handling via resolveWall:
   - SOLID + OUT_OF_BOUNDS => events ['DIED'], status 'LOST', return.
   - PORTAL => use the wrapped IN_BOUNDS cell as nextHead.
4. Determine willGrow = (nextHead equals state.food).
5. Self-collision with tail-follow: build the occupied set from the snake EXCLUDING the current tail cell UNLESS willGrow is true (a non-growing snake vacates its tail this same tick, so tail-follow is safe). If nextHead is in the occupied set => events ['DIED'], status 'LOST', return.
6. Move: unshift nextHead.
   - If willGrow: keep tail (length +1); foodEaten += 1; score += pointsPerFood; tickMs = computeTickMs(base, min, accel, foodEaten); spawn new food via spawnFood; events includes 'ATE_FOOD'.
   - Else: pop tail (length unchanged).
7. Win check: if after a growth the snake fills the grid (snake.length === columns * rows, i.e., spawnFood returned null) => status 'WON', events includes 'WON'.
8. Return { state: newState, events }. All updates immutable (do not mutate the input state).

Tests (__tests__/tick.test.ts) — full matrix, all using a seeded rng and hand-built states:
- A queued direction is committed before movement; head moves exactly one cell in the committed direction.
- Non-eating tick keeps length constant (tail pops, head advances).
- Eating: head onto food grows by one, score += 10, foodEaten increments, a new food spawns on an empty cell, and tickMs decreases per the speed rule.
- Tail-follow is SAFE: head moving into the cell the tail vacates this tick does NOT kill.
- Self-collision into the body IS fatal (events include 'DIED', status 'LOST').
- SOLID: head stepping out of bounds => 'DIED' / 'LOST' on each edge.
- PORTAL: head wraps correctly on each of the four edges and continues alive.
- Full-grid fill => status 'WON', events include 'WON', and spawnFood returned null (set up a tiny grid, e.g., place the snake so one move completes it).
- tickMs never drops below minTickMs even after many foods.
- Events array correctness: exactly ['ATE_FOOD'] on a normal eat, ['DIED'] on death, includes 'WON' on the winning tick.
- The input GameState object is never mutated.

Constraints: pure, deterministic given rng, immutable updates, no React.
```

---

### Prompt 11 — Engine barrel + scripted full-game integration test

Context: This closes the engine chunk by exporting a clean public surface and proving the parts work together: a fixed-seed game played by a script to a real win on a tiny grid, asserting invariants the whole way. This is the "wire it together" step for the pure layer.

```text
Finish the Coil engine layer by creating its public barrel and a scripted, deterministic full-game integration test that exercises all engine functions together. This is the integration/wiring step for the engine — no new game rules, just composition and proof.

File: /src/engine/index.ts
- Re-export the public engine API: types, PRESETS and constants, computeGrid (+ MIN_COLUMNS/MIN_ROWS), createInitialState, enqueueDirection, tick, computeTickMs, spawnFood, and the movement helpers if useful to the runtime.

Integration test (__tests__/engine.integration.test.ts):
- Build a small GameConfig with a tiny grid (e.g., 6x6 via computeGrid or a hand-made GridSpec), SOLID walls, a seeded RandomPort, pointsPerFood 10, startLength 3.
- createInitialState, then transition status to RUNNING.
- Drive a scripted sequence of enqueueDirection + tick calls that deterministically navigates the snake to eat food repeatedly. With a fixed seed the food positions are known, so the script can be authored to reach several eats and ultimately fill the grid to a WON state.
- Assert throughout: score === foodEaten * 10; snake length === startLength + foodEaten; no duplicate cells in the snake at any point (no self-overlap while alive); food is never on the snake; tickMs is non-increasing and >= minTickMs.
- Assert the run ends in 'WON' with food === null when the grid is full.
- Add a second short scripted run that ends in 'LOST' by driving the head into the wall (SOLID) and assert status 'LOST' with a 'DIED' event.

Constraints: deterministic (seeded rng), no React, pure. After this step the entire game ruleset is implemented and proven without any UI.
```

---

### Prompt 12 — StoragePort interface, defaults & pure validators

Context: Begin the infrastructure chunk. Define the persistence contract everything else depends on, plus the defaults and the *pure* validators that guarantee corrupt/missing data degrades to defaults instead of crashing the UI. Validators are tested in isolation here; the adapter that uses them comes next.

```text
Create the StoragePort contract for Coil along with default values and pure validation functions. The validators are the safety net for corrupt/missing persisted data. Write validator tests first, then implement.

File: /src/services/StoragePort.ts
Export:
  interface StoragePort {
    getSettings(): Promise<PersistedSettings>;
    setSettings(s: PersistedSettings): Promise<void>;
    getScores(): Promise<PersistedScores>;
    setScores(s: PersistedScores): Promise<void>;
    resetScores(): Promise<void>;
  }
  const DEFAULT_SETTINGS: PersistedSettings = { presetId: 'STANDARD', wallBehavior: 'SOLID', soundEnabled: true, hapticsEnabled: true };
  const DEFAULT_SCORES: PersistedScores = { bestSolid: 0, bestPortal: 0 };
  const SETTINGS_KEY = 'coil.settings.v1';
  const SCORES_KEY = 'coil.scores.v1';
  function validateSettings(raw: unknown): PersistedSettings;   // coerce-or-default, never throws
  function validateScores(raw: unknown): PersistedScores;       // coerce-or-default, never throws

Validation rules (§8.5):
- validateSettings: require presetId in {CLASSIC,STANDARD,DENSE}, wallBehavior in {SOLID,PORTAL}, soundEnabled/hapticsEnabled booleans. Any invalid field falls back to the corresponding DEFAULT_SETTINGS value. Unknown/missing => default.
- validateScores: bestSolid/bestPortal must be non-negative integers; otherwise fall back to 0. Non-object input => DEFAULT_SCORES.

Tests (__tests__/storageValidation.test.ts) — validate EH-1:
- A well-formed settings object passes through unchanged.
- Missing keys, wrong types, and out-of-set enums each fall back to defaults field-by-field.
- A well-formed scores object passes through; negative, NaN, non-integer, or missing values fall back to 0.
- Completely invalid input (null, string, array) returns the full default object.
- Validators never throw for any input.

Constraints: validators are pure and total (handle every input). No AsyncStorage import in this file yet.
```

---

### Prompt 13 — AsyncStorage adapter

Context: The concrete `StoragePort` implementation. It serializes to the versioned keys and, crucially, validates on read so the rest of the app never sees malformed data. Tested against a mocked AsyncStorage for round-trips and corrupt fallback.

```text
Implement the AsyncStorage-backed StoragePort for Coil. It must round-trip settings/scores and fall back to defaults on corrupt or missing data by using the validators. Write tests first against a mocked AsyncStorage.

File: /src/services/asyncStorageAdapter.ts
Export:
  function createAsyncStorageAdapter(): StoragePort;

Behavior (§8):
- Depends on @react-native-async-storage/async-storage (install it).
- getSettings: read SETTINGS_KEY, JSON.parse inside try/catch, run validateSettings, return result. On any read/parse error, return DEFAULT_SETTINGS (and optionally rewrite the key with defaults).
- getScores: same pattern with SCORES_KEY and validateScores / DEFAULT_SCORES.
- setSettings/setScores: JSON.stringify and write to the respective versioned key.
- resetScores: write DEFAULT_SCORES to SCORES_KEY.
- Reads must never throw into the caller. Writes may reject; let the rejection propagate (the store layer will handle retry/in-memory) but do not crash on read.

Tests (__tests__/asyncStorageAdapter.test.ts) — mock @react-native-async-storage/async-storage:
- Round-trip: setSettings then getSettings returns an identical object; same for scores.
- Corrupt JSON stored at a key => getSettings/getScores returns the defaults, no throw.
- Missing key => returns defaults.
- An out-of-set enum or negative score persisted => read returns sanitized defaults via the validators.
- resetScores writes DEFAULT_SCORES (verify the serialized value).

Constraints: implement against the StoragePort interface exactly; reuse the validators and keys from StoragePort.ts.
```

---

### Prompt 14 — HapticsPort & SoundPort (+ guarded/silent impls)

Context: The two remaining infra ports. Haptics fire on eat/death but must no-op safely on unsupported devices; the sound system is wired but silent in the MVP. The toggle gating lives upstream in the controller — these impls just must never crash.

```text
Create the HapticsPort and SoundPort abstractions for Coil with safe MVP implementations: haptics that no-op when unavailable, and a silent-but-wired sound service. Toggle gating happens in the controller layer later; these impls must simply never throw. Tests first.

File: /src/services/HapticsPort.ts
Export:
  interface HapticsPort { eat(): void; death(): void; }
  function createExpoHaptics(): HapticsPort;   // uses expo-haptics, each call wrapped in try/catch
Behavior: eat() triggers a light impact; death() a heavier impact/notification. Wrap every expo-haptics call in try/catch so an unsupported device or thrown error becomes a no-op (EH-9). Install expo-haptics.

File: /src/services/SoundPort.ts
Export:
  interface SoundPort { play(event: GameEvent): void; preload(): Promise<void>; }
  function createSilentSound(): SoundPort;     // wired no-op for MVP
Behavior: createSilentSound().play() and preload() do nothing but must exist and never throw, even with missing assets (EH-10). This is the seam where real SFX drop in for Phase 2.

Tests (__tests__/ports.test.ts):
- createExpoHaptics().eat()/death() do not throw when the underlying expo-haptics module is mocked to throw.
- createExpoHaptics() calls the expected expo-haptics API when the mock succeeds (assert it was invoked).
- createSilentSound().play(...) and preload() resolve/return without throwing for every GameEvent value.

Constraints: implement against the interfaces exactly; no toggle logic here (that's the controller's job).
```

---

### Prompt 15 — Settings store (Zustand + storage)

Context: Begin the state chunk. A Zustand store for preset/wall/sound/haptics that hydrates asynchronously (render defaults first per NFR-3) and persists on every change through the injected `StoragePort`.

```text
Implement the settings store for Coil using Zustand, backed by an injected StoragePort. It renders defaults immediately and hydrates asynchronously, persisting on every change. Tests first.

File: /src/state/useSettingsStore.ts
Export a Zustand store hook with:
  state: { presetId: PresetId; wallBehavior: WallBehavior; soundEnabled: boolean; hapticsEnabled: boolean; hydrated: boolean; }
  actions:
    hydrate(storage: StoragePort): Promise<void>   // load persisted settings, set state, set hydrated true
    setPreset(p: PresetId): void                    // update + persist
    setWall(w: WallBehavior): void                  // update + persist
    setSound(on: boolean): void                     // update + persist
    setHaptics(on: boolean): void                   // update + persist
Initial state uses DEFAULT_SETTINGS and hydrated=false. Each setter updates state synchronously, then calls storage.setSettings with the full current PersistedSettings (fire-and-forget; on reject keep the in-memory value — do not block, EH-2). Accept the StoragePort via an init/configure step or a module-level setter so tests can inject a mock.

Tests (__tests__/settingsStore.test.ts) with a mock StoragePort:
- Before hydrate, state equals DEFAULT_SETTINGS and hydrated is false.
- hydrate loads persisted values and flips hydrated true.
- Each setter updates state and calls storage.setSettings with the expected object.
- A rejected setSettings does not throw and leaves the in-memory value intact.

Constraints: persistence behind the StoragePort interface only. No direct AsyncStorage import here.
```

---

### Prompt 16 — Scores store (Zustand + storage + record-run logic)

Context: The high-score store, with the spec's subtle rules: separate Solid/Portal bests, only completed runs update them, new-best detection drives the "New Best!" UI, and the in-memory value updates immediately even if the write fails (EH-3).

```text
Implement the high-scores store for Coil using Zustand, backed by an injected StoragePort, including the record-run logic that updates only on completed runs and detects a new best. Tests first.

File: /src/state/useScoresStore.ts
Export a Zustand store hook with:
  state: { bestSolid: number; bestPortal: number; hydrated: boolean; }
  actions:
    hydrate(storage: StoragePort): Promise<void>
    recordRun(wall: WallBehavior, score: number): { isNewBest: boolean }   // call ONLY on a completed run (win/loss)
    reset(storage: StoragePort): Promise<void>
Behavior (FR-SC3/4, §8.4):
  - recordRun compares score to the relevant best (bestSolid for SOLID, bestPortal for PORTAL). If score > best, update that field IN MEMORY immediately and persist via storage.setScores (fire-and-forget; on reject keep in-memory, EH-3), and return { isNewBest: true }. Otherwise return { isNewBest: false } and persist nothing.
  - reset sets both bests to 0 in memory and calls storage.resetScores.
  - hydrate loads persisted bests and flips hydrated.
  Forfeits/quits must NOT call recordRun (that contract is enforced by callers).

Tests (__tests__/scoresStore.test.ts) with a mock StoragePort:
- recordRun with a higher SOLID score updates bestSolid only, returns isNewBest true, and persists.
- recordRun with a score below the current best updates nothing and returns isNewBest false.
- SOLID and PORTAL bests are tracked independently.
- The in-memory best updates even if storage.setScores rejects (no throw).
- reset zeroes both bests and calls storage.resetScores.
- hydrate loads persisted values and sets hydrated true.

Constraints: persistence behind StoragePort only.
```

---

### Prompt 17 — Skin system (Skin interface + greenOnBlack + provider/hook)

Context: The visual-tokens seam. The MVP ships exactly one skin, but it must ship *through* the skin system so Phase 2 skins need no rendering changes. Renderers will read tokens from the active skin via a hook.

```text
Implement the skin system for Coil: a Skin token interface, the green-on-black MVP skin delivered THROUGH the system, and a provider + hook so renderers read tokens from the active skin. Tests first.

File: /src/skins/Skin.ts
Export:
  interface Skin {
    id: string;
    background: string;          // board background color
    gridLine: string | null;     // grid line color, or null for none
    cellGap: number;             // px gap between cells
    cellShape: 'square' | 'rounded';
    snakeHead: string;           // brighter than body
    snakeBody: string;
    foodColor: string;
    foodShape: 'square' | 'circle';
  }

File: /src/skins/greenOnBlack.ts
Export const greenOnBlack: Skin — black background, bright green head, a dimmer green body (head visibly brighter than body), green food, square cells with a small gap, faint or null grid lines (FR-A4/A5).

File: /src/skins/SkinProvider.tsx
Export:
  a React context provider <SkinProvider> defaulting its value to greenOnBlack
  a hook useSkin(): Skin
Tests (__tests__/skin.test.tsx) with RNTL:
- useSkin returns greenOnBlack tokens when rendered inside SkinProvider with no override.
- snakeHead differs from snakeBody (document the "head brighter than body" intent and assert they are not equal).
- All required Skin fields are present and typed correctly on greenOnBlack.

Constraints: the MVP must consume the skin via useSkin everywhere it renders — no hard-coded colors in renderers later.
```

---

### Prompt 18 — Mode interface + classicMode config builder

Context: The mode seam. For the MVP, `classicMode` mainly assembles a `GameConfig` from the chosen preset + wall + computed grid and delegates rules to the pure engine. Wall behavior is config, not a separate mode. Consumed by the `GameController` next.

```text
Implement the Mode seam for Coil and the classicMode that builds a GameConfig and delegates rules to the engine. Wall behavior is passed as config (not a separate mode). Tests first.

File: /src/modes/Mode.ts
Export:
  interface Mode {
    id: string;
    buildConfig(grid: GridSpec, wall: WallBehavior, preset: Preset): GameConfig;
    createInitialState(config: GameConfig, rng: RandomPort): GameState;
    tick(state: GameState, config: GameConfig, rng: RandomPort): TickResult;
  }

File: /src/modes/classicMode.ts
Export const classicMode: Mode where:
  - id = 'CLASSIC'.
  - buildConfig returns { grid, wallBehavior: wall, baseTickMs: preset.baseTickMs, minTickMs: preset.minTickMs, accelMsPerFood: preset.accelMsPerFood, pointsPerFood: POINTS_PER_FOOD, startLength: START_LENGTH, startDirection: START_DIRECTION }.
  - createInitialState and tick delegate directly to the engine's createInitialState and tick.

Tests (__tests__/classicMode.test.ts):
- buildConfig maps each preset's tunables and the chosen wall into the GameConfig correctly, with pointsPerFood 10, startLength 3, startDirection 'RIGHT'.
- classicMode.createInitialState and classicMode.tick produce the same results as calling the engine functions directly (delegation, not reimplementation).

Constraints: do not reimplement engine logic — delegate. This is the runtime's single entry point to game rules.
```

---

### Prompt 19 — GameController (authoritative state ref + side-effect dispatch)

Context: The first runtime-glue step and the second-highest test-risk area after `tick`. It owns the authoritative state in a mutable ref (not React state, to avoid per-tick re-renders), routes input/lifecycle transitions, and dispatches engine events to haptics/sound/scores — gated by the settings toggles. Tested with fake timers and mock ports.

```text
Implement the GameController for Coil: the runtime object that holds authoritative game state in a mutable ref, advances it via the Mode/engine, dispatches engine events to services and stores (respecting toggles), and exposes lifecycle methods. Use no React state for the per-tick game state. Tests first, with mock ports/stores and a seeded rng.

File: /src/runtime/GameController.ts
Export a factory:
  function createGameController(deps: {
    mode: Mode;
    config: GameConfig;
    rng: RandomPort;
    haptics: HapticsPort;
    sound: SoundPort;
    isHapticsEnabled: () => boolean;   // reads settings store
    isSoundEnabled: () => boolean;     // reads settings store
    recordRun: (wall: WallBehavior, score: number) => { isNewBest: boolean };  // scores store
    onState: (state: GameState) => void;        // notify renderer/UI of a new state
    onTerminal: (state: GameState, isNewBest: boolean) => void;  // WON or LOST reached
  }): GameController;

GameController surface:
  getState(): GameState
  tapToStart(): void          // TAP_TO_START -> COUNTDOWN (does not start motion)
  setRunning(): void          // COUNTDOWN -> RUNNING (called when countdown completes)
  enqueue(dir: Direction): void   // routes through engine enqueueDirection while RUNNING
  step(): void                // one engine tick: advance state, dispatch events, notify
  pause(): void               // RUNNING -> PAUSED
  resume(): void              // PAUSED -> COUNTDOWN
  restart(): void             // -> fresh TAP_TO_START with same config
  quit(): void                // mark forfeited; must NOT call recordRun

Initialize internal state via mode.createInitialState. Hold it in a closure variable (the "ref").
step() behavior:
  - Only advances when status is RUNNING. Call mode.tick, replace internal state, call onState.
  - For each event: 'ATE_FOOD' => if isHapticsEnabled() haptics.eat(); sound.play('ATE_FOOD'); (score already in state). 'DIED' => if isHapticsEnabled() haptics.death(); sound.play('DIED'). 'WON' => sound.play('WON').
  - On reaching a terminal status this step (WON or LOST), call recordRun(config.wallBehavior, state.score) exactly once, capture isNewBest, and call onTerminal(state, isNewBest).
  - quit() sets an internal forfeited flag and transitions toward Home WITHOUT calling recordRun (FR-P6).

Tests (__tests__/gameController.test.ts) with mock haptics/sound, a mock recordRun, toggle stubs, and a seeded rng:
- enqueue routes to the engine (a queued legal turn changes the committed direction after the next step).
- step advances state and calls onState.
- ATE_FOOD fires haptics.eat only when isHapticsEnabled() is true (verify both true and false), and always calls sound.play('ATE_FOOD').
- Reaching LOST calls recordRun once and onTerminal with the score; reaching WON likewise.
- quit() does NOT call recordRun even though a run was in progress.
- tapToStart moves TAP_TO_START -> COUNTDOWN without advancing the snake; setRunning -> RUNNING.
- restart() yields a fresh TAP_TO_START state with the same config (snake length back to startLength, score 0).

Constraints: authoritative game state must live in the ref/closure, never in React state. Side effects only through the injected ports/stores.
```

---

### Prompt 20 — useGameLoop (single-timer scheduler)

Context: The scheduler, and the place double-timer and stale-tickMs bugs live. It self-reschedules with `setTimeout`, reads the *current* `tickMs` each step so acceleration takes effect immediately, keeps exactly one timer in a ref, clears before scheduling and on unmount, and only runs while RUNNING. Tested with Jest fake timers.

```text
Implement the useGameLoop hook for Coil: a self-rescheduling, single-timer scheduler that drives the GameController's step() while the game is RUNNING and reads the current tickMs each step so acceleration applies immediately. Guarantee exactly one active timer. Tests first with Jest fake timers.

File: /src/runtime/useGameLoop.ts
Export:
  function useGameLoop(controller: GameController, isRunning: boolean): void;

Behavior (§4.3, EH-7):
- Keep the timer id in a ref. A scheduleNext() reads controller.getState().tickMs, then setTimeout(() => { controller.step(); if (controller.getState().status === 'RUNNING') scheduleNext(); else stop; }, tickMs).
- Always clearTimeout the stored id before scheduling a new one (single-timer invariant), and clear on unmount.
- Start the loop when isRunning becomes true and the controller is RUNNING; stop and clear when isRunning is false or status leaves RUNNING.
- Never schedule while status is not RUNNING (PAUSED/COUNTDOWN/TAP_TO_START/WON/LOST).

Tests (__tests__/useGameLoop.test.tsx) with jest.useFakeTimers() and a fake controller whose getState returns a controllable status/tickMs and whose step() is a spy:
- Advancing time by tickMs invokes controller.step() exactly once per interval while RUNNING.
- Changing the controller's reported tickMs shortens/lengthens the next scheduled delay (assert the next step fires at the new interval).
- When status flips to PAUSED (or isRunning becomes false), no further step() calls occur after the current timer.
- Unmounting clears the timer (no step() after unmount).
- The single-timer invariant holds: at most one pending timer at any moment (e.g., spy on setTimeout/clearTimeout counts, or assert only one step per interval even after rapid isRunning toggles).

Constraints: exactly one timer; read tickMs fresh each step; clean up on unmount. No per-tick React state churn.
```

---

### Prompt 21 — useAppStatePause + countdown controller

Context: Lifecycle correctness. App backgrounding while RUNNING must auto-pause; resume/tap runs a 3-second countdown before motion; backgrounding *during* the countdown cancels it and stays paused (EH-6). Tested with mocked AppState and fake timers.

```text
Implement two runtime hooks for Coil: auto-pause on app focus loss, and the 3-second resume/start countdown. Backgrounding during the countdown cancels it and leaves the game paused. Tests first with a mockable AppState and fake timers.

File: /src/runtime/useAppStatePause.ts
Export:
  function useAppStatePause(controller: GameController): void;
Behavior (FR-P2): subscribe to React Native AppState. When the app transitions to 'background' or 'inactive' while controller.getState().status === 'RUNNING', call controller.pause(). Unsubscribe on unmount.

File: /src/runtime/useCountdown.ts
Export:
  function useCountdown(opts: { active: boolean; seconds?: number; onComplete: () => void; }): { remaining: number };
Behavior (FR-P4, EH-6): when active becomes true, count down from seconds (default 3) once per second; on reaching 0 call onComplete. If active becomes false (e.g., app backgrounded -> status left COUNTDOWN), cancel the countdown timer and reset. Keep a single timer in a ref and clear on unmount.

Wiring expectation (documented, exercised in the Game screen later): tapToStart/resume set status to COUNTDOWN; the Game screen renders useCountdown with active = (status === 'COUNTDOWN') and onComplete = controller.setRunning.

Tests:
- (__tests__/useAppStatePause.test.tsx) Mock AppState; emitting 'background' while RUNNING calls controller.pause(); emitting 'background' while already PAUSED does nothing; unmount unsubscribes.
- (__tests__/useCountdown.test.tsx) With fake timers: from active=true, remaining ticks 3 -> 2 -> 1 and onComplete fires at 0; flipping active to false mid-count cancels the timer and onComplete is NOT called; unmount clears the timer.

Constraints: single timer each, cleaned up on unmount; never call pause() unless currently RUNNING.
```

---

### Prompt 22 — Board + DynamicLayer (Skia rendering)

Context: Begin the rendering chunk. A static grid layer drawn once per size/game, and a dynamic snake+food layer redrawn each state push — both reading tokens from the active skin. State is authoritative; the canvas is a pure projection (EH-12/13).

```text
Implement the Skia rendering for Coil: a static grid background layer and a dynamic snake/food layer, both reading visual tokens from the active skin via useSkin. The renderer is a pure projection of state — it never mutates game state. Tests first (pragmatic for canvas).

Install @shopify/react-native-skia.

File: /src/render/Board.tsx
Export <Board gridSpec={GridSpec}> — draws the static layer: background fill (skin.background), the grid cells/gridlines honoring skin.cellGap, skin.cellShape, and skin.gridLine (null => no lines), sized and positioned from gridSpec (cellSize, originX, originY). This layer depends only on gridSpec + skin, so it can be memoized and redrawn only on size/skin change.

File: /src/render/DynamicLayer.tsx
Export <DynamicLayer gridSpec={GridSpec} snake={Cell[]} food={Cell | null}> — draws the snake (snake[0] head in skin.snakeHead, body cells in skin.snakeBody, so the head is visibly brighter) and the food (skin.foodColor, skin.foodShape) using gridSpec geometry. Redraws each render from the passed state.

Both components convert a Cell (x,y) to pixels via originX + x*cellSize and originY + y*cellSize, insetting by skin.cellGap.

Tests (__tests__/render.test.tsx) with RNTL (canvas assertions are limited, so keep these pragmatic):
- <Board> mounts without crashing for a representative gridSpec inside a SkinProvider.
- <DynamicLayer> mounts without crashing and accepts a snake of length 3 and a food cell, and also food === null.
- Rendering with a longer snake vs a shorter snake does not throw (parameterize length).
- No game-state object passed in is mutated by rendering (pass a frozen snake array and assert no error).

Constraints: read ALL colors/shapes/gaps from useSkin — no hard-coded visual values. Separate static vs dynamic layers as specified for performance on the Dense preset.
```

---

### Prompt 23 — SwipeInput + InputSource

Context: The input seam plus its MVP implementation. A pure `translationToDirection` helper carries the 30px threshold and dominant-axis logic so it's unit-testable without gestures; `SwipeInput` wraps gesture-handler and implements `InputSource`. The interface lives here with its first implementer to avoid an orphan.

```text
Implement swipe input for Coil behind an InputSource interface, with a pure translation->Direction helper that encodes the 30px threshold so it can be unit-tested without gestures. Tests first.

Install react-native-gesture-handler (and ensure the root is wrapped in GestureHandlerRootView in the app layout later).

File: /src/input/InputSource.ts
Export:
  interface InputSource {
    // emits Direction events to a subscriber; returns an unsubscribe function
    subscribe(onDirection: (dir: Direction) => void): () => void;
  }
  const SWIPE_THRESHOLD_PX = 30;
  function translationToDirection(dx: number, dy: number, threshold?: number): Direction | null;
Behavior of translationToDirection (FR-C1/C4): if max(|dx|,|dy|) < threshold (default SWIPE_THRESHOLD_PX) return null. Otherwise choose the dominant axis: horizontal => dx>0 ? 'RIGHT' : 'LEFT'; vertical => dy>0 ? 'DOWN' : 'UP' (y grows downward).

File: /src/input/SwipeInput.tsx
Export a component/hook that wires a react-native-gesture-handler Pan gesture covering the play area; on gesture end it calls translationToDirection(translationX, translationY) and, if non-null, emits the Direction to the GameScreen (which forwards to controller.enqueue). Expose it in a way that implements/satisfies InputSource (subscribe pattern) so a D-pad can replace it in Phase 2.

Tests (__tests__/swipeInput.test.ts):
- translationToDirection maps clear right/left/up/down swipes to the correct Direction.
- Sub-threshold movement (e.g., dx=10,dy=5) returns null.
- A diagonal picks the dominant axis (e.g., dx=40,dy=15 => RIGHT; dx=15,dy=40 => DOWN).
- Exactly-at-threshold behavior is defined and tested (>= threshold registers).

Constraints: all turn logic that matters is in the pure helper and tested there; the gesture component is a thin adapter implementing InputSource.
```

---

### Prompt 24 — PresetPreview

Context: The home-screen live preview, which must be accurate because it reuses the *same* `computeGrid` and skin tokens scaled into a small box. This proves preset density visually (Classic sparser than Dense).

```text
Implement the home-screen preset preview for Coil. It must reuse computeGrid and the skin so previews are accurate, scaled into a small box. Tests first.

File: /src/render/PresetPreview.tsx
Export <PresetPreview preset={Preset} boxWidth={number} boxHeight={number} selected={boolean}> that:
  - Calls computeGrid(boxWidth, boxHeight, preset.targetColumns) to derive a representative scaled grid.
  - Renders a miniature board using the same skin tokens (background, grid, a short sample snake of 3 cells, and a food cell) via the same geometry approach as Board/DynamicLayer (can reuse those components at small size or a shared cell-drawing helper).
  - Visually indicates the selected state (e.g., a border highlight) driven by the selected prop.

Tests (__tests__/presetPreview.test.tsx) with RNTL inside a SkinProvider:
- Renders without crashing for CLASSIC, STANDARD, and DENSE.
- The computed column count for DENSE is greater than for CLASSIC at the same box size (assert via computeGrid directly to confirm the preview reflects density).
- The selected styling differs from unselected (assert a prop/style difference).

Constraints: reuse computeGrid and useSkin — do not approximate the grid with separate logic.
```

---

### Prompt 25 — Router scaffold, providers & portrait lock

Context: Begin the screens chunk by wiring expo-router routes, mounting the providers (SkinProvider, gesture root) at the root, kicking off async store hydration on launch, and confirming portrait lock. Screens are stubs here; the next steps fill them in.

```text
Set up navigation and app-wide providers for Coil with expo-router, mounting the skin provider, the gesture root, portrait lock, and async store hydration on launch. Screens can be stubs for now. Tests first where feasible (smoke navigation).

1. /app/_layout.tsx (root layout):
   - Wrap the app in GestureHandlerRootView and <SkinProvider>.
   - On mount, inject the AsyncStorage adapter into the settings and scores stores and call their hydrate() actions (render defaults first; hydrate asynchronously — do not block first paint, NFR-3).
   - Ensure portrait lock is in effect (app.json orientation plus expo-screen-orientation lock if needed).
   - Define a stack with routes: index (Home), game, settings.
2. /app/index.tsx, /app/game.tsx, /app/settings.tsx: minimal stub screens that render a title and a navigation affordance (e.g., Home has a button to /game and a gear to /settings). Pass the selected preset + wall as route params or read from the settings store (decide and document; later steps assume params from Home).
3. Wire win/loss as routes or modal screens reachable from the game (e.g., /win and /loss, or overlays) — choose and document; the Win/Loss prompt will assume this choice.

Tests (__tests__/navigation.test.tsx) with RNTL:
- The root layout renders the Home stub without crashing.
- Tapping the Play affordance navigates toward the game route (mock the router as needed).
- Store hydration is triggered on mount (assert hydrate was called with a StoragePort).

Constraints: providers mounted once at the root; hydration must not block first paint; portrait enforced.
```

---

### Prompt 26 — HomeScreen (selection flow)

Context: The home experience and its specific flow rule: selecting a preset highlights it but does **not** auto-launch; Play launches with the selected preset + wall. Shows both high scores and the wall toggle. Tested for the FR-UI2 flow.

```text
Implement the Coil HomeScreen with the exact selection flow: choosing a preset highlights it but does NOT launch the game; the wall toggle is set independently; only Play launches, carrying the selected preset + wall. Tests first.

File: /src/screens/HomeScreen.tsx (rendered by /app/index.tsx)
Requirements (FR-UI1/UI2):
- Render three PresetPreview components (Classic/Standard/Dense). Tapping one selects/highlights it and updates the settings store's presetId — but does NOT navigate.
- A Solid/Portal wall toggle bound to the settings store's wallBehavior.
- Display both high scores from the scores store: best Solid and best Portal.
- A Play button that navigates to /game, passing the currently selected preset + wall (as params or via the already-updated store, consistent with the routing decision from the scaffold).
- A gear icon navigating to /settings.

Tests (__tests__/homeScreen.test.tsx) with RNTL and mocked stores/router:
- Tapping a preset highlights it and updates the store but does NOT navigate (assert router.push not called on selection).
- Tapping Play navigates to /game with the selected preset + wall.
- Both high scores render with values from the scores store.
- Toggling the wall updates the settings store's wallBehavior.

Constraints: selection and launch are separate actions (no auto-launch on select). Reuse PresetPreview and the stores.
```

---

### Prompt 27 — GameScreen (full composition + lifecycle + back handling)

Context: The big integration step where every layer comes together: compute grid from device dimensions + safe area, build config via `classicMode`, create the `GameController`, wire `useGameLoop`/`useAppStatePause`/`useCountdown`, render `Board`+`DynamicLayer`, overlay `SwipeInput`, show the score HUD, pause button, tap-to-start and countdown overlays, intercept Android back, and navigate to Win/Loss on terminal.

```text
Implement the Coil GameScreen: the full composition of engine + controller + loop + lifecycle + rendering + input. This is the central integration. Tests first for the key behaviors.

File: /src/screens/GameScreen.tsx (rendered by /app/game.tsx)
Composition:
- Read the selected preset (from PRESETS) and wallBehavior (from params/store).
- Compute the grid: use useWindowDimensions and safe-area insets to derive screenWidth and playAreaHeight (screen height minus the score bar and safe areas), then computeGrid. Recompute on dimension change (EH/foldables).
- Build config via classicMode.buildConfig(grid, wall, preset).
- Create a GameController via createGameController, injecting: classicMode, config, a Math.random RandomPort (production), createExpoHaptics(), createSilentSound(), isHapticsEnabled/isSoundEnabled from the settings store, recordRun from the scores store, onState (push to the dynamic renderer), and onTerminal (navigate to /win or /loss with score + isNewBest + the current settings).
- Hold the rendered snake/food in a minimal piece of React state updated via onState (only what the dynamic layer needs), keeping the authoritative state in the controller.
- useGameLoop(controller, isRunning = status === 'RUNNING'); useAppStatePause(controller); useCountdown({ active: status === 'COUNTDOWN', seconds: 3, onComplete: controller.setRunning }).
- Render <Board gridSpec> (static) + <DynamicLayer gridSpec snake food> (dynamic), a score HUD, and a small pause button in a corner.
- Overlay SwipeInput across the play area; on a Direction, call controller.enqueue.
- Tap-to-start overlay when status === 'TAP_TO_START' (a tap calls controller.tapToStart). Countdown overlay (3..2..1) when status === 'COUNTDOWN' using useCountdown's remaining; board stays visible (FR-P5).
- Pause button -> controller.pause() (loop suspends). 
- Android hardware back (EH-11): intercept via BackHandler to open the pause overlay / quit-confirm instead of popping the stack and silently forfeiting.

Tests (__tests__/gameScreen.test.tsx) with RNTL, fake timers, mocked stores/router, and a seeded or mocked rng:
- On mount, status is TAP_TO_START and the snake is rendered; a tap moves to COUNTDOWN.
- Countdown completion (advance 3s) transitions to RUNNING and the loop begins (snake advances over subsequent ticks).
- Eating updates the score HUD (drive the snake onto food via enqueue + tick advancement).
- The pause button sets status PAUSED and the loop stops (no further ticks advance the snake).
- Android back press opens the pause/quit overlay and does NOT pop the route.
- Reaching a terminal status calls the navigation to /win or /loss with score and isNewBest.

Constraints: authoritative state stays in the controller; only minimal projection state in React. All side effects via injected ports/stores. Reuse every prior module — nothing here should reimplement engine, loop, or render logic.
```

---

### Prompt 28 — PauseOverlay + WinScreen + LossScreen

Context: The pause and end-of-run surfaces with their exact contracts: pause offers Resume (→ countdown), Restart (→ fresh tap-to-start), Quit (→ Home, forfeit, no score); win/loss show final score, the relevant high score, "New Best!" only when beaten, Play Again (same settings), and Home.

```text
Implement the Coil PauseOverlay and the Win/Loss screens with their exact action contracts. Tests first.

File: /src/screens/PauseOverlay.tsx
Shown over the GameScreen when status === 'PAUSED' (manual or auto-pause). Board remains visible behind it (FR-P5). Actions (FR-P3, FR-P6):
- Resume -> controller.resume() (which sets COUNTDOWN; the GameScreen's useCountdown then resumes motion).
- Restart -> controller.restart() (fresh TAP_TO_START, same config).
- Quit to Home -> controller.quit() then navigate to Home. This MUST forfeit: no recordRun is called (the controller already guarantees quit() skips scoring).

Files: /src/screens/WinScreen.tsx and /src/screens/LossScreen.tsx (reachable per the routing decision, receiving score, isNewBest, and the settings used).
Requirements (FR-UI4):
- Show the final score and the relevant high score (Solid or Portal best, matching the run's wall).
- Show "New Best!" only when isNewBest is true.
- Win screen shows the "Perfect!" framing for a full-grid win.
- Play Again -> start a new game with the SAME preset + wall settings (navigate back into /game with the same params).
- Home -> navigate to Home.
- Score-only stats (no extended stats in MVP).

Tests (__tests__/endScreens.test.tsx) with RNTL and mocked controller/router:
- PauseOverlay Resume calls controller.resume; Restart calls controller.restart; Quit calls controller.quit and navigates Home WITHOUT recording a score (assert recordRun not called).
- WinScreen/LossScreen render the final score and the relevant high score.
- "New Best!" appears only when isNewBest is true (test both branches).
- Play Again navigates to /game with the same preset + wall.

Constraints: Quit forfeits (no score); reuse the controller's guarantees. Same-settings replay must round-trip the original preset + wall.
```

---

### Prompt 29 — SettingsScreen

Context: The settings surface: independent Sound and Haptics toggles (persisted), Reset High Scores behind a confirmation dialog, and an About/version line. Toggles and reset write through the stores/storage.

```text
Implement the Coil SettingsScreen with persisted toggles, a confirm-guarded high-score reset, and an about/version line. Tests first.

File: /src/screens/SettingsScreen.tsx (rendered by /app/settings.tsx)
Requirements (FR-UI5, FR-A3):
- A Sound toggle bound to the settings store's soundEnabled (updates + persists).
- A Haptics toggle bound to the settings store's hapticsEnabled (updates + persists). These are independent toggles.
- A "Reset High Scores" button that opens a confirmation dialog; only on confirm does it call the scores store's reset (which clears both bests and persists defaults). Cancel does nothing.
- An About section showing the app name and version (read version from app config / expo-constants).
- A back affordance to Home.

Tests (__tests__/settingsScreen.test.tsx) with RNTL and mocked stores:
- Toggling Sound updates soundEnabled and persists (storage.setSettings called); same for Haptics, independently.
- Reset High Scores requires confirmation: tapping it shows the dialog; confirming calls scores.reset; cancelling does not.
- The version string renders.

Constraints: toggles persist through the settings store; reset goes through the scores store's reset (which uses resetScores on the port).
```

---

### Prompt 30 — Final integration & acceptance pass

Context: The capstone. No new game logic — only end-to-end wiring verification, the six preset×wall combinations, persistence-survives-relaunch confirmation, haptics/sound gating end to end, dead-code sweep, an optional Maestro smoke flow, and a checklist against the Definition of Done.

```text
Final integration and acceptance pass for Coil. Do NOT add new game features. Verify the whole system is wired, persistent, and crash-free, and confirm it against the Definition of Done. Add only glue, an optional E2E smoke flow, and a verification checklist.

1. Entry & providers: confirm the root layout mounts SkinProvider + GestureHandlerRootView, hydrates both stores on launch (defaults first), and enforces portrait. Confirm the full navigation graph: Home -> Game (tap-to-start -> countdown -> play -> win/loss) -> Play Again / Home, and Home <-> Settings.
2. Six combinations: add a test or documented manual matrix confirming all 3 presets x {Solid, Portal} launch and play correctly, and that scoring updates the correct wall-specific best.
3. Persistence across relaunch: with mocked storage, simulate app restart (re-create stores + re-hydrate) and assert last-used settings (preset + wall + toggles) and both high scores are restored. Corrupt/missing storage must degrade to defaults with no crash (reuse the validator behavior).
4. Side-effect gating end to end: confirm haptics fire on eat/death only when the Haptics toggle is on, and the silent sound service is invoked without errors regardless.
5. Lifecycle: confirm auto-pause on background, the 3-second resume countdown, countdown cancellation on background during countdown, and Android hardware back opening pause/quit (not silently forfeiting) — via the existing hooks' tests plus one integrated GameScreen lifecycle test if not already covered.
6. Dead-code sweep: ensure every module created in earlier steps is imported and used somewhere in the running app (engine via controller, ports via controller/stores, skin via renderers, InputSource via SwipeInput in GameScreen, Mode via GameScreen). Remove or wire anything orphaned.
7. Optional: add a Maestro flow for the smoke path home -> play -> die -> play again -> home.
8. Produce a checklist mapping each Definition of Done item (1-10) and each FR-/EH- id to the test(s) or screen(s) that satisfy it, and note any Open Tuning Items left at their starting values.

Tests: an integration test (__tests__/acceptance.test.tsx) covering the relaunch-persistence round-trip and at least one full Home -> play -> terminal -> Play Again loop with mocked timers/rng. Keep engine coverage high; UI coverage pragmatic on these flows.

Constraints: this step only wires, verifies, and documents. The suite must be fully green and the app must build and run on both Android and iOS via Expo.
```

---

## 6. Dependency map (quick reference)

```
1 scaffold
2 types/presets ──────────────┐
3 grid ◄── 2                   │
4 RandomPort                   │
5 speed ◄── 2                  │
6 food ◄── 2,3,4               │
7 input ◄── 2                  │
8 createInitialState ◄── 2,3,6 │
9 movement ◄── 2               │
10 tick ◄── 2,5,6,9            │
11 engine barrel ◄── 3..10     │  (engine complete & proven)
12 StoragePort+validators ◄── 2
13 asyncStorage adapter ◄── 12
14 haptics/sound ports ◄── 2
15 settings store ◄── 12
16 scores store ◄── 12
17 skin system ◄── (standalone, used by render)
18 mode/classicMode ◄── 2,8,10
19 GameController ◄── 14,16,18
20 useGameLoop ◄── 19
21 appstate+countdown ◄── 19
22 Board/DynamicLayer ◄── 2,17
23 SwipeInput/InputSource ◄── 2
24 PresetPreview ◄── 3,17,22
25 router/providers ◄── 13,15,16,17
26 HomeScreen ◄── 15,16,24,25
27 GameScreen ◄── 18,19,20,21,22,23,25  (central integration)
28 Pause/Win/Loss ◄── 19,27
29 SettingsScreen ◄── 15,16,25
30 final acceptance ◄── all
```

Every arrow points from a step to the earlier steps it depends on. No step depends on anything built later, which is what lets each prompt assume its predecessors exist and stay green.