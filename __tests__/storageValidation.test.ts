import {
  DEFAULT_SCORES,
  DEFAULT_SETTINGS,
  migrateScores,
  validateScores,
  validateSettings,
} from '../src/services/StoragePort';
import type { PersistedSettings } from '../src/engine/types';

describe('validateSettings (EH-1, §8.5)', () => {
  it('passes a well-formed settings object through unchanged', () => {
    const good: PersistedSettings = {
      presetId: 'DENSE',
      wallBehavior: 'PORTAL',
      soundEnabled: false,
      hapticsEnabled: true,
      skinId: 'neon',
      controlScheme: 'DPAD',
      modeId: 'DYNAMIC_WALLS',
    };
    expect(validateSettings(good)).toEqual(good);
  });

  it('falls back field-by-field on missing keys', () => {
    expect(validateSettings({})).toEqual(DEFAULT_SETTINGS);
    expect(validateSettings({ presetId: 'CLASSIC' })).toEqual({
      ...DEFAULT_SETTINGS,
      presetId: 'CLASSIC',
    });
  });

  it('falls back field-by-field on wrong types', () => {
    const result = validateSettings({
      presetId: 'STANDARD',
      wallBehavior: 'PORTAL',
      soundEnabled: 'yes', // wrong type
      hapticsEnabled: 0, // wrong type
    });
    expect(result).toEqual({
      presetId: 'STANDARD',
      wallBehavior: 'PORTAL',
      soundEnabled: DEFAULT_SETTINGS.soundEnabled,
      hapticsEnabled: DEFAULT_SETTINGS.hapticsEnabled,
      skinId: DEFAULT_SETTINGS.skinId,
      controlScheme: DEFAULT_SETTINGS.controlScheme,
      modeId: DEFAULT_SETTINGS.modeId,
    });
  });

  it('falls back on out-of-set enum values', () => {
    const result = validateSettings({
      presetId: 'HUGE',
      wallBehavior: 'BOUNCY',
      soundEnabled: true,
      hapticsEnabled: false,
    });
    expect(result).toEqual({
      presetId: DEFAULT_SETTINGS.presetId,
      wallBehavior: DEFAULT_SETTINGS.wallBehavior,
      soundEnabled: true,
      hapticsEnabled: false,
      skinId: DEFAULT_SETTINGS.skinId,
      controlScheme: DEFAULT_SETTINGS.controlScheme,
      modeId: DEFAULT_SETTINGS.modeId,
    });
  });

  it('returns full defaults for completely invalid input', () => {
    for (const bad of [null, undefined, 'string', 42, [], true, NaN]) {
      expect(validateSettings(bad)).toEqual(DEFAULT_SETTINGS);
    }
  });

  it('never throws for any input', () => {
    const inputs: unknown[] = [
      null,
      undefined,
      0,
      '',
      [],
      {},
      { presetId: {} },
      Symbol('x'),
      () => undefined,
      { soundEnabled: null, hapticsEnabled: [] },
    ];
    for (const input of inputs) {
      expect(() => validateSettings(input)).not.toThrow();
    }
  });

  describe('skinId (Prompt 32, additive field)', () => {
    it('defaults skinId when the blob has none (backward compatible)', () => {
      // An old coil.settings.v1 blob from before skins were persisted.
      const legacy = {
        presetId: 'CLASSIC',
        wallBehavior: 'SOLID',
        soundEnabled: true,
        hapticsEnabled: true,
      };
      expect(validateSettings(legacy).skinId).toBe(DEFAULT_SETTINGS.skinId);
    });

    it('falls back to the default for an unknown skinId', () => {
      const result = validateSettings({
        ...DEFAULT_SETTINGS,
        skinId: 'rainbow',
      });
      expect(result.skinId).toBe(DEFAULT_SETTINGS.skinId);
    });

    it('passes a valid skinId through', () => {
      const result = validateSettings({ ...DEFAULT_SETTINGS, skinId: 'neon' });
      expect(result.skinId).toBe('neon');
    });
  });

  describe('controlScheme (Prompt 36, additive field)', () => {
    it('defaults to SWIPE when the blob has none', () => {
      const legacy = {
        presetId: 'CLASSIC',
        wallBehavior: 'SOLID',
        soundEnabled: true,
        hapticsEnabled: true,
      };
      expect(validateSettings(legacy).controlScheme).toBe('SWIPE');
    });

    it('falls back to SWIPE for an unknown controlScheme', () => {
      const result = validateSettings({
        ...DEFAULT_SETTINGS,
        controlScheme: 'JOYSTICK',
      });
      expect(result.controlScheme).toBe('SWIPE');
    });

    it('passes a valid controlScheme through', () => {
      const result = validateSettings({
        ...DEFAULT_SETTINGS,
        controlScheme: 'DPAD',
      });
      expect(result.controlScheme).toBe('DPAD');
    });
  });

  describe('modeId (Prompt 40, additive field)', () => {
    it('defaults to CLASSIC when the blob has none', () => {
      const legacy = {
        presetId: 'CLASSIC',
        wallBehavior: 'SOLID',
        soundEnabled: true,
        hapticsEnabled: true,
      };
      expect(validateSettings(legacy).modeId).toBe('CLASSIC');
    });

    it('falls back to CLASSIC for an unknown modeId', () => {
      const result = validateSettings({ ...DEFAULT_SETTINGS, modeId: 'BATTLE' });
      expect(result.modeId).toBe('CLASSIC');
    });

    it('passes valid modeIds through (incl. GPS)', () => {
      expect(
        validateSettings({ ...DEFAULT_SETTINGS, modeId: 'DYNAMIC_WALLS' })
          .modeId,
      ).toBe('DYNAMIC_WALLS');
      expect(
        validateSettings({ ...DEFAULT_SETTINGS, modeId: 'GPS' }).modeId,
      ).toBe('GPS');
    });
  });
});

describe('validateScores (v2 keyed record, EH-1)', () => {
  it('passes a clean bests record through unchanged', () => {
    const good = { bests: { 'CLASSIC:SOLID': 120, 'DYNAMIC_WALLS:PORTAL': 30 } };
    expect(validateScores(good)).toEqual(good);
  });

  it('drops invalid entries (negative, NaN, non-integer, non-number)', () => {
    const result = validateScores({
      bests: {
        'CLASSIC:SOLID': 120,
        'CLASSIC:PORTAL': -5, // dropped
        'DYNAMIC_WALLS:SOLID': 3.5, // dropped
        'DYNAMIC_WALLS:PORTAL': NaN, // dropped
        bogus: '7', // dropped
      },
    });
    expect(result).toEqual({ bests: { 'CLASSIC:SOLID': 120 } });
  });

  it('defaults to an empty record for non-object input or a missing/invalid bests', () => {
    for (const bad of [null, undefined, 'string', 42, [], true, NaN, {}]) {
      expect(validateScores(bad)).toEqual(DEFAULT_SCORES);
    }
    expect(validateScores({ bests: 5 })).toEqual({ bests: {} });
  });

  it('never throws for any input', () => {
    const inputs: unknown[] = [
      null,
      undefined,
      0,
      '',
      [],
      {},
      { bests: null },
      { bests: { a: {} } },
      Symbol('x'),
      () => undefined,
    ];
    for (const input of inputs) {
      expect(() => validateScores(input)).not.toThrow();
    }
  });
});

describe('migrateScores (v1 flat -> v2 keyed, EH-17)', () => {
  it('maps a v1 flat blob onto the CLASSIC mode keys (non-zero only)', () => {
    expect(migrateScores({ bestSolid: 120, bestPortal: 80 })).toEqual({
      bests: { 'CLASSIC:SOLID': 120, 'CLASSIC:PORTAL': 80 },
    });
    // Zero entries are omitted.
    expect(migrateScores({ bestSolid: 0, bestPortal: 50 })).toEqual({
      bests: { 'CLASSIC:PORTAL': 50 },
    });
  });

  it('is total: garbage input yields an empty record', () => {
    for (const bad of [null, undefined, 'x', 42, []]) {
      expect(migrateScores(bad)).toEqual({ bests: {} });
    }
  });

  it('is idempotent: an already-v2 blob passes straight through', () => {
    const v1 = { bestSolid: 120, bestPortal: 80 };
    const once = migrateScores(v1);
    expect(migrateScores(once)).toEqual(once);
  });
});
