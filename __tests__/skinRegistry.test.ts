import { SKIN_IDS, SKINS, getSkin, type SkinId } from '../src/skins/registry';
import { greenOnBlack } from '../src/skins/greenOnBlack';
import type { Skin } from '../src/skins/Skin';

/**
 * The registry is the single source of truth for which skins exist, used by the
 * selection UI and the settings validator. These tests guard that the id/key
 * space is consistent, every skin is complete, and lookup is total. (Prompt 31)
 */
describe('skin registry', () => {
  it('SKIN_IDS and SKINS have identical key sets', () => {
    const skinKeys = Object.keys(SKINS).sort();
    const ids = [...SKIN_IDS].sort();
    expect(skinKeys).toEqual(ids);
  });

  it('every SKINS entry has an id matching its key', () => {
    for (const id of SKIN_IDS) {
      expect(SKINS[id].id).toBe(id);
    }
  });

  it('includes at least four skins (greenOnBlack plus three new)', () => {
    expect(SKIN_IDS.length).toBeGreaterThanOrEqual(4);
    expect(SKIN_IDS).toContain('greenOnBlack');
  });

  it('every skin has all required Skin fields with correct types', () => {
    for (const id of SKIN_IDS) {
      const s: Skin = SKINS[id];
      expect(typeof s.id).toBe('string');
      expect(typeof s.background).toBe('string');
      expect(s.gridLine === null || typeof s.gridLine === 'string').toBe(true);
      expect(typeof s.cellGap).toBe('number');
      expect(['square', 'rounded']).toContain(s.cellShape);
      expect(typeof s.snakeHead).toBe('string');
      expect(typeof s.snakeBody).toBe('string');
      expect(typeof s.foodColor).toBe('string');
      expect(['square', 'circle']).toContain(s.foodShape);
    }
  });

  it('every skin has snakeHead distinct from snakeBody', () => {
    for (const id of SKIN_IDS) {
      expect(SKINS[id].snakeHead).not.toBe(SKINS[id].snakeBody);
    }
  });

  it('every skin defines bonusColor and bonusShape (Prompt 35)', () => {
    for (const id of SKIN_IDS) {
      const s = SKINS[id];
      expect(typeof s.bonusColor).toBe('string');
      expect(['square', 'circle']).toContain(s.bonusShape);
    }
  });

  it('every color token is a documented hex string', () => {
    const hex = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;
    for (const id of SKIN_IDS) {
      const s = SKINS[id];
      expect(s.background).toMatch(hex);
      if (s.gridLine !== null) expect(s.gridLine).toMatch(hex);
      expect(s.snakeHead).toMatch(hex);
      expect(s.snakeBody).toMatch(hex);
      expect(s.foodColor).toMatch(hex);
      expect(s.bonusColor).toMatch(hex);
    }
  });

  it('getSkin(validId) returns that skin', () => {
    for (const id of SKIN_IDS) {
      expect(getSkin(id)).toBe(SKINS[id]);
    }
  });

  it('getSkin falls back to greenOnBlack for an unknown id (total)', () => {
    expect(getSkin('nope' as SkinId)).toBe(greenOnBlack);
    expect(getSkin(undefined as unknown as SkinId)).toBe(greenOnBlack);
  });
});
