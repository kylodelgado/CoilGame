// Core domain vocabulary for Coil. Types only — no runtime code in this file.
// Imported by every later layer, so the names and shapes are fixed.

import type { SkinId } from '../skins/registry';

export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

export type WallBehavior = 'SOLID' | 'PORTAL';

export type PresetId = 'CLASSIC' | 'STANDARD' | 'DENSE';

/** The selectable game modes. */
export type ModeId = 'CLASSIC' | 'DYNAMIC_WALLS' | 'GPS';

export type GameStatus =
  | 'TAP_TO_START'
  | 'COUNTDOWN'
  | 'RUNNING'
  | 'PAUSED'
  | 'WON'
  | 'LOST';

/** A grid cell. x = column 0..cols-1, y = row 0..rows-1. */
export interface Cell {
  x: number;
  y: number;
}

export interface GridSpec {
  columns: number;
  rows: number;
  cellSize: number;
  originX: number;
  originY: number;
}

/**
 * The play world for GPS mode — a board larger than the on-screen viewport.
 * Entities (snake/food/bonus/obstacles) live in WORLD coordinates; the camera
 * (chunk M render) shows a moving window of it. For fixed-board modes this is
 * absent and the engine operates on GridSpec as before.
 */
export interface WorldSpec {
  worldColumns: number;
  worldRows: number;
  cellSize: number;
}

export interface Preset {
  id: PresetId;
  label: string;
  targetColumns: number;
  baseTickMs: number;
  minTickMs: number;
  accelMsPerFood: number;
}

/** Bonus-food tunables. When disabled the engine is a byte-identical classic. */
export interface BonusConfig {
  enabled: boolean;
  /** Ticks between bonus spawns (countdown restarts after each despawn). */
  spawnEveryTicks: number;
  /** How many ticks a spawned bonus stays on the board before expiring. */
  lifetimeTicks: number;
  /** Extra points awarded for eating a bonus (no snake growth). */
  points: number;
}

/**
 * The kinds of pickup that can occupy the single bonus slot. POINTS is the
 * classic bonus (points, no growth); the rest are powerups with timed or
 * permanent effects. WALL_BUSTER is only ever placed in pools for modes that
 * have obstacles. (Phase 2 powerups)
 */
export type PowerupKind =
  | 'POINTS'
  | 'MAGNET'
  | 'SLOW'
  | 'SHRINK'
  | 'DOUBLE'
  | 'WALL_BUSTER';

/** A powerup whose effect lasts a number of ticks; tracked in GameState. */
export interface ActiveEffect {
  kind: PowerupKind;
  /** Ticks left before the effect ends; counts down each RUNNING tick. */
  remainingTicks: number;
  /** The duration it started with, so the UI can draw a countdown fraction. */
  totalTicks: number;
}

/**
 * Powerup tunables, layered ON TOP of BonusConfig (which still governs the
 * pickup's spawn cadence and on-board lifetime). Present only for modes that opt
 * into powerups; absent => the bonus slot is always POINTS and play is
 * byte-identical to before. (Phase 2 powerups)
 */
export interface PowerupsConfig {
  /** Kinds eligible to spawn; repeat a kind to weight it more likely. */
  pool: PowerupKind[];
  /** Active duration (ticks) for each timed effect. */
  durationTicks: Record<'MAGNET' | 'DOUBLE' | 'WALL_BUSTER', number>;
  /** Milliseconds added to tickMs per SLOW pickup (permanent for the run). */
  slowMs: number;
  /** Tail cells removed by SHRINK. */
  shrinkBy: number;
  /** Length SHRINK will never reduce the snake below. */
  minLength: number;
  /** Score multiplier while DOUBLE is active. */
  doubleMultiplier: number;
  /** Chebyshev radius of obstacle clearing around the head under WALL_BUSTER. */
  wallBusterRadius: number;
}

export interface GameConfig {
  grid: GridSpec;
  wallBehavior: WallBehavior;
  baseTickMs: number;
  minTickMs: number;
  accelMsPerFood: number;
  pointsPerFood: number;
  startLength: number;
  startDirection: Direction;
  bonus: BonusConfig;
  /**
   * Present only for world-based (GPS) modes. When set, the world helpers run
   * the engine over a world-sized grid while `grid` stays the on-screen viewport.
   * Additive and optional, so fixed-board configs are unchanged.
   */
  world?: WorldSpec;
  /**
   * Present only for modes that opt into powerups. When set, the bonus slot
   * spawns a kind drawn from the pool and the engine applies powerup effects;
   * absent => the bonus slot is always POINTS. Additive and optional, so classic
   * configs are byte-identical. (Phase 2 powerups)
   */
  powerups?: PowerupsConfig;
}

export interface GameState {
  status: GameStatus;
  /** snake[0] is the head. */
  snake: Cell[];
  direction: Direction;
  inputQueue: Direction[];
  food: Cell | null;
  score: number;
  foodEaten: number;
  tickMs: number;
  /** Active bonus pickup, or null when none is on the board. */
  bonusFood: Cell | null;
  /** Ticks until the current bonus expires; 0 when no bonus is active. */
  bonusRemaining: number;
  /**
   * Ticks until the next bonus spawn. Counts down only while no bonus is on the
   * board. BONUS_DISABLED (Infinity) when bonus is disabled — the engine never
   * touches it in that case, keeping classic play byte-identical.
   */
  ticksUntilBonus: number;
  /**
   * Cells currently blocked: the snake dies on contact and spawns avoid them.
   * Empty for classic play (byte-identical). A Mode mutates this between ticks;
   * the engine treats it as read-only within a single tick. (Dynamic Walls)
   */
  obstacles: Cell[];
  /**
   * Kind of the pickup currently in the bonus slot (the bonusFood cell). Absent
   * (treated as POINTS) for non-powerup play, keeping classic byte-identical.
   * (Phase 2 powerups)
   */
  powerupKind?: PowerupKind;
  /** Timed powerups in effect, each counting down; absent => none. */
  activeEffects?: ActiveEffect[];
  /** Accumulated permanent slow (ms) added to tickMs; absent => 0. */
  slowMs?: number;
  /**
   * Set to the kind eaten THIS tick (and cleared the next), purely as a one-shot
   * signal for the UI to flash a "what it does" banner. Pure: it is part of the
   * derived state, not a side effect. (Phase 2 powerups)
   */
  pickupBanner?: PowerupKind | null;
  /**
   * Obstacle cells removed THIS tick by WALL_BUSTER (empty otherwise, cleared the
   * next tick). A one-shot signal so the renderer can burst a destruction effect
   * exactly where walls were smashed — distinct from cap-driven relocation. Pure.
   * (Phase 2 powerups)
   */
  bustedCells?: Cell[];
}

export type ControlScheme = 'SWIPE' | 'DPAD';

export interface PersistedSettings {
  presetId: PresetId;
  wallBehavior: WallBehavior;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  skinId: SkinId;
  controlScheme: ControlScheme;
  modeId: ModeId;
}

/**
 * High scores keyed by `${ModeId}:${WallBehavior}` (e.g. 'CLASSIC:SOLID'). A
 * second mode made the old flat { bestSolid, bestPortal } ambiguous, so scores
 * migrated from coil.scores.v1 (flat) to coil.scores.v2 (this keyed record).
 */
export interface PersistedScores {
  bests: Record<string, number>;
}

export type GameEvent =
  | 'ATE_FOOD'
  | 'DIED'
  | 'WON'
  | 'ATE_BONUS'
  | 'BONUS_EXPIRED'
  /** A powerup (non-POINTS) was picked up this tick. */
  | 'GOT_POWERUP'
  /** A timed powerup effect counted down to zero this tick. */
  | 'EFFECT_EXPIRED';

export interface TickResult {
  state: GameState;
  events: GameEvent[];
}
