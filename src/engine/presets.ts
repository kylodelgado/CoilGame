import type { Direction, Preset, PresetId } from './types';

/**
 * The tunable preset table. Values are starting points balanced for play feel:
 * fewer columns = larger cells (Classic), more columns = denser board (Dense).
 * minTickMs is always below baseTickMs so the snake can accelerate as it eats.
 */
export const PRESETS: Record<PresetId, Preset> = {
  CLASSIC: {
    id: 'CLASSIC',
    label: 'Classic',
    targetColumns: 10,
    baseTickMs: 175,
    minTickMs: 85,
    accelMsPerFood: 5,
  },
  STANDARD: {
    id: 'STANDARD',
    label: 'Standard',
    targetColumns: 16,
    baseTickMs: 160,
    minTickMs: 76,
    accelMsPerFood: 5,
  },
  DENSE: {
    id: 'DENSE',
    label: 'Dense',
    targetColumns: 24,
    baseTickMs: 145,
    minTickMs: 62,
    accelMsPerFood: 4.5,
  },
};

export const POINTS_PER_FOOD = 10;
export const START_LENGTH = 3;
export const START_DIRECTION: Direction = 'RIGHT';
