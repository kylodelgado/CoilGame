import type {
  ControlScheme,
  ModeId,
  PersistedScores,
  PersistedSettings,
  PresetId,
  WallBehavior,
} from '../engine/types';
import { SKIN_IDS, type SkinId } from '../skins/registry';

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
  skinId: 'greenOnBlack',
  controlScheme: 'SWIPE',
  modeId: 'CLASSIC',
};

export const DEFAULT_SCORES: PersistedScores = {
  bests: {},
};

export const SETTINGS_KEY = 'coil.settings.v1';
/** Old flat scores key, read only to migrate forward. */
export const SCORES_KEY_V1 = 'coil.scores.v1';
/** Current keyed scores key (MODE:WALL record). */
export const SCORES_KEY = 'coil.scores.v2';

const PRESET_IDS: readonly PresetId[] = ['CLASSIC', 'STANDARD', 'DENSE'];
const WALL_BEHAVIORS: readonly WallBehavior[] = ['SOLID', 'PORTAL'];
const CONTROL_SCHEMES: readonly ControlScheme[] = ['SWIPE', 'DPAD'];
const MODE_IDS: readonly ModeId[] = ['CLASSIC', 'DYNAMIC_WALLS', 'GPS'];

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

function isSkinId(value: unknown): value is SkinId {
  return SKIN_IDS.includes(value as SkinId);
}

function isControlScheme(value: unknown): value is ControlScheme {
  return CONTROL_SCHEMES.includes(value as ControlScheme);
}

function isModeId(value: unknown): value is ModeId {
  return MODE_IDS.includes(value as ModeId);
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
    skinId: isSkinId(raw.skinId) ? raw.skinId : DEFAULT_SETTINGS.skinId,
    controlScheme: isControlScheme(raw.controlScheme)
      ? raw.controlScheme
      : DEFAULT_SETTINGS.controlScheme,
    modeId: isModeId(raw.modeId) ? raw.modeId : DEFAULT_SETTINGS.modeId,
  };
}

/**
 * Coerce arbitrary persisted data into valid v2 PersistedScores: a `bests`
 * record of string -> non-negative integer. Invalid entries are dropped; any
 * non-object (or a missing/invalid `bests`) yields an empty record. Pure and
 * total — never throws.
 */
export function validateScores(raw: unknown): PersistedScores {
  if (!isRecord(raw) || !isRecord(raw.bests)) {
    return { bests: {} };
  }
  const bests: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw.bests)) {
    if (isNonNegativeInteger(value)) {
      bests[key] = value;
    }
  }
  return { bests };
}

/**
 * Migrate an old flat v1 scores blob ({ bestSolid, bestPortal }) to the v2
 * keyed record, mapping the two bests onto the CLASSIC mode keys (only non-zero
 * entries are carried). Total and idempotent (EH-17): an already-v2 blob (one
 * with a `bests` record) passes straight through the validator.
 */
export function migrateScores(rawV1: unknown): PersistedScores {
  if (isRecord(rawV1) && isRecord(rawV1.bests)) {
    return validateScores(rawV1); // already migrated — idempotent
  }
  const bests: Record<string, number> = {};
  if (isRecord(rawV1)) {
    if (isNonNegativeInteger(rawV1.bestSolid) && rawV1.bestSolid > 0) {
      bests['CLASSIC:SOLID'] = rawV1.bestSolid;
    }
    if (isNonNegativeInteger(rawV1.bestPortal) && rawV1.bestPortal > 0) {
      bests['CLASSIC:PORTAL'] = rawV1.bestPortal;
    }
  }
  return { bests };
}
