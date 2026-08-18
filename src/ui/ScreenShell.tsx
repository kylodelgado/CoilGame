import type { ReactNode } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from './theme';

/**
 * World-mode backdrop art: the active skin's pre-rendered board floor, keyed
 * by skin id. A deliberate LOCAL copy of the asset mapping (src/render owns
 * its own) so menu chrome never imports from the renderer tree.
 */
const WORLD_BACKDROPS: Record<string, number> = {
  greenOnBlack: require('../../assets/board/backdrop_greenOnBlack.webp'),
  amberCrt: require('../../assets/board/backdrop_amberCrt.webp'),
  monoLcd: require('../../assets/board/backdrop_monoLcd.webp'),
  neon: require('../../assets/board/backdrop_neon.webp'),
};

/** Backdrop image opacity under the scrim. */
const WORLD_IMAGE_OPACITY = 0.55;
/** Strengthened scrim alpha so foreground content stays fully readable. */
const WORLD_SCRIM_ALPHA = 0.8;
/** Vignette: stacked border frames, widths and per-frame alpha. */
const VIGNETTE_FRAMES = [64, 40, 20] as const;
const VIGNETTE_FRAME_ALPHA = 0.12;

/**
 * Re-emit a color with a chosen alpha. Handles #rgb/#rrggbb hex and
 * rgb()/rgba() strings; anything else is returned untouched (never throws —
 * a malformed skin token must never take a screen down).
 */
export function withAlpha(color: string, alpha: number): string {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (hex !== null) {
    let raw = hex[1];
    if (raw.length === 3) {
      raw = raw
        .split('')
        .map((c) => c + c)
        .join('');
    }
    const r = parseInt(raw.slice(0, 2), 16);
    const g = parseInt(raw.slice(2, 4), 16);
    const b = parseInt(raw.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(color.trim());
  if (rgb !== null) {
    return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${alpha})`;
  }
  return color;
}

interface ScreenShellProps {
  children: ReactNode;
  /** Scrollable content (Settings-length screens). Defaults to a static View. */
  scroll?: boolean;
  /**
   * World mode: paint the ACTIVE skin's board-floor render full-bleed behind
   * the content, dimmed under a strengthened scrim plus a vignette so
   * foreground content stays fully readable. Layer order (bottom → top):
   * surface color → backdrop image at 0.55 → scrim at 0.80 (the skin's dark
   * scrim base, or a LIGHT surface-tinted scrim on light skins like monoLcd
   * so dark text keeps its contrast) → darker vignette edges → content.
   */
  world?: boolean;
  /** Extra styles for the content container (padding is already applied). */
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Safe-area-aware screen scaffold for every menu surface — replaces the old
 * fixed paddingTop:64 anti-pattern. Reads the real insets (notches, home
 * indicators) and paints the skin's ui.surface behind everything so navigation
 * never flashes an unthemed background. With `world` it additionally renders
 * the skin's board art behind the content (see the prop doc for the layers).
 */
export function ScreenShell({
  children,
  scroll = false,
  world = false,
  contentStyle,
  testID,
}: ScreenShellProps) {
  const { ui, skin, spacing } = useTheme();
  const insets = useSafeAreaInsets();

  const padding: ViewStyle = {
    paddingTop: insets.top + spacing.md,
    paddingBottom: insets.bottom + spacing.lg,
    paddingLeft: insets.left + spacing.xl,
    paddingRight: insets.right + spacing.xl,
  };

  if (!world) {
    if (scroll) {
      return (
        <ScrollView
          testID={testID}
          style={[styles.root, { backgroundColor: ui.surface }]}
          contentContainerStyle={[padding, contentStyle]}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      );
    }
    return (
      <View
        testID={testID}
        style={[
          styles.root,
          { backgroundColor: ui.surface },
          padding,
          contentStyle,
        ]}
      >
        {children}
      </View>
    );
  }

  // World mode. On light skins the backdrop is LIGHT and the text is dark, so
  // dimming must lighten (surface-tinted scrim), not darken; dark skins
  // strengthen their own scrim base. The vignette is always dark — it borrows
  // the scrim's ink so edges recede on every skin.
  const backdrop = WORLD_BACKDROPS[skin.id] ?? WORLD_BACKDROPS.greenOnBlack;
  const scrimColor = ui.isLight
    ? withAlpha(ui.surface, WORLD_SCRIM_ALPHA)
    : withAlpha(ui.scrim, WORLD_SCRIM_ALPHA);
  const vignetteColor = withAlpha(ui.scrim, VIGNETTE_FRAME_ALPHA);

  const layers = (
    <View
      testID="shell-world"
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
    >
      <Image
        testID="shell-world-backdrop"
        source={backdrop}
        resizeMode="cover"
        style={[StyleSheet.absoluteFill, { opacity: WORLD_IMAGE_OPACITY }]}
        accessible={false}
      />
      <View
        testID="shell-world-scrim"
        style={[StyleSheet.absoluteFill, { backgroundColor: scrimColor }]}
      />
      <View testID="shell-world-vignette" style={StyleSheet.absoluteFill}>
        {VIGNETTE_FRAMES.map((width) => (
          <View
            key={width}
            style={[
              StyleSheet.absoluteFill,
              { borderWidth: width, borderColor: vignetteColor },
            ]}
          />
        ))}
      </View>
    </View>
  );

  if (scroll) {
    return (
      <View
        testID={testID}
        style={[styles.root, { backgroundColor: ui.surface }]}
      >
        {layers}
        <ScrollView
          style={styles.root}
          contentContainerStyle={[padding, contentStyle]}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </View>
    );
  }

  return (
    <View testID={testID} style={[styles.root, { backgroundColor: ui.surface }]}>
      {layers}
      <View style={[styles.root, padding, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
