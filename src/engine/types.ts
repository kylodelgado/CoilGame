// Core domain vocabulary for Coil. Types only — no runtime code in this file.
// Imported by every later layer, so the names and shapes are fixed.

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

export interface GameConfig {
  grid: GridSpec;
  wallBehavior: WallBehavior;
  baseTickMs: number;
  minTickMs: number;
  accelMsPerFood: number;
  pointsPerFood: number;
  startLength: number;
  startDirection: Direction;
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
}

export interface PersistedSettings {
  presetId: PresetId;
  wallBehavior: WallBehavior;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
}

export interface PersistedScores {
  bestSolid: number;
  bestPortal: number;
}

export type GameEvent = 'ATE_FOOD' | 'DIED' | 'WON';

export interface TickResult {
  state: GameState;
  events: GameEvent[];
}
