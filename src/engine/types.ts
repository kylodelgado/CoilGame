// Core domain vocabulary for Coil. Types only — no runtime code in this file.
// Imported by every later layer, so the names and shapes are fixed.

import type { SkinId } from '../skins/registry';

export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

export type WallBehavior = 'SOLID' | 'PORTAL';

export type PresetId = 'CLASSIC' | 'STANDARD' | 'DENSE';

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
}

export interface PersistedSettings {
  presetId: PresetId;
  wallBehavior: WallBehavior;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  skinId: SkinId;
}

export interface PersistedScores {
  bestSolid: number;
  bestPortal: number;
}

export type GameEvent =
  | 'ATE_FOOD'
  | 'DIED'
  | 'WON'
  | 'ATE_BONUS'
  | 'BONUS_EXPIRED';

export interface TickResult {
  state: GameState;
  events: GameEvent[];
}
