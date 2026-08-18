/**
 * Menu/chrome design tokens carried by every skin, so the whole app UI —
 * not just the board — restyles when the skin changes. Values must be
 * self-consistent: on a LIGHT skin (isLight true, e.g. monoLcd's pale LCD
 * green) text tokens must be dark, and vice versa, so nothing is ever
 * light-on-light or dark-on-dark. Consumed via src/ui/theme's useTheme().
 */
export interface SkinUi {
  /** True when surfaces are light and text must be dark (e.g. monoLcd). */
  isLight: boolean;
  /** Base screen background for menus and overlays. */
  surface: string;
  /** Raised panel/card background, one layer above surface. */
  surfaceRaised: string;
  /** 1px luminous panel/divider border color. */
  border: string;
  /** Primary text — must contrast strongly against surface/surfaceRaised. */
  textPrimary: string;
  /** Secondary/caption text — readable but recessive. */
  textSecondary: string;
  /** The skin's glowing brand accent (buttons, selection, highlights). */
  accent: string;
  /** Text/icon color that reads on top of an accent-filled control. */
  onAccent: string;
  /** Destructive/danger color (reset, delete, hot end of gauges). */
  danger: string;
  /** Modal scrim (rgba — the one token allowed an alpha channel). */
  scrim: string;
}

/**
 * Visual design tokens for the board and its actors. Renderers read every color
 * and shape decision from the active Skin (via useSkin) — no hard-coded colors —
 * so new skins drop in for Phase 2 with zero rendering changes. (FR-A4/A5)
 */
export interface Skin {
  id: string;
  /** Board background color. */
  background: string;
  /** Grid line color, or null for no grid lines. */
  gridLine: string | null;
  /**
   * How the grid reads: 'lines' strokes every cell (the classic look), 'dots'
   * marks only the interior intersections — enough for the player to aim by,
   * without the graph-paper feel — and 'none' hides it entirely. Optional so
   * existing skins keep their behavior: defaults to 'lines' when gridLine is
   * set, 'none' when it is null.
   */
  gridStyle?: 'lines' | 'dots' | 'none';
  /**
   * Organic board treatment: a soft center light tinted toward the snake's
   * color, an edge vignette, and a whisper of noise grain over the background.
   * Purely decorative — cell geometry is untouched. Off unless set.
   */
  boardOrganic?: boolean;
  /**
   * Draw the pre-rendered Blender ground (assets/board/backdrop.png — a dark
   * terrarium floor with the pool of light and vignette baked in) across the
   * board. While the image decodes, the boardOrganic gradient stands in, so
   * skins setting this should usually set boardOrganic too. Off unless set.
   */
  boardBackdrop?: boolean;
  /** Pixel gap between adjacent cells. */
  cellGap: number;
  cellShape: 'square' | 'rounded';
  /** Snake head color — brighter than the body so it stays locatable. */
  snakeHead: string;
  snakeBody: string;
  /**
   * How the snake body is drawn: 'tube' = one continuous stroked path that flows
   * smoothly around corners; 'segments' = discrete rounded cells with a gap, the
   * classic blocky look. The renderer picks per skin. (snake render)
   */
  snakeRender: 'tube' | 'segments';
  foodColor: string;
  foodShape: 'square' | 'circle';
  /** Bonus pickup color — distinct from foodColor so it reads as special. */
  bonusColor: string;
  bonusShape: 'square' | 'circle';
  /** Dynamic-walls obstacle color — reads as a hazard, distinct from the snake. */
  obstacleColor: string;
  /** Menu/chrome tokens: every skin styles the whole app, not just the board. */
  ui: SkinUi;
}
