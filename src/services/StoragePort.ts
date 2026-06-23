import type {
  PersistedScores,
  PersistedSettings,
  PresetId,
  WallBehavior,
} from '../engine/types';

/**
 * Persistence contract for Coil. Implementations (e.g. an AsyncStorage adapter)
 * are responsible for I/O; the validators below are the pure safety net that
 * guarantees corrupt or missing data degrades to defaults instead of crashing
 * the UI. (§8.5, EH-1)
 */
export interface StoragePort {
  getSettings(): Promise<PersistedSettings>;
  setSettings(s: PersistedSettings): Promise<void>;
  getScores(): Promise<PersistedScores>;
  setScores(s: PersistedScores): Promise<void>;
  resetScores(): Promise<void>;
}

export const DEFAULT_SETTINGS: PersistedSettings = {
  presetId: 'STANDARD',
  wallBehavior: 'SOLID',
  soundEnabled: true,
  hapticsEnabled: true,
};

export const DEFAULT_SCORES: PersistedScores = {
  bestSolid: 0,
  bestPortal: 0,
};

export const SETTINGS_KEY = 'coil.settings.v1';
export const SCORES_KEY = 'coil.scores.v1';

const PRESET_IDS: readonly PresetId[] = ['CLASSIC', 'STANDARD', 'DENSE'];
const WALL_BEHAVIORS: readonly WallBehavior[] = ['SOLID', 'PORTAL'];

/** Narrow to a plain (non-null, non-array) object for safe property access. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPresetId(value: unknown): value is PresetId {
  return PRESET_IDS.includes(value as PresetId);
}

function isWallBehavior(value: unknown): value is WallBehavior {
  return WALL_BEHAVIORS.includes(value as WallBehavior);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/**
 * Coerce arbitrary persisted data into valid PersistedSettings, falling back to
 * the corresponding default for any invalid or missing field. Pure and total —
 * never throws for any input.
 */
export function validateSettings(raw: unknown): PersistedSettings {
  if (!isRecord(raw)) {
    return { ...DEFAULT_SETTINGS };
  }
  return {
    presetId: isPresetId(raw.presetId)
      ? raw.presetId
      : DEFAULT_SETTINGS.presetId,
    wallBehavior: isWallBehavior(raw.wallBehavior)
      ? raw.wallBehavior
      : DEFAULT_SETTINGS.wallBehavior,
    soundEnabled:
      typeof raw.soundEnabled === 'boolean'
        ? raw.soundEnabled
        : DEFAULT_SETTINGS.soundEnabled,
    hapticsEnabled:
      typeof raw.hapticsEnabled === 'boolean'
        ? raw.hapticsEnabled
        : DEFAULT_SETTINGS.hapticsEnabled,
  };
}

/**
 * Coerce arbitrary persisted data into valid PersistedScores. Each best score
 * must be a non-negative integer; anything else falls back to 0. Non-object
 * input yields the full default. Pure and total — never throws.
 */
export function validateScores(raw: unknown): PersistedScores {
  if (!isRecord(raw)) {
    return { ...DEFAULT_SCORES };
  }
  return {
    bestSolid: isNonNegativeInteger(raw.bestSolid) ? raw.bestSolid : 0,
    bestPortal: isNonNegativeInteger(raw.bestPortal) ? raw.bestPortal : 0,
  };
}
