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

  it('every skin defines obstacleColor (Prompt 41)', () => {
    for (const id of SKIN_IDS) {
      expect(typeof SKINS[id].obstacleColor).toBe('string');
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
      expect(s.obstacleColor).toMatch(hex);
    }
  });

  describe('ui block (menu/chrome theme layer)', () => {
    const hex = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;
    // Scrim is the one token allowed an alpha channel (rgba or 8-digit hex).
    const scrimLike =
      /^(#([0-9a-fA-F]{8}|[0-9a-fA-F]{6})|rgba?\([\d\s.,%]+\))$/;

    /** Relative luminance (0 dark → 1 light) of a #RRGGBB color. */
    const luminance = (color: string): number => {
      const raw = color.slice(1);
      const full =
        raw.length === 3
          ? raw
              .split('')
              .map((c) => c + c)
              .join('')
          : raw;
      const channel = (i: number) =>
        parseInt(full.slice(i * 2, i * 2 + 2), 16) / 255;
      return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
    };

    it('every skin has a complete ui block with color tokens', () => {
      for (const id of SKIN_IDS) {
        const { ui } = SKINS[id];
        expect(typeof ui.isLight).toBe('boolean');
        expect(ui.surface).toMatch(hex);
        expect(ui.surfaceRaised).toMatch(hex);
        expect(ui.border).toMatch(hex);
        expect(ui.textPrimary).toMatch(hex);
        expect(ui.textSecondary).toMatch(hex);
        expect(ui.accent).toMatch(hex);
        expect(ui.onAccent).toMatch(hex);
        expect(ui.danger).toMatch(hex);
        expect(ui.scrim).toMatch(scrimLike);
      }
    });

    it('text contrast direction is sane for every skin (dark text on light surfaces and vice versa)', () => {
      for (const id of SKIN_IDS) {
        const { ui } = SKINS[id];
        const surfaceLum = luminance(ui.surface);
        const textLum = luminance(ui.textPrimary);
        if (ui.isLight) {
          // Light skin: surface bright, primary text dark.
          expect(surfaceLum).toBeGreaterThan(0.4);
          expect(textLum).toBeLessThan(0.25);
        } else {
          // Dark skin: surface deep, primary text bright.
          expect(surfaceLum).toBeLessThan(0.2);
          expect(textLum).toBeGreaterThan(0.6);
        }
        // The gap itself must be large in both directions.
        expect(Math.abs(surfaceLum - textLum)).toBeGreaterThan(0.35);
      }
    });

    it('monoLcd is the light skin and produces dark readable text (readability bug fix)', () => {
      const ui = SKINS.monoLcd.ui;
      expect(ui.isLight).toBe(true);
      expect(luminance(ui.textPrimary)).toBeLessThan(
        luminance(ui.surface),
      );
      // onAccent must read against the accent fill too.
      expect(
        Math.abs(luminance(ui.onAccent) - luminance(ui.accent)),
      ).toBeGreaterThan(0.3);
    });

    it('onAccent reads against accent for every skin', () => {
      for (const id of SKIN_IDS) {
        const { ui } = SKINS[id];
        expect(
          Math.abs(luminance(ui.onAccent) - luminance(ui.accent)),
        ).toBeGreaterThan(0.3);
      }
    });
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
