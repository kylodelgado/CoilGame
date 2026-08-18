import { StyleSheet, Text, View } from 'react-native';
import type { GameController } from '../runtime/GameController';
import { GlowButton, Panel, useTheme } from '../ui';

interface PauseOverlayProps {
  controller: GameController;
  /**
   * Restart hook: the screen wraps controller.restart() so it can also bump
   * the renderer's resetKey. Defaults to a plain controller.restart().
   */
  onRestart?: () => void;
  /** Navigate Home after forfeiting. */
  onQuitToHome: () => void;
}

/**
 * Shown over the GameScreen while PAUSED (manual or auto-pause); the board stays
 * visible behind the scrim (FR-P5). Resume returns to the countdown, Restart
 * begins a fresh run with the same config, and Quit forfeits — controller.quit()
 * already guarantees no score is recorded — then navigates Home. (FR-P3, FR-P6)
 */
export function PauseOverlay({
  controller,
  onRestart,
  onQuitToHome,
}: PauseOverlayProps) {
  const { ui, spacing, type } = useTheme();

  return (
    <View
      testID="pause-overlay"
      accessibilityViewIsModal
      style={[styles.overlay, { backgroundColor: ui.scrim }]}
    >
      <Panel style={[styles.panel, { gap: spacing.md }]}>
        <Text
          accessibilityRole="header"
          style={[type.title, styles.title, { color: ui.textPrimary }]}
        >
          Paused
        </Text>

        <GlowButton
          testID="resume-button"
          label="Resume"
          variant="primary"
          onPress={() => controller.resume()}
        />

        <GlowButton
          testID="restart-button"
          label="Restart"
          variant="secondary"
          onPress={onRestart ?? (() => controller.restart())}
        />

        <GlowButton
          testID="quit-button"
          label="Quit to Home"
          variant="secondary"
          accessibilityHint="Forfeits the run without recording a score"
          onPress={() => {
            controller.quit(); // forfeit — never records a score
            onQuitToHome();
          }}
        />
      </Panel>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  panel: { alignSelf: 'stretch', maxWidth: 420 },
  title: { textAlign: 'center', marginBottom: 4 },
});
