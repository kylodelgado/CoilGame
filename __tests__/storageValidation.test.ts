import {
  DEFAULT_SCORES,
  DEFAULT_SETTINGS,
  validateScores,
  validateSettings,
} from '../src/services/StoragePort';
import type { PersistedScores, PersistedSettings } from '../src/engine/types';

describe('validateSettings (EH-1, §8.5)', () => {
  it('passes a well-formed settings object through unchanged', () => {
    const good: PersistedSettings = {
      presetId: 'DENSE',
      wallBehavior: 'PORTAL',
      soundEnabled: false,
      hapticsEnabled: true,
      skinId: 'neon',
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
});

describe('validateScores (EH-1, §8.5)', () => {
  it('passes a well-formed scores object through unchanged', () => {
    const good: PersistedScores = { bestSolid: 120, bestPortal: 0 };
    expect(validateScores(good)).toEqual(good);
  });

  it('falls back to 0 for negative, NaN, non-integer, or missing values', () => {
    expect(validateScores({ bestSolid: -5, bestPortal: 30 })).toEqual({
      bestSolid: 0,
      bestPortal: 30,
    });
    expect(validateScores({ bestSolid: NaN, bestPortal: 10 })).toEqual({
      bestSolid: 0,
      bestPortal: 10,
    });
    expect(validateScores({ bestSolid: 3.5, bestPortal: 10 })).toEqual({
      bestSolid: 0,
      bestPortal: 10,
    });
    expect(validateScores({ bestPortal: 10 })).toEqual({
      bestSolid: 0,
      bestPortal: 10,
    });
    expect(validateScores({ bestSolid: Infinity, bestPortal: 10 })).toEqual({
      bestSolid: 0,
      bestPortal: 10,
    });
    expect(validateScores({ bestSolid: '7', bestPortal: 10 })).toEqual({
      bestSolid: 0,
      bestPortal: 10,
    });
  });

  it('returns DEFAULT_SCORES for non-object input', () => {
    for (const bad of [null, undefined, 'string', 42, [], true, NaN]) {
      expect(validateScores(bad)).toEqual(DEFAULT_SCORES);
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
      { bestSolid: {} },
      Symbol('x'),
      () => undefined,
    ];
    for (const input of inputs) {
      expect(() => validateScores(input)).not.toThrow();
    }
  });
});
