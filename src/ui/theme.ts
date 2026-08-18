import { useMemo } from 'react';
import type { TextStyle } from 'react-native';
import type { Skin, SkinUi } from '../skins/Skin';
import { useSkin } from '../skins/SkinProvider';
import { useDisplayFontFamily } from './fonts';

/**
 * The app-wide design language for menus and chrome ("Neon Terrarium"): deep
 * layered dark panels, 1px luminous borders, glowing accents drawn from the
 * active skin, bold tight-tracked titles, tabular numerals for scores. Colors
 * always come from the active skin's ui block (via useTheme) so screens carry
 * ZERO hardcoded hex — switching skins restyles every screen, and the light
 * monoLcd skin automatically produces dark, readable text.
 */

/** Spacing scale (px). Index into it or use the named aliases below. */
export const SPACING = [4, 8, 12, 16, 24, 32] as const;

export interface Spacing {
  /** 4 */ xs: number;
  /** 8 */ sm: number;
  /** 12 */ md: number;
  /** 16 */ lg: number;
  /** 24 */ xl: number;
  /** 32 */ xxl: number;
}

export const spacing: Spacing = {
  xs: SPACING[0],
  sm: SPACING[1],
  md: SPACING[2],
  lg: SPACING[3],
  xl: SPACING[4],
  xxl: SPACING[5],
};

export interface Radius {
  /** Chips, small controls. */ sm: number;
  /** Buttons, inputs. */ md: number;
  /** Panels, cards. */ lg: number;
  /** Fully-rounded pills. */ pill: number;
}

export const radius: Radius = { sm: 8, md: 12, lg: 16, pill: 999 };

/**
 * Type scale: system font, heavy weights with tight letter-spacing for titles,
 * generous line-height for body copy. Numerals in scores must additionally set
 * fontVariant: ['tabular-nums'] (see `type.score`).
 */
export interface TypeScale {
  /** Brand wordmark / screen-filling display text. */
  display: TextStyle;
  /** Screen titles. */
  title: TextStyle;
  /** Section/panel headings. */
  heading: TextStyle;
  /** Default body copy. */
  body: TextStyle;
  /** Secondary copy and captions. */
  caption: TextStyle;
  /** All-caps micro labels (section headers, chips). */
  label: TextStyle;
  /** Big score numerals — always tabular so digits never jitter. */
  score: TextStyle;
}

export const typeScale: TypeScale = {
  display: { fontSize: 44, fontWeight: '900', letterSpacing: 2 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  heading: { fontSize: 18, fontWeight: '700', letterSpacing: -0.25 },
  body: { fontSize: 16, fontWeight: '400', lineHeight: 24 },
  caption: { fontSize: 13, fontWeight: '500', lineHeight: 19 },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  score: {
    fontSize: 28,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
};

/**
 * Resolve the type scale against the (possibly absent) display font. When the
 * vendored title face is loaded, display and title carry its fontFamily —
 * Audiowide ships a single 400 weight, so the synthetic-heavy system weights
 * are dropped and tracking is retuned for its naturally wide letterforms.
 * With no font (still loading, download failed, jest) the base system-font
 * scale is returned untouched.
 */
export function resolveTypeScale(
  displayFontFamily: string | undefined,
): TypeScale {
  if (displayFontFamily === undefined) {
    return typeScale;
  }
  return {
    ...typeScale,
    display: {
      ...typeScale.display,
      fontFamily: displayFontFamily,
      fontWeight: '400',
      letterSpacing: 3,
    },
    title: {
      ...typeScale.title,
      fontFamily: displayFontFamily,
      fontWeight: '400',
      letterSpacing: 0.5,
    },
  };
}

/** Minimum touch-target edge (pt) — every Pressable respects this. */
export const MIN_TOUCH = 44;

/**
 * Medal accents for leaderboard ranks 1–3. Universal podium colors, owned by
 * the design system (screens still carry zero hex of their own).
 */
export const MEDALS: readonly string[] = ['#FFD700', '#C0C0C0', '#CD7F32'];

export interface Theme {
  /** The full active skin (board tokens included) for previews/gauges. */
  skin: Skin;
  /** Menu/chrome tokens for the active skin. */
  ui: SkinUi;
  spacing: Spacing;
  radius: Radius;
  type: TypeScale;
  /**
   * The loaded display family (Audiowide) or undefined while unavailable.
   * type.display/type.title already resolve it; this token is for surfaces
   * outside those slots (section headers, the PLAY label) that opt in.
   */
  displayFontFamily: string | undefined;
}

/**
 * The single hook every screen/component styles from: the active skin's ui
 * block plus the shared spacing/radius/type scales. Because it reads useSkin,
 * a skin change re-renders and restyles every themed surface at once — and
 * because it reads the display-font store, titles restyle the moment the
 * vendored face finishes loading (system font until then, forever if never).
 */
export function useTheme(): Theme {
  const skin = useSkin();
  const displayFontFamily = useDisplayFontFamily();
  const type = useMemo(
    () => resolveTypeScale(displayFontFamily),
    [displayFontFamily],
  );
  return { skin, ui: skin.ui, spacing, radius, type, displayFontFamily };
}
