# Coil — Comprehensive Technical Specification (MVP)

> **Working title:** *Coil*
> **Document type:** Developer-ready technical specification
> **Status:** Ready for implementation
> **Platforms:** Android + iOS · **Framework:** React Native (Expo, managed) · **Language:** TypeScript

---

## Table of Contents
1. [Overview & Goals](#1-overview--goals)
2. [Scope: MVP vs Phase 2](#2-scope-mvp-vs-phase-2)
3. [Functional Requirements](#3-functional-requirements)
4. [System Architecture](#4-system-architecture)
5. [Core Data Model & Types](#5-core-data-model--types)
6. [Grid Sizing Algorithm](#6-grid-sizing-algorithm)
7. [Game Logic (Engine Specification)](#7-game-logic-engine-specification)
8. [Data Handling & Persistence](#8-data-handling--persistence)
9. [Error Handling Strategies](#9-error-handling-strategies)
10. [Non-Functional Requirements](#10-non-functional-requirements)
11. [Testing Plan](#11-testing-plan)
12. [Acceptance Criteria / Definition of Done](#12-acceptance-criteria--definition-of-done)
13. [Phase-2 Architectural Hooks](#13-phase-2-architectural-hooks)
14. [Open Tuning Items](#14-open-tuning-items)

---

## 1. Overview & Goals

Coil is a retro-styled mobile Snake game for Android and iOS. The defining feature is a rectangular grid that adapts to fill the screen, with player-selectable grid density (three presets) and two wall behaviors (Solid / Portal). The MVP ships a single, polished **Classic mode**.

**Guiding principles**
- **Retro feel first** — chunky, nostalgic, satisfying.
- **Maximize the grid** — minimal permanent on-screen UI competing with the play area.
- **Build for extensibility** — input method, mode rules, skins, and persistence are all abstracted behind interfaces so phase-2 features require no rewrites.
- **Testable core** — all game rules live in a pure, framework-agnostic engine that can be unit-tested without React Native.

---

## 2. Scope: MVP vs Phase 2

### In scope (MVP)
- Classic mode, portrait-only, fully offline.
- Aspect-ratio adaptive grid with 3 presets (Classic / Standard / Dense).
- Swipe controls with reversal protection, a 2-deep input queue, and a 30px threshold.
- Moderate base speed with capped gradual acceleration.
- Solid / Portal wall toggle, scored separately (2 high scores).
- One food at a time, grow-by-one, win on full grid.
- Pause system (button + auto-pause), 3-second resume countdown.
- Home, Game, Pause, Win, Loss, Settings screens.
- Single green-on-black skin delivered **through** the skin system.
- Haptics live; audio scaffolded but silent.
- Local persistence of high scores + last-used settings.

### Deferred (Phase 2) — architecture must accommodate
Dynamic Walls mode · GPS/off-screen mode · bonus food · on-screen D-pad · real SFX + background music · additional skins + skin-selection UI · Firebase auth + online leaderboards · extended end-screen stats.

---

## 3. Functional Requirements

Each requirement is given an ID for traceability against the testing plan.

### 3.1 Grid
- **FR-G1** The grid is aspect-ratio adaptive: it computes columns/rows to fill the screen while keeping **square cells**.
- **FR-G2** Three presets, anchored to a target column count: **Classic ≈ 10**, **Standard ≈ 16**, **Dense ≈ 24**. Row count is derived from the screen aspect ratio.
- **FR-G3** Snake and food scale with the selected preset's cell size.
- **FR-G4** Each preset shows a live preview on the home screen.

### 3.2 Controls
- **FR-C1** Swipe up/down/left/right anywhere on screen turns the snake.
- **FR-C2** A swipe opposite the current heading is ignored (reversal protection).
- **FR-C3** Inputs are queued, capped at 2 (current + one buffered).
- **FR-C4** A swipe must travel ≥ 30px to register.
- **FR-C5** Input handling is abstracted behind an interface to allow a future D-pad.

### 3.3 Movement & Speed
- **FR-S1** Snake moves one cell per tick.
- **FR-S2** Base speed is moderate; tick interval shortens gradually as food is eaten, capped at a minimum interval.
- **FR-S3** Base speed and acceleration curve are tunable per preset.

### 3.4 Mode & Walls
- **FR-M1** MVP ships Classic mode only; "mode" is a pluggable abstraction.
- **FR-M2** Wall behavior toggle on the home screen: **Solid** (edge = death) or **Portal** (wrap-around).

### 3.5 Scoring & High Scores
- **FR-SC1** Each food = **10 points**; no bonus mechanic in MVP.
- **FR-SC2** Score is preset-independent.
- **FR-SC3** Two high scores tracked: best Solid, best Portal. Preset does not affect tracking.
- **FR-SC4** Only completed runs (win/loss) update high scores; forfeits do not.

### 3.6 Food
- **FR-F1** Exactly one food on the grid at a time.
- **FR-F2** Food spawns on a random empty cell (never on snake or wall).
- **FR-F3** Eating grows the snake by one cell; a new food spawns immediately.
- **FR-F4** Filling the entire grid = win ("Perfect!").

### 3.7 Death & Start
- **FR-D1** Self-collision is fatal in both wall modes.
- **FR-D2** Wall collision is fatal in Solid mode; wraps in Portal mode.
- **FR-D3** Tail-follow is safe (head may enter the cell the tail vacates on the same tick).
- **FR-D4** New game: snake starts rightward, centered, 3 cells long.
- **FR-D5** Game begins on **Tap to start**; snake is stationary until the tap.

### 3.8 Pause
- **FR-P1** Small pause button in a corner of the game screen.
- **FR-P2** Auto-pause on app focus loss (call, app switch, lock).
- **FR-P3** Pause screen actions: Resume, Restart, Quit to Home.
- **FR-P4** Resume triggers a 3-second countdown before motion restarts.
- **FR-P5** Board stays visible while paused.
- **FR-P6** Quit to Home mid-game forfeits the run (no score saved).

### 3.9 Screens
- **FR-UI1** Home: 3 preset previews, wall toggle, both high scores, Play button, gear icon → Settings.
- **FR-UI2** Home start flow: select/highlight preset → set wall toggle → tap Play (selecting a preset does not auto-launch).
- **FR-UI3** Game: grid, snake, food, live score, pause button.
- **FR-UI4** Win & Loss screens: final score, relevant high score, "New Best!" when beaten, Play Again (same settings) + Home. Score-only stats.
- **FR-UI5** Settings: Sound toggle, Haptics toggle, Reset High Scores (with confirm dialog), About/version.

### 3.10 Audio, Haptics, Skin
- **FR-A1** Haptics fire on eat and on death (MVP).
- **FR-A2** Audio system + trigger hooks are wired but silent in MVP.
- **FR-A3** Separate Sound and Haptics toggles.
- **FR-A4** Skin system governs background, snake colors (head brighter than body), food color/shape, cell shape, grid lines.
- **FR-A5** MVP ships one skin (green-on-black, square cells with small gaps, subtle/no grid lines) implemented through the skin system.

### 3.11 Persistence
- **FR-PS1** Persist both high scores locally.
- **FR-PS2** Persist last-used settings (preset + wall toggle); restore on reopen.
- **FR-PS3** All persistence behind a storage interface; MVP is fully local/offline.

---

## 4. System Architecture

### 4.1 Layered architecture

The app is organized into four layers. The dependency rule is one-directional: **outer layers depend on inner layers, never the reverse.**

```
┌─────────────────────────────────────────────────────────┐
│  UI Layer (screens, components, navigation)              │
│  React Native views, expo-router, gesture handling       │
├─────────────────────────────────────────────────────────┤
│  Runtime Layer (React glue)                              │
│  Game loop scheduler, app-state listeners, store wiring, │
│  audio/haptics services, skin provider                   │
├─────────────────────────────────────────────────────────┤
│  Engine Layer (PURE, framework-agnostic)                 │
│  Game rules: tick, collisions, food, scoring, speed,     │
│  input queue, grid sizing. No React, no I/O. Unit-tested.│
├─────────────────────────────────────────────────────────┤
│  Infrastructure (interfaces + adapters)                  │
│  StoragePort → AsyncStorage adapter (Firebase later)     │
│  SoundPort, HapticsPort, RandomPort                      │
└─────────────────────────────────────────────────────────┘
```

**Why this split:** The Engine Layer contains all game correctness logic and is pure (deterministic given an injected RNG). This makes the bulk of the game unit-testable in plain Jest with no device/emulator, and it isolates the parts most likely to harbor subtle bugs (collision, wrap, tail-follow, food spawning).

### 4.2 Recommended tech stack

| Concern | Recommendation | Rationale |
|---------|---------------|-----------|
| Language | **TypeScript** (strict mode) | Type safety across engine/runtime boundary |
| Framework | **Expo (managed)** | Confirmed; fast builds for both stores |
| Navigation | **expo-router** | Current Expo standard (file-based; wraps React Navigation) |
| Rendering | **@shopify/react-native-skia** | High-performance canvas; smooth on Dense grids; clean fit for the skin system. *Fallback:* `react-native-svg` if the team prefers simplicity over peak performance |
| Gestures | **react-native-gesture-handler** | Robust swipe detection; Expo-supported |
| Global state | **Zustand** | Minimal boilerplate for settings/high-scores/selection; pairs cleanly with the storage port |
| Persistence | **@react-native-async-storage/async-storage** | Behind a `StoragePort` interface |
| Haptics | **expo-haptics** | Light impact on eat/death; no-ops gracefully on unsupported devices |
| Audio (scaffold) | **expo-audio** | Hooks wired now; assets added in phase 2 |
| App lifecycle | **AppState** (React Native core) | Drives auto-pause on focus loss |
| Testing | **Jest** + **React Native Testing Library**; optional **Maestro** for E2E | Engine tests are pure Jest; component tests via RNTL |

> **Rendering note:** The static grid background and the dynamic layer (snake + food) should be separated. Redraw only the dynamic layer each tick; the background grid is drawn once per game/size change. With Skia this is straightforward and keeps the Dense preset smooth on low-end devices.

### 4.3 Game loop architecture

- Authoritative game state lives in the **Engine** and is held in the runtime via a **ref/store**, *not* in high-frequency React state, to avoid re-render churn each tick.
- A **tick scheduler** advances logical state. Recommended: a self-rescheduling timer that reads the **current `tickMs`** each step (so acceleration takes effect immediately):

```
scheduleTick():
  timer = setTimeout(() => {
    state = engine.tick(state, config, rng)
    pushToRenderer(state)        // dynamic layer redraw
    fireSideEffects(state)       // haptics, (silent) sound, score update
    if (state.status === RUNNING) scheduleTick()
    else handleTerminal(state)   // WON / LOST
  }, state.tickMs)
```

- **Single source of truth for scheduling:** exactly one active timer at a time. Pausing clears it; resuming (after countdown) reschedules. Guard against double-scheduling (see §9).
- The loop is fully **suspended** while status is `PAUSED`, `COUNTDOWN`, `TAP_TO_START`, `WON`, or `LOST`.

### 4.4 Recommended project structure

```
/src
  /engine                 # PURE — no React, no I/O
    types.ts
    createInitialState.ts
    tick.ts
    input.ts              # enqueueDirection, reversal guard, queue cap
    food.ts               # spawnFood (takes injected RNG)
    speed.ts              # tick interval / acceleration curve
    grid.ts               # computeGrid (sizing algorithm)
    index.ts
  /runtime
    useGameLoop.ts        # scheduler + lifecycle
    useAppStatePause.ts   # AppState → auto-pause
    GameController.ts     # binds engine + services + store
  /render
    Board.tsx             # Skia canvas: static grid layer
    DynamicLayer.tsx      # snake + food
    PresetPreview.tsx     # home-screen preview renderer (reuses skin)
  /input
    SwipeInput.ts         # gesture-handler → Direction (implements InputSource)
    InputSource.ts        # interface (D-pad later)
  /modes
    Mode.ts               # Mode interface
    classicMode.ts        # wall behavior consumed as config
  /skins
    Skin.ts               # Skin interface
    greenOnBlack.ts       # MVP skin (= skin #1)
    SkinProvider.tsx
  /services
    StoragePort.ts        # interface
    asyncStorageAdapter.ts
    SoundPort.ts          # interface + silent MVP impl
    HapticsPort.ts        # interface + expo-haptics impl
    RandomPort.ts         # interface + Math.random impl (seedable for tests)
  /state
    useSettingsStore.ts   # Zustand: preset, wallBehavior, sound, haptics
    useScoresStore.ts     # Zustand: bestSolid, bestPortal
  /screens
    HomeScreen.tsx
    GameScreen.tsx
    PauseOverlay.tsx
    WinScreen.tsx
    LossScreen.tsx
    SettingsScreen.tsx
  /app                    # expo-router routes
/__tests__                # engine unit tests + component tests
```

### 4.5 Key abstractions (interfaces)

These four ports/interfaces are the seams that keep phase-2 work cheap:

- **`InputSource`** — emits `Direction` events. MVP impl: `SwipeInput`. Phase 2: `DPadInput`.
- **`Mode`** — defines initial state, win/lose evaluation, and any HUD. MVP impl: `classicMode` (wall behavior passed as config). Phase 2: `dynamicWallsMode`, `gpsMode`.
- **`Skin`** — defines all visual tokens. MVP impl: `greenOnBlack`. Phase 2: additional skins + selection UI.
- **`StoragePort`** — get/set/remove for typed keys. MVP impl: AsyncStorage. Phase 2: a composite local+Firebase adapter implementing the same interface.

---

## 5. Core Data Model & Types

```ts
// ---- Primitives ----
export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
export type WallBehavior = 'SOLID' | 'PORTAL';
export type PresetId = 'CLASSIC' | 'STANDARD' | 'DENSE';

export type GameStatus =
  | 'TAP_TO_START'  // grid drawn, snake placed, waiting for first tap
  | 'COUNTDOWN'     // 3..2..1 before (re)starting motion
  | 'RUNNING'
  | 'PAUSED'
  | 'WON'           // grid filled
  | 'LOST';         // collision

export interface Cell { x: number; y: number; } // x = column (0..cols-1), y = row (0..rows-1)

// ---- Grid ----
export interface GridSpec {
  columns: number;
  rows: number;
  cellSize: number;   // device px (square)
  originX: number;    // px offset to center the grid horizontally (≈0, full width)
  originY: number;    // px offset to center vertically within play area
}

// ---- Preset ----
export interface Preset {
  id: PresetId;
  label: string;          // 'Classic' | 'Standard' | 'Dense'
  targetColumns: number;  // 10 | 16 | 24 (tunable)
  baseTickMs: number;     // moderate base speed (tunable per preset)
  minTickMs: number;      // speed cap (tunable per preset)
  accelMsPerFood: number; // ms shaved per food (tunable per preset)
}

// ---- Engine configuration for one run ----
export interface GameConfig {
  grid: GridSpec;
  wallBehavior: WallBehavior;
  baseTickMs: number;
  minTickMs: number;
  accelMsPerFood: number;
  pointsPerFood: number;  // 10
  startLength: number;    // 3
  startDirection: Direction; // 'RIGHT'
}

// ---- Engine state ----
export interface GameState {
  status: GameStatus;
  snake: Cell[];          // index 0 = head
  direction: Direction;   // committed heading
  inputQueue: Direction[]; // length ≤ 2 (see input rules)
  food: Cell | null;
  score: number;
  foodEaten: number;
  tickMs: number;         // current interval (derived from foodEaten)
}

// ---- Persisted shapes (see §8) ----
export interface PersistedSettings {
  presetId: PresetId;       // default 'STANDARD'
  wallBehavior: WallBehavior; // default 'SOLID'
  soundEnabled: boolean;    // default true (scaffold)
  hapticsEnabled: boolean;  // default true
}

export interface PersistedScores {
  bestSolid: number;        // default 0
  bestPortal: number;       // default 0
}
```

### Side-effect event model
The engine's `tick` returns a new state; the runtime derives side effects by diffing or by reading flags. Recommended: `tick` also returns a small **events array** so the runtime stays decoupled from state diffing.

```ts
export type GameEvent = 'ATE_FOOD' | 'DIED' | 'WON';
export interface TickResult { state: GameState; events: GameEvent[]; }
```

`ATE_FOOD` → haptic + (silent) sound + score already updated in state.
`DIED` → haptic + (silent) sound → runtime transitions to Loss screen.
`WON` → (silent) sound → runtime transitions to Win screen.

---

## 6. Grid Sizing Algorithm

**Inputs:** `screenWidth`, `playAreaHeight` (screen height minus the score bar and safe-area insets), `targetColumns`.
**Constraints:** square cells; fill width; never exceed play-area height; enforce minimums.

```ts
const MIN_COLUMNS = 6;
const MIN_ROWS = 6;

export function computeGrid(
  screenWidth: number,
  playAreaHeight: number,
  targetColumns: number
): GridSpec {
  // 1. Cell size from target columns (full-width fit).
  const rawCell = Math.floor(screenWidth / targetColumns);
  const cellSize = Math.max(rawCell, 1);

  // 2. Derive actual counts that fit.
  const columns = Math.max(MIN_COLUMNS, Math.floor(screenWidth / cellSize));
  const rows = Math.max(MIN_ROWS, Math.floor(playAreaHeight / cellSize));

  // 3. Center the grid (letterbox any leftover px).
  const gridPxWidth = columns * cellSize;
  const gridPxHeight = rows * cellSize;
  const originX = Math.floor((screenWidth - gridPxWidth) / 2);
  const originY = Math.floor((playAreaHeight - gridPxHeight) / 2);

  return { columns, rows, cellSize, originX, originY };
}
```

**Notes**
- Recompute on mount and on any dimension change (rotation is locked, but split-screen / foldables can still change dimensions).
- The same function powers the home-screen preset previews (scaled down) so previews are accurate.
- Clamp to `MIN_COLUMNS` / `MIN_ROWS` so tiny screens can never produce a degenerate grid.

---

## 7. Game Logic (Engine Specification)

All functions are **pure**: same inputs → same outputs. Randomness is injected via `RandomPort` so tests are deterministic.

### 7.1 Initialization — `createInitialState(config): GameState`
- Place a 3-cell snake horizontally near grid center, head pointing `RIGHT` (head is the rightmost of the three).
- `direction = 'RIGHT'`, `inputQueue = []`, `score = 0`, `foodEaten = 0`, `tickMs = config.baseTickMs`.
- Spawn the first food on a random empty cell.
- `status = 'TAP_TO_START'`.

### 7.2 Input — `enqueueDirection(state, dir): GameState`
1. Determine the **reference direction**: the last entry in `inputQueue` if non-empty, else `state.direction`.
2. **Reversal guard:** if `dir` is the exact opposite of the reference, **ignore** it.
3. **No-op guard:** if `dir` equals the reference, ignore (avoids filling the queue with duplicates).
4. Otherwise push `dir`; **cap the queue at length 2** (drop the input if already full).

> Resolving the queue against the *last queued* direction (not just the committed heading) is what prevents the fast double-swipe fold-back: e.g. moving RIGHT, swipe UP then LEFT — LEFT is checked against UP (legal) so the two turns chain safely instead of reversing.

### 7.3 Tick — `tick(state, config, rng): TickResult`
Executed once per scheduled interval while `RUNNING`:

1. **Commit direction:** if `inputQueue` is non-empty, shift the first entry into `state.direction`.
2. **Compute next head** from `direction`.
3. **Wall handling:**
   - `PORTAL`: wrap coordinates modulo `columns`/`rows`.
   - `SOLID`: if next head is out of bounds → `DIED`, `status = 'LOST'`, return.
4. **Self-collision (with tail-follow rule):**
   - Determine whether the snake will grow this tick (next head == food).
   - The set of "occupied" cells to test against **excludes the current tail** *unless* the snake is growing (because a non-growing snake vacates its tail this same tick — tail-follow is safe).
   - If next head ∈ occupied set → `DIED`, `status = 'LOST'`, return.
5. **Move:** unshift next head onto `snake`.
   - If grew: keep tail (length +1); `foodEaten += 1`; `score += pointsPerFood`; recompute `tickMs = max(minTickMs, baseTickMs - accelMsPerFood * foodEaten)`; **spawn new food**.
   - Else: pop tail (length unchanged).
6. **Win check:** if after growth `snake.length === columns * rows` (grid full, `spawnFood` found no empty cell) → `WON`, `status = 'WON'`.
7. Return `{ state, events }`.

### 7.4 Food — `spawnFood(state, config, rng): Cell | null`
- Build the set of **empty cells** = all grid cells minus snake-occupied cells.
- If empty set is empty → return `null` (signals win; never random-guess in a loop).
- Otherwise pick a uniformly random empty cell via `rng`.

> **Important:** enumerate empty cells explicitly rather than repeatedly guessing random cells until one is free. On a nearly full grid, guess-and-retry can loop a very long time; explicit enumeration is O(cells) and deterministic for tests.

### 7.5 Speed — `computeTickMs(base, min, accel, foodEaten): number`
- `tickMs = max(min, base - accel * foodEaten)`.
- Monotonic non-increasing, clamped at `min`. Per-preset `base`/`min`/`accel` allow tuning.

### 7.6 Status transitions
```
TAP_TO_START --tap--> COUNTDOWN --(3s)--> RUNNING
RUNNING --pause/focus-loss--> PAUSED
PAUSED --resume--> COUNTDOWN --(3s)--> RUNNING
PAUSED --restart--> TAP_TO_START (fresh state, same config)
PAUSED --quit--> (forfeit; no score) Home
RUNNING --collision--> LOST
RUNNING --grid full--> WON
WON/LOST --play again--> TAP_TO_START (same config)
WON/LOST --home--> Home
```

---

## 8. Data Handling & Persistence

### 8.1 Storage contract — `StoragePort`

```ts
export interface StoragePort {
  getSettings(): Promise<PersistedSettings>;
  setSettings(s: PersistedSettings): Promise<void>;
  getScores(): Promise<PersistedScores>;
  setScores(s: PersistedScores): Promise<void>;
  resetScores(): Promise<void>;
}
```

The rest of the app depends only on this interface. The MVP adapter wraps AsyncStorage; a phase-2 adapter can implement the same interface against Firebase (or compose local + remote) with zero changes to game/UI code.

### 8.2 Keys & serialization

| Key | Value | Notes |
|-----|-------|-------|
| `coil.settings.v1` | JSON `PersistedSettings` | Versioned key name for forward migration |
| `coil.scores.v1` | JSON `PersistedScores` | Versioned key name |

- All values are JSON-serialized strings.
- Key names carry an explicit `.v1` suffix so a future schema change can migrate by reading `v1`, writing `v2`, and leaving a migration shim.

### 8.3 Defaults (used when a key is absent or unreadable)

```ts
const DEFAULT_SETTINGS: PersistedSettings = {
  presetId: 'STANDARD',
  wallBehavior: 'SOLID',
  soundEnabled: true,
  hapticsEnabled: true,
};
const DEFAULT_SCORES: PersistedScores = { bestSolid: 0, bestPortal: 0 };
```

### 8.4 Write timing
- **Settings:** persist on change (preset selection, wall toggle, sound/haptics toggles). Debounce rapid toggles if needed.
- **Scores:** evaluate and persist a new best **only on a completed run** (win/loss). Update the in-memory store immediately, then write through the port.
- **Reset:** `resetScores()` clears to defaults after the confirmation dialog.

### 8.5 Validation on read
Every read is validated before use:
- Parse JSON in a `try/catch`.
- Verify shape (expected keys, value types, enums within allowed sets, scores are non-negative integers).
- On any failure, fall back to the relevant default and (optionally) overwrite the corrupt key with the default. Never throw into the UI.

---

## 9. Error Handling Strategies

| # | Scenario | Strategy |
|---|----------|----------|
| EH-1 | **Storage read fails / corrupt JSON / unexpected shape** | Catch, log (dev only), fall back to defaults; optionally rewrite the key with defaults. UI proceeds normally. |
| EH-2 | **Storage write fails** | Keep the value in the in-memory store so the current session is correct; retry once on next change. Do not block gameplay or surface a hard error. A best score lost to a failed write is acceptable; a crash is not. |
| EH-3 | **High-score write fails mid-session** | In-memory best already reflects the run, so the end screen still shows "New Best!". Persist on the next successful write opportunity. |
| EH-4 | **Tiny/unusual screen → degenerate grid** | `computeGrid` clamps to `MIN_COLUMNS`/`MIN_ROWS`; cell size floored at ≥1. |
| EH-5 | **Gesture noise / accidental taps** | 30px threshold + reversal/no-op guards in `enqueueDirection`. |
| EH-6 | **App backgrounded during COUNTDOWN** | Cancel the countdown timer; remain `PAUSED`. On return, the player resumes (new countdown). |
| EH-7 | **Rapid pause/resume or remounts → multiple timers** | Single-timer invariant: store the timer id in a ref, always `clearTimeout` before scheduling, and clear on unmount. Never schedule while status ≠ `RUNNING`. |
| EH-8 | **Food spawn on near-full grid** | Explicit empty-cell enumeration; `null` result means win — never an infinite retry loop. |
| EH-9 | **Haptics unsupported / fails** | Wrap `expo-haptics` calls in `try/catch`; treat as no-op. Respect the Haptics toggle first. |
| EH-10 | **Audio asset missing (phase-2 prep)** | `SoundPort` MVP impl is a guarded no-op; missing assets can never crash. Respect the Sound toggle. |
| EH-11 | **Android hardware back button mid-game** | Intercept: open the pause overlay (or a quit-confirm) rather than popping the navigation stack and silently losing the run. |
| EH-12 | **Renderer/Skia surface lost on resume** | Re-render the static grid layer on resume; dynamic layer redraws from current state. State is authoritative, not the canvas. |
| EH-13 | **State/render desync** | The engine state is the single source of truth; the renderer is a pure projection of it. Never mutate snake/food from the view layer. |

**Logging:** development-only console logging behind a `__DEV__` guard. No telemetry/network in MVP.

---

## 10. Non-Functional Requirements

- **NFR-1 Performance:** maintain smooth rendering on the **Dense** preset on a mid-to-low-end device. No dropped ticks; no growing memory over a long session (no per-tick allocations leaking; reuse arrays where reasonable).
- **NFR-2 Responsiveness:** a registered swipe is reflected by the next tick at the latest; perceived input lag must stay minimal even near max speed.
- **NFR-3 Cold start:** app launches to an interactive home screen quickly; reading persisted settings/scores must not block first paint (load async, render with defaults, hydrate when ready).
- **NFR-4 Offline:** fully functional with no network. No runtime network calls in MVP.
- **NFR-5 Orientation:** locked to portrait app-wide.
- **NFR-6 Accessibility (baseline):** the MVP skin keeps high contrast (bright green on black). Future skins should consider color-blind-safe palettes (phase-2 note). Touch targets (pause button, Play, toggles) meet platform minimum sizes.
- **NFR-7 Battery/thermals:** loop is suspended whenever not `RUNNING`; no animation/timers run on menus or while paused.
- **NFR-8 Privacy:** no personal data collected or stored in MVP (only game settings + scores, all local).

---

## 11. Testing Plan

### 11.1 Engine unit tests (pure Jest — no RN, deterministic via injected RNG)
These are the highest-value tests and should have near-complete coverage of the engine.

| Test | Validates |
|------|-----------|
| Grid sizing produces square cells, fills width, respects play-area height, clamps to minimums | FR-G1, EH-4 |
| Initial state: 3-cell snake, centered, heading RIGHT, one food on an empty cell | FR-D4, FR-F1/2 |
| Reversal guard ignores the opposite direction (vs heading and vs last queued) | FR-C2 |
| No-op guard ignores duplicate direction | FR-C3 |
| Input queue caps at 2; third input dropped | FR-C3 |
| Double-swipe chain (RIGHT → UP → LEFT) resolves safely without reversal | FR-C2/3 |
| Tick moves head one cell in committed direction | FR-S1 |
| Eating grows by one, +10 score, foodEaten increments, new food spawns | FR-SC1, FR-F3 |
| Non-eating tick keeps length constant (tail pops) | FR-S1 |
| Tail-follow is **safe** (head into vacated tail cell does not kill) | FR-D3 |
| Self-collision into body **is** fatal | FR-D1 |
| SOLID: head out of bounds → LOST | FR-D2 |
| PORTAL: head wraps on each of the four edges | FR-D2/M2 |
| Food only ever spawns on empty cells (never snake) across many seeds | FR-F2 |
| Full-grid fill → WON; `spawnFood` returns null | FR-F4, EH-8 |
| Speed: tickMs decreases per food and never drops below minTickMs | FR-S2 |
| Scoring independent of preset (same points per food) | FR-SC2 |

### 11.2 Component / integration tests (React Native Testing Library)
| Test | Validates |
|------|-----------|
| Swipe gesture maps translation → correct Direction at ≥30px; sub-threshold ignored | FR-C1/C4 |
| Pause button → PAUSED; loop timer cleared | FR-P1 |
| AppState change to background → auto-pause | FR-P2 |
| Resume → 3-second countdown → RUNNING | FR-P4 |
| Quit to Home mid-game does not update scores | FR-P6, FR-SC4 |
| Home flow: select preset highlights; Play launches with preset + wall toggle; selecting a preset alone does not launch | FR-UI2 |
| Win/Loss screens show final + high score; "New Best!" only when beaten | FR-UI4 |
| Play Again reuses same preset + wall settings | FR-UI4 |
| Settings toggles update store and persist | FR-A3, FR-PS1 |
| Reset High Scores requires confirm; clears both bests | FR-UI5 |
| Storage round-trip: write settings/scores → read back identical | FR-PS1/2 |
| Corrupt stored value → falls back to defaults, no crash | EH-1 |

### 11.3 Manual / QA matrix
- **Devices:** at least one small and one large phone per OS (iOS + Android), including a notch/safe-area device.
- **Presets × walls:** all 3 presets × {Solid, Portal} = 6 combinations playable and correct.
- **Win path:** achievable on Classic grid; "Perfect!" shows.
- **Lifecycle:** background mid-run, incoming call, lock/unlock, app switch — all auto-pause and resume cleanly with countdown.
- **Hardware back (Android):** does not silently forfeit; opens pause/quit-confirm.
- **Haptics:** fire on eat/death when enabled; silent when disabled.
- **Persistence:** force-quit and relaunch restores last-used settings and high scores.
- **No-audio scaffold:** sound toggle present and functional; no crashes from silent audio service.

### 11.4 Performance tests
- Frame timing on **Dense** preset on a low-end device over a 5+ minute session: no sustained dropped ticks, stable memory, no thermal-driven slowdown beyond the speed cap.

### 11.5 Tooling
- **Jest** for engine + logic (fast, runs in CI without a device).
- **React Native Testing Library** for component/integration.
- **Maestro** (optional) for a few end-to-end smoke flows (home → play → die → play again → home).
- Engine layer should target **high coverage**; UI layer pragmatic coverage of the flows above.

---

## 12. Acceptance Criteria / Definition of Done

The MVP is "done" when:
1. All **FR-** requirements in §3 are implemented and pass their mapped tests in §11.
2. All six preset×wall combinations are playable end-to-end (tap-to-start → play → win/loss → play again / home).
3. High scores persist correctly per wall behavior and survive relaunch; reset works behind a confirm dialog.
4. Last-used settings persist and are restored on relaunch.
5. Pause (manual + auto) and the 3-second resume countdown behave per spec, with no double-timer or desync bugs.
6. Haptics fire on eat/death (when enabled); the audio service is wired and silent without errors.
7. The single green-on-black skin renders through the skin system, head brighter than body.
8. No crashes across the §11.3 lifecycle scenarios; corrupt/missing storage degrades gracefully to defaults.
9. Dense preset meets the performance bar in §11.4 on a low-end device.
10. Builds install and run on both Android and iOS via Expo.

---

## 13. Phase-2 Architectural Hooks

Already accounted for so phase-2 work avoids rewrites:
- **InputSource** interface → add `DPadInput` without touching the engine.
- **Mode** interface → add `dynamicWallsMode` / `gpsMode`; the runtime already drives modes generically.
- **Skin** interface + provider → add skins and a Settings selection UI; rendering already reads tokens from the active skin.
- **SoundPort** with wired trigger points → drop in real SFX + music by swapping the silent impl.
- **StoragePort** → add a Firebase/composite adapter implementing the same contract for auth + online leaderboards.
- **Versioned storage keys** (`.v1`) → schema migration path is in place.
- **Scoring/score-store** isolated → adding bonus food or remote leaderboard submission is localized.

---

## 14. Open Tuning Items

Confirmed as tunable during development (no fixed value required at handoff):
- Exact **target columns** per preset (~10 / ~16 / ~24 starting points).
- **baseTickMs / minTickMs / accelMsPerFood** per preset (moderate base, capped max).
- Exact **green-on-black** color values, cell-gap size, and whether grid lines are faint or absent.
- **Countdown** styling and the tap-to-start affordance presentation.
- Final **app name** (currently *Coil*).