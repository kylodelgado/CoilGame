import type { ModeId } from '../engine/types';
import type { Mode } from './Mode';
import { classicMode } from './classicMode';
import { dynamicWallsMode } from './dynamicWallsMode';
import { gpsMode } from './gpsMode';

export * from './Mode';
export * from './classicMode';
export * from './dynamicWallsMode';
export * from './gpsMode';

/** The mode registry: the single source of truth keyed by ModeId. */
export const MODES: Record<ModeId, Mode> = {
  CLASSIC: classicMode,
  DYNAMIC_WALLS: dynamicWallsMode,
  GPS: gpsMode,
};
