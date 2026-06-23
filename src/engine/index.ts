// Public engine API for Coil. The pure game ruleset — no React, no I/O.
// Domain types & constants:           types, PRESETS, POINTS_PER_FOOD, START_LENGTH, START_DIRECTION
// Geometry & speed:                   computeGrid (+ MIN_COLUMNS/MIN_ROWS), computeTickMs
// State & step:                       createInitialState, enqueueDirection, tick
// Lower-level helpers (runtime use):  spawnFood, computeNextHead, resolveWall
export * from './types';
export * from './presets';
export * from './grid';
export * from './speed';
export * from './food';
export * from './input';
export * from './createInitialState';
export * from './movement';
export * from './tick';
